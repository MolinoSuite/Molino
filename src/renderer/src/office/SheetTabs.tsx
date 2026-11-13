import { Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import { Menu, type MenuEntry } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { PromptSpec } from './dialogs'
import type { EditorState } from './engine'
import { L } from './i18n'

const T = L.office
type Run = (command: string, value?: string) => unknown

/** Colores de las pestañas de las hojas (el primero, sin color). */
const TAB_COLORS = [
  { name: 'none', hex: '' },
  { name: 'red', hex: '#c4505a' },
  { name: 'orange', hex: '#e06a1a' },
  { name: 'yellow', hex: '#d4a72c' },
  { name: 'green', hex: '#2a9358' },
  { name: 'blue', hex: '#2867d1' },
  { name: 'purple', hex: '#7a5af5' }
] as const

/**
 * Las pestañas de las hojas del libro, abajo, como pestañas de verdad (la
 * activa sale del borde y se une a la hoja). Se ordenan arrastrándolas; con
 * doble clic se cambia el nombre y con el botón derecho, lo de Excel: duplicar,
 * mover, color, ocultar, mostrar las ocultas y eliminar.
 */
export function SheetTabs({ state, run, ask }: { state: EditorState; run: Run; ask: (spec: PromptSpec) => void }) {
  const [menu, setMenu] = useState<{ at: { x: number; y: number }; index: number } | null>(null)
  // Arrastrando: la hoja y el hueco (entre pestañas) donde caería.
  const [drag, setDrag] = useState<{ index: number; gap: number } | null>(null)
  const strip = useRef<HTMLDivElement>(null)
  const start = useRef<{ x: number; index: number; moved: boolean } | null>(null)
  const S = T.sheetMenu
  const rename = (index: number): void => {
    const sheet = state.sheets.find((s) => s.index === index)
    if (!sheet) return
    ask({
      title: S.rename,
      fields: [{ key: 'name', label: S.name, value: sheet.name, maxLength: 31, hint: S.nameHint }],
      onOk: (v) => run('renameSheet', `${index}|${v.name.trim()}`)
    })
  }
  const entries = (index: number): MenuEntry[] => {
    const position = state.sheets.findIndex((s) => s.index === index)
    const out: MenuEntry[] = [
      { label: S.rename, onSelect: () => rename(index) },
      { label: S.duplicate, onSelect: () => run('copySheet', String(index)) },
      { label: S.moveLeft, disabled: position <= 0, onSelect: () => run('moveSheet', `${index}|left`) },
      { label: S.moveRight, disabled: position >= state.sheets.length - 1, onSelect: () => run('moveSheet', `${index}|right`) },
      { heading: S.color },
      ...TAB_COLORS.map(
        (c): MenuEntry => ({
          label: S.colors[c.name],
          icon: <span className="menu-swatch" style={{ background: c.hex || 'transparent' }} />,
          onSelect: () => run('sheetColor', `${index}|${c.hex}`)
        })
      ),
      'sep',
      { label: S.hide, disabled: state.sheets.length < 2, onSelect: () => run('hideSheet', String(index)) }
    ]
    if (state.hiddenSheets.length) {
      out.push({ heading: S.unhide })
      for (const hidden of state.hiddenSheets) out.push({ label: hidden.name, onSelect: () => run('showSheet', String(hidden.index)) })
    }
    out.push('sep', { label: S.delete, danger: true, disabled: state.sheets.length < 2, onSelect: () => run('deleteSheet', String(index)) })
    return out
  }
  /** El hueco entre pestañas más cercano a x (0: antes de la primera). */
  const gapAt = (x: number): number => {
    const tabs = [...(strip.current?.querySelectorAll<HTMLElement>('.sheet') ?? [])]
    for (let i = 0; i < tabs.length; i++) {
      const box = tabs[i].getBoundingClientRect()
      if (x < box.left + box.width / 2) return i
    }
    return tabs.length
  }
  return (
    <div className="office-sheets" ref={strip} role="tablist" aria-label={T.sheetTabs}>
      {state.sheets.map((sheet, position) => (
        <button
          key={sheet.index}
          role="tab"
          className={cn('sheet', sheet.index === state.activeSheet && 'on', drag?.index === sheet.index && 'dragging', drag && drag.gap === position && 'drop-before', drag && drag.gap === state.sheets.length && position === state.sheets.length - 1 && 'drop-after')}
          aria-selected={sheet.index === state.activeSheet}
          style={sheet.color ? ({ '--sheet-color': sheet.color } as React.CSSProperties) : undefined}
          onPointerDown={(e) => {
            if (e.button !== 0) return
            start.current = { x: e.clientX, index: sheet.index, moved: false }
            e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            const s = start.current
            if (!s) return
            if (!s.moved && Math.abs(e.clientX - s.x) < 6) return
            s.moved = true
            setDrag({ index: s.index, gap: gapAt(e.clientX) })
          }}
          onPointerUp={(e) => {
            const s = start.current
            start.current = null
            if (s?.moved) {
              const gap = gapAt(e.clientX)
              const from = state.sheets.findIndex((x) => x.index === s.index)
              setDrag(null)
              // Soltar al lado de donde estaba no la mueve.
              if (gap !== from && gap !== from + 1) run('moveSheetTo', `${s.index}|${gap}`)
              return
            }
            setDrag(null)
          }}
          onPointerCancel={() => {
            start.current = null
            setDrag(null)
          }}
          onClick={(e) => {
            if (e.detail === 0 || !drag) run('goSheet', String(sheet.index))
          }}
          onDoubleClick={() => rename(sheet.index)}
          onContextMenu={(e) => {
            // Sin cambiar de hoja: eso devuelve el teclado al documento y cerraría el menú.
            e.preventDefault()
            setMenu({ at: { x: e.clientX, y: e.clientY }, index: sheet.index })
          }}
        >
          {sheet.color && <span className="sheet-color" />}
          <span className="sheet-name">{sheet.name}</span>
        </button>
      ))}
      {menu && <Menu anchor={menu.at} side="top" minWidth={200} entries={entries(menu.index)} onClose={() => setMenu(null)} />}
      <button className="icon-btn sm office-sheet-add" aria-label={T.tools.newSheet} data-tip={T.tools.newSheet} data-tip-side="top" onClick={() => run('newSheet')}>
        <Plus size={14} />
      </button>
    </div>
  )
}
