/**
 * Lo que comparten las funciones de Documentos (features/word.tsx): el estado
 * propio (en state.extra), los idiomas del corrector, los tipos de gráfico, los
 * nombres de los estilos de tabla y la lectura de una lista CSV.
 */
import type { EditorState } from '../../engine'
import { L } from '../../i18n'
import type { Api } from '../types'

const W = L.officeWord

/** Lo que Documentos guarda en state.extra (cada clave, de una función). */
export interface WordExtra {
  /** Encabezado o pie que se está editando (null: el cursor está en el cuerpo). */
  hf?: { first: boolean; oddEven: boolean; link: boolean | null } | null
  /** El estilo de la tabla seleccionada y el sombreado de sus celdas. */
  tableStyle?: string
  cellShade?: string | null
  /** Las miniaturas de los estilos de tabla (las del editor), una vez preparadas. */
  tableStyles?: TableStyleInfo[]
  /** El tipo del gráfico seleccionado (de los de Molino), o null. */
  chartKind?: ChartKind | null
  /** El idioma del texto donde está el cursor (LCID). */
  textLang?: number
  /** Los títulos del documento (panel de navegación) y el actual. */
  outline?: OutlineItem[]
  outlinePos?: number
  /** Combinar correspondencia: los campos de la lista, cuántas filas y la que se ve (null: los campos). */
  mailMerge?: { fields: string[]; rows: number; preview: number | null } | null
  /** Sube cuando cambian los marcadores (el cuadro los vuelve a leer). */
  bookmarks?: number
}

export function extraOf(state: EditorState): WordExtra {
  return state.extra as WordExtra
}

export interface OutlineItem {
  level: number
  text: string
  /** El primero es «Principio del documento» (el documento no empieza por un título). */
  start: boolean
}

export interface TableStyleInfo {
  id: string
  name: string
  image: string
  group: 'plain' | 'grid' | 'list' | 'lined' | 'custom' | 'other'
}

// ---------------------------------------------------------------- idiomas

/**
 * Los idiomas del corrector: los diccionarios que trae la pieza de oficina
 * (dist-office/…/dictionaries), con su código de Windows (LCID). Del español
 * solo hay el de España: marcar un texto como español de México, por ejemplo,
 * lo dejaría sin corregir.
 */
export const LANGS: { code: keyof typeof W.lang.names; lcid: number }[] = [
  { code: 'es-ES', lcid: 3082 },
  { code: 'ca-ES', lcid: 1027 },
  { code: 'ca-ES-valencia', lcid: 2051 },
  { code: 'gl-ES', lcid: 1110 },
  { code: 'eu-ES', lcid: 1069 },
  { code: 'en-GB', lcid: 2057 },
  { code: 'en-US', lcid: 1033 },
  { code: 'fr-FR', lcid: 1036 },
  { code: 'pt-PT', lcid: 2070 },
  { code: 'pt-BR', lcid: 1046 },
  { code: 'de-DE', lcid: 1031 },
  { code: 'it-IT', lcid: 1040 }
]

export function langByLcid(lcid: number): (typeof LANGS)[number] | undefined {
  return LANGS.find((l) => l.lcid === lcid)
}

// ---------------------------------------------------------------- gráficos

/** Los gráficos que se insertan: su tipo en la API de documentos y en el editor (c_oAscChartTypeSettings). */
export const CHARTS = {
  column: { builder: 'bar', editor: 'barNormal' },
  bar: { builder: 'horizontalBar', editor: 'hBarNormal' },
  line: { builder: 'lineNormal', editor: 'lineNormal' },
  pie: { builder: 'pie', editor: 'pie' },
  area: { builder: 'area', editor: 'areaNormal' },
  doughnut: { builder: 'doughnut', editor: 'doughnut' }
} as const
export type ChartKind = keyof typeof CHARTS

/** El tipo de Molino de un gráfico del editor (o null si es otro). */
export function chartKindOf(type: number | null | undefined, settings: Api): ChartKind | null {
  if (type === null || type === undefined || !settings) return null
  for (const [kind, names] of Object.entries(CHARTS)) if (settings[names.editor] === type) return kind as ChartKind
  return null
}

// ----------------------------------------------------------- estilos de tabla

/** Grupo y nombre en el idioma de Molino de un estilo de tabla del editor («Grid Table 4 - Accent 1»). */
export function describeTableStyle(name: string, type: number): { name: string; group: TableStyleInfo['group'] } {
  if (type !== 0) return { name, group: 'custom' }
  const N = W.tableStyles.names
  const group: TableStyleInfo['group'] = /^Table Grid/i.test(name)
    ? 'plain'
    : /^Plain Table/i.test(name)
      ? 'plain'
      : /^Grid Table/i.test(name)
        ? 'grid'
        : /^List Table/i.test(name)
          ? 'list'
          : /Lined|Bordered/i.test(name)
            ? 'lined'
            : 'other'
  // Las palabras de los nombres de Word, de la más larga a la más corta (que «Table Grid» no se lea como «Grid»).
  let out = name.replace(/\s*-\s*/g, ' - ')
  for (const word of Object.keys(N).sort((a, b) => b.length - a.length)) out = out.replace(new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\&]/g, '\\$&')}\\b`, 'g'), N[word as keyof typeof N])
  return { name: out.replace(/ - /g, ' · ').replace(/\s+/g, ' ').trim(), group }
}

// ------------------------------------------------------------ lista CSV

/** Lo más que se lee de una lista para combinar correspondencia. */
export const MAIL_MERGE_MAX_ROWS = 5000
const MAX_COLUMNS = 100
const MAX_CELL = 1000

/**
 * Una lista CSV (o pegada desde una hoja): separada por «;», «,» o
 * tabuladores (el que más haya en la primera línea), con comillas dobles
 * para los valores que llevan el separador o saltos de línea.
 */
export function parseList(text: string): string[][] {
  const clean = text.replace(/^﻿/, '')
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? ''
  const counts: [string, number][] = [
    ['\t', (firstLine.match(/\t/g) ?? []).length],
    [';', (firstLine.match(/;/g) ?? []).length],
    [',', (firstLine.match(/,/g) ?? []).length]
  ]
  const sep = counts.sort((a, b) => b[1] - a[1])[0][1] > 0 ? counts[0][0] : ';'
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') quoted = false
      else cell += c
      continue
    }
    if (c === '"' && cell === '') quoted = true
    else if (c === sep) {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && clean[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      if (rows.length > MAIL_MERGE_MAX_ROWS + 1) break
    } else cell += c
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    rows.push(row)
  }
  // Sin filas vacías; cada valor recortado y con un largo razonable.
  return rows
    .filter((r) => r.some((v) => v.trim() !== ''))
    .map((r) => r.slice(0, MAX_COLUMNS).map((v) => v.trim().slice(0, MAX_CELL)))
}

// ----------------------------------------------------------- utilidades

/** Lo seleccionado en el editor (lo que da getSelectedElements), sin fallar. */
export function selectedElements(api: Api): Api[] {
  try {
    return api.getSelectedElements() || []
  } catch {
    return []
  }
}

/** Un número entero entre dos límites (o null si no lo es). */
export function intIn(value: string | undefined, min: number, max: number): number | null {
  const n = Number(value)
  return Number.isInteger(n) && n >= min && n <= max ? n : null
}
