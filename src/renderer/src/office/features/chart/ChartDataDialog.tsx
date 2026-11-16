import { Plus, X } from 'lucide-react'
import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Dialog } from '@/components/ui'
import { cn } from '@/lib/cn'
import { env, fmt, L } from '../../i18n'
import type { DialogProps } from '../types'
import { type ChartEdit, MAX_CATEGORIES, MAX_SERIES, readChart, sameShape, writeChart } from './data'
import './chart.css'

const D = L.officeWord.chart.data

/** El separador decimal del idioma de Molino («,» en español). */
const DECIMAL = (1.5).toLocaleString(env.locale).includes(',') ? ',' : '.'

/**
 * Un número escrito a mano: «3,5», «1.234,5» o «1234.5» en español; «1,234.5»
 * en inglés. Vacío cuenta como 0; null si no es un número.
 */
export function parseNumber(text: string): number | null {
  const raw = text.replace(/\s/g, '')
  if (!raw) return 0
  let normal = raw
  if (DECIMAL === ',') {
    if (raw.includes(',')) normal = raw.replace(/\./g, '').replace(',', '.')
    else if (/^[-+]?\d{1,3}(\.\d{3})+$/.test(raw)) normal = raw.replace(/\./g, '')
  } else normal = raw.replace(/,/g, '')
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(normal)) return null
  const n = Number(normal)
  return Number.isFinite(n) ? n : null
}

function show(n: number | null): string {
  return n === null ? '' : n.toLocaleString(env.locale, { useGrouping: false, maximumFractionDigits: 10 })
}

interface Column {
  key: number
  /** La serie de antes de la que viene (su lugar en el gráfico), o null si es nueva. */
  from: number | null
  name: string
}

/**
 * «Datos del gráfico» (Documentos y Presentaciones): una tabla para escribir
 * las cifras y los nombres de las series (columnas) y de las categorías
 * (filas), con Aceptar y Cancelar. Lo escribe en el gráfico con la API de
 * documentos (data.ts): queda guardado en el .docx o el .pptx.
 */
export function ChartDataDialog({ session, close: closeDialog }: DialogProps) {
  const ctx = session.featureContext()
  // Al insertar un gráfico (o con doble clic), el editor se queda esperando a su «editor de
  // gráficos» y, mientras, no guarda: se le dice que ya se ha cerrado (como hace su interfaz).
  const close = (): void => {
    try {
      ctx.api.asc_onCloseFrameEditor?.()
    } catch {
      /* no lo esperaba */
    }
    closeDialog()
  }
  const [data] = useState(() => readChart(ctx))
  const nextKey = useRef(1000)
  const [series, setSeries] = useState<Column[]>(() => data?.series.map((s, i) => ({ key: i, from: i, name: s.name })) ?? [])
  const [rows, setRows] = useState<Column[]>(() => data?.categories.map((c, i) => ({ key: i, from: i, name: data.scatter ? show(Number(c) || 0) : c })) ?? [])
  const [cells, setCells] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {}
    data?.series.forEach((_, s) => data.categories.forEach((_c, r) => (out[`${r}:${s}`] = show(data.values[s][r]))))
    return out
  })
  const table = useRef<HTMLTableElement>(null)

  const cell = (row: Column, column: Column): string => cells[`${row.key}:${column.key}`] ?? ''
  const bad = (text: string): boolean => parseNumber(text) === null
  const invalid = useMemo(
    () => rows.some((r) => (data?.scatter && bad(r.name)) || series.some((s) => bad(cells[`${r.key}:${s.key}`] ?? ''))),
    [rows, series, cells, data?.scatter]
  )

  const edit = (): ChartEdit => ({
    series: series.map((s, i) => ({ from: s.from, name: s.name.trim().slice(0, 255) || fmt(D.newSeries, { n: i + 1 }) })),
    categories: rows.map((r) => ({ from: r.from, name: r.name.trim().slice(0, 255) })),
    values: series.map((s) => rows.map((r) => parseNumber(cell(r, s)) ?? 0)),
    x: data?.scatter ? rows.map((r) => parseNumber(r.name) ?? 0) : null
  })
  // Filas añadidas o quitadas, o series nuevas: el gráfico se volverá a crear (data.ts).
  const reshaped = data ? rows.length !== data.categories.length || rows.some((r, i) => r.from !== i) || series.some((s) => s.from === null) : false

  const addSeries = (): void => {
    const key = nextKey.current++
    setSeries((list) => [...list, { key, from: null, name: fmt(D.newSeries, { n: list.length + 1 }) }])
  }
  const addRow = (): void => {
    const key = nextKey.current++
    setRows((list) => [...list, { key, from: null, name: data?.scatter ? show(list.length + 1) : fmt(D.newCategory, { n: list.length + 1 }) }])
  }

  const accept = (): void => {
    if (!data || invalid || !series.length || !rows.length) return
    const wanted = edit()
    // Sin cambios, nada (ni un paso para deshacer).
    const unchanged =
      sameShape(data, wanted) &&
      wanted.series.length === data.series.length &&
      wanted.series.every((s, i) => s.name === data.series[i].name && wanted.values[i].every((v, r) => v === (data.values[i][r] ?? 0))) &&
      (data.scatter ? wanted.x?.every((x, r) => x === (Number(data.categories[r]) || 0)) : wanted.categories.every((c, r) => c.name === data.categories[r]))
    close()
    if (!unchanged && !writeChart(ctx, data, wanted)) console.error('datos del gráfico: no se pudieron escribir')
    session.focus()
  }

  /** Enter y las flechas de arriba y abajo: a la casilla de la otra fila (como en una hoja de cálculo). */
  const move = (event: KeyboardEvent<HTMLInputElement>): void => {
    const step = event.key === 'Enter' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    const target = event.currentTarget
    const td = target.closest('td, th')
    const tr = td?.parentElement
    if (!td || !tr || !table.current) return
    event.preventDefault()
    const column = Array.from(tr.children).indexOf(td)
    const all = Array.from(table.current.querySelectorAll('tr'))
    const next = all[all.indexOf(tr as HTMLTableRowElement) + step]
    next?.children[column]?.querySelector('input')?.focus()
  }

  if (!data) {
    return (
      <Dialog
        title={D.title}
        onClose={close}
        footer={
          <>
            <span className="grow" />
            <button className="btn primary" onClick={close}>
              {L.office.dialogs.close}
            </button>
          </>
        }
      >
        <p>{selectedChartMissing(ctx) ? D.none : D.unreadable}</p>
      </Dialog>
    )
  }

  return (
    <Dialog
      title={D.title}
      size="xl"
      onClose={close}
      footer={
        <>
          <span className="grow" />
          <button className="btn" onClick={close}>
            {L.office.dialogs.cancel}
          </button>
          <button className="btn primary" disabled={invalid} onClick={accept}>
            {L.office.dialogs.ok}
          </button>
        </>
      }
    >
      <div className="chart-data-dialog">
        <p className="hint">{data.scatter ? D.introScatter : D.intro}</p>
        <div className="chart-data-wrap">
          <table className="chart-data" ref={table}>
            <thead>
              <tr>
                <th className="chart-data-corner">{data.scatter ? D.x : D.category}</th>
                {series.map((s, j) => (
                  <th key={s.key}>
                    <div className="chart-data-head">
                      <input
                        value={s.name}
                        maxLength={255}
                        aria-label={fmt(D.seriesName, { n: j + 1 })}
                        onChange={(e) => {
                          const name = e.target.value
                          setSeries((list) => list.map((c) => (c.key === s.key ? { ...c, name } : c)))
                        }}
                        onKeyDown={move}
                      />
                      <button
                        className="icon-btn sm"
                        aria-label={fmt(D.removeSeries, { name: s.name })}
                        data-tip={fmt(D.removeSeries, { name: s.name })}
                        disabled={series.length <= 1}
                        onClick={() => setSeries((list) => list.filter((c) => c.key !== s.key))}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </th>
                ))}
                <th className="chart-data-add">
                  <button className="icon-btn sm" aria-label={D.addSeries} data-tip={D.addSeries} disabled={series.length >= MAX_SERIES} onClick={addSeries}>
                    <Plus size={15} />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.key}>
                  <th scope="row">
                    <input
                      className={cn(data.scatter && bad(r.name) && 'invalid')}
                      value={r.name}
                      maxLength={255}
                      inputMode={data.scatter ? 'decimal' : undefined}
                      aria-label={fmt(D.categoryName, { n: i + 1 })}
                      onChange={(e) => {
                        const name = e.target.value
                        setRows((list) => list.map((c) => (c.key === r.key ? { ...c, name } : c)))
                      }}
                      onKeyDown={move}
                    />
                  </th>
                  {series.map((s) => (
                    <td key={s.key}>
                      <input
                        className={cn(bad(cell(r, s)) && 'invalid')}
                        value={cell(r, s)}
                        maxLength={40}
                        inputMode="decimal"
                        aria-label={fmt(D.value, { series: s.name, category: r.name })}
                        aria-invalid={bad(cell(r, s))}
                        onChange={(e) => {
                          const text = e.target.value
                          setCells((all) => ({ ...all, [`${r.key}:${s.key}`]: text }))
                        }}
                        onKeyDown={move}
                      />
                    </td>
                  ))}
                  <td className="chart-data-add">
                    <button
                      className="icon-btn sm"
                      aria-label={fmt(D.removeCategory, { name: r.name })}
                      data-tip={fmt(D.removeCategory, { name: r.name })}
                      disabled={rows.length <= 1}
                      onClick={() => setRows((list) => list.filter((c) => c.key !== r.key))}
                    >
                      <X size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="chart-data-actions">
          <button className="btn sm" disabled={rows.length >= MAX_CATEGORIES} onClick={addRow}>
            <Plus size={14} />
            {data.scatter ? D.addPoint : D.addCategory}
          </button>
          <button className="btn sm" disabled={series.length >= MAX_SERIES} onClick={addSeries}>
            <Plus size={14} />
            {D.addSeries}
          </button>
        </div>
        {invalid && <p className="chart-data-note error">{D.invalid}</p>}
        {reshaped && <p className="chart-data-note">{D.rebuild}</p>}
      </div>
    </Dialog>
  )
}

/** ¿No hay ningún gráfico seleccionado? (si lo hay, es que no se pueden leer sus datos). */
function selectedChartMissing(ctx: ReturnType<DialogProps['session']['featureContext']>): boolean {
  try {
    return !(ctx.state.objects as string[]).includes('chart')
  } catch {
    return true
  }
}
