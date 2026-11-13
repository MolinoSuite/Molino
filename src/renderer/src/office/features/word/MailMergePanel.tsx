import { ChevronLeft, ChevronRight, FileUp } from 'lucide-react'
import { useRef, useState } from 'react'
import { Checkbox } from '@/components/ui'
import { fmt, L } from '../../i18n'
import type { PanelProps } from '../types'
import { extraOf, MAIL_MERGE_MAX_ROWS, parseList } from './data'

const M = L.officeWord.mailMerge
/** Lo más que se lee de un archivo de lista (5 MB). */
const MAX_FILE = 5 * 1024 * 1024

/** El texto de un CSV: en UTF-8 si lo es; si no, como lo guarda Excel en Windows (Windows-1252). */
function decode(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    return new TextDecoder('windows-1252').decode(buffer)
  }
}

/**
 * Combinar correspondencia: la lista (un CSV elegido o pegado), sus campos
 * para ponerlos en el texto y la vista de cada fila. Crear las copias
 * necesita que el proceso principal guarde el documento combinado (aún no).
 */
export function MailMergePanel({ state, run }: PanelProps) {
  const merge = extraOf(state).mailMerge ?? null
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [highlight, setHighlight] = useState(true)
  const file = useRef<HTMLInputElement>(null)

  const load = (raw: string): void => {
    const rows = parseList(raw)
    if (rows.length < 2 || rows[0].every((name) => !name)) return setError(M.bad)
    if (rows.length > MAIL_MERGE_MAX_ROWS + 1) return setError(fmt(M.tooBig, { n: MAIL_MERGE_MAX_ROWS }))
    setError('')
    run('mailMergeList', JSON.stringify(rows))
  }
  const preview = merge?.preview ?? null
  const go = (index: number): void => {
    if (!merge) return
    run('mailMergePreview', String(Math.max(0, Math.min(merge.rows - 1, index))))
  }

  return (
    <div className="office-word-merge">
      <p className="hint">{M.intro}</p>
      <input
        ref={file}
        type="file"
        accept=".csv,.txt,text/csv,text/plain"
        hidden
        onChange={(e) => {
          const picked = e.target.files?.[0]
          e.target.value = ''
          if (!picked) return
          if (picked.size > MAX_FILE) return setError(fmt(M.tooBig, { n: MAIL_MERGE_MAX_ROWS }))
          void picked.arrayBuffer().then((buffer) => load(decode(buffer)), () => setError(M.bad))
        }}
      />
      <button className="btn sm" onClick={() => file.current?.click()}>
        <FileUp size={14} />
        {M.pick}
      </button>
      <label className="office-word-merge-paste">
        <span>{M.paste}</span>
        <textarea className="textarea" rows={4} value={text} maxLength={200_000} spellCheck={false} placeholder={M.pasteHint} onChange={(e) => setText(e.target.value)} />
      </label>
      <button className="btn sm" disabled={!text.trim()} onClick={() => load(text)}>
        {M.use}
      </button>
      {error && <p className="office-word-error">{error}</p>}
      {merge && (
        <section>
          <h3>
            {M.fields} <span className="hint">· {fmt(M.rows, { n: merge.rows })}</span>
          </h3>
          <div className="office-word-chips">
            {merge.fields.map((name) => (
              <button key={name} className="chip" disabled={preview !== null} onClick={() => run('mailMergeField', name)}>
                «{name}»
              </button>
            ))}
          </div>
          <Checkbox
            checked={highlight}
            onChange={(on) => {
              setHighlight(on)
              run('mailMergeHighlight', on ? '1' : '0')
            }}
          >
            {M.highlight}
          </Checkbox>
          <div className="row office-word-merge-nav">
            <button className="btn sm" onClick={() => (preview === null ? go(0) : run('mailMergePreview', ''))}>
              {preview === null ? M.preview : M.previewOff}
            </button>
            {preview !== null && (
              <>
                <button className="icon-btn sm" aria-label={M.prev} data-tip={M.prev} disabled={preview <= 0} onClick={() => go(preview - 1)}>
                  <ChevronLeft size={15} />
                </button>
                <span className="hint">{fmt(M.record, { n: preview + 1, total: merge.rows })}</span>
                <button className="icon-btn sm" aria-label={M.next} data-tip={M.next} disabled={preview >= merge.rows - 1} onClick={() => go(preview + 1)}>
                  <ChevronRight size={15} />
                </button>
              </>
            )}
          </div>
          <p className="hint">{M.finish}</p>
        </section>
      )}
    </div>
  )
}
