import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { type ReactNode, type WheelEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { L } from '@/i18n'
import { cn } from '@/lib/util'
import { MenuButton } from './ui'

/**
 * La tira de pestañas de la barra de título (todas las apps de Molino), como
 * en un navegador: las pestañas se estrechan hasta un ancho mínimo (el nombre,
 * recortado con «…»); si aun así no caben, la tira se desplaza (rueda del ratón,
 * flechas a los lados y un botón con la lista de todas) y lo demás de la barra
 * no se mueve. La pestaña activa siempre a la vista.
 */

export interface StripTab {
  id: string
  name: string
}

/** Lo que se desplaza con cada flecha: casi lo que se ve. */
const STEP = 0.75
/** Lo que se deja a la vista junto a la pestaña activa (para ver que hay más). */
const MARGIN = 24

export function TabStrip({ tabs, active, onActivate, label, children }: { tabs: StripTab[]; active: string | null; onActivate: (id: string) => void; label?: string; children: ReactNode }) {
  const T = L.shell.titleBar
  const scroller = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ overflow: false, start: true, end: true })

  /** Lo que ocupan las pestañas (la última y su borde; las etiquetas emergentes, invisibles, no cuentan). */
  const contentWidth = (el: HTMLElement): number => {
    const last = el.lastElementChild as HTMLElement | null
    return last ? last.offsetLeft + last.offsetWidth : 0
  }
  const measure = useCallback(() => {
    const el = scroller.current
    if (!el) return
    const width = contentWidth(el)
    const next = { overflow: width > el.clientWidth + 1, start: el.scrollLeft <= 1, end: el.scrollLeft + el.clientWidth >= width - 1 }
    setEdges((now) => (now.overflow === next.overflow && now.start === next.start && now.end === next.end ? now : next))
  }, [])
  /** Desplaza la tira hasta la pestaña activa (si no se ve entera). */
  const reveal = useCallback(() => {
    const el = scroller.current
    const tab = el?.querySelector<HTMLElement>('.tab.on')
    if (!el || !tab) return
    if (tab.offsetLeft < el.scrollLeft) el.scrollLeft = Math.max(0, tab.offsetLeft - MARGIN)
    else if (tab.offsetLeft + tab.offsetWidth > el.scrollLeft + el.clientWidth) el.scrollLeft = tab.offsetLeft + tab.offsetWidth - el.clientWidth + MARGIN
  }, [])

  // Al cambiar de pestaña, al abrir o cerrar una: la activa, a la vista.
  useLayoutEffect(() => {
    reveal()
    measure()
  }, [active, tabs.length, reveal, measure])
  // Con otro ancho de ventana, igual.
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      reveal()
      measure()
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [reveal, measure])

  const scrollBy = (direction: 1 | -1): void => {
    const el = scroller.current
    if (el) el.scrollBy({ left: direction * Math.max(80, el.clientWidth * STEP), behavior: 'smooth' })
  }
  const onWheel = (event: WheelEvent<HTMLDivElement>): void => {
    const el = scroller.current
    if (!el || !edges.overflow) return
    el.scrollLeft += Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
  }

  return (
    <div className={cn('tabs-strip', edges.overflow && 'overflow')}>
      {edges.overflow && (
        <button className="icon-btn sm tabs-arrow" aria-label={T.tabsBack} data-tip={T.tabsBack} disabled={edges.start} onClick={() => scrollBy(-1)}>
          <ChevronLeft size={15} />
        </button>
      )}
      <div ref={scroller} className="tabs" role="tablist" aria-label={label} onScroll={measure} onWheel={onWheel}>
        {children}
      </div>
      {edges.overflow && (
        <>
          <button className="icon-btn sm tabs-arrow" aria-label={T.tabsForward} data-tip={T.tabsForward} disabled={edges.end} onClick={() => scrollBy(1)}>
            <ChevronRight size={15} />
          </button>
          <MenuButton
            className="icon-btn sm tabs-list"
            label={T.allTabs}
            tip={T.allTabs}
            align="end"
            entries={() => tabs.map((tab) => ({ label: tab.name, checked: tab.id === active, onSelect: () => onActivate(tab.id) }))}
          >
            <ChevronDown size={15} />
          </MenuButton>
        </>
      )}
    </div>
  )
}
