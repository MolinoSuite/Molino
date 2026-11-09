"""El motor de oficina (Documentos, Hojas y Presentaciones) visto desde el motor de Molino.

La pieza (``office/build.py`` la arma; la aplicacion la instala en
``%LOCALAPPDATA%\\Molino\\office\\<version>``) trae los editores y el conversor
de ONLYOFFICE, x2t, que lee y escribe DOCX, XLSX, PPTX, ODF... y el formato de
trabajo de los editores (Editor.bin). x2t es codigo en C++ con V8 que procesa
documentos de fuera, asi que corre como la conversion a Word:

* el **motor aislado** (``ops/office.py``) prepara cada conversion en su
  carpeta: copia el documento, escribe la tarea (un XML con las rutas) y recoge
  el resultado, que entrega como siempre (por la canalizacion);
* el **intermediario** (``broker.py``) solo lanza x2t, el de la pieza que
  configuro la aplicacion, dentro del mismo AppContainer que el motor, con su
  propio objeto de trabajo y tiempo maximo, durante las operaciones que lo
  necesitan y con las rutas de forma fija de este modulo (``x2t_command``).

x2t no gana nada que el motor no tenga: el mismo contenedor, sin red ni
archivos del usuario, y ademas sin poder crear procesos.

Este modulo lo comparten los dos: rutas permitidas, la orden de x2t, la tarea,
la lectura estricta del indice de fuentes y la limpieza de los PDF que escribe.
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

# Formatos que se abren: extension -> (editor, codigo de x2t).
OPEN_FORMATS: dict[str, tuple[str, int]] = {
    ".docx": ("word", 65),
    ".doc": ("word", 66),
    ".odt": ("word", 67),
    ".rtf": ("word", 68),
    ".xlsx": ("cell", 257),
    ".xls": ("cell", 258),
    ".ods": ("cell", 259),
    ".csv": ("cell", 260),
    ".pptx": ("slide", 129),
    ".ppt": ("slide", 130),
    ".odp": ("slide", 131),
}
# Formatos en los que se guarda cada editor.
SAVE_FORMATS: dict[str, dict[str, int]] = {
    "word": {".docx": 65, ".odt": 67, ".rtf": 68},
    "cell": {".xlsx": 257, ".ods": 259, ".csv": 260},
    "slide": {".pptx": 129, ".odp": 131},
}
SAVE_SUFFIXES: tuple[str, ...] = tuple(sorted({s for formats in SAVE_FORMATS.values() for s in formats}))
# Documento nuevo: la plantilla vacia de la pieza para cada editor.
NEW_FILES = {"word": "new.docx", "cell": "new.xlsx", "slide": "new.pptx"}
CANVAS = 8192  # Editor.bin, el formato de trabajo de los editores
PDF = 513
# Idioma de x2t (numeros, fechas): sin el escribe «1850.0 €» en vez de «1850,0 €».
LCID = {"es": 3082, "en": 1033}

MAX_INPUT = 512 * 1024**2  # un documento de oficina mas grande no se abre
MAX_CANVAS = 700 * 1024**2  # Editor.bin cabe en una trama de la canalizacion (768 MB)
MAX_MEDIA = 256 * 1024**2  # una imagen del documento
MAX_FONT_INDEX = 16 * 1024**2  # AllFonts.js y font_selection.bin, cada uno
MAX_OPTIONS = 64 * 1024  # opciones de la conversion (m_sJsonParams)
X2T_TIMEOUT = 10 * 60  # pasado este tiempo x2t se da por colgado

# Rutas de los trabajos de x2t dentro de la carpeta del motor: las genera el
# motor con nombres de forma fija, y solo esas acepta el intermediario.
TASK_PATH = re.compile(r"^o[0-9a-f]{16}/x-[0-9a-f]{12}/task\.xml$")
FONTS_PATH = re.compile(r"^f[0-9a-f]{16}$")
# Cada cambio que manda el editor: «longitud;base64» (asi los escribe el nativo).
CHANGE = re.compile(r"^[0-9]{1,10};[A-Za-z0-9+/]*={0,2}$")
MEDIA_NAME = re.compile(r"^[A-Za-z0-9_-]{1,64}\.(png|jpe?g|gif|bmp|tiff?|svg|webp|emf|wmf|wdp)$", re.IGNORECASE)


# --------------------------------------------------------------- CSV

CSV = 260
# Separadores de x2t (TCsvDelimiter): tabulador, punto y coma, dos puntos, coma.
CSV_DELIMITERS = {"\t": 1, ";": 2, ":": 3, ",": 4}
# Codificaciones, con el numero que les da x2t (su tabla, AscCommon.c_oAscEncodings;
# no son paginas de codigos de Windows): UTF-8 (65001), UTF-16 LE y BE (1200,
# 1201) y Windows occidental (1252). Con una pagina de codigos, x2t se cae.
UTF8, UTF16LE, UTF16BE, WINDOWS_1252 = 46, 48, 49, 44
CSV_SAMPLE = 64 * 1024


def csv_encoding(head: bytes) -> int:
    """La codificacion de un CSV, como la deduce una hoja de calculo: su marca, UTF-8 valido o Windows-1252."""
    if head.startswith(b"\xef\xbb\xbf"):
        return UTF8
    if head.startswith(b"\xff\xfe"):
        return UTF16LE
    if head.startswith(b"\xfe\xff"):
        return UTF16BE
    try:
        head.decode("utf-8")
        return UTF8
    except UnicodeDecodeError as error:
        # La muestra puede cortar un caracter por la mitad al final: eso no cuenta.
        if error.start >= len(head) - 3 and error.reason in ("unexpected end of data",):
            return UTF8
        return WINDOWS_1252


def csv_text(head: bytes, encoding: int) -> str:
    """El texto de la muestra (para buscar el separador). ValueError si no parece texto."""
    codec = {UTF8: "utf-8-sig", UTF16LE: "utf-16", UTF16BE: "utf-16", WINDOWS_1252: "cp1252"}[encoding]
    text = head.decode(codec, errors="ignore")
    if "\x00" in text:
        raise ValueError("no es un CSV")
    return text


def csv_delimiter(text: str, fallback: str = ",") -> int:
    """El separador de un CSV: el que aparece en todas las lineas y lo mismo en cada una.

    Se cuenta fuera de las comillas en las primeras lineas; gana el que esta en
    mas lineas con el mismo numero de apariciones (y, a igualdad, el que mas
    sale). Sin ninguno, el de ``fallback`` (punto y coma en espanol, como Excel).
    """
    lines = [line for line in text.splitlines()[:50] if line.strip()][:-1] or text.splitlines()[:1]
    best: tuple[int, int, int] | None = None
    best_char = fallback
    for char in CSV_DELIMITERS:
        counts = []
        for line in lines:
            inside, count = False, 0
            for c in line:
                if c == '"':
                    inside = not inside
                elif c == char and not inside:
                    count += 1
            counts.append(count)
        present = [n for n in counts if n > 0]
        if not present:
            continue
        common = max(set(present), key=present.count)
        score = (sum(1 for n in counts if n == common), common, sum(present))
        if best is None or score > best:
            best, best_char = score, char
    return CSV_DELIMITERS[best_char]


class OfficeUnavailable(Exception):
    """La pieza no esta instalada o no es una pieza de Molino."""


@dataclass(frozen=True)
class Piece:
    """Una pieza instalada y, si ya existe, el indice de fuentes de este equipo."""

    root: Path
    fonts: Path | None = None

    @property
    def converter(self) -> Path:
        return self.root / "converter"

    @property
    def x2t(self) -> Path:
        return self.converter / "x2t.exe"

    @property
    def themes(self) -> Path:
        return self.root / "editors" / "sdkjs" / "slide" / "themes"

    @property
    def engine_fonts(self) -> Path:
        return self.root / "fonts"


def check_piece(root: Path) -> Path:
    """``root`` resuelta si es una pieza de Molino entera (manifiesto y conversor); si no, OfficeUnavailable."""
    try:
        resolved = root.resolve(strict=True)
        manifest = json.loads((resolved / "manifest.json").read_text(encoding="utf-8"))
        ok = isinstance(manifest, dict) and manifest.get("piece") == "office" and (resolved / "converter" / "x2t.exe").is_file()
    except (OSError, ValueError):
        ok = False
    if not ok:
        raise OfficeUnavailable(str(root))
    return resolved


def check_fonts(folder: Path) -> Path:
    """``folder`` resuelta si tiene el indice de fuentes (AllFonts.js y font_selection.bin)."""
    try:
        resolved = folder.resolve(strict=True)
        ok = all((resolved / name).is_file() for name in ("AllFonts.js", "font_selection.bin"))
    except OSError:
        ok = False
    if not ok:
        raise OfficeUnavailable(str(folder))
    return resolved


def user_font_dirs() -> list[Path]:
    """Carpetas de fuentes del usuario que el contenedor no puede leer por si solo.

    Las de Windows (C:\\Windows\\Fonts) se leen sin permiso. Estas no: las
    instaladas solo para el usuario y las que descarga Office (Aptos, en
    ``FontCache\\4\\CloudFonts``). Sin permiso, x2t no las ve y las cambia por
    otras (Aptos sale en Arial).
    """
    local = os.environ.get("LOCALAPPDATA")
    if not local:
        return []
    base = Path(local) / "Microsoft"
    return [p for p in (base / "Windows" / "Fonts", base / "FontCache" / "4" / "CloudFonts") if p.is_dir()]


def x2t_command(piece: Piece, work_root: Path, job: dict[str, Any]) -> list[str]:
    """La orden de x2t para un trabajo del motor: ``{"task": ruta}`` o ``{"fonts": carpeta}``.

    Las rutas van relativas a la carpeta del motor y solo valen las de forma
    fija; si no, ValueError. Nada mas que estas dos formas de llamar a x2t.
    """
    task, fonts = job.get("task"), job.get("fonts")
    if isinstance(task, str) and TASK_PATH.match(task) and fonts is None:
        return [str(piece.x2t), str(work_root / task)]
    if isinstance(fonts, str) and FONTS_PATH.match(fonts) and task is None:
        return [str(piece.x2t), "-create-allfonts", str(work_root / fonts), str(piece.engine_fonts)]
    raise ValueError("trabajo de x2t no valido")


def x2t_environment(temp: Path) -> dict[str, str]:
    """Entorno minimo de x2t (sin las variables del usuario)."""
    system_root = os.environ.get("SystemRoot", r"C:\Windows")
    env = {
        "SystemRoot": system_root,
        "windir": os.environ.get("windir", system_root),
        "PATH": f"{system_root}\\System32;{system_root}",
        "TEMP": str(temp),
        "TMP": str(temp),
    }
    # Windows las necesita para preparar el proceso en el contenedor (sin
    # ellas, error 203); x2t no puede abrir esas carpetas.
    for name in ("LOCALAPPDATA", "APPDATA", "USERPROFILE", "NUMBER_OF_PROCESSORS", "PROCESSOR_ARCHITECTURE"):
        value = os.environ.get(name)
        if value:
            env[name] = value
    return env


def _escape(value: object) -> str:
    text = str(value)
    if any(ord(c) < 32 and c not in "\t\n\r" for c in text):
        raise ValueError("caracter de control en la tarea de x2t")
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;").replace("'", "&apos;")


def task_xml(fields: dict[str, object]) -> str:
    """La tarea de x2t (TaskQueueDataConvert) con los campos dados, escapados."""
    body = "".join(f"<{name}>{_escape(value)}</{name}>" for name, value in fields.items())
    return f'<?xml version="1.0" encoding="utf-8"?><TaskQueueDataConvert>{body}</TaskQueueDataConvert>'


def json_options(raw: Any) -> str | None:
    """Opciones de la conversion (m_sJsonParams): un objeto JSON pequeno, vuelto a escribir."""
    if raw is None:
        return None
    if not isinstance(raw, dict):
        raise ValueError("opciones no validas")
    text = json.dumps(raw, ensure_ascii=True, separators=(",", ":"), allow_nan=False)
    if len(text) > MAX_OPTIONS:
        raise ValueError("opciones demasiado grandes")
    return text


# ------------------------------------------------------- indice de fuentes

_ASSIGNMENT = re.compile(r'\s*window\["([A-Za-z_]+)"\]\s*=\s*')
_INDEX_KEYS = ("__all_fonts_js_version__", "__fonts_files", "__fonts_infos", "__fonts_ranges", "g_fonts_selection_bin")
_BASE64 = re.compile(r"^[A-Za-z0-9+/]*={0,2}$")


def clean_font_index(text: str) -> str:
    """Lee AllFonts.js como datos y lo vuelve a escribir: asi no puede llevar codigo.

    Los editores lo cargan como JavaScript. Lo escribe x2t, que podria haber
    leido una fuente maliciosa; por eso no se entrega tal cual: se leen sus
    cinco asignaciones (numeros, rutas, nombres y una cadena en base64) como
    JSON, se comprueban los tipos y se escriben de nuevo. Si algo no encaja,
    ValueError.
    """
    values: dict[str, Any] = {}
    decoder = json.JSONDecoder()
    at = 0
    text = text.lstrip("\ufeff")
    while at < len(text) and text[at:].strip():
        match = _ASSIGNMENT.match(text, at)
        if not match or match.group(1) not in _INDEX_KEYS or match.group(1) in values:
            raise ValueError("indice de fuentes no valido")
        value, end = decoder.raw_decode(text, match.end())
        values[match.group(1)] = value
        rest = re.compile(r"\s*;").match(text, end)
        if not rest:
            raise ValueError("indice de fuentes no valido")
        at = rest.end()
    if set(values) != set(_INDEX_KEYS):
        raise ValueError("indice de fuentes incompleto")
    files, infos, ranges = values["__fonts_files"], values["__fonts_infos"], values["__fonts_ranges"]
    ok = (
        values["__all_fonts_js_version__"] in (1, 2)
        and isinstance(files, list) and all(isinstance(f, str) and 0 < len(f) < 1024 for f in files)
        and isinstance(infos, list)
        and all(
            isinstance(i, list) and len(i) == 9 and isinstance(i[0], str) and len(i[0]) < 512
            and all(isinstance(n, int) and not isinstance(n, bool) and -1 <= n < 1_000_000 for n in i[1:])
            for i in infos
        )
        and isinstance(ranges, list) and all(isinstance(n, int) and not isinstance(n, bool) and 0 <= n < 2**31 for n in ranges)
        and isinstance(values["g_fonts_selection_bin"], str) and _BASE64.match(values["g_fonts_selection_bin"]) is not None
    )
    if not ok:
        raise ValueError("indice de fuentes no valido")

    def dump(value: Any) -> str:
        return json.dumps(value, ensure_ascii=True, separators=(",", ":"))

    lines = [f'window["__all_fonts_js_version__"] = {values["__all_fonts_js_version__"]};']
    lines.append('window["__fonts_files"] = [\n' + ",\n".join(dump(f) for f in files) + "\n];")
    lines.append('window["__fonts_infos"] = [\n' + ",\n".join(dump(i) for i in infos) + "\n];")
    lines.append(f'window["__fonts_ranges"] = {dump(ranges)};')
    lines.append(f'window["g_fonts_selection_bin"] = {dump(values["g_fonts_selection_bin"])};')
    return "\n\n".join(lines) + "\n"


# ------------------------------------------------------- PDF que escribe x2t

# Una orden de color seguida directamente de una de pintar: pintar sin trazado.
# En PDF, entre el trazado y la orden que lo pinta no puede ir nada mas (ISO
# 32000-1, 8.5.1), asi que esa orden no tiene forma y no dibuja nada. x2t
# escribe una orden por linea.
_PAINT_WITHOUT_PATH = re.compile(
    rb"(?m)^((?:[^\n%]*[ \t\]])?(?:scn|SCN|sc|SC|rg|RG|g|G|k|K|cs|CS)\r?\n)(?:[fF]\*?|[bB]\*?|[sS])\r?\n"
)


def clean_pdf(path: Path) -> int:
    """Quita de un PDF de x2t las ordenes de pintar sin trazado. Devuelve cuantas.

    x2t escribe a veces un relleno sin forma (graficos de Excel con relleno de
    trama: ``/Pattern cs /P5 scn f``), que el formato PDF no permite. No dibuja
    nada, pero cuelga a MuPDF 1.28.2 (el de Molino PDF; ver paint_guard.py) y a
    otros lectores que usan esa version. Quitarlo no cambia lo que se ve.

    Solo lee y reescribe los flujos de contenido (paginas, formularios XObject y
    tramas), sin interpretar ninguno, y guarda de forma incremental. Va en el
    motor aislado: el PDF sale de un documento de fuera.
    """
    import pymupdf

    doc = pymupdf.open(path)
    try:
        streams = {x for page in doc for x in page.get_contents()}
        for x in range(1, doc.xref_length()):
            if doc.xref_is_stream(x) and (
                doc.xref_get_key(x, "Subtype") == ("name", "/Form") or doc.xref_get_key(x, "PatternType") == ("int", "1")
            ):
                streams.add(x)
        removed = 0
        for x in sorted(streams):
            cleaned, n = _PAINT_WITHOUT_PATH.subn(rb"\1", doc.xref_stream(x))
            if n:
                doc.update_stream(x, cleaned)
                removed += n
        if removed:
            if doc.can_save_incrementally():
                doc.save(path, incremental=True, encryption=pymupdf.PDF_ENCRYPT_KEEP)
            else:
                temp = path.with_name(path.name + ".limpio")
                doc.save(temp, garbage=0, deflate=True)
                doc.close()
                temp.replace(path)
        return removed
    finally:
        if not doc.is_closed:
            doc.close()
