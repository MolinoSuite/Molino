"""Lo que se puede comprobar de un PDF antes de presentarlo en una sede electronica.

Lo usan «Comprobar para un tramite» (ops/tramite.py) y la exportacion a PDF/A
de Documentos, Hojas y Presentaciones (office.py). Solo lee: nada de aqui
cambia el documento.

PDF/A: aqui solo se mira lo que el documento *dice* ser (sus metadatos XMP) y
unas pocas cosas basicas que se pueden comprobar con seguridad (perfil de
salida, letras incrustadas, sin cifrar, sin guiones). No es una validacion
completa de la norma (ISO 19005): para eso hace falta un validador como
veraPDF, y la interfaz nunca dice que un documento «cumple» PDF/A.
"""

from __future__ import annotations

import re
import unicodedata
from typing import Callable

import pymupdf

# Los metadatos XMP de un PDF pueden ser enormes; lo de PDF/A va al principio.
_MAX_XMP = 512 * 1024
# «pdfaid:part» y «pdfaid:conformance», como elemento o como atributo.
_PDFA_PART = re.compile(r"pdfaid:part\s*(?:>|=\s*[\"'])\s*([1-4])(?![0-9])")
_PDFA_LEVEL = re.compile(r"pdfaid:conformance\s*(?:>|=\s*[\"'])\s*([ABUEFabuef])(?![A-Za-z])")
_REFERENCE = re.compile(r"(\d{1,9}) 0 R")
_MAX_FONT_NAMES = 20
_SUBSET = re.compile(r"^[A-Z]{6}\+")


def pdfa_claim(doc: pymupdf.Document) -> str | None:
    """Lo que el documento dice ser en PDF/A («2B», «1A», «4»…), segun sus metadatos XMP; None si no lo dice."""
    try:
        xmp = (doc.get_xml_metadata() or "")[:_MAX_XMP]
    except Exception:  # noqa: BLE001 - metadatos ilegibles: no dice nada
        return None
    part = _PDFA_PART.search(xmp)
    if not part:
        return None
    level = _PDFA_LEVEL.search(xmp)
    return part.group(1) + (level.group(1).upper() if level else "")


def _resolved(doc: pymupdf.Document, kind: str, value: str) -> str:
    """El texto de un valor de ``xref_get_key``, siguiendo la referencia si lo es."""
    if kind == "xref":
        return doc.xref_object(int(value.split()[0]), compressed=True)
    return value


def has_output_intent(doc: pymupdf.Document) -> bool:
    """Lleva el perfil de salida de PDF/A (/OutputIntents con /S /GTS_PDFA1 y su perfil ICC)."""
    try:
        kind, value = doc.xref_get_key(doc.pdf_catalog(), "OutputIntents")
        if kind == "null":
            return False
        text = _resolved(doc, kind, value)
        # Cada perfil puede ser un objeto aparte: se miran los que nombra la lista.
        parts = [text] + [doc.xref_object(int(n), compressed=True) for n in _REFERENCE.findall(text)[:16]]
        return any("/GTS_PDFA1" in part and "/DestOutputProfile" in part for part in parts)
    except Exception:  # noqa: BLE001 - estructura rara: no se da por buena
        return False


def is_tagged(doc: pymupdf.Document) -> bool:
    """Tiene estructura (etiquetas de accesibilidad): un arbol /StructTreeRoot en el catalogo."""
    try:
        return doc.xref_get_key(doc.pdf_catalog(), "StructTreeRoot")[0] != "null"
    except Exception:  # noqa: BLE001
        return False


def fonts_not_embedded(doc: pymupdf.Document, tick: Callable[[], None] | None = None) -> tuple[int, list[str]]:
    """Las letras que usa y no van dentro del archivo: cuantas y sus nombres (los primeros).

    Las de tipo 3 se dibujan con lo que lleva el propio PDF: cuentan como
    incrustadas. Cada letra se cuenta una vez aunque la usen varias paginas.
    """
    seen: set[int] = set()
    missing: list[str] = []
    count = 0
    for index in range(doc.page_count):
        if tick is not None and index % 50 == 0:
            tick()
        try:
            fonts = doc.get_page_fonts(index)
        except Exception:  # noqa: BLE001 - pagina estropeada: se sigue con las demas
            continue
        for xref, ext, kind, basefont, *_rest in fonts:
            if xref in seen:
                continue
            seen.add(xref)
            if kind == "Type3" or ext != "n/a":
                continue
            count += 1
            name = _SUBSET.sub("", str(basefont or "")).strip()
            name = "".join(c for c in name if c.isprintable())[:64] or "?"
            if len(missing) < _MAX_FONT_NAMES and name not in missing:
                missing.append(name)
    return count, missing


def needs_password(data: bytes) -> bool:
    """Hace falta una contrasena para abrir el archivo (no solo restricciones de uso)."""
    try:
        probe = pymupdf.open(stream=data, filetype="pdf")
    except Exception:  # noqa: BLE001
        return False
    try:
        # Se lee una sola vez y antes de autenticar (ver session.py).
        return bool(probe.needs_pass)
    finally:
        probe.close()


# ------------------------------------------------------------- nombre del archivo

# Lo que no da problemas en ningun sistema ni en ninguna sede: letras sin
# tilde, cifras, guion, guion bajo y un punto antes de la extension.
_SAFE = re.compile(r"[A-Za-z0-9_\-]")
MAX_NAME = 100


def name_issues(name: str) -> tuple[list[str], str]:
    """Lo que puede dar problemas en el nombre de un archivo al subirlo, y un nombre sin eso.

    Devuelve ``(problemas, propuesta)``. Los problemas son: ``accents``
    (tildes, eñes y otras letras fuera del ASCII), ``spaces``, ``symbols``
    (signos como & % # ¿ ? : o comillas), ``dots`` (mas de un punto),
    ``long`` (mas de ``MAX_NAME`` caracteres) y ``extension`` (no acaba en
    .pdf). Las sedes no siguen todas la misma regla: esto es lo que evita
    problemas en todas.
    """
    stem, dot, ext = name.rpartition(".")
    if not dot:
        stem, ext = name, ""
    issues: list[str] = []
    if any(ord(c) > 127 for c in stem):
        issues.append("accents")
    if any(c.isspace() for c in stem):
        issues.append("spaces")
    if any(ord(c) <= 127 and not c.isspace() and c != "." and not _SAFE.match(c) for c in stem):
        issues.append("symbols")
    if "." in stem:
        issues.append("dots")
    if len(name) > MAX_NAME:
        issues.append("long")
    if ext.lower() != "pdf":
        issues.append("extension")
    # La propuesta: sin tildes (á → a, ñ → n), con guiones bajos en vez de
    # espacios y signos, sin repetirlos ni dejarlos en los extremos.
    plain = "".join(c for c in unicodedata.normalize("NFKD", stem) if not unicodedata.combining(c))
    safe = "".join(c if _SAFE.match(c) else "_" for c in plain)
    safe = re.sub(r"_{2,}", "_", safe).strip("_-")[: MAX_NAME - 4].rstrip("_-")
    return issues, f"{safe or 'documento'}.pdf"
