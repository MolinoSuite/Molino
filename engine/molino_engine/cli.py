"""El comando ``molino`` de la linea de ordenes.

Windows lo lanza por su alias (``molino.exe``, en el manifiesto del paquete)
como este ejecutable de consola, que hace solo de lanzador: arranca Molino sin
ventanas (``Molino.exe --molino-cli ...``, src/main/cli.ts), le pasa la
carpeta desde donde se llamo y devuelve su salida y su codigo de salida. Asi
la linea de ordenes hace lo mismo que la app: el mismo motor aislado, la misma
firma con los certificados de Windows, la misma impresion.

Si hace falta la contrasena de un certificado (.pfx) y no se ha escrito en la
orden, se pide aqui sin mostrarla y se pasa por la entrada estandar, nunca en
la linea de ordenes (que otros procesos pueden leer).
"""

from __future__ import annotations

import getpass
import os
import subprocess
import sys
import threading
from pathlib import Path

PASSWORD_OPTIONS = ("--contrasena-certificado", "--certificate-password", "--contrasena-stdin", "--password-stdin")


def _app_command() -> list[str] | None:
    """La orden que arranca Molino: el ejecutable del paquete o, en pruebas, el de MOLINO_CLI_APP."""
    if getattr(sys, "frozen", False):
        # ...\app\resources\engine\molino-engine.exe -> ...\app\Molino.exe
        app = Path(sys.executable).resolve().parent.parent.parent
        exe = app / "Molino.exe"
        return [str(exe)] if exe.is_file() else None
    test = os.environ.get("MOLINO_CLI_APP")
    if not test:
        return None
    parts = test.split(os.pathsep)
    return parts if all(Path(p).exists() for p in parts) else None


def _pump(source, target, skip_blank: bool = False) -> None:
    first = skip_blank
    for chunk in iter(lambda: source.read1(65536) if hasattr(source, "read1") else source.read(65536), b""):
        if first:
            # Electron escribe un salto de linea al arrancar: no es parte de la respuesta.
            first = False
            chunk = chunk[2:] if chunk.startswith(b"\r\n") else chunk
            if not chunk:
                continue
        try:
            target.write(chunk)
            target.flush()
        except OSError:
            break


def _utf8_console():
    """La consola, en UTF-8 mientras dura la orden (tildes y eñes); devuelve como restaurarla."""
    if os.name != "nt":
        return lambda: None
    import ctypes

    kernel32 = ctypes.windll.kernel32
    previous = kernel32.GetConsoleOutputCP()
    if previous and previous != 65001:
        kernel32.SetConsoleOutputCP(65001)
        return lambda: kernel32.SetConsoleOutputCP(previous)
    return lambda: None


def main(arguments: list[str]) -> int:
    command = _app_command()
    if command is None:
        sys.stderr.write("No se encuentra Molino junto a este programa.\n")
        return 1
    args = list(arguments)
    password: str | None = None
    if ("--pfx" in args or any(a.startswith("--pfx=") for a in args)) and not any(a.split("=")[0] in PASSWORD_OPTIONS for a in args):
        try:
            password = getpass.getpass("Contraseña del certificado: " if not os.environ.get("LANG", "").startswith("en") else "Certificate password: ")
        except (EOFError, KeyboardInterrupt):
            sys.stderr.write("\n")
            return 130
        args.append("--contrasena-stdin")
    env = dict(os.environ)
    env["MOLINO_CLI_CWD"] = os.getcwd()
    restore = _utf8_console()
    try:
        child = subprocess.Popen(
            [*command, "--molino-cli", *args],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=env,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        if password is not None and child.stdin is not None:
            child.stdin.write((password + "\n").encode("utf-8"))
        if child.stdin is not None:
            child.stdin.close()
        threads = [
            threading.Thread(target=_pump, args=(child.stdout, sys.stdout.buffer, True), daemon=True),
            threading.Thread(target=_pump, args=(child.stderr, sys.stderr.buffer), daemon=True),
        ]
        for t in threads:
            t.start()
        try:
            code = child.wait()
        except KeyboardInterrupt:
            child.terminate()
            return 130
        for t in threads:
            t.join(timeout=5)
        return code
    finally:
        restore()
