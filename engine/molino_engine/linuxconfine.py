"""Segunda capa del aislamiento en Linux: Landlock y seccomp, puestos por el propio motor.

Hace de lanzador: ``molino-engine --confine <reglas> -- programa args...`` se
limita a si mismo y despues se convierte en ``programa`` (execve). Los limites
pasan al programa y ya no se pueden quitar. ``linuxsandbox.spawn`` lo pone
delante de cada proceso aislado (el motor, la conversion a Word, la busqueda
del papel, x2t y la IA), dentro de bubblewrap si lo hay y solo si no.

No necesita permisos especiales ni espacios de nombres, asi que funciona
tambien donde bubblewrap no puede (Ubuntu 24.04 con AppArmor, Flatpak, Snap):

* **Landlock** (nucleo 5.19 o posterior): solo puede leer lo que se le da (el
  sistema, el motor y sus recursos, las fuentes) y escribir en su carpeta, sin
  poder ejecutar nada de lo que escribe. Segun la version del nucleo, tampoco
  conexiones TCP, ni enchufes abstractos ni senales fuera de su grupo.
* **seccomp:** no puede crear enchufes de red de ningun tipo, ni procesos
  (solo hilos), ni usar io_uring (que se saltaria el filtro), ptrace, montar,
  cambiar de espacio de nombres, cargar programas BPF ni modulos del nucleo.

Si algo de esto falla, no se lanza el programa (falla cerrado): el
intermediario lo vuelve a intentar sin aislar y la aplicacion lo indica.
Solo biblioteca estandar: tiene que cargar en un instante, antes que nada.
"""

from __future__ import annotations

import ctypes
import json
import os
import platform
import struct
import sys

# ------------------------------------------------------------------ Landlock

_SYS_CREATE_RULESET, _SYS_ADD_RULE, _SYS_RESTRICT_SELF = 444, 445, 446  # iguales en todas las arquitecturas
_CREATE_RULESET_VERSION = 1
_RULE_PATH_BENEATH = 1

_EXECUTE = 1 << 0
_WRITE_FILE = 1 << 1
_READ_FILE = 1 << 2
_READ_DIR = 1 << 3
_REMOVE_DIR = 1 << 4
_REMOVE_FILE = 1 << 5
_MAKE_CHAR = 1 << 6
_MAKE_DIR = 1 << 7
_MAKE_REG = 1 << 8
_MAKE_SOCK = 1 << 9
_MAKE_FIFO = 1 << 10
_MAKE_BLOCK = 1 << 11
_MAKE_SYM = 1 << 12
_REFER = 1 << 13  # version 2
_TRUNCATE = 1 << 14  # version 3
_NET_BIND_TCP = 1 << 0  # version 4
_NET_CONNECT_TCP = 1 << 1
_SCOPE_ABSTRACT_UNIX = 1 << 0  # version 6
_SCOPE_SIGNAL = 1 << 1

# Lo que todo proceso necesita leer del sistema: bibliotecas, Python, fuentes,
# la zona horaria y lo poco de /proc y /sys que consultan las bibliotecas
# numericas (procesadores y memoria). Nada de la carpeta personal.
_SYSTEM_READ = (
    "/usr", "/lib", "/lib64", "/lib32", "/libx32", "/bin", "/sbin",
    "/etc/ld.so.cache", "/etc/ld.so.conf", "/etc/ld.so.conf.d", "/etc/fonts", "/etc/localtime", "/etc/alternatives",
    "/proc/self", "/proc/cpuinfo", "/proc/meminfo", "/sys/devices/system/cpu", "/sys/fs/cgroup",
    "/dev/urandom", "/dev/random",
)
_SYSTEM_WRITE = ("/dev/null",)

_libc = ctypes.CDLL(None, use_errno=True)
_libc.syscall.restype = ctypes.c_long


class ConfineError(Exception):
    pass


def landlock_abi() -> int:
    """Version de Landlock del nucleo (0: no hay o esta desactivado)."""
    try:
        abi = _libc.syscall(_SYS_CREATE_RULESET, None, ctypes.c_size_t(0), ctypes.c_uint32(_CREATE_RULESET_VERSION))
    except (AttributeError, OSError):
        return 0
    return int(abi) if abi > 0 else 0


class _RulesetAttr(ctypes.Structure):
    _fields_ = [("handled_access_fs", ctypes.c_uint64), ("handled_access_net", ctypes.c_uint64), ("scoped", ctypes.c_uint64)]


class _PathBeneathAttr(ctypes.Structure):
    _layout_ = "ms"  # empaquetada (12 bytes), como la del nucleo
    _pack_ = 1
    _fields_ = [("allowed_access", ctypes.c_uint64), ("parent_fd", ctypes.c_int32)]


def _fs_rights(abi: int) -> int:
    rights = (
        _EXECUTE | _WRITE_FILE | _READ_FILE | _READ_DIR | _REMOVE_DIR | _REMOVE_FILE | _MAKE_CHAR | _MAKE_DIR
        | _MAKE_REG | _MAKE_SOCK | _MAKE_FIFO | _MAKE_BLOCK | _MAKE_SYM
    )
    if abi >= 2:
        rights |= _REFER
    if abi >= 3:
        rights |= _TRUNCATE
    return rights


def _landlock(abi: int, read: list[str], write: list[str], execute: list[str]) -> None:
    handled = _fs_rights(abi)
    attr = _RulesetAttr(handled, (_NET_BIND_TCP | _NET_CONNECT_TCP) if abi >= 4 else 0, (_SCOPE_ABSTRACT_UNIX | _SCOPE_SIGNAL) if abi >= 6 else 0)
    size = 24 if abi >= 6 else 16 if abi >= 4 else 8
    ruleset = _libc.syscall(_SYS_CREATE_RULESET, ctypes.byref(attr), ctypes.c_size_t(size), ctypes.c_uint32(0))
    if ruleset < 0:
        raise ConfineError(f"landlock_create_ruleset: {os.strerror(ctypes.get_errno())}")
    file_only = _EXECUTE | _WRITE_FILE | _READ_FILE | (_TRUNCATE if abi >= 3 else 0)
    read_rights = _READ_FILE | _READ_DIR
    # Donde escribe, todo menos ejecutar y crear dispositivos.
    write_rights = handled & ~(_EXECUTE | _MAKE_CHAR | _MAKE_BLOCK)
    try:
        for paths, rights in ((read, read_rights), (write, write_rights | read_rights), (execute, _EXECUTE | _READ_FILE)):
            for path in paths:
                try:
                    fd = os.open(path, os.O_PATH | os.O_CLOEXEC)
                except OSError:
                    continue  # lo que no existe no hace falta
                try:
                    allowed = rights if os.path.isdir(f"/proc/self/fd/{fd}") else rights & file_only
                    rule = _PathBeneathAttr(allowed, fd)
                    if _libc.syscall(_SYS_ADD_RULE, ctypes.c_int(ruleset), ctypes.c_int(_RULE_PATH_BENEATH), ctypes.byref(rule), ctypes.c_uint32(0)) < 0:
                        raise ConfineError(f"landlock_add_rule {path}: {os.strerror(ctypes.get_errno())}")
                finally:
                    os.close(fd)
        if _libc.syscall(_SYS_RESTRICT_SELF, ctypes.c_int(ruleset), ctypes.c_uint32(0)) < 0:
            raise ConfineError(f"landlock_restrict_self: {os.strerror(ctypes.get_errno())}")
    finally:
        os.close(ruleset)


# ------------------------------------------------------------------- seccomp

_AUDIT_ARCH = {"x86_64": 0xC000003E, "aarch64": 0xC00000B7}
_EPERM, _ENOSYS = 1, 38
_CLONE_THREAD = 0x00010000
# Numeros de las llamadas al sistema que se cierran, por arquitectura.
_DENIED = {
    "x86_64": {
        "socket": 41, "fork": 57, "vfork": 58, "ptrace": 101, "process_vm_readv": 310, "process_vm_writev": 311,
        "unshare": 272, "setns": 308, "mount": 165, "umount2": 166, "pivot_root": 155, "bpf": 321,
        "perf_event_open": 298, "userfaultfd": 323, "keyctl": 250, "add_key": 248, "request_key": 249,
        "kexec_load": 246, "init_module": 175, "finit_module": 313, "delete_module": 176, "open_by_handle_at": 304,
        "io_uring_setup": 425, "io_uring_enter": 426, "io_uring_register": 427,
        "open_tree": 428, "move_mount": 429, "fsopen": 430, "fsconfig": 431, "fsmount": 432, "fspick": 433,
    },
    "aarch64": {
        "socket": 198, "ptrace": 117, "process_vm_readv": 270, "process_vm_writev": 271,
        "unshare": 97, "setns": 268, "mount": 40, "umount2": 39, "pivot_root": 41, "bpf": 280,
        "perf_event_open": 241, "userfaultfd": 282, "keyctl": 219, "add_key": 217, "request_key": 218,
        "kexec_load": 104, "init_module": 105, "finit_module": 273, "delete_module": 106, "open_by_handle_at": 265,
        "io_uring_setup": 425, "io_uring_enter": 426, "io_uring_register": 427,
        "open_tree": 428, "move_mount": 429, "fsopen": 430, "fsconfig": 431, "fsmount": 432, "fspick": 433,
    },
}
_CLONE = {"x86_64": 56, "aarch64": 220}
_CLONE3 = 435

_LD_W_ABS, _JEQ, _JGE, _JSET, _RET = 0x20, 0x15, 0x35, 0x45, 0x06
_RET_ALLOW, _RET_ERRNO, _RET_KILL_PROCESS = 0x7FFF0000, 0x00050000, 0x80000000
_PR_SET_NO_NEW_PRIVS, _PR_SET_SECCOMP, _SECCOMP_MODE_FILTER = 38, 22, 2


def _op(code: int, k: int, jt: int = 0, jf: int = 0) -> bytes:
    return struct.pack("HBBI", code, jt, jf, k)


def seccomp_program(machine: str | None = None) -> bytes:
    """El filtro (BPF clasico) para esta arquitectura; ConfineError si no la conoce."""
    machine = machine or platform.machine()
    if machine not in _AUDIT_ARCH:
        raise ConfineError(f"arquitectura sin filtro: {machine}")
    deny_eperm = _RET_ERRNO | _EPERM
    prog = [
        _op(_LD_W_ABS, 4),  # arquitectura
        _op(_JEQ, _AUDIT_ARCH[machine], 1, 0),
        _op(_RET, _RET_KILL_PROCESS),  # otra (p. ej. llamadas de 32 bits en x86_64): fuera
        _op(_LD_W_ABS, 0),  # numero de la llamada
    ]
    if machine == "x86_64":
        prog += [_op(_JGE, 0x40000000, 0, 1), _op(_RET, deny_eperm)]  # ABI x32
    for number in sorted(set(_DENIED[machine].values())):
        prog += [_op(_JEQ, number, 0, 1), _op(_RET, deny_eperm)]
    # clone3 lleva los indicadores en memoria (el filtro no los ve): «no existe»,
    # y glibc usa clone, que si se puede mirar.
    prog += [_op(_JEQ, _CLONE3, 0, 1), _op(_RET, _RET_ERRNO | _ENOSYS)]
    # clone: solo hilos (CLONE_THREAD), nunca procesos nuevos.
    prog += [
        _op(_JEQ, _CLONE[machine], 0, 4),
        _op(_LD_W_ABS, 16),  # args[0] (indicadores), su mitad baja
        _op(_JSET, _CLONE_THREAD, 1, 0),
        _op(_RET, deny_eperm),
        _op(_RET, _RET_ALLOW),
    ]
    prog.append(_op(_RET, _RET_ALLOW))
    return b"".join(prog)


class _SockFprog(ctypes.Structure):
    _fields_ = [("len", ctypes.c_ushort), ("filter", ctypes.c_void_p)]


def _seccomp() -> None:
    program = seccomp_program()
    buffer = ctypes.create_string_buffer(program, len(program))
    fprog = _SockFprog(len(program) // 8, ctypes.cast(buffer, ctypes.c_void_p))
    if _libc.prctl(_PR_SET_SECCOMP, _SECCOMP_MODE_FILTER, ctypes.byref(fprog), 0, 0) != 0:
        raise ConfineError(f"seccomp: {os.strerror(ctypes.get_errno())}")


# ------------------------------------------------------------------- en conjunto


def _interpreter(program: str) -> str | None:
    """El cargador de un ejecutable ELF (PT_INTERP): hace falta poder ejecutarlo tambien."""
    try:
        with open(program, "rb") as fh:
            head = fh.read(64)
            if head[:4] != b"\x7fELF" or head[4] != 2 or head[5] != 1:
                return None  # solo ELF de 64 bits, little endian (x86_64 y aarch64)
            phoff, = struct.unpack_from("<Q", head, 32)
            phentsize, phnum = struct.unpack_from("<HH", head, 54)
            for n in range(phnum):
                fh.seek(phoff + n * phentsize)
                ptype, _flags, offset, _vaddr, _paddr, size = struct.unpack("<IIQQQQ", fh.read(40))
                if ptype == 3:  # PT_INTERP
                    fh.seek(offset)
                    return fh.read(size).rstrip(b"\x00").decode("utf-8", "replace")
    except (OSError, struct.error, ValueError):
        return None
    return None


def confine(read: list[str], write: list[str], execute: list[str]) -> int:
    """Pone los limites a este proceso (y a lo que ejecute). Devuelve la version de Landlock usada (0: solo seccomp)."""
    if _libc.prctl(_PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) != 0:
        raise ConfineError(f"no_new_privs: {os.strerror(ctypes.get_errno())}")
    abi = landlock_abi()
    if abi >= 2:  # la 1 no deja mover archivos entre carpetas (lo necesita la recuperacion)
        _landlock(abi, [*_SYSTEM_READ, *read], [*_SYSTEM_WRITE, *write], execute)
    else:
        abi = 0
    _seccomp()
    return abi


def exec_main(args: list[str]) -> int:
    """``--confine <reglas JSON> -- programa args...``: se limita y se convierte en el programa."""
    try:
        if len(args) < 4 or args[0] != "--confine" or args[2] != "--":
            raise ConfineError("uso: --confine <reglas> -- programa ...")
        rules = json.loads(args[1])
        command = args[3:]
        program = os.path.realpath(command[0])
        execute = [program]
        loader = _interpreter(program)
        if loader:
            execute.append(loader)
        confine(
            [str(p) for p in rules.get("read", [])],
            [str(p) for p in rules.get("write", [])],
            execute,
        )
        os.execv(program, command)
    except (ConfineError, OSError, ValueError, json.JSONDecodeError) as exc:
        sys.stderr.write(f"aislamiento: {exc}\n")
        sys.stderr.flush()
    return 126
