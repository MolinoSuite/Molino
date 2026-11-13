import { Search } from 'lucide-react'
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import { L } from '@/i18n'
import { searchCommands, type SearchEntry } from '@/lib/commandSearch'
import { cn } from '@/lib/util'

/**
 * «¿Qué quieres hacer?»: el mismo buscador de órdenes en todas las apps de
 * Molino. Cada app da su lista (Molino PDF: PdfCommands.tsx; Documentos, Hojas
 * y Presentaciones: office/apps.tsx); el buscador entiende frases y sinónimos
 * (lib/commandSearch.ts).
 */

export interface PaletteItem extends SearchEntry {
  /** Único en la lista. */
  key: string
}

const MAX_SHOWN = 60

export function CommandPalette<T extends PaletteItem>({ entries, onChoose, onClose }: { entries: T[]; onChoose: (entry: T) => void; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const list = useRef<HTMLUListElement>(null)
  const found = useMemo(() => searchCommands(entries, query).slice(0, MAX_SHOWN), [entries, query])

  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [index])

  const choose = (entry: T | undefined): void => {
    if (!entry) return
    onClose()
    // Después de cerrar: así el teclado vuelve al documento antes de la orden.
    setTimeout(() => onChoose(entry), 0)
  }
  const onKey = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Escape') onClose()
    else if (event.key === 'ArrowDown') {
      event.preventDefault()
      setIndex((i) => Math.min(found.length - 1, i + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setIndex((i) => Math.max(0, i - 1))
    } else if (event.key === 'Enter') choose(found[index])
  }
  return (
    <div className="palette" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette-box" role="dialog" aria-label={L.shell.commands.button}>
        <div className="palette-input">
          <Search size={17} />
          <input
            autoFocus
            value={query}
            placeholder={L.shell.commands.placeholder}
            aria-label={L.shell.commands.button}
            spellCheck={false}
            maxLength={120}
            onChange={(e) => {
              setQuery(e.target.value)
              setIndex(0)
            }}
            onKeyDown={onKey}
          />
        </div>
        <ul role="listbox" ref={list}>
          {found.map((entry, i) => (
            <li key={entry.key} role="option" aria-selected={i === index} className={cn(i === index && 'on')} onMouseEnter={() => setIndex(i)} onClick={() => choose(entry)}>
              <span>{entry.label}</span>
              <span className="hint">{entry.group}</span>
            </li>
          ))}
          {found.length === 0 && <li className="hint">{L.shell.commands.empty}</li>}
        </ul>
      </div>
    </div>
  )
}

/** El botón de la barra de título que abre el buscador (Alt+Q). */
export function CommandSearchButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="command-search" onClick={onClick}>
      <Search size={15} />
      <span>{L.shell.commands.button}</span>
      <kbd>Alt Q</kbd>
    </button>
  )
}
