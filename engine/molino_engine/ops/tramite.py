"""«Comprobar para un tramite»: si el PDF abierto esta listo para presentarlo en una sede electronica.

Revisa el documento tal como esta ahora (con lo que no se haya guardado) y
devuelve hechos, no textos: la interfaz los cuenta (src/shared/i18n/*/sign.ts)
y ofrece la herramienta que arregla cada cosa cuando la hay.

* Firmas: las de ``sign.validate`` (firma valida, documento sin cambios
  despues de firmar, sello de tiempo, quien firma y si su certificado ha
  caducado). Sin red salvo que se pida ``online`` (revocacion).
* PDF/A: si lo declara y lo basico que se puede comprobar (pdfcheck.py). No es
  una validacion completa de la norma.
* Letras sin incrustar, cifrado o contrasena, guiones (JavaScript) y adjuntos.
* Tamano: un aviso orientativo a partir de ``LARGE_FILE``. No hay un limite
  oficial unico: cada sede pone el suyo (o ninguno).
* Nombre del archivo: lo que puede dar problemas al subirlo (tildes, espacios,
  signos…) y una propuesta sin eso.

Cada comprobacion tiene un nivel: ``ok``, ``info`` (para saberlo; no impide
nada), ``warning`` (conviene revisarlo) y ``error`` (asi no se puede
presentar). El veredicto sale del peor: ``ready``, ``review`` o ``notReady``.
"""

from __future__ import annotations

import logging
from typing import Any, Callable

from .. import pdfcheck, redaction
from ..errors import EngineError
from ..i18n import _
from ..models import DocParams
from ..server import Ctx, method
from .signing import signature_report

log = logging.getLogger("molino.engine.ops.tramite")

LARGE_FILE = 10 * 1024**2  # aviso orientativo (ver arriba)
_RANK = {"ok": 0, "info": 0, "warning": 1, "error": 2}
_VERDICT = {0: "ready", 1: "review", 2: "notReady"}


class TramiteParams(DocParams):
    # Consultar en linea si los certificados de las firmas siguen en vigor.
    online: bool = False


def _signatures_check(entries: list[dict[str, Any]]) -> dict[str, Any]:
    """El resumen de las firmas (las de ``signature_report``) como una comprobacion mas."""
    signatures = [e for e in entries if e.get("type") == "signature"]
    data = {
        "count": len(signatures),
        "valid": sum(1 for e in signatures if e.get("summary") == "valid"),
        "timestamped": sum(1 for e in signatures if (e.get("timestamp") or {}).get("valid")),
        "untrusted": sum(1 for e in signatures if e.get("intact") and not e.get("trusted")),
        "modified": sum(1 for e in signatures if e.get("modification") in ("annotations", "other")),
        "expired": sum(1 for e in signatures if e.get("certExpired")),
    }
    if any(e.get("summary") in ("invalid", "unknown") for e in entries):
        level = "error"
    elif not signatures or any(e.get("summary") == "warning" for e in entries):
        level = "warning"
    else:
        level = "ok"
    return {"id": "signatures", "level": level, **data}


def _guarded(action: Callable[[], dict[str, Any]]) -> dict[str, Any]:
    """Ningun fallo inesperado sale con su texto: podria citar datos del PDF o de quien firma (A09:2025)."""
    try:
        return action()
    except (EngineError, MemoryError):
        raise
    except Exception as exc:  # noqa: BLE001
        log.error("fallo inesperado al comprobar el documento (%s)", type(exc).__name__)
        raise EngineError("internal", _("No se pudo comprobar el documento.")) from None


def _attachments(doc: Any) -> int:
    """Archivos adjuntos: los de la lista del documento y los que van en anotaciones de las paginas."""
    count = redaction.count_embedded_files(doc)
    for index in range(doc.page_count):
        count += sum(1 for _xref, kind, _id in doc.page_annot_xrefs(index) if kind == redaction.FILE_ATTACHMENT)
    return count


@method("tramite.check", TramiteParams)
def tramite_check(ctx: Ctx, p: TramiteParams) -> dict[str, Any]:
    """Comprueba si el documento esta listo para presentarlo y por que no."""
    session = ctx.engine.session(p.doc)

    def run() -> dict[str, Any]:
        ctx.progress(0, 0, _("Comprobando el documento…"))
        doc = session.doc
        data = session.current_bytes()
        checks: list[dict[str, Any]] = []

        # --- guardado: lo que se presenta es el archivo, no lo que hay en pantalla
        if session.source is None:
            checks.append({"id": "saved", "level": "warning", "state": "new"})
        elif session.dirty:
            checks.append({"id": "saved", "level": "warning", "state": "changes"})
        else:
            checks.append({"id": "saved", "level": "ok", "state": "saved"})

        # --- firmas
        entries = signature_report(ctx, session, p.online)
        checks.append(_signatures_check(entries))
        ctx.check_cancel()

        # --- cifrado y contrasena
        locked = pdfcheck.needs_password(data)
        if locked:
            checks.append({"id": "protection", "level": "error", "state": "password"})
        elif session.encrypted:
            checks.append({"id": "protection", "level": "warning", "state": "restricted"})
        else:
            checks.append({"id": "protection", "level": "ok", "state": "none"})

        # --- letras, guiones y adjuntos
        missing, names = pdfcheck.fonts_not_embedded(doc, ctx.check_cancel)
        scripts = redaction.count_scripts(doc, ctx.check_cancel)
        attachments = _attachments(doc)

        # --- PDF/A: lo que declara y lo basico que se puede comprobar
        claim = pdfcheck.pdfa_claim(doc)
        if claim is None:
            checks.append({"id": "pdfa", "level": "info", "version": None, "problems": []})
        else:
            problems = [
                problem
                for problem, present in (
                    ("outputIntent", not pdfcheck.has_output_intent(doc)),
                    ("fonts", missing > 0),
                    ("encrypted", session.encrypted or locked),
                    ("javascript", scripts > 0),
                )
                if present
            ]
            checks.append({"id": "pdfa", "level": "warning" if problems else "ok", "version": claim, "problems": problems})

        checks.append({"id": "fonts", "level": "warning" if missing else "ok", "count": missing, "names": names})
        checks.append({"id": "javascript", "level": "warning" if scripts else "ok", "count": scripts})
        checks.append({"id": "attachments", "level": "warning" if attachments else "ok", "count": attachments})

        # --- tamano: el del archivo guardado; con cambios, el de como quedaria ahora
        exact = not session.dirty and session.saved_size is not None
        size = session.saved_size if exact and session.saved_size is not None else len(data)
        checks.append({"id": "size", "level": "warning" if size > LARGE_FILE else "ok", "bytes": size, "exact": exact, "large": LARGE_FILE})

        # --- nombre del archivo
        issues, suggestion = pdfcheck.name_issues(session.name)
        checks.append({"id": "name", "level": "warning" if issues else "ok", "name": session.name, "issues": issues, "suggestion": suggestion})

        worst = max(_RANK[c["level"]] for c in checks)
        return {
            "verdict": _VERDICT[worst],
            "checks": checks,
            "signatures": entries,
            "pdfa": claim,
            "pages": len(session.page_ids),
            "online": p.online,
        }

    return _guarded(run)
