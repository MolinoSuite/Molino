"""Documentos, Hojas y Presentaciones: abrir, guardar y exportar con x2t (ver office.py).

Cada documento abierto es una carpeta del motor (``o`` + 16 cifras) con lo que
leen los editores y x2t:

* ``doc/Editor.bin``: el documento en el formato de trabajo de los editores;
* ``doc/media/``: sus imagenes (las que traia y las que se anaden);
* ``doc/changes/changes0.json``: los cambios que ha hecho el editor desde que
  se abrio, como los apunta el nativo de ONLYOFFICE (``"cambio",`` uno tras
  otro). Al guardar, x2t aplica esos cambios a Editor.bin.
* ``embedded/``: las letras incrustadas de un .docx, para volver a meterlas al
  guardarlo (docfonts.py); ``fonts/`` e ``index/``, las que no estan en el
  equipo y el indice de fuentes propio del documento, con el que se dibuja.

El documento original no se toca hasta guardar: la copia que se abre se borra
en cuanto x2t la ha convertido. Cada conversion va en una subcarpeta propia
(``x-`` + 12 cifras) con su tarea y su temporal, que se borra al terminar.
"""

from __future__ import annotations

import logging
import os
import secrets
import shutil
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Annotated, Any, Literal
from xml.parsers.expat import ExpatError

from pydantic import Field, StringConstraints

from .. import docfonts, office, recovery
from ..errors import EngineError, invalid, not_found, unsupported
from ..i18n import _, language
from ..models import Params, PathStr
from ..server import Ctx, Reply, method

log = logging.getLogger("molino.office")

OfficeDocId = Annotated[str, StringConstraints(pattern=r"^o[0-9a-f]{16}$")]
# Firmas de los formatos que se abren: comprimidos (OOXML y ODF), OLE (doc,
# xls, ppt) y RTF. Lo demas no llega a x2t (A05:2025).
_MAGIC = (b"PK\x03\x04", b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1", b"{\\rtf")
# Imagenes que se pueden anadir a un documento: solo de mapa de bits, por su firma.
_IMAGES = {
    ".png": (b"\x89PNG\r\n\x1a\n",),
    ".jpg": (b"\xff\xd8\xff",),
    ".jpeg": (b"\xff\xd8\xff",),
    ".gif": (b"GIF87a", b"GIF89a"),
    ".bmp": (b"BM",),
    ".webp": (b"RIFF",),
}
# Codigos de salida de x2t que no son un fallo del motor (ver common/x2t de
# ONLYOFFICE): documento cifrado o con contrasena.
_X2T_PROTECTED = {90, 91}


@dataclass
class OfficeDoc:
    id: str
    kind: str
    folder: Path
    # Donde empieza cada cambio apuntado en changes0.json (para deshacer un tramo).
    offsets: list[int] = field(default_factory=list)
    # Para recuperarlo tras un cierre inesperado (recovery.py): su nombre y si
    # tiene cambios que no se han guardado.
    name: str = ""
    dirty: bool = False
    # El indice de fuentes propio (con sus letras incrustadas), si lo tiene.
    index: Path | None = None

    def note(self) -> None:
        recovery.note_office(self.folder, self.name or "?", self.kind, self.dirty)

    @property
    def doc(self) -> Path:
        return self.folder / "doc"

    @property
    def changes(self) -> Path:
        return self.doc / "changes" / "changes0.json"

    def remove(self) -> None:
        shutil.rmtree(self.folder, ignore_errors=True)


def _piece(ctx: Ctx, *, fonts: bool = True) -> office.Piece:
    piece = ctx.engine.office
    if piece is None:
        raise unsupported(_("Documentos, Hojas y Presentaciones no están instalados."))
    if fonts and piece.fonts is None:
        # La aplicacion crea el indice de fuentes al configurar la pieza: sin
        # el, x2t cambiaria todas las letras por otras.
        raise EngineError("office_fonts", _("Las fuentes del equipo aún no están preparadas. Inténtalo dentro de un momento."))
    return piece


def _doc(ctx: Ctx, doc_id: str) -> OfficeDoc:
    try:
        return ctx.engine.office_docs[doc_id]
    except KeyError:
        raise not_found(_("El documento ya no está abierto.")) from None


def _run(ctx: Ctx, piece: office.Piece, job: dict[str, str]) -> int:
    """Lanza x2t (en el motor aislado, a traves del intermediario) y devuelve su codigo."""
    return ctx.engine.host.run_office(ctx.engine.work_root, piece, job, ctx.check_cancel)


def _lcid() -> int:
    return office.LCID.get(language(), office.LCID["en"])


def _convert(ctx: Ctx, piece: office.Piece, folder: Path, fields: dict[str, object], index: Path | None = None) -> None:
    """Una conversion de x2t en su propia subcarpeta de ``folder``; la tarea con ``fields``.

    Con el indice de fuentes del equipo o, si se da, con ``index`` (el propio de
    un documento con letras incrustadas).
    """
    job = folder / f"x-{secrets.token_hex(6)}"
    (job / "tmp").mkdir(parents=True)
    try:
        fonts = index or piece.fonts
        assert fonts is not None
        task = office.task_xml(
            {
                **fields,
                "m_nLcid": _lcid(),
                "m_sThemeDir": piece.themes,
                "m_sFontDir": fonts,
                "m_sAllFontsPath": fonts / "AllFonts.js",
                "m_sTempDir": job / "tmp",
                "m_bDontSaveAdditional": "true",
            }
        )
        (job / "task.xml").write_text(task, encoding="utf-8")
        code = _run(ctx, piece, {"task": (job / "task.xml").relative_to(ctx.engine.work_root).as_posix()})
    finally:
        shutil.rmtree(job, ignore_errors=True)
    if code in _X2T_PROTECTED:
        raise EngineError("protected", _("Este documento está protegido con contraseña y Molino aún no puede abrirlo."))
    if code != 0:
        # Solo el codigo: los mensajes de x2t podrian citar el documento (A09:2025).
        log.warning("x2t termino con el codigo %s", code)
        raise EngineError("conversion_failed", _("No se pudo convertir el documento."))


def _new_folder(ctx: Ctx) -> tuple[str, Path]:
    doc_id = f"o{secrets.token_hex(8)}"
    folder = ctx.engine.work_root / doc_id
    folder.mkdir()
    return doc_id, folder


def _load(
    ctx: Ctx,
    piece: office.Piece,
    source: Path,
    kind: str,
    doc_id: str,
    folder: Path,
    extra: dict[str, object] | None = None,
    *,
    name: str = "",
    dirty: bool = False,
    fonts: list[str] | None = None,
) -> Reply:
    """Convierte ``source`` a Editor.bin y deja el documento abierto (``extra``: campos de x2t, como los del CSV)."""
    item = OfficeDoc(doc_id, kind, folder, name=name, dirty=dirty)
    all_fonts: str | None = None
    embedded: list[str] = []
    try:
        (item.doc / "media").mkdir(parents=True, exist_ok=True)
        (item.doc / "changes").mkdir(exist_ok=True)
        ctx.progress(0, 0, _("Abriendo el documento…"))
        if source.suffix.lower() == ".docx":
            found = docfonts.extract(source)
            if found.fonts:
                docfonts.save(folder / "embedded", found)
                all_fonts, embedded = _doc_index(ctx, piece, item, found)
        _convert(ctx, piece, folder, {"m_sFileFrom": source, "m_sFileTo": item.doc / "Editor.bin", "m_nFormatTo": office.CANVAS, **(extra or {})}, item.index)
        canvas = item.doc / "Editor.bin"
        if not canvas.is_file() or not 0 < canvas.stat().st_size <= office.MAX_CANVAS:
            raise EngineError("conversion_failed", _("No se pudo convertir el documento."))
        data = canvas.read_bytes()
    except BaseException:
        item.remove()
        raise
    finally:
        source.unlink(missing_ok=True)
    ctx.engine.office_docs[doc_id] = item
    item.note()
    media = sorted(p.name for p in (item.doc / "media").iterdir() if p.is_file() and office.MEDIA_NAME.match(p.name))
    reply: dict[str, Any] = {"doc": doc_id, "kind": kind, "media": media, "size": len(data), "fonts": fonts or []}
    if all_fonts is not None:
        reply.update(allFonts=all_fonts, embedded=embedded)
    return Reply(reply, data)


def _doc_index(ctx: Ctx, piece: office.Piece, item: OfficeDoc, found: docfonts.Embedded) -> tuple[str | None, list[str]]:
    """El indice de fuentes propio de un documento cuyas letras incrustadas no estan en el equipo.

    Devuelve su AllFonts.js (reescrito, como el del equipo) y las familias que
    aporta; (None, []) si no hace falta o no se pudo (entonces se dibuja con
    otras, como antes). Las fuentes van en ``fonts/`` del documento, solo para el.
    """
    assert piece.fonts is not None
    try:
        known = office.index_families((piece.fonts / "AllFonts.js").read_text(encoding="utf-8-sig"))
    except (OSError, ValueError):
        return None, []
    use = docfonts.to_render(found, known)
    if not use:
        return None, []
    fonts, index = item.folder / "fonts", item.folder / "index"
    try:
        fonts.mkdir()
        index.mkdir()
        for i, font in enumerate(use):
            (fonts / f"e{i:02d}{font.suffix}").write_bytes(font.data)
        code = _run(ctx, piece, {"fonts": f"{item.id}/index"})
        all_js, selection = index / "AllFonts.js", index / "font_selection.bin"
        if code != 0 or not all_js.is_file() or not selection.is_file():
            raise ValueError(f"x2t no creo el indice (codigo {code})")
        if all_js.stat().st_size > office.MAX_FONT_INDEX or selection.stat().st_size > office.MAX_FONT_INDEX:
            raise ValueError("indice demasiado grande")
        text = office.clean_font_index(all_js.read_text(encoding="utf-8-sig"))
        all_js.write_text(text, encoding="utf-8")
    except (OSError, ValueError, UnicodeDecodeError) as error:
        log.warning("no se pudo preparar el indice con las letras incrustadas (%s)", type(error).__name__)
        shutil.rmtree(fonts, ignore_errors=True)
        shutil.rmtree(index, ignore_errors=True)
        return None, []
    item.index = index
    families = list(dict.fromkeys(f.families[0] if f.families else f.name for f in use))
    return text, families


# ================================================================ operaciones


class ConfigureParams(Params):
    piece: PathStr | None = None
    fonts: PathStr | None = None
    ownFonts: PathStr | None = None  # noqa: N815 (como lo manda el intermediario)


@method("office.configure", ConfigureParams)
def office_configure(ctx: Ctx, p: ConfigureParams) -> dict[str, Any]:
    """La pieza instalada y su indice de fuentes (rutas ya comprobadas por el intermediario)."""
    engine = ctx.engine
    if p.piece is None:
        engine.office = None
        return {"ready": False, "fonts": False}
    root, fonts = Path(p.piece), Path(p.fonts) if p.fonts else None
    own = Path(p.ownFonts) if p.ownFonts else None
    if not root.is_absolute() or (fonts is not None and not fonts.is_absolute()) or (own is not None and not own.is_absolute()):
        raise invalid()
    try:
        own_fonts = own if own is not None and own.is_dir() else None
        engine.office = office.Piece(office.check_piece(root), office.check_fonts(fonts) if fonts else None, own_fonts)
    except office.OfficeUnavailable:
        engine.office = None
        raise unsupported(_("Documentos, Hojas y Presentaciones no están instalados.")) from None
    return {"ready": True, "fonts": engine.office.fonts is not None}


@method("office.fonts")
def office_fonts(ctx: Ctx, _p: Params) -> Reply:
    """Crea el indice de las fuentes de este equipo (AllFonts.js y font_selection.bin).

    Lo guarda la aplicacion y lo pasa despues en ``office.configure``. Se rehace
    cuando cambian las fuentes del equipo.
    """
    piece = _piece(ctx, fonts=False)
    name = f"f{secrets.token_hex(8)}"
    folder = ctx.engine.work_root / name
    folder.mkdir()
    try:
        ctx.progress(0, 0, _("Preparando las fuentes del equipo…"))
        code = _run(ctx, piece, {"fonts": name})
        index, selection = folder / "AllFonts.js", folder / "font_selection.bin"
        if code != 0 or not index.is_file() or not selection.is_file():
            log.warning("x2t no creo el indice de fuentes (codigo %s)", code)
            raise EngineError("conversion_failed", _("No se pudieron preparar las fuentes del equipo."))
        if index.stat().st_size > office.MAX_FONT_INDEX or selection.stat().st_size > office.MAX_FONT_INDEX:
            raise EngineError("conversion_failed", _("No se pudieron preparar las fuentes del equipo."))
        try:
            text = office.clean_font_index(index.read_text(encoding="utf-8-sig"))
        except (ValueError, UnicodeDecodeError):
            log.warning("x2t escribio un indice de fuentes que no se entiende")
            raise EngineError("conversion_failed", _("No se pudieron preparar las fuentes del equipo.")) from None
        data = selection.read_bytes()
    finally:
        shutil.rmtree(folder, ignore_errors=True)
    return Reply({"allFonts": text}, data)


class OfficeOpenParams(Params):
    path: PathStr


@method("office.open", OfficeOpenParams)
def office_open(ctx: Ctx, p: OfficeOpenParams) -> Reply:
    """Abre un documento del usuario: devuelve Editor.bin (para el editor) y la lista de imagenes."""
    piece = _piece(ctx)
    suffix = Path(p.path).suffix.lower()
    if suffix not in office.OPEN_FORMATS:
        raise EngineError("invalid_file", _("Este tipo de archivo no es compatible."))
    kind = office.OPEN_FORMATS[suffix][0]
    doc_id, folder = _new_folder(ctx)
    source = folder / f"source{suffix}"
    extra: dict[str, object] | None = None
    try:
        ctx.engine.host.fetch(p.path, source, max_bytes=office.MAX_INPUT)
        with open(source, "rb") as fh:
            head = fh.read(office.CSV_SAMPLE if suffix == ".csv" else 8)
        if suffix == ".csv":
            # Un CSV es texto sin firma: x2t necesita saber su codificacion y su separador.
            encoding = office.csv_encoding(head)
            try:
                text = office.csv_text(head, encoding)
            except ValueError:
                raise EngineError("invalid_file", _("El archivo está dañado o no es del tipo que indica su nombre.")) from None
            delimiter = office.csv_delimiter(text, ";" if language() == "es" else ",")
            extra = {"m_nCsvTxtEncoding": encoding, "m_nCsvDelimiter": delimiter}
        elif not head.startswith(_MAGIC):
            raise EngineError("invalid_file", _("El archivo está dañado o no es del tipo que indica su nombre."))
    except BaseException:
        shutil.rmtree(folder, ignore_errors=True)
        raise
    # Las fuentes que nombra, para avisar de las que no estan en el equipo (la aplicacion las compara con el indice).
    fonts = office.used_fonts(source, suffix)
    return _load(ctx, piece, source, kind, doc_id, folder, extra, name=Path(p.path).name, fonts=fonts)


class OfficeNewParams(Params):
    kind: Literal["word", "cell", "slide"]


@method("office.new", OfficeNewParams)
def office_new(ctx: Ctx, p: OfficeNewParams) -> Reply:
    """Documento nuevo, desde la plantilla vacia de la pieza en el idioma de Molino."""
    piece = _piece(ctx)
    empty = piece.converter / "empty"
    locale = {"es": "es-ES", "en": "en-US"}.get(language(), "default")
    template = empty / locale / office.NEW_FILES[p.kind]
    if not template.is_file():
        template = empty / "default" / office.NEW_FILES[p.kind]
    doc_id, folder = _new_folder(ctx)
    source = folder / f"source{template.suffix}"
    new_name = {"word": _("Documento"), "cell": _("Hoja de cálculo"), "slide": _("Presentación")}[p.kind] + template.suffix
    try:
        shutil.copyfile(template, source)
    except OSError:
        shutil.rmtree(folder, ignore_errors=True)
        raise unsupported(_("Documentos, Hojas y Presentaciones no están instalados.")) from None
    return _load(ctx, piece, source, p.kind, doc_id, folder, name=new_name)


class MediaParams(Params):
    doc: OfficeDocId
    name: Annotated[str, StringConstraints(max_length=80)]


@method("office.media", MediaParams)
def office_media(ctx: Ctx, p: MediaParams) -> Reply:
    """Una imagen del documento (las pide el editor por su nombre)."""
    item = _doc(ctx, p.doc)
    if not office.MEDIA_NAME.match(p.name):
        raise invalid()
    path = item.doc / "media" / p.name
    if not path.is_file() or path.is_symlink() or path.stat().st_size > office.MAX_MEDIA:
        raise not_found()
    data = path.read_bytes()
    return Reply({"name": p.name, "size": len(data)}, data)


class FontParams(Params):
    doc: OfficeDocId
    name: Annotated[str, StringConstraints(pattern=r"^e[0-9]{2}\.(ttf|otf)$")]


@method("office.font", FontParams)
def office_font(ctx: Ctx, p: FontParams) -> Reply:
    """Una letra incrustada del documento (la pide su editor, por el indice propio del documento)."""
    item = _doc(ctx, p.doc)
    path = item.folder / "fonts" / p.name
    if item.index is None or not path.is_file() or path.is_symlink() or path.stat().st_size > docfonts.MAX_FONT:
        raise not_found()
    data = path.read_bytes()
    if not docfonts.is_font(data):
        raise not_found()
    return Reply({"name": p.name, "size": len(data)}, data)


class AddMediaParams(Params):
    doc: OfficeDocId
    ext: Literal[".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"]


@method("office.addMedia", AddMediaParams)
def office_add_media(ctx: Ctx, p: AddMediaParams) -> dict[str, Any]:
    """Anade una imagen (la que el usuario elige para insertar) y devuelve su nombre en el documento."""
    item = _doc(ctx, p.doc)
    data = ctx.binary
    if not data or len(data) > office.MAX_MEDIA or not data.startswith(_IMAGES[p.ext]):
        raise EngineError("invalid_file", _("Esa imagen no se puede usar."))
    if p.ext == ".webp" and data[8:12] != b"WEBP":
        raise EngineError("invalid_file", _("Esa imagen no se puede usar."))
    name = f"image-{secrets.token_hex(6)}{p.ext}"
    # "x": un nombre nuevo, nunca se escribe sobre algo que ya estuviera.
    with open(item.doc / "media" / name, "xb") as out:
        out.write(data)
    return {"name": name}


class ChangesParams(Params):
    doc: OfficeDocId
    # Cuantos cambios habia apuntados cuando el editor hizo esta tanda: si son
    # menos que los apuntados, deshizo y siguio, y lo de despues se descarta.
    index: int | None = Field(default=None, ge=0)
    count: int = Field(ge=0, le=1_000_000)


@method("office.changes", ChangesParams)
def office_changes(ctx: Ctx, p: ChangesParams) -> dict[str, Any]:
    """Apunta una tanda de cambios del editor (uno por linea en la carga binaria)."""
    item = _doc(ctx, p.doc)
    try:
        lines = ctx.binary.decode("ascii").split("\n") if ctx.binary else []
    except UnicodeDecodeError:
        raise invalid() from None
    if len(lines) != p.count or not all(office.CHANGE.match(line) for line in lines):
        raise invalid()
    with open(item.changes, "ab") as out:
        if p.index is not None and p.index < len(item.offsets):
            out.truncate(item.offsets[p.index])
            del item.offsets[p.index:]
        out.seek(0, 2)
        at = out.tell()
        for line in lines:
            item.offsets.append(at)
            chunk = f'"{line}",'.encode("ascii")
            out.write(chunk)
            at += len(chunk)
    if lines and not item.dirty:
        item.dirty = True
        item.note()
    return {"applied": len(item.offsets)}


class SaveParams(Params):
    doc: OfficeDocId
    path: PathStr
    options: dict[str, Any] | None = None


def _export(ctx: Ctx, piece: office.Piece, item: OfficeDoc, code: int, suffix: str, options: str | None, extra: dict[str, object] | None = None) -> Path:
    """Editor.bin con los cambios apuntados, convertido a ``code``; devuelve el archivo de salida."""
    out = item.folder / f"salida-{secrets.token_hex(6)}{suffix}"
    has_changes = item.changes.is_file() and item.changes.stat().st_size > 0
    fields: dict[str, object] = {
        "m_sFileFrom": item.doc / "Editor.bin",
        "m_sFileTo": out,
        "m_nFormatTo": code,
        "m_bIsNoBase64": "false",
        "m_bFromChanges": "true" if has_changes else "false",
        "m_nDoctParams": 1,
    }
    if options is not None:
        fields["m_sJsonParams"] = options
    fields.update(extra or {})
    _convert(ctx, piece, item.folder, fields, item.index)
    if not out.is_file() or out.stat().st_size == 0:
        out.unlink(missing_ok=True)
        raise EngineError("conversion_failed", _("No se pudo convertir el documento."))
    if suffix == ".docx":
        # x2t pierde las letras incrustadas: se vuelven a meter tal como venian.
        embedded = docfonts.load(item.folder / "embedded")
        if embedded is not None:
            try:
                docfonts.embed(out, embedded)
            except (OSError, ValueError, zipfile.BadZipFile, ExpatError) as error:
                log.warning("no se pudieron volver a incrustar las fuentes (%s)", type(error).__name__)
    return out


def _options(raw: dict[str, Any] | None) -> str | None:
    try:
        return office.json_options(raw)
    except ValueError:
        raise invalid() from None


@method("office.save", SaveParams)
def office_save(ctx: Ctx, p: SaveParams) -> dict[str, Any]:
    """Guarda el documento con sus cambios en ``path`` (el formato sale de la extension)."""
    piece = _piece(ctx)
    item = _doc(ctx, p.doc)
    dest = ctx.engine.host.check_output(p.path, office.SAVE_SUFFIXES)
    suffix = Path(dest).suffix.lower()
    code = office.SAVE_FORMATS[item.kind].get(suffix)
    if code is None:
        raise invalid(_("Este documento no se puede guardar en ese formato."))
    ctx.progress(0, 0, _("Guardando…"))
    extra = {"m_nCsvTxtEncoding": office.UTF8, "m_nCsvDelimiter": office.CSV_DELIMITERS[";" if language() == "es" else ","]} if code == office.CSV else None
    out = _export(ctx, piece, item, code, suffix, _options(p.options), extra)
    try:
        size, _mtime = ctx.engine.host.install(out, dest)
    finally:
        out.unlink(missing_ok=True)
    # Guardado: lo que haya ahora ya esta en el archivo del usuario.
    item.name, item.dirty = Path(dest).name, False
    item.note()
    return {"path": dest, "size": size}


@method("office.exportPdf", SaveParams)
def office_export_pdf(ctx: Ctx, p: SaveParams) -> dict[str, Any]:
    """Exporta el documento a PDF, sin las ordenes de pintar sin trazado que escribe x2t."""
    piece = _piece(ctx)
    item = _doc(ctx, p.doc)
    dest = ctx.engine.host.check_output(p.path, (".pdf",))
    options = _options(p.options)
    if options is None and item.kind == "cell":
        # Como Excel al guardar como PDF: todo el libro respetando el area de
        # impresion. Sin opciones, x2t saca solo la hoja activa e ignora el area.
        options = office.json_options({"spreadsheetLayout": {"ignorePrintArea": False}})
    ctx.progress(0, 0, _("Exportando a PDF…"))
    out = _export(ctx, piece, item, office.PDF, ".pdf", options)
    try:
        cleaned = office.clean_pdf(out)
        size, _mtime = ctx.engine.host.install(out, dest)
    finally:
        out.unlink(missing_ok=True)
    return {"path": dest, "size": size, "cleaned": cleaned}


class CloseParams(Params):
    doc: OfficeDocId


def _recovery_area(ctx: Ctx) -> Path:
    return recovery.area_for(ctx.engine.work_root)


_DEFAULT_SAVE = {"word": (65, ".docx"), "cell": (257, ".xlsx"), "slide": (129, ".pptx")}


@method("office.recoverable")
def office_recoverable(ctx: Ctx, p: Params) -> dict[str, Any]:
    """Documentos de oficina con cambios sin guardar de una ejecucion que termino de golpe."""
    return {"documents": [entry.payload() for entry in recovery.office_entries(_recovery_area(ctx))]}


class RecoverParams(Params):
    id: OfficeDocId


@method("office.recover", RecoverParams)
def office_recover(ctx: Ctx, p: RecoverParams) -> Reply:
    """Abre lo recuperado como documento nuevo, sin archivo propio: Editor.bin con sus cambios, convertido de nuevo."""
    piece = _piece(ctx)
    area = _recovery_area(ctx)
    entry = recovery.find_office(area, p.id)
    if entry is None:
        raise not_found(_("Ese documento ya no se puede recuperar."))
    code, suffix = _DEFAULT_SAVE[entry.kind]
    doc_id, folder = _new_folder(ctx)
    source = folder / f"source{suffix}"
    try:
        ctx.progress(0, 0, _("Recuperando el documento…"))
        shutil.copytree(entry.folder / "doc", folder / "doc")
        if (entry.folder / "embedded").is_dir() and not (entry.folder / "embedded").is_symlink():
            shutil.copytree(entry.folder / "embedded", folder / "embedded")
        out = _export(ctx, piece, OfficeDoc(doc_id, entry.kind, folder), code, suffix, None)
        os.replace(out, source)
        shutil.rmtree(folder / "doc")
    except BaseException:
        shutil.rmtree(folder, ignore_errors=True)
        raise
    stem = Path(entry.name).stem or entry.name
    shutil.rmtree(folder / "embedded", ignore_errors=True)  # _load las vuelve a sacar del documento
    reply = _load(ctx, piece, source, entry.kind, doc_id, folder, name=_("{stem} (recuperado){suffix}", stem=stem, suffix=suffix), dirty=True)
    recovery.discard(area, p.id)
    return reply


@method("office.discardRecovery", RecoverParams)
def office_discard_recovery(ctx: Ctx, p: RecoverParams) -> dict[str, Any]:
    recovery.discard(_recovery_area(ctx), p.id)
    return {}


@method("office.close", CloseParams)
def office_close(ctx: Ctx, p: CloseParams) -> dict[str, Any]:
    item = ctx.engine.office_docs.pop(p.doc, None)
    if item is not None:
        item.remove()
    return {"closed": item is not None}

