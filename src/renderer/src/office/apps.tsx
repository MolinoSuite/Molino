/**
 * Lo que tiene cada app: modos, herramientas de cada modo, botones de la
 * cabecera y órdenes del buscador. Solo nombres de órdenes de Molino (engine.ts
 * las traduce al editor); nada de aquí conoce ONLYOFFICE. Viene de
 * ``prototipo\ventana\interfaz\apps.js``.
 */
import {
  AlignCenter,
  AlignHorizontalJustifyCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowDownWideNarrow,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpDown,
  ArrowUpNarrowWide,
  ArrowUpToLine,
  Baseline,
  BetweenHorizontalStart,
  BetweenVerticalStart,
  Blend,
  Bold,
  BookOpenText,
  Calculator,
  CalendarDays,
  CaseSensitive,
  ChartBar,
  ChartColumn,
  ChartLine,
  ChartPie,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Clapperboard,
  Code,
  Columns3,
  Copy,
  CopyCheck,
  CopyMinus,
  Crop,
  Eraser,
  Euro,
  Eye,
  EyeOff,
  Feather,
  FileDiff,
  Filter,
  Frame,
  Grid2x2,
  Grid3x3,
  Hash,
  Heading,
  Highlighter,
  House,
  Image,
  Italic,
  Layers,
  LayoutTemplate,
  Link,
  List,
  ListChecks,
  ListCollapse,
  ListIndentDecrease,
  ListIndentIncrease,
  ListOrdered,
  ListPlus,
  ListX,
  Lock,
  LockOpen,
  Maximize,
  MessageCircleQuestion,
  MessageSquarePlus,
  Minus,
  NotebookText,
  Omega,
  Paintbrush,
  PaintBucket,
  Palette,
  PanelBottom,
  PanelRight,
  PanelTop,
  PenLine,
  Percent,
  Pilcrow,
  Play,
  Presentation,
  Printer,
  Proportions,
  Radical,
  Ratio,
  RectangleHorizontal,
  RectangleVertical,
  Redo2,
  RemoveFormatting,
  Replace,
  Rows3,
  Search,
  SeparatorHorizontal,
  Shapes,
  ShieldCheck,
  Shrink,
  Sigma,
  SlidersHorizontal,
  Snowflake,
  Sparkle,
  Sparkles,
  SquareCheck,
  SquareFunction,
  SquarePlus,
  SquareTerminal,
  Stamp,
  StickyNote,
  Strikethrough,
  Subscript,
  Superscript,
  Table,
  Table2,
  TableCellsMerge,
  TableCellsSplit,
  TableOfContents,
  Tag,
  TextCursorInput,
  Timer,
  Trash2,
  Type,
  Underline,
  Undo2,
  UnfoldVertical,
  WrapText,
  X
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { OfficeKind } from '@shared/officeui'
import { AI_TASKS, type AiTask } from './AiPanel'
import type { EditorState } from './engine'
import { L } from './i18n'

const T = L.office.tools
export type ToolKey = keyof typeof T

export type Tool =
  | {
      type: 'button'
      key: ToolKey
      command: string
      value?: string
      icon?: ReactNode
      /** Texto en el botón, además del icono (las herramientas grandes). */
      caption?: boolean
      active?: (s: EditorState) => boolean
      disabled?: (s: EditorState) => boolean
    }
  | { type: 'font' }
  | { type: 'size' }
  | { type: 'style' }
  | {
      type: 'color'
      key: 'color' | 'fill' | 'highlight' | 'shapeFill' | 'shapeLine' | 'background'
      icon: ReactNode
      swatch: (s: EditorState) => string | null
      /** La orden (si no, la de su nombre). */
      command?: string
      /** Botón «Sin color». */
      none?: boolean
      swatches?: string[]
    }
  | {
      type: 'menu'
      key: ToolKey
      command: string
      icon: ReactNode
      caption?: boolean
      options: MenuOption[]
      /** La opción que está puesta (se marca en el menú). */
      current?: (s: EditorState) => string
    }

/** Una opción de un desplegable: su valor (y su orden, si no es la del desplegable) o un título de grupo. */
export interface MenuOption {
  value: string
  label: string
  command?: string
  heading?: boolean
}

export interface Mode {
  id: string
  label: string
  icon: ReactNode
  groups: Tool[][]
  /**
   * Pestaña de contexto (como «Diseño de tabla» o «Formato de imagen» en
   * Office): solo sale con ese objeto seleccionado.
   */
  context?: SelectedObject
}

export type SelectedObject = EditorState['objects'][number]

export interface PaletteEntry {
  label: string
  group: string
  keywords: string
  command: string
  value?: string
}

export interface AppConfig {
  kind: OfficeKind
  modes: Mode[]
  /** Panel lateral: estadísticas de la selección (Hojas), temas y diseños (Presentaciones). */
  panel: boolean
  /** Pestañas de las hojas del libro, debajo del documento. */
  sheetTabs: boolean
  /** Botones de la cabecera, de izquierda a derecha (el último, el principal). */
  header: { key: 'savePdf' | 'save' | 'present'; command: string; value?: string }[]
  /** Órdenes del buscador además de las de las herramientas. */
  extra: PaletteEntry[]
}

const ICON = 16
const B = (key: ToolKey, command: string, extra: Partial<Extract<Tool, { type: 'button' }>> = {}): Tool => ({ type: 'button', key, command, ...extra })

const UNDO: Tool[] = [
  B('undo', 'undo', { icon: <Undo2 size={ICON} />, disabled: (s) => !s.canUndo }),
  B('redo', 'redo', { icon: <Redo2 size={ICON} />, disabled: (s) => !s.canRedo })
]
const LETTER: Tool[] = [{ type: 'font' }, { type: 'size' }]
const FORMAT: Tool[] = [
  B('bold', 'bold', { icon: <Bold size={ICON} />, active: (s) => s.bold }),
  B('italic', 'italic', { icon: <Italic size={ICON} />, active: (s) => s.italic }),
  B('underline', 'underline', { icon: <Underline size={ICON} />, active: (s) => s.underline }),
  B('strike', 'strike', { icon: <Strikethrough size={ICON} />, active: (s) => s.strike }),
  { type: 'color', key: 'color', icon: <Baseline size={ICON} />, swatch: (s) => s.color }
]
const ALIGN: Tool[] = [
  B('alignLeft', 'align', { value: 'left', icon: <AlignLeft size={ICON} />, active: (s) => s.align === 'left' }),
  B('alignCenter', 'align', { value: 'center', icon: <AlignCenter size={ICON} />, active: (s) => s.align === 'center' }),
  B('alignRight', 'align', { value: 'right', icon: <AlignRight size={ICON} />, active: (s) => s.align === 'right' }),
  B('justify', 'align', { value: 'justify', icon: <AlignJustify size={ICON} />, active: (s) => s.align === 'justify' })
]
const LISTS: Tool[] = [
  B('bullets', 'bullets', { icon: <List size={ICON} />, active: (s) => s.list === 'bullets' }),
  B('numbers', 'numbers', { icon: <ListOrdered size={ICON} />, active: (s) => s.list === 'numbers' })
]
/** Diseño A: la alineación y las listas, cada una en su desplegable con nombre. */
const ALIGN_MENU: Tool = {
  type: 'menu',
  key: 'alignMenu',
  command: 'align',
  icon: <AlignLeft size={ICON} />,
  caption: true,
  current: (s) => s.align,
  options: [
    { value: 'left', label: T.alignLeft },
    { value: 'center', label: T.alignCenter },
    { value: 'right', label: T.alignRight },
    { value: 'justify', label: T.justify }
  ]
}
const LIST_MENU: Tool = {
  type: 'menu',
  key: 'listMenu',
  command: 'bullets',
  icon: <List size={ICON} />,
  caption: true,
  current: (s) => s.list,
  options: [
    { value: 'bullets', label: T.bullets, command: 'bullets' },
    { value: 'numbers', label: T.numbers, command: 'numbers' }
  ]
}
/** El color del texto y el resaltado (también en la barra de lo seleccionado). */
export const TEXT_COLOR: Tool = { type: 'color', key: 'color', icon: <Baseline size={ICON} />, swatch: (s) => s.color }

/** Revisar: comentarios en las tres apps; control de cambios, en Documentos. */
const COMMENT: Tool = B('comment', 'focusComment', { icon: <MessageSquarePlus size={ICON} />, caption: true })
function reviewMode(track: boolean): Mode {
  return {
    id: 'review',
    label: L.office.modes.review,
    icon: <MessageSquarePlus size={19} />,
    groups: track
      ? [
          [COMMENT],
          [B('track', 'track', { icon: <FileDiff size={ICON} />, caption: true, active: (s) => s.track })],
          [
            B('prevChange', 'prevChange', { icon: <ChevronLeft size={ICON} /> }),
            B('nextChange', 'nextChange', { icon: <ChevronRight size={ICON} /> }),
            B('acceptChange', 'acceptChange', { icon: <Check size={ICON} />, caption: true }),
            B('rejectChange', 'rejectChange', { icon: <X size={ICON} />, caption: true })
          ],
          [B('acceptAll', 'acceptAll', { icon: <CheckCheck size={ICON} /> }), B('rejectAll', 'rejectAll', { icon: <ListX size={ICON} /> })]
        ]
      : [[COMMENT]]
  }
}

const M = L.office.modes
const G = L.office.groups
const COMMON_EXTRA: PaletteEntry[] = [
  { label: T.save, group: G.file, keywords: L.office.keywords.save, command: 'save' },
  { label: T.saveAs, group: G.file, keywords: L.office.keywords.saveAs, command: 'saveAs' },
  { label: T.print, group: G.file, keywords: L.office.keywords.print, command: 'print' },
  { label: T.savePdf, group: G.file, keywords: L.office.keywords.savePdf, command: 'savePdf' },
  { label: T.zoomIn, group: G.view, keywords: L.office.keywords.zoomIn, command: 'zoomIn' },
  { label: T.zoomOut, group: G.view, keywords: L.office.keywords.zoomOut, command: 'zoomOut' }
]

/** Un desplegable: el botón y sus opciones (cada una, una orden con su valor). */
const MENU = (key: ToolKey, command: string, options: Record<string, string>, icon: ReactNode, extra: { caption?: boolean } = {}): Tool => ({
  type: 'menu',
  key,
  command,
  icon,
  caption: extra.caption,
  options: Object.entries(options).map(([value, label]) => ({ value, label }))
})
const O = L.office.options

// Las pestañas de cada app, como las de Word, Excel y PowerPoint (Inicio,
// Insertar, Disposición…), para que cada cosa esté donde se espera. Las de
// contexto (Tabla, Imagen, Forma) salen al seleccionar uno de esos objetos.

/** Los colores de resaltado de Word. */
const HIGHLIGHTS = ['#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#0000ff', '#ff0000', '#000080', '#008080', '#008000', '#800080', '#800000', '#808000']
export const HIGHLIGHT: Tool = { type: 'color', key: 'highlight', icon: <Highlighter size={ICON} />, swatch: (s) => s.highlight, none: true, swatches: HIGHLIGHTS }
const FIND: Tool[] = [B('find', 'find', { icon: <Search size={ICON} /> }), B('replace', 'replace', { icon: <Replace size={ICON} /> })]
const PAINTER = B('formatPainter', 'formatPainter', { icon: <Paintbrush size={ICON} />, active: (s) => s.painting })
const SCRIPT: Tool[] = [
  B('superscript', 'superscript', { icon: <Superscript size={ICON} />, active: (s) => s.superscript }),
  B('subscript', 'subscript', { icon: <Subscript size={ICON} />, active: (s) => s.subscript })
]
const CASE = MENU('changeCase', 'changeCase', O.changeCase, <CaseSensitive size={ICON} />)
const SHAPES_MENU = MENU('shapes', 'shape', O.shapes, <Shapes size={ICON} />, { caption: true })
const LINK = B('link', 'link', { icon: <Link size={ICON} />, caption: true })
/** Tabla seleccionada (Documentos y Presentaciones). */
const TABLE_MODE: Mode = {
  id: 'table',
  label: M.table,
  icon: <Table size={19} />,
  context: 'table',
  groups: [
    [
      B('rowAbove', 'rowAbove', { icon: <ArrowUpToLine size={ICON} /> }),
      B('rowBelow', 'rowBelow', { icon: <ArrowDownToLine size={ICON} /> }),
      B('colLeft', 'colLeft', { icon: <ArrowLeftToLine size={ICON} /> }),
      B('colRight', 'colRight', { icon: <ArrowRightToLine size={ICON} /> })
    ],
    [
      B('deleteRow', 'deleteRow', { icon: <Rows3 size={ICON} /> }),
      B('deleteCol', 'deleteCol', { icon: <Columns3 size={ICON} /> }),
      B('deleteTable', 'deleteTable', { icon: <Trash2 size={ICON} /> })
    ],
    [B('mergeCells', 'mergeCells', { icon: <TableCellsMerge size={ICON} />, caption: true }), B('splitCell', 'splitCell', { icon: <TableCellsSplit size={ICON} />, caption: true })]
  ]
}

const word: AppConfig = {
  kind: 'word',
  panel: false,
  sheetTabs: false,
  header: [
    { key: 'savePdf', command: 'savePdf' },
    { key: 'save', command: 'save' }
  ],
  modes: [
    {
      id: 'home',
      label: M.home,
      icon: <House size={19} />,
      groups: [
        UNDO,
        [{ type: 'style' }],
        LETTER,
        [...FORMAT.slice(0, 3), FORMAT[4], HIGHLIGHT],
        [ALIGN_MENU, LIST_MENU],
        [FORMAT[3], ...SCRIPT, CASE],
        [
          B('indentLess', 'indentLess', { icon: <ListIndentDecrease size={ICON} /> }),
          B('indentMore', 'indentMore', { icon: <ListIndentIncrease size={ICON} /> }),
          MENU('lineSpacing', 'lineSpacing', O.lineSpacing, <ArrowUpDown size={ICON} />),
          MENU('paraSpacing', 'paraSpacing', O.paraSpacing, <UnfoldVertical size={ICON} />)
        ],
        [B('marks', 'marks', { icon: <Pilcrow size={ICON} />, active: (s) => s.marks }), PAINTER, B('clearFormat', 'clearFormat', { icon: <RemoveFormatting size={ICON} /> })],
        FIND
      ]
    },
    {
      id: 'insert',
      label: M.insert,
      icon: <SquarePlus size={19} />,
      groups: [
        [
          B('table', 'table', { value: '3x3', icon: <Table size={ICON} />, caption: true }),
          B('image', 'image', { icon: <Image size={ICON} />, caption: true }),
          SHAPES_MENU,
          B('textBox', 'textBox', { icon: <Type size={ICON} />, caption: true })
        ],
        [LINK, B('symbol', 'symbol', { icon: <Omega size={ICON} />, caption: true })],
        [B('pageBreak', 'pageBreak', { icon: <SeparatorHorizontal size={ICON} />, caption: true })],
        [
          B('header', 'header', { icon: <PanelTop size={ICON} />, caption: true }),
          B('footer', 'footer', { icon: <PanelBottom size={ICON} />, caption: true }),
          MENU('pageNumber', 'pageNumber', O.pageNumber, <Hash size={ICON} />, { caption: true })
        ],
        [B('equation', 'equation', { icon: <Radical size={ICON} />, caption: true })]
      ]
    },
    {
      id: 'layout',
      label: M.layout,
      icon: <LayoutTemplate size={19} />,
      groups: [
        [
          MENU('margins', 'margins', O.margins, <Frame size={ICON} />, { caption: true }),
          MENU('pageSize', 'pageSize', O.pageSize, <Proportions size={ICON} />, { caption: true }),
          MENU('pageColumns', 'pageColumns', O.pageColumns, <Columns3 size={ICON} />, { caption: true })
        ],
        [
          B('portrait', 'portrait', { icon: <RectangleVertical size={ICON} />, caption: true, active: (s) => s.portrait }),
          B('landscape', 'landscape', { icon: <RectangleHorizontal size={ICON} />, caption: true, active: (s) => !s.portrait })
        ],
        [MENU('paraSpacing', 'paraSpacing', O.paraSpacing, <UnfoldVertical size={ICON} />, { caption: true })],
        [
          MENU('breaks', 'breaks', O.breaks, <SeparatorHorizontal size={ICON} />, { caption: true }),
          {
            type: 'menu',
            key: 'watermark',
            command: 'watermark',
            icon: <Stamp size={ICON} />,
            caption: true,
            options: [
              ...O.watermarkTexts.map((text) => ({ value: `text:${text}`, label: text })),
              { value: 'custom', label: O.watermark.custom },
              { value: 'none', label: O.watermark.none }
            ]
          }
        ]
      ]
    },
    {
      id: 'references',
      label: M.references,
      icon: <BookOpenText size={19} />,
      groups: [
        [
          B('toc', 'toc', { icon: <TableOfContents size={ICON} />, caption: true }),
          B('footnote', 'footnote', { icon: <Superscript size={ICON} />, caption: true }),
          B('endnote', 'endnote', { icon: <NotebookText size={ICON} />, caption: true })
        ]
      ]
    },
    {
      ...TABLE_MODE,
      groups: [...TABLE_MODE.groups, [MENU('tableBorders', 'tableBorders', O.tableBorders, <Grid3x3 size={ICON} />, { caption: true })]]
    },
    {
      id: 'image',
      label: M.image,
      icon: <Image size={19} />,
      context: 'image',
      groups: [
        [MENU('wrapping', 'wrapping', O.wrapping, <WrapText size={ICON} />, { caption: true })],
        [B('originalSize', 'originalSize', { icon: <Maximize size={ICON} />, caption: true }), B('crop', 'crop', { icon: <Crop size={ICON} />, caption: true })]
      ]
    },
    {
      id: 'shape',
      label: M.shape,
      icon: <Shapes size={19} />,
      context: 'shape',
      groups: [[MENU('wrapping', 'wrapping', O.wrapping, <WrapText size={ICON} />, { caption: true })]]
    }
  ],
  extra: [
    ...Object.entries(L.office.styles).map(([style, label]) => ({ label, group: G.style, keywords: L.office.keywords.style, command: 'style', value: style })),
    { label: T.table2, group: G.insert, keywords: L.office.keywords.table, command: 'table', value: '2x2' },
    { label: T.table4, group: G.insert, keywords: L.office.keywords.table, command: 'table', value: '4x4' },
    { label: T.wordCount, group: M.review, keywords: L.office.keywords.wordCount, command: 'wordCount' }
  ]
}

const SUM = B('sum', 'sum', { icon: <Sigma size={ICON} />, caption: true })
const SORT_FILTER: Tool[] = [
  B('sortAsc', 'sort', { value: 'asc', icon: <ArrowUpNarrowWide size={ICON} /> }),
  B('sortDesc', 'sort', { value: 'desc', icon: <ArrowDownWideNarrow size={ICON} /> }),
  B('filter', 'filter', { icon: <Filter size={ICON} />, caption: true, active: (s) => s.filter })
]
/** Hojas: los menús de «Celdas» (insertar, eliminar, formato), como en Excel. */
const CELLS: Tool[] = [
  {
    type: 'menu',
    key: 'cellsInsert',
    command: 'rows',
    icon: <BetweenHorizontalStart size={ICON} />,
    options: Object.entries(O.cellsInsert).map(([command, label]) => ({ value: '', label, command }))
  },
  {
    type: 'menu',
    key: 'cellsDelete',
    command: 'deleteRows',
    icon: <ListX size={ICON} />,
    options: Object.entries(O.cellsDelete).map(([command, label]) => ({ value: '', label, command }))
  },
  {
    type: 'menu',
    key: 'cellsFormat',
    command: 'cells',
    icon: <Rows3 size={ICON} />,
    options: [
      { value: '', label: O.cellsFormat.size, heading: true },
      { value: '', label: O.cellsFormat.rowHeight, command: 'rowHeight' },
      { value: 'autoHeight', label: O.cellsFormat.autoHeight },
      { value: '', label: O.cellsFormat.columnWidth, command: 'columnWidth' },
      { value: 'autoWidth', label: O.cellsFormat.autoWidth },
      { value: '', label: O.cellsFormat.visibility, heading: true },
      { value: 'hideRows', label: O.cellsFormat.hideRows },
      { value: 'showRows', label: O.cellsFormat.showRows },
      { value: 'hideColumns', label: O.cellsFormat.hideColumns },
      { value: 'showColumns', label: O.cellsFormat.showColumns }
    ]
  }
]

const cell: AppConfig = {
  kind: 'cell',
  panel: true,
  sheetTabs: true,
  header: [
    { key: 'savePdf', command: 'savePdf' },
    { key: 'save', command: 'save' }
  ],
  modes: [
    {
      id: 'home',
      label: M.home,
      icon: <House size={19} />,
      groups: [
        UNDO,
        LETTER,
        [
          B('bold', 'bold', { icon: <Bold size={ICON} />, active: (s) => s.bold }),
          B('italic', 'italic', { icon: <Italic size={ICON} />, active: (s) => s.italic }),
          B('underline', 'underline', { icon: <Underline size={ICON} />, active: (s) => s.underline }),
          { type: 'color', key: 'color', icon: <Baseline size={ICON} />, swatch: (s) => s.color },
          { type: 'color', key: 'fill', icon: <PaintBucket size={ICON} />, swatch: (s) => s.fill, none: true },
          B('borders', 'borders', { icon: <Grid3x3 size={ICON} /> })
        ],
        [
          ...ALIGN.slice(0, 3),
          B('wrap', 'wrap', { icon: <WrapText size={ICON} />, active: (s) => s.wrap }),
          B('merge', 'merge', { icon: <TableCellsMerge size={ICON} /> })
        ],
        [
          {
            type: 'menu',
            key: 'numberFormat',
            command: 'numberFormat',
            icon: <Hash size={ICON} />,
            options: Object.entries(O.numberFormat).map(([value, label]) => ({ value, label }))
          },
          B('currency', 'currency', { icon: <Euro size={ICON} />, active: (s) => s.numberFormat === 'currency' }),
          B('percent', 'percent', { icon: <Percent size={ICON} />, active: (s) => s.numberFormat === 'percent' }),
          B('fewerDecimals', 'fewerDecimals', { icon: <span className="glyph">,0</span> }),
          B('moreDecimals', 'moreDecimals', { icon: <span className="glyph">,00</span> })
        ],
        [
          {
            type: 'menu',
            key: 'conditional',
            command: 'cf',
            icon: <Blend size={ICON} />,
            options: [
              { value: '', label: O.conditional.highlight, heading: true },
              ...(['greater', 'less', 'between', 'equal', 'text'] as const).map((v) => ({ value: v, label: O.conditional[v] })),
              ...(['duplicates', 'top10', 'aboveAverage'] as const).map((v) => ({ value: v, label: O.conditional[v], command: 'cfQuick' })),
              { value: '', label: O.conditional.visual, heading: true },
              { value: 'scale:0', label: O.conditional.scaleGreenRed, command: 'cfPreset' },
              { value: 'scale:1', label: O.conditional.scaleRedGreen, command: 'cfPreset' },
              { value: 'bars:0', label: O.conditional.barsBlue, command: 'cfPreset' },
              { value: 'bars:1', label: O.conditional.barsGreen, command: 'cfPreset' },
              { value: 'icons:6', label: O.conditional.iconsTraffic, command: 'cfPreset' },
              { value: 'icons:0', label: O.conditional.iconsArrows, command: 'cfPreset' },
              { value: '', label: O.conditional.clearHeading, heading: true },
              { value: 'selection', label: O.conditional.clearSelection, command: 'cfClear' },
              { value: 'sheet', label: O.conditional.clearSheet, command: 'cfClear' }
            ]
          },
          MENU('formatTable', 'formatTable', O.formatTable, <Table2 size={ICON} />)
        ],
        CELLS,
        [SUM, PAINTER, MENU('clear', 'clear', O.clear, <Eraser size={ICON} />)],
        FIND
      ]
    },
    {
      id: 'insert',
      label: M.insert,
      icon: <SquarePlus size={19} />,
      groups: [
        [
          B('rows', 'rows', { icon: <BetweenHorizontalStart size={ICON} />, caption: true }),
          B('columns', 'columns', { icon: <BetweenVerticalStart size={ICON} />, caption: true })
        ],
        [
          B('columnChart', 'chart', { value: 'columns', icon: <ChartColumn size={ICON} />, caption: true }),
          B('lineChart', 'chart', { value: 'lines', icon: <ChartLine size={ICON} />, caption: true }),
          B('pieChart', 'chart', { value: 'pie', icon: <ChartPie size={ICON} />, caption: true }),
          MENU('moreCharts', 'chart', O.moreCharts, <ChartBar size={ICON} />)
        ],
        [B('image', 'image', { icon: <Image size={ICON} />, caption: true }), LINK]
      ]
    },
    {
      id: 'formulas',
      label: M.formulas,
      icon: <SquareFunction size={19} />,
      groups: [
        [B('insertFunction', 'insertFunction', { icon: <SquareFunction size={ICON} />, caption: true }), B('defineName', 'defineName', { icon: <Tag size={ICON} />, caption: true })],
        [
          SUM,
          B('average', 'func', { value: 'AVERAGE', icon: <Calculator size={ICON} />, caption: true }),
          B('count', 'func', { value: 'COUNT', icon: <Hash size={ICON} />, caption: true }),
          B('max', 'func', { value: 'MAX', icon: <ArrowUpNarrowWide size={ICON} />, caption: true }),
          B('min', 'func', { value: 'MIN', icon: <ArrowDownWideNarrow size={ICON} />, caption: true })
        ]
      ]
    },
    {
      id: 'data',
      label: M.data,
      icon: <Table2 size={19} />,
      groups: [
        SORT_FILTER,
        [
          B('removeDuplicates', 'removeDuplicates', { icon: <CopyMinus size={ICON} />, caption: true }),
          B('validation', 'validationList', { icon: <ListChecks size={ICON} />, caption: true })
        ]
      ]
    },
    {
      id: 'pageLayout',
      label: M.layout,
      icon: <LayoutTemplate size={19} />,
      groups: [
        [
          MENU('pageOrient', 'pageOrient', O.pageOrient, <RectangleVertical size={ICON} />, { caption: true }),
          MENU('paperSize', 'paperSize', O.paperSize, <Proportions size={ICON} />, { caption: true })
        ],
        [MENU('fitTo', 'fitTo', O.fitTo, <Shrink size={ICON} />, { caption: true }), MENU('printArea', 'printArea', O.printArea, <Printer size={ICON} />, { caption: true })]
      ]
    },
    {
      id: 'view',
      label: M.view,
      icon: <Eye size={19} />,
      groups: [
        [
          B('freeze', 'freeze', { icon: <Snowflake size={ICON} />, caption: true, active: (s) => s.frozen }),
          B('gridlines', 'gridlines', { icon: <Grid2x2 size={ICON} />, caption: true, active: (s) => s.gridlines }),
          B('headings', 'headings', { icon: <Heading size={ICON} />, caption: true, active: (s) => s.headings })
        ],
        [B('sidePanel', 'togglePanel', { icon: <PanelRight size={ICON} />, caption: true, active: (s) => s.sidePanel })]
      ]
    }
  ],
  extra: [
    { label: T.newSheet, group: G.sheets, keywords: L.office.keywords.newSheet, command: 'newSheet' },
    { label: T.replace, group: M.home, keywords: L.office.keywords.replace, command: 'replace' }
  ]
}

/** Presentaciones: la forma seleccionada (relleno, contorno, organizar, alinear). */
const ARRANGE: Tool[] = [
  MENU('arrange', 'arrange', O.arrange, <Layers size={ICON} />, { caption: true }),
  MENU('alignShapes', 'alignShapes', O.alignShapes, <AlignHorizontalJustifyCenter size={ICON} />, { caption: true })
]

const slide: AppConfig = {
  kind: 'slide',
  panel: true,
  sheetTabs: false,
  header: [
    { key: 'savePdf', command: 'savePdf' },
    { key: 'save', command: 'save' },
    { key: 'present', command: 'present' }
  ],
  modes: [
    {
      id: 'home',
      label: M.home,
      icon: <House size={19} />,
      groups: [
        UNDO,
        [
          B('newSlide', 'newSlide', { icon: <Presentation size={ICON} />, caption: true }),
          B('duplicateSlide', 'duplicateSlide', { icon: <Copy size={ICON} /> }),
          B('deleteSlide', 'deleteSlide', { icon: <Trash2 size={ICON} /> })
        ],
        LETTER,
        [...FORMAT.slice(0, 3), FORMAT[4]],
        [ALIGN_MENU, LIST_MENU],
        [FORMAT[3], ...SCRIPT, CASE],
        [PAINTER, ...ARRANGE],
        FIND
      ]
    },
    {
      id: 'insert',
      label: M.insert,
      icon: <SquarePlus size={19} />,
      groups: [
        [
          B('textBox', 'textBox', { icon: <Type size={ICON} />, caption: true }),
          SHAPES_MENU,
          B('image', 'image', { icon: <Image size={ICON} />, caption: true }),
          B('table', 'table', { value: '3x3', icon: <Table size={ICON} />, caption: true }),
          MENU('chart', 'chart', O.slideCharts, <ChartColumn size={ICON} />, { caption: true })
        ],
        [LINK, B('symbol', 'symbol', { icon: <Omega size={ICON} />, caption: true })],
        [B('slideFooter', 'slideFooter', { icon: <PanelBottom size={ICON} />, caption: true })]
      ]
    },
    {
      id: 'design',
      label: M.design,
      icon: <Palette size={19} />,
      groups: [
        [MENU('slideSize', 'slideSize', O.slideSize, <Ratio size={ICON} />, { caption: true })],
        [
          { type: 'color', key: 'background', icon: <PaintBucket size={ICON} />, swatch: () => null, none: true },
          B('backgroundAll', 'backgroundAll', { icon: <CopyCheck size={ICON} />, caption: true })
        ]
      ]
    },
    {
      id: 'transitions',
      label: M.transitions,
      icon: <Clapperboard size={19} />,
      groups: [
        [
          {
            type: 'menu',
            key: 'transition',
            command: 'transition',
            icon: <Clapperboard size={ICON} />,
            caption: true,
            options: Object.entries(O.transition).map(([value, label]) => ({ value, label }))
          },
          MENU('duration', 'duration', O.duration, <Timer size={ICON} />, { caption: true })
        ],
        [B('transitionPreview', 'transitionPreview', { icon: <Play size={ICON} />, caption: true }), B('transitionAll', 'transitionAll', { icon: <CopyCheck size={ICON} />, caption: true })],
        [MENU('animation', 'animation', O.animation, <Sparkle size={ICON} />, { caption: true })]
      ]
    },
    {
      id: 'present',
      label: M.present,
      icon: <Play size={19} />,
      groups: [
        [
          B('fromStart', 'present', { icon: <Play size={ICON} />, caption: true }),
          B('fromHere', 'present', { value: 'here', icon: <Play size={ICON} />, caption: true })
        ],
        [
          B('hideSlide', 'hideSlide', { icon: <EyeOff size={ICON} />, caption: true, active: (s) => s.slideHidden }),
          B('notes', 'notes', { icon: <StickyNote size={ICON} />, caption: true, active: (s) => s.notes })
        ]
      ]
    },
    {
      id: 'shape',
      label: M.shape,
      icon: <Shapes size={19} />,
      context: 'shape',
      groups: [
        [
          { type: 'color', key: 'shapeFill', icon: <PaintBucket size={ICON} />, swatch: (s) => s.shapeFill, none: true },
          { type: 'color', key: 'shapeLine', icon: <PenLine size={ICON} />, swatch: (s) => s.lineColor, none: true },
          MENU('lineWidth', 'lineWidth', O.lineWidth, <Minus size={ICON} />)
        ],
        ARRANGE
      ]
    },
    TABLE_MODE,
    {
      id: 'image',
      label: M.image,
      icon: <Image size={19} />,
      context: 'image',
      groups: [ARRANGE]
    }
  ],
  extra: [
    ...LISTS.flatMap((t) => (t.type === 'button' ? [{ label: T[t.key], group: G.format, keywords: L.office.keywords[t.key as keyof typeof L.office.keywords] ?? '', command: t.command }] : [])),
    { label: T.fit, group: G.view, keywords: L.office.keywords.fit, command: 'fit' }
  ]
}

/** Las tareas de la IA, con su icono (el modo «IA» solo sale con la IA activada en Ajustes). */
const AI_ICONS: Record<AiTask, ReactNode> = {
  rewrite: <PenLine size={ICON} />,
  summarize: <ListCollapse size={ICON} />,
  ask: <MessageCircleQuestion size={ICON} />,
  draft: <Feather size={ICON} />,
  continue: <TextCursorInput size={ICON} />,
  formula: <SquareFunction size={ICON} />,
  explain: <MessageCircleQuestion size={ICON} />,
  data: <ListCollapse size={ICON} />,
  slides: <Presentation size={ICON} />,
  notes: <StickyNote size={ICON} />
}
const AI_KEYS: Record<AiTask, ToolKey> = {
  rewrite: 'aiRewrite',
  summarize: 'aiSummarize',
  ask: 'aiAsk',
  draft: 'aiDraft',
  continue: 'aiContinue',
  formula: 'aiFormula',
  explain: 'aiExplain',
  data: 'aiData',
  slides: 'aiSlides',
  notes: 'aiNotes'
}
export function aiMode(kind: OfficeKind): Mode {
  return {
    id: 'ai',
    label: L.office.ai.mode,
    icon: <Sparkles size={19} />,
    groups: [AI_TASKS[kind].map((task) => B(AI_KEYS[task], 'ai', { value: task, icon: AI_ICONS[task], caption: true }))]
  }
}

word.modes.push(reviewMode(true))
cell.modes.push(reviewMode(false))
slide.modes.push(reviewMode(false))

/**
 * Programador (como la pestaña de Office): los controles de formulario de Word
 * y «Solo rellenar» en Documentos; validar datos, bloquear celdas y proteger
 * la hoja en Hojas; y «Mis scripts» en las tres.
 */
const SCRIPTS = B('scripts', 'scripts', { icon: <SquareTerminal size={ICON} />, caption: true, active: (s) => s.scriptsOpen })
function developerMode(groups: Tool[][]): Mode {
  return { id: 'developer', label: M.developer, icon: <Code size={19} />, groups: [...groups, [SCRIPTS]] }
}
word.modes.push(
  developerMode([
    [
      B('ccText', 'control', { value: 'text', icon: <TextCursorInput size={ICON} />, caption: true }),
      B('ccRich', 'control', { value: 'rich', icon: <Pilcrow size={ICON} /> }),
      B('ccCheck', 'control', { value: 'check', icon: <SquareCheck size={ICON} />, caption: true }),
      B('ccList', 'control', { value: 'list', icon: <ChevronsUpDown size={ICON} />, caption: true }),
      B('ccCombo', 'control', { value: 'combo', icon: <ListPlus size={ICON} /> }),
      B('ccDate', 'control', { value: 'date', icon: <CalendarDays size={ICON} />, caption: true }),
      B('ccPicture', 'control', { value: 'picture', icon: <Image size={ICON} /> })
    ],
    [
      B('ccProps', 'controlAsk', { icon: <SlidersHorizontal size={ICON} />, caption: true, disabled: (s) => !s.control }),
      B('ccRemove', 'controlRemove', { icon: <Eraser size={ICON} />, disabled: (s) => !s.control })
    ],
    [B('formsOnly', 'formsOnlyAsk', { icon: <Lock size={ICON} />, caption: true, active: (s) => s.formsOnly })]
  ])
)
cell.modes.push(
  developerMode([
    [
      B('validate', 'validateAsk', { icon: <ListChecks size={ICON} />, caption: true }),
      B('validation', 'validationList', { icon: <ChevronsUpDown size={ICON} /> }),
      B('validateClear', 'validate', { value: '{"type":"none"}', icon: <ListX size={ICON} /> })
    ],
    [B('lockCells', 'lockCells', { icon: <Lock size={ICON} /> }), B('unlockCells', 'unlockCells', { icon: <LockOpen size={ICON} /> })],
    [B('protectSheet', 'protectSheetAsk', { icon: <ShieldCheck size={ICON} />, caption: true, active: (s) => s.sheetProtected })]
  ])
)
slide.modes.push(developerMode([]))

export const APPS: Record<OfficeKind, AppConfig> = { word, cell, slide }

/** Todas las órdenes del buscador de una app: sus herramientas (sin repetir), las de la cabecera y las demás. */
export function paletteEntries(app: AppConfig): PaletteEntry[] {
  const seen = new Set<string>()
  const out: PaletteEntry[] = []
  const add = (entry: PaletteEntry): void => {
    const id = `${entry.command}:${entry.value ?? ''}`
    if (seen.has(id)) return
    seen.add(id)
    out.push(entry)
  }
  for (const mode of app.modes) {
    for (const group of mode.groups) {
      for (const tool of group) {
        if (tool.type === 'menu') {
          // Cada opción de un desplegable, una orden del buscador («Márgenes: Estrechos»).
          for (const option of tool.options) {
            if (option.heading) continue
            add({ label: `${T[tool.key]}: ${option.label}`, group: mode.label, keywords: '', command: option.command ?? tool.command, value: option.value })
          }
          continue
        }
        if (tool.type !== 'button') continue
        add({
          label: T[tool.key],
          group: mode.label,
          keywords: L.office.keywords[tool.key as keyof typeof L.office.keywords] ?? '',
          command: tool.command,
          value: tool.value
        })
      }
    }
  }
  for (const entry of [...app.extra, ...COMMON_EXTRA]) add(entry)
  return out
}
