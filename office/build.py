"""Arma el motor de oficina de Molino (Documentos, Hojas y Presentaciones).

Parte de la versión oficial de ONLYOFFICE Desktop Editors y deja solo lo que
Molino usa, con sus cambios:

1. La portable oficial (office/source.json: dirección, tamaño y SHA-256 fijos)
   se descarga a una caché fuera del repositorio, o se usa una copia ya
   descargada si su huella coincide (``--source``).
2. Se extraen los editores (sin los de PDF y Visio: de eso se encarga Molino
   PDF), el conversor, los diccionarios de los idiomas cercanos y las fuentes del
   motor. Nada del navegador ni de Qt de la app de escritorio de ONLYOFFICE.
3. Se comprueba la firma de Ascensio System SIA en los .exe y .dll del conversor.
4. Se aplican los cambios de Molino (office/patches.py) y se regenera la versión
   precompilada de cada app cambiada (``x2t -create-js-snapshots``): x2t lee
   esa, no el JavaScript.
5. Se añaden las licencias (office/licenses) y el aviso de modificación que piden
   los términos del §7 de la licencia de ONLYOFFICE.
6. Todo se comprime en dist-office/MolinoOffice-<versión>.zip, con orden y fechas
   fijos, y se escribe al lado su ficha (tamaño y SHA-256) para el catálogo de
   Molino. Dos armados dan los mismos archivos salvo la versión precompilada
   regenerada (V8 no la genera igual dos veces), así que la huella del zip cambia:
   la que vale es la del zip publicado. Por eso, si el zip de esta versión ya
   existe, no se rehace (``--rehacer`` para hacerlo igualmente): su huella es la
   que lleva Molino (src/main/office.ts).

  engine\\.venv\\Scripts\\python.exe -I office\\build.py [--source <DesktopEditors_x64.zip>] [--rehacer]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
import urllib.request
import zipfile
from pathlib import Path, PurePosixPath

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
sys.path.insert(0, str(HERE))
import patches  # noqa: E402

SOURCE = json.loads((HERE / "source.json").read_text(encoding="utf-8"))
VERSION = SOURCE["piece"]
NAME = f"MolinoOffice-{VERSION}"
# Lo que se deja fuera de lo extraído.
LEFT_OUT = (
    "editors/sdkjs/pdf/",
    "editors/sdkjs/visio/",
    "editors/web-apps/apps/pdfeditor/",
    "editors/web-apps/apps/visioeditor/",
)
TAKEN = ("editors/", "converter/", "fonts/")
FIXED_TIME = tuple(int(x) for x in SOURCE["modified"].split("-")) + (0, 0, 0)


def log(*parts: object) -> None:
    print(*parts, flush=True)


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def fetch(cache: Path, local: Path | None) -> Path:
    """La portable oficial, comprobada por tamaño y huella."""
    for candidate in (local, cache / "DesktopEditors_x64.zip"):
        if candidate and candidate.is_file() and candidate.stat().st_size == SOURCE["size"]:
            if sha256_of(candidate) == SOURCE["sha256"]:
                log("origen:", candidate)
                return candidate
            log("no coincide la huella, se descarta:", candidate)
    target = cache / "DesktopEditors_x64.zip"
    part = target.with_suffix(".part")
    cache.mkdir(parents=True, exist_ok=True)
    log("descargando", SOURCE["url"])
    request = urllib.request.Request(SOURCE["url"], headers={"User-Agent": "Molino office build"})
    with urllib.request.urlopen(request, timeout=120) as response, open(part, "wb") as out:
        shutil.copyfileobj(response, out, 1 << 20)
    if part.stat().st_size != SOURCE["size"] or sha256_of(part) != SOURCE["sha256"]:
        part.unlink()
        raise SystemExit("la descarga no coincide con office/source.json (tamaño o huella)")
    part.replace(target)
    return target


def wanted(name: str) -> bool:
    if name.endswith("/") or name.startswith(LEFT_OUT):
        return False
    if name.startswith("dictionaries/"):
        parts = name.split("/")
        return len(parts) > 2 and parts[1] in SOURCE["dictionaries"]
    return name.startswith(TAKEN)


def extract(archive: Path, dest: Path) -> int:
    count = 0
    with zipfile.ZipFile(archive) as z:
        for info in z.infolist():
            name = info.filename
            path = PurePosixPath(name)
            # El archivo viene comprobado por su huella, pero ninguna ruta sale de la carpeta.
            if path.is_absolute() or ".." in path.parts or "\\" in name or ":" in name:
                raise SystemExit(f"ruta no admitida en el archivo: {name!r}")
            if not wanted(name):
                continue
            out = dest.joinpath(*path.parts)
            out.parent.mkdir(parents=True, exist_ok=True)
            with z.open(info) as src, open(out, "wb") as dst:
                shutil.copyfileobj(src, dst, 1 << 20)
            count += 1
    return count


def check_signatures(dest: Path) -> int:
    """Todos los .exe y .dll del conversor, firmados por Ascensio System SIA y válidos."""
    folder = str(dest / "converter").replace("'", "''")  # literal de PowerShell entre comillas simples
    script = (
        f"Get-ChildItem -LiteralPath '{folder}' -Recurse -File | Where-Object {{ $_.Extension -in '.exe','.dll' }} | "
        "ForEach-Object { $s = Get-AuthenticodeSignature -LiteralPath $_.FullName; "
        "'{0}|{1}|{2}' -f $_.Name, $s.Status, $s.SignerCertificate.Subject }"
    )
    run = subprocess.run(
        ["powershell", "-NoProfile", "-NonInteractive", "-Command", script],
        capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=300,
    )
    rows = [line.split("|", 2) for line in run.stdout.splitlines() if line.count("|") >= 2]
    bad = [r[0] for r in rows if r[1] != "Valid" or "Ascensio System SIA" not in r[2]]
    if not rows or bad:
        raise SystemExit(f"firmas no válidas en el conversor: {bad or 'ninguna leída'}")
    return len(rows)


def snapshots(dest: Path, apps: set[str]) -> None:
    """Regenera la versión precompilada de las apps cambiadas; las demás, como vienen."""
    sdkjs = dest / "editors" / "sdkjs"
    before = {b.parent.name: b.read_bytes() for b in sdkjs.glob("*/sdk-all.bin")}
    run = subprocess.run(
        [str(dest / "converter" / "x2t.exe"), "-create-js-snapshots"],
        cwd=dest / "converter", capture_output=True, timeout=600,
    )
    for app, data in before.items():
        if app not in apps:
            (sdkjs / app / "sdk-all.bin").write_bytes(data)
    if run.returncode != 0:
        raise SystemExit(f"x2t -create-js-snapshots terminó con {run.returncode}")
    for app in apps:
        if (sdkjs / app / "sdk-all.bin").read_bytes() == before.get(app):
            raise SystemExit(f"la versión precompilada de {app} no cambió: el parche no llegaría a x2t")
    stray = sorted(p.name for p in sdkjs.glob("*/sdk-all.bin") if p.parent.name not in before)
    if stray:
        raise SystemExit(f"x2t creó versiones precompiladas inesperadas: {stray}")


NOTICE_ES = """Motor de oficina de Molino {version}

Es una versión modificada de ONLYOFFICE Desktop Editors {onlyoffice}, basada en el
software ONLYOFFICE original desarrollado por Ascensio System SIA. La modificó
CuevasTech para Molino el {modified}.

Qué se ha cambiado:
- Se han quitado la aplicación de escritorio de ONLYOFFICE (su navegador y Qt),
  los editores de PDF y de Visio y los diccionarios de los idiomas que no se
  incluyen. Lo demás de editors, converter, dictionaries y fonts va como viene.
{changes}
Licencia: GNU Affero General Public License v3 con los términos adicionales del
§7 de ONLYOFFICE (licenses/ONLYOFFICE-LICENSE.txt). Componentes de terceros:
licenses/3DPARTY-*.md.

Código fuente: el original, {source_code}; los cambios y cómo se arma este motor,
https://github.com/MolinoSuite/Molino/tree/main/office

ONLYOFFICE es una marca de Ascensio System SIA. Esta licencia no concede ningún
derecho sobre ella.
"""

NOTICE_EN = """Molino office engine {version}

This is a modified version of ONLYOFFICE Desktop Editors {onlyoffice}, based on the
original ONLYOFFICE software developed by Ascensio System SIA. Modified by
CuevasTech for Molino on {modified}.

What has been changed:
- The ONLYOFFICE desktop application (its browser and Qt), the PDF and Visio
  editors and the dictionaries of languages not included have been removed. The
  rest of editors, converter, dictionaries and fonts is unchanged.
{changes}
License: GNU Affero General Public License v3 with ONLYOFFICE's additional terms
under section 7 (licenses/ONLYOFFICE-LICENSE.txt). Third-party components:
licenses/3DPARTY-*.md.

Source code: the original, {source_code}; the changes and how this engine is
built, https://github.com/MolinoSuite/Molino/tree/main/office

ONLYOFFICE is a trademark of Ascensio System SIA. This license grants no rights
to it.
"""


def notices(dest: Path) -> None:
    (dest / "licenses").mkdir(exist_ok=True)
    for f in sorted((HERE / "licenses").iterdir()):
        shutil.copyfile(f, dest / "licenses" / f.name)
    fields = {
        "version": VERSION,
        "onlyoffice": SOURCE["onlyoffice"],
        "modified": SOURCE["modified"],
        "source_code": SOURCE["sourceCode"],
    }
    changes_es = "".join(f"- {p['file']}: {p['why']}\n" for p in patches.PATCHES)
    changes_en = "".join(f"- {p['file']} ({p['name']}).\n" for p in patches.PATCHES)
    (dest / "MOLINO-NOTICE.es.txt").write_text(NOTICE_ES.format(changes=changes_es, **fields), encoding="utf-8")
    (dest / "MOLINO-NOTICE.en.txt").write_text(NOTICE_EN.format(changes=changes_en, **fields), encoding="utf-8")
    manifest = {
        "piece": "office",
        "version": VERSION,
        "onlyoffice": SOURCE["onlyoffice"],
        "sourceSha256": SOURCE["sha256"],
        "patches": [p["name"] for p in patches.PATCHES],
        "dictionaries": SOURCE["dictionaries"],
    }
    (dest / "manifest.json").write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")


def pack(dest: Path, archive: Path) -> None:
    part = archive.with_suffix(".part")
    files = sorted(p for p in dest.rglob("*") if p.is_file())
    with zipfile.ZipFile(part, "w") as z:
        for f in files:
            info = zipfile.ZipInfo(f.relative_to(dest).as_posix(), date_time=FIXED_TIME)
            info.external_attr = 0o644 << 16
            z.writestr(info, f.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    part.replace(archive)


def main() -> None:
    ap = argparse.ArgumentParser(description="Arma el motor de oficina de Molino.")
    ap.add_argument("--source", type=Path, help="DesktopEditors_x64.zip ya descargada (se comprueba su huella)")
    ap.add_argument("--cache", type=Path, default=REPO / "build-cache" / "office")
    ap.add_argument("--rehacer", action="store_true", help="rehacer el zip aunque ya exista (cambiará su huella)")
    a = ap.parse_args()

    out_dir = REPO / "dist-office"
    if (out_dir / f"{NAME}.zip").exists() and not a.rehacer:
        sys.exit(f"{NAME}.zip ya existe y su huella es la que lleva Molino: no se rehace (--rehacer para hacerlo igualmente).")
    work = out_dir / NAME
    if work.exists():
        shutil.rmtree(work)
    work.mkdir(parents=True)
    archive = fetch(a.cache, a.source)
    log("extraídos", extract(archive, work), "archivos")
    log("firmas del conversor válidas:", check_signatures(work))
    apps = patches.apply(work)
    log("cambios aplicados:", ", ".join(p["name"] for p in patches.PATCHES))
    snapshots(work, apps)
    log("precompiladas regeneradas:", ", ".join(sorted(apps)))
    notices(work)
    zipped = out_dir / f"{NAME}.zip"
    pack(work, zipped)
    card = {
        "version": VERSION,
        "file": zipped.name,
        "size": zipped.stat().st_size,
        "sha256": sha256_of(zipped),
        "unpacked": sum(p.stat().st_size for p in work.rglob("*") if p.is_file()),
        "files": sum(1 for p in work.rglob("*") if p.is_file()),
    }
    (out_dir / f"{NAME}.json").write_text(json.dumps(card, indent=1) + "\n", encoding="utf-8")
    log(json.dumps(card, indent=1))


if __name__ == "__main__":
    main()
