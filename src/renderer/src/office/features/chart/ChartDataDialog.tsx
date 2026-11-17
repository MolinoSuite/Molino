import { BetweenHorizontalEnd, BetweenVerticalEnd, Columns3, Rows3 } from 'lucide-react'
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

/** La casilla activa: la fila (una categoría, o «head», la de los nombres de las series) y la columna (una serie, o «cat», la de las categorías). */
interface Active {
  row: number | 'head'
  col: number | 'cat'
}

/** La letra de una columna, como en una hoja de cálculo: A, B… Z, AA, AB… */
function letter(index: number): string {
  let n = index + 1
  let out = ''
  while (n > 0) {
    const r = (n - 1) % 26
    out = String.fromCharCode(65 + r) + out
    n = Math.floor((n - 1) / 26)
  }
  return out
}

/**
 * «Datos del gráfico» (Documentos y Presentaciones): como la hoja de datos de
 * un gráfico en Office. Arriba, una barra fija con lo que se hace con filas y
 * series (añadir y quitar la de la casilla activa); debajo, la tabla como una
 * hoja de cálculo, con las letras de las columnas y los números de las filas
 * (los de la casilla activa, con el color de la app). Fila 1: los nombres de
 * las series; columna A: las categorías. Aceptar lo escribe en el gráfico con
 * la API de documentos (data.ts): queda guardado en el .docx o el .pptx.
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
  const [active, setActive] = useState<Active | null>(null)
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

  /** Lleva el teclado a una casilla (después de pintarla, si es nueva). */
  const focusCell = (row: number | 'head', col: number | 'cat'): void => {
    requestAnimationFrame(() => table.current?.querySelector<HTMLInputElement>(`input[data-row="${row}"][data-col="${col}"]`)?.focus())
  }
  const addSeries = (): void => {
    const key = nextKey.current++
    setSeries((list) => [...list, { key, from: null, name: fmt(D.newSeries, { n: list.length + 1 }) }])
    focusCell('head', key)
  }
  const addRow = (): void => {
    const key = nextKey.current++
    setRows((list) => [...list, { key, from: null, name: data?.scatter ? show(list.length + 1) : fmt(D.newCategory, { n: list.length + 1 }) }])
    focusCell(key, 'cat')
  }
  // Quitar: la fila o la serie de la casilla activa (y la casilla pasa a la de al lado).
  const activeRow = active && active.row !== 'head' ? rows.find((r) => r.key === active.row) : undefined
  const activeSeries = active && active.col !== 'cat' ? series.find((s) => s.key === active.col) : undefined
  const removeRow = (): void => {
    if (!activeRow || rows.length <= 1) return
    const at = rows.indexOf(activeRow)
    const next = rows[at + 1] ?? rows[at - 1]
    setRows((list) => list.filter((r) => r.key !== activeRow.key))
    if (active) focusCell(next.key, active.col)
  }
  const removeSeries = (): void => {
    if (!activeSeries || series.length <= 1) return
    const at = series.indexOf(activeSeries)
    const next = series[at + 1] ?? series[at - 1]
    setSeries((list) => list.filter((s) => s.key !== activeSeries.key))
    if (active) focusCell(active.row, next.key)
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

  /** Una casilla: su sitio (para la casilla activa y el teclado) y lo de siempre. */
  const at = (row: number | 'head', col: number | 'cat') => ({
    'data-row': row,
    'data-col': col,
    onFocus: () => setActive({ row, col }),
    onKeyDown: move
  })
  const isActive = (row: number | 'head', col: number | 'cat'): boolean => active?.row === row && active.col === col
  const removeRowTip = activeRow ? fmt(D.removeCategory, { name: activeRow.name }) : undefined
  const removeSeriesTip = activeSeries ? fmt(D.removeSeries, { name: activeSeries.name }) : undefined

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
        <div className="chart-data-sheet">
          {/* La barra de la hoja de datos: fija arriba, como la cinta de Excel. Pulsarla no quita la casilla activa. */}
          <div className="chart-data-ribbon" role="toolbar" aria-label={D.tools} onMouseDown={(e) => e.preventDefault()}>
            <button className="tool" disabled={rows.length >= MAX_CATEGORIES} onClick={addRow}>
              <BetweenHorizontalEnd size={16} />
              <span>{data.scatter ? D.addPoint : D.addCategory}</span>
            </button>
            <button className="tool" disabled={!activeRow || rows.length <= 1} data-tip={removeRowTip} onClick={removeRow}>
              <Rows3 size={16} />
              <span>{data.scatter ? D.removePointShort : D.removeCategoryShort}</span>
            </button>
            <span className="chart-data-ribbon-sep" />
            <button className="tool" disabled={series.length >= MAX_SERIES} onClick={addSeries}>
              <BetweenVerticalEnd size={16} />
              <span>{D.addSeries}</span>
            </button>
            <button className="tool" disabled={!activeSeries || series.length <= 1} data-tip={removeSeriesTip} onClick={removeSeries}>
              <Columns3 size={16} />
              <span>{D.removeSeriesShort}</span>
            </button>
          </div>
          <div className="chart-data-wrap">
            <table className="chart-data" ref={table}>
              <thead>
                <tr className="chart-data-letters">
                  <th className="chart-data-num" aria-hidden="true" />
                  {[null, ...series].map((s, j) => (
                    <th key={s?.key ?? 'cat'} className={cn(active?.col === (s?.key ?? 'cat') && 'on')} aria-hidden="true">
                      {letter(j)}
                    </th>
                  ))}
                </tr>
                <tr className="chart-data-names">
                  <th className={cn('chart-data-num', active?.row === 'head' && 'on')} aria-hidden="true">
                    1
                  </th>
                  <th className="chart-data-corner">{data.scatter ? D.x : D.category}</th>
                  {series.map((s, j) => (
                    <th key={s.key} className={cn(isActive('head', s.key) && 'active')}>
                      <input
                        value={s.name}
                        maxLength={255}
                        aria-label={fmt(D.seriesName, { n: j + 1 })}
                        onChange={(e) => {
                          const name = e.target.value
                          setSeries((list) => list.map((c) => (c.key === s.key ? { ...c, name } : c)))
                        }}
                        {...at('head', s.key)}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.key}>
                    <th className={cn('chart-data-num', active?.row === r.key && 'on')} aria-hidden="true">
                      {i + 2}
                    </th>
                    <th scope="row" className={cn(isActive(r.key, 'cat') && 'active')}>
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
                        {...at(r.key, 'cat')}
                      />
                    </th>
                    {series.map((s) => (
                      <td key={s.key} className={cn(isActive(r.key, s.key) && 'active')}>
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
                          {...at(r.key, s.key)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
