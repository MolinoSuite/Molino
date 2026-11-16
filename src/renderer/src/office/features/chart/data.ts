/**
 * Los datos de un gráfico de Documentos o Presentaciones (features/chart/):
 * leerlos del gráfico seleccionado y escribirlos con la API de documentos del
 * editor («builder»). Lo escrito queda en el gráfico (sus cachés) y, al
 * guardar, también en la hoja que lleva dentro el .docx o el .pptx.
 *
 * Con la misma forma (las mismas categorías y series, o quitando series), se
 * cambian los datos del gráfico que hay: conserva todo su formato. Si se
 * añaden o quitan categorías, o se añaden series (o hay que cambiar algo que
 * la API no puede cambiar en el gráfico, como una categoría que es un número),
 * se vuelve a crear en el mismo sitio, con el mismo tipo, título, leyenda y
 * tamaño.
 *
 * El editor de gráficos de ONLYOFFICE (una hoja de cálculo en un marco) no
 * funciona en Molino: necesita su propia «app de escritorio» dentro del marco.
 */
import type { Api, FeatureContext } from '../types'

/** La API de documentos del editor: solo existe dentro de las funciones de ctx.builder. */
declare const Api: Api

/** Como mucho (es un cuadro para escribir, no una hoja de cálculo). */
export const MAX_SERIES = 30
export const MAX_CATEGORIES = 200
/** Milímetros a EMU (las unidades de la API de documentos). */
const EMU_MM = 36_000

/** Los datos del gráfico seleccionado, como los enseña el cuadro. */
export interface ChartData {
  /** Su tipo en el editor (c_oAscChartTypeSettings). */
  type: number
  /** De dispersión: la primera columna son los valores de X (números), no nombres. */
  scatter: boolean
  /** Las series: su número en el gráfico (c:idx) y su nombre. */
  series: { idx: number; name: string }[]
  /** Las categorías (o los valores de X). */
  categories: string[]
  /** Las cifras: [serie][categoría] (null: sin dato). */
  values: (number | null)[][]
}

/** Lo que se ha escrito en el cuadro: cada serie y cada categoría, con la de antes de la que viene (null: nueva). */
export interface ChartEdit {
  series: { from: number | null; name: string }[]
  categories: { from: number | null; name: string }[]
  /** [serie][categoría], ya como números. */
  values: number[][]
  /** De dispersión: los valores de X (si no, null). */
  x: number[] | null
}

/** El gráfico seleccionado (sus propiedades en el editor, y dónde está), o null. */
function selected(api: Api): { props: Api; value: Api } | null {
  try {
    for (const el of api.getSelectedElements() || []) {
      const value = el?.get_ObjectValue?.()
      const props = value && typeof value.get_ChartProperties === 'function' ? value.get_ChartProperties() : null
      if (props) return { props, value }
    }
  } catch {
    return null
  }
  return null
}

/** Las propiedades del gráfico seleccionado (las del editor), o null. */
export function selectedChartProps(api: Api): Api | null {
  return selected(api)?.props ?? null
}

function scatterType(ctx: FeatureContext, type: number): boolean {
  const T = ctx.ew.Asc.c_oAscChartTypeSettings
  return Object.keys(T).some((name) => name.startsWith('scatter') && T[name] === type)
}

/**
 * Un número de lo que da el editor, o null. Lo da escrito en el idioma de la
 * interfaz («4», «12,5» en español, «12.5» en inglés, «1E3»): el separador que
 * va el último es el decimal y los demás, de miles.
 */
function cached(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  let text = String(raw ?? '').replace(/\s/g, '')
  if (!text) return null
  const decimal = Math.max(text.lastIndexOf(','), text.lastIndexOf('.'))
  if (decimal >= 0 && !/e/i.test(text.slice(decimal))) {
    text = `${text.slice(0, decimal).replace(/[.,]/g, '')}.${text.slice(decimal + 1)}`
  }
  const n = Number(text)
  return Number.isFinite(n) ? n : null
}

/** Las cifras de una serie (en uno de dispersión, las de Y). */
function seriesValues(series: Api, scatter: boolean): unknown[] {
  if (scatter && typeof series.asc_getYValuesArr === 'function') return series.asc_getYValuesArr() || []
  return series.asc_getValuesArr?.() || []
}

/** Los datos del gráfico seleccionado (null: no hay ninguno o no se pueden leer). */
export function readChart(ctx: FeatureContext): ChartData | null {
  const props = selectedChartProps(ctx.api)
  if (!props) return null
  try {
    const type = Number(props.getType())
    const scatter = scatterType(ctx, type)
    const list: Api[] = (props.getSeries() || []).slice(0, MAX_SERIES)
    if (!list.length) return null
    const series = list.map((s, i) => ({ idx: Number(s.asc_getIdx?.() ?? i), name: String(s.asc_getSeriesName?.() ?? '').slice(0, 255) }))
    const values = list.map((s) => seriesValues(s, scatter).slice(0, MAX_CATEGORIES).map(cached))
    const rawCategories: unknown[] = scatter ? list[0].asc_getXValuesArr?.() || [] : props.getCatValues?.() || []
    const count = Math.min(MAX_CATEGORIES, Math.max(rawCategories.length, ...values.map((v) => v.length)))
    const categories = Array.from({ length: count }, (_, i) => String(rawCategories[i] ?? '').slice(0, 255))
    return { type, scatter, series, categories, values: values.map((v) => Array.from({ length: count }, (_, i) => v[i] ?? null)) }
  } catch (error) {
    console.error('datos del gráfico:', error)
    return null
  }
}

/** ¿Se puede escribir en el gráfico que hay, sin rehacerlo? (las mismas categorías; series, las de antes o menos). */
export function sameShape(before: ChartData, edit: ChartEdit): boolean {
  if (edit.categories.length !== before.categories.length) return false
  if (!edit.categories.every((c, i) => c.from === i)) return false
  let last = -1
  for (const s of edit.series) {
    if (s.from === null || s.from <= last) return false
    last = s.from
  }
  return edit.series.length > 0
}

/** El tipo de la API de documentos que corresponde al del editor (si no está, uno parecido: se cambia después). */
const BUILDER_TYPES: Record<string, string> = {
  barNormal: 'bar',
  barStacked: 'barStacked',
  barStackedPer: 'barStackedPercent',
  barNormal3d: 'bar3D',
  barStacked3d: 'barStacked3D',
  barStackedPer3d: 'barStackedPercent3D',
  hBarNormal: 'horizontalBar',
  hBarStacked: 'horizontalBarStacked',
  hBarStackedPer: 'horizontalBarStackedPercent',
  hBarNormal3d: 'horizontalBar3D',
  hBarStacked3d: 'horizontalBarStacked3D',
  hBarStackedPer3d: 'horizontalBarStackedPercent3D',
  lineNormal: 'lineNormal',
  lineStacked: 'lineStacked',
  lineStackedPer: 'lineStackedPercent',
  line3d: 'line3D',
  pie: 'pie',
  pie3d: 'pie3D',
  doughnut: 'doughnut',
  scatter: 'scatter',
  areaNormal: 'area',
  areaStacked: 'areaStacked',
  areaStackedPer: 'areaStackedPercent'
}

function builderType(ctx: FeatureContext, type: number): { name: string; exact: boolean } {
  const T = ctx.ew.Asc.c_oAscChartTypeSettings
  const editor = Object.keys(T).find((k) => T[k] === type) ?? ''
  if (BUILDER_TYPES[editor]) return { name: BUILDER_TYPES[editor], exact: true }
  const family = /^scatter/.test(editor) ? 'scatter' : /^line/.test(editor) ? 'lineNormal' : /^hBar/.test(editor) ? 'horizontalBar' : /^area/.test(editor) ? 'area' : /^pie|^doughnut/.test(editor) ? 'pie' : 'bar'
  return { name: family, exact: false }
}

/** Dónde va la leyenda, como lo entiende la API de documentos. */
function legendOf(ctx: FeatureContext, props: Api): string {
  const S = ctx.ew.Asc.c_oAscChartLegendShowSettings
  const pos = Number(props.getLegendPos?.())
  if (pos === S.left || pos === S.leftOverlay) return 'left'
  if (pos === S.right || pos === S.rightOverlay || pos === S.topRight) return 'right'
  if (pos === S.top) return 'top'
  if (pos === S.bottom || pos === S.layout) return 'bottom'
  return 'none'
}

/**
 * Dónde está el gráfico seleccionado (en EMU): en Presentaciones, la API de
 * documentos no sabe cuál está seleccionado; se busca el de la diapositiva que
 * está en ese sitio y tiene ese tamaño.
 */
function placeOf(value: Api): { x: number; y: number; w: number; h: number } {
  const n = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0)
  try {
    const at = value.get_Position?.()
    return { x: n(at?.get_X?.()) * EMU_MM, y: n(at?.get_Y?.()) * EMU_MM, w: n(value.get_Width?.()) * EMU_MM, h: n(value.get_Height?.()) * EMU_MM }
  } catch {
    return { x: 0, y: 0, w: 0, h: 0 }
  }
}

/** Que el editor vuelva a leer lo seleccionado (después de cambiarlo con la API de documentos, no lo hace solo). */
function refresh(ctx: FeatureContext): void {
  try {
    ctx.api.UpdateInterfaceState?.()
  } catch {
    /* se actualizará con el próximo clic */
  }
}

/**
 * Escribe lo editado en el gráfico seleccionado (un paso para deshacer; dos si
 * hay que rehacerlo después de ver que no ha cambiado todo). true: se ha hecho.
 */
export function writeChart(ctx: FeatureContext, before: ChartData, edit: ChartEdit): boolean {
  const found = selected(ctx.api)
  if (!found) return false
  if (!sameShape(before, edit)) return rebuild(ctx, found, before, edit)
  const keep = new Set(edit.series.map((s) => s.from))
  const done = ctx.builder(
    function (scope) {
      const m = scope.molino
      let chart = null
      if (m.word) {
        const drawings = Api.GetDocument().GetSelectedDrawings()
        for (let i = 0; i < drawings.length && !chart; i++) if (drawings[i].GetClassType() === 'chart') chart = drawings[i]
      } else {
        const all = Api.GetPresentation().GetCurrentSlide().GetAllCharts()
        let best = Infinity
        for (let i = 0; i < all.length; i++) {
          const c = all[i]
          const d = Math.abs(c.GetPosX() - m.at.x) + Math.abs(c.GetPosY() - m.at.y) + Math.abs(c.GetWidth() - m.at.w) + Math.abs(c.GetHeight() - m.at.h)
          if (d < best) {
            best = d
            chart = c
          }
        }
      }
      if (!chart) return
      for (let i = 0; i < m.removed.length; i++) chart.RemoveSeria(m.removed[i])
      // Los nombres primero y las cifras al final: poner cifras es lo que hace que el gráfico se
      // vuelva a dibujar (con los nombres nuevos también).
      if (m.scatter) chart.SetXValues(m.xValues)
      else for (let i = 0; i < m.categories.length; i++) chart.SetCategoryName(m.categories[i].name, m.categories[i].i)
      for (let i = 0; i < m.series.length; i++) chart.SetSeriaName(m.series[i].name, m.series[i].idx)
      for (let i = 0; i < m.series.length; i++) chart.SetSeriaValues(m.series[i].values, m.series[i].idx)
    },
    ctx.local({
      word: ctx.kind === 'word',
      at: placeOf(found.value),
      scatter: before.scatter,
      removed: before.series.filter((_, i) => !keep.has(i)).map((s) => s.idx),
      series: edit.series.map((s, i) => ({ idx: before.series[s.from ?? 0].idx, name: s.name, values: edit.values[i] })),
      // Solo los nombres que cambian (los de antes se quedan como están).
      categories: edit.categories.flatMap((c, i) => (c.name !== before.categories[i] ? [{ i, name: c.name }] : [])),
      xValues: edit.x ?? []
    })
  )
  if (!done) return false
  refresh(ctx)
  // Lo que la API no ha podido cambiar en el gráfico que hay (una categoría que es un
  // número o una fecha, los valores de X…): se rehace con todo, cuando el editor ya lo ha aplicado.
  const same = (a: string, b: string): boolean => a === b || (before.scatter && Number(a) === Number(b))
  const wanted = before.scatter ? (edit.x ?? []).map(String) : edit.categories.map((c) => c.name)
  setTimeout(() => {
    const now = readChart(ctx)
    if (!now || now.categories.every((c, i) => same(c, wanted[i] ?? ''))) return
    const again = selected(ctx.api)
    if (again) rebuild(ctx, again, before, edit)
  }, 250)
  return true
}

/** Lo vuelve a hacer con los datos nuevos, en el mismo sitio, con el mismo tipo, título, leyenda y tamaño. */
function rebuild(ctx: FeatureContext, found: { props: Api; value: Api }, before: ChartData, edit: ChartEdit): boolean {
  const type = builderType(ctx, before.type)
  const done = ctx.builder(
    function (scope) {
      const m = scope.molino
      let old = null
      let slide = null
      if (m.word) {
        const drawings = Api.GetDocument().GetSelectedDrawings()
        for (let i = 0; i < drawings.length && !old; i++) if (drawings[i].GetClassType() === 'chart') old = drawings[i]
      } else {
        slide = Api.GetPresentation().GetCurrentSlide()
        const all = slide.GetAllCharts()
        let best = Infinity
        for (let i = 0; i < all.length; i++) {
          const c = all[i]
          const d = Math.abs(c.GetPosX() - m.at.x) + Math.abs(c.GetPosY() - m.at.y) + Math.abs(c.GetWidth() - m.at.w) + Math.abs(c.GetHeight() - m.at.h)
          if (d < best) {
            best = d
            old = c
          }
        }
      }
      if (!old) return
      const title = String(old.GetTitle ? old.GetTitle() || '' : '')
        .replace(/[\r\n]+/g, ' ')
        .trim()
      const chart = Api.CreateChart(m.type, m.values, m.names, m.categories, old.GetWidth(), old.GetHeight(), m.style)
      if (!chart) return
      if (title) chart.SetTitle(title, m.titleSize, false)
      chart.SetLegendPos(m.legend)
      if (m.word) {
        const paragraph = old.GetParentParagraph()
        if (!paragraph) return
        paragraph.AddDrawing(chart)
      } else {
        chart.SetPosition(old.GetPosX(), old.GetPosY())
        slide.AddObject(chart)
      }
      old.Delete()
      chart.Select()
    },
    ctx.local({
      word: ctx.kind === 'word',
      at: placeOf(found.value),
      type: type.name,
      values: edit.values,
      names: edit.series.map((s) => s.name),
      categories: before.scatter ? (edit.x ?? []) : edit.categories.map((c) => c.name),
      style: 24,
      titleSize: ctx.kind === 'word' ? 28 : 36,
      legend: legendOf(ctx, found.props)
    })
  )
  if (!done) return false
  if (ctx.kind === 'word') {
    // En Documentos, el editor se queda con el gráfico viejo como seleccionado (aunque ya no esté):
    // mejor sin nada seleccionado (un clic en el nuevo lo selecciona, con sus datos de verdad).
    ctx.builder(function () {
      Api.GetDocument().RemoveSelection()
    }, null)
  } else if (!type.exact) {
    // Un tipo que la API no sabe crear (columnas con marcadores, combinados…): el mismo, con el editor.
    try {
      const fresh = selectedChartProps(ctx.api)
      if (fresh && Number(fresh.getType()) !== before.type) fresh.changeType(before.type)
    } catch {
      /* se queda con el parecido */
    }
  }
  refresh(ctx)
  return true
}

/**
 * Doble clic en un gráfico (y, en Presentaciones, al insertar uno): el editor
 * pide su «editor de gráficos» (asc_doubleClickOnChart), una hoja de cálculo en
 * un marco que en Molino no puede funcionar. Se abre el cuadro de Molino. El
 * aviso lo registra también la interfaz del editor (oculta), y parte de ella se
 * carga tarde: cualquier otro registro de ese aviso, ahora o después, se ignora.
 */
export function takeChartDoubleClick(ctx: FeatureContext): void {
  const api = ctx.api
  if (!api || typeof api.asc_registerCallback !== 'function' || api.molinoChartData) return
  api.molinoChartData = true
  const register = api.asc_registerCallback
  const ours = (): void => ctx.request('dialog', 'chartData')
  api.asc_registerCallback = function (this: Api, name: unknown, fn: unknown, ...rest: unknown[]) {
    if (name === 'asc_doubleClickOnChart' && fn !== ours) return undefined
    return register.call(this, name, fn, ...rest)
  }
  try {
    api.asc_unregisterCallback('asc_doubleClickOnChart')
  } catch {
    /* sin aviso que quitar */
  }
  register.call(api, 'asc_doubleClickOnChart', ours)
}
