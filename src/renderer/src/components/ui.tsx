import { Check } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'

/**
 * Marca de la aplicación: el icono de Molino PDF, un folio cerrado con su sello
 * de lacre. Cada tamaño usa su dibujo, como en la guía de marca de la suite
 * (marca\svg\icono-pdf*.svg): el de 24 px entre 21 y 24, el de la rejilla de 16
 * para lo más pequeño y hasta 32, y el grande a partir de 33. Lleva sus colores
 * propios (los de la marca), no los del tema.
 */
const PDF_RED = '#B92B32'
const PAPER = '#F5EFDF'
const INK = '#1C1B19'
const SEAL = '#7A1C22'

export function Logo({ size = 20 }: { size?: number }) {
  if (size >= 33) {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
        <rect x="2" y="2" width="60" height="60" rx="14" fill={PDF_RED} />
        <path d="M17 11 H34 L43 20 V53 H17 Z" fill={PAPER} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
        <path d="M34 11 V20 H43" fill="none" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
        <path d="M22 26 H36 M22 32 H32" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="40" cy="44" r="9" fill={SEAL} stroke={INK} strokeWidth="2.2" />
        <circle cx="40" cy="44" r="4.6" fill="none" stroke={PAPER} strokeWidth="1.6" />
      </svg>
    )
  }
  if (size >= 21 && size <= 24) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <rect x="0" y="0" width="24" height="24" rx="5" fill={PDF_RED} />
        <path d="M4.5 3.5 H13.5 L17.5 7.5 V20.5 H4.5 Z" fill={PAPER} stroke={INK} strokeWidth="1" strokeLinejoin="round" />
        <path d="M13.5 3.5 V7.5 H17.5" fill="none" stroke={INK} strokeWidth="1" />
        <path d="M7 10.5 H13 M7 13.5 H11" stroke={INK} strokeWidth="1" />
        <circle cx="15.5" cy="16.5" r="4.5" fill={SEAL} stroke={INK} strokeWidth="1" />
        <circle cx="15.5" cy="16.5" r="2" fill="none" stroke={PAPER} strokeWidth="1" />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <rect x="0" y="0" width="16" height="16" rx="3.5" fill={PDF_RED} />
      <path d="M2.5 2.5 H8.5 L11.5 5.5 V13.5 H2.5 Z" fill={PAPER} stroke={INK} strokeWidth="1" strokeLinejoin="round" />
      <path d="M8.5 2.5 V5.5 H11.5" fill="none" stroke={INK} strokeWidth="1" />
      <path d="M4 7.5 H8 M4 9.5 H6.5" stroke={INK} strokeWidth="1" />
      <circle cx="10.5" cy="11" r="3" fill={SEAL} stroke={INK} strokeWidth="1" />
    </svg>
  )
}

// ------------------------------------------------------------------- menús

export type MenuEntry =
  | {
      label: string
      icon?: ReactNode
      kbd?: string
      checked?: boolean
      disabled?: boolean
      danger?: boolean
      onSelect: () => void
    }
  | { heading: string }
  | 'sep'

/** Lo que abre un menú: su rectángulo, un punto de la pantalla o cómo leer su rectángulo ahora (si la ventana cambia de tamaño). */
export type MenuAnchor = DOMRect | { x: number; y: number } | (() => DOMRect | null)

/** El margen con el borde de la ventana y la separación con lo que abre el menú. */
const EDGE = 8
const GAP = 6

/**
 * Dónde va un menú o un desplegable junto a lo que lo abre: debajo (o encima,
 * si se pide) si cabe entero; si no, en el lado con más sitio y con la altura
 * que quepa (entonces, con barra de desplazamiento). Nunca tapa lo que lo abre,
 * salvo un punto (el menú del botón derecho), que se mueve para caber entero.
 * ``size``: lo que mide con todo su contenido. ``scroll``: si no cabe entero y
 * necesita barra (si cabe, sin barra: las etiquetas emergentes, invisibles, no la sacan).
 */
export function placeNear(
  anchor: DOMRect,
  size: { width: number; height: number },
  { align = 'start', side = 'bottom', point = false }: { align?: 'start' | 'center' | 'end'; side?: 'bottom' | 'top'; point?: boolean } = {}
): { left: number; top: number; maxHeight: number; scroll: boolean } {
  const gap = point ? 2 : GAP
  const below = window.innerHeight - anchor.bottom - gap - EDGE
  const above = anchor.top - gap - EDGE
  let where = side
  if (where === 'bottom' && size.height > below && above > below) where = 'top'
  else if (where === 'top' && size.height > above && below > above) where = 'bottom'
  const room = where === 'bottom' ? below : above
  let maxHeight = Math.max(0, Math.min(size.height, room))
  let top = where === 'bottom' ? anchor.bottom + gap : anchor.top - gap - maxHeight
  // Un punto, o casi sin sitio a ningún lado: entero si cabe en la ventana, aunque tape lo que lo abre.
  if ((point && size.height > room) || maxHeight < Math.min(size.height, 160)) {
    maxHeight = Math.min(size.height, window.innerHeight - 2 * EDGE)
    top = Math.max(EDGE, Math.min(where === 'bottom' ? anchor.bottom + gap : anchor.top - gap - maxHeight, window.innerHeight - EDGE - maxHeight))
  }
  let left = align === 'end' ? anchor.right - size.width : align === 'center' ? anchor.left + anchor.width / 2 - size.width / 2 : anchor.left
  left = Math.max(EDGE, Math.min(left, window.innerWidth - size.width - EDGE))
  return { left, top, maxHeight, scroll: maxHeight < size.height }
}

/**
 * Lo que mide un elemento con todo su contenido (sin el límite de alto que
 * tenga puesto). Su tamaño de verdad, no el de pantalla: mientras aparece, la
 * animación lo encoge un poco.
 */
export function naturalSize(element: HTMLElement): { width: number; height: number } {
  const before = element.style.maxHeight
  element.style.maxHeight = 'none'
  // Un píxel más: las medidas se redondean y, si se queda corto, sale una barra para medio píxel.
  const size = { width: element.offsetWidth, height: element.offsetHeight + 1 }
  element.style.maxHeight = before
  return size
}

const rectOf = (anchor: MenuAnchor): DOMRect | null => (typeof anchor === 'function' ? anchor() : 'width' in anchor ? anchor : new DOMRect(anchor.x, anchor.y, 0, 0))

interface MenuProps {
  /** Rectángulo del elemento que abre el menú, un punto de la pantalla o cómo leer el rectángulo ahora. */
  anchor: MenuAnchor
  align?: 'start' | 'end'
  side?: 'bottom' | 'top'
  entries: MenuEntry[]
  onClose: () => void
  minWidth?: number
}

/**
 * Un menú: mide lo que necesita su contenido y sale entero si cabe; si la
 * ventana es baja, con la altura que quepa y barra de desplazamiento. Si la
 * ventana cambia de tamaño, se vuelve a colocar (y a medir).
 */
export function Menu({ anchor, align = 'start', side = 'bottom', entries, onClose, minWidth }: MenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ left: number; top: number; maxHeight: number; scroll: boolean } | null>(null)
  const anchorRef = useRef(anchor)
  anchorRef.current = anchor

  const place = useCallback((): boolean => {
    const element = ref.current
    const rect = rectOf(anchorRef.current)
    if (!element || !rect) return false
    const point = typeof anchorRef.current !== 'function' && !('width' in anchorRef.current)
    setPosition(placeNear(rect, naturalSize(element), { align, side, point }))
    return true
  }, [align, side])

  useLayoutEffect(() => {
    place()
  }, [anchor, place, entries.length])

  useEffect(() => {
    const onDown = (event: PointerEvent): void => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose()
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    // Con otro tamaño de ventana, otro sitio y otra altura (si lo que lo abre ya no está, se cierra).
    const onResize = (): void => {
      if (!place()) onClose()
    }
    // Otra ventana: se cierra. El teclado que pasa a un documento (un editor que lo coge al
    // cargar) no: un clic en el documento ya lo cierra (el editor lo avisa, office/engine.ts).
    const onBlur = (): void => {
      setTimeout(() => {
        if (document.activeElement?.tagName !== 'IFRAME') onClose()
      }, 0)
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
  }, [onClose, place])

  return createPortal(
    <div
      ref={ref}
      className="menu"
      role="menu"
      style={{ left: position?.left ?? 0, top: position?.top ?? 0, maxHeight: position?.maxHeight, overflowY: position?.scroll ? 'auto' : 'hidden', visibility: position ? 'visible' : 'hidden', minWidth }}
    >
      {entries.map((entry, index) => {
        if (entry === 'sep') return <div key={index} className="menu-sep" />
        if ('heading' in entry) {
          return (
            <div key={index} className="menu-label">
              {entry.heading}
            </div>
          )
        }
        return (
          <button
            key={index}
            role="menuitem"
            className={cn('menu-item', entry.danger && 'danger')}
            disabled={entry.disabled}
            onClick={() => {
              onClose()
              entry.onSelect()
            }}
          >
            {entry.icon}
            <span>{entry.label}</span>
            {entry.checked ? <Check size={15} className="tick" /> : entry.kbd ? <span className="kbd">{entry.kbd}</span> : null}
          </button>
        )
      })}
    </div>,
    document.body
  )
}

/** Botón que abre un menú anclado a sí mismo. */
export function MenuButton({
  className,
  entries,
  children,
  align,
  side,
  tip,
  tipSide,
  disabled,
  label
}: {
  className?: string
  entries: MenuEntry[] | (() => MenuEntry[])
  children: ReactNode
  align?: 'start' | 'end'
  side?: 'bottom' | 'top'
  tip?: string
  tipSide?: 'top' | 'right' | 'left'
  disabled?: boolean
  /** Su nombre para el lector de pantalla, si el botón solo lleva un icono. */
  label?: string
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  // El menú se coloca junto al botón donde esté ahora (también si la ventana cambia de tamaño).
  const anchorNow = useCallback(() => (ref.current?.isConnected ? ref.current.getBoundingClientRect() : null), [])
  return (
    <>
      <button
        ref={ref}
        className={cn(className, anchor && 'on')}
        aria-label={label}
        data-tip={anchor ? undefined : tip}
        data-tip-side={tipSide}
        disabled={disabled}
        onClick={() => setAnchor(ref.current?.getBoundingClientRect() ?? null)}
      >
        {children}
      </button>
      {anchor && (
        <Menu
          anchor={anchorNow}
          align={align}
          side={side}
          entries={typeof entries === 'function' ? entries() : entries}
          onClose={() => setAnchor(null)}
        />
      )}
    </>
  )
}

// ------------------------------------------------------------------ diálogo

export function Dialog({
  title,
  children,
  footer,
  onClose,
  size,
  icon,
  className
}: {
  title: string
  children: ReactNode
  footer?: ReactNode
  onClose: () => void
  size?: 'wide' | 'xl'
  icon?: ReactNode
  /** Clase propia para diálogos con un diseño particular (p. ej. imprimir). */
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // El foco entra en el diálogo al abrirse: lo marcado con data-autofocus, el primer campo o el botón principal.
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const target =
      root.querySelector<HTMLElement>('[data-autofocus]') ??
      root.querySelector<HTMLElement>('input:not([type=checkbox]):not([type=radio]), textarea, select') ??
      root.querySelector<HTMLElement>('.btn.primary, .btn.danger')
    target?.focus()
  }, [])

  return createPortal(
    <div
      className="backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div ref={ref} className={cn('dialog', size, className)} role="dialog" aria-modal="true" aria-label={title}>
        <div className="dialog-head">
          {icon}
          <h2>{title}</h2>
        </div>
        <div className="dialog-body">{children}</div>
        {footer && <div className="dialog-foot">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}

// -------------------------------------------------------------- utilidades

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  full
}: {
  value: T
  options: { value: T; label: ReactNode; tip?: string }[]
  onChange: (value: T) => void
  full?: boolean
}) {
  return (
    <div className={cn('segmented', full && 'full')}>
      {options.map((option) => (
        <button
          key={option.value}
          className={cn(option.value === value && 'on')}
          data-tip={option.tip}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Checkbox({
  checked,
  onChange,
  children,
  disabled
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  children: ReactNode
  disabled?: boolean
}) {
  return (
    <label className="check" style={disabled ? { opacity: 0.5 } : undefined}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span>{children}</span>
    </label>
  )
}
