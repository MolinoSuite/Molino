import { ChevronLeft, ChevronRight, FileUp, FolderOpen, Printer } from 'lucide-react'
import { useRef, useState } from 'react'
import type { OfficeMergeMode } from '@shared/officeui'
import { Checkbox, Field } from '@/components/ui'
import { fmt, L } from '../../i18n'
import type { PanelProps } from '../types'
import { extraOf, MAIL_MERGE_MAX_COPIES, MAIL_MERGE_MAX_ROWS, parseList } from './data'
import { cancelMerge, canMerge, closeMerge, copyNames, type MergeRun, startMerge, useMergeRun } from './merge'

const M = L.officeWord.mailMerge
/** Lo más que se lee de un archivo de lista (5 MB). */
const MAX_FILE = 5 * 1024 * 1024
const MODES: OfficeMergeMode[] = ['single', 'files', 'print']

/** El texto de un CSV: en UTF-8 si lo es; si no, como lo guarda Excel en Windows (Windows-1252). */
function decode(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    return new TextDecoder('windows-1252').decode(buffer)
  }
}

/** La columna que da nombre a cada archivo, de entrada: la del nombre, si la hay. */
function nameColumn(fields: string[]): string {
  return fields.find((f) => /^(nombre|name|nombre completo|full name)$/i.test(f.trim())) ?? fields.find((f) => /nombre|name/i.test(f)) ?? fields[0] ?? ''
}

/**
 * Combinar correspondencia: la lista (un CSV elegido o pegado), sus campos
 * para ponerlos en el texto, la vista de cada fila y crear las copias: todas en
 * un documento, una por destinatario (cada una en su archivo) o a la impresora.
 */
export function MailMergePanel({ session, doc, state, run }: PanelProps) {
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
              // Sin quitarle el foco al documento: se pulsa el campo y se sigue escribiendo.
              <button key={name} className="chip" disabled={preview !== null} onMouseDown={(e) => e.preventDefault()} onClick={() => run('mailMergeField', name)}>
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
          <button className="btn sm office-word-merge-toggle" onClick={() => (preview === null ? go(0) : run('mailMergePreview', ''))}>
            {preview === null ? M.preview : M.previewOff}
          </button>
          {preview !== null && (
            <div className="office-word-merge-nav">
              <button className="icon-btn sm" aria-label={M.prev} data-tip={M.prev} disabled={preview <= 0} onClick={() => go(preview - 1)}>
                <ChevronLeft size={15} />
              </button>
              <span className="office-word-merge-record">{fmt(M.record, { n: preview + 1, total: merge.rows })}</span>
              <button className="icon-btn sm" aria-label={M.next} data-tip={M.next} disabled={preview >= merge.rows - 1} onClick={() => go(preview + 1)}>
                <ChevronRight size={15} />
              </button>
            </div>
          )}
        </section>
      )}
      {merge && <MakeCopies key={`${doc}:${merge.rows}:${merge.fields.join('\u0001')}`} doc={doc} api={session.featureContext().api} fields={merge.fields} rows={merge.rows} list={merge.list} />}
    </div>
  )
}

/** «Crear las copias»: qué, de qué filas, en qué formato y con qué nombre; y lo que se está creando. */
function MakeCopies({ doc, api, fields, rows, list }: { doc: string; api: unknown; fields: string[]; rows: number; list: string[][] }) {
  const running = useMergeRun(doc)
  const [mode, setMode] = useState<OfficeMergeMode>('single')
  const [format, setFormat] = useState<'docx' | 'pdf'>('docx')
  const [from, setFrom] = useState('1')
  const [to, setTo] = useState(String(rows))
  const [field, setField] = useState(() => nameColumn(fields))
  const first = Number(from)
  const last = Number(to)
  const valid = Number.isInteger(first) && Number.isInteger(last) && first >= 1 && last >= first && last <= rows
  const count = valid ? last - first + 1 : 0
  const tooMany = count > MAIL_MERGE_MAX_COPIES[mode]
  const supported = canMerge(api)

  const create = (): void => {
    if (!valid || tooMany) return
    // La columna del campo elegido en la lista (la primera fila son los nombres).
    const header = list[0] ?? []
    const column = header.includes(field) ? header.indexOf(field) : Math.max(0, fields.indexOf(field))
    const names = mode === 'files' ? copyNames(list, column, first - 1, last - 1) : []
    void startMerge(api, doc, mode, format, first - 1, last - 1, names)
  }

  if (running) return <MergeProgress doc={doc} run={running} />
  return (
    <section className="office-word-merge-make">
      <h3>{M.make}</h3>
      <Field label={M.what}>
        <select className="select" value={mode} onChange={(e) => setMode(e.target.value as OfficeMergeMode)}>
          {MODES.map((m) => (
            <option key={m} value={m}>
              {M.modes[m]}
            </option>
          ))}
        </select>
      </Field>
      <div className="office-word-row2">
        <Field label={M.from}>
          <input className="input" type="number" min={1} max={rows} value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label={M.to}>
          <input className="input" type="number" min={1} max={rows} value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>
      {mode !== 'print' && (
        <Field label={M.format}>
          <select className="select" value={format} onChange={(e) => setFormat(e.target.value === 'pdf' ? 'pdf' : 'docx')}>
            <option value="docx">{M.formats.docx}</option>
            <option value="pdf">{M.formats.pdf}</option>
          </select>
        </Field>
      )}
      {mode === 'files' && (
        <Field label={M.nameField} hint={M.nameHint}>
          <select className="select" value={field} onChange={(e) => setField(e.target.value)}>
            {fields.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </Field>
      )}
      {tooMany && <p className="office-word-error">{fmt(M.limit, { n: MAIL_MERGE_MAX_COPIES[mode] })}</p>}
      {!supported && <p className="office-word-error">{M.unsupported}</p>}
      <button className="btn primary sm office-word-merge-go" disabled={!valid || tooMany || !supported} onClick={create}>
        {mode === 'print' ? <Printer size={14} /> : <FolderOpen size={14} />}
        {M.go[mode]}
      </button>
    </section>
  )
}

/** Lo que se está creando: la barra, «Copia 3 de 20» y Cancelar; al terminar, cómo ha ido. */
function MergeProgress({ doc, run }: { doc: string; run: MergeRun }) {
  const busy = run.phase === 'asking' || run.phase === 'preparing' || run.phase === 'writing'
  const status =
    run.phase === 'asking'
      ? M.asking
      : run.phase === 'error'
        ? run.error || M.failed
        : run.phase === 'cancelled'
          ? fmt(M.cancelled, { n: run.done, total: run.total })
          : run.phase === 'done'
            ? fmt(M.done[run.mode], { n: run.total, where: run.where })
            : run.mode === 'files'
              ? fmt(M.progress, { n: Math.min(run.done + 1, run.total), total: run.total })
              : M.preparing
  const determinate = run.mode === 'files' && run.phase !== 'asking'
  return (
    <section className="office-word-merge-make" aria-live="polite">
      <h3>{M.make}</h3>
      {busy && (
        <div className={determinate ? 'progress' : 'progress indeterminate'} role="progressbar" aria-valuemin={0} aria-valuemax={run.total} aria-valuenow={run.done}>
          <div style={determinate ? { width: `${Math.round((run.done / Math.max(1, run.total)) * 100)}%` } : undefined} />
        </div>
      )}
      <p className={run.phase === 'error' ? 'office-word-error' : 'office-word-merge-status'}>{status}</p>
      <div className="office-word-merge-actions">
        {busy ? (
          <button className="btn sm" disabled={run.cancel || run.phase === 'asking'} onClick={() => cancelMerge(doc)}>
            {M.cancel}
          </button>
        ) : (
          <>
            {run.job !== null && run.mode !== 'print' && (
              <button className="btn sm" onClick={() => void closeMerge(doc, true)}>
                <FolderOpen size={14} />
                {M.show[run.mode === 'files' ? 'files' : 'single']}
              </button>
            )}
            <button className="btn sm" onClick={() => void closeMerge(doc, false)}>
              {M.dismiss}
            </button>
          </>
        )}
      </div>
    </section>
  )
}
