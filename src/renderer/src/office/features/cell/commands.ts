import type { Api, FeatureContext } from '../types'

/** La API de documentos del editor: solo existe dentro de las funciones que se pasan a ctx.builder. */
declare const Api: Api

/**
 * Las órdenes de las funciones de Hojas: lo que ya sabe hacer el editor de
 * hojas de cálculo (pegado especial, ordenar por niveles, gráficos, esquema,
 * auditoría de fórmulas, página, formas, nombres, tablas dinámicas, texto en
 * columnas y minigráficos), llamado como lo llama su propia interfaz
 * (web-apps/apps/spreadsheeteditor/main/app/controller).
 */

type Commands = Record<string, (value?: string) => void>

/** Lo que se puede pegar (c_oSpecialPasteProps del editor). */
export const PASTE_KINDS = {
  all: 'paste',
  formulas: 'pasteOnlyFormula',
  values: 'pasteOnlyValues',
  formats: 'pasteOnlyFormating',
  comments: 'comments',
  columnWidth: 'columnWidth',
  formulaNumbers: 'formulaNumberFormat',
  valueNumbers: 'valueNumberFormat',
  valuesFormats: 'valueAllFormating',
  noBorders: 'formulaWithoutBorders',
  transpose: 'transpose'
} as const
export type PasteKind = keyof typeof PASTE_KINDS
export const PASTE_OPS = ['none', 'add', 'subtract', 'multiply', 'divide'] as const
export type PasteOp = (typeof PASTE_OPS)[number]
export interface PasteSpec {
  kind: PasteKind
  op?: PasteOp
  skipBlanks?: boolean
  transpose?: boolean
}

/** Los tipos de gráfico de la galería (c_oAscChartTypeSettings). */
export const CHART_TYPES = {
  columns: 'barNormal',
  stackedColumns: 'barStacked',
  bars: 'hBarNormal',
  stackedBars: 'hBarStacked',
  lines: 'lineNormal',
  linesMarkers: 'lineNormalMarker',
  pie: 'pie',
  doughnut: 'doughnut',
  area: 'areaNormal',
  scatter: 'scatter'
} as const
export type ChartKind = keyof typeof CHART_TYPES

/** Márgenes de Hojas en milímetros (arriba, izquierda, abajo, derecha), los de Excel. */
export const CELL_MARGINS: Record<string, [number, number, number, number]> = {
  normal: [19.1, 17.8, 19.1, 17.8],
  narrow: [19.1, 6.4, 19.1, 6.4],
  wide: [25.4, 25.4, 25.4, 25.4]
}

/** Resumir los valores de una tabla dinámica (c_oAscDataConsolidateFunction, como su cuadro «Configuración de campo de valor»). */
export const PIVOT_FNS = { sum: 'Sum', count: 'Count', average: 'Average', max: 'Max', min: 'Min' } as const
export type PivotFn = keyof typeof PIVOT_FNS

/** Separadores de «Texto en columnas» (los números de su cuadro en el editor). */
export const DELIMITERS = { comma: 4, semicolon: 2, tab: 1, space: 5, other: -1 } as const
export type Delimiter = keyof typeof DELIMITERS

/**
 * Las formas de la galería: las mismas de Documentos y Presentaciones
 * (engine.ts, SHAPE_NAMES); copiadas aquí porque engine.ts carga las funciones.
 */
export const CELL_SHAPES = ['rect', 'roundRect', 'ellipse', 'triangle', 'rtTriangle', 'diamond', 'hexagon', 'star5', 'rightArrow', 'leftArrow', 'upArrow', 'downArrow', 'line', 'lineWithArrow', 'wedgeRectCallout', 'cloud', 'heart'] as const
const SHAPES = new Set<string>(CELL_SHAPES)

/** Filas que se repiten al imprimir: «1», «1:2», «$1:$3» → «$1:$3» (vacío: ninguna). */
export function rowsRange(text: string): string | null {
  const clean = text.replace(/\s/g, '')
  if (!clean) return ''
  const m = /^\$?(\d{1,7})(?::\$?(\d{1,7}))?$/.exec(clean)
  if (!m) return null
  const a = Number(m[1])
  const b = Number(m[2] ?? m[1])
  if (a < 1 || b < a || b > 1048576) return null
  return `$${a}:$${b}`
}

/** Columnas que se repiten al imprimir: «A», «a:b», «$A:$C» → «$A:$C» (vacío: ninguna). */
export function colsRange(text: string): string | null {
  const clean = text.replace(/\s/g, '').toUpperCase()
  if (!clean) return ''
  const m = /^\$?([A-Z]{1,3})(?::\$?([A-Z]{1,3}))?$/.exec(clean)
  if (!m) return null
  const index = (letters: string): number => [...letters].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0)
  const a = m[1]
  const b = m[2] ?? m[1]
  if (index(b) < index(a) || index(b) > 16384) return null
  return `$${a}:$${b}`
}

/** Un nombre definido como lo acepta Excel: empieza por letra, _ o \, sin espacios y sin parecer una celda. */
export function validName(name: string): boolean {
  if (!/^[\p{L}_\\][\p{L}\p{N}_.\\]{0,254}$/u.test(name)) return false
  if (/^[A-Za-z]{1,3}\d{1,7}$/.test(name) || /^[RrCc]\d*$/.test(name) || /^[Rr]\d*[Cc]\d*$/.test(name)) return false
  return true
}

function parse<T>(json: string | undefined): T | null {
  try {
    const value = JSON.parse(String(json ?? ''))
    return value && typeof value === 'object' ? (value as T) : null
  } catch {
    return null
  }
}

/** Lo que dice el editor de la hoja activa al imprimir (márgenes, títulos, cuadrícula y encabezados). */
export function readPrint(ctx: FeatureContext): void {
  const { api, ew } = ctx
  try {
    const sheet = api.asc_getActiveWorksheetIndex()
    const options = api.asc_getPageOptions(sheet)
    ctx.state.extra.printGrid = Boolean(options?.asc_getGridLines())
    ctx.state.extra.printHeadings = Boolean(options?.asc_getHeadings())
    const m = options?.asc_getPageMargins()
    if (m) {
      const now = [m.asc_getTop(), m.asc_getLeft(), m.asc_getBottom(), m.asc_getRight()].map(Number)
      const same = Object.entries(CELL_MARGINS).find(([, v]) => v.every((x, i) => Math.abs(x - now[i]) < 0.15))
      ctx.state.extra.margins = same?.[0] ?? 'custom'
      ctx.state.extra.marginValues = now
    }
    const P = ew.Asc.c_oAscPrintTitlesRangeType
    ctx.state.extra.titleRows = String(api.asc_getPrintTitlesRange(P.current, false, sheet) ?? '')
    ctx.state.extra.titleCols = String(api.asc_getPrintTitlesRange(P.current, true, sheet) ?? '')
  } catch {
    /* hoja sin opciones de página */
  }
}

/** El gráfico seleccionado: su tipo, su título, su leyenda y sus datos (sin bloquearlo). */
export function readChart(ctx: FeatureContext): void {
  const { api, ew } = ctx
  try {
    const props = api.asc_getChartSettings(true)
    if (!props) return
    const T = ew.Asc.c_oAscChartTypeSettings
    const type = props.getType()
    ctx.state.extra.chartType = (Object.entries(CHART_TYPES).find(([, name]) => T[name] === type)?.[0] as string | undefined) ?? ''
    const S = ew.Asc.c_oAscChartTitleShowSettings
    const title = props.getTitle()
    ctx.state.extra.chartTitle = title === S.overlay ? 'overlay' : title === S.noOverlay ? 'above' : 'none'
    const G = ew.Asc.c_oAscChartLegendShowSettings
    const legend = props.getLegendPos()
    ctx.state.extra.chartLegend = ({ [G.none]: 'none', [G.bottom]: 'bottom', [G.top]: 'top', [G.right]: 'right', [G.left]: 'left' } as Record<number, string>)[legend] ?? ''
    ctx.state.extra.chartRange = String(props.getRange?.() ?? '').replace(/^=/, '')
  } catch {
    /* sin gráfico */
  }
}

/** El pegado especial que se ha pedido en cada editor, a la espera de que pegue. */
const pendingPaste = new WeakMap<object, { props: Api; until: number }>()

/** El editor ha pegado: si se pidió un pegado especial, se cambia a ese (como su botón «Opciones de pegado»). */
export function pasteArrived(ctx: FeatureContext): void {
  const wanted = pendingPaste.get(ctx.api)
  pendingPaste.delete(ctx.api)
  if (!wanted || Date.now() > wanted.until) return
  try {
    ctx.api.asc_SpecialPaste(wanted.props)
  } catch (error) {
    console.error('pegado especial:', error)
  }
}

export function cellCommands(ctx: FeatureContext): Commands {
  const { api, ew } = ctx
  const A = ew.Asc
  const sheet = (): number => api.asc_getActiveWorksheetIndex()

  const specialProps = (spec: PasteSpec): Api => {
    const props = new A.SpecialPasteProps()
    props.asc_setProps(A.c_oSpecialPasteProps[PASTE_KINDS[spec.kind]])
    const O = A.c_oSpecialPasteOperation
    if (spec.op && spec.op !== 'none') props.asc_setOperation(O[spec.op])
    if (spec.skipBlanks) props.asc_setSkipBlanks(true)
    if (spec.transpose) props.asc_setTranspose(true)
    return props
  }

  return {
    // ------------------------------------------------------- pegado especial
    // Se pega lo copiado (como Ctrl+V) y, cuando el editor lo ha pegado, se
    // cambia a lo que se ha pedido (como su botón «Opciones de pegado»).
    pasteSpecial: (value) => {
      const spec: PasteSpec | null = value && value in PASTE_KINDS ? { kind: value as PasteKind } : parse<PasteSpec>(value)
      if (!spec || !(spec.kind in PASTE_KINDS)) return
      if (spec.op && !PASTE_OPS.includes(spec.op)) return
      const plain = spec.kind === 'all' && (!spec.op || spec.op === 'none') && !spec.skipBlanks && !spec.transpose
      if (plain) pendingPaste.delete(api)
      else pendingPaste.set(api, { props: specialProps(spec), until: Date.now() + 5000 })
      // Se pega donde está el teclado: primero, el teclado vuelve al documento.
      // Desde un menú de Molino estaba en la interfaz y, tras el botón derecho,
      // en el menú (oculto) del propio editor, que no deja pegar mientras está
      // abierto: se cierra y el editor recupera el teclado un momento después.
      setTimeout(() => {
        try {
          ew.Common?.UI?.Menu?.Manager?.hideAll?.()
          api.asc_enableKeyEvents?.(true)
          ew.focus()
          ew.Common?.NotificationCenter?.trigger('edit:complete')
        } catch {
          /* el editor ya tenía el teclado */
        }
        setTimeout(() => void window.molinoOffice.clipboard('paste'), 100)
      }, 0)
    },

    // -------------------------------------------------------------- filtros
    reapplyFilter: () => {
      const table = api.asc_getCellInfo()?.asc_getFormatTableInfo()
      api.asc_reapplyAutoFilter(table ? table.asc_getTableName() : null)
    },

    // ------------------------------------------------------------- gráficos
    chartType: (kind) => {
      const name = CHART_TYPES[kind as ChartKind]
      if (!name || !chartSelected(ctx)) return
      const props = api.asc_getChartSettings(true)
      if (!props) return
      props.changeType(A.c_oAscChartTypeSettings[name])
      ctx.state.extra.chartType = kind
    },
    // Título y leyenda: como el menú «Elementos del gráfico» del editor (se aplican al momento).
    chartTitle: (where) => {
      if (where !== 'none' && where !== 'above' && where !== 'overlay') return
      const props = chartElements(ctx)
      if (!props) return
      props.setDisplayChartTitle(where !== 'none', where === 'overlay')
      ctx.state.extra.chartTitle = where
    },
    chartTitleText: (text) => {
      const title = String(text ?? '').trim().slice(0, 255)
      if (!title || !chartSelected(ctx)) return
      const index = selectedChartIndex(ctx)
      if (index < 0) return
      // Con la API de documentos (con su deshacer): el título se ve encima, con ese texto.
      ctx.builder(
        function (scope) {
          const chart = Api.GetActiveSheet().GetAllCharts()[scope.molino.index]
          if (chart) chart.SetTitle(scope.molino.title, 28)
        },
        { index, title }
      )
      ctx.state.extra.chartTitle = 'above'
    },
    chartLegend: (where) => {
      const G = A.c_oAscChartLegendShowSettings
      const value = { none: G.none, bottom: G.bottom, top: G.top, right: G.right, left: G.left }[where as 'none']
      if (value === undefined) return
      const props = chartElements(ctx)
      if (!props) return
      props.setDisplayLegend(where !== 'none', value)
      ctx.state.extra.chartLegend = where
    },
    chartRange: (range) => {
      const clean = String(range ?? '').trim().replace(/^=/, '').slice(0, 500)
      if (!clean || !chartSelected(ctx)) return
      const props = api.asc_getChartSettings()
      if (!props) return
      props.startEdit()
      // Devuelve true o el número de error (ID.No si vale), como lo mira su cuadro «Datos del gráfico».
      const valid = props.isValidRange(clean)
      if (valid === true || valid === A.c_oAscError.ID.No) {
        props.setRange(clean)
        props.endEdit()
      } else props.cancelEdit()
      // Leer los ajustes así (sin «true») marca el gráfico como en edición, y
      // mientras lo esté el editor no guarda: se cierra como al cerrar su cuadro.
      api.asc_onCloseFrameEditor?.()
    },
    chartSwitch: () => {
      if (!chartSelected(ctx)) return
      const props = api.asc_getChartSettings(true)
      if (!props) return
      props.startEdit()
      if (props.switchRowCol() === A.c_oAscError.ID.MaxDataSeriesError) props.cancelEdit()
      else props.endEdit()
    },

    // ------------------------------------------------------------- esquema
    group: (what) => {
      if (what !== 'rows' && what !== 'columns') return
      if (api.asc_checkAddGroup() !== undefined) api.asc_group(what === 'rows')
    },
    ungroup: (what) => {
      if (what !== 'rows' && what !== 'columns') return
      if (api.asc_checkAddGroup(true) !== undefined) api.asc_ungroup(what === 'rows')
    },
    clearOutline: () => api.asc_clearOutline(),
    groupDetail: (what) => api.asc_changeGroupDetails(what === 'show'),

    // ---------------------------------------------------------- auditoría
    tracePrecedents: () => api.asc_TracePrecedents(),
    traceDependents: () => api.asc_TraceDependents(),
    removeArrows: (which) => {
      const R = A.c_oAscRemoveArrowsType
      const value = { all: R.all, precedent: R.precedent, dependent: R.dependent }[(which || 'all') as 'all']
      if (value !== undefined) api.asc_RemoveTraceArrows(value)
    },
    showFormulas: () => {
      const on = !api.asc_getShowFormulas()
      api.asc_setShowFormulas(on)
      ctx.state.extra.showFormulas = on
      ctx.changed()
    },

    // ------------------------------------------------------------- página
    cellMargins: (value) => {
      let mm: number[] | undefined = CELL_MARGINS[value ?? '']
      if (!mm) {
        const custom = parse<Record<string, unknown>>(value)
        if (!custom) return
        mm = ['top', 'left', 'bottom', 'right'].map((k) => Number(custom[k]))
        if (!mm.every((n) => Number.isFinite(n) && n >= 0 && n <= 200)) return
      }
      const margins = new A.asc_CPageMargins()
      margins.asc_setTop(mm[0])
      margins.asc_setLeft(mm[1])
      margins.asc_setBottom(mm[2])
      margins.asc_setRight(mm[3])
      api.asc_changePageMargins(margins, undefined, undefined, undefined, undefined, sheet())
      readPrint(ctx)
    },
    printTitles: (value) => {
      const P = A.c_oAscPrintTitlesRangeType
      let rows = String(api.asc_getPrintTitlesRange(P.current, false, sheet()) ?? '')
      let cols = String(api.asc_getPrintTitlesRange(P.current, true, sheet()) ?? '')
      if (value === 'row') rows = '$1:$1'
      else if (value === 'col') cols = '$A:$A'
      else if (value === 'none') rows = cols = ''
      else {
        const wanted = parse<{ rows?: string; cols?: string }>(value)
        if (!wanted) return
        const r = rowsRange(String(wanted.rows ?? ''))
        const c = colsRange(String(wanted.cols ?? ''))
        if (r === null || c === null) return
        rows = r
        cols = c
      }
      api.asc_changePrintTitles(cols, rows, sheet())
      readPrint(ctx)
    },
    printGridlines: () => {
      api.asc_SetPrintGridlines(!ctx.state.extra.printGrid)
      readPrint(ctx)
    },
    printHeadings: () => {
      api.asc_SetPrintHeadings(!ctx.state.extra.printHeadings)
      readPrint(ctx)
    },

    // -------------------------------------------------------------- formas
    // Una forma de su tamaño de siempre en la hoja (se mueve y se estira después).
    shape: (name) => {
      if (!SHAPES.has(name ?? '')) return
      if (typeof api.asc_addShapeOnSheet === 'function') api.asc_addShapeOnSheet(name)
      else api.asc_startAddShape(name)
    },

    // ------------------------------------------------------------- nombres
    nameAdd: (json) => {
      const wanted = parse<{ name?: string; ref?: string; scope?: number | null }>(json)
      if (!wanted) return
      const name = String(wanted.name ?? '').trim()
      const ref = String(wanted.ref ?? '').trim().replace(/^=/, '').slice(0, 2000)
      const scope = typeof wanted.scope === 'number' && wanted.scope >= 0 ? wanted.scope : null
      if (!validName(name) || !ref || nameProblem(ctx, name, scope, null) || !validRef(ctx, ref)) return
      api.asc_setDefinedNames(new A.asc_CDefName(name, ref, scope, null, undefined, undefined, undefined, true))
      namesChanged(ctx)
    },
    nameEdit: (json) => {
      const wanted = parse<{ old?: { name?: string; ref?: string; scope?: number | null; type?: number | null }; name?: string; ref?: string }>(json)
      const old = wanted?.old
      if (!wanted || !old) return
      const name = String(wanted.name ?? '').trim()
      const ref = String(wanted.ref ?? '').trim().replace(/^=/, '').slice(0, 2000)
      const scope = typeof old.scope === 'number' ? old.scope : null
      if (!validName(name) || !ref || nameProblem(ctx, name, scope, String(old.name ?? '')) || !validRef(ctx, ref)) return
      const before = new A.asc_CDefName(String(old.name ?? ''), String(old.ref ?? ''), scope, old.type ?? null, undefined, undefined, undefined, true)
      api.asc_editDefinedNames(before, new A.asc_CDefName(name, ref, scope, old.type ?? null, undefined, undefined, undefined, true))
      namesChanged(ctx)
    },
    nameDelete: (json) => {
      const old = parse<{ name?: string; ref?: string; scope?: number | null; type?: number | null }>(json)
      if (!old?.name) return
      api.asc_delDefinedNames(new A.asc_CDefName(String(old.name), String(old.ref ?? ''), typeof old.scope === 'number' ? old.scope : null, old.type ?? null, undefined, undefined, undefined, true))
      namesChanged(ctx)
    },

    // ------------------------------------------------------ tablas dinámicas
    pivotCreate: (json) => {
      const wanted = parse<{ range?: string; name?: string; rows?: number; cols?: number; values?: number; fn?: PivotFn; valueName?: string }>(json)
      if (!wanted) return
      const range = String(wanted.range ?? '').trim().slice(0, 500)
      if (!range || api.asc_checkDataRange(A.c_oAscSelectionDialogType.PivotTableData, range, false) !== A.c_oAscError.ID.No) return
      const used = new Set<string>()
      for (let i = 0; i < api.asc_getWorksheetsCount(); i++) used.add(String(api.asc_getWorksheetName(i)).toLowerCase())
      const base = String(wanted.name ?? 'Tabla dinámica').replace(/[\\/?*[\]:]/g, '').slice(0, 26) || 'Pivot'
      let name = base
      for (let n = 2; used.has(name.toLowerCase()) && n < 1000; n++) name = `${base} ${n}`
      api.asc_insertPivotNewWorksheet(range, name)
      // Los campos, uno a uno: cada cambio rehace la tabla (y sus propiedades).
      const field = (n: unknown): number | null => (typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < 16384 ? n : null)
      const steps: ((pivot: Api) => void)[] = []
      const rows = field(wanted.rows)
      const cols = field(wanted.cols)
      const values = field(wanted.values)
      if (rows !== null) steps.push((p) => p.asc_addRowField(api, rows))
      if (cols !== null && cols !== rows) steps.push((p) => p.asc_addColField(api, cols))
      if (values !== null) steps.push((p) => p.asc_addDataField(api, values))
      // Cómo se resume y su nombre («Cuenta de Importe»), como su cuadro «Configuración de campo de valor».
      const fn = wanted.fn && wanted.fn in PIVOT_FNS ? wanted.fn : 'sum'
      const valueName = String(wanted.valueName ?? '').trim().slice(0, 255)
      const summarize = values !== null && (fn !== 'sum' || valueName !== '')
      if (summarize) {
        steps.push((p) => {
          const fields = p.asc_getDataFields() || []
          const last = fields.length - 1
          if (last < 0) return
          const change = new A.CT_DataField()
          if (valueName) change.asc_setName(valueName)
          change.asc_setSubtotal(A.c_oAscDataConsolidateFunction[PIVOT_FNS[fn]])
          fields[last].asc_set(api, p, last, change)
        })
      }
      let tries = 0
      const next = (): void => {
        const pivot = api.asc_getCellInfo()?.asc_getPivotTableInfo()
        // La tabla (o su campo de valores) aún no está: se espera un poco.
        const waiting = !pivot || (steps.length === 1 && summarize && !(pivot.asc_getDataFields() || []).length)
        if (waiting) {
          if (tries++ < 30) setTimeout(next, 100)
          return
        }
        const step = steps.shift()
        if (!step) return
        try {
          step(pivot)
        } catch (error) {
          console.error('tabla dinámica:', error)
          return
        }
        tries = 0
        setTimeout(next, 50)
      }
      next()
    },
    refreshPivots: () => api.asc_refreshAllPivots(),

    // ---------------------------------------------------- texto en columnas
    textToColumns: (json) => {
      const wanted = parse<{ delimiter?: Delimiter; other?: string }>(json)
      if (!wanted || !wanted.delimiter || !(wanted.delimiter in DELIMITERS)) return
      const other = [...String(wanted.other ?? '')][0] ?? ''
      if (wanted.delimiter === 'other' && !other) return
      const list = wanted.delimiter === 'other' ? [] : [DELIMITERS[wanted.delimiter]]
      api.asc_TextToColumns(new A.asc_CTextOptions(0, ctx.local(list), wanted.delimiter === 'other' ? other : null))
    },

    // --------------------------------------------------------- minigráficos
    sparkline: (json) => {
      const wanted = parse<{ type?: string; source?: string; destination?: string }>(json)
      const S = A.c_oAscSparklineType
      if (!wanted || !S) return
      const type = { line: S.Line, column: S.Column, stacked: S.Stacked }[wanted.type as 'line']
      const source = String(wanted.source ?? '').trim().replace(/^=/, '').slice(0, 500)
      const destination = String(wanted.destination ?? '').trim().replace(/^=/, '').slice(0, 500)
      if (type === undefined || !source || !destination) return
      api.asc_addSparklineGroup(type, qualified(ctx, source), qualified(ctx, destination))
    }
  }
}

/** El rango con el nombre de la hoja activa delante si no lo lleva («B2:E2» → «'Hoja 1'!B2:E2»). */
function qualified(ctx: FeatureContext, range: string): string {
  if (range.includes('!')) return range
  const name = String(ctx.api.asc_getWorksheetName(ctx.api.asc_getActiveWorksheetIndex()))
  return `${/^[\p{L}_][\p{L}\p{N}_]*$/u.test(name) ? name : `'${name.replace(/'/g, "''")}'`}!${range}`
}

/** La lista de nombres ha cambiado: el panel los vuelve a leer. */
export function namesChanged(ctx: FeatureContext): void {
  ctx.state.extra.names = Number(ctx.state.extra.names ?? 0) + 1
  ctx.changed()
}

/** ¿Hay un problema con este nombre? ('' si vale). Al cambiar uno, su propio nombre vale. */
export function nameProblem(ctx: FeatureContext, name: string, scope: number | null, own: string | null): '' | 'bad' | 'used' {
  if (!validName(name)) return 'bad'
  if (own !== null && own.toLowerCase() === name.toLowerCase()) return ''
  try {
    const check = ctx.api.asc_checkDefinedName(name, scope)
    if (check?.asc_getStatus() === true) return ''
    return check?.asc_getReason() === ctx.ew.Asc.c_oAscDefinedNameReason.Existed ? 'used' : 'bad'
  } catch {
    return ''
  }
}

/** ¿Es un rango (o un valor) que puede nombrarse? Como lo comprueba el cuadro del editor. */
export function validRef(ctx: FeatureContext, ref: string): boolean {
  try {
    const A = ctx.ew.Asc
    return ctx.api.asc_checkDataRange(A.c_oAscSelectionDialogType.Chart, ref, false) !== A.c_oAscError.ID.DataRangeError
  } catch {
    return false
  }
}

/** ¿Hay un gráfico seleccionado? (sin él, las propiedades de gráfico son las de uno nuevo). */
function chartSelected(ctx: FeatureContext): boolean {
  try {
    const R = ctx.ew.Asc.c_oAscSelectionType
    const type = ctx.api.asc_getCellInfo()?.asc_getSelectionType()
    return type === R.RangeChart || type === R.RangeChartText
  } catch {
    return false
  }
}

/** Las propiedades del gráfico seleccionado que cambian sus elementos al momento (las del menú del editor). */
function chartElements(ctx: FeatureContext): Api {
  try {
    const A = ctx.ew.Asc
    for (const item of ctx.api.asc_getGraphicObjectProps() || []) {
      if (item.asc_getObjectType() !== A.c_oAscTypeSelectElement.Image) continue
      const chart = item.asc_getObjectValue()?.asc_getChartProperties?.()
      if (chart) return chart
    }
  } catch {
    /* sin gráfico */
  }
  return null
}

/** El gráfico seleccionado entre los de la hoja (por su nombre, que el editor da a cada dibujo), o -1. */
function selectedChartIndex(ctx: FeatureContext): number {
  try {
    const A = ctx.ew.Asc
    const charts: Api[] = ctx.api.getJsApi().GetActiveSheet().GetAllCharts() || []
    let name = ''
    for (const item of ctx.api.asc_getGraphicObjectProps() || []) {
      const value = item.asc_getObjectType() === A.c_oAscTypeSelectElement.Image ? item.asc_getObjectValue() : null
      if (value?.asc_getChartProperties?.()) name = String(value.asc_getName?.() ?? '')
    }
    const named = name ? charts.map((c, i) => (String(c.GetName?.() ?? '') === name ? i : -1)).filter((i) => i >= 0) : []
    if (named.length === 1) return named[0]
    return charts.length === 1 ? 0 : -1
  } catch {
    return -1
  }
}
