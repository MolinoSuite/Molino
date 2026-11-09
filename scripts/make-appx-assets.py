"""Pone en build/appx las imagenes del paquete de la Microsoft Store (MSIX) de Molino PDF.

Como make-icon.py, no dibuja nada: parte de los iconos de la marca de la suite
(marca/exportado/png, que genera marca/scripts/exportar.py), con el dibujo
ajustado para 16, 24 y 32 px. Fondo transparente: Windows pone detras el de la
tarjeta o la barra de tareas.

  python scripts/make-appx-assets.py [carpeta exportado de la marca] [carpeta de salida]
Por defecto: ../marca/exportado y build/appx.
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def icon(png: Path, app: str, size: int) -> Image.Image:
    """El icono de la app en ``size`` px: el exportado de ese tamano si lo hay; si no, reducido del grande."""
    exact = png / f"icono-{app}-{size}.png"
    if exact.is_file():
        return Image.open(exact).convert("RGBA")
    big = Image.open(png / f"icono-{app}-1024.png").convert("RGBA")
    return big.resize((size, size), Image.Resampling.LANCZOS)


def tile(png: Path, app: str, width: int, height: int, share: float) -> Image.Image:
    """Una tarjeta transparente con el icono centrado (``share``: lo que ocupa del lado corto)."""
    side = round(min(width, height) * share)
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    canvas.alpha_composite(icon(png, app, side), ((width - side) // 2, (height - side) // 2))
    return canvas


def main(brand: Path, out_dir: Path, app: str = "pdf") -> None:
    png = brand / "png"
    if not (png / f"icono-{app}-1024.png").is_file():
        sys.exit(f"Falta {png / f'icono-{app}-1024.png'}: genera antes la marca (marca/scripts/exportar.py).")
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob("*.png"):
        old.unlink()
    images: dict[str, Image.Image] = {}
    for scale in (100, 200):
        k = scale / 100
        images[f"StoreLogo.scale-{scale}.png"] = icon(png, app, round(50 * k))
        images[f"Square44x44Logo.scale-{scale}.png"] = icon(png, app, round(44 * k))
        images[f"Square150x150Logo.scale-{scale}.png"] = tile(png, app, round(150 * k), round(150 * k), 0.6)
        images[f"Wide310x150Logo.scale-{scale}.png"] = tile(png, app, round(310 * k), round(150 * k), 0.6)
    # Lista de apps, barra de tareas y Explorador: tamaños exactos, sin placa detras.
    for size in (16, 24, 32, 48, 256):
        images[f"Square44x44Logo.targetsize-{size}.png"] = icon(png, app, size)
        images[f"Square44x44Logo.targetsize-{size}_altform-unplated.png"] = icon(png, app, size)
    for name, image in images.items():
        image.save(out_dir / name, optimize=True)
    print(f"{len(images)} imagenes en {out_dir}")


if __name__ == "__main__":
    args = sys.argv[1:]
    main(
        Path(args[0]) if args else ROOT.parent / "marca" / "exportado",
        Path(args[1]) if len(args) > 1 else ROOT / "build" / "appx",
    )
