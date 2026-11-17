import { AArrowDown, AArrowUp, ChevronLeft, ChevronRight, Clock, Pause, Play, RotateCcw, Timer, X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { InkColor, PresenterAction, PresenterMark, PresenterState } from '@shared/officeui'
import { env, fmt, L } from '../i18n'
import { fitBox, type HandTool, InkBook, type LocalInkOp, type Point, type Screen } from './ink'
import { InkLayer } from './InkLayer'
import { InkTools } from './InkTools'

const P = L.officeSlide.presenter
const K = L.officeSlide.ink
/** El tamaño de la letra de las notas (en píxeles): se recuerda en esta ventana. */
const NOTES_KEY = 'molino.presenter.notesSize'
const NOTES_SIZES = [16, 18, 20, 24, 28, 32, 40, 48, 56]
const MODIFIERS = ['Control', 'Shift', 'Alt', 'Meta', 'AltGraph', 'CapsLock', 'NumLock']

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
 * el teclado de siempre. Sobre la diapositiva, el puntero láser, el bolígrafo,
 * el rotulador y el borrador, y la pantalla en negro o en blanco: lo que se hace
 * aquí se ve en la presentación (y lo de allí, aquí). Lo que enseña lo manda la
 * ventana de Presentaciones (features/slide/presenter.ts); lo que pide, va a
 * ella (officepresenter.ts).
 */
export function PresenterApp() {
  const bridge = window.molinoPresenter
  const [state, setState] = useState<PresenterState | null>(null)
  const command = useCallback((action: PresenterAction, slide?: number) => bridge?.command(action, slide), [bridge])

  // Lo de encima de la diapositiva: la tinta de cada una, el láser, la pantalla tapada y lo que se tiene en la mano.
  const book = useRef(new InkBook())
  const [, setInkVersion] = useState(0)
  const [tool, setTool] = useState<HandTool>(null)
  const [color, setColor] = useState<InkColor>('red')
  const [width, setWidth] = useState<1 | 2 | 3>(2)
  const [screen, setScreen] = useState<Screen>(null)
  const [laser, setLaser] = useState<Point | null>(null)
  const slide = state ? (state.finished ? state.count : state.index) : 0
  const mark = useCallback((m: PresenterMark) => bridge?.mark(m), [bridge])

  useEffect(() => {
    if (!bridge) return
    const offState = bridge.onState(setState)
    const offMark = bridge.onMark((m) => {
      if (m.kind === 'ink') {
        if (book.current.apply(m.op.slide, m.op)) setInkVersion((v) => v + 1)
      } else if (m.kind === 'sync') {
        book.current.set(m.slide, m.strokes)
        setInkVersion((v) => v + 1)
      } else if (m.kind === 'laser') setLaser(m.at)
      else if (m.kind === 'screen') setScreen(m.screen)
    })
    bridge.ready()
    return () => {
      offState()
      offMark()
    }
  }, [bridge])

  const ink = useCallback(
    (op: LocalInkOp) => {
      if (book.current.apply(slide, op)) setInkVersion((v) => v + 1)
      mark({ kind: 'ink', op: { ...op, slide } })
    },
    [slide, mark]
  )
  const point = useCallback(
    (at: Point | null) => {
      setLaser(at)
      mark({ kind: 'laser', at })
    },
    [mark]
  )
  const cover = useCallback(
    (next: Screen) => {
      setScreen(next)
      mark({ kind: 'screen', screen: next })
    },
    [mark]
  )
  const hold = useCallback(
    (next: HandTool) => {
      if (next !== 'laser' && laser) point(null)
      setTool(next)
    },
    [laser, point]
  )

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

  // El teclado de siempre (el de PowerPoint): pasar, volver, ir a una escribiendo su número, terminar;
  // y lo de encima: Ctrl+L láser, Ctrl+P bolígrafo, Ctrl+I rotulador, Ctrl+E borrador, Ctrl+A soltarlo,
  // E borrar la tinta, B o el punto negro, W o la coma blanco (y cualquier tecla lo destapa).
  const typed = useRef('')
  const count = state?.count ?? 0
  const latest = useRef({ tool, screen, hold, cover, ink })
  latest.current = { tool, screen, hold, cover, ink }
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const key = event.key
      if (MODIFIERS.includes(key) || document.querySelector('.ink-pop')) return
      const now = latest.current
      if (now.screen) {
        event.preventDefault()
        now.cover(null)
        return
      }
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey) {
        const tools: Record<string, HandTool> = { l: 'laser', p: 'pen', i: 'highlighter', e: 'eraser' }
        const lower = key.toLowerCase()
        if (lower in tools) now.hold(now.tool === tools[lower] ? null : tools[lower])
        else if (lower === 'a') now.hold(null)
        else return
        event.preventDefault()
        return
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const onButton = event.target instanceof HTMLButtonElement
      if (/^[0-9]$/.test(key)) {
        typed.current = (typed.current + key).slice(-4)
        return
      }
      let handled = true
      const lower = key.toLowerCase()
      if (key === 'Enter' && typed.current) {
        const n = Number(typed.current)
        if (n >= 1 && n <= count) command('goto', n - 1)
      } else if (onButton && (key === ' ' || key === 'Enter')) handled = false
      else if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter', 'n', 'N'].includes(key)) command('next')
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace', 'p', 'P'].includes(key)) command('prev')
      else if (key === 'Home') command('first')
      else if (key === 'End') command('last')
      else if (lower === 'b' || key === '.') now.cover('black')
      else if (lower === 'w' || key === ',') now.cover('white')
      else if (lower === 'e') now.ink({ op: 'clear' })
      else if (key === 'Escape') {
        if (now.tool) now.hold(null)
        else command('end')
      } else handled = false
      typed.current = ''
      if (handled) event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [command, count])

  useEffect(() => {
    document.title = state?.title ? `${P.title} — ${state.title}` : P.title
  }, [state?.title])

  // La diapositiva, lo más grande que quepa, con la tinta encima (del mismo tamaño) y, justo
  // debajo, sus herramientas y los botones para pasar: todo junto, centrado en su columna.
  const column = useRef<HTMLElement>(null)
  const toolsRow = useRef<HTMLDivElement>(null)
  const navRow = useRef<HTMLElement>(null)
  const [aspect, setAspect] = useState(16 / 9)
  const [box, setBox] = useState<{ width: number; height: number } | null>(null)
  useLayoutEffect(() => {
    const section = column.current
    if (!section) return
    const fit = (): void => {
      const gap = parseFloat(getComputedStyle(section).rowGap) || 0
      const room = section.clientHeight - (toolsRow.current?.offsetHeight ?? 0) - (navRow.current?.offsetHeight ?? 0) - 2 * gap
      const next = fitBox(section.clientWidth, Math.max(80, room), aspect)
      const size = { width: Math.floor(next.width), height: Math.floor(next.height) }
      setBox((old) => (old && old.width === size.width && old.height === size.height ? old : size))
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(section)
    if (toolsRow.current) observer.observe(toolsRow.current)
    return () => observer.disconnect()
  }, [aspect, state !== null])

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
          <section className="presenter-current" aria-label={P.current} ref={column}>
            <div className="presenter-stage" style={box ?? undefined}>
              {state.current ? (
                box && (
                  <div className={`presenter-slide${screen ? ' covered' : ''}`}>
                    <img
                      src={state.current}
                      alt={where}
                      draggable={false}
                      onLoad={(event) => {
                        const img = event.currentTarget
                        if (img.naturalWidth > 0 && img.naturalHeight > 0) setAspect(img.naturalWidth / img.naturalHeight)
                      }}
                      onClick={() => command('next')}
                    />
                    <InkLayer strokes={book.current.get(slide)} tool={tool} color={color} width={width} laser={laser} aspect={aspect} side="p" onInk={ink} onLaser={point} onTap={() => command('next')} />
                    {screen && (
                      <button className={`presenter-covered ${screen}`} onClick={() => cover(null)}>
                        <strong>{K.covered[screen]}</strong>
                        <span>{K.coveredHint}</span>
                      </button>
                    )}
                  </div>
                )
              ) : (
                <span className="spinner" />
              )}
            </div>
            <div className="presenter-tools" ref={toolsRow}>
              <InkTools
              tool={tool}
              color={color}
              width={width}
              screen={screen}
              onTool={hold}
              onColor={setColor}
              onWidth={setWidth}
              onClear={() => ink({ op: 'clear' })}
              onScreen={cover}
              />
            </div>
            <nav className="presenter-nav" ref={navRow}>
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
