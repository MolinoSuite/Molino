import {
  Bookmark,
  Braces,
  Calendar,
  Captions,
  ChartArea,
  ChartBar,
  ChartColumn,
  ChartLine,
  ChartPie,
  Clock,
  Columns2,
  Donut,
  Eraser,
  FileStack,
  GitCompareArrows,
  GitMerge,
  Hash,
  Heading,
  Languages,
  Link,
  Link2,
  ListTree,
  Mails,
  PaintBucket,
  PanelBottom,
  PanelTop,
  RefreshCw,
  Square,
  SquareCheck,
  Table2,
  Trash2,
  X
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { MenuOption, Mode, SelectedObject, Tool } from '../apps'
import type { PromptSpec } from '../dialogs'
import type { EditorSession, EditorState } from '../engine'
import { L } from '../i18n'
import type { Api, Feature, FeatureContext } from './types'
import { BookmarksDialog } from './word/BookmarksDialog'
import { CompareDialog } from './word/CompareDialog'
import { CrossRefDialog } from './word/CrossRefDialog'
import { CHARTS, type ChartKind, chartKindOf, describeTableStyle, extraOf, intIn, LANGS, langByLcid, MAIL_MERGE_MAX_ROWS, selectedElements, type TableStyleInfo } from './word/data'
import { MailMergePanel } from './word/MailMergePanel'
import { NavigationPanel } from './word/NavigationPanel'
import './word/word.css'

/** La API de documentos del editor («builder»): solo existe dentro de las funciones que se le pasan (ctx.builder). */
declare const Api: Api

const W = L.officeWord
const ICON = 16
/**
 * «Se está editando el encabezado o el pie»: engine.ts no lo tiene entre lo
 * seleccionado (tabla, imagen, forma, gráfico), así que listen() lo añade a
 * state.objects para que salga la pestaña de contexto (HF_MODE).
 */
const HEADER = 'header' as unknown as SelectedObject

/**
 * Funciones de Documentos (además de las de siempre):
 * - Índice: actualizar o quitar la tabla de contenido, el panel de navegación,
 *   títulos de tabla e imagen, referencias cruzadas y marcadores.
 * - Insertar: opciones del encabezado y el pie, campos («Página X de Y»,
 *   fecha…), gráficos y combinar correspondencia.
 * - Tabla: la galería de estilos (las miniaturas del editor) y el sombreado.
 * - Revisar: el idioma del texto (para el corrector) y comparar o combinar.
 * - Pestañas de contexto: el encabezado o pie que se edita y el gráfico seleccionado.
 * Ver types.ts.
 */

// ------------------------------------------------------------- herramientas

const button = (key: string, label: string, command: string, icon: ReactNode, extra: Partial<Extract<Tool, { type: 'button' }>> = {}): Tool => ({
  type: 'button',
  key,
  label,
  command,
  icon,
  ...extra
})
const menu = (key: string, label: string, command: string, icon: ReactNode, options: MenuOption[] | ((s: EditorState) => MenuOption[]), extra: Partial<Extract<Tool, { type: 'menu' }>> = {}): Tool => ({
  type: 'menu',
  key,
  label,
  command,
  icon,
  options,
  ...extra
})
const check = (on: boolean): ReactNode => (on ? <SquareCheck size={15} /> : <Square size={15} />)

/** Índice: actualizar la tabla de contenido (toda o solo los números de página) o quitarla. */
const TOC_MENU = menu(
  'wTocUpdate',
  W.toc.update,
  'tocUpdate',
  <RefreshCw size={ICON} />,
  [
    { value: 'all', label: W.toc.all, icon: <RefreshCw size={15} /> },
    { value: 'pages', label: W.toc.pages, icon: <Hash size={15} /> },
    { value: '', label: W.toc.remove, command: 'tocRemove', action: true, icon: <Trash2 size={15} /> }
  ],
  { caption: true }
)
const NAV = button('wNavigation', W.nav.button, 'panel', <ListTree size={ICON} />, { value: 'navigation', caption: true })
const CAPTION = button('wCaption', W.caption.button, 'captionAsk', <Captions size={ICON} />, { caption: true })
const CROSS_REF = button('wCrossRef', W.crossRef.button, 'dialog', <Link2 size={ICON} />, { value: 'crossRef' })
const BOOKMARK = button('wBookmark', W.bookmarks.button, 'dialog', <Bookmark size={ICON} />, { value: 'bookmarks' })

/** Encabezado y pie: lo de su pestaña, también desde Insertar (entra en el encabezado si hace falta). */
const hfOptions = (s: EditorState): MenuOption[] => {
  const hf = extraOf(s).hf ?? null
  return [
    { value: 'first', label: W.hf.first, icon: hf ? check(hf.first) : <FileStack size={15} /> },
    { value: 'oddEven', label: W.hf.oddEven, icon: hf ? check(hf.oddEven) : <Columns2 size={15} /> },
    ...(hf && hf.link !== null ? [{ value: 'link', label: W.hf.link, icon: check(hf.link) }] : []),
    { value: 'header', label: W.hf.removeHeader, command: 'hfRemove', action: true, icon: <PanelTop size={15} /> },
    { value: 'footer', label: W.hf.removeFooter, command: 'hfRemove', action: true, icon: <PanelBottom size={15} /> }
  ]
}
const HF_MENU = menu('wHeaderFooter', W.hf.options, 'hfToggle', <PanelTop size={ICON} />, hfOptions)

/** Campos: «Página X de Y» en el pie y, donde está el cursor, página, páginas, fecha y hora. */
const FIELDS_MENU = menu(
  'wFields',
  W.fields.menu,
  'field',
  <Braces size={ICON} />,
  [
    { value: 'pageOfPages', label: W.fields.pageOfPages, icon: <PanelBottom size={15} /> },
    { value: 'page', label: W.fields.page, icon: <Hash size={15} /> },
    { value: 'pages', label: W.fields.pages, icon: <FileStack size={15} /> },
    { value: 'date', label: W.fields.date, icon: <Calendar size={15} /> },
    { value: 'dateLong', label: W.fields.dateLong, icon: <Calendar size={15} /> },
    { value: 'time', label: W.fields.time, icon: <Clock size={15} /> },
    { value: '', label: W.fields.update, command: 'updateFields', action: true, icon: <RefreshCw size={15} /> }
  ],
  { caption: true }
)

const CHART_ICONS: Record<ChartKind, ReactNode> = {
  column: <ChartColumn size={20} />,
  bar: <ChartBar size={20} />,
  line: <ChartLine size={20} />,
  pie: <ChartPie size={20} />,
  area: <ChartArea size={20} />,
  doughnut: <Donut size={20} />
}
const chartOptions = (command?: string): MenuOption[] => (Object.keys(CHARTS) as ChartKind[]).map((kind) => ({ value: kind, label: W.chart.types[kind], preview: CHART_ICONS[kind], command }))
const CHART_MENU = menu('wChart', W.chart.insert, 'chartInsert', <ChartColumn size={ICON} />, chartOptions(), { caption: true, tiles: 3 })
const MAIL_MERGE = button('wMailMerge', W.mailMerge.button, 'panel', <Mails size={ICON} />, { value: 'mailMerge' })

/** Tabla: la galería de estilos (las miniaturas del propio editor), por grupos. */
const TABLE_GROUPS: TableStyleInfo['group'][] = ['plain', 'grid', 'list', 'lined', 'custom', 'other']
const tableStyleOptions = (s: EditorState): MenuOption[] => {
  const styles = extraOf(s).tableStyles
  if (!styles?.length) return [{ value: '', label: W.tableStyles.loading, heading: true }]
  const out: MenuOption[] = []
  for (const group of TABLE_GROUPS) {
    const list = styles.filter((t) => t.group === group)
    if (!list.length) continue
    out.push({ value: '', label: W.tableStyles[group], heading: true })
    for (const t of list) out.push({ value: t.id, label: t.name, hint: t.name, preview: <img className="office-word-tablestyle" src={t.image} alt="" /> })
  }
  return out
}
const TABLE_STYLES = menu('wTableStyles', W.tableStyles.menu, 'tableStyle', <Table2 size={ICON} />, tableStyleOptions, {
  caption: true,
  tiles: 6,
  current: (s) => extraOf(s).tableStyle ?? ''
})
const SHADING: Tool = {
  type: 'color',
  key: 'wCellShade',
  label: W.tableStyles.shading,
  icon: <PaintBucket size={ICON} />,
  swatch: (s) => extraOf(s).cellShade ?? null,
  command: 'cellShade',
  none: true,
  defaultColor: '#dbe5f1'
}

/** Revisar: el idioma del texto (lo seleccionado) y el del documento. */
const LANG_MENU = menu(
  'wLanguage',
  W.lang.menu,
  'textLang',
  <Languages size={ICON} />,
  [
    { value: '', label: W.lang.selection, heading: true },
    ...LANGS.map((l) => ({ value: String(l.lcid), label: W.lang.names[l.code] })),
    { value: '', label: W.lang.documentAsk, command: 'docLangAsk', action: true, icon: <Languages size={15} /> }
  ],
  { caption: true, current: (s) => String(extraOf(s).textLang ?? '') }
)
const COMPARE_MENU = menu(
  'wCompare',
  W.compare.menu,
  'dialog',
  <GitCompareArrows size={ICON} />,
  [
    { value: 'compare:compare', label: W.compare.compare, icon: <GitCompareArrows size={15} /> },
    { value: 'compare:combine', label: W.compare.combine, icon: <GitMerge size={15} /> }
  ],
  { caption: true }
)

/**
 * Pestañas de contexto: el encabezado o pie que se está editando (como
 * «Encabezado y pie de página» de Word) y el gráfico seleccionado.
 */
const HF_MODE: Mode = {
  id: 'wHeaderFooter',
  label: W.hf.tab,
  icon: <PanelTop size={19} />,
  // No es un objeto seleccionado como los demás: lo añade listen() a state.objects mientras se edita.
  context: HEADER,
  names: [W.groups.hfOptions, W.groups.hfGo, W.groups.hfInsert, W.groups.hfClose],
  groups: [
    [
      button('wHfFirst', W.hf.first, 'hfToggle', <FileStack size={ICON} />, { value: 'first', caption: true, active: (s) => Boolean(extraOf(s).hf?.first) }),
      button('wHfOddEven', W.hf.oddEven, 'hfToggle', <Columns2 size={ICON} />, { value: 'oddEven', caption: true, active: (s) => Boolean(extraOf(s).hf?.oddEven) }),
      button('wHfLink', W.hf.link, 'hfToggle', <Link size={ICON} />, {
        value: 'link',
        caption: true,
        active: (s) => Boolean(extraOf(s).hf?.link),
        disabled: (s) => (extraOf(s).hf?.link ?? null) === null
      })
    ],
    [button('wHfGoHeader', W.hf.goHeader, 'header', <PanelTop size={ICON} />), button('wHfGoFooter', W.hf.goFooter, 'footer', <PanelBottom size={ICON} />)],
    [FIELDS_MENU, button('wHfRemoveHeader', W.hf.removeHeader, 'hfRemove', <Eraser size={ICON} />, { value: 'header' }), button('wHfRemoveFooter', W.hf.removeFooter, 'hfRemove', <Trash2 size={ICON} />, { value: 'footer' })],
    [button('wHfClose', W.hf.close, 'hfClose', <X size={ICON} />, { caption: true })]
  ]
}
const CHART_MODE: Mode = {
  id: 'wChart',
  label: W.chart.tab,
  icon: <ChartColumn size={19} />,
  context: 'chart',
  names: [W.groups.chartType, W.groups.chartTitle],
  groups: [
    [menu('wChartType', W.chart.type, 'chartType', <ChartColumn size={ICON} />, chartOptions(), { caption: true, tiles: 3, current: (s) => extraOf(s).chartKind ?? '' })],
    [
      button('wChartTitle', W.chart.title, 'chartTitleAsk', <Heading size={ICON} />, { caption: true }),
      menu(
        'wChartLegend',
        W.chart.legend,
        'chartLegend',
        <ListTree size={ICON} />,
        (Object.keys(W.chart.legends) as (keyof typeof W.chart.legends)[]).map((v) => ({ value: v, label: W.chart.legends[v] })),
        { caption: true }
      )
    ]
  ]
}
// ------------------------------------------------------------------ órdenes

/** El encabezado o pie donde está el cursor (null: el cursor está en el cuerpo). */
function readHf(ctx: FeatureContext): NonNullable<ReturnType<typeof extraOf>['hf']> | null {
  const H = ctx.ew.Asc.c_oAscTypeSelectElement.Header
  for (const el of selectedElements(ctx.api)) {
    if (el.get_ObjectType() !== H) continue
    const v = el.get_ObjectValue()
    const link = v.get_LinkToPrevious()
    return { first: Boolean(v.get_DifferentFirst()), oddEven: Boolean(v.get_DifferentEvenOdd()), link: link === null || link === undefined ? null : Boolean(link) }
  }
  return null
}

/** Las propiedades del gráfico seleccionado (las del editor), o null. */
function selectedChart(ctx: FeatureContext): Api | null {
  for (const el of selectedElements(ctx.api)) {
    const v = el.get_ObjectValue?.()
    const chart = v && typeof v.get_ChartProperties === 'function' ? v.get_ChartProperties() : null
    if (chart) return chart
  }
  return null
}

/** Las miniaturas de los estilos de tabla del editor (con el tema del documento). */
function readTableStyles(ctx: FeatureContext): TableStyleInfo[] {
  try {
    const list: Api[] = ctx.api.asc_getTableStylesPreviews(false) || []
    return list.slice(0, 300).flatMap((t) => {
      const image = String(t.asc_getImage?.() ?? '')
      if (!/^data:image\/(png|jpeg);base64,/.test(image)) return []
      const { name, group } = describeTableStyle(String(t.asc_getDisplayName?.() ?? ''), Number(t.asc_getType?.() ?? 0))
      return [{ id: String(t.asc_getId()), name, image, group }]
    })
  } catch {
    return []
  }
}

/** Lo que mide de ancho el texto de la página (en EMU), para que un gráfico nuevo quepa. */
function textWidthEmu(ctx: FeatureContext): number {
  try {
    const s = ctx.api.asc_GetSectionProps()
    const mm = Number(s.get_W()) - Number(s.get_LeftMargin()) - Number(s.get_RightMargin())
    if (Number.isFinite(mm) && mm > 20) return Math.round(Math.min(160, mm) * 36000)
  } catch {
    /* sin propiedades de la sección */
  }
  return 150 * 36000
}

function wordCommands(ctx: FeatureContext): Record<string, (value?: string) => void> {
  const { api, ew } = ctx
  const extra = (): ReturnType<typeof extraOf> => extraOf(ctx.state)
  const outline = (): void => {
    try {
      const m = api.asc_GetDocumentOutlineManager()
      const count = Math.min(Number(m.get_ElementsCount()) || 0, 3000)
      const startNotHeader = Boolean(m.isFirstItemNotHeader?.())
      const items = []
      for (let i = 0; i < count; i++) {
        items.push({ level: Math.max(0, Number(m.get_Level(i)) || 0), text: String(m.get_Text(i) ?? '').replace(/[\r\n]+/g, ' ').trim(), start: i === 0 && startNotHeader })
      }
      extra().outline = items
      extra().outlinePos = Number(m.get_CurrentPosition?.() ?? -1)
    } catch {
      extra().outline = []
    }
    ctx.changed()
  }
  const dateTime = (kind: 'date' | 'dateLong' | 'time'): void => {
    const props = new ew.Asc.CAscDateTime()
    const lang = Number(api.asc_getDefaultLanguage?.()) || 3082
    props.put_Lang(lang)
    const formats: string[] = (props.get_FormatsExamples?.() || []).map(String)
    const format =
      kind === 'date'
        ? formats[0]
        : kind === 'dateLong'
          ? (formats.find((f) => /MMMM/.test(f) && /yyyy/.test(f) && !/dddd/.test(f)) ?? formats[0])
          : (formats.find((f) => /^H{1,2}:mm$/.test(f)) ?? formats.find((f) => !/[yMd]/.test(f)) ?? 'H:mm')
    props.put_Format(format ?? 'dd/MM/yyyy')
    props.put_Update(true)
    api.asc_addDateTime(props)
  }
  return {
    // Índice
    tocUpdate: (which) => {
      if (api.asc_GetTableOfContentsPr()) api.asc_UpdateTableOfContents(which === 'pages')
    },
    tocRemove: () => api.asc_RemoveTableOfContents(),
    navRead: () => outline(),
    navGo: (index) => {
      const i = intIn(index, 0, 100_000)
      if (i === null) return
      api.asc_GetDocumentOutlineManager().goto(i)
    },
    caption: (json) => {
      let spec: { label?: string; text?: string; below?: boolean }
      try {
        spec = JSON.parse(json ?? '')
      } catch {
        return
      }
      const labels = Object.values(W.caption.labels) as string[]
      const props = new ew.Asc.CAscCaptionProperties()
      props.put_Before(!spec.below)
      props.put_Label(labels.includes(String(spec.label)) ? String(spec.label) : labels[0])
      props.put_ExcludeLabel(false)
      props.put_Format(ew.Asc.c_oAscNumberingFormat.Decimal)
      props.put_IncludeChapterNumber(false)
      props.put_Separator('-')
      props.updateName()
      const text = String(spec.text ?? '').trim().slice(0, 255)
      props.put_Additional(text ? `: ${text}` : '')
      api.asc_AddObjectCaption(props)
    },

    // Encabezado y pie
    hfToggle: (which) => {
      let now = readHf(ctx)
      if (!now) {
        api.GoToHeader(api.getCurrentPage())
        now = readHf(ctx)
      }
      if (!now) return
      if (which === 'first') api.HeadersAndFooters_DifferentFirstPage(!now.first)
      else if (which === 'oddEven') api.HeadersAndFooters_DifferentOddandEvenPage(!now.oddEven)
      else if (which === 'link' && now.link !== null) api.HeadersAndFooters_LinkToPrevious(!now.link)
      extra().hf = readHf(ctx)
      ctx.changed()
    },
    hfRemove: (which) => {
      if (which === 'header') api.asc_RemoveHeader(api.getCurrentPage())
      else if (which === 'footer') api.asc_RemoveFooter(api.getCurrentPage())
    },
    hfClose: () => api.asc_CancelHdrFtrEditing(),

    // Campos
    field: (kind) => {
      if (kind === 'page') api.put_PageNum(-1)
      else if (kind === 'pages') api.asc_AddPageCount()
      else if (kind === 'date' || kind === 'dateLong' || kind === 'time') dateTime(kind)
      else if (kind === 'pageOfPages') {
        // En el pie de cada sección, en el centro: «Página 3 de 10» (lo que hubiera en el pie se sustituye).
        ctx.builder(
          function (scope) {
            const words = scope.molino
            const doc = Api.GetDocument()
            const sections = doc.GetSections()
            for (let i = 0; i < sections.length; i++) {
              // El de siempre y, si lo hay, el de las páginas pares (la primera página diferente se queda como está).
              const footers = [sections[i].GetFooter('default', true), sections[i].GetFooter('even', false)]
              for (let k = 0; k < footers.length; k++) {
                const footer = footers[k]
                if (!footer) continue
                footer.RemoveAllElements()
                const paragraph = Api.CreateParagraph()
                paragraph.SetJc('center')
                paragraph.AddText(words.page)
                paragraph.AddPageNumber()
                paragraph.AddText(words.of)
                paragraph.AddPagesCount()
                footer.Push(paragraph)
              }
            }
          },
          ctx.local({ page: W.fields.pageWord, of: W.fields.ofWord })
        )
      }
    },
    updateFields: () => api.asc_UpdateFields(false),

    // Tabla
    tableStyle: (id) => {
      if (!id || !/^[\w-]{1,40}$/.test(id)) return
      const props = new ew.Asc.CTableProp()
      props.put_TableStyle(id)
      api.tblApply(props)
    },
    cellShade: (hex) => {
      const props = new ew.Asc.CTableProp()
      const background = new ew.Asc.CBackground()
      if (hex && /^#[0-9a-f]{6}$/i.test(hex)) {
        background.put_Value(0)
        background.put_Color(ctx.color(hex))
      } else background.put_Value(1)
      props.put_CellsBackground(background)
      props.put_CellSelect(true)
      api.tblApply(props)
    },

    // Idioma
    textLang: (value) => {
      const lang = langByLcid(Number(value))
      if (lang) api.put_TextPrLang(lang.lcid)
    },
    docLang: (value) => {
      const lang = langByLcid(Number(value))
      if (!lang) return
      // Todo el texto (lo ya escrito lleva su idioma) y el de lo que se escriba después.
      ctx.builder(
        function (scope) {
          const props = Api.CreateTextPr()
          props.SetLanguage(scope.molino.code)
          Api.GetDocument().GetRange().SetTextPr(props)
        },
        ctx.local({ code: lang.code })
      )
      api.asc_setDefaultLanguage(lang.lcid)
      extra().textLang = lang.lcid
      ctx.changed()
    },

    // Gráficos
    chartInsert: (kind) => {
      const spec = CHARTS[kind as ChartKind]
      if (!spec) return
      const S = W.chart.sample
      const round = kind === 'pie' || kind === 'doughnut'
      const width = textWidthEmu(ctx)
      ctx.builder(
        function (scope) {
          const m = scope.molino
          const chart = Api.CreateChart(m.type, m.values, m.series, m.categories, m.width, m.height, 24)
          chart.SetTitle(m.title, 28, false)
          chart.SetLegendPos(m.legend)
          const paragraph = Api.CreateParagraph()
          paragraph.AddDrawing(chart)
          Api.GetDocument().InsertContent([paragraph])
        },
        ctx.local({
          type: spec.builder,
          values: round ? [[4, 5, 3, 6]] : [[4, 5, 3, 6], [3, 4, 5, 4], [2, 3, 4, 5]],
          series: round ? S.series.slice(0, 1) : S.series,
          categories: S.categories,
          title: S.title,
          legend: round ? 'right' : 'bottom',
          width,
          height: Math.round(width * 0.58)
        })
      )
    },
    chartType: (kind) => {
      const spec = CHARTS[kind as ChartKind]
      const chart = selectedChart(ctx)
      if (!spec || !chart) return
      chart.changeType(ew.Asc.c_oAscChartTypeSettings[spec.editor])
    },
    chartTitle: (text) => {
      // El tamaño va en medios puntos (28: 14 pt, como el título de un gráfico de Word).
      if (!text?.trim()) return
      ctx.builder(
        function (scope) {
          const drawings = Api.GetDocument().GetSelectedDrawings()
          for (let i = 0; i < drawings.length; i++) if (drawings[i].GetClassType() === 'chart') drawings[i].SetTitle(scope.molino.text, 28, false)
        },
        ctx.local({ text: String(text ?? '').slice(0, 255) })
      )
    },
    chartLegend: (where) => {
      if (!where || !(where in W.chart.legends)) return
      ctx.builder(
        function (scope) {
          const drawings = Api.GetDocument().GetSelectedDrawings()
          for (let i = 0; i < drawings.length; i++) if (drawings[i].GetClassType() === 'chart') drawings[i].SetLegendPos(scope.molino.where)
        },
        ctx.local({ where })
      )
    },

    // Combinar correspondencia
    mailMergeList: (json) => {
      let rows: unknown
      try {
        rows = JSON.parse(json ?? '')
      } catch {
        return
      }
      if (!Array.isArray(rows) || rows.length < 2 || rows.length > MAIL_MERGE_MAX_ROWS + 1) return
      const clean = rows.map((r) => (Array.isArray(r) ? r.map((v) => String(v ?? '').slice(0, 1000)) : []))
      api.asc_StartMailMergeByList(ctx.local(clean))
      const fields: string[] = (api.asc_GetMailMergeFieldsNameList?.() || []).map(String)
      extra().mailMerge = { fields, rows: Number(api.asc_GetReceptionsCount?.() ?? clean.length - 1) || clean.length - 1, preview: null }
      ctx.changed()
    },
    mailMergeField: (name) => {
      const merge = extra().mailMerge
      if (name && merge?.fields.includes(name)) api.asc_AddMailMergeField(name)
    },
    mailMergePreview: (index) => {
      const merge = extra().mailMerge
      if (!merge) return
      const i = intIn(index, 0, merge.rows - 1)
      if (i === null) api.asc_EndPreviewMailMergeResult()
      else api.asc_PreviewMailMergeResult(i)
      merge.preview = i
      ctx.changed()
    },
    mailMergeHighlight: (on) => api.asc_SetHighlightMailMergeFields?.(on === '1')
  }
}

// ------------------------------------------------------------------ avisos

function listen(ctx: FeatureContext, on: (name: string, fn: (...args: Api[]) => void) => void): void {
  const { ew } = ctx
  const extra = (): ReturnType<typeof extraOf> => extraOf(ctx.state)
  const commands = wordCommands(ctx)
  // Lo que hay donde está el cursor: encabezado, tabla, gráfico. Se escucha
  // después que engine.ts (que vuelve a poner state.objects con cada aviso), para
  // añadir el encabezado a lo seleccionado: así sale su pestaña de contexto.
  setTimeout(() => {
    on('asc_onFocusObject', (list: Api[]) => {
      const T = ew.Asc.c_oAscTypeSelectElement
      const e = extra()
      e.hf = null
      e.chartKind = null
      for (const el of list || []) {
        const type = el.get_ObjectType()
        const value = el.get_ObjectValue()
        if (type === T.Header && value) {
          const link = value.get_LinkToPrevious()
          e.hf = { first: Boolean(value.get_DifferentFirst()), oddEven: Boolean(value.get_DifferentEvenOdd()), link: link === null || link === undefined ? null : Boolean(link) }
        } else if (type === T.Table && value) {
          e.tableStyle = String(value.get_TableStyle?.() ?? '')
          const background = value.get_CellsBackground?.()
          const color = background && background.get_Value() === 0 ? background.get_Color() : null
          e.cellShade = color ? `#${[color.get_r(), color.get_g(), color.get_b()].map((x: number) => x.toString(16).padStart(2, '0')).join('')}` : null
          // Las miniaturas, la primera vez que hay una tabla (salen con el tema del documento).
          if (!e.tableStyles?.length) e.tableStyles = readTableStyles(ctx)
        } else if (type === T.Image && value) {
          const chart = typeof value.get_ChartProperties === 'function' ? value.get_ChartProperties() : null
          if (chart) e.chartKind = chartKindOf(Number(chart.getType?.()), ew.Asc.c_oAscChartTypeSettings)
        }
      }
      if (e.hf && !ctx.state.objects.includes(HEADER)) ctx.state.objects = [...ctx.state.objects, HEADER]
    })
  }, 0)
  // El tema o los estilos del documento cambian: las miniaturas se vuelven a hacer.
  on('asc_onInitTableTemplates', () => {
    extra().tableStyles = undefined
  })
  // El idioma del texto donde está el cursor.
  on('asc_onTextLanguage', (lcid: number) => {
    extra().textLang = Number(lcid)
  })
  on('asc_onBookmarksUpdate', () => {
    extra().bookmarks = (extra().bookmarks ?? 0) + 1
  })
  // El esquema del documento (llega con el panel de navegación abierto).
  for (const name of ['asc_onDocumentOutlineUpdate', 'asc_onDocumentOutlineUpdateAdd', 'asc_onDocumentOutlineUpdateRemove', 'asc_onDocumentOutlineUpdateChange']) {
    on(name, () => commands.navRead())
  }
  on('asc_onDocumentOutlineCurrentPosition', (index: number) => {
    extra().outlinePos = Number(index)
  })
  on('asc_onEndPreviewMailMergeResult', () => {
    const merge = extra().mailMerge
    if (merge) merge.preview = null
  })
}

// -------------------------------------------------------------- preguntas

function ask(command: string, _value: string | undefined, session: EditorSession, run: (command: string, value?: string) => unknown): PromptSpec | null {
  const ctx = session.featureContext()
  if (command === 'tocUpdate' && !ctx.api.asc_GetTableOfContentsPr()) {
    return { title: W.toc.update, intro: W.toc.missing, fields: [], onOk: () => undefined }
  }
  if (command === 'captionAsk') {
    const objects = session.state.objects
    const C = W.caption
    const label = objects.includes('image') || objects.includes('chart') || objects.includes('shape') ? C.labels.figure : C.labels.table
    return {
      title: C.title,
      intro: C.intro,
      fields: [
        { key: 'label', label: C.label, value: label, options: Object.values(C.labels).map((l) => ({ value: l, label: l })) },
        { key: 'text', label: C.text, value: '', maxLength: 255 },
        { key: 'position', label: C.position, value: label === C.labels.table ? 'above' : 'below', options: [{ value: 'above', label: C.above }, { value: 'below', label: C.below }] }
      ],
      onOk: (v) => run('caption', JSON.stringify({ label: v.label, text: v.text, below: v.position === 'below' }))
    }
  }
  if (command === 'docLangAsk') {
    const now = Number(ctx.api.asc_getDefaultLanguage?.())
    return {
      title: W.lang.documentTitle,
      intro: W.lang.documentIntro,
      fields: [{ key: 'lang', label: W.lang.language, value: String(langByLcid(now)?.lcid ?? 3082), options: LANGS.map((l) => ({ value: String(l.lcid), label: W.lang.names[l.code] })) }],
      onOk: (v) => run('docLang', v.lang)
    }
  }
  if (command === 'chartTitleAsk') {
    let current = ''
    try {
      const chart = ctx.api.getJsApi().GetDocument().GetSelectedDrawings().find((d: Api) => d.GetClassType() === 'chart')
      current = String(chart?.GetTitle?.() ?? '')
    } catch {
      current = ''
    }
    return {
      title: W.chart.titleAsk,
      fields: [{ key: 'title', label: W.chart.titleLabel, value: current, maxLength: 255 }],
      onOk: (v) => v.title.trim() && run('chartTitle', v.title.trim())
    }
  }
  return null
}

export const wordFeature: Feature = {
  commands: (ctx) => (ctx.kind === 'word' ? wordCommands(ctx) : {}),
  listen: (ctx, on) => {
    if (ctx.kind === 'word') listen(ctx, on)
  },
  tools: {
    references: { at: 1, groups: [[TOC_MENU, NAV], [CAPTION, CROSS_REF, BOOKMARK]], names: [W.groups.toc, W.groups.references] },
    insert: { at: 4, groups: [[HF_MENU, FIELDS_MENU], [CHART_MENU], [MAIL_MERGE]], names: [W.groups.headerFooter, W.groups.chart, W.groups.mailMerge] },
    table: { groups: [[TABLE_STYLES, SHADING]], names: [W.groups.tableStyle] },
    review: { groups: [[LANG_MENU], [COMPARE_MENU]], names: [W.groups.language, W.groups.compare] }
  },
  modes: [HF_MODE, CHART_MODE],
  ask,
  panels: {
    navigation: { title: W.nav.title, render: (props) => <NavigationPanel {...props} /> },
    mailMerge: { title: W.mailMerge.title, render: (props) => <MailMergePanel {...props} /> }
  },
  dialogs: {
    bookmarks: (props) => <BookmarksDialog {...props} />,
    crossRef: (props) => <CrossRefDialog {...props} />,
    compare: (props) => <CompareDialog {...props} />
  },
  palette: [
    { label: W.fields.update, group: L.office.modes.insert, keywords: W.keywords.updateFields, command: 'updateFields' },
    { label: W.lang.documentTitle, group: L.office.modes.review, keywords: W.keywords.docLang, command: 'docLangAsk' },
    { label: W.bookmarks.title, group: L.office.modes.references, keywords: W.keywords.bookmarks, command: 'dialog', value: 'bookmarks' },
    { label: W.nav.title, group: L.office.modes.references, keywords: W.keywords.navigation, command: 'panel', value: 'navigation' }
  ]
}
