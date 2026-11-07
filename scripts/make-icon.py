"""Pone el icono de Molino PDF en build/ (icon.ico e icon.png) y los logos del README en .github/marca.

El icono no se dibuja aqui: sale de la marca de la suite (la carpeta marca, junto
a esta), donde marca/scripts/exportar.py genera los de todas las apps a partir de
sus originales en SVG, con un dibujo ajustado para 16 y 24 px.

Uso: python scripts/make-icon.py [carpeta exportado de la marca] [carpeta de salida]
Por defecto: ../marca/exportado y build.
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
# El .ico tiene que traer al menos estos tamanos (Windows elige el suyo).
NEEDED = {16, 24, 32, 48, 256}
# Logos del README: el de la suite (fondo claro y oscuro) y el icono de cada app.
README = {
    "svg/logo-horizontal.svg": "molino.svg",
    "svg/logo-horizontal-sobre-oscuro.svg": "molino-oscuro.svg",
    "svg/icono-documentos.svg": "documentos.svg",
    "svg/icono-hojas.svg": "hojas.svg",
    "svg/icono-presentaciones.svg": "presentaciones.svg",
    "svg/icono-pdf.svg": "pdf.svg",
}


def main(brand: Path, out_dir: Path) -> None:
    ico = brand / "windows" / "pdf.ico"
    png = brand / "png" / "icono-pdf-512.png"
    for path in (ico, png, *(brand / name for name in README)):
        if not path.is_file():
            sys.exit(f"falta {path}: genera antes la marca (marca/scripts/exportar.py)")
    with Image.open(ico) as image:
        sizes = {w for w, h in image.info.get("sizes", set()) if w == h}
    if not NEEDED <= sizes:
        sys.exit(f"al .ico le faltan tamanos: {sorted(NEEDED - sizes)}")
    out_dir.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(ico, out_dir / "icon.ico")
    shutil.copyfile(png, out_dir / "icon.png")
    readme_dir = ROOT / ".github" / "marca"
    readme_dir.mkdir(parents=True, exist_ok=True)
    for source, name in README.items():
        shutil.copyfile(brand / source, readme_dir / name)
    print("icono copiado en", out_dir, "y logos del README en", readme_dir)


if __name__ == "__main__":
    brand = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent / "marca" / "exportado"
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "build"
    main(brand, out)
