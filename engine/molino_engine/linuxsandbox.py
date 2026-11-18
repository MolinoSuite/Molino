"""Aislamiento del motor en Linux: bubblewrap, Landlock, seccomp y limites.

Hace en Linux lo mismo que ``winsandbox`` en Windows, con la misma forma (ver
``sandbox``), en dos capas que se suman:

1. **bubblewrap**, la herramienta con la que Flatpak encierra sus aplicaciones,
   cuando el sistema lo deja (ver abajo).
2. **Landlock y seccomp** (``linuxconfine``), que cada proceso aislado se pone a
   si mismo antes de arrancar: no necesitan permisos especiales, asi que valen
   tambien donde bubblewrap no puede (Ubuntu 24.04 sin perfil de AppArmor,
   dentro de Flatpak o Snap). Solo leer lo permitido y escribir en su carpeta,
   sin red de ningun tipo y sin crear procesos.

Con bubblewrap, el proceso que analiza los documentos (el "aislado", ver
``broker.py``):

* no ve los archivos del usuario: solo un sistema minimo de solo lectura (/usr
  y las bibliotecas del sistema), el propio motor, sus recursos y su carpeta
  privada (lectura y escritura), y lo que se le conceda de forma explicita
  (``ensure_read_access``: los modelos de la IA, la pieza de oficina, fuentes);
* no tiene red (un espacio de red propio y vacio) ni ve los demas procesos, el
  bus de sesion, la pantalla o el portapapeles (nada de eso se le monta);
* muere si muere quien lo lanzo (``--die-with-parent``), con todo lo que haya
  creado dentro (su propio espacio de procesos), y no puede escribir en la
  terminal (``--new-session``);
* no puede ganar privilegios (``no_new_privs``, bubblewrap lo pone siempre) y
  su memoria esta acotada (``RLIMIT_DATA``, con ``prlimit``).

Si no hay ninguna de las dos capas (ni bubblewrap ni Landlock),
``open_container`` falla y el motor se lanza sin aislar, como en Windows: la
aplicacion lo indica al usuario. Solo se usa el bubblewrap del
sistema (``/usr/bin/bwrap``), nunca uno buscado en el PATH: es el que tiene el
permiso de AppArmor en las distribuciones que lo exigen (Ubuntu 24.04).
"""

from __future__ import annotations

import fcntl
import functools
import hashlib
import json
import os
import re
import shutil
import signal
import stat
import subprocess
import sys
import threading
from dataclasses import dataclass, field
from pathlib import Path
from typing import BinaryIO, Callable

CONTAINER_NAME = "org.molinosuite.molino.motor"
_PIPE_BUFFER = 1024 * 1024
_BWRAP = ("/usr/bin/bwrap", "/bin/bwrap")
_PRLIMIT = ("/usr/bin/prlimit", "/bin/prlimit")


class SandboxError(Exception):
    """No se pudo preparar el aislamiento (``step`` dice en que paso)."""

    def __init__(self, step: str, code: int = 0) -> None:
        super().__init__(f"{step} ({code})" if code else step)
        self.step = step
        self.code = code


def _first_program(candidates: tuple[str, ...]) -> str | None:
    for path in candidates:
        try:
            info = os.stat(path)
        except OSError:
            continue
        if stat.S_ISREG(info.st_mode) and os.access(path, os.X_OK):
            return path
    return None


# --------------------------------------------------------------------- contenedor


@dataclass
class Container:
    """El "contenedor" del motor en Linux: su carpeta privada, lo que puede leer y sus capas."""

    folder: Path
    bwrap: str | None  # None: el sistema no deja usar bubblewrap
    landlock: int  # version de Landlock del nucleo (0: no hay)
    launcher: list[str]  # la orden que pone Landlock y seccomp (este mismo motor)
    readable: list[Path] = field(default_factory=list)

    @property
    def layers(self) -> str:
        names = (["bubblewrap"] if self.bwrap else []) + ([f"Landlock {self.landlock}"] if self.landlock >= 2 else []) + ["seccomp"]
        return " + ".join(names)

    def close(self) -> None:
        pass


def _launcher() -> list[str]:
    """Como lanzar ``linuxconfine`` con este mismo motor (empaquetado o, en desarrollo, el Python base)."""
    if getattr(sys, "frozen", False):
        return [sys.executable]
    engine_dir = str(Path(__file__).resolve().parents[1])
    base = str(Path(getattr(sys, "_base_executable", sys.executable)).resolve())
    boot = (
        f"import sys; sys.path.insert(0, {engine_dir!r}); "
        "from molino_engine.linuxconfine import exec_main; sys.exit(exec_main(sys.argv[1:]))"
    )
    return [base, "-E", "-s", "-S", "-c", boot]


def _data_home() -> Path:
    raw = os.environ.get("XDG_DATA_HOME", "")
    if raw and os.path.isabs(raw):
        return Path(raw)
    return Path.home() / ".local" / "share"


def container_folder(name: str = CONTAINER_NAME) -> Path:
    """Carpeta privada del motor (como la del AppContainer): ``~/.local/share/<nombre>``."""
    return _data_home() / name


def _system_binds() -> list[str]:
    """Lo minimo del sistema para que arranquen Python y las bibliotecas: solo lectura."""
    args = ["--ro-bind", "/usr", "/usr"]
    # Con /usr unificado, /bin, /lib... son enlaces a /usr; si no, carpetas.
    for name in ("bin", "sbin", "lib", "lib32", "lib64", "libx32"):
        path = "/" + name
        if os.path.islink(path):
            args += ["--symlink", os.readlink(path), path]
        elif os.path.isdir(path):
            args += ["--ro-bind", path, path]
    for path in ("/etc/ld.so.cache", "/etc/ld.so.conf", "/etc/ld.so.conf.d", "/etc/fonts", "/etc/localtime", "/etc/alternatives"):
        args += ["--ro-bind-try", path, path]
    return args


@functools.lru_cache(maxsize=1)
def _namespaces_work(bwrap: str) -> bool:
    """¿Deja el sistema a bubblewrap crear sus espacios de nombres? (Se prueba una vez.)"""
    true = _first_program(("/usr/bin/true", "/bin/true"))
    if true is None:
        return False
    try:
        done = subprocess.run(
            [bwrap, "--unshare-all", "--die-with-parent", "--new-session", *_system_binds(),
             "--proc", "/proc", "--dev", "/dev", "--", true],
            stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            env={}, timeout=10, check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return False
    return done.returncode == 0


def open_container(name: str = CONTAINER_NAME) -> Container:
    """Comprueba que se puede aislar (con alguna de las dos capas) y prepara la carpeta privada del motor."""
    from .linuxconfine import ConfineError, landlock_abi, seccomp_program

    bwrap = _first_program(_BWRAP)
    if bwrap is not None and not _namespaces_work(bwrap):
        bwrap = None
    try:
        seccomp_program()
    except ConfineError as exc:  # una arquitectura sin filtro
        raise SandboxError("seccomp") from exc
    abi = landlock_abi()
    if bwrap is None and abi < 2:
        raise SandboxError("ni bubblewrap ni Landlock")
    folder = container_folder(name)
    try:
        folder.parent.mkdir(parents=True, exist_ok=True)
        folder.mkdir(mode=0o700, exist_ok=True)
    except OSError as exc:
        raise SandboxError("carpeta", exc.errno or 0) from exc
    if not plain_directory(folder):
        raise SandboxError("carpeta")
    try:
        os.chmod(folder, 0o700)  # solo el usuario: dentro hay copias de sus documentos
    except OSError as exc:
        raise SandboxError("carpeta", exc.errno or 0) from exc
    return Container(folder, bwrap, abi, _launcher())


def delete_container(name: str = CONTAINER_NAME) -> bool:
    """Borra la carpeta privada del motor (al desinstalar)."""
    folder = container_folder(name)
    if not folder.exists():
        return True
    if not plain_directory(folder):
        return False
    shutil.rmtree(folder, ignore_errors=True)
    return not folder.exists()


def ensure_read_access(path: Path, container: Container) -> bool:
    """El motor aislado podra leer (solo leer) ``path`` y lo que contiene. Devuelve si es nuevo."""
    try:
        target = Path(path).resolve(strict=True)
    except OSError:
        return False
    for known in container.readable:
        if target == known or target.is_relative_to(known):
            return False
    container.readable.append(target)
    return True


# ------------------------------------------------------------------- limites


def process_memory_limit() -> int:
    """Tope de memoria del proceso aislado: la mitad de la fisica, entre 1,5 y 8 GB (como en Windows)."""
    total = 8 << 30
    try:
        with open("/proc/meminfo", encoding="ascii") as handle:
            for line in handle:
                if line.startswith("MemTotal:"):
                    total = int(line.split()[1]) * 1024
                    break
    except (OSError, ValueError, IndexError):
        pass
    return int(max(3 << 29, min(8 << 30, total // 2)))


class Job:
    """Lo que en Windows es el objeto de trabajo: el tope de memoria y matar lo que quede al cerrar."""

    def __init__(self, *, memory_limit: int | None) -> None:
        self.memory_limit = memory_limit
        self._processes: list[subprocess.Popen] = []
        self._lock = threading.Lock()

    def adopt(self, process: subprocess.Popen) -> None:
        with self._lock:
            self._processes.append(process)

    def close(self) -> None:
        with self._lock:
            processes, self._processes = self._processes, []
        for process in processes:
            _kill_group(process)


def _kill_group(process: subprocess.Popen) -> None:
    """Mata el proceso y lo que haya lanzado (cada uno va en su propia sesion)."""
    if process.poll() is not None:
        return
    try:
        os.killpg(process.pid, signal.SIGKILL)
    except (ProcessLookupError, PermissionError):
        pass
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        pass


# ------------------------------------------------------------------------ procesos


class Child:
    """Proceso lanzado por ``spawn`` con sus tres canalizaciones."""

    def __init__(self, process: subprocess.Popen, sandboxed: bool) -> None:
        self._process = process
        self._sandboxed = sandboxed
        self.pid = process.pid
        assert process.stdin is not None and process.stdout is not None and process.stderr is not None
        self.stdin: BinaryIO = process.stdin
        self.stdout: BinaryIO = process.stdout
        self.stderr: BinaryIO = process.stderr

    def poll(self) -> int | None:
        return self._process.poll()

    def wait(self, timeout: float | None = None) -> int | None:
        try:
            return self._process.wait(timeout)
        except subprocess.TimeoutExpired:
            return None

    def kill(self) -> None:
        _kill_group(self._process)

    @property
    def in_appcontainer(self) -> bool:
        """Corre aislado (el nombre es el de Windows, que comparten los dos sistemas)."""
        return self._sandboxed and self._process.poll() is None

    def close(self) -> None:
        for stream in (self.stdin, self.stdout, self.stderr):
            try:
                stream.close()
            except OSError:
                pass


def _user_font_dirs() -> list[str]:
    """Fuentes instaladas solo para el usuario (y su cache): el motor las lee para dibujar."""
    home = Path.home()
    data = _data_home()
    cache = os.environ.get("XDG_CACHE_HOME", "")
    cache_home = Path(cache) if cache and os.path.isabs(cache) else home / ".cache"
    return [str(p) for p in (data / "fonts", home / ".fonts", cache_home / "fontconfig") if p.is_dir()]


def _confine_rules(container: Container) -> str:
    """Lo que el proceso podra leer y escribir con Landlock (linuxconfine), en JSON."""
    return json.dumps({
        "read": [str(p) for p in container.readable] + _user_font_dirs(),
        "write": [str(container.folder)],
    }, ensure_ascii=False)


def _bwrap_args(container: Container, cwd: str, env: dict[str, str]) -> list[str]:
    args = [
        "--unshare-all",  # usuario, procesos, red, IPC, nombre del equipo y cgroup propios
        "--die-with-parent",
        "--new-session",
        "--clearenv",
        *_system_binds(),
        "--proc", "/proc",
        "--dev", "/dev",
        "--tmpfs", "/tmp",
    ]
    for folder in container.readable:
        args += ["--ro-bind", str(folder), str(folder)]
    for folder in _user_font_dirs():
        args += ["--ro-bind-try", folder, folder]
    # Su carpeta privada, la unica en la que puede escribir.
    args += ["--bind", str(container.folder), str(container.folder)]
    for name, value in env.items():
        args += ["--setenv", name, value]
    args += ["--chdir", cwd]
    return args


def spawn(
    cmd: list[str],
    *,
    cwd: str,
    env: dict[str, str],
    container: Container | None,
    job: Job | None,
    block_children: bool = True,  # noqa: ARG001 - siempre: el filtro seccomp no deja crear procesos
) -> Child:
    """Lanza ``cmd`` (sin interprete de ordenes), aislado si hay ``container``.

    Solo hereda sus tres canalizaciones. Con ``job``, su memoria queda acotada
    desde antes de arrancar (``prlimit`` fija el limite y despues lo ejecuta).
    """
    argv = list(cmd)
    run_env = dict(env)
    if container is not None:
        # Landlock y seccomp siempre; dentro de bubblewrap, si lo hay.
        argv = [*container.launcher, "--confine", _confine_rules(container), "--", *argv]
        if container.bwrap:
            argv = [container.bwrap, *_bwrap_args(container, cwd, env), "--", *argv]
            run_env = {}  # el entorno del motor lo pone bubblewrap (--setenv), nada del nuestro
    limit = job.memory_limit if job is not None else None
    prlimit = _first_program(_PRLIMIT) if limit else None
    if limit and prlimit:
        argv = [prlimit, f"--data={limit}:{limit}", "--", *argv]
    process = subprocess.Popen(
        argv,
        cwd=cwd,
        env=run_env,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        bufsize=_PIPE_BUFFER,
        close_fds=True,
        start_new_session=True,
    )
    if job is not None:
        job.adopt(process)
    return Child(process, container is not None)


# ------------------------------------------------------------ carpetas de trabajo

RUN_MARKER = ".en-uso"
_RUN_NAME = re.compile(r"^[0-9a-f]{16}$")
# Como en Windows: dentro de la carpeta del motor, cada perfil de Molino (carpeta
# de datos) tiene la suya para sus ejecuciones y lo que se puede recuperar.
PROFILE_PREFIX = "perfil-"
_PROFILE_NAME = re.compile(r"^perfil-[0-9a-f]{16}$")


def profile_folder_name(main_workdir: Path) -> str:
    """Nombre de la carpeta del perfil dentro del contenedor (no revela la ruta del perfil)."""
    key = os.path.abspath(str(main_workdir)).encode("utf-8")
    return PROFILE_PREFIX + hashlib.sha256(key).hexdigest()[:16]


def other_profiles(own_base: Path) -> list[Path]:
    """Carpetas de los demas perfiles junto a ``own_base`` (solo carpetas de verdad)."""
    try:
        entries = list(os.scandir(own_base.parent))
    except OSError:
        return []
    out = []
    for entry in entries:
        path = Path(entry.path)
        if path != own_base and _PROFILE_NAME.match(entry.name) and plain_directory(path):
            out.append(path)
    return out


def plain_directory(path: Path) -> bool:
    """Es una carpeta de verdad, no un enlace simbolico."""
    try:
        info = os.lstat(path)
    except OSError:
        return False
    return stat.S_ISDIR(info.st_mode)


def _abandoned(run: Path) -> bool:
    """La carpeta de otra ejecucion ya no la usa nadie (su marca no esta bloqueada)."""
    marker = run / RUN_MARKER
    try:
        info = os.lstat(marker)
    except FileNotFoundError:
        return True
    except OSError:
        return False
    if not stat.S_ISREG(info.st_mode):
        return False
    try:
        fd = os.open(marker, os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC)
    except OSError:
        return False
    try:
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            return False  # su intermediario sigue vivo
        fcntl.flock(fd, fcntl.LOCK_UN)
        return True
    finally:
        os.close(fd)


def clean_stale_runs(own: Path, before_delete: Callable[[Path], object] | None = None) -> int:
    """Borra las carpetas de trabajo de ejecuciones anteriores que no terminaron bien (ver winsandbox)."""
    return _clean(own.parent, own, before_delete)


def clean_stale_dirs(base: Path, before_delete: Callable[[Path], object] | None = None) -> int:
    """Igual que ``clean_stale_runs`` para una carpeta en la que no corre este motor."""
    return _clean(base, None, before_delete)


def _clean(base: Path, own: Path | None, before_delete: Callable[[Path], object] | None) -> int:
    removed = 0
    try:
        entries = list(os.scandir(base))
    except OSError:
        return 0
    for entry in entries:
        path = Path(entry.path)
        if path == own or not _RUN_NAME.match(entry.name) or not plain_directory(path):
            continue
        if _abandoned(path):
            if before_delete is not None:
                before_delete(path)
            # rmtree no sigue enlaces simbolicos: borra el enlace, no a donde apunta.
            shutil.rmtree(path, ignore_errors=True)
            removed += 1
    return removed


# ------------------------------------------------------------------- en marcha


def running_emulated() -> bool:
    """En Linux el motor es de la misma arquitectura que el equipo: nunca va emulado."""
    return False


def lock_down_dynamic_code() -> bool:
    """En Windows prohibe generar codigo ejecutable (ACG); Linux no tiene nada igual.

    Lo que si se puede, ya en marcha: que este proceso no pueda ganar
    privilegios (``no_new_privs``; dentro de bubblewrap ya lo esta). Devuelve
    si quedo puesto.
    """
    try:
        import ctypes

        libc = ctypes.CDLL(None, use_errno=True)
        pr_set_no_new_privs = 38
        return libc.prctl(pr_set_no_new_privs, 1, 0, 0, 0) == 0
    except (OSError, AttributeError):
        return False
