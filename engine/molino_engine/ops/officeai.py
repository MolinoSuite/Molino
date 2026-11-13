"""IA local en Documentos, Hojas y Presentaciones.

La misma IA que en los PDF (ops/ai.py: el mismo proceso, las mismas defensas),
con el texto que la interfaz saca del editor: el documento entero, lo
seleccionado, los encabezados de una hoja o una diapositiva. Nada de esto
cambia el documento: la interfaz decide donde poner el resultado (y se puede
deshacer como cualquier otro cambio).
"""

from __future__ import annotations

import hashlib
import re
from array import array
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from .. import ai_prompts
from ..errors import EngineError
from ..i18n import _, language
from ..models import Params
from ..server import Ctx, method
from .ai import ASK_CONTEXT, ASK_CONTEXT_CPU, SMALL_DOC, SUMMARY_CPU, SUMMARY_PART, MAX_SUMMARY_PARTS, _chunks, _dot, _embed, _generate, _gpu, _keyword_rank
from .office import OfficeDocId, _doc

Kind = Literal["word", "cell", "slide"]
LongText = Annotated[str, StringConstraints(min_length=1, max_length=400_000)]
Snippet = Annotated[str, StringConstraints(min_length=1, max_length=8_000)]
Short = Annotated[str, StringConstraints(min_length=1, max_length=2_000)]
CellRef = Annotated[str, StringConstraints(pattern=r"^[A-Z]{1,3}[0-9]{1,7}$")]


class OfficeAiParams(Params):
    doc: OfficeDocId


def _clean(text: str, lang: str) -> tuple[str, int]:
    """Sin las frases que parecen ordenes para una IA (ver ai_prompts)."""
    return ai_prompts.filter_injections(text, lang)


def _tag(ctx: Ctx, doc: str) -> str:
    """Un codigo de marcas por documento abierto: el proceso de IA puede reutilizar lo leido."""
    item = _doc(ctx, doc)
    tag = getattr(item, "_ai_tag", None)
    if tag is None:
        tag = ai_prompts.new_tag()
        item._ai_tag = tag  # type: ignore[attr-defined]
    return tag


def _parts(text: str, size: int) -> list[str]:
    """Partes seguidas de unos ``size`` caracteres, cortadas entre parrafos si se puede."""
    out: list[str] = []
    rest = text.strip()
    while rest:
        if len(rest) <= size:
            out.append(rest)
            break
        cut = rest.rfind("\n", size // 2, size)
        cut = cut if cut > 0 else size
        out.append(rest[:cut].strip())
        rest = rest[cut:].strip()
    return [p for p in out if p]


def _pages(text: str) -> list[tuple[str, int, str]]:
    """El texto como «paginas» de ops/ai.py (para trocearlo igual)."""
    return [("t", n, part) for n, part in enumerate(_parts(text, 3_000), start=1)]


# ------------------------------------------------------- escribir y reescribir


class TransformParams(OfficeAiParams):
    text: Snippet
    action: Literal["translate", "rewrite", "formal", "simple", "shorter", "fix"]
    target: Literal["es", "en"] = "en"


@method("ai.officeTransform", TransformParams)
def office_transform(ctx: Ctx, p: TransformParams) -> dict[str, Any]:
    """Lo seleccionado: traducirlo, reescribirlo (mas claro, formal, sencillo, corto) o corregirlo."""
    _doc(ctx, p.doc)
    lang = language()
    clean, hits = _clean(p.text, lang)
    text = _generate(ctx, ai_prompts.transform(lang, p.action, clean, p.target), max_tokens=min(2048, 200 + len(p.text) // 2),
                     watermark=p.action in ai_prompts.WATERMARKED, message=_("Escribiendo…"))
    return {"text": text, "injection": hits, "marked": p.action in ai_prompts.WATERMARKED}


class WriteParams(OfficeAiParams):
    mode: Literal["draft", "continue"]
    idea: Short | None = None
    text: Snippet | None = None
    length: Literal["short", "long"] = "short"


@method("ai.officeWrite", WriteParams)
def office_write(ctx: Ctx, p: WriteParams) -> dict[str, Any]:
    """Redactar a partir de una idea o continuar lo que hay antes del cursor."""
    _doc(ctx, p.doc)
    lang = language()
    if p.mode == "draft":
        if not p.idea:
            raise EngineError("invalid_params", _("Falta la idea."))
        idea, hits = _clean(p.idea, lang)
        messages = ai_prompts.office_draft(lang, idea, p.length)
        limit = 900 if p.length == "long" else 350
    else:
        if not p.text:
            raise EngineError("invalid_params", _("Falta el texto."))
        clean, hits = _clean(p.text[-4_000:], lang)
        messages = ai_prompts.office_continue(lang, clean)
        limit = 350
    text = _generate(ctx, messages, max_tokens=limit, watermark=True, message=_("Escribiendo…"))
    return {"text": text, "injection": hits, "marked": True}


# ------------------------------------------------------- resumir y preguntar


class SummaryParams(OfficeAiParams):
    kind: Kind
    text: LongText
    length: Literal["short", "long"] = "short"


@method("ai.officeSummarize", SummaryParams)
def office_summarize(ctx: Ctx, p: SummaryParams) -> dict[str, Any]:
    _doc(ctx, p.doc)
    lang = language()
    text = re.sub(r"[ \t]+", " ", p.text).strip()
    if not text:
        return {"text": _("El documento no tiene texto que la IA pueda leer."), "injection": 0}
    parts = _parts(text, SUMMARY_PART)
    hits = 0
    if len(parts) > 1 and not _gpu(ctx):
        # Sin grafica: unas frases repartidas por todo el documento, en una pasada.
        chunks = _chunks(_pages(text))
        step = max(1, len(chunks) * 400 // SUMMARY_CPU)
        parts = [" ".join(c[2] for c in chunks[::step])[:SUMMARY_CPU]]
    parts = parts[:MAX_SUMMARY_PARTS]
    if len(parts) == 1:
        clean, hits = _clean(parts[0], lang)
        tag = _tag(ctx, p.doc)
        out = _generate(ctx, ai_prompts.office_summary(lang, p.kind, clean, p.length, tag), max_tokens=900 if p.length == "long" else 450,
                        watermark=True, message=_("Resumiendo…"), reuse=ai_prompts.doc_end(tag))
    else:
        summaries: list[str] = []
        for n, part in enumerate(parts):
            clean, found = _clean(part, lang)
            hits += found
            summaries.append(_generate(ctx, ai_prompts.office_summary(lang, p.kind, clean, "part", ai_prompts.new_tag()), max_tokens=350,
                                       watermark=False, message=_("Resumiendo…"), stream=False, done=n, total=len(parts) + 1))
        out = _generate(ctx, ai_prompts.office_merge(lang, p.kind, summaries), max_tokens=900 if p.length == "long" else 500,
                        watermark=True, message=_("Uniendo el resumen…"), done=len(parts), total=len(parts) + 1)
    out, _cited, _removed = ai_prompts.check_citations(out, set())
    return {"text": out, "injection": hits}


class AskParams(OfficeAiParams):
    kind: Kind
    text: LongText
    question: Short


def _ranked(ctx: Ctx, doc: str, text: str, question: str) -> list[tuple[str, int, str]]:
    """Los trozos del documento mas parecidos a la pregunta (con vectores si hay modelo)."""
    chunks = _chunks(_pages(text))
    try:
        item = _doc(ctx, doc)
        digest = hashlib.sha256(text.encode("utf-8", "replace")).hexdigest()
        cached = getattr(item, "_ai_index", None)
        if cached is not None and cached[0] == digest:
            vectors: list[array] = cached[1]
        else:
            vectors = _embed(ctx, [c[2] for c in chunks])
            item._ai_index = (digest, vectors)  # type: ignore[attr-defined]
        query = _embed(ctx, [question])[0]
        order = sorted(range(len(chunks)), key=lambda i: _dot(vectors[i], query), reverse=True)
    except EngineError as exc:
        if exc.code != "ai_unavailable":
            raise
        order = _keyword_rank(chunks, question) or list(range(len(chunks)))
    return [chunks[i] for i in order]


@method("ai.officeAsk", AskParams)
def office_ask(ctx: Ctx, p: AskParams) -> dict[str, Any]:
    _doc(ctx, p.doc)
    lang = language()
    text = re.sub(r"[ \t]+", " ", p.text).strip()
    if not text:
        return {"text": _("El documento no tiene texto que la IA pueda leer."), "injection": 0}
    if len(text) > SMALL_DOC:
        budget = ASK_CONTEXT if _gpu(ctx) else ASK_CONTEXT_CPU
        picked: list[str] = []
        used = 0
        for _pid, _n, chunk in _ranked(ctx, p.doc, text, p.question):
            if used + len(chunk) > budget:
                break
            picked.append(chunk)
            used += len(chunk)
        text = "\n".join(picked)
    clean, hits = _clean(text, lang)
    tag = _tag(ctx, p.doc)
    out = _generate(ctx, ai_prompts.office_ask(lang, p.kind, clean, p.question, tag), max_tokens=700, watermark=True,
                    message=_("Pensando…"), reuse=ai_prompts.doc_end(tag))
    out, _cited, _removed = ai_prompts.check_citations(out, set())
    return {"text": out, "injection": hits}


# ---------------------------------------------------------------------- Hojas


class Column(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    letter: Annotated[str, StringConstraints(pattern=r"^[A-Z]{1,3}$")]
    name: Annotated[str, StringConstraints(max_length=120)]


class FormulaParams(OfficeAiParams):
    request: Annotated[str, StringConstraints(min_length=1, max_length=500)]
    columns: list[Column] = Field(default_factory=list, max_length=60)
    first: int = Field(ge=1, le=1_048_576)
    last: int = Field(ge=1, le=1_048_576)
    cell: CellRef


@method("ai.formula", FormulaParams)
def ai_formula(ctx: Ctx, p: FormulaParams) -> dict[str, Any]:
    """Una formula a partir de lo que se pide, con los encabezados de la hoja.

    Solo se devuelve si tiene forma de formula; la interfaz la comprueba en el
    editor (que existan las funciones) antes de ponerla.
    """
    _doc(ctx, p.doc)
    lang = language()
    request, hits = _clean(p.request, lang)
    columns = [(c.letter, _clean(c.name, lang)[0]) for c in p.columns]
    out = _generate(ctx, ai_prompts.formula(lang, columns, p.first, max(p.first, p.last), p.cell, request), max_tokens=200,
                    watermark=False, message=_("Pensando…"), stream=False)
    found = ai_prompts.pick_formula(out)
    if not found:
        raise EngineError("ai_failed", _("La IA no ha dado una fórmula. Prueba a pedirlo de otra manera."))
    return {"formula": found, "injection": hits}


class ExplainParams(OfficeAiParams):
    formula: Annotated[str, StringConstraints(min_length=2, max_length=2_000, pattern=r"^=")]


@method("ai.explainFormula", ExplainParams)
def ai_explain_formula(ctx: Ctx, p: ExplainParams) -> dict[str, Any]:
    _doc(ctx, p.doc)
    lang = language()
    formula, hits = _clean(p.formula, lang)
    out = _generate(ctx, ai_prompts.explain_formula(lang, formula), max_tokens=250, watermark=True, message=_("Pensando…"))
    return {"text": out, "injection": hits}


class DataParams(OfficeAiParams):
    csv: Annotated[str, StringConstraints(min_length=1, max_length=20_000)]


@method("ai.dataSummary", DataParams)
def ai_data_summary(ctx: Ctx, p: DataParams) -> dict[str, Any]:
    _doc(ctx, p.doc)
    lang = language()
    csv, hits = _clean(p.csv, lang)
    out = _generate(ctx, ai_prompts.data_summary(lang, csv), max_tokens=450, watermark=True, message=_("Pensando…"))
    return {"text": out, "injection": hits}


# ------------------------------------------------------------- Presentaciones


class SlidesParams(OfficeAiParams):
    text: Snippet
    count: int = Field(default=5, ge=3, le=ai_prompts.MAX_SLIDES)


@method("ai.slides", SlidesParams)
def ai_slides(ctx: Ctx, p: SlidesParams) -> dict[str, Any]:
    """Un esquema de diapositivas (titulo y puntos) a partir de un tema, un esquema o un texto."""
    _doc(ctx, p.doc)
    lang = language()
    clean, hits = _clean(p.text, lang)
    out = _generate(ctx, ai_prompts.slides(lang, clean, p.count), max_tokens=min(2000, 160 * p.count + 200), watermark=True,
                    message=_("Preparando las diapositivas…"))
    slides = ai_prompts.parse_slides(out)
    if not slides:
        raise EngineError("ai_failed", _("La IA no ha preparado ninguna diapositiva. Prueba con otro texto."))
    return {"slides": slides, "injection": hits, "marked": True}


class NotesParams(OfficeAiParams):
    text: Annotated[str, StringConstraints(min_length=1, max_length=4_000)]


@method("ai.notes", NotesParams)
def ai_notes(ctx: Ctx, p: NotesParams) -> dict[str, Any]:
    _doc(ctx, p.doc)
    lang = language()
    clean, hits = _clean(p.text, lang)
    out = _generate(ctx, ai_prompts.notes(lang, clean), max_tokens=350, watermark=True, message=_("Escribiendo…"))
    return {"text": out, "injection": hits, "marked": True}
