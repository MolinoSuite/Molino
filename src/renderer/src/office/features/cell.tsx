import {
  ArrowRightLeft,
  ChartArea,
  ChartBar,
  ChartBarStacked,
  ChartColumn,
  ChartColumnStacked,
  ChartLine,
  ChartPie,
  ChartScatter,
  ChartSpline,
  ClipboardPaste,
  Donut,
  Eraser,
  Eye,
  EyeOff,
  Frame,
  Grid2x2,
  Group,
  Hash,
  Heading,
  Layers,
  ListOrdered,
  Paintbrush,
  PanelBottom,
  PanelLeft,
  PanelRight,
  PanelTop,
  RefreshCcw,
  RefreshCw,
  Repeat,
  Shapes,
  SlidersHorizontal,
  SquareFunction,
  Split,
  Table2,
  Tag,
  TextCursorInput,
  TrendingUp,
  Ungroup,
  Waypoints,
  X
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { MenuEntry } from '@/components/ui'
import type { MenuOption, Tool } from '../apps'
import { L } from '../i18n'
import { PageGlyph, ShapeGlyph } from '../ui/glyphs'
import { CELL_MARGINS, CELL_SHAPES, cellCommands, type ChartKind, CHART_TYPES, DELIMITERS, pasteArrived, readChart, readPrint } from './cell/commands'
import { PasteSpecialDialog, PivotDialog, SortDialog } from './cell/dialogs'
import { NamesPanel } from './cell/names'
import type { Feature } from './types'
import './cell/cell.css'

/**
 * Funciones de Hojas (además de las de siempre): pegado especial, ordenar por
 * varias columnas, la pestaña «Gráfico» para cambiar uno ya hecho, esquema
 * (agrupar filas o columnas), auditoría de fórmulas, márgenes y títulos de
 * impresión, formas, administrador de nombres, tablas dinámicas, texto en
 * columnas, volver a aplicar el filtro y minigráficos. Ver types.ts.
 */

const C = L.officeCell
const N = L.office.groupNames
const ICON = 16
const ART = 20

const B = (key: string, label: string, command: string, extra: Partial<Extract<Tool, { type: 'button' }>> = {}): Tool => ({ type: 'button', key, label, command, ...extra })
const MENU = (key: string, label: string, command: string, options: MenuOption[], icon: ReactNode, extra: Partial<Extract<Tool, { type: 'menu' }>> = {}): Tool => ({
  type: 'menu',
  key,
  label,
  command,
  options,
  icon,
  ...extra
})

// --------------------------------------------------------------- Inicio

const P = C.paste
const PASTE_ICONS: Record<string, ReactNode> = {
  all: <ClipboardPaste size={15} />,
  values: <span className="glyph-text">123</span>,
  formulas: <SquareFunction size={15} />,
  formats: <Paintbrush size={15} />,
  valuesFormats: <span className="glyph-text">1,2</span>,
  noBorders: <Grid2x2 size={15} />,
  transpose: <ArrowRightLeft size={15} />
}
/** Pegar: lo de siempre y, debajo, el pegado especial más usado (como el botón de Excel). */
const PASTE_MENU = MENU(
  'pasteMenu',
  P.menu,
  'pasteSpecial',
  [
    { value: 'all', label: P.all, icon: PASTE_ICONS.all },
    { value: '', label: P.heading, heading: true },
    ...(['values', 'formulas', 'formats', 'valuesFormats', 'noBorders', 'transpose'] as const).map((v) => ({ value: v, label: P[v], icon: PASTE_ICONS[v] })),
    { value: 'pasteSpecial', label: P.special, command: 'dialog', action: true, icon: <SlidersHorizontal size={15} /> }
  ],
  <ClipboardPaste size={ICON} />,
  { caption: true }
)

// ---------------------------------------------------------------- Datos

const OUT = C.outline
const OUTLINE: Tool[] = [
  MENU('groupMenu', OUT.group, 'group', [
    { value: 'rows', label: OUT.rows, icon: <Group size={15} /> },
    { value: 'columns', label: OUT.columns, icon: <Group size={15} style={{ transform: 'rotate(90deg)' }} /> }
  ], <Group size={ICON} />, { caption: true }),
  MENU('ungroupMenu', OUT.ungroup, 'ungroup', [
    { value: 'rows', label: OUT.rows, icon: <Ungroup size={15} /> },
    { value: 'columns', label: OUT.columns, icon: <Ungroup size={15} style={{ transform: 'rotate(90deg)' }} /> },
    { value: '', label: OUT.clear, command: 'clearOutline', action: true, icon: <Eraser size={15} /> }
  ], <Ungroup size={ICON} />, { caption: true }),
  B('groupShow', OUT.show, 'groupDetail', { value: 'show', icon: <Eye size={ICON} /> }),
  B('groupHide', OUT.hide, 'groupDetail', { value: 'hide', icon: <EyeOff size={ICON} /> })
]

// ------------------------------------------------------------- Fórmulas

const AU = C.audit
const AUDITING: Tool[] = [
  B('tracePrecedents', AU.precedents, 'tracePrecedents', { icon: <Waypoints size={ICON} />, caption: true }),
  B('traceDependents', AU.dependents, 'traceDependents', { icon: <Waypoints size={ICON} style={{ transform: 'scaleX(-1)' }} />, caption: true }),
  MENU('removeArrows', AU.remove, 'removeArrows', [
    { value: 'all', label: AU.removeAll, icon: <X size={15} /> },
    { value: 'precedent', label: AU.removePrecedents, icon: <Waypoints size={15} /> },
    { value: 'dependent', label: AU.removeDependents, icon: <Waypoints size={15} style={{ transform: 'scaleX(-1)' }} /> }
  ], <X size={ICON} />),
  B('showFormulas', AU.showFormulas, 'showFormulas', { icon: <SquareFunction size={ICON} />, caption: true, active: (s) => Boolean(s.extra.showFormulas) })
]

// --------------------------------------------------------------- Página

const PR = C.print
const MARGIN_ART: Record<string, number> = { normal: 0.12, narrow: 0.05, wide: 0.17 }
const MARGINS = MENU(
  'cellMargins',
  PR.margins,
  'cellMargins',
  [
    ...Object.keys(CELL_MARGINS).map((v) => ({ value: v, label: PR.marginOptions[v as 'normal'], preview: <PageGlyph margin={MARGIN_ART[v] ?? 0.12} /> })),
    { value: '', label: PR.marginOptions.custom, command: 'cellMarginsAsk', action: true, icon: <SlidersHorizontal size={15} /> }
  ],
  <Frame size={ICON} />,
  { caption: true, tiles: 3, current: (s) => String(s.extra.margins ?? '') }
)
const PRINT_TITLES = MENU(
  'printTitles',
  PR.titles,
  'printTitles',
  [
    { value: 'row', label: PR.titleOptions.row, icon: <PanelTop size={15} /> },
    { value: 'col', label: PR.titleOptions.col, icon: <PanelLeft size={15} /> },
    { value: '', label: PR.titleOptions.custom, command: 'printTitlesAsk', icon: <SlidersHorizontal size={15} /> },
    { value: 'none', label: PR.titleOptions.none, action: true, icon: <X size={15} /> }
  ],
  <Repeat size={ICON} />,
  { caption: true }
)

// ------------------------------------------------------------- Insertar

const SHAPES = MENU(
  'cellShapes',
  C.shapes,
  'shape',
  CELL_SHAPES.map((v) => ({ value: v, label: (L.office.options.shapes as Record<string, string>)[v] ?? v, preview: <ShapeGlyph shape={v} /> })),
  <Shapes size={ICON} />,
  { caption: true, tiles: 6 }
)
const SPARK_ICONS: Record<string, ReactNode> = { line: <TrendingUp size={15} />, column: <ChartColumn size={15} />, stacked: <ChartBarStacked size={15} style={{ transform: 'rotate(90deg)' }} /> }
const SPARKLINES = MENU(
  'sparklines',
  C.spark.menu,
  'sparklineAsk',
  (['line', 'column', 'stacked'] as const).map((v) => ({ value: v, label: C.spark.types[v], icon: SPARK_ICONS[v] })),
  <TrendingUp size={ICON} />,
  { caption: true }
)

// -------------------------------------------------------------- Gráfico

const CH = C.chart
const CHART_ART: Record<ChartKind, ReactNode> = {
  columns: <ChartColumn size={ART} />,
  stackedColumns: <ChartColumnStacked size={ART} />,
  bars: <ChartBar size={ART} />,
  stackedBars: <ChartBarStacked size={ART} />,
  lines: <ChartLine size={ART} />,
  linesMarkers: <ChartSpline size={ART} />,
  pie: <ChartPie size={ART} />,
  doughnut: <Donut size={ART} />,
  area: <ChartArea size={ART} />,
  scatter: <ChartScatter size={ART} />
}
const CHART_MODE = {
  id: 'chart',
  label: CH.mode,
  icon: <ChartColumn size={19} />,
  context: 'chart' as const,
  names: [C.groups.chartType, C.groups.chartLayout, C.groups.chartData],
  groups: [
    [
      MENU(
        'chartType',
        CH.type,
        'chartType',
        (Object.keys(CHART_TYPES) as ChartKind[]).map((v) => ({ value: v, label: CH.types[v], preview: CHART_ART[v] })),
        <ChartColumn size={ICON} />,
        { caption: true, tiles: 5, current: (s) => String(s.extra.chartType ?? '') }
      )
    ],
    [
      MENU(
        'chartTitle',
        CH.title,
        'chartTitle',
        [
          { value: 'none', label: CH.titles.none, icon: <X size={15} /> },
          { value: 'above', label: CH.titles.above, icon: <Heading size={15} /> },
          { value: 'overlay', label: CH.titles.overlay, icon: <Layers size={15} /> },
          { value: '', label: CH.titles.text, command: 'chartTitleAsk', action: true, icon: <TextCursorInput size={15} /> }
        ],
        <Heading size={ICON} />,
        { caption: true, current: (s) => String(s.extra.chartTitle ?? '') }
      ),
      MENU(
        'chartLegend',
        CH.legend,
        'chartLegend',
        [
          { value: 'none', label: CH.legends.none, icon: <X size={15} /> },
          { value: 'bottom', label: CH.legends.bottom, icon: <PanelBottom size={15} /> },
          { value: 'top', label: CH.legends.top, icon: <PanelTop size={15} /> },
          { value: 'right', label: CH.legends.right, icon: <PanelRight size={15} /> },
          { value: 'left', label: CH.legends.left, icon: <PanelLeft size={15} /> }
        ],
        <ListOrdered size={ICON} />,
        { caption: true, current: (s) => String(s.extra.chartLegend ?? '') }
      )
    ],
    [B('chartData', CH.data, 'chartDataAsk', { icon: <Table2 size={ICON} />, caption: true }), B('chartSwitch', CH.switch, 'chartSwitch', { icon: <ArrowRightLeft size={ICON} /> })]
  ]
}

// ---------------------------------------------------------------- todo

export const cellFeature: Feature = {
  commands: (ctx) => cellCommands(ctx),

  listen: (ctx, on) => {
    // Pegado especial: el editor ha pegado lo que había en el portapapeles.
    on('asc_onShowSpecialPasteOptions', () => setTimeout(() => pasteArrived(ctx), 0))
    const readView = (): void => {
      try {
        ctx.state.extra.showFormulas = Boolean(ctx.api.asc_getShowFormulas())
      } catch {
        /* sin vista de fórmulas */
      }
      readPrint(ctx)
    }
    on('asc_onSelectionChanged', (info) => {
      const R = ctx.ew.Asc.c_oAscSelectionType
      const type = info?.asc_getSelectionType?.()
      if (type === R.RangeChart || type === R.RangeChartText) readChart(ctx)
      readView()
    })
    on('asc_onActiveSheetChanged', readView)
    on('asc_onUpdateFormulasViewSettings', readView)
    on('asc_onRefreshDefNameList', () => {
      ctx.state.extra.names = Number(ctx.state.extra.names ?? 0) + 1
    })
    on('asc_onDocumentContentReady', readView)
  },

  tools: {
    home: { at: 0, groups: [[PASTE_MENU]], names: [C.groups.clipboard] },
    insert: {
      groups: [[SHAPES], [B('pivotTable', C.pivot.insert, 'dialog', { value: 'pivot', icon: <Table2 size={ICON} />, caption: true }), SPARKLINES]],
      names: [C.groups.shapes, C.groups.pivot]
    },
    formulas: {
      groups: [AUDITING, [B('nameManager', C.names.manage, 'panel', { value: 'names', icon: <Tag size={ICON} />, caption: true })]],
      names: [C.groups.auditing, C.groups.names]
    },
    data: {
      at: 1,
      groups: [
        [B('sortCustom', C.sort.custom, 'dialog', { value: 'sort', icon: <ListOrdered size={ICON} />, caption: true }), B('reapplyFilter', C.filter.reapply, 'reapplyFilter', { icon: <RefreshCcw size={ICON} /> })],
        OUTLINE,
        [B('textToColumns', C.text.toColumns, 'textToColumnsAsk', { icon: <Split size={ICON} />, caption: true }), B('refreshPivots', C.pivot.refresh, 'refreshPivots', { icon: <RefreshCw size={ICON} />, caption: true })]
      ],
      names: [N.sort, C.groups.outline, N.tools]
    },
    pageLayout: {
      groups: [
        [MARGINS],
        [
          PRINT_TITLES,
          B('printGridlines', PR.gridlines, 'printGridlines', { icon: <Grid2x2 size={ICON} />, active: (s) => Boolean(s.extra.printGrid) }),
          B('printHeadings', PR.headings, 'printHeadings', { icon: <Hash size={ICON} />, active: (s) => Boolean(s.extra.printHeadings) })
        ]
      ],
      names: [C.groups.margins, C.groups.printOptions]
    }
  },

  modes: [CHART_MODE],

  ask: (command, value, session, run) => {
    const extra = session.state.extra
    if (command === 'chartDataAsk') {
      return {
        title: CH.dataTitle,
        fields: [{ key: 'range', label: CH.dataLabel, value: String(extra.chartRange ?? ''), maxLength: 500, hint: CH.dataHint }],
        onOk: (v) => run('chartRange', v.range)
      }
    }
    if (command === 'chartTitleAsk') {
      return {
        title: CH.titleAsk,
        fields: [{ key: 'text', label: CH.titleLabel, value: '', maxLength: 255 }],
        onOk: (v) => run('chartTitleText', v.text)
      }
    }
    if (command === 'cellMarginsAsk') {
      const now = Array.isArray(extra.marginValues) ? (extra.marginValues as number[]) : CELL_MARGINS.normal
      const field = (key: string, label: string, i: number) => ({ key, label, value: String(Math.round((now[i] ?? 0) * 10) / 10), type: 'number' as const, min: 0, max: 200 })
      return {
        title: PR.marginsTitle,
        fields: [field('top', PR.top, 0), field('bottom', PR.bottom, 2), field('left', PR.left, 1), field('right', PR.right, 3)],
        onOk: (v) => run('cellMargins', JSON.stringify(v))
      }
    }
    if (command === 'printTitlesAsk') {
      return {
        title: PR.titlesTitle,
        intro: PR.titlesIntro,
        fields: [
          { key: 'rows', label: PR.titleRows, value: String(extra.titleRows ?? '').replace(/\$/g, ''), maxLength: 20, hint: PR.titleRowsHint },
          { key: 'cols', label: PR.titleCols, value: String(extra.titleCols ?? '').replace(/\$/g, ''), maxLength: 20, hint: PR.titleColsHint }
        ],
        onOk: (v) => run('printTitles', JSON.stringify(v))
      }
    }
    if (command === 'textToColumnsAsk') {
      const T = C.text
      return {
        title: T.title,
        intro: T.intro,
        ok: T.ok,
        fields: [
          { key: 'delimiter', label: T.delimiter, value: 'comma', options: (Object.keys(DELIMITERS) as (keyof typeof DELIMITERS)[]).map((d) => ({ value: d, label: T.delimiters[d] })) },
          { key: 'other', label: T.other, value: '', maxLength: 1, hint: T.otherHint }
        ],
        onOk: (v) => run('textToColumns', JSON.stringify(v))
      }
    }
    if (command === 'sparklineAsk' && value && value in C.spark.types) {
      const S = C.spark
      let selection = ''
      try {
        const ctx = session.featureContext()
        selection = String(ctx.api.asc_getActiveRangeStr(ctx.ew.Asc.referenceType.R) ?? '')
      } catch {
        selection = ''
      }
      return {
        title: `${S.title}: ${S.types[value as keyof typeof S.types]}`,
        intro: S.intro,
        fields: [
          { key: 'source', label: S.source, value: selection, maxLength: 500, hint: S.sourceHint },
          { key: 'destination', label: S.destination, value: '', maxLength: 500, hint: S.destinationHint }
        ],
        onOk: (v) => run('sparkline', JSON.stringify({ type: value, ...v }))
      }
    }
    return null
  },

  // El menú del botón derecho: el pegado especial más usado.
  context: (state, _session, run) => {
    if (state.objects.length) return []
    const item = (label: string, command: string, value?: string): MenuEntry => ({ label, onSelect: () => void run(command, value) })
    return [
      { heading: P.heading },
      item(P.values, 'pasteSpecial', 'values'),
      item(P.formulas, 'pasteSpecial', 'formulas'),
      item(P.formats, 'pasteSpecial', 'formats'),
      item(P.transpose, 'pasteSpecial', 'transpose'),
      item(P.special, 'dialog', 'pasteSpecial')
    ]
  },

  panels: {
    names: { title: C.names.title, render: (props) => <NamesPanel {...props} /> }
  },

  dialogs: {
    pasteSpecial: (props) => <PasteSpecialDialog {...props} />,
    sort: (props) => <SortDialog {...props} />,
    pivot: (props) => <PivotDialog {...props} />
  }
}
