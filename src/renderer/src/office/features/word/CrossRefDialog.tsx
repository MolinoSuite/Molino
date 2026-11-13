import { useMemo, useState } from 'react'
import { Checkbox, Dialog, Field } from '@/components/ui'
import { cn } from '@/lib/cn'
import { L } from '../../i18n'
import type { Api, DialogProps } from '../types'
import { bookmarkNames } from './BookmarksDialog'
import { extraOf } from './data'

const X = L.officeWord.crossRef
const C = L.officeWord.caption

type Target = keyof typeof X.types
type RefKind = keyof typeof X.refs

/** Qué se puede escribir de cada cosa (como en el cuadro de Word). */
const REFS: Record<Target, RefKind[]> = {
  heading: ['text', 'page', 'aboveBelow'],
  bookmark: ['text', 'page', 'aboveBelow'],
  footnote: ['noteNumber', 'page', 'aboveBelow'],
  endnote: ['noteNumber', 'page', 'aboveBelow'],
  caption: ['text', 'labelNumber', 'captionText', 'page', 'aboveBelow']
}
/** El nombre de cada una en el editor (c_oAscDocumentRefenceToType). */
const REF_NAMES: Record<RefKind, string> = {
  text: 'Text',
  page: 'PageNum',
  number: 'ParaNum',
  noteNumber: 'NoteNumber',
  aboveBelow: 'AboveBelow',
  labelNumber: 'OnlyLabelAndNumber',
  captionText: 'OnlyCaptionText'
}

interface Item {
  label: string
  /** El párrafo del editor (títulos, notas, títulos de tabla) o el nombre del marcador. */
  target: Api
}

function itemsOf(api: Api, target: Target, label: string): Item[] {
  const paragraphs = (list: Api[] | null | undefined): Item[] =>
    (list ?? []).slice(0, 2000).map((p) => ({ label: String(p.asc_getText?.() ?? '').replace(/\s+$/, ''), target: p }))
  try {
    if (target === 'heading') return paragraphs(api.asc_GetAllHeadingParagraphs())
    if (target === 'bookmark') return bookmarkNames(api).map((name) => ({ label: name, target: name }))
    if (target === 'footnote') return paragraphs(api.asc_GetAllFootNoteParagraphs())
    if (target === 'endnote') return paragraphs(api.asc_GetAllEndNoteParagraphs())
    return paragraphs(api.asc_GetAllCaptionParagraphs(label))
  } catch {
    return []
  }
}

/**
 * Insertar una referencia cruzada: a un título, un marcador, una nota o el
 * título de una tabla o imagen; se escribe su texto, su página o «encima» /
 * «debajo», como vínculo si se quiere. Se queda abierto para poner varias.
 */
export function CrossRefDialog({ session, state, close }: DialogProps) {
  const ctx = session.featureContext()
  const api = ctx.api
  const [target, setTarget] = useState<Target>('heading')
  const [label, setLabel] = useState<string>(C.labels.table)
  const [ref, setRef] = useState<RefKind>('text')
  const [link, setLink] = useState(true)
  const [picked, setPicked] = useState(0)
  const bookmarks = extraOf(state).bookmarks
  const edits = state.edits
  // Se vuelven a leer si cambian los marcadores o el documento.
  const items = useMemo(() => itemsOf(api, target, label), [api, target, label, bookmarks, edits])
  const refs = REFS[target]
  const kind = refs.includes(ref) ? ref : refs[0]
  const item = items[Math.min(picked, items.length - 1)]

  const insert = (): void => {
    if (!item) return
    const R = ctx.ew.Asc.c_oAscDocumentRefenceToType
    const type = R[REF_NAMES[kind]]
    if (target === 'heading') api.asc_AddCrossRefToParagraph(item.target, type, link, false)
    else if (target === 'bookmark') api.asc_AddCrossRefToBookmark(item.target, type, link, false)
    else if (target === 'footnote' || target === 'endnote') api.asc_AddCrossRefToNote(item.target, type, link, false)
    else api.asc_AddCrossRefToCaption(label, item.target, type, link, false)
    session.focus()
  }
  return (
    <Dialog
      title={X.title}
      onClose={close}
      footer={
        <>
          <span className="grow" />
          <button className="btn" onClick={close}>
            {L.office.dialogs.close}
          </button>
          <button className="btn primary" disabled={!item} onClick={insert}>
            {X.insert}
          </button>
        </>
      }
    >
      <div className="office-prompt office-word-crossref">
        <div className="office-word-row2">
          <Field label={X.type}>
            <select
              className="input"
              value={target}
              onChange={(e) => {
                setTarget(e.target.value as Target)
                setPicked(0)
              }}
            >
              {(Object.keys(X.types) as Target[]).map((t) => (
                <option key={t} value={t}>
                  {X.types[t]}
                </option>
              ))}
            </select>
          </Field>
          {target === 'caption' ? (
            <Field label={X.label}>
              <select
                className="input"
                value={label}
                onChange={(e) => {
                  setLabel(e.target.value)
                  setPicked(0)
                }}
              >
                {Object.values(C.labels).map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label={X.what}>
              <select className="input" value={kind} onChange={(e) => setRef(e.target.value as RefKind)}>
                {refs.map((r) => (
                  <option key={r} value={r}>
                    {X.refs[r]}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
        {target === 'caption' && (
          <Field label={X.what}>
            <select className="input" value={kind} onChange={(e) => setRef(e.target.value as RefKind)}>
              {refs.map((r) => (
                <option key={r} value={r}>
                  {X.refs[r]}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label={X.which}>
          <div className="office-word-list" role="listbox" aria-label={X.which}>
            {items.length === 0 && <p className="hint">{X.empty}</p>}
            {items.map((it, i) => (
              <button
                key={i}
                type="button"
                role="option"
                aria-selected={it === item}
                className={cn('office-word-list-item', it === item && 'on')}
                onClick={() => setPicked(i)}
                onDoubleClick={() => {
                  setPicked(i)
                  insert()
                }}
              >
                {it.label || '—'}
              </button>
            ))}
          </div>
        </Field>
        <Checkbox checked={link} onChange={setLink}>
          {X.link}
        </Checkbox>
      </div>
    </Dialog>
  )
}
