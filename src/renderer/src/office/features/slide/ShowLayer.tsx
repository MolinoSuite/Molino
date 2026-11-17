import { ChevronLeft, ChevronRight, CircleDot, Eraser, Highlighter, MousePointer2, Pen, Square, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Menu, type MenuEntry } from '@/components/ui'
import { cn } from '@/lib/cn'
import { fmt, L } from '../../i18n'
import { fitBox } from '../../presenter/ink'
import { InkLayer } from '../../presenter/InkLayer'
import { InkTools } from '../../presenter/InkTools'
import type { Api } from '../types'
import { showColor, showGo, showInk, showKey, showLaser, showRevision, showScreen, showTool, showView, showWidth, subscribeShow } from './presenter'

const K = L.officeSlide.ink
const P = L.officeSlide.presenter
/** Lo que tarda en irse la barrita sin mover el ratón (como en PowerPoint). */
const HIDE_MS = 3000

/** Dónde está, en esta ventana, un rectángulo de la ventana del editor (que va en marcos dentro de marcos). */
function toTop(ew: Api, rect: DOMRect): DOMRect {
  let x = rect.left
  let y = rect.top
  let win: Api = ew
  try {
    while (win && win !== window && win.frameElement) {
      const frame = (win.frameElement as HTMLElement).getBoundingClientRect()
      x += frame.left
      y += frame.top
      win = win.parent
    }
  } catch {
    /* un marco de otro sitio: no debería pasar */
  }
  return new DOMRect(x, y, rect.width, rect.height)
}

/**
 * Lo que Molino pone encima de la presentación, en la ventana de Presentaciones
 * (a pantalla completa, en el proyector o en la única pantalla): la tinta de la
 * diapositiva, el punto del láser y la pantalla en negro o en blanco, que llegan
 * también de la vista del moderador; y, para usarlo sin ella, su barrita abajo a
 * la izquierda (sale al mover el ratón), su menú con el botón derecho y las
 * teclas de PowerPoint (presenter.ts). La presentación sigue siendo la del editor.
 */
export function ShowLayer({ presenting }: { presenting: boolean }) {
  useSyncExternalStore(subscribeShow, showRevision)
  const view = presenting ? showView() : null
  const root = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
  const [awake, setAwake] = useState(false)
  const [hovering, setHovering] = useState(false)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const sleep = useRef(0)
  const ew = view?.ew ?? null
  const aspect = view?.aspect ?? 16 / 9

  // Dónde está la diapositiva: la presentación del editor, centrada y entera en su sitio.
  const measure = useCallback(() => {
    const element = root.current
    if (!element || !ew) return
    const own = element.getBoundingClientRect()
    let area = own
    try {
      const preview = ew.document.getElementById('presentation-preview') ?? ew.document.getElementById('pe-preview')
      if (preview) {
        const rect = toTop(ew, preview.getBoundingClientRect())
        if (rect.width > 0 && rect.height > 0) area = rect
      }
    } catch {
      /* sin el editor: toda la capa */
    }
    const fit = fitBox(area.width, area.height, aspect)
    const next = { left: Math.round(area.left - own.left + fit.left), top: Math.round(area.top - own.top + fit.top), width: Math.round(fit.width), height: Math.round(fit.height) }
    setBox((old) => (old && old.left === next.left && old.top === next.top && old.width === next.width && old.height === next.height ? old : next))
  }, [ew, aspect])
  useLayoutEffect(() => {
    if (!ew) return
    measure()
    const element = root.current
    const observer = new ResizeObserver(measure)
    if (element) observer.observe(element)
    // La ventana tarda un poco en ponerse a pantalla completa.
    const timers = [200, 600, 1500].map((ms) => window.setTimeout(measure, ms))
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      timers.forEach((t) => window.clearTimeout(t))
      window.removeEventListener('resize', measure)
    }
  }, [ew, measure])

  // La barrita sale al mover el ratón (sobre la presentación, que es del editor, o sobre la capa).
  const wake = useCallback(() => {
    setAwake(true)
    window.clearTimeout(sleep.current)
    sleep.current = window.setTimeout(() => setAwake(false), HIDE_MS)
  }, [])
  useEffect(() => () => window.clearTimeout(sleep.current), [])

  // El ratón, el botón derecho y el teclado, también cuando están en el editor.
  useEffect(() => {
    if (!ew) return
    const doc: Document = ew.document
    const onMenu = (event: MouseEvent): void => {
      event.preventDefault()
      event.stopPropagation()
      const at = toTop(ew, new DOMRect(event.clientX, event.clientY, 0, 0))
      setMenu({ x: at.left, y: at.top })
    }
    doc.addEventListener('mousemove', wake, true)
    doc.addEventListener('contextmenu', onMenu, true)
    // Con el teclado en esta ventana (tras pulsar en la barrita): lo de Molino y, si no, pasar, volver y terminar.
    const onKey = (event: KeyboardEvent): void => {
      if (document.querySelector('.menu')) return
      if (showKey(event)) {
        event.preventDefault()
        event.stopImmediatePropagation()
        return
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const go: Record<string, Parameters<typeof showGo>[0]> = {
        ArrowRight: 'next',
        ArrowDown: 'next',
        PageDown: 'next',
        ' ': 'next',
        Enter: 'next',
        n: 'next',
        N: 'next',
        ArrowLeft: 'prev',
        ArrowUp: 'prev',
        PageUp: 'prev',
        Backspace: 'prev',
        p: 'prev',
        P: 'prev',
        Home: 'first',
        End: 'last',
        Escape: 'end'
      }
      const action = go[event.key]
      if (!action) return
      event.preventDefault()
      event.stopImmediatePropagation()
      showGo(action)
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      doc.removeEventListener('mousemove', wake, true)
      doc.removeEventListener('contextmenu', onMenu, true)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [ew, wake])

  // Lo que se pulsa aquí no se queda con el teclado: vuelve a la presentación del editor.
  const refocus = useCallback(() => {
    try {
      ew?.focus()
    } catch {
      /* sin el editor */
    }
  }, [ew])

  if (!view) return null
  const tool = view.tool
  const entries: MenuEntry[] = [
    { label: P.nextSlide, icon: <ChevronRight size={15} />, onSelect: () => showGo('next') },
    { label: P.prev, icon: <ChevronLeft size={15} />, onSelect: () => showGo('prev') },
    'sep',
    { label: K.laser, icon: <CircleDot size={15} />, kbd: 'Ctrl+L', checked: tool === 'laser', onSelect: () => showTool(tool === 'laser' ? null : 'laser') },
    { label: K.pen, icon: <Pen size={15} />, kbd: 'Ctrl+P', checked: tool === 'pen', onSelect: () => showTool(tool === 'pen' ? null : 'pen') },
    { label: K.highlighter, icon: <Highlighter size={15} />, kbd: 'Ctrl+I', checked: tool === 'highlighter', onSelect: () => showTool(tool === 'highlighter' ? null : 'highlighter') },
    { label: K.eraser, icon: <Eraser size={15} />, kbd: 'Ctrl+E', checked: tool === 'eraser', onSelect: () => showTool(tool === 'eraser' ? null : 'eraser') },
    { label: K.arrow, icon: <MousePointer2 size={15} />, kbd: 'Ctrl+A', checked: tool === null, onSelect: () => showTool(null) },
    { label: K.clearAll, icon: <Trash2 size={15} />, kbd: 'E', disabled: view.strokes.length === 0, onSelect: () => showInk({ op: 'clear' }) },
    'sep',
    { label: K.covered.black, icon: <Square size={15} fill="currentColor" />, kbd: 'B', checked: view.screen === 'black', onSelect: () => showScreen(view.screen === 'black' ? null : 'black') },
    { label: K.covered.white, icon: <Square size={15} />, kbd: 'W', checked: view.screen === 'white', onSelect: () => showScreen(view.screen === 'white' ? null : 'white') },
    'sep',
    { label: K.end, icon: <X size={15} />, kbd: 'Esc', onSelect: () => showGo('end') }
  ]
  return (
    <div
      ref={root}
      className="show-layer"
      onMouseMove={wake}
      onContextMenu={(event) => {
        event.preventDefault()
        setMenu({ x: event.clientX, y: event.clientY })
      }}
    >
      {box && (
        <div className="show-slide" style={box}>
          <InkLayer
            strokes={view.strokes}
            tool={tool}
            color={view.color}
            width={view.width}
            laser={view.laser}
            aspect={aspect}
            side="s"
            onInk={showInk}
            onLaser={showLaser}
            onTap={() => showGo('next')}
          />
        </div>
      )}
      {view.screen && (
        <button
          className={cn('show-cover', view.screen)}
          aria-label={K.covered[view.screen]}
          onClick={() => {
            showScreen(null)
            refocus()
          }}
        />
      )}
      <div
        className={cn('show-bar', (awake || hovering) && 'on')}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onMouseDown={(event) => event.preventDefault()}
        onClickCapture={(event) => {
          // Salvo en el color de la tinta (su menú sigue abierto), el teclado vuelve a la presentación.
          if (!(event.target as HTMLElement).closest('.ink-color')) window.setTimeout(refocus, 0)
        }}
      >
        <InkTools
          tool={tool}
          color={view.color}
          width={view.width}
          screen={view.screen}
          onTool={showTool}
          onColor={showColor}
          onWidth={showWidth}
          onClear={() => showInk({ op: 'clear' })}
          onScreen={showScreen}
          before={
            <div className="ink-group">
              <button className="tool icon" aria-label={K.prev} data-tip={K.prev} data-tip-side="top" onClick={() => showGo('prev')}>
                <ChevronLeft size={16} />
              </button>
              <span className="show-where">{view.finished ? P.finished : fmt(P.slide, { n: view.index + 1, total: view.count })}</span>
              <button className="tool icon" aria-label={K.next} data-tip={K.next} data-tip-side="top" onClick={() => showGo('next')}>
                <ChevronRight size={16} />
              </button>
            </div>
          }
          after={
            <div className="ink-group">
              <button className="tool icon" aria-label={K.end} data-tip={K.end} data-tip-side="top" onClick={() => showGo('end')}>
                <X size={16} />
              </button>
            </div>
          }
        />
      </div>
      {menu && (
        <Menu
          anchor={menu}
          minWidth={240}
          entries={entries}
          onClose={() => {
            setMenu(null)
            window.setTimeout(refocus, 0)
          }}
        />
      )}
    </div>
  )
}
