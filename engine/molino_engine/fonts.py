"""Catalogo de fuentes para el texto que anade el usuario.

Se usan las fuentes TrueType del sistema: la interfaz muestra la misma familia
mientras se escribe y el motor incrusta en el PDF solo los glifos usados, asi
que lo que se ve al editar coincide con lo que se guarda.

En Windows, las de Windows. En Linux, esas mismas si estan instaladas (los
paquetes de las fuentes de Microsoft usan los mismos nombres de archivo) y, si
no, otra libre con sus mismas medidas (Liberation, Carlito) con el nombre de la
de Windows, como hacen el resto del sistema (fontconfig) y los editores de
oficina: un texto puesto en un equipo se sigue editando igual en el otro. Y,
solo en Linux, las que trae casi cualquier distribucion (DejaVu, Noto).
"""

from __future__ import annotations

import ctypes
import logging
import os
from functools import lru_cache
from pathlib import Path

import pymupdf

log = logging.getLogger("molino.engine.fonts")

Files = tuple[str, str | None, str | None, str | None]

# Familia -> (normal, negrita, cursiva, negrita cursiva). Lista cerrada: el
# nombre de familia que llega de la interfaz solo se usa como clave de estos
# diccionarios, nunca para componer una ruta (A01:2025, manipulacion de rutas).
FAMILIES: dict[str, Files] = {
    "Arial": ("arial.ttf", "arialbd.ttf", "ariali.ttf", "arialbi.ttf"),
    "Calibri": ("calibri.ttf", "calibrib.ttf", "calibrii.ttf", "calibriz.ttf"),
    "Times New Roman": ("times.ttf", "timesbd.ttf", "timesi.ttf", "timesbi.ttf"),
    "Georgia": ("georgia.ttf", "georgiab.ttf", "georgiai.ttf", "georgiaz.ttf"),
    "Verdana": ("verdana.ttf", "verdanab.ttf", "verdanai.ttf", "verdanaz.ttf"),
    "Tahoma": ("tahoma.ttf", "tahomabd.ttf", None, None),
    "Trebuchet MS": ("trebuc.ttf", "trebucbd.ttf", "trebucit.ttf", "trebucbi.ttf"),
    "Segoe UI": ("segoeui.ttf", "segoeuib.ttf", "segoeuii.ttf", "segoeuiz.ttf"),
    "Courier New": ("cour.ttf", "courbd.ttf", "couri.ttf", "courbi.ttf"),
    "Consolas": ("consola.ttf", "consolab.ttf", "consolai.ttf", "consolaz.ttf"),
    "Comic Sans MS": ("comic.ttf", "comicbd.ttf", "comici.ttf", "comicz.ttf"),
}
# Linux: la libre con las mismas medidas, si no estan las de Microsoft.
_TWINS: dict[str, Files] = {
    "Arial": ("LiberationSans-Regular.ttf", "LiberationSans-Bold.ttf", "LiberationSans-Italic.ttf", "LiberationSans-BoldItalic.ttf"),
    "Times New Roman": ("LiberationSerif-Regular.ttf", "LiberationSerif-Bold.ttf", "LiberationSerif-Italic.ttf", "LiberationSerif-BoldItalic.ttf"),
    "Courier New": ("LiberationMono-Regular.ttf", "LiberationMono-Bold.ttf", "LiberationMono-Italic.ttf", "LiberationMono-BoldItalic.ttf"),
    "Calibri": ("Carlito-Regular.ttf", "Carlito-Bold.ttf", "Carlito-Italic.ttf", "Carlito-BoldItalic.ttf"),
}
# Linux: las de casi cualquier distribucion (en Windows no se buscan ni se ofrecen).
LINUX_FAMILIES: dict[str, Files] = {
    "DejaVu Sans": ("DejaVuSans.ttf", "DejaVuSans-Bold.ttf", "DejaVuSans-Oblique.ttf", "DejaVuSans-BoldOblique.ttf"),
    "DejaVu Serif": ("DejaVuSerif.ttf", "DejaVuSerif-Bold.ttf", "DejaVuSerif-Italic.ttf", "DejaVuSerif-BoldItalic.ttf"),
    "Noto Sans": ("NotoSans-Regular.ttf", "NotoSans-Bold.ttf", "NotoSans-Italic.ttf", "NotoSans-BoldItalic.ttf"),
    "Noto Serif": ("NotoSerif-Regular.ttf", "NotoSerif-Bold.ttf", "NotoSerif-Italic.ttf", "NotoSerif-BoldItalic.ttf"),
}
DEFAULT_FAMILY = "Arial"
_WINDOWS = os.name == "nt"
_FALLBACKS = ("segoeui.ttf", "seguisym.ttf", "arial.ttf") if _WINDOWS else ("DejaVuSans.ttf", "NotoSansSymbols2-Regular.ttf", "LiberationSans-Regular.ttf")
# Linux: cuantos archivos se miran, como mucho, al buscar las fuentes (y a que profundidad).
_MAX_FONT_FILES = 50_000
_MAX_DEPTH = 5

# Familias que no estan en la carpeta de fuentes de Windows y que entrega la
# aplicacion en memoria (ver fonts.register): Aptos, la de Office, que suele
# estar solo en la cache de Office, donde este proceso aislado no puede leer.
# Lista cerrada, como FAMILIES.
EXTRA_FAMILIES = ("Aptos", "Inter")
STYLES = ("regular", "bold", "italic", "boldItalic")
MAX_FONT_BYTES = 8 * 1024 * 1024
_registered: dict[str, list[bytes | None]] = {}


def register(family: str, style: str, data: bytes) -> None:
    """Anade una variante de una familia extra. ``ValueError`` si no es una fuente valida."""
    if family not in EXTRA_FAMILIES or style not in STYLES:
        raise ValueError("familia o estilo no admitidos")
    if not data or len(data) > MAX_FONT_BYTES:
        raise ValueError("tamano de fuente no valido")
    try:
        font = pymupdf.Font(fontbuffer=data)
    except Exception as exc:  # noqa: BLE001 - MuPDF lanza tipos propios
        raise ValueError("no es una fuente") from exc
    if font.glyph_count < 50:
        raise ValueError("fuente incompleta")
    slots = _registered.setdefault(family, [None, None, None, None])
    slots[STYLES.index(style)] = bytes(data)
    get_font.cache_clear()


def default_family() -> str:
    """La de los textos nuevos: Inter (la de Molino, libre y parecida a Aptos) si ya llego; si no, Arial."""
    return "Inter" if _registered.get("Inter", [None])[0] else DEFAULT_FAMILY


def known(family: str) -> bool:
    """La familia se puede usar: de las listas cerradas (de cualquier sistema) o extra ya entregada.

    Una de Linux en Windows (o al reves) se conserva: se dibuja con la
    predeterminada y, de vuelta en el otro equipo, sigue siendo la suya.
    """
    return family in FAMILIES or family in LINUX_FAMILIES or bool(_registered.get(family, [None])[0])
# Equivalentes integrados en MuPDF por si faltara el archivo de fuente.
_BUILTIN = {(False, False): "helv", (True, False): "hebo", (False, True): "heit", (True, True): "hebi"}


@lru_cache(maxsize=1)
def font_dir() -> Path:
    """Windows: carpeta de fuentes del sistema, preguntada a Windows y no a una variable de entorno."""
    try:
        buf = ctypes.create_unicode_buffer(260)
        csidl_fonts = 0x0014
        if ctypes.windll.shell32.SHGetFolderPathW(None, csidl_fonts, None, 0, buf) == 0 and buf.value:
            return Path(buf.value)
    except Exception:  # noqa: BLE001
        log.debug("SHGetFolderPathW no disponible")
    return Path(os.environ.get("SystemRoot", r"C:\Windows")) / "Fonts"


def _linux_font_dirs() -> list[Path]:
    """Linux: donde estan las fuentes, las del sistema y las de la carpeta personal."""
    folders = [Path("/usr/share/fonts"), Path("/usr/local/share/fonts")]
    try:
        home = Path.home()
    except RuntimeError:
        return folders
    data = os.environ.get("XDG_DATA_HOME", "")
    return [*folders, (Path(data) if os.path.isabs(data) else home / ".local" / "share") / "fonts", home / ".fonts"]


@lru_cache(maxsize=1)
def _linux_index() -> dict[str, Path]:
    """Linux: cada archivo de fuente por su nombre en minusculas (el primero que se encuentra)."""
    found: dict[str, Path] = {}
    seen = 0
    for top in _linux_font_dirs():
        for folder, dirs, names in os.walk(top):
            dirs.sort()
            if len(Path(folder).relative_to(top).parts) >= _MAX_DEPTH:
                dirs.clear()
            for name in sorted(names):
                seen += 1
                if seen > _MAX_FONT_FILES:
                    return found
                if name.lower().endswith((".ttf", ".otf", ".ttc")):
                    found.setdefault(name.lower(), Path(folder) / name)
    return found


def font_file(name: str) -> Path | None:
    """El archivo de fuente ``name`` del sistema (en Linux, sin distinguir mayusculas), o None."""
    path = font_dir() / name if _WINDOWS else _linux_index().get(name.lower())
    return path if path is not None and path.is_file() else None


def _candidates(family: str) -> list[Files]:
    """Los juegos de archivos que pueden hacer de ``family`` en este sistema, por orden."""
    if _WINDOWS:
        return [FAMILIES[family]] if family in FAMILIES else []
    return [files for files in (FAMILIES.get(family), _TWINS.get(family), LINUX_FAMILIES.get(family)) if files]


@lru_cache(maxsize=64)
def _variants(family: str) -> tuple[Path | None, Path | None, Path | None, Path | None] | None:
    """Las cuatro variantes de ``family`` en este equipo: las del primer juego que tenga la normal."""
    for files in _candidates(family):
        paths = tuple(font_file(name) if name else None for name in files)
        if paths[0] is not None:
            return paths  # type: ignore[return-value]
    return None


def _file_for(family: str, bold: bool, italic: bool) -> Path | None:
    """El archivo de la variante pedida o, si no esta, el de la mas parecida; si falta la familia, de la predeterminada."""
    variants = _variants(family) or _variants(DEFAULT_FAMILY)
    if variants is None:
        return None
    index = (1 if bold else 0) + (2 if italic else 0)
    for candidate in (variants[index], variants[1] if bold else None, variants[2] if italic else None, variants[0]):
        if candidate is not None:
            return candidate
    return None


@lru_cache(maxsize=64)
def get_font(family: str, bold: bool = False, italic: bool = False) -> pymupdf.Font:
    slots = _registered.get(family)
    if slots and slots[0]:
        index = (1 if bold else 0) + (2 if italic else 0)
        data = slots[index] or (slots[1] if bold else None) or (slots[2] if italic else None) or slots[0]
        try:
            return pymupdf.Font(fontbuffer=data)
        except Exception:  # noqa: BLE001
            log.warning("no se pudo cargar la fuente %s", family)
    path = _file_for(family, bold, italic)
    if path is not None:
        try:
            return pymupdf.Font(fontfile=str(path))
        except Exception:  # noqa: BLE001
            log.warning("no se pudo cargar la fuente %s", path.name)
    return pymupdf.Font(_BUILTIN[(bold, italic)])


@lru_cache(maxsize=1)
def fallback_fonts() -> tuple[pymupdf.Font, ...]:
    out = []
    for name in _FALLBACKS:
        path = font_file(name)
        if path is not None:
            try:
                out.append(pymupdf.Font(fontfile=str(path)))
            except Exception:  # noqa: BLE001
                continue
    return tuple(out)


def available_families() -> list[dict]:
    out = []
    for family in (*FAMILIES, *(() if _WINDOWS else LINUX_FAMILIES)):
        variants = _variants(family)
        if variants is not None:
            out.append({"family": family, "bold": variants[1] is not None, "italic": variants[2] is not None, "boldItalic": variants[3] is not None})
    for family, slots in _registered.items():
        if slots[0]:
            out.append({"family": family, "bold": bool(slots[1]), "italic": bool(slots[2]), "boldItalic": bool(slots[3])})
    out.sort(key=lambda item: str(item["family"]).lower())
    if not out:
        out.append({"family": DEFAULT_FAMILY, "bold": True, "italic": True, "boldItalic": True})
    return out


def split_runs(text: str, primary: pymupdf.Font) -> list[tuple[pymupdf.Font, str]]:
    """Divide una linea en tramos por fuente, recurriendo a fuentes de reserva si falta un glifo."""
    runs: list[tuple[pymupdf.Font, str]] = []
    for ch in text:
        font = primary
        if not ch.isspace() and not primary.has_glyph(ord(ch)):
            for candidate in fallback_fonts():
                if candidate.has_glyph(ord(ch)):
                    font = candidate
                    break
            else:
                ch = "?"
        if runs and runs[-1][0] is font:
            runs[-1] = (font, runs[-1][1] + ch)
        else:
            runs.append((font, ch))
    return runs
