import { ChevronLeft, ChevronRight, Minimize2, Minus, MoveHorizontal, Plus, RectangleVertical } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type UIEvent } from 'react'
import type { PageInfo, Rect } from '@shared/types'
import { L, fmt } from '@/i18n'
import { PT_TO_PX } from '@/lib/render'
import { clamp, cn } from '@/lib/util'
import { nextZoom, ZOOM_MAX, ZOOM_MIN } from '@/lib/viewerControl'
import type { DocView, ZoomKind } from '@/state/app'
import { stopFullScreen } from '@/state/fullScreen'
import { PageCanvas } from '@/viewer/PageCanvas'

/** Lo que tarda en esconderse la barra (y el puntero) sin mover el ratón. */
const IDLE_MS = 2200
/** Entre dos pasos de página (o de zoom) con la rueda: un gesto no se salta varias páginas. */
const WHEEL_MS = 320

type Zoom = { kind: ZoomKind; scale: number }
type Size = { w: number; h: number }

/** Píxeles por punto de una página con ese zoom en esa pantalla. */
function pxPerPtOf(page: PageInfo, zoom: Zoom, size: Size): number {
  if (zoom.kind === 'fit-page') return Math.min(size.w / page.w, size.h / page.h)
  if (zoom.kind === 'fit-width') return size.w / page.w
  return zoom.scale * PT_TO_PX
}

/** Si la caja aún puede desplazarse hacia abajo (1) o hacia arriba (-1). */
function canScroll(box: HTMLElement | null, direction: 1 | -1): boolean {
  if (!box) return false
  return direction > 0 ? box.scrollTop + box.clientHeight < box.scrollHeight - 1 : box.scrollTop > 0
}

/**
 * El documento a pantalla completa, página a página, para presentarlo o leerlo:
 * sobre fondo negro y, al principio, cada página entera en la pantalla. Se avanza
 * con las flechas, Av Pág, la barra espaciadora, Intro, la rueda o un clic; se
 * retrocede con las flechas, Re Pág o Retroceso; Inicio y Fin van a la primera
 * y la última; Esc (o F5) sale. Al mover el ratón aparece una barra con lo mismo
 * y con el zoom: alejar, acercar, ajustar al ancho y página completa (también
 * con + y -, Ctrl+rueda y Ctrl+0 para el ancho, como en el visor).
 *
 * Si con el zoom la página no cabe, la rueda, las flechas arriba y abajo y Av
 * Pág / Re Pág primero la recorren y, al llegar al borde, pasan de página (hacia
 * atrás se entra por el final de la anterior, para seguir leyendo).
 */
export function FullScreen({ doc }: { doc: DocView }) {
  const total = doc.pages.length
  const [index, setIndex] = useState(() => Math.max(0, doc.pages.findIndex((p) => p.id === doc.current)))
  const [size, setSize] = useState<Size>({ w: window.innerWidth, h: window.innerHeight })
  const [zoom, setZoom] = useState<Zoom>({ kind: 'fit-page', scale: 1 })
  // Zona visible de la página (en puntos), para dibujarla nítida a zoom alto.
  const [view, setView] = useState<Rect | null>(null)
  const [idle, setIdle] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const timer = useRef(0)
  const lastWheel = useRef(0)
  const lastScroll = useRef(0)
  const overBar = useRef(false)
  // Por dónde se entra en la página nueva: arriba o, al volver hacia atrás, abajo.
  const enterAt = useRef<'top' | 'bottom'>('top')
  // Punto de la página (en proporción) que estaba en el centro antes de cambiar el zoom.
  const anchor = useRef<{ x: number; y: number } | null>(null)
  const current = Math.min(index, total - 1)
  const page = doc.pages[current]
  const pageRef = useRef<string | undefined>(page?.id)
  pageRef.current = page?.id

  const shownBox = useCallback(
    (): HTMLElement | null => (pageRef.current ? (rootRef.current?.querySelector<HTMLElement>(`.fullscreen-scroll[data-page="${CSS.escape(pageRef.current)}"]`) ?? null) : null),
    []
  )

  const go = useCallback(
    (delta: number, at: 'top' | 'bottom' = 'top') => {
      enterAt.current = at
      setIndex((i) => clamp(i + delta, 0, Math.max(0, total - 1)))
    },
    [total]
  )
  const jump = useCallback((to: number) => {
    enterAt.current = 'top'
    setIndex(to)
  }, [])
  const exit = useCallback(() => stopFullScreen(pageRef.current), [])

  const changeZoom = useCallback(
    (next: Zoom | ((scale: number) => Zoom)) => {
      const box = shownBox()
      if (box && box.scrollWidth > 0 && box.scrollHeight > 0) {
        // Si la página cabía entera de alto, se empieza a leer por arriba (y < 0).
        anchor.current = {
          x: (box.scrollLeft + box.clientWidth / 2) / box.scrollWidth,
          y: canScroll(box, 1) || canScroll(box, -1) ? (box.scrollTop + box.clientHeight / 2) / box.scrollHeight : -1
        }
      }
      const shownPage = doc.pages.find((p) => p.id === pageRef.current)
      const scale = shownPage ? pxPerPtOf(shownPage, zoom, size) / PT_TO_PX : zoom.scale
      setZoom(typeof next === 'function' ? next(scale) : next)
    },
    [doc.pages, shownBox, size, zoom]
  )
  const zoomStep = useCallback(
    (direction: 1 | -1) => changeZoom((scale) => ({ kind: 'custom', scale: clamp(nextZoom(scale, direction), ZOOM_MIN, ZOOM_MAX) })),
    [changeZoom]
  )
  const fit = useCallback((kind: 'fit-width' | 'fit-page') => changeZoom({ kind, scale: zoom.scale }), [changeZoom, zoom.scale])

  /** Recorre la página si no cabe; dice si lo ha hecho (si no, toca pasar de página). */
  const scrollPage = useCallback(
    (direction: 1 | -1, amount: 'line' | 'screen'): boolean => {
      const box = shownBox()
      if (!box || !canScroll(box, direction)) return false
      box.scrollBy({ top: direction * box.clientHeight * (amount === 'line' ? 0.15 : 0.9), behavior: 'smooth' })
      return true
    },
    [shownBox]
  )

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
      const mod = event.ctrlKey || event.metaKey
      const forward = key === 'ArrowDown' ? 'line' : key === 'PageDown' || key === ' ' ? 'screen' : null
      const backward = key === 'ArrowUp' ? 'line' : key === 'PageUp' ? 'screen' : null
      if (forward) {
        if (!scrollPage(1, forward)) go(1)
      } else if (backward) {
        if (!scrollPage(-1, backward)) go(-1, 'bottom')
      } else if (key === 'ArrowRight' || key === 'Enter') go(1)
      else if (key === 'ArrowLeft' || key === 'Backspace') go(-1)
      else if (key === 'Home') jump(0)
      else if (key === 'End') jump(Math.max(0, total - 1))
      else if (key === '+' || key === '=') zoomStep(1)
      else if (key === '-') zoomStep(-1)
      else if (mod && key === '0') fit('fit-width')
      else if (key === 'Escape' || key === 'F5') exit()
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [go, jump, exit, total, scrollPage, zoomStep, fit])

  // La rueda: con Ctrl, zoom; si la página no cabe, la recorre (lo hace el
  // navegador) y, al llegar al borde, pasa de página. Escucha propia y no pasiva
  // para que Ctrl+rueda no amplíe la ventana entera.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const onWheel = (event: WheelEvent): void => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        if (event.deltaY === 0 || Date.now() - lastWheel.current < WHEEL_MS) return
        lastWheel.current = Date.now()
        zoomStep(event.deltaY < 0 ? 1 : -1)
        return
      }
      if (event.deltaY === 0) return
      const direction = event.deltaY > 0 ? 1 : -1
      if (canScroll(shownBox(), direction)) return
      // Si se acaba de llegar al borde recorriendo, no se pasa aún: así la
      // inercia de la rueda no se salta la página siguiente.
      if (Date.now() - lastScroll.current < WHEEL_MS || Date.now() - lastWheel.current < WHEEL_MS) return
      lastWheel.current = Date.now()
      go(direction, direction > 0 ? 'top' : 'bottom')
    }
    root.addEventListener('wheel', onWheel, { passive: false })
    return () => root.removeEventListener('wheel', onWheel)
  }, [go, shownBox, zoomStep])

  // Página nueva: se entra por arriba (o por abajo, si se vuelve leyendo hacia atrás).
  useLayoutEffect(() => {
    const box = shownBox()
    if (!box) return
    box.scrollTop = enterAt.current === 'bottom' ? box.scrollHeight : 0
    box.scrollLeft = (box.scrollWidth - box.clientWidth) / 2
    enterAt.current = 'top'
  }, [current, shownBox])

  // Zoom nuevo: lo que estaba en el centro sigue en el centro (o, si la página
  // cabía entera, se empieza por arriba).
  useLayoutEffect(() => {
    const box = shownBox()
    const at = anchor.current
    anchor.current = null
    if (!box || !at) return
    box.scrollLeft = at.x * box.scrollWidth - box.clientWidth / 2
    box.scrollTop = at.y < 0 ? 0 : at.y * box.scrollHeight - box.clientHeight / 2
  }, [zoom, shownBox])

  /** La zona visible de la página que se ve, en puntos (solo si no cabe entera). */
  const updateView = useCallback(() => {
    const box = shownBox()
    const shownPage = doc.pages.find((p) => p.id === pageRef.current)
    const pageEl = box?.firstElementChild as HTMLElement | null
    if (!box || !shownPage || !pageEl) return setView(null)
    if (box.scrollWidth <= box.clientWidth + 1 && box.scrollHeight <= box.clientHeight + 1) return setView(null)
    const ppt = pageEl.offsetWidth / shownPage.w
    const x0 = (box.scrollLeft - pageEl.offsetLeft) / ppt
    const y0 = (box.scrollTop - pageEl.offsetTop) / ppt
    setView([
      Math.max(0, x0),
      Math.max(0, y0),
      Math.min(shownPage.w, x0 + box.clientWidth / ppt),
      Math.min(shownPage.h, y0 + box.clientHeight / ppt)
    ])
  }, [doc.pages, shownBox])
  useLayoutEffect(updateView, [updateView, current, zoom, size])

  const onScroll = (event: UIEvent<HTMLDivElement>): void => {
    if (event.currentTarget.dataset.page !== pageRef.current) return
    lastScroll.current = Date.now()
    updateView()
  }

  // La página que se ve y sus vecinas, ya dibujadas para que el cambio sea inmediato.
  const shown = [current - 1, current, current + 1].filter((i) => i >= 0 && i < total).map((i) => doc.pages[i])
  const percent = page ? Math.round((pxPerPtOf(page, zoom, size) / PT_TO_PX) * 100) : 100
  const D = L.shell.dock

  return (
    <div
      ref={rootRef}
      className={cn('fullscreen', idle && 'idle')}
      role="dialog"
      aria-label={L.shell.fullScreen.title}
      onMouseMove={wake}
      onClick={() => go(1)}
      onContextMenu={(event) => event.preventDefault()}
    >
      {shown.map((p) => {
        const visible = p.id === page?.id
        const pxPerPt = pxPerPtOf(p, zoom, size)
        return (
          <div key={p.id} className={cn('fullscreen-scroll', visible && 'shown')} data-page={p.id} onScroll={onScroll}>
            <div className={cn('fullscreen-page', visible && 'shown')} style={{ width: p.w * pxPerPt, height: p.h * pxPerPt }}>
              <PageCanvas doc={doc.id} page={p} pxPerPt={pxPerPt} priority={visible ? 6 : 4} view={visible ? view : null} />
            </div>
          </div>
        )
      })}
      <div
        className="fullscreen-bar"
        onClick={(event) => event.stopPropagation()}
        onMouseEnter={() => (overBar.current = true)}
        onMouseLeave={() => (overBar.current = false)}
      >
        <button className="icon-btn" aria-label={D.previousPage} data-tip={D.previousPage} data-tip-side="top" disabled={current <= 0} onClick={() => go(-1)}>
          <ChevronLeft size={17} />
        </button>
        <span className="fullscreen-count">{fmt(L.shell.fullScreen.counter, { n: current + 1, total })}</span>
        <button className="icon-btn" aria-label={D.nextPage} data-tip={D.nextPage} data-tip-side="top" disabled={current >= total - 1} onClick={() => go(1)}>
          <ChevronRight size={17} />
        </button>
        <div className="sep" />
        <button className="icon-btn" aria-label={D.zoomOut} data-tip={D.zoomOut} data-tip-side="top" disabled={percent <= ZOOM_MIN * 100} onClick={() => zoomStep(-1)}>
          <Minus size={16} />
        </button>
        <span className="fullscreen-zoom">{fmt(L.shell.percent, { n: percent })}</span>
        <button className="icon-btn" aria-label={D.zoomIn} data-tip={D.zoomIn} data-tip-side="top" disabled={percent >= ZOOM_MAX * 100} onClick={() => zoomStep(1)}>
          <Plus size={16} />
        </button>
        <button className="icon-btn" aria-label={D.fitWidth} aria-pressed={zoom.kind === 'fit-width'} data-tip={D.fitWidth} data-tip-side="top" onClick={() => fit('fit-width')}>
          <MoveHorizontal size={16} />
        </button>
        <button className="icon-btn" aria-label={D.fitPage} aria-pressed={zoom.kind === 'fit-page'} data-tip={D.fitPage} data-tip-side="top" onClick={() => fit('fit-page')}>
          <RectangleVertical size={16} />
        </button>
        <div className="sep" />
        <button className="icon-btn" aria-label={L.shell.fullScreen.exit} data-tip={L.shell.fullScreen.exit} data-tip-side="top" onClick={exit}>
          <Minimize2 size={16} />
        </button>
      </div>
    </div>
  )
}
