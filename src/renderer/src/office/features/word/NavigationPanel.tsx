import { useEffect, useRef } from 'react'
import { cn } from '@/lib/cn'
import { L } from '../../i18n'
import type { PanelProps } from '../types'
import { extraOf } from './data'

const N = L.officeWord.nav

/**
 * Navegación: los títulos del documento (los párrafos con estilo de título o
 * nivel de esquema), con su nivel; al pulsar uno, el cursor va allí. Se
 * actualiza con cada cambio (los avisos del esquema del editor, que solo
 * llegan con el panel abierto).
 */
export function NavigationPanel({ session, state, run }: PanelProps) {
  const list = useRef<HTMLDivElement>(null)
  const extra = extraOf(state)
  const items = extra.outline ?? []
  const current = extra.outlinePos ?? -1

  useEffect(() => {
    const api = session.featureContext().api
    try {
      api.asc_ShowDocumentOutline()
    } catch {
      /* sin esquema */
    }
    run('navRead')
    return () => {
      try {
        api.asc_HideDocumentOutline()
      } catch {
        /* el editor ya no está */
      }
    }
  }, [session, run])

  // El título donde está el cursor, a la vista.
  useEffect(() => {
    list.current?.querySelector('.on')?.scrollIntoView({ block: 'nearest' })
  }, [current])

  if (items.length === 0 || (items.length === 1 && items[0].start)) return <p className="hint office-word-nav-empty">{N.empty}</p>
  return (
    <div ref={list} className="office-word-nav" role="tree" aria-label={N.title}>
      {items.map((item, i) => (
        <button
          key={i}
          role="treeitem"
          aria-level={item.level + 1}
          aria-selected={i === current}
          className={cn('office-word-nav-item', i === current && 'on', item.start && 'beginning')}
          style={{ paddingLeft: 8 + Math.min(item.level, 8) * 14 }}
          title={item.text || N.beginning}
          onClick={() => run('navGo', String(i))}
        >
          <span className={cn('lvl', `l${Math.min(item.level, 3)}`)}>{item.start ? '' : item.level + 1}</span>
          <span className="text">{item.start ? N.beginning : item.text || '—'}</span>
        </button>
      ))}
    </div>
  )
}
