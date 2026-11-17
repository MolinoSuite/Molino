import { type ReactNode, type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { naturalSize, placeNear } from '@/components/ui'
import { cn } from '@/lib/cn'

/**
 * Los desplegables de Documentos, Hojas y Presentaciones (menús visuales,
 * colores, letras, estilos…), todos con el mismo aspecto y comportamiento:
 * se cierran al pulsar fuera (también en el documento: el editor avisa, engine.ts),
 * con Esc, al cambiar de ventana o de pestaña, y al abrir uno se cierra el que
 * estuviera abierto (salvo el que lo contiene: «Más»). Miden lo que necesita su
 * contenido y, si la ventana es baja, lo que quepa (con barra de desplazamiento).
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
 * dentro de la ventana (si no cabe debajo, encima; si tampoco, en el lado con
 * más sitio y con la altura que quepa). ``trigger``: el botón que lo abre
 * (pulsarlo no cuenta como «fuera»: ese botón lo cierra él mismo); si la
 * ventana cambia de tamaño, se vuelve a colocar junto a él.
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
  const [place, setPlace] = useState<{ left: number; top: number; maxHeight: number } | null>(null)
  useOnlyOne(true, onClose, () => ref.current)

  const layout = useCallback(
    (rect: DOMRect): void => {
      const element = ref.current
      if (element) setPlace(placeNear(rect, naturalSize(element), { align, side }))
    },
    [align, side]
  )
  useLayoutEffect(() => layout(anchor), [anchor, layout])

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
    // Con otro tamaño de ventana, junto al botón donde esté ahora (si ya no está, se cierra).
    const onResize = (): void => {
      const button = trigger?.current
      const rect = button?.isConnected ? button.getBoundingClientRect() : null
      if (rect && rect.width > 0) layout(rect)
      else onClose()
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('blur', onBlur)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('resize', onResize)
    }
  }, [onClose, trigger, layout])

  const depth = useRef(opened.size)
  return createPortal(
    <div
      ref={ref}
      className={cn('office-popover', className)}
      role={role}
      aria-label={label}
      data-depth={depth.current}
      style={{ left: place?.left ?? 0, top: place?.top ?? 0, maxHeight: place?.maxHeight, visibility: place ? 'visible' : 'hidden' }}
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
