#!/usr/bin/env bash
# Empaqueta el motor Python como ejecutable independiente (dist-engine/molino-engine),
# en Linux (en Windows, scripts/build-engine.ps1, con las mismas opciones).
# Uso: bash scripts/build-engine.sh   (con el entorno del motor, engine/.venv, ya hecho)
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
python="$root/engine/.venv/bin/python"
[ -x "$python" ] || { echo "No existe el entorno virtual del motor (engine/.venv)." >&2; exit 1; }

cd "$root/engine"
# Como en Windows: el motor habla con la aplicación por su entrada y salida
# estándar; fuera el servidor HTTP de llama-cpp-python y el cliente de descargas
# de huggingface_hub (el motor no tiene red y no los usa). La IA local de Linux
# (llama.cpp) va en su fase: si no está instalada, PyInstaller solo lo avisa.
"$python" -m PyInstaller --noconfirm --clean \
  --name molino-engine \
  --console \
  --distpath "$root/dist-engine" \
  --workpath "$root/build-engine/work" \
  --specpath "$root/build-engine" \
  --collect-submodules molino_engine \
  --collect-submodules pyhanko \
  --collect-submodules pyhanko_certvalidator \
  --collect-data pyhanko \
  --collect-data pyhanko_certvalidator \
  --collect-data tzdata \
  --collect-data certifi \
  --collect-submodules pdf2docx \
  --collect-data docx \
  --collect-binaries llama_cpp \
  --collect-binaries onnxruntime \
  --exclude-module llama_cpp.server \
  --exclude-module huggingface_hub \
  --exclude-module tkinter \
  --exclude-module pytest \
  run_engine.py

# python-docx trae, junto a su plantilla (default.docx, la que usa), la misma
# plantilla descomprimida, de la que se armó: no se usa.
rm -rf "$root/dist-engine/molino-engine/_internal/docx/templates/default-docx-template"

# OpenSSL y SQLite, las del sistema y no copias de la máquina donde se empaqueta:
# al firmar con el DNIe o una tarjeta, OpenSC (del sistema) usa la misma OpenSSL
# que el motor, y NSS (Firefox, Chrome) la misma SQLite. Una copia de otra
# distribución busca sus módulos en otra ruta (en Fedora, OpenSSL no cargaría el
# «legacy») y puede quedarse corta para las bibliotecas del sistema. Todas las
# distribuciones en las que funciona el motor las traen (el .deb y el .rpm las piden).
for lib in libcrypto.so.3 libssl.so.3 libsqlite3.so.0; do
  rm -f "$root/dist-engine/molino-engine/_internal/$lib"
done
echo "Motor empaquetado en dist-engine/molino-engine"
