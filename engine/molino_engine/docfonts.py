"""Letras incrustadas en los .docx (paso 7 de PLAN-SUITE).

Word puede guardar dentro del .docx las fuentes que usa (Opciones, Guardar,
«Incrustar fuentes en el archivo»): van en ``word/fonts/``, ofuscadas con una
clave (ECMA-376, parte 1, 17.8.1: los 32 primeros bytes, con XOR de la clave de
``w:fontKey`` leida al reves), y ``word/fontTable.xml`` dice de que fuente y
estilo es cada una.

Los editores de ONLYOFFICE no las usan (dibujan con otra parecida) y x2t las
pierde al guardar. Molino:

* al abrir, las saca aqui y comprueba que son TrueType u OpenType. Las que no
  estan en el equipo van al indice de fuentes propio de ese documento, con el
  que lo dibujan los editores y x2t (al exportar a PDF). Nunca se instalan en
  Windows ni las ve otro documento: vienen de un documento de fuera;
* al guardar en .docx, las vuelve a meter tal como venian (``embed``).

Todo esto corre en el motor aislado, como cualquier lectura de un documento.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import struct
import uuid
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from xml.dom import minidom
from xml.etree import ElementTree

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PACKAGE_RELS = "http://schemas.openxmlformats.org/package/2006/relationships"
CONTENT_TYPES = "http://schemas.openxmlformats.org/package/2006/content-types"
FONT_RELATIONSHIP = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/font"
OBFUSCATED_FONT = "application/vnd.openxmlformats-officedocument.obfuscatedFont"
STYLES = ("Regular", "Bold", "Italic", "BoldItalic")

MAX_FONTS = 48  # fuentes incrustadas de un documento que se tienen en cuenta
MAX_FONT = 32 * 1024**2  # cada una
MAX_TOTAL = 128 * 1024**2  # todas
MAX_XML = 8 * 1024**2  # fontTable.xml, sus relaciones y los ajustes
_KEY = re.compile(r"^\{[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\}$")
_SFNT = (b"\x00\x01\x00\x00", b"OTTO", b"true")
# Ajustes de Word sobre incrustar fuentes, en el orden en que van en settings.xml.
_FLAGS = ("embedTrueTypeFonts", "embedSystemFonts", "saveSubsetFonts")
# Lo que puede ir antes de ellos en settings.xml (CT_Settings, ECMA-376 parte 1, 17.15.1.78).
_BEFORE_FLAGS = (
    "writeProtection", "view", "zoom", "removePersonalInformation", "removeDateAndTime", "doNotDisplayPageBoundaries",
    "displayBackgroundShape", "printPostScriptOverText", "printFractionalCharacterWidth", "printFormsData",
)
_DECLARATION = b'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'
_FILE = re.compile(r"^[0-9]{2}\.(ttf|otf)$")


@dataclass(frozen=True)
class Font:
    name: str  # como la nombra fontTable.xml
    style: str  # Regular, Bold, Italic o BoldItalic
    key: str | None  # w:fontKey, si venia ofuscada
    subsetted: bool  # Word guardo solo las letras que se usan
    families: tuple[str, ...]  # las que dice la propia fuente (tabla «name»)
    data: bytes  # la fuente, ya sin ofuscar

    @property
    def suffix(self) -> str:
        return ".otf" if self.data[:4] == b"OTTO" else ".ttf"


@dataclass
class Embedded:
    """Las fuentes incrustadas de un documento y los ajustes de Word sobre incrustarlas."""

    fonts: list[Font] = field(default_factory=list)
    flags: tuple[str, ...] = ()


# --------------------------------------------------------------- la fuente


def _key_bytes(key: str) -> bytes:
    return bytes.fromhex(key.strip("{}").replace("-", ""))[::-1]


def obfuscate(data: bytes, key: str) -> bytes:
    """Ofusca o desofusca (es lo mismo): XOR de los 32 primeros bytes con la clave."""
    mask = _key_bytes(key)
    head = bytes(b ^ mask[i % 16] for i, b in enumerate(data[:32]))
    return head + data[32:]


def is_font(data: bytes) -> bool:
    """¿Es una fuente TrueType u OpenType? (por su firma; ni colecciones ni otra cosa)."""
    return len(data) >= 12 and data[:4] in _SFNT


def _clean(name: str) -> str | None:
    name = name.replace("\x00", "").strip()
    if not name or len(name) > 64 or any(ord(c) < 32 or ord(c) == 0x7F for c in name):
        return None
    return name


def font_families(data: bytes) -> tuple[str, ...]:
    """Las familias que dice la fuente en su tabla «name» (la tipografica, 16, y la de siempre, 1).

    Lee solo la cabecera y esa tabla, comprobando cada posicion; si algo no
    encaja, ninguna.
    """
    if not is_font(data):
        return ()
    try:
        (tables,) = struct.unpack_from(">H", data, 4)
        if tables > 512:
            return ()
        for i in range(tables):
            tag, _check, offset, length = struct.unpack_from(">4sIII", data, 12 + 16 * i)
            if tag != b"name":
                continue
            table = data[offset : offset + length]
            if len(table) != length or length < 6:
                return ()
            count, strings = struct.unpack_from(">HH", table, 2)
            # Cada familia (sin distinguir mayusculas) con su mejor registro.
            found: dict[str, tuple[tuple[int, bool, bool], str]] = {}
            for j in range(min(count, 4096)):
                if 6 + 12 * (j + 1) > len(table):
                    break
                platform, encoding, lang, name_id, size, at = struct.unpack_from(">6H", table, 6 + 12 * j)
                if name_id not in (1, 16):
                    continue
                raw = table[strings + at : strings + at + size]
                if len(raw) != size:
                    continue
                if platform in (0, 3):
                    text = raw.decode("utf-16-be", "replace")
                elif platform == 1 and encoding == 0:
                    text = raw.decode("mac_roman", "replace")
                else:
                    continue
                name = _clean(text)
                if name is None:
                    continue
                # La mejor de cada una: Windows en ingles de EE. UU., luego Windows, luego el resto.
                rank = (name_id, platform == 3 and lang == 0x409, platform == 3)
                key = name.lower()
                if key not in found or rank > found[key][0]:
                    found[key] = (rank, name)
            return tuple(name for _rank, name in sorted(found.values(), key=lambda item: item[0], reverse=True))
    except struct.error:
        return ()
    return ()


# --------------------------------------------------------------- al abrir


def _flag_on(element: ElementTree.Element) -> bool:
    return element.get(f"{{{W}}}val", "true").lower() not in ("0", "false", "off")


def _part(base: str, target: str) -> str | None:
    """La parte del paquete a la que apunta una relacion de ``base`` (``word/``); None si sale del paquete."""
    if "\\" in target or ":" in target or not target:
        return None
    parts = (target.lstrip("/").split("/") if target.startswith("/") else (base.rstrip("/") + "/" + target).split("/"))
    out: list[str] = []
    for piece in parts:
        if piece in ("", "."):
            continue
        if piece == "..":
            if not out:
                return None
            out.pop()
        else:
            out.append(piece)
    return "/".join(out)


def _read(archive: zipfile.ZipFile, info: zipfile.ZipInfo, limit: int) -> bytes | None:
    if info.file_size > limit:
        return None
    with archive.open(info) as handle:
        data = handle.read(limit + 1)
    return data if len(data) <= limit else None


def extract(source: Path) -> Embedded:
    """Las fuentes incrustadas de un .docx y los ajustes de Word sobre ellas. Sin errores: si no se puede, ninguna."""
    result = Embedded()
    try:
        with zipfile.ZipFile(source) as archive:
            infos = {info.filename: info for info in archive.infolist()[:20_000]}
            table_info = infos.get("word/fontTable.xml")
            if table_info is None:
                return result
            raw = _read(archive, table_info, MAX_XML)
            rels_info = infos.get("word/_rels/fontTable.xml.rels")
            rels_raw = _read(archive, rels_info, MAX_XML) if rels_info else None
            if raw is None or rels_raw is None:
                return result
            targets: dict[str, str] = {}
            for rel in ElementTree.fromstring(rels_raw).iter(f"{{{PACKAGE_RELS}}}Relationship"):
                if rel.get("Type") == FONT_RELATIONSHIP and rel.get("TargetMode", "Internal") == "Internal":
                    part = _part("word", rel.get("Target", ""))
                    if part and rel.get("Id"):
                        targets[rel.get("Id", "")] = part
            total = 0
            for font in ElementTree.fromstring(raw).iter(f"{{{W}}}font"):
                name = _clean(font.get(f"{{{W}}}name", ""))
                if name is None:
                    continue
                for style in STYLES:
                    element = font.find(f"{{{W}}}embed{style}")
                    if element is None or len(result.fonts) >= MAX_FONTS:
                        continue
                    info = infos.get(targets.get(element.get(f"{{{R}}}id", ""), ""))
                    if info is None or total + info.file_size > MAX_TOTAL:
                        continue
                    data = _read(archive, info, MAX_FONT)
                    if data is None:
                        continue
                    total += len(data)
                    key = element.get(f"{{{W}}}fontKey")
                    key = key.upper() if key and _KEY.match(key) else None
                    if key and not is_font(data):
                        data = obfuscate(data, key)
                    families = font_families(data)
                    if not families:
                        continue
                    subsetted = element.get(f"{{{W}}}subsetted", "false").lower() in ("1", "true", "on")
                    result.fonts.append(Font(name, style, key, subsetted, families, data))
            settings_info = infos.get("word/settings.xml")
            settings = _read(archive, settings_info, MAX_XML) if settings_info else None
            if settings is not None and result.fonts:
                root = ElementTree.fromstring(settings)
                result.flags = tuple(flag for flag in _FLAGS if (e := root.find(f"{{{W}}}{flag}")) is not None and _flag_on(e))
    except (OSError, zipfile.BadZipFile, RuntimeError, ValueError, EOFError, ElementTree.ParseError, KeyError):
        return Embedded()
    return result


def save(folder: Path, embedded: Embedded) -> None:
    """Las guarda en ``folder`` (NN.ttf u NN.otf y fonts.json) para volver a meterlas al guardar."""
    folder.mkdir(parents=True, exist_ok=True)
    listing: list[dict[str, Any]] = []
    for i, font in enumerate(embedded.fonts):
        file = f"{i:02d}{font.suffix}"
        (folder / file).write_bytes(font.data)
        listing.append({"file": file, "name": font.name, "style": font.style, "key": font.key, "subsetted": font.subsetted, "families": list(font.families)})
    (folder / "fonts.json").write_text(json.dumps({"v": 1, "flags": list(embedded.flags), "fonts": listing}), encoding="utf-8")


def load(folder: Path) -> Embedded | None:
    """Las guardadas con ``save`` (comprobadas otra vez); None si no hay."""
    try:
        meta = json.loads((folder / "fonts.json").read_text(encoding="utf-8"))
        if not isinstance(meta, dict) or meta.get("v") != 1:
            return None
        fonts: list[Font] = []
        for entry in meta.get("fonts", [])[:MAX_FONTS]:
            file, name, style, key = entry.get("file"), entry.get("name"), entry.get("style"), entry.get("key")
            families = entry.get("families")
            if not (isinstance(file, str) and _FILE.match(file) and isinstance(name, str) and _clean(name) == name and style in STYLES):
                continue
            if key is not None and not (isinstance(key, str) and _KEY.match(key)):
                continue
            if not (isinstance(families, list) and all(isinstance(f, str) and _clean(f) == f for f in families)):
                continue
            path = folder / file
            if path.is_symlink() or not path.is_file() or path.stat().st_size > MAX_FONT:
                continue
            data = path.read_bytes()
            if is_font(data):
                fonts.append(Font(name, style, key, entry.get("subsetted") is True, tuple(families), data))
        flags = tuple(f for f in meta.get("flags", []) if f in _FLAGS)
        return Embedded(fonts, flags) if fonts else None
    except (OSError, ValueError, AttributeError, TypeError):
        return None


def to_render(embedded: Embedded, known: set[str]) -> list[Font]:
    """Las que hacen falta para dibujar el documento: las que no estan en el equipo (``known``, en minusculas).

    Una fuente incrustada nunca sustituye a una del equipo: si se llama como una
    que ya esta (por la tabla del documento o por su propio nombre), se usa la del equipo.
    """
    return [f for f in embedded.fonts if f.name.lower() not in known and not any(n.lower() in known for n in f.families)]


# --------------------------------------------------------------- al guardar


def _xml(data: bytes) -> minidom.Document:
    return minidom.parseString(data)


def _bytes(doc: minidom.Document) -> bytes:
    return _DECLARATION + doc.documentElement.toxml().encode("utf-8")


def _prefix(element: minidom.Element, namespace: str) -> str | None:
    """El prefijo con el que ``element`` declara ``namespace`` (None si no lo declara)."""
    for i in range(element.attributes.length):
        attr = element.attributes.item(i)
        if attr.name.startswith("xmlns:") and attr.value == namespace:
            return attr.name[len("xmlns:") :]
    return None


def _children(element: minidom.Element) -> list[minidom.Element]:
    return [n for n in element.childNodes if n.nodeType == n.ELEMENT_NODE]


def _set_flags(settings: minidom.Document, flags: tuple[str, ...]) -> None:
    """Pone en settings.xml los ajustes de incrustar que tenia el original, en su sitio."""
    root = settings.documentElement
    w = _prefix(root, W) or root.prefix
    if not w:
        return
    for i, flag in enumerate(_FLAGS):
        if flag not in flags or any(c.namespaceURI == W and c.localName == flag for c in _children(root)):
            continue
        allowed = set(_BEFORE_FLAGS) | set(_FLAGS[:i])
        after = next((c for c in _children(root) if not (c.namespaceURI == W and c.localName in allowed)), None)
        element = settings.createElementNS(W, f"{w}:{flag}")
        if after is None:
            root.appendChild(element)
        else:
            root.insertBefore(element, after)


def embed(docx: Path, embedded: Embedded) -> int:
    """Vuelve a meter en ``docx`` (recien escrito por x2t) las fuentes incrustadas del original.

    Solo las de las fuentes que siguen en su fontTable.xml (las que ya no usa el
    documento no). Cada una, ofuscada con su clave de antes (o una nueva), con su
    relacion, su tipo de contenido y los ajustes de Word que tenia. Devuelve cuantas.
    """
    with zipfile.ZipFile(docx) as archive:
        infos = archive.infolist()
        names = {info.filename for info in infos}
        if "word/fontTable.xml" not in names:
            return 0
        table = _xml(archive.read("word/fontTable.xml"))
        root = table.documentElement
        w = _prefix(root, W) or root.prefix
        if not w:
            return 0
        present = {e.getAttributeNS(W, "name"): e for e in root.getElementsByTagNameNS(W, "font")}
        wanted = [f for f in embedded.fonts if f.name in present]
        if not wanted:
            return 0
        r = _prefix(root, R)
        if r is None:
            r = "r" if not root.hasAttribute("xmlns:r") else "rmolino"
            root.setAttribute(f"xmlns:{r}", R)
        rels_name = "word/_rels/fontTable.xml.rels"
        rels = _xml(archive.read(rels_name) if rels_name in names else f'<Relationships xmlns="{PACKAGE_RELS}"/>'.encode())
        ids = {e.getAttribute("Id") for e in rels.documentElement.getElementsByTagNameNS(PACKAGE_RELS, "Relationship")}
        types = _xml(archive.read("[Content_Types].xml"))
        settings = _xml(archive.read("word/settings.xml")) if "word/settings.xml" in names else None

        added: dict[str, bytes] = {}
        by_font: dict[str, dict[str, minidom.Element]] = {}
        n = 0
        for font in wanted:
            n += 1
            while f"word/fonts/font{n}.odttf" in names:
                n += 1
            part = f"word/fonts/font{n}.odttf"
            rid = f"rId{n}"
            k = n
            while rid in ids:
                k += 1
                rid = f"rIdF{k}"
            ids.add(rid)
            key = font.key or "{" + str(uuid.uuid4()).upper() + "}"
            added[part] = obfuscate(font.data, key)
            rel = rels.createElementNS(PACKAGE_RELS, "Relationship")
            rel.setAttribute("Id", rid)
            rel.setAttribute("Type", FONT_RELATIONSHIP)
            rel.setAttribute("Target", part[len("word/") :])
            rels.documentElement.appendChild(rel)
            element = table.createElementNS(W, f"{w}:embed{font.style}")
            element.setAttributeNS(R, f"{r}:id", rid)
            element.setAttributeNS(W, f"{w}:fontKey", key)
            if font.subsetted:
                element.setAttributeNS(W, f"{w}:subsetted", "1")
            by_font.setdefault(font.name, {})[font.style] = element
        for name, elements in by_font.items():
            target = present[name]
            for child in _children(target):
                if child.namespaceURI == W and child.localName in {f"embed{s}" for s in STYLES}:
                    target.removeChild(child)
            # Las de incrustar van las ultimas de w:font, en este orden (CT_Font).
            for style in STYLES:
                if style in elements:
                    target.appendChild(elements[style])
        types_root = types.documentElement
        if not any(
            e.getAttribute("Extension").lower() == "odttf" for e in types_root.getElementsByTagNameNS(CONTENT_TYPES, "Default")
        ):
            default = types.createElementNS(CONTENT_TYPES, "Default")
            default.setAttribute("Extension", "odttf")
            default.setAttribute("ContentType", OBFUSCATED_FONT)
            types_root.insertBefore(default, types_root.firstChild)
        if settings is not None:
            _set_flags(settings, embedded.flags or ("embedTrueTypeFonts",))
        replaced = {"word/fontTable.xml": _bytes(table), rels_name: _bytes(rels), "[Content_Types].xml": _bytes(types)}
        if settings is not None:
            replaced["word/settings.xml"] = _bytes(settings)

        temp = docx.with_name(docx.name + ".fuentes")
        try:
            with zipfile.ZipFile(temp, "w", zipfile.ZIP_DEFLATED) as out:
                for info in infos:
                    if info.filename in replaced:
                        out.writestr(_info(info), replaced.pop(info.filename))
                        continue
                    with archive.open(info) as source, out.open(_info(info), "w") as target:
                        shutil.copyfileobj(source, target, 1024 * 1024)
                for name, data in [*replaced.items(), *added.items()]:
                    out.writestr(zipfile.ZipInfo(name, (1980, 1, 1, 0, 0, 0)), data, zipfile.ZIP_DEFLATED)
        except BaseException:
            temp.unlink(missing_ok=True)
            raise
    os.replace(temp, docx)
    return len(wanted)


def _info(info: zipfile.ZipInfo) -> zipfile.ZipInfo:
    copy = zipfile.ZipInfo(info.filename, info.date_time)
    copy.compress_type = info.compress_type if info.compress_type in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED) else zipfile.ZIP_DEFLATED
    copy.external_attr = info.external_attr
    return copy
