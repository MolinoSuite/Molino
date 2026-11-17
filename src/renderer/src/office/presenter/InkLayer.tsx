import { useEffect, useRef } from 'react'
import type { InkColor, InkStroke } from '@shared/officeui'
import { clamp01, drawInk, type HandTool, type LocalInkOp, MAX_OP_NUMBERS, type Point, round4, strokeId, touched } from './ink'
import './inktools.css'

/** Lo que se aleja el ratón entre dos puntos de un trazo (en proporción del ancho) para apuntarlo. */
const STEP = 0.0015
/** El radio del borrador (en proporción del ancho). */
const ERASER = 0.014
/** Un clic con el láser (sin moverse apenas): pasa a la siguiente, como un clic en la presentación. */
const TAP = 0.006

/**
 * La capa de tinta encima de una diapositiva (ocupa justo la diapositiva): pinta
 * los trazos y el punto del láser y, con una herramienta en la mano, recoge lo
 * que se dibuja, se borra o se señala. Sin herramienta deja pasar el ratón a lo
 * de debajo. Lo dibujado se avisa en trozos (``onInk``), uno por fotograma, para
 * que llegue a la otra ventana mientras se dibuja.
 */
export function InkLayer({
  strokes,
  tool,
  color,
  width,
  laser,
  aspect,
  side,
  onInk,
  onLaser,
  onTap
}: {
  strokes: InkStroke[]
  tool: HandTool
  color: InkColor
  width: 1 | 2 | 3
  /** Dónde se ve el punto del láser (null: no se ve). */
  laser: Point | null
  /** Ancho / alto de la diapositiva. */
  aspect: number
  /** Quién dibuja (para los nombres de los trazos): «p», la vista del moderador; «s», la presentación. */
  side: 'p' | 's'
  onInk: (op: LocalInkOp) => void
  onLaser: (at: Point | null) => void
  /** Un clic con el láser: pasar de diapositiva. */
  onTap?: () => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const size = useRef({ w: 0, h: 0, dpr: 1 })
  const latest = useRef(strokes)
  latest.current = strokes
  // El trazo que se está dibujando (o lo que va borrando el borrador) y lo que falta avisar.
  const drawing = useRef<{ id: string; last: Point; pending: number[]; frame: number } | null>(null)
  const erasing = useRef<Set<string> | null>(null)
  const laserFrame = useRef<{ frame: number; at: Point | null }>({ frame: 0, at: null })
  const down = useRef<Point | null>(null)
  const handlers = useRef({ onInk, onLaser, onTap })
  handlers.current = { onInk, onLaser, onTap }

  const paint = (): void => {
    const element = canvas.current
    const context = element?.getContext('2d')
    if (!element || !context) return
    const { w, h, dpr } = size.current
    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawInk(context, latest.current, w, h)
  }

  // El lienzo, del tamaño de la diapositiva (con la densidad de la pantalla).
  useEffect(() => {
    const element = box.current
    if (!element) return
    const fit = (): void => {
      const rect = element.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      size.current = { w: rect.width, h: rect.height, dpr }
      if (canvas.current) {
        canvas.current.width = Math.max(1, Math.round(rect.width * dpr))
        canvas.current.height = Math.max(1, Math.round(rect.height * dpr))
      }
      paint()
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(element)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(paint, [strokes])

  // Al soltar la herramienta: lo que quedaba por avisar y el láser, fuera.
  useEffect(() => {
    if (tool !== 'laser' && laserFrame.current.at) {
      laserFrame.current.at = null
      handlers.current.onLaser(null)
    }
    return () => {
      flush()
      cancelAnimationFrame(laserFrame.current.frame)
      laserFrame.current.frame = 0
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool])

  const where = (event: { clientX: number; clientY: number }): Point => {
    const rect = box.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 }
    return { x: clamp01((event.clientX - rect.left) / rect.width), y: clamp01((event.clientY - rect.top) / rect.height) }
  }

  /** Lo dibujado que falta por avisar, en trozos que caben en un aviso. */
  const flush = (): void => {
    const now = drawing.current
    if (!now) return
    cancelAnimationFrame(now.frame)
    now.frame = 0
    while (now.pending.length) handlers.current.onInk({ op: 'add', id: now.id, points: now.pending.splice(0, MAX_OP_NUMBERS) })
  }
  const later = (): void => {
    const now = drawing.current
    if (now && !now.frame) now.frame = requestAnimationFrame(() => {
      if (drawing.current) drawing.current.frame = 0
      flush()
    })
  }
  const sendLaser = (at: Point | null): void => {
    const state = laserFrame.current
    state.at = at
    if (state.frame) return
    state.frame = requestAnimationFrame(() => {
      state.frame = 0
      handlers.current.onLaser(state.at)
    })
  }
  const erase = (at: Point): void => {
    const gone = erasing.current
    if (!gone) return
    const ids = touched(latest.current, at.x, at.y, ERASER, aspect).filter((id) => !gone.has(id))
    if (!ids.length) return
    ids.forEach((id) => gone.add(id))
    handlers.current.onInk({ op: 'erase', ids })
  }

  const active = tool !== null
  return (
    <div
      ref={box}
      className={`ink-layer${active ? ` with-${tool}` : ''}`}
      data-strokes={strokes.length}
      onPointerDown={(event) => {
        if (!active || event.button !== 0) return
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        const at = where(event)
        down.current = at
        if (tool === 'pen' || tool === 'highlighter') {
          const id = strokeId(side)
          drawing.current = { id, last: at, pending: [], frame: 0 }
          handlers.current.onInk({ op: 'begin', stroke: { id, tool, color, width, points: [round4(at.x), round4(at.y)] } })
        } else if (tool === 'eraser') {
          erasing.current = new Set()
          erase(at)
        } else if (tool === 'laser') sendLaser(at)
      }}
      onPointerMove={(event) => {
        if (!active) return
        const now = drawing.current
        if (now) {
          // Todos los puntos del movimiento (el ratón puede ir más deprisa que los fotogramas).
          const events = typeof event.nativeEvent.getCoalescedEvents === 'function' ? event.nativeEvent.getCoalescedEvents() : []
          for (const one of events.length ? events : [event]) {
            const at = where(one)
            if (Math.hypot(at.x - now.last.x, (at.y - now.last.y) / aspect) < STEP) continue
            now.last = at
            now.pending.push(round4(at.x), round4(at.y))
          }
          later()
        } else if (erasing.current) erase(where(event))
        else if (tool === 'laser') sendLaser(where(event))
      }}
      onPointerUp={(event) => {
        const start = down.current
        down.current = null
        if (drawing.current) {
          flush()
          drawing.current = null
        }
        erasing.current = null
        if (tool === 'laser' && start) {
          const at = where(event)
          if (Math.hypot(at.x - start.x, at.y - start.y) < TAP) handlers.current.onTap?.()
        }
      }}
      onPointerCancel={() => {
        flush()
        drawing.current = null
        erasing.current = null
        down.current = null
      }}
      onPointerLeave={() => {
        if (tool === 'laser') sendLaser(null)
      }}
    >
      <canvas ref={canvas} className="ink-canvas" />
      {laser && <span className="ink-laser-dot" style={{ left: `${laser.x * 100}%`, top: `${laser.y * 100}%` }} />}
    </div>
  )
}
