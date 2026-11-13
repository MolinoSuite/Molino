import { memo, useEffect, useRef, useState } from 'react'
import type { OutlineItem, PageInfo } from '@shared/types'
import { L } from '@/i18n'
import { query } from '@/lib/api'
import { useThumb } from '@/lib/thumb'
import { cn } from '@/lib/util'
import { viewerOf } from '@/lib/viewerControl'
import { type DocView, useApp } from '@/state/app'
import { Segmented } from './ui'

const THUMB_WIDTH = 150
const THUMB_MAX_HEIGHT = 214


const Thumb = memo(function Thumb({ doc, page, index, active }: { doc: string; page: PageInfo; index: number; active: boolean }) {
  const button = useRef<HTMLButtonElement>(null)
  let width = THUMB_WIDTH
  let height = (THUMB_WIDTH * page.h) / page.w
  if (height > THUMB_MAX_HEIGHT) {
    width = (THUMB_MAX_HEIGHT * page.w) / page.h
    height = THUMB_MAX_HEIGHT
  }
  const { holder, canvas } = useThumb(doc, page, width)

  useEffect(() => {
    if (active) button.current?.scrollIntoView({ block: 'nearest' })
  }, [active])

  return (
    <button ref={button} className={cn('thumb', active && 'on')} onClick={() => viewerOf(doc)?.scrollToPage(page.id)}>
      <div ref={holder} className="thumb-frame" style={{ width, height }}>
        <canvas ref={canvas} />
      </div>
      <span className="thumb-num">{index + 1}</span>
    </button>
  )
})

function Outline({ doc }: { doc: DocView }) {
  const [items, setItems] = useState<OutlineItem[] | null>(null)
  const structure = doc.pages.length

  useEffect(() => {
    let alive = true
    query<{ items: OutlineItem[] }>('doc.outline', { doc: doc.id })
      .then((result) => alive && setItems(result.items))
      .catch(() => alive && setItems([]))
    return () => {
      alive = false
    }
  }, [doc.id, structure])

  if (!items) return null
  if (items.length === 0) return <div className="side-empty">{L.shell.sidePanel.noOutline}</div>
  return (
    <div>
      {items.map((item, index) => (
        <button
          key={index}
          className="outline-item"
          style={{ paddingLeft: 8 + (item.level - 1) * 14, fontWeight: item.bold || item.level === 1 ? 600 : 450 }}
          disabled={!item.page}
          onClick={() => item.page && viewerOf(doc.id)?.scrollToPage(item.page, item.y ?? undefined)}
        >
          <span>{item.title}</span>
        </button>
      ))}
    </div>
  )
}

export function SidePanel({ doc }: { doc: DocView }) {
  const patchDoc = useApp((s) => s.patchDoc)
  const tab = doc.side ?? 'thumbs'
  return (
    <aside className="side">
      <div className="side-head">
        <Segmented
          full
          value={tab}
          options={[
            { value: 'thumbs', label: L.common.pages },
            { value: 'outline', label: L.shell.sidePanel.outline }
          ]}
          onChange={(value) => patchDoc(doc.id, { side: value })}
        />
      </div>
      <div className="side-body">
        {tab === 'thumbs' ? (
          <div className="thumbs">
            {doc.pages.map((page, index) => (
              <Thumb key={page.id} doc={doc.id} page={page} index={index} active={page.id === doc.current} />
            ))}
          </div>
        ) : (
          <Outline doc={doc} />
        )}
      </div>
    </aside>
  )
}
