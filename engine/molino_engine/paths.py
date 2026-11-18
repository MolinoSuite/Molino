"""Validacion de rutas de archivo recibidas por el motor.

Las rutas las elige el usuario en los dialogos nativos de la aplicacion, pero
el motor no se fia: las normaliza y descarta lo que no sea una ruta de archivo
normal (OWASP A01:2025 / A05:2025, manipulacion de rutas).
"""

from __future__ import annotations

import ctypes
import os
import posixpath
import re
import stat
from pathlib import Path

from .errors import invalid, io_error
from .i18n import _

# Nombres de dispositivo reservados de Windows: abrirlos puede bloquear el
# proceso o escribir en un dispositivo en lugar de en un archivo.
_RESERVED = {
    "CON", "PRN", "AUX", "NUL",
    *(f"COM{i}" for i in range(1, 10)),
    *(f"LPT{i}" for i in range(1, 10)),
}


# Unicas formas de ruta que se aceptan (lista blanca): unidad con letra o
# recurso de red. Todo lo demas se rechaza.
_DRIVE = re.compile(r"^[A-Za-z]:\\")
_SHARE = re.compile(r"^\\\\[^\\/?*.<>|:\"\x00-\x1f][^\\/?*<>|:\"\x00-\x1f]*\\[^\\/?*<>|:\"\x00-\x1f]+\\")


def _check_shape_windows(raw: str) -> Path:
    if "\x00" in raw or len(raw) > 4096:
        raise invalid(_("La ruta contiene caracteres no válidos."))
    text = raw.replace("/", "\\")
    # Solo «X:\...» o «\\servidor\recurso\...». Asi quedan fuera, sin tener que
    # enumerarlos, los espacios de nombres de dispositivo (\\.\ y \\?\, que dan
    # acceso a volumenes, copias de sombra, canalizaciones y otros objetos del
    # sistema que no son archivos), las rutas relativas y las relativas a la
    # unidad («C:archivo»).
    if not (_DRIVE.match(text) or _SHARE.match(text)):
        raise invalid(_("La ruta debe ser absoluta y apuntar a una carpeta normal."))
    # normpath resuelve los ".." de forma lexica; despues ya no queda ninguno.
    path = Path(os.path.normpath(text))
    rest = str(path)[2:] if _DRIVE.match(str(path)) else str(path)
    # Dos puntos fuera de la letra de unidad: flujo alternativo de datos
    # («archivo.pdf:oculto»), que esconderia lo escrito a la vista del usuario.
    if ":" in rest:
        raise invalid(_("La ruta contiene caracteres no válidos."))
    # Nombres reservados por Windows en cualquier nivel de la ruta (ver
    # _RESERVED): los de dispositivo (NUL, CON, COM1, CONOUT$... tambien con
    # extension o con cifras en superindice) y los que acaban en punto o espacio.
    reserved = getattr(os.path, "isreserved", None)
    try:
        if reserved is not None and reserved(rest):
            raise invalid(_("Nombre de archivo reservado por el sistema."))
    except (TypeError, ValueError):
        raise invalid(_("La ruta contiene caracteres no válidos.")) from None
    for part in rest.split("\\"):
        if part.split(".")[0].strip().upper() in _RESERVED:
            raise invalid(_("Nombre de archivo reservado por el sistema."))
    return path


# En Linux (y en macOS) solo valen las rutas absolutas. Quedan fuera las
# carpetas que no guardan archivos de verdad: /proc y /sys (el nucleo) y /dev
# (dispositivos). Leer o escribir ahi no es abrir ni guardar un documento.
# Tambien si se llega a ellas por un enlace simbolico.
_POSIX_SYSTEM = ("/proc", "/sys", "/dev")


def _in_posix_system(path: str) -> bool:
    return any(path == root or path.startswith(root + "/") for root in _POSIX_SYSTEM)


def _check_shape_posix(raw: str) -> Path:
    if "\x00" in raw or len(raw) > 4096:
        raise invalid(_("La ruta contiene caracteres no válidos."))
    if not raw.startswith("/"):
        raise invalid(_("La ruta debe ser absoluta y apuntar a una carpeta normal."))
    # normpath resuelve los ".." de forma lexica; POSIX deja «//» al principio
    # como caso especial: aqui es una barra mas.
    text = posixpath.normpath(raw)
    if text.startswith("//"):
        text = "/" + text.lstrip("/")
    if _in_posix_system(text) or _in_posix_system(os.path.realpath(text)):
        raise invalid(_("La ruta debe ser absoluta y apuntar a una carpeta normal."))
    return Path(text)


# Cada sistema, con su forma de ruta (cada una se prueba en su sistema).
_check_shape = _check_shape_windows if os.name == "nt" else _check_shape_posix


def input_file(raw: str, *, max_bytes: int | None = None) -> Path:
    """Ruta de un archivo existente que se va a leer."""
    path = _check_shape(raw)
    try:
        if not path.is_file():
            raise io_error(_("El archivo no existe o no es un archivo normal."))
        size = path.stat().st_size
    except OSError as exc:
        raise io_error(_("No se pudo acceder al archivo.")) from exc
    if max_bytes is not None and size > max_bytes:
        raise io_error(_("El archivo es demasiado grande."), tooLarge=True)
    return path


def output_file(raw: str, *, suffixes: tuple[str, ...] | None = None) -> Path:
    """Ruta de un archivo que se va a crear o sobrescribir."""
    path = _check_shape(raw)
    if suffixes is not None and path.suffix.lower() not in suffixes:
        raise invalid(_("Extensión de archivo no permitida."), allowed=list(suffixes))
    parent = path.parent
    try:
        if not parent.is_dir():
            raise io_error(_("La carpeta de destino no existe."))
        if path.exists() and not path.is_file():
            raise io_error(_("El destino no es un archivo normal."))
    except OSError as exc:
        raise io_error(_("No se pudo acceder a la carpeta de destino.")) from exc
    return path


def output_dir(raw: str) -> Path:
    """Carpeta existente donde se van a crear archivos."""
    path = _check_shape(raw)
    try:
        if not path.is_dir():
            raise io_error(_("La carpeta de destino no existe."))
    except OSError as exc:
        raise io_error(_("No se pudo acceder a la carpeta de destino.")) from exc
    return path


_REPLACEFILE_IGNORE_MERGE_ERRORS = 0x2
_ERROR_UNABLE_TO_REMOVE_REPLACED = 1175
_ERROR_UNABLE_TO_MOVE_REPLACEMENT = 1176


def replace_file(tmp: Path, dest: Path) -> None:
    """Pone ``tmp`` en el lugar de ``dest`` de una sola vez.

    Si ``dest`` ya existe se usa ``ReplaceFileW``, que conserva sus permisos
    (lista de control de acceso), atributos y fecha de creacion. Con
    ``os.replace`` el archivo nuevo se queda con los permisos heredados de la
    carpeta: un documento que el usuario habia restringido a su cuenta pasaria
    a ser legible por quien tenga acceso a la carpeta (A01:2025).
    En Linux y macOS, ``os.replace`` con el modo (permisos) del archivo
    sustituido copiado antes al nuevo, por lo mismo.
    Lanza ``OSError`` si no se puede; ``tmp`` debe estar en la misma carpeta.
    """
    if os.name == "nt" and dest.exists():
        try:
            # kernel32 se carga siempre desde la carpeta del sistema (es una
            # "DLL conocida"): no hay busqueda por rutas que se pueda secuestrar.
            kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
            call = kernel32.ReplaceFileW
            call.argtypes = [
                ctypes.c_wchar_p, ctypes.c_wchar_p, ctypes.c_wchar_p, ctypes.c_uint32, ctypes.c_void_p, ctypes.c_void_p,
            ]
            call.restype = ctypes.c_int
            if call(str(dest), str(tmp), None, _REPLACEFILE_IGNORE_MERGE_ERRORS, None, None):
                return
            error = ctypes.get_last_error()
        except (AttributeError, OSError):
            error = _ERROR_UNABLE_TO_MOVE_REPLACEMENT
        # En estos dos casos los dos archivos siguen como estaban (por ejemplo,
        # un recurso de red que no admite la operacion): se usa la via normal.
        if error not in (_ERROR_UNABLE_TO_REMOVE_REPLACED, _ERROR_UNABLE_TO_MOVE_REPLACEMENT):
            raise ctypes.WinError(error)
    if os.name != "nt":
        try:
            os.chmod(tmp, stat.S_IMODE(os.stat(dest).st_mode))
        except FileNotFoundError:
            pass
    os.replace(tmp, dest)


def safe_filename(name: str, fallback: str = "documento") -> str:
    """Nombre de archivo sin separadores ni caracteres problematicos en Windows (ni en Linux)."""
    cleaned = "".join("_" if ch in '<>:"/\\|?*' or ord(ch) < 32 else ch for ch in name).strip(" .")
    if not cleaned or cleaned.split(".")[0].upper() in _RESERVED:
        return fallback
    cleaned = cleaned[:150]
    # Linux admite 255 bytes por nombre, no 255 letras: con letras de varios
    # bytes (chino, japones...) 150 letras pueden pasarse.
    while len(cleaned.encode("utf-8")) > 240:
        cleaned = cleaned[:-1]
    return cleaned
