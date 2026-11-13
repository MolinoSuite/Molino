import { type ReactNode, type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'

/**
 * Los desplegables de Documentos, Hojas y Presentaciones (menús visuales,
 * colores, letras, estilos…), todos con el mismo aspecto y comportamiento:
 * se cierran al pulsar fuera, con Esc o al cambiar de ventana, y al abrir uno
 * se cierra el que estuviera abierto (salvo el que lo contiene: «Más»).
 */

/** Lo último que se pulsó: desde dónde se abre un desplegable. */
let lastPressed: Element | null = null
window.addEventListener(
  'pointerdown',
  (event) => {
    lastPressed = event.target instanceof Element ? event.target : null
  },
  true
)

interface Opened {
  close: () => void
  element: () => Element | null
}
const opened = new Set<Opened>()

/**
 * Mientras ``open``, este desplegable cuenta como abierto: al abrirse cierra los
 * demás que no contengan lo que se pulsó para abrirlo.
 */
export function useOnlyOne(open: boolean, close: () => void, element: () => Element | null): void {
  const closeRef = useRef(close)
  const elementRef = useRef(element)
  closeRef.current = close
  elementRef.current = element
  useEffect(() => {
    if (!open) return
    const source = lastPressed
    for (const other of [...opened]) {
      const root = other.element()
      if (!root || !source || !root.contains(source)) other.close()
    }
    const me: Opened = { close: () => closeRef.current(), element: () => elementRef.current() }
    opened.add(me)
    return () => {
      opened.delete(me)
    }
  }, [open])
}

/** Cierra todos los desplegables abiertos (al elegir algo en uno anidado, por ejemplo). */
export function closeAllPops(): void {
  for (const other of [...opened]) other.close()
}

/**
 * Un desplegable anclado a un botón: en una capa encima de todo, siempre
 * dentro de la ventana (si no cabe debajo, encima). ``trigger``: el botón que
 * lo abre (pulsarlo no cuenta como «fuera»: ese botón lo cierra él mismo).
 */
export function Pop({
  anchor,
  trigger,
  onClose,
  children,
  className,
  align = 'start',
  side = 'bottom',
  label,
  role = 'dialog'
}: {
  anchor: DOMRect
  trigger?: RefObject<HTMLElement | null>
  onClose: () => void
  children: ReactNode
  className?: string
  align?: 'start' | 'center' | 'end'
  side?: 'bottom' | 'top'
  label?: string
  role?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null)
  useOnlyOne(true, onClose, () => ref.current)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const box = element.getBoundingClientRect()
    let left = align === 'end' ? anchor.right - box.width : align === 'center' ? anchor.left + anchor.width / 2 - box.width / 2 : anchor.left
    let top = side === 'top' ? anchor.top - box.height - 6 : anchor.bottom + 6
    left = Math.max(8, Math.min(left, window.innerWidth - box.width - 8))
    if (side === 'bottom' && top + box.height > window.innerHeight - 8) top = Math.max(8, anchor.top - box.height - 6)
    if (side === 'top' && top < 8) top = Math.min(anchor.bottom + 6, window.innerHeight - box.height - 8)
    setPlace({ left, top: Math.max(8, top) })
  }, [anchor, align, side])

  useEffect(() => {
    const onDown = (event: PointerEvent): void => {
      const target = event.target as Node
      if (ref.current?.contains(target) || trigger?.current?.contains(target)) return
      // Lo que se abre desde este (otro desplegable, un menú) no cuenta como fuera.
      if (target instanceof Element && target.closest('.office-popover, .menu') && !ref.current?.contains(target)) {
        const other = target.closest('.office-popover, .menu')
        if (other && other !== ref.current && Number((other as HTMLElement).dataset.depth ?? 0) > depthOf(ref.current)) return
      }
      onClose()
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    // Pulsar en el documento (otro marco) quita el foco a la ventana: eso también es «fuera».
    // Justo al abrirse no: el editor puede recuperar el foco de lo que se hizo antes.
    const openedAt = Date.now()
    const onBlur = (): void => {
      if (Date.now() - openedAt > 400) onClose()
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('blur', onBlur)
    window.addEventListener('resize', onClose)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose, trigger])

  const depth = useRef(opened.size)
  return createPortal(
    <div
      ref={ref}
      className={cn('office-popover', className)}
      role={role}
      aria-label={label}
      data-depth={depth.current}
      style={{ left: place?.left ?? 0, top: place?.top ?? 0, visibility: place ? 'visible' : 'hidden' }}
    >
      {children}
    </div>,
    document.body
  )
}

function depthOf(element: HTMLElement | null): number {
  return Number(element?.dataset.depth ?? 0)
}

/** Un botón que abre su desplegable (lo cierra si ya está abierto). */
export function usePopButton(): {
  anchor: DOMRect | null
  button: RefObject<HTMLButtonElement | null>
  toggle: () => void
  close: () => void
} {
  const button = useRef<HTMLButtonElement>(null)
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  return {
    anchor,
    button,
    toggle: () => setAnchor((now) => (now ? null : (button.current?.getBoundingClientRect() ?? null))),
    close: () => setAnchor(null)
  }
}
