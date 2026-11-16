import { ChevronLeft, ChevronRight, Minimize2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type WheelEvent as ReactWheelEvent } from 'react'
import type { PageInfo } from '@shared/types'
import { L, fmt } from '@/i18n'
import { clamp, cn } from '@/lib/util'
import type { DocView } from '@/state/app'
import { stopFullScreen } from '@/state/fullScreen'
import { PageCanvas } from '@/viewer/PageCanvas'

/** Lo que tarda en esconderse la barra (y el puntero) sin mover el ratón. */
const IDLE_MS = 2200
/** Entre dos pasos de página con la rueda: un gesto no se salta varias páginas. */
const WHEEL_MS = 320

/**
 * El documento a pantalla completa, página a página, para presentarlo: cada
 * página ajustada a la pantalla sobre fondo negro, sin nada más. Se avanza con
 * las flechas, Av Pág, la barra espaciadora, Intro, la rueda o un clic; se
 * retrocede con las flechas, Re Pág o Retroceso; Inicio y Fin van a la primera
 * y la última; Esc (o F5) sale. Al mover el ratón aparece una barra con lo mismo.
 */
export function FullScreen({ doc }: { doc: DocView }) {
  const total = doc.pages.length
  const [index, setIndex] = useState(() => Math.max(0, doc.pages.findIndex((p) => p.id === doc.current)))
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight })
  const [idle, setIdle] = useState(false)
  const timer = useRef(0)
  const lastWheel = useRef(0)
  const overBar = useRef(false)
  const current = Math.min(index, total - 1)
  const pageRef = useRef<string | undefined>(doc.pages[current]?.id)
  pageRef.current = doc.pages[current]?.id

  const go = useCallback((delta: number) => setIndex((i) => clamp(i + delta, 0, Math.max(0, total - 1))), [total])
  const exit = useCallback(() => stopFullScreen(pageRef.current), [])

  // La barra y el puntero se esconden al dejar quieto el ratón.
  const wake = useCallback(() => {
    setIdle(false)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      if (!overBar.current) setIdle(true)
    }, IDLE_MS)
  }, [])
  useEffect(() => {
    wake()
    return () => window.clearTimeout(timer.current)
  }, [wake])

  useEffect(() => {
    const onResize = (): void => setSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Si la ventana sale de pantalla completa por otro camino, también se sale de aquí.
  useEffect(() => window.molino.window.onFullScreen((on) => !on && exit()), [exit])

  // Las teclas, antes que los atajos de siempre: mientras se presenta, ninguno más.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      event.stopImmediatePropagation()
      if (event.altKey) return
      const key = event.key
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(key)) go(1)
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(key)) go(-1)
      else if (key === 'Home') setIndex(0)
      else if (key === 'End') setIndex(Math.max(0, total - 1))
      else if (key === 'Escape' || key === 'F5') exit()
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [go, exit, total])

  const onWheel = (event: ReactWheelEvent): void => {
    if (event.deltaY === 0 || Date.now() - lastWheel.current < WHEEL_MS) return
    lastWheel.current = Date.now()
    go(event.deltaY > 0 ? 1 : -1)
  }

  // La página que se ve y sus vecinas, ya dibujadas para que el cambio sea inmediato.
  const shown = [current - 1, current, current + 1].filter((i) => i >= 0 && i < total).map((i) => doc.pages[i])

  return (
    <div
      className={cn('fullscreen', idle && 'idle')}
      role="dialog"
      aria-label={L.shell.fullScreen.title}
      onMouseMove={wake}
      onClick={() => go(1)}
      onContextMenu={(event) => event.preventDefault()}
      onWheel={onWheel}
    >
      {shown.map((page) => (
        <FullPage key={page.id} doc={doc.id} page={page} size={size} visible={page.id === doc.pages[current]?.id} />
      ))}
      <div
        className="fullscreen-bar"
        onClick={(event) => event.stopPropagation()}
        onMouseEnter={() => (overBar.current = true)}
        onMouseLeave={() => (overBar.current = false)}
      >
        <button className="icon-btn" aria-label={L.shell.dock.previousPage} data-tip={L.shell.dock.previousPage} data-tip-side="top" disabled={current <= 0} onClick={() => go(-1)}>
          <ChevronLeft size={17} />
        </button>
        <span className="fullscreen-count">{fmt(L.shell.fullScreen.counter, { n: current + 1, total })}</span>
        <button className="icon-btn" aria-label={L.shell.dock.nextPage} data-tip={L.shell.dock.nextPage} data-tip-side="top" disabled={current >= total - 1} onClick={() => go(1)}>
          <ChevronRight size={17} />
        </button>
        <div className="sep" />
        <button className="icon-btn" aria-label={L.shell.fullScreen.exit} data-tip={L.shell.fullScreen.exit} data-tip-side="top" onClick={exit}>
          <Minimize2 size={16} />
        </button>
      </div>
    </div>
  )
}

/** Una página, lo más grande que cabe en la pantalla y centrada. */
function FullPage({ doc, page, size, visible }: { doc: string; page: PageInfo; size: { w: number; h: number }; visible: boolean }) {
  const pxPerPt = Math.min(size.w / page.w, size.h / page.h)
  const w = page.w * pxPerPt
  const h = page.h * pxPerPt
  return (
    <div
      className={cn('fullscreen-page', visible && 'shown')}
      data-page={page.id}
      style={{ width: w, height: h, left: (size.w - w) / 2, top: (size.h - h) / 2 }}
    >
      <PageCanvas doc={doc} page={page} pxPerPt={pxPerPt} priority={visible ? 6 : 4} view={null} />
    </div>
  )
}
