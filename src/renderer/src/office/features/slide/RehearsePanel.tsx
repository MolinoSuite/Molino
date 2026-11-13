import { ChevronLeft, ChevronRight, Pause, Play, Presentation, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { fmt, L } from '../../i18n'
import type { Api, PanelProps } from '../types'

const R = L.officeSlide.rehearse
const TEXT = { ParaSeparator: '\n', NewLineSeparator: '\n', TabSymbol: ' ' }

/**
 * El texto de una forma de la API de documentos (vacío si no tiene). Solo si ya
 * tiene texto: GetDocContent crea uno vacío si no lo hay, y crear algo fuera de un
 * paso para deshacer es un error del editor.
 */
function textOf(shape: Api): string {
  try {
    if (!shape?.HasTextContent?.()) return ''
    const text = shape.GetDocContent()?.GetText?.(TEXT)
    return typeof text === 'string' ? text.replace(/\r/g, '').trim() : ''
  } catch {
    return ''
  }
}

/** Las notas del orador de una diapositiva (desde 0). */
export function readNotes(api: Api, index: number): string {
  try {
    const slide = api.getJsApi().GetPresentation().GetSlideByIndex(index)
    return textOf(slide?.GetNotesPage?.()?.GetBodyShape?.()).slice(0, 20_000)
  } catch {
    return ''
  }
}

/** El título y el resto del texto de una diapositiva (desde 0), para saber qué viene. */
export function readSummary(api: Api, index: number): { title: string; text: string } | null {
  try {
    const slide = api.getJsApi().GetPresentation().GetSlideByIndex(index)
    if (!slide) return null
    let title = ''
    const rest: string[] = []
    for (const shape of slide.GetAllShapes?.() ?? []) {
      const text = textOf(shape)
      if (!text) continue
      const type = String(shape.GetPlaceholder?.()?.GetType?.() ?? '')
      if (!title && (type === 'title' || type === 'ctrTitle')) title = text
      else rest.push(text)
    }
    if (!title && rest.length) title = rest.shift() ?? ''
    return { title: title.split('\n')[0].slice(0, 200), text: rest.join('\n').slice(0, 600) }
  } catch {
    return null
  }
}

const clock = (s: number): string => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

/**
 * Ensayo: lo que ofrece la vista del moderador sin salir del editor (las notas
 * de la diapositiva, lo que viene después y el tiempo, el total y el de la
 * diapositiva), con botones para pasar de diapositiva. La vista del moderador
 * de verdad (otra ventana, en la segunda pantalla) necesita el proceso principal.
 */
export function RehearsePanel({ session, state, run }: PanelProps) {
  const api = session.featureContext().api
  const page = state.page
  const pages = state.pages
  const notes = readNotes(api, page - 1)
  const next = page < pages ? readSummary(api, page) : null
  const [running, setRunning] = useState(false)
  const [total, setTotal] = useState(0)
  const [onSlide, setOnSlide] = useState(0)
  const lastPage = useRef(page)
  useEffect(() => {
    if (lastPage.current !== page) {
      lastPage.current = page
      setOnSlide(0)
    }
  }, [page])
  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => {
      setTotal((t) => t + 1)
      setOnSlide((t) => t + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [running])
  return (
    <div className="slide-rehearse">
      <div className="slide-rehearse-clock" role="timer" aria-live="off">
        <div>
          <span>{R.total}</span>
          <strong>{clock(total)}</strong>
        </div>
        <div>
          <span>{R.thisSlide}</span>
          <strong>{clock(onSlide)}</strong>
        </div>
      </div>
      <div className="slide-rehearse-row">
        <button className="btn primary sm" onClick={() => setRunning(!running)}>
          {running ? <Pause size={13} /> : <Play size={13} />}
          {running ? R.pause : R.start}
        </button>
        <button
          className="btn sm"
          onClick={() => {
            setTotal(0)
            setOnSlide(0)
          }}
        >
          <RotateCcw size={13} />
          {R.reset}
        </button>
      </div>
      <div className="slide-rehearse-row">
        <button className="btn sm" disabled={page <= 1} onClick={() => run('goToPage', String(page - 1))}>
          <ChevronLeft size={13} />
          {R.prev}
        </button>
        <span className="slide-rehearse-page">{fmt(R.slide, { n: page, total: pages })}</span>
        <button className="btn sm" disabled={page >= pages} onClick={() => run('goToPage', String(page + 1))}>
          {R.nextSlide}
          <ChevronRight size={13} />
        </button>
      </div>
      <section>
        <h3>{R.notes}</h3>
        {notes ? <p className="slide-rehearse-notes">{notes}</p> : <p className="hint">{R.noNotes}</p>}
      </section>
      <section>
        <h3>{R.next}</h3>
        {next ? (
          <div className="slide-rehearse-next">
            <strong>{next.title || R.untitled}</strong>
            {next.text && <p>{next.text}</p>}
          </div>
        ) : (
          <p className="hint">{R.last}</p>
        )}
      </section>
      <button className="btn sm" onClick={() => run('present', 'here')}>
        <Presentation size={13} />
        {R.present}
      </button>
      <p className="hint">{R.hint}</p>
    </div>
  )
}
