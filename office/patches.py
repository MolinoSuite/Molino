"""Cambios de Molino en el motor de oficina (ONLYOFFICE 10).

Cada cambio sustituye un trozo exacto del código del motor y tiene que aparecer
exactamente una vez: con otra versión de ONLYOFFICE, el que no cuadre detiene el
armado (office/build.py) y hay que revisarlo a mano. Se aplican sobre una copia
recién extraída, nunca sobre la del usuario.

Los dos primeros son de Hojas: sin ellos, al exportar a PDF el motor encoge cada
hoja hasta meterla en una página y ordena las páginas al revés que Excel. Se
midieron con el banco de fidelidad del prototipo (30 hojas de cálculo públicas).
"""

from __future__ import annotations

from pathlib import Path

PATCHES = [
    {
        "name": "sheets-fit-to-page",
        "file": "editors/sdkjs/cell/sdk-all-min.js",
        "why": (
            "Al exportar una hoja de cálculo a PDF, el motor copia la configuración de impresión de "
            "cada hoja sin enlazarla a su hoja. Sin ese enlace, «ajustar a N páginas» no mira la "
            "casilla «Ajustar a» de la hoja y usa siempre 1 × 1: toda hoja sin configuración se encoge "
            "hasta caber en una página (o hasta el 10 %). Pasando la hoja a la copia se respeta la "
            "casilla, como en Excel."
        ),
        "old": "):fb=fb.Pp.clone(),B=fb.Rl",
        "new": "):fb=fb.Pp.clone(fb),B=fb.Rl",
    },
    {
        "name": "sheets-page-order",
        "file": "editors/sdkjs/cell/sdk-all.js",
        "why": (
            "El motor guarda el orden de páginas de cada hoja («hacia abajo y luego a la derecha», el "
            "de Excel por defecto, u «horizontalmente y luego hacia abajo») pero al paginar no lo mira: "
            "siempre hace el segundo. Se envuelve la función que pagina un rango (i8c) y, si la hoja "
            "pide el primero, se reordenan sus páginas por columna y luego por fila. Cada página guarda "
            "su rango de celdas en t6 (ka = primera columna, r1 = primera fila); el orden, en m0b "
            "(0 = hacia abajo y luego a la derecha)."
        ),
        "old": "k.prototype.i8c=function(J,V,sa,N,ba,ha,C,da){",
        "new": (
            "k.prototype.i8c=function(J,V,sa,N,ba,ha,C,da){var mo0=N.length;this.moI8c(J,V,sa,N,ba,ha,C,da);"
            "var moP=V&&V.xra&&V.xra();if(moP&&0===moP.m0b&&N.length-mo0>1){var moS=N.splice(mo0);"
            "moS.sort(function(a,b){return a.t6&&b.t6?a.t6.ka-b.t6.ka||a.t6.r1-b.t6.r1:0});"
            "for(var moI=0;moI<moS.length;moI++)N.push(moS[moI])}};"
            "k.prototype.moI8c=function(J,V,sa,N,ba,ha,C,da){"
        ),
    },
]


def app_of(file: str) -> str | None:
    """La app del motor a la que pertenece un archivo (word, cell, slide), si es de una."""
    parts = Path(file).parts
    return parts[2] if parts[:2] == ("editors", "sdkjs") and len(parts) > 3 else None


def apply(root: Path) -> set[str]:
    """Aplica los cambios en la copia extraída en ``root``. Devuelve las apps cambiadas."""
    apps: set[str] = set()
    for patch in PATCHES:
        path = root / patch["file"]
        data = path.read_bytes()  # en bytes: el archivo queda igual salvo el trozo
        old, new = patch["old"].encode(), patch["new"].encode()
        count = data.count(old)
        if count != 1:
            raise SystemExit(f"{patch['name']}: el trozo aparece {count} veces en {patch['file']}; hay que revisar el cambio")
        path.write_bytes(data.replace(old, new))
        app = app_of(patch["file"])
        if app:
            apps.add(app)
    return apps
