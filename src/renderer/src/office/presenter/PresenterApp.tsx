import { AArrowDown, AArrowUp, ChevronLeft, ChevronRight, Clock, Pause, Play, RotateCcw, Timer, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { PresenterAction, PresenterState } from '@shared/officeui'
import { env, fmt, L } from '../i18n'

const P = L.officeSlide.presenter
/** El tamaño de la letra de las notas (en píxeles): se recuerda en esta ventana. */
const NOTES_KEY = 'molino.presenter.notesSize'
const NOTES_SIZES = [16, 18, 20, 24, 28, 32, 40, 48, 56]

function readSize(): number {
  try {
    const saved = Number(localStorage.getItem(NOTES_KEY))
    return NOTES_SIZES.includes(saved) ? saved : 24
  } catch {
    return 24
  }
}

/** 4:05 o 1:02:03. */
function elapsedText(total: number): string {
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

/**
 * La vista del moderador, como la de PowerPoint: la diapositiva que se ve, la
 * siguiente, las notas (con la letra a la medida), el tiempo (con pausa) y la
 * hora, en cuál se va, y pasar de diapositiva o terminar con los botones o con
 * el teclado de siempre. Lo que enseña lo manda la ventana de Presentaciones
 * (features/slide/presenter.ts); lo que pide, va a ella (officepresenter.ts).
 */
export function PresenterApp() {
  const bridge = window.molinoPresenter
  const [state, setState] = useState<PresenterState | null>(null)
  useEffect(() => {
    if (!bridge) return
    const off = bridge.onState(setState)
    bridge.ready()
    return off
  }, [bridge])
  const command = useCallback((action: PresenterAction, slide?: number) => bridge?.command(action, slide), [bridge])

  // El tiempo: empieza con la presentación; se puede parar y volver a empezar.
  const [elapsed, setElapsed] = useState(0)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (paused) return
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [paused])
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const [size, setSize] = useState(readSize)
  const resize = (step: number): void => {
    const at = NOTES_SIZES.indexOf(size)
    const next = NOTES_SIZES[Math.max(0, Math.min(NOTES_SIZES.length - 1, at + step))]
    setSize(next)
    try {
      localStorage.setItem(NOTES_KEY, String(next))
    } catch {
      /* sin almacenamiento: no se recuerda */
    }
  }

  // El teclado de siempre (el de PowerPoint): pasar, volver, ir a una escribiendo su número, terminar.
  const typed = useRef('')
  const count = state?.count ?? 0
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const key = event.key
      const onButton = event.target instanceof HTMLButtonElement
      if (/^[0-9]$/.test(key)) {
        typed.current = (typed.current + key).slice(-4)
        return
      }
      let handled = true
      if (key === 'Enter' && typed.current) {
        const n = Number(typed.current)
        if (n >= 1 && n <= count) command('goto', n - 1)
      } else if (onButton && (key === ' ' || key === 'Enter')) handled = false
      else if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter', 'n', 'N'].includes(key)) command('next')
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace', 'p', 'P'].includes(key)) command('prev')
      else if (key === 'Home') command('first')
      else if (key === 'End') command('last')
      else if (key === 'Escape') command('end')
      else handled = false
      typed.current = ''
      if (handled) event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [command, count])

  useEffect(() => {
    document.title = state?.title ? `${P.title} — ${state.title}` : P.title
  }, [state?.title])

  const where = state ? (state.finished ? P.finished : fmt(P.slide, { n: state.index + 1, total: state.count })) : ''
  const clock = now.toLocaleTimeString(env.locale, { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="presenter">
      <header className="titlebar presenter-bar">
        <div className="presenter-time" role="timer" aria-label={P.elapsed}>
          <Timer size={16} aria-hidden="true" />
          <strong className="presenter-elapsed">{elapsedText(elapsed)}</strong>
          <button className="icon-btn sm" aria-label={paused ? P.resume : P.pause} data-tip={paused ? P.resume : P.pause} onClick={() => setPaused(!paused)}>
            {paused ? <Play size={15} /> : <Pause size={15} />}
          </button>
          <button className="icon-btn sm" aria-label={P.reset} data-tip={P.reset} onClick={() => setElapsed(0)}>
            <RotateCcw size={15} />
          </button>
        </div>
        <div className="presenter-clock" aria-label={P.clock}>
          <Clock size={16} aria-hidden="true" />
          <span>{clock}</span>
        </div>
        <div className="titlebar-fill" />
        <span className="presenter-doc">{state?.title ?? ''}</span>
        <div className="titlebar-fill" />
        <button className="btn sm danger presenter-end" onClick={() => command('end')}>
          <X size={14} />
          {P.end}
        </button>
      </header>

      {!state ? (
        <div className="presenter-loading">
          <span className="spinner" />
          {P.loading}
        </div>
      ) : (
        <main className="presenter-main">
          <section className="presenter-current" aria-label={P.current}>
            <div className="presenter-stage">
              {state.current ? (
                <img src={state.current} alt={where} draggable={false} onClick={() => command('next')} />
              ) : (
                <span className="spinner" />
              )}
            </div>
            <nav className="presenter-nav">
              <button className="btn" disabled={state.index <= 0 && !state.finished} onClick={() => command('prev')}>
                <ChevronLeft size={16} />
                {P.prev}
              </button>
              <span className="presenter-where" aria-live="polite">
                {where}
              </span>
              <button className="btn primary" disabled={state.finished} onClick={() => command('next')}>
                {P.nextSlide}
                <ChevronRight size={16} />
              </button>
            </nav>
          </section>
          <aside className="presenter-side">
            <section className="presenter-next">
              <h2>{P.next}</h2>
              {state.next ? (
                state.next.image ? (
                  <img src={state.next.image} alt={fmt(P.slide, { n: state.next.index + 1, total: state.count })} draggable={false} />
                ) : (
                  <div className="presenter-next-empty">
                    <span className="spinner" />
                  </div>
                )
              ) : (
                <div className="presenter-next-empty">{P.finished}</div>
              )}
            </section>
            <section className="presenter-notes">
              <header>
                <h2>{P.notes}</h2>
                <button className="icon-btn sm" aria-label={P.smaller} data-tip={P.smaller} disabled={size <= NOTES_SIZES[0]} onClick={() => resize(-1)}>
                  <AArrowDown size={16} />
                </button>
                <button className="icon-btn sm" aria-label={P.bigger} data-tip={P.bigger} disabled={size >= NOTES_SIZES[NOTES_SIZES.length - 1]} onClick={() => resize(1)}>
                  <AArrowUp size={16} />
                </button>
              </header>
              <div className="presenter-notes-text" style={{ fontSize: `${size}px` }} tabIndex={0}>
                {state.notes || <span className="presenter-notes-none">{P.noNotes}</span>}
              </div>
            </section>
            <p className="hint presenter-keys">{P.keys}</p>
          </aside>
        </main>
      )}
    </div>
  )
}
