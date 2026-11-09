"""Freno a un cuelgue de MuPDF 1.28.2: pintar con una trama sin haber trazado nada.

El MuPDF de Molino PDF (1.28.2) se queda colgado, sin fin, al interpretar una
pagina que pinta con una trama (/Pattern) justo despues de elegir el color, sin
ningun trazado (por ejemplo ``/P5 scn f``), si la trama dibuja una imagen con
transparencia (SMask). El formato PDF no lo permite (ISO 32000-1, 8.5.1: entre
el trazado y la orden que lo pinta no puede ir nada) y no dibuja nada, pero
basta para colgar el motor al dibujar la pagina, sacar su texto o buscar en
ella. Lo escribe, por ejemplo, el conversor de ONLYOFFICE en graficos de Excel
con relleno de trama. Esta arreglado en MuPDF 1.28.6 (PyMuPDF 2.x), al que Molino
PDF no puede pasar aun (ver requirements.in y brotli_guard.py).

El documento no se corrige: el cambio acabaria guardado en el archivo del
usuario (y, si esta firmado, se veria como un cambio hecho despues de firmar).
En su lugar, antes de que MuPDF interprete una pagina se mira si su contenido
lleva esa orden. Casi nunca la lleva y no se hace nada mas (el resultado se
recuerda por pagina). Si la lleva, MuPDF trabaja sobre una copia de esa sola
pagina, en memoria y sin esas ordenes; se ve exactamente igual.

Se engancha en las funciones de PyMuPDF que interpretan el contenido de una
pagina, a las que llegan todas las demas (get_pixmap, get_text, search_for,
get_drawings...): asi cubre tambien las llamadas que se escriban mas adelante.
Se instala con ``install()`` en cada proceso que usa PyMuPDF (el motor y el de
la conversion a Word). Este freno se quita al pasar a una PyMuPDF con MuPDF
1.28.6 o posterior.

Lo que no cubre: la orden dentro de la apariencia de una anotacion o de una
trama que a su vez use otra trama (en la copia se limpian, pero no se buscan), y
las operaciones que reescriben el contenido en el propio documento (censurar,
limpiar el contenido), que no usan esa parte de MuPDF.
"""

from __future__ import annotations

import collections
import functools
import logging
import re
from typing import Any

import pymupdf

log = logging.getLogger(__name__)

_WS = rb"\x00\t\n\x0c\r "
_DELIM = rb"\x00\t\n\x0c\r ()<>\[\]{}/%"
# El nombre de una trama, la orden que la elige como color (scn o SCN) y, sin
# nada en medio, una orden de pintar.
_PAINT_WITHOUT_PATH = re.compile(
    rb"(/[^" + _DELIM + rb"]+[" + _WS + rb"]+(?:scn|SCN))([" + _WS + rb"]+)(?:f\*?|F|B\*?|b\*?|S|s)(?=[" + _DELIM + rb"]|\Z)"
)

# Funciones de pymupdf.Page que hacen que MuPDF interprete el contenido de la
# pagina. Las demas se apoyan en estas (get_pixmap en get_displaylist; get_text,
# search_for y compania en _get_textpage; get_drawings en get_cdrawings).
_HOOKED = ("_get_textpage", "get_displaylist", "get_cdrawings", "get_texttrace", "get_svg_image", "get_bboxlog", "run")
_CACHE = "_molino_paint_guard"
# Las copias se mantienen vivas un rato: lo que devuelve MuPDF (una lista de
# dibujo, un texto) puede usarse despues de volver.
_RECENT: collections.deque[pymupdf.Document] = collections.deque(maxlen=8)


def has_paint_without_path(data: bytes) -> bool:
    return _PAINT_WITHOUT_PATH.search(data) is not None


def remove_paint_without_path(data: bytes) -> bytes:
    """Quita la orden de pintar que sigue a la eleccion de una trama sin trazado."""
    return _PAINT_WITHOUT_PATH.sub(rb"\1\2", data)


def _streams_of(page: pymupdf.Page) -> list[int]:
    """Flujos de contenido de la pagina y de sus formularios (XObject), anidados incluidos."""
    xrefs = list(page.get_contents())
    xrefs += [item[0] for item in page.get_xobjects() if item[0] > 0]
    return xrefs


def _is_risky(page: pymupdf.Page) -> bool:
    doc = page.parent
    for xref in _streams_of(page):
        try:
            data = doc.xref_stream(xref)
        except Exception:  # noqa: BLE001 - un flujo ilegible no es este caso
            continue
        if data and has_paint_without_path(data):
            return True
    return False


def _risky(page: pymupdf.Page) -> bool:
    """Si la pagina lleva la orden. Se recuerda por documento y pagina."""
    doc = page.parent
    cache = getattr(doc, _CACHE, None)
    if cache is None:
        cache = {}
        setattr(doc, _CACHE, cache)
    risky = cache.get(page.xref)
    if risky is None:
        risky = cache[page.xref] = _is_risky(page)
        if risky:
            log.warning("pagina %d: pinta con una trama sin trazado; se interpreta una copia limpia", page.number + 1)
    return risky


def clean_copy(page: pymupdf.Page) -> pymupdf.Page | None:
    """Una copia de la pagina, en un documento nuevo en memoria y sin esas ordenes.

    None si la pagina no las lleva (lo normal) o si no se pudo copiar.
    """
    doc = page.parent
    if doc is None or not doc.is_pdf or not _risky(page):
        return None
    try:
        copy = pymupdf.open()
        # Solo copia objetos: MuPDF no interpreta el contenido al hacerlo.
        copy.insert_pdf(doc, from_page=page.number, to_page=page.number, links=False, show_progress=0)
        for xref in range(1, copy.xref_length()):
            if not copy.xref_is_stream(xref):
                continue
            data = copy.xref_stream(xref)
            if data and has_paint_without_path(data):
                copy.update_stream(xref, remove_paint_without_path(data))
        setattr(copy, _CACHE, {copy[0].xref: False})  # ya limpia: no se vuelve a mirar
        _RECENT.append(copy)
        return copy[0]
    except Exception:  # noqa: BLE001 - sin copia se interpreta la original, como sin este freno
        log.warning("no se pudo copiar la pagina %d para interpretarla limpia", page.number + 1, exc_info=True)
        return None


def _hook(name: str) -> None:
    original = getattr(pymupdf.Page, name)
    if getattr(original, "_molino_original", None) is not None:
        return  # ya instalado

    @functools.wraps(original)
    def hooked(self: pymupdf.Page, *args: Any, **kwargs: Any) -> Any:
        copy = clean_copy(self)
        return original(self if copy is None else copy, *args, **kwargs)

    hooked._molino_original = original  # type: ignore[attr-defined]
    setattr(pymupdf.Page, name, hooked)


def install() -> None:
    """Engancha el freno en este proceso. Se puede llamar mas de una vez."""
    for name in _HOOKED:
        _hook(name)
