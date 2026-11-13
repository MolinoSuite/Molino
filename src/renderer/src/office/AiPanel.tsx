/**
 * La IA en Documentos, Hojas y Presentaciones: el panel del modo «IA».
 *
 * Es la IA local de Molino (Ajustes → IA), la misma que en los PDF: nada sale
 * del equipo. El resultado se ve primero aquí y solo entra en el documento al
 * pulsar «Reemplazar», «Insertar» o «Poner»; entonces es un cambio más del
 * editor (Ctrl+Z lo deshace). Lo generado lleva la nota «Generado con IA».
 */
import { Copy, Loader2, Settings2, Sparkles, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { OfficeAiMethod, OfficeKind } from '@shared/officeui'
import { Segmented } from '@/components/ui'
import type { EditorSession } from './engine'
import { fmt, L } from './i18n'

const A = L.office.ai
let nextCall = 1

export type AiTask =
  | 'rewrite'
  | 'summarize'
  | 'ask'
  | 'draft'
  | 'continue'
  | 'formula'
  | 'explain'
  | 'data'
  | 'slides'
  | 'notes'

/** Las tareas de cada app, en el orden de su cinta. */
export const AI_TASKS: Record<OfficeKind, AiTask[]> = {
  word: ['rewrite', 'summarize', 'ask', 'draft', 'continue'],
  cell: ['formula', 'explain', 'data'],
  slide: ['slides', 'rewrite', 'notes', 'summarize']
}

type Rewrite = 'rewrite' | 'formal' | 'simple' | 'shorter' | 'fix' | 'translate'
const REWRITES: Rewrite[] = ['rewrite', 'formal', 'simple', 'shorter', 'fix', 'translate']

interface Outcome {
  text: string
  /** Hojas: la fórmula propuesta (ya comprobada en el editor). */
  formula?: string
  /** Presentaciones: las diapositivas propuestas. */
  slides?: { title: string; bullets: string[] }[]
  marked: boolean
  injection: number
}

/** Una petición a la IA con su avance; se puede cancelar. */
function useAiCall() {
  const [busy, setBusy] = useState<{ call: number; message: string; text: string } | null>(null)
  useEffect(
    () =>
      window.molinoOffice.ai.onProgress((p) => {
        setBusy((b) => (b && b.call === p.call ? { call: b.call, message: p.message || b.message, text: p.text ?? b.text } : b))
      }),
    []
  )
  const run = async (doc: string, method: OfficeAiMethod, params: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const call = nextCall++
    setBusy({ call, message: A.working, text: '' })
    try {
      const reply = await window.molinoOffice.ai.run(call, doc, method, params)
      if (reply.error) throw new Error(reply.error.code === 'cancelled' ? '' : reply.error.message)
      return reply.result ?? {}
    } finally {
      setBusy(null)
    }
  }
  const cancel = (): void => {
    if (busy) window.molinoOffice.ai.cancel(busy.call)
  }
  return { busy, run, cancel }
}

export function AiPanel({
  kind,
  doc,
  session,
  task,
  setTask,
  onSettings
}: {
  kind: OfficeKind
  doc: string
  session: EditorSession
  task: AiTask
  setTask: (task: AiTask) => void
  /** Abre Ajustes → IA en esta misma app. */
  onSettings: () => void
}) {
  const [status, setStatus] = useState<{ on: boolean; ready: boolean } | null>(null)
  const [input, setInput] = useState('')
  const [rewrite, setRewrite] = useState<Rewrite>('rewrite')
  const [length, setLength] = useState<'short' | 'long'>('short')
  const [count, setCount] = useState('5')
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [error, setError] = useState('')
  const { busy, run, cancel } = useAiCall()
  const box = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    void window.molinoOffice.ai.status().then(setStatus)
    const again = (): void => void window.molinoOffice.ai.status().then(setStatus)
    window.addEventListener('focus', again)
    return () => window.removeEventListener('focus', again)
  }, [])
  // Otra tarea: se empieza de cero.
  useEffect(() => {
    setOutcome(null)
    setError('')
    setInput('')
  }, [task])

  if (status && !status.ready) {
    return (
      <aside className="office-panel office-ai" aria-label={A.title}>
        <section>
          <h3>
            <Sparkles size={14} /> {A.title}
          </h3>
          <p className="hint">{status.on ? A.notReady : A.off}</p>
          <button className="btn sm" onClick={onSettings}>
            <Settings2 size={14} />
            {A.openSettings}
          </button>
        </section>
      </aside>
    )
  }

  const go = async (): Promise<void> => {
    setError('')
    setOutcome(null)
    try {
      setOutcome(await perform())
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      if (message) setError(message)
    }
  }

  const perform = async (): Promise<Outcome | null> => {
    const marked = (r: Record<string, unknown>): boolean => r.marked !== false
    const injection = (r: Record<string, unknown>): number => (typeof r.injection === 'number' ? r.injection : 0)
    const text = (r: Record<string, unknown>): string => (typeof r.text === 'string' ? r.text : '')
    if (task === 'rewrite') {
      const selected = session.selectedText().trim()
      if (!selected) throw new Error(A.needSelection)
      const target = L.office.ai.translateTo === 'en' ? 'en' : 'es'
      const r = await run(doc, 'ai.officeTransform', { text: selected.slice(0, 8000), action: rewrite, target })
      return { text: text(r), marked: marked(r), injection: injection(r) }
    }
    if (task === 'summarize' || task === 'ask') {
      const all = session.documentText()
      if (!all.trim()) throw new Error(A.empty)
      if (task === 'ask' && !input.trim()) throw new Error(A.needQuestion)
      const r =
        task === 'ask'
          ? await run(doc, 'ai.officeAsk', { kind, text: all.slice(0, 400_000), question: input.trim().slice(0, 2000) })
          : await run(doc, 'ai.officeSummarize', { kind, text: all.slice(0, 400_000), length })
      return { text: text(r), marked: true, injection: injection(r) }
    }
    if (task === 'draft') {
      if (!input.trim()) throw new Error(A.needIdea)
      const r = await run(doc, 'ai.officeWrite', { mode: 'draft', idea: input.trim().slice(0, 2000), length })
      return { text: text(r), marked: true, injection: injection(r) }
    }
    if (task === 'continue') {
      const before = (session.selectedText().trim() || session.documentText().trim()).slice(-4000)
      if (!before) throw new Error(A.empty)
      const r = await run(doc, 'ai.officeWrite', { mode: 'continue', text: before })
      return { text: text(r), marked: true, injection: injection(r) }
    }
    if (task === 'formula') {
      if (!input.trim()) throw new Error(A.needRequest)
      const context = session.sheetContext()
      const r = await run(doc, 'ai.formula', { request: input.trim().slice(0, 500), ...context })
      const formula = typeof r.formula === 'string' ? r.formula : ''
      const problem = session.checkFormula(formula)
      if (problem) throw new Error(fmt(A.badFormula, { formula, problem }))
      return { text: formula, formula, marked: false, injection: injection(r) }
    }
    if (task === 'explain') {
      const formula = session.activeFormula()
      if (!formula) throw new Error(A.needFormula)
      const r = await run(doc, 'ai.explainFormula', { formula: formula.slice(0, 2000) })
      return { text: `${formula}\n\n${text(r)}`, marked: true, injection: injection(r) }
    }
    if (task === 'data') {
      const csv = session.selectionCsv()
      if (!csv.trim()) throw new Error(A.needCells)
      const r = await run(doc, 'ai.dataSummary', { csv: csv.slice(0, 20_000) })
      return { text: text(r), marked: true, injection: injection(r) }
    }
    if (task === 'slides') {
      const source = input.trim()
      if (!source) throw new Error(A.needTopic)
      const r = await run(doc, 'ai.slides', { text: source.slice(0, 8000), count: Number(count) })
      const slides = Array.isArray(r.slides) ? (r.slides as { title: string; bullets: string[] }[]) : []
      const preview = slides.map((s) => `${s.title}\n${s.bullets.map((b) => `• ${b}`).join('\n')}`).join('\n\n')
      return { text: preview, slides, marked: true, injection: injection(r) }
    }
    if (task === 'notes') {
      const slide = session.slideText().trim()
      if (!slide) throw new Error(A.emptySlide)
      const r = await run(doc, 'ai.notes', { text: slide.slice(0, 4000) })
      return { text: text(r), marked: true, injection: injection(r) }
    }
    return null
  }

  // Lo que se hace con el resultado: según la tarea.
  const actions: { label: string; primary?: boolean; act: () => void }[] = []
  if (outcome) {
    const done = (): void => {
      setOutcome(null)
      session.focus()
    }
    if (task === 'rewrite') {
      actions.push({ label: A.replace, primary: true, act: () => (session.replaceSelection(outcome.text), done()) })
    } else if (task === 'formula' && outcome.formula) {
      actions.push({ label: fmt(A.putIn, { cell: session.sheetContext().cell }), primary: true, act: () => (session.putFormula(outcome.formula ?? ''), done()) })
    } else if (task === 'slides' && outcome.slides) {
      actions.push({ label: fmt(A.addSlides, { n: outcome.slides.length }), primary: true, act: () => (session.addSlides(outcome.slides ?? []), done()) })
    } else if (task === 'notes') {
      actions.push({ label: A.putNotes, primary: true, act: () => (session.setNotes(outcome.text), done()) })
    } else if (kind !== 'cell') {
      actions.push({ label: A.insert, primary: true, act: () => (session.insertText(outcome.text), done()) })
    }
  }

  const needsInput = task === 'ask' || task === 'draft' || task === 'formula' || task === 'slides'
  return (
    <aside className="office-panel office-ai" aria-label={A.title}>
      <section>
        <h3>
          <Sparkles size={14} /> {A.tasks[task]}
        </h3>
        <p className="hint">{A.hints[task]}</p>
        {task === 'rewrite' && (
          <select className="input" aria-label={A.how} value={rewrite} onChange={(e) => setRewrite(e.target.value as Rewrite)}>
            {REWRITES.map((r) => (
              <option key={r} value={r}>
                {A.rewrites[r]}
              </option>
            ))}
          </select>
        )}
        {needsInput && (
          <textarea
            ref={box}
            className="office-comment-input"
            rows={task === 'slides' ? 6 : 3}
            maxLength={task === 'slides' ? 8000 : task === 'formula' ? 500 : 2000}
            value={input}
            placeholder={A.placeholders[task as 'ask' | 'draft' | 'formula' | 'slides']}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                void go()
              }
            }}
          />
        )}
        {(task === 'summarize' || task === 'draft') && (
          <Segmented
            value={length}
            full
            options={[
              { value: 'short', label: A.short },
              { value: 'long', label: A.long }
            ]}
            onChange={setLength}
          />
        )}
        {task === 'slides' && (
          <label className="office-ai-count">
            {A.slideCount}
            <select className="input" value={count} onChange={(e) => setCount(e.target.value)}>
              {['3', '4', '5', '6', '8', '10', '12'].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="row">
          {busy ? (
            <button className="btn sm" onClick={cancel}>
              <Square size={13} />
              {A.stop}
            </button>
          ) : (
            <button className="btn sm primary" onClick={() => void go()}>
              <Sparkles size={14} />
              {A.go[task]}
            </button>
          )}
        </div>
        <div className="office-ai-tasks" role="group" aria-label={A.other}>
          {AI_TASKS[kind]
            .filter((t) => t !== task)
            .map((t) => (
              <button key={t} className="btn sm ghost" onClick={() => setTask(t)}>
                {A.tasks[t]}
              </button>
            ))}
        </div>
      </section>
      {(busy || outcome || error) && (
        <section className="office-ai-result" aria-live="polite">
          {busy && (
            <p className="hint office-ai-busy">
              <Loader2 size={14} className="spin" /> {busy.message}
            </p>
          )}
          {error && <p className="office-ai-error">{error}</p>}
          {(busy?.text || outcome) && <div className="office-ai-text">{busy?.text || outcome?.text}</div>}
          {outcome && (
            <>
              {outcome.injection > 0 && <p className="hint">{fmt(A.injection, { n: outcome.injection })}</p>}
              {outcome.marked && <p className="hint">{A.generated}</p>}
              <div className="row wrap">
                {actions.map((a) => (
                  <button key={a.label} className={a.primary ? 'btn sm primary' : 'btn sm'} onClick={a.act}>
                    {a.label}
                  </button>
                ))}
                <button className="btn sm ghost" onClick={() => void window.molinoOffice.copyText(outcome.text)}>
                  <Copy size={13} />
                  {A.copy}
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </aside>
  )
}
