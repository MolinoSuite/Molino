import { Plus, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Checkbox, Dialog, Field, Segmented } from '@/components/ui'
import { fmt, L } from '../../i18n'
import type { Api, DialogProps } from '../types'
import { PASTE_KINDS, PASTE_OPS, type PasteKind, type PasteOp, PIVOT_FNS, type PivotFn } from './commands'

const C = L.officeCell
const D = L.office.dialogs

/** Pegado especial: qué pegar, con qué operación, saltar vacías y trasponer. */
export function PasteSpecialDialog({ run, close }: DialogProps) {
  const P = C.paste
  const kinds = Object.keys(P.kinds) as (keyof typeof P.kinds)[]
  const [kind, setKind] = useState<keyof typeof P.kinds>('all')
  const [op, setOp] = useState<PasteOp>('none')
  const [skipBlanks, setSkipBlanks] = useState(false)
  const [transpose, setTranspose] = useState(false)
  // Como en Excel: con formato, comentarios o anchos no hay operación.
  const noOp = kind === 'formats' || kind === 'comments' || kind === 'columnWidth'
  const accept = (): void => {
    close()
    run('pasteSpecial', JSON.stringify({ kind: kind as PasteKind, op: noOp ? 'none' : op, skipBlanks, transpose }))
  }
  return (
    <Dialog
      title={P.title}
      onClose={close}
      footer={
        <>
          <span className="grow" />
          <button className="btn" onClick={close}>
            {D.cancel}
          </button>
          <button className="btn primary" onClick={accept}>
            {P.ok}
          </button>
        </>
      }
    >
      <div className="office-prompt cell-paste">
        <p>{P.intro}</p>
        <fieldset className="cell-radios" aria-label={P.what}>
          <legend>{P.what}</legend>
          {kinds
            .filter((k) => k in PASTE_KINDS)
            .map((k) => (
              <label key={k} className="check">
                <input type="radio" name="cell-paste-kind" checked={kind === k} onChange={() => setKind(k)} />
                <span>{P.kinds[k]}</span>
              </label>
            ))}
        </fieldset>
        <fieldset className="cell-radios" aria-label={P.operation} disabled={noOp}>
          <legend>{P.operation}</legend>
          {PASTE_OPS.map((o) => (
            <label key={o} className="check">
              <input type="radio" name="cell-paste-op" checked={op === o} onChange={() => setOp(o)} />
              <span>{P.ops[o]}</span>
            </label>
          ))}
        </fieldset>
        <Checkbox checked={skipBlanks} onChange={setSkipBlanks}>
          {P.skipBlanks}
        </Checkbox>
        <Checkbox checked={transpose} onChange={setTranspose}>
          {P.transposeCheck}
        </Checkbox>
      </div>
    </Dialog>
  )
}

interface Level {
  col: number
  desc: boolean
}

/**
 * Ordenar por varias columnas (niveles), como el cuadro «Ordenar» de Excel.
 * Se pide al editor lo que hay seleccionado (sus columnas, si tiene
 * encabezados) y, al aceptar, se ordena con esas propiedades; si se cancela,
 * se le dice también (así suelta lo que reservó).
 */
export function SortDialog({ session, close }: DialogProps) {
  const S = C.sort
  const ctx = useMemo(() => session.featureContext(), [session])
  const props = useRef<Api>(null)
  const [columns, setColumns] = useState<{ index: number; name: string }[]>([])
  const [headers, setHeaders] = useState(true)
  const [levels, setLevels] = useState<Level[]>([])
  const [failed, setFailed] = useState(false)

  const read = (p: Api): { index: number; name: string }[] => {
    const list: unknown[] = p.asc_getSortList() || []
    const out: { index: number; name: string }[] = []
    list.forEach((name, index) => {
      if (name !== undefined && name !== null) out.push({ index, name: String(name).slice(0, 120) || '—' })
    })
    return out
  }

  useEffect(() => {
    const { api, ew } = ctx
    let p: Api = null
    try {
      const E = ew.Asc.c_oAscSelectionSortExpand
      const expand = api.asc_sortCellsRangeExpand()
      p = api.asc_getSortProps(expand === E.showExpandMessage || expand === E.expandAndNotShowMessage)
    } catch {
      p = null
    }
    if (!p) {
      setFailed(true)
      return
    }
    props.current = p
    const cols = read(p)
    setColumns(cols)
    setHeaders(Boolean(p.asc_getHasHeaders()))
    const now: Api[] = p.asc_getLevels() || []
    const D2 = ew.Asc.c_oAscSortOptions.Descending
    setLevels(now.length ? now.map((l) => ({ col: Number(l.asc_getIndex()), desc: l.asc_getDescending() === D2 })) : cols.length ? [{ col: cols[0].index, desc: false }] : [])
    return () => {
      // Sin ordenar: el editor suelta lo que reservó.
      if (props.current) {
        try {
          api.asc_setSortProps(props.current, true)
        } catch {
          /* ya no hacía falta */
        }
        props.current = null
      }
    }
  }, [ctx])

  const toggleHeaders = (on: boolean): void => {
    const p = props.current
    if (!p) return
    p.asc_setHasHeaders(on)
    p.asc_updateSortList(true)
    setHeaders(on)
    setColumns(read(p))
  }

  const accept = (): void => {
    const p = props.current
    if (!p || !levels.length) return
    const { api, ew } = ctx
    const A = ew.Asc
    // Todo con objetos de la ventana del editor (otro «realm»).
    const list = new ew.Array()
    for (const level of levels) {
      const l = new A.CSortPropertiesLevel()
      l.asc_setIndex(level.col)
      l.asc_setSortBy(A.c_oAscSortOptions.ByValue)
      l.asc_setDescending(level.desc ? A.c_oAscSortOptions.Descending : A.c_oAscSortOptions.Ascending)
      list.push(l)
    }
    p.asc_setLevels(list)
    props.current = null
    try {
      api.asc_setSortProps(p, false)
    } catch (error) {
      console.error('ordenar:', error)
    }
    close()
  }

  const used = new Set(levels.map((l) => l.col))
  const free = columns.find((c) => !used.has(c.index))
  return (
    <Dialog
      title={S.title}
      size="wide"
      onClose={close}
      footer={
        <>
          <span className="grow" />
          <button className="btn" onClick={close}>
            {D.cancel}
          </button>
          <button className="btn primary" disabled={!levels.length || failed} onClick={accept}>
            {S.ok}
          </button>
        </>
      }
    >
      {failed || !columns.length ? (
        <p className="hint">{S.empty}</p>
      ) : (
        <div className="office-prompt cell-sort">
          <Checkbox checked={headers} onChange={toggleHeaders}>
            {S.headers}
          </Checkbox>
          <ol className="cell-sort-levels">
            {levels.map((level, i) => (
              <li key={i}>
                <span className="cell-sort-label">{i === 0 ? S.sortBy : S.thenBy}</span>
                <select
                  className="input"
                  aria-label={`${i === 0 ? S.sortBy : S.thenBy}: ${S.column}`}
                  value={level.col}
                  onChange={(e) => setLevels(levels.map((l, k) => (k === i ? { ...l, col: Number(e.target.value) } : l)))}
                >
                  {columns
                    .filter((c) => c.index === level.col || !used.has(c.index))
                    .map((c) => (
                      <option key={c.index} value={c.index}>
                        {c.name}
                      </option>
                    ))}
                </select>
                <Segmented
                  value={level.desc ? 'desc' : 'asc'}
                  options={[
                    { value: 'asc', label: S.asc },
                    { value: 'desc', label: S.desc }
                  ]}
                  onChange={(v) => setLevels(levels.map((l, k) => (k === i ? { ...l, desc: v === 'desc' } : l)))}
                />
                <button className="icon-btn sm" aria-label={S.remove} data-tip={S.remove} disabled={levels.length < 2} onClick={() => setLevels(levels.filter((_, k) => k !== i))}>
                  <X size={14} />
                </button>
              </li>
            ))}
          </ol>
          <div>
            <button className="btn sm ghost" disabled={!free || levels.length >= 64} onClick={() => free && setLevels([...levels, { col: free.index, desc: false }])}>
              <Plus size={14} />
              {S.add}
            </button>
          </div>
        </div>
      )}
    </Dialog>
  )
}

/**
 * Tabla dinámica nueva con lo seleccionado, en una hoja nueva: qué columna va
 * en filas, cuál en columnas y cuál se resume (y cómo).
 */
export function PivotDialog({ session, run, close }: DialogProps) {
  const P = C.pivot
  const ctx = useMemo(() => session.featureContext(), [session])
  const info = useMemo(() => {
    try {
      const options = ctx.api.asc_getAddPivotTableOptions()
      const range = String(options?.asc_getRange() ?? '')
      return { range, fields: headerNames(ctx.api, range) }
    } catch {
      return { range: '', fields: [] as string[] }
    }
  }, [ctx])
  const [range, setRange] = useState(info.range)
  const [rows, setRows] = useState(info.fields.length ? 0 : -1)
  const [cols, setCols] = useState(-1)
  const [values, setValues] = useState(info.fields.length > 1 ? info.fields.length - 1 : -1)
  const [fn, setFn] = useState<PivotFn>('sum')
  const ok = Boolean(range.trim()) && info.fields.length > 0 && (rows >= 0 || values >= 0)
  const accept = (): void => {
    if (!ok) return
    close()
    const valueName = values >= 0 ? fmt(P.valueName, { fn: P.fns[fn], field: info.fields[values] ?? '' }).slice(0, 255) : ''
    run('pivotCreate', JSON.stringify({ range: range.trim(), name: P.sheet, rows: rows >= 0 ? rows : null, cols: cols >= 0 ? cols : null, values: values >= 0 ? values : null, fn, valueName }))
  }
  const pick = (label: string, value: number, set: (n: number) => void, optional: boolean) => (
    <Field label={label}>
      <select className="input" value={value} onChange={(e) => set(Number(e.target.value))}>
        {optional && <option value={-1}>{P.none}</option>}
        {info.fields.map((name, i) => (
          <option key={i} value={i}>
            {name}
          </option>
        ))}
      </select>
    </Field>
  )
  return (
    <Dialog
      title={P.title}
      onClose={close}
      footer={
        <>
          <span className="grow" />
          <button className="btn" onClick={close}>
            {D.cancel}
          </button>
          <button className="btn primary" disabled={!ok} onClick={accept}>
            {P.ok}
          </button>
        </>
      }
    >
      {info.fields.length === 0 ? (
        <p className="hint">{P.empty}</p>
      ) : (
        <form
          className="office-prompt"
          onSubmit={(e) => {
            e.preventDefault()
            accept()
          }}
        >
          <p>{P.intro}</p>
          <Field label={P.source}>
            <input className="input" value={range} maxLength={500} spellCheck={false} onChange={(e) => setRange(e.target.value)} />
          </Field>
          {pick(P.rows, rows, setRows, true)}
          {pick(P.columns, cols, setCols, true)}
          {pick(P.values, values, setValues, true)}
          <Field label={P.summary}>
            <select className="input" value={fn} onChange={(e) => setFn(e.target.value as PivotFn)}>
              {(Object.keys(PIVOT_FNS) as PivotFn[]).map((f) => (
                <option key={f} value={f}>
                  {P.fns[f]}
                </option>
              ))}
            </select>
          </Field>
          <button type="submit" hidden />
        </form>
      )}
    </Dialog>
  )
}

/** Los nombres de la primera fila de un rango («Hoja1!$A$1:$C$6»), con la API de documentos. */
function headerNames(api: Api, range: string): string[] {
  const m = /^(?:(.+)!)?\$?([A-Z]{1,3})\$?(\d+):\$?([A-Z]{1,3})\$?\d+$/.exec(range)
  if (!m) return []
  try {
    const B = api.getJsApi()
    const sheetName = m[1] ? m[1].replace(/^'(.*)'$/, '$1').replace(/''/g, "'") : ''
    const sheet = (sheetName && B.GetSheet(sheetName)) || B.GetActiveSheet()
    const value = sheet.GetRange(`${m[2]}${m[3]}:${m[4]}${m[3]}`).GetValue()
    const row: unknown[] = Array.isArray(value) ? (Array.isArray(value[0]) ? value[0] : value) : [value]
    return row.slice(0, 200).map((v, i) => String(v ?? '').trim().slice(0, 80) || `${i + 1}`)
  } catch {
    return []
  }
}
