"""Descarga las variantes del español del corrector a resources/dictionaries.

Documentos, Hojas y Presentaciones corrigen con los diccionarios de la pieza de
oficina, que del español solo trae el de España, y con estos, que trae Molino:
los del español de América y de Estados Unidos del proyecto RLA-ES (versión
2.9), tal como los distribuye LibreOffice (github.com/LibreOffice/dictionaries,
carpeta es/). El proceso principal los da a los editores junto a los de la pieza
(src/main/officewin.ts) y scripts/make-suite-msix.mjs los mete en el paquete.

* De dónde: un commit fijo del repositorio, nunca una rama (A03:2025).
* Qué: cada archivo con su tamaño y su SHA-256, fijados aquí (A08:2025). Se
  calcularon en la primera descarga y coinciden con los blobs del árbol de git
  de ese commit. Un archivo que no coincide no se guarda.
* Cómo: solo HTTPS, sin seguir redirecciones, con tope de tamaño, a un archivo
  aparte que solo recibe su nombre después de comprobarlo.
* Es idempotente: lo que ya está y coincide no se vuelve a bajar.

Licencia de los diccionarios: triple, a elegir (GPL 3 o posterior, LGPL 3 o
posterior, MPL 1.1 o posterior). Sus textos van con ellos (LICENSE.md, GPLv3.txt,
LGPLv3.txt, MPL-1.1.txt) y la autoría, en README_hunspell_es.txt.

  engine\\.venv\\Scripts\\python.exe -I scripts\\fetch-dictionaries.py
"""

from __future__ import annotations

import hashlib
import sys
import urllib.request
from pathlib import Path

COMMIT = "762abe74008b94b2ff06db6f4024b59a8254c467"  # «Updating RLA-ES Spanish spellcheker to v2.9.»
BASE = f"https://raw.githubusercontent.com/LibreOffice/dictionaries/{COMMIT}/es/"
# El destino sale de la ubicación del script, nunca de un parámetro.
DEST = Path(__file__).resolve().parents[1] / "resources" / "dictionaries"

# Las variantes (es_ES ya está en la pieza). Sin es_GQ ni es_PH: Windows no les da
# código de idioma (LCID) y los editores no podrían marcar un texto con ellas. Ni
# es_CU: Windows sí (23562), pero ONLYOFFICE 10 no lo conoce y guardaría el texto
# con w:lang="undefined".
VARIANTS = ("AR", "BO", "CL", "CO", "CR", "DO", "EC", "GT", "HN", "MX", "NI", "PA", "PE", "PR", "PY", "SV", "US", "UY", "VE")
FILES: dict[str, tuple[int, str]] = {
    "es_AR.aff": (171527, "e9a96514295f8664db270d024c345700ccb9410a384eb71aec0fe5f0931d8c70"),
    "es_AR.dic": (707817, "4fe3e193425bb3841ee218d36a9fc95d85b8daa8909363bdbba55a2f9f4e3d1d"),
    "es_BO.aff": (162395, "dc8213bb8fb08e51dd5869b348d873de23f89e3315656396ca3031fe1d7ffcea"),
    "es_BO.dic": (702886, "c882b993a0ae83c94ab94c4b84a8f8300979e0e44fc4dceb2f15eaba521a30e7"),
    "es_CL.aff": (162395, "dc8213bb8fb08e51dd5869b348d873de23f89e3315656396ca3031fe1d7ffcea"),
    "es_CL.dic": (705568, "e249a50ed9c9b939801bd2ba12099c9decb59217782c59fc65e7f72831b0b401"),
    "es_CO.aff": (160081, "243d5dc50b68261dd10118799724beb95a6c19d4f9d6848ebfc977430bf2f8e2"),
    "es_CO.dic": (751422, "10f5e38e1c6898194cd860c237b1569725f721eb5eb0705e3a7158c69652c226"),
    "es_CR.aff": (162395, "dc8213bb8fb08e51dd5869b348d873de23f89e3315656396ca3031fe1d7ffcea"),
    "es_CR.dic": (700936, "073b27663394a297eb1c896419b5b5518bd5b345acfe244d00968433ad9709bd"),
    "es_DO.aff": (162395, "dc8213bb8fb08e51dd5869b348d873de23f89e3315656396ca3031fe1d7ffcea"),
    "es_DO.dic": (699651, "194293e1785b2a0ce9b8166cdc4164afebc1ef57db92305786b32350fcb13832"),
    "es_EC.aff": (162395, "dc8213bb8fb08e51dd5869b348d873de23f89e3315656396ca3031fe1d7ffcea"),
    "es_EC.dic": (701539, "caeea1b6bb09c80ca1ff36c81a02ca868fe709f330ac4303806cbf1cd7a6bc0b"),
    "es_GT.aff": (162395, "2cdfcb8d86b70090b3f23f2fe2b6d9d6cfa5f76c803fa8229c674af2b87e6adc"),
    "es_GT.dic": (700565, "f424e3546db88d36b38bbc735fd01126296a4f7500ca1368d7017fac561107e7"),
    "es_HN.aff": (162395, "dc8213bb8fb08e51dd5869b348d873de23f89e3315656396ca3031fe1d7ffcea"),
    "es_HN.dic": (702581, "a1fa7c74a68cb4e7746bae221dd53a27467c320a1cdc2d712cf55926896ee28d"),
    "es_MX.aff": (160081, "d966cb748e4a688ed75ec84b50c0835ac438e5325ee4fce703a093794f9cba7e"),
    "es_MX.dic": (723507, "44ce35af220962c68f97962776639bef271f7d90a85ba924b539a36e33315f82"),
    "es_NI.aff": (162395, "dc8213bb8fb08e51dd5869b348d873de23f89e3315656396ca3031fe1d7ffcea"),
    "es_NI.dic": (701487, "4d7ecc54d369aab904733e64729fffa42413412e14e6a27a32f7fbd56e9161b9"),
    "es_PA.aff": (162395, "dc8213bb8fb08e51dd5869b348d873de23f89e3315656396ca3031fe1d7ffcea"),
    "es_PA.dic": (700221, "bd87e7e25b776d8fe96c4197360909b41d45289ec91c7c47eb000948c04a3ae2"),
    "es_PE.aff": (160081, "d966cb748e4a688ed75ec84b50c0835ac438e5325ee4fce703a093794f9cba7e"),
    "es_PE.dic": (715404, "1d810a0a319fee329000538cf4df76621bb71228172558b87490f8b9c19b9d75"),
    "es_PR.aff": (162395, "dc8213bb8fb08e51dd5869b348d873de23f89e3315656396ca3031fe1d7ffcea"),
    "es_PR.dic": (699760, "11e0815f41a25aac5d6871a13767b1c14a1c6ad5a7c40b359fc4c22f8297ff7f"),
    "es_PY.aff": (162395, "dc8213bb8fb08e51dd5869b348d873de23f89e3315656396ca3031fe1d7ffcea"),
    "es_PY.dic": (700375, "f9a18929f9e5234bc4aba83df1744351156932cb47b77b2ed3358c3170bb41ff"),
    "es_SV.aff": (162395, "dc8213bb8fb08e51dd5869b348d873de23f89e3315656396ca3031fe1d7ffcea"),
    "es_SV.dic": (700941, "3a015f4469046d37806bf374c4d88149cdf570f467a60732f50d736f23d9cac5"),
    "es_US.aff": (171524, "674c5a4b4d39fd3b4452f045a4e6e0649db4a2ce23f5903df8c311e21f1a757c"),
    "es_US.dic": (696235, "d46932a5c0ec3881fdf265333df4de45a73de51741baedcb5bb54d37b03979c8"),
    "es_UY.aff": (162371, "d7ace3a7ef1fdf6dc89701d37f109730c0bc19aeaeda0ecf59fc67a1c5c28232"),
    "es_UY.dic": (702491, "9f05b75265a78bcd394993b7fee5f9f0e4031c41ce8915828c6fce8ee6579e13"),
    "es_VE.aff": (160081, "d966cb748e4a688ed75ec84b50c0835ac438e5325ee4fce703a093794f9cba7e"),
    "es_VE.dic": (704472, "57eb3aa695c24e1f8f469ac86367b952194c08ee25bc2b761ba4681686ccc723"),
    # La licencia (triple, a elegir) y la autoría.
    "LICENSE.md": (991, "2b70fd5cb8d3b34cc6ae322c969557a2270b99017594addb2531ef5ffd9e1b17"),
    "GPLv3.txt": (35147, "8ceb4b9ee5adedde47b31e975c1d90c73ad27b6b165a1dcd80c7c545eb65b903"),
    "LGPLv3.txt": (7639, "a853c2ffec17057872340eee242ae4d96cbf2b520ae27d903e1b2fef1a5f9d1c"),
    "MPL-1.1.txt": (25755, "53692a2ed6c6a2c6ec9b32dd0b820dfae91e0a1fcdf625ca9ed0bdf8705fcc4f"),
    "README_hunspell_es.txt": (2615, "0b5c39a863ecb61f5c5631ec1cd977667ef9bda6da6f90e80e9fc0edcbfadd97"),
}


def target(name: str) -> Path:
    """Cada diccionario en su carpeta (es_MX/es_MX.aff, como los pide el corrector); lo demás, al lado."""
    stem, _, suffix = name.partition(".")
    return DEST / stem / name if suffix in ("aff", "dic") else DEST / name


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


class NoRedirect(urllib.request.HTTPRedirectHandler):
    """Sin redirecciones: la descarga solo puede venir de la dirección fijada arriba."""

    def redirect_request(self, *args, **kwargs):  # noqa: ANN002, ANN003
        return None


def fetch(opener: urllib.request.OpenerDirector, name: str) -> str:
    size, sha = FILES[name]
    out = target(name)
    if out.is_file() and out.stat().st_size == size and sha256_of(out) == sha:
        return "ya estaba"
    out.parent.mkdir(parents=True, exist_ok=True)
    part = out.with_name(out.name + ".part")
    try:
        request = urllib.request.Request(BASE + name, headers={"User-Agent": "Molino build"})
        with opener.open(request, timeout=120) as response, open(part, "wb") as dst:
            if response.status != 200:
                raise SystemExit(f"{name}: respuesta HTTP {response.status}")
            total = 0
            while chunk := response.read(1 << 16):
                total += len(chunk)
                if total > size:
                    raise SystemExit(f"{name}: la descarga supera el tamaño esperado")
                dst.write(chunk)
        if part.stat().st_size != size or sha256_of(part) != sha:
            raise SystemExit(f"{name}: no coincide con el tamaño o la huella fijados")
        part.replace(out)
    finally:
        part.unlink(missing_ok=True)
    return "descargado"


def main() -> int:
    assert {f"es_{v}.{e}" for v in VARIANTS for e in ("aff", "dic")} <= FILES.keys()
    opener = urllib.request.build_opener(NoRedirect)
    for name in FILES:
        print(f"{fetch(opener, name):10} {name}", flush=True)
    print(f"Diccionarios listos en {DEST}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
