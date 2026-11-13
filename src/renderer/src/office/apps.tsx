/**
 * Lo que tiene cada app: modos, herramientas de cada modo, botones de la
 * cabecera y órdenes del buscador. Solo nombres de órdenes de Molino (engine.ts
 * y features/ las traducen al editor); nada de aquí conoce ONLYOFFICE.
 *
 * Los desplegables son visuales (ui/pickers.tsx): cada opción con su
 * miniatura (ui/glyphs.tsx) o su icono. Cada grupo lleva un nombre, el que
 * se ve en «Más» cuando no cabe en la barra.
 */
import {
  AlignCenter,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignHorizontalJustifyCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignEndVertical,
  AlignVerticalJustifyCenter,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  ArrowDownToLine,
  ArrowDownWideNarrow,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpNarrowWide,
  ArrowUpToLine,
  ArrowUpDown,
  AArrowDown,
  AArrowUp,
  Baseline,
  BetweenHorizontalStart,
  BetweenVerticalStart,
  Blend,
  Bold,
  BookOpenText,
  BringToFront,
  Calculator,
  CalendarDays,
  CaseSensitive,
  ChartArea,
  ChartBar,
  ChartColumn,
  ChartLine,
  ChartPie,
  ChartScatter,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Clapperboard,
  Clock,
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
  FilterX,
  Frame,
  Grid2x2,
  Grid3x3,
  Group,
  Hash,
  Heading,
  Highlighter,
  House,
  Image,
  Italic,
  LayoutTemplate,
  Layers,
  Link,
  List,
  ListChecks,
  ListCollapse,
  ListIndentDecrease,
  ListIndentIncrease,
  ListPlus,
  ListRestart,
  ListX,
  Lock,
  LockOpen,
  Maximize,
  MessageCircleQuestion,
  MessageSquarePlus,
  Minus,
  MoveDiagonal,
  MoveVertical,
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
  RemoveFormatting,
  Replace,
  RotateCcw,
  RotateCw,
  Rows3,
  Search,
  SendToBack,
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
  UnfoldVertical,
  Ungroup,
  WrapText,
  X
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { OfficeKind } from '@shared/officeui'
import { AI_TASKS, type AiTask } from './AiPanel'
import type { EditorState } from './engine'
import { FEATURES } from './features'
import { BULLETS, NUMBERS, OUTLINES } from './features/lists'
import { L } from './i18n'
import {
  BarsGlyph,
  BorderGlyph,
  BreakGlyph,
  IconSetGlyph,
  LineWidthGlyph,
  ListGlyph,
  OutlineGlyph,
  PageGlyph,
  PageNumberGlyph,
  ParagraphGlyph,
  ScaleGlyph,
  ShapeGlyph,
  SizeGlyph,
  SpacingGlyph,
  TableStyleGlyph,
  WatermarkGlyph,
  WrapGlyph
} from './ui/glyphs'

const T = L.office.tools
export type ToolKey = keyof typeof T

export type Tool =
  | {
      type: 'button'
      /** La herramienta (su nombre está en L.office.tools, o en ``label``). */
      key: ToolKey | (string & {})
      label?: string
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
      key: 'color' | 'fill' | 'highlight' | 'shapeFill' | 'shapeLine' | 'background' | (string & {})
      label?: string
      icon: ReactNode
      swatch: (s: EditorState) => string | null
      /** La orden (si no, la de su nombre). */
      command?: string
      /** Botón «Sin color». */
      none?: boolean
      swatches?: string[]
      /** El color que pone el botón antes de elegir otro. */
      defaultColor?: string
    }
  | {
      type: 'menu'
      key: ToolKey | (string & {})
      label?: string
      command: string
      icon: ReactNode
      caption?: boolean
      /** Las opciones (o las que haya en el documento: diseños, temas…). */
      options: MenuOption[] | ((s: EditorState) => MenuOption[])
      /** En cuadrícula de miniaturas, con estas columnas. */
      tiles?: number
      /** La opción que está puesta (se marca en el menú). */
      current?: (s: EditorState) => string
    }

/** Una opción de un desplegable: su valor (y su orden, si no es la del desplegable) o un título de grupo. */
export interface MenuOption {
  value: string
  label: string
  command?: string
  heading?: boolean
  /** Su miniatura (en cuadrícula). */
  preview?: ReactNode
  /** Su icono (en lista). */
  icon?: ReactNode
  hint?: string
  /** Una acción (Personalizar…, Quitar…): va debajo de las miniaturas. */
  action?: boolean
}

export interface Mode {
  id: string
  label: string
  icon: ReactNode
  groups: Tool[][]
  /** El nombre de cada grupo (se ve en «Más»). */
  names?: string[]
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
  /** Panel lateral: estadísticas de la selección (Hojas). */
  panel: boolean
  /** Pestañas de las hojas del libro, debajo del documento. */
  sheetTabs: boolean
  /** La barra: flotante sobre el documento (Documentos, Presentaciones) o fija arriba (Hojas, que ocupa toda la ventana). */
  toolbar: 'floating' | 'docked'
  /** Botones de la cabecera, de izquierda a derecha (el último, el principal). */
  header: { key: 'savePdf' | 'save' | 'present'; command: string; value?: string }[]
  /** Órdenes del buscador además de las de las herramientas. */
  extra: PaletteEntry[]
}

const ICON = 16
const B = (key: ToolKey, command: string, extra: Partial<Extract<Tool, { type: 'button' }>> = {}): Tool => ({ type: 'button', key, command, ...extra })
const M = L.office.modes
const G = L.office.groups
const N = L.office.groupNames
const O = L.office.options
const LS = L.office.lists

// ---------------------------------------------------------------- comunes

const LETTER: Tool[] = [{ type: 'font' }, { type: 'size' }]
const GROW: Tool[] = [B('grow', 'grow', { icon: <AArrowUp size={ICON} /> }), B('shrink', 'shrink', { icon: <AArrowDown size={ICON} /> })]
const BOLD = B('bold', 'bold', { icon: <Bold size={ICON} />, active: (s) => s.bold })
const ITALIC = B('italic', 'italic', { icon: <Italic size={ICON} />, active: (s) => s.italic })
const UNDERLINE = B('underline', 'underline', { icon: <Underline size={ICON} />, active: (s) => s.underline })
const STRIKE = B('strike', 'strike', { icon: <Strikethrough size={ICON} />, active: (s) => s.strike })
/** El color del texto y el resaltado (también en la barra de lo seleccionado). */
export const TEXT_COLOR: Tool = { type: 'color', key: 'color', icon: <Baseline size={ICON} />, swatch: (s) => s.color, none: true, defaultColor: '#c4505a' }
/** Los colores de resaltado de Word. */
const HIGHLIGHTS = ['#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#0000ff', '#ff0000', '#000080', '#008080', '#008000', '#800080', '#800000', '#808000', '#808080', '#c0c0c0', '#000000']
export const HIGHLIGHT: Tool = { type: 'color', key: 'highlight', icon: <Highlighter size={ICON} />, swatch: (s) => s.highlight, none: true, swatches: HIGHLIGHTS, defaultColor: '#ffff00' }
const FIND: Tool[] = [B('find', 'find', { icon: <Search size={ICON} /> }), B('replace', 'replace', { icon: <Replace size={ICON} /> })]
const PAINTER = B('formatPainter', 'formatPainter', { icon: <Paintbrush size={ICON} />, active: (s) => s.painting })
const CLEAR_FORMAT = B('clearFormat', 'clearFormat', { icon: <RemoveFormatting size={ICON} /> })
const SCRIPT: Tool[] = [
  B('superscript', 'superscript', { icon: <Superscript size={ICON} />, active: (s) => s.superscript }),
  B('subscript', 'subscript', { icon: <Subscript size={ICON} />, active: (s) => s.subscript })
]
const LINK = B('link', 'link', { icon: <Link size={ICON} />, caption: true })

/** Un desplegable: el botón y sus opciones (cada una, una orden con su valor). */
function MENU(key: ToolKey, command: string, options: MenuOption[] | ((s: EditorState) => MenuOption[]), icon: ReactNode, extra: Partial<Extract<Tool, { type: 'menu' }>> = {}): Tool {
  return { type: 'menu', key, command, icon, options, ...extra }
}
/** Opciones con su icono, a partir de los textos {valor: nombre}. */
function rows(labels: Record<string, string>, icons: Record<string, ReactNode> = {}, command?: string): MenuOption[] {
  return Object.entries(labels).map(([value, label]) => ({ value, label, icon: icons[value], command }))
}
/** Opciones con su miniatura, a partir de los textos {valor: nombre}. */
function tiles(labels: Record<string, string>, art: (value: string) => ReactNode, command?: string): MenuOption[] {
  return Object.entries(labels).map(([value, label]) => ({ value, label, preview: art(value), command }))
}

/** Alinear: las cuatro, en miniatura. */
const ALIGN_ICONS: Record<string, ReactNode> = {
  left: <AlignLeft size={20} />,
  center: <AlignCenter size={20} />,
  right: <AlignRight size={20} />,
  justify: <AlignJustify size={20} />
}
const ALIGN_MENU: Tool = MENU(
  'alignMenu',
  'align',
  [
    { value: 'left', label: T.alignLeft, preview: ALIGN_ICONS.left },
    { value: 'center', label: T.alignCenter, preview: ALIGN_ICONS.center },
    { value: 'right', label: T.alignRight, preview: ALIGN_ICONS.right },
    { value: 'justify', label: T.justify, preview: ALIGN_ICONS.justify }
  ],
  <AlignLeft size={ICON} />,
  { tiles: 4, current: (s) => s.align }
)

/** Listas, como la galería de Word: viñetas, numeración, multinivel y lo de la lista. */
function listMenu(kind: OfficeKind): Tool {
  const bullets: MenuOption[] = Object.entries(BULLETS).map(([id, b]) => ({ value: `bullet:${id}`, label: LS.bullets[id as keyof typeof LS.bullets], preview: <ListGlyph marks={[b.shown, b.shown, b.shown]} /> }))
  const numbers: MenuOption[] = Object.entries(NUMBERS).map(([id, n]) => ({ value: `number:${id}`, label: LS.numbers[id as keyof typeof LS.numbers], preview: <ListGlyph marks={n.shown} /> }))
  const outlines: MenuOption[] =
    kind === 'word' ? Object.entries(OUTLINES).map(([id, o]) => ({ value: `outline:${id}`, label: LS.outlines[id as keyof typeof LS.outlines], preview: <OutlineGlyph marks={o.shown} /> })) : []
  const actions: MenuOption[] =
    kind === 'word'
      ? [
          { value: '1', label: LS.restart, command: 'listRestart', action: true, icon: <ListRestart size={15} /> },
          { value: '', label: LS.continue, command: 'listContinue', action: true, icon: <ListPlus size={15} /> },
          { value: '', label: LS.restartAt, command: 'listRestartAsk', action: true, icon: <Hash size={15} /> },
          { value: '', label: LS.custom, command: 'listCustomAsk', action: true, icon: <SlidersHorizontal size={15} /> },
          { value: 'none', label: LS.none, action: true, icon: <ListX size={15} /> }
        ]
      : [{ value: 'none', label: LS.none, action: true, icon: <ListX size={15} /> }]
  return MENU(
    'listMenu',
    'list',
    [{ value: '', label: LS.bulletsTitle, heading: true }, ...bullets, { value: '', label: LS.numbersTitle, heading: true }, ...numbers, ...(outlines.length ? [{ value: '', label: LS.outlinesTitle, heading: true }, ...outlines] : []), { value: '', label: LS.actions, heading: true }, ...actions],
    <List size={ICON} />,
    { tiles: 4 }
  )
}

const LINE_SPACING = MENU(
  'lineSpacing',
  'lineSpacing',
  Object.entries(O.lineSpacing).map(([value, label]) => ({ value, label, icon: <SpacingGlyph gap={3 + Number(value) * 2.5} /> })),
  <ArrowUpDown size={ICON} />,
  { current: (s) => String(s.extra.lineSpacing ?? '') }
)
const PARA_GAPS: Record<string, [number, number]> = { none: [0, 0], compact: [0, 2], normal: [0, 4], open: [2, 6], wide: [4, 8] }
const PARA_SPACING = MENU(
  'paraSpacing',
  'paraSpacing',
  Object.entries(O.paraSpacing).map(([value, label]) => ({ value, label, icon: <ParagraphGlyph before={PARA_GAPS[value]?.[0] ?? 0} after={PARA_GAPS[value]?.[1] ?? 0} /> })),
  <UnfoldVertical size={ICON} />
)
/** Mayúsculas y minúsculas: cada opción escrita como queda. */
const CASE = MENU('changeCase', 'changeCase', rows(O.changeCase, { sentence: <span className="glyph-text">Aa</span>, lower: <span className="glyph-text">aa</span>, upper: <span className="glyph-text">AA</span>, capitalize: <span className="glyph-text">Aa Aa</span>, toggle: <span className="glyph-text">aA</span> }), <CaseSensitive size={ICON} />)
const SHAPES_MENU = MENU('shapes', 'shape', tiles(O.shapes, (v) => <ShapeGlyph shape={v} />), <Shapes size={ICON} />, { caption: true, tiles: 6 })
const INDENTS: Tool[] = [B('indentLess', 'indentLess', { icon: <ListIndentDecrease size={ICON} /> }), B('indentMore', 'indentMore', { icon: <ListIndentIncrease size={ICON} /> })]

/** Revisar: comentarios en las tres apps; control de cambios, en Documentos. */
const COMMENT: Tool = B('comment', 'focusComment', { icon: <MessageSquarePlus size={ICON} />, caption: true })
function reviewMode(track: boolean): Mode {
  return {
    id: 'review',
    label: M.review,
    icon: <MessageSquarePlus size={19} />,
    names: track ? [N.comments, N.track, N.changes, N.all] : [N.comments],
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

const COMMON_EXTRA: PaletteEntry[] = [
  { label: T.save, group: G.file, keywords: L.office.keywords.save, command: 'save' },
  { label: T.saveAs, group: G.file, keywords: L.office.keywords.saveAs, command: 'saveAs' },
  { label: T.print, group: G.file, keywords: L.office.keywords.print, command: 'print' },
  { label: T.savePdf, group: G.file, keywords: L.office.keywords.savePdf, command: 'savePdf' },
  { label: T.undo, group: G.file, keywords: L.office.keywords.undo, command: 'undo' },
  { label: T.redo, group: G.file, keywords: L.office.keywords.redo, command: 'redo' },
  { label: T.zoomIn, group: G.view, keywords: L.office.keywords.zoomIn, command: 'zoomIn' },
  { label: T.zoomOut, group: G.view, keywords: L.office.keywords.zoomOut, command: 'zoomOut' }
]

/** Tabla: de los tamaños de siempre, o a medida. */
function tableMenu(caption = true): Tool {
  return MENU(
    'table',
    'table',
    [
      ...['2x2', '3x3', '4x4', '3x5', '5x5', '6x8'].map((size) => {
        const [c, r] = size.split('x').map(Number)
        return { value: size, label: `${c} × ${r}`, preview: <TableGrid cols={c} rows={r} /> }
      }),
      { value: '', label: L.office.tableMenu.custom, command: 'tableAsk', action: true, icon: <SlidersHorizontal size={15} /> }
    ],
    <Table size={ICON} />,
    { caption, tiles: 3 }
  )
}
function TableGrid({ cols, rows: count }: { cols: number; rows: number }) {
  return (
    <span className="glyph-table" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {Array.from({ length: cols * count }, (_, i) => (
        <i key={i} />
      ))}
    </span>
  )
}

/** Tabla seleccionada (Documentos y Presentaciones). */
const TABLE_MODE: Mode = {
  id: 'table',
  label: M.table,
  icon: <Table size={19} />,
  context: 'table',
  names: [N.insert, N.delete, N.cells],
  groups: [
    [
      B('rowAbove', 'rowAbove', { icon: <ArrowUpToLine size={ICON} /> }),
      B('rowBelow', 'rowBelow', { icon: <ArrowDownToLine size={ICON} /> }),
      B('colLeft', 'colLeft', { icon: <ArrowLeftToLine size={ICON} /> }),
      B('colRight', 'colRight', { icon: <ArrowRightToLine size={ICON} /> })
    ],
    [B('deleteRow', 'deleteRow', { icon: <Rows3 size={ICON} /> }), B('deleteCol', 'deleteCol', { icon: <Columns3 size={ICON} /> }), B('deleteTable', 'deleteTable', { icon: <Trash2 size={ICON} /> })],
    [B('mergeCells', 'mergeCells', { icon: <TableCellsMerge size={ICON} />, caption: true }), B('splitCell', 'splitCell', { icon: <TableCellsSplit size={ICON} />, caption: true })]
  ]
}

// -------------------------------------------------------------- Documentos

const MARGIN_ART: Record<string, number> = { normal: 0.16, narrow: 0.07, moderate: 0.12, wide: 0.24 }
const PAPER: Record<string, [number, number]> = { a4: [210, 297], letter: [216, 279], a5: [148, 210], legal: [216, 356] }

const word: AppConfig = {
  kind: 'word',
  panel: false,
  sheetTabs: false,
  toolbar: 'floating',
  header: [
    { key: 'savePdf', command: 'savePdf' },
    { key: 'save', command: 'save' }
  ],
  modes: [
    {
      id: 'home',
      label: M.home,
      icon: <House size={19} />,
      names: [N.style, N.letter, N.format, N.paragraph, N.moreFormat, N.spacing, N.tools, N.find],
      groups: [
        [{ type: 'style' }],
        LETTER,
        [BOLD, ITALIC, UNDERLINE, TEXT_COLOR, HIGHLIGHT],
        [ALIGN_MENU, listMenu('word')],
        [STRIKE, ...SCRIPT, CASE, ...GROW, CLEAR_FORMAT],
        [...INDENTS, LINE_SPACING, PARA_SPACING],
        [B('marks', 'marks', { icon: <Pilcrow size={ICON} />, active: (s) => s.marks }), PAINTER],
        FIND
      ]
    },
    {
      id: 'insert',
      label: M.insert,
      icon: <SquarePlus size={19} />,
      names: [N.objects, N.links, N.pages, N.headerFooter, N.symbols],
      groups: [
        [tableMenu(), B('image', 'image', { icon: <Image size={ICON} />, caption: true }), SHAPES_MENU, B('textBox', 'textBox', { icon: <Type size={ICON} />, caption: true })],
        [LINK, B('symbol', 'symbol', { icon: <Omega size={ICON} />, caption: true })],
        [B('pageBreak', 'pageBreak', { icon: <SeparatorHorizontal size={ICON} />, caption: true })],
        [
          B('header', 'header', { icon: <PanelTop size={ICON} />, caption: true }),
          B('footer', 'footer', { icon: <PanelBottom size={ICON} />, caption: true }),
          MENU('pageNumber', 'pageNumber', tiles(O.pageNumber, (v) => <PageNumberGlyph where={v as 'top' | 'bottom'} />), <Hash size={ICON} />, { caption: true, tiles: 2 })
        ],
        [B('equation', 'equation', { icon: <Radical size={ICON} />, caption: true })]
      ]
    },
    {
      id: 'layout',
      label: M.layout,
      icon: <LayoutTemplate size={19} />,
      names: [N.page, N.orientation, N.spacing, N.breaks],
      groups: [
        [
          MENU('margins', 'margins', tiles(O.margins, (v) => <PageGlyph margin={MARGIN_ART[v] ?? 0.16} />), <Frame size={ICON} />, { caption: true, tiles: 4 }),
          MENU('pageSize', 'pageSize', tiles(O.pageSize, (v) => <SizeGlyph width={PAPER[v]?.[0] ?? 210} height={PAPER[v]?.[1] ?? 297} />), <Proportions size={ICON} />, { caption: true, tiles: 4 }),
          MENU('pageColumns', 'pageColumns', tiles(O.pageColumns, (v) => <PageGlyph columns={Number(v)} margin={0.12} />), <Columns3 size={ICON} />, { caption: true, tiles: 3 })
        ],
        [
          B('portrait', 'portrait', { icon: <RectangleVertical size={ICON} />, caption: true, active: (s) => s.portrait }),
          B('landscape', 'landscape', { icon: <RectangleHorizontal size={ICON} />, caption: true, active: (s) => !s.portrait })
        ],
        [{ ...PARA_SPACING, caption: true } as Tool],
        [
          MENU('breaks', 'breaks', tiles(O.breaks, (v) => <BreakGlyph kind={v as 'page' | 'column' | 'nextPage' | 'continuous'} />), <SeparatorHorizontal size={ICON} />, { caption: true, tiles: 4 }),
          MENU(
            'watermark',
            'watermark',
            [
              ...O.watermarkTexts.map((text) => ({ value: `text:${text}`, label: text, preview: <WatermarkGlyph text={text} /> })),
              { value: 'custom', label: O.watermark.custom, action: true, icon: <PenLine size={15} /> },
              { value: 'none', label: O.watermark.none, action: true, icon: <X size={15} /> }
            ],
            <Stamp size={ICON} />,
            { caption: true, tiles: 5 }
          )
        ]
      ]
    },
    {
      id: 'references',
      label: M.references,
      icon: <BookOpenText size={19} />,
      names: [N.contents, N.notes],
      groups: [
        [B('toc', 'toc', { icon: <TableOfContents size={ICON} />, caption: true })],
        [B('footnote', 'footnote', { icon: <Superscript size={ICON} />, caption: true }), B('endnote', 'endnote', { icon: <NotebookText size={ICON} />, caption: true })]
      ]
    },
    {
      ...TABLE_MODE,
      names: [...(TABLE_MODE.names ?? []), N.borders],
      groups: [
        ...TABLE_MODE.groups,
        [
          MENU(
            'tableBorders',
            'tableBorders',
            tiles(O.tableBorders, (v) => <BorderGlyph outside={v === 'all' || v === 'outside'} inside={v === 'all' || v === 'inside'} />),
            <Grid3x3 size={ICON} />,
            { caption: true, tiles: 4 }
          )
        ]
      ]
    },
    {
      id: 'image',
      label: M.image,
      icon: <Image size={19} />,
      context: 'image',
      names: [N.wrap, N.size],
      groups: [
        [MENU('wrapping', 'wrapping', tiles(O.wrapping, (v) => <WrapGlyph mode={v as 'inline'} />), <WrapText size={ICON} />, { caption: true, tiles: 3 })],
        [B('originalSize', 'originalSize', { icon: <Maximize size={ICON} />, caption: true }), B('crop', 'crop', { icon: <Crop size={ICON} />, caption: true })]
      ]
    },
    {
      id: 'shape',
      label: M.shape,
      icon: <Shapes size={19} />,
      context: 'shape',
      names: [N.wrap],
      groups: [[MENU('wrapping', 'wrapping', tiles(O.wrapping, (v) => <WrapGlyph mode={v as 'inline'} />), <WrapText size={ICON} />, { caption: true, tiles: 3 })]]
    }
  ],
  extra: [
    ...Object.entries(L.office.styles).map(([style, label]) => ({ label, group: G.style, keywords: L.office.keywords.style, command: 'style', value: style })),
    { label: T.wordCount, group: M.review, keywords: L.office.keywords.wordCount, command: 'wordCount' }
  ]
}

// ------------------------------------------------------------------- Hojas

const NUMBER_SAMPLES: Record<string, string> = {
  general: 'Abc 123',
  number: '1.234,50',
  currency: '1.234,50 €',
  accounting: '€ 1.234,50',
  shortDate: '13/11/2026',
  longDate: '13 nov 2026',
  time: '13:45:00',
  percent: '12,5 %',
  fraction: '1/4',
  scientific: '1,23E+03',
  text: '"123"',
  custom: '#,##0.0'
}
const CELL_BORDER_ART: Record<string, ReactNode> = {
  all: <BorderGlyph outside inside />,
  outside: <BorderGlyph outside />,
  inside: <BorderGlyph inside />,
  top: <BorderGlyph top />,
  bottom: <BorderGlyph bottom />,
  left: <BorderGlyph left />,
  right: <BorderGlyph right />,
  thickBottom: <BorderGlyph bottom />,
  none: <BorderGlyph />
}
const CELL_BORDERS = MENU('cellBorders', 'cellBorders', tiles(O.cellBorders, (v) => CELL_BORDER_ART[v]), <Grid3x3 size={ICON} />, { tiles: 3 })
const VALIGN = MENU(
  'valignMenu',
  'valign',
  [
    { value: 'top', label: O.valign.top, preview: <AlignStartHorizontal size={20} /> },
    { value: 'center', label: O.valign.center, preview: <AlignCenterVertical size={20} /> },
    { value: 'bottom', label: O.valign.bottom, preview: <AlignEndHorizontal size={20} /> }
  ],
  <AlignVerticalJustifyCenter size={ICON} />,
  { tiles: 3, current: (s) => String(s.extra.valign ?? 'bottom') }
)
const TEXT_ANGLE = MENU(
  'textAngle',
  'textAngle',
  [
    { value: '0', label: O.textAngle['0'], icon: <span className="glyph-text">ab</span> },
    { value: '45', label: O.textAngle['45'], icon: <RotateCcw size={15} /> },
    { value: '-45', label: O.textAngle['-45'], icon: <RotateCw size={15} /> },
    { value: '90', label: O.textAngle['90'], icon: <MoveVertical size={15} /> },
    { value: '-90', label: O.textAngle['-90'], icon: <MoveDiagonal size={15} /> },
    { value: '255', label: O.textAngle['255'], icon: <span className="glyph-text vertical">ab</span> }
  ],
  <RotateCcw size={ICON} />,
  { current: (s) => String(s.extra.angle ?? '0') }
)
const MERGE = MENU('mergeMenu', 'mergeMode', rows(O.mergeMode, { center: <TableCellsMerge size={15} />, across: <Rows3 size={15} />, cells: <Grid2x2 size={15} />, unmerge: <TableCellsSplit size={15} /> }), <TableCellsMerge size={ICON} />)
const CELL_ALIGN = MENU(
  'alignMenu',
  'align',
  [
    { value: 'left', label: T.alignLeft, preview: ALIGN_ICONS.left },
    { value: 'center', label: T.alignCenter, preview: ALIGN_ICONS.center },
    { value: 'right', label: T.alignRight, preview: ALIGN_ICONS.right },
    { value: 'justify', label: T.justify, preview: ALIGN_ICONS.justify }
  ],
  <AlignLeft size={ICON} />,
  { tiles: 4, current: (s) => s.align }
)
const NUMBER_FORMAT = MENU(
  'numberFormat',
  'numberFormat',
  Object.entries(O.numberFormat).map(([value, label]) => ({ value, label, icon: <span className="glyph-sample">{NUMBER_SAMPLES[value] ?? ''}</span>, action: value === 'custom' })),
  <Hash size={ICON} />,
  { current: (s) => s.numberFormat }
)
const CONDITIONAL = MENU(
  'conditional',
  'cf',
  [
    { value: '', label: O.conditional.highlight, heading: true },
    ...(['greater', 'less', 'between', 'equal', 'text'] as const).map((v) => ({ value: v, label: O.conditional[v], icon: <span className="glyph-cell" /> })),
    ...(['duplicates', 'top10', 'aboveAverage'] as const).map((v) => ({ value: v, label: O.conditional[v], command: 'cfQuick', icon: <span className="glyph-cell" /> })),
    { value: '', label: O.conditional.visual, heading: true },
    { value: 'scale:0', label: O.conditional.scaleGreenRed, command: 'cfPreset', preview: <ScaleGlyph colors={['#63be7b', '#ffeb84', '#f8696b']} /> },
    { value: 'scale:1', label: O.conditional.scaleRedGreen, command: 'cfPreset', preview: <ScaleGlyph colors={['#f8696b', '#ffeb84', '#63be7b']} /> },
    { value: 'bars:0', label: O.conditional.barsBlue, command: 'cfPreset', preview: <BarsGlyph color="#2867d1" /> },
    { value: 'bars:1', label: O.conditional.barsGreen, command: 'cfPreset', preview: <BarsGlyph color="#2a9358" /> },
    { value: 'icons:6', label: O.conditional.iconsTraffic, command: 'cfPreset', preview: <IconSetGlyph set="traffic" /> },
    { value: 'icons:0', label: O.conditional.iconsArrows, command: 'cfPreset', preview: <IconSetGlyph set="arrows" /> },
    { value: '', label: O.conditional.clearHeading, heading: true },
    { value: 'selection', label: O.conditional.clearSelection, command: 'cfClear', action: true, icon: <Eraser size={15} /> },
    { value: 'sheet', label: O.conditional.clearSheet, command: 'cfClear', action: true, icon: <Eraser size={15} /> }
  ],
  <Blend size={ICON} />,
  { tiles: 3 }
)
const TABLE_COLORS: Record<string, [string, boolean]> = {
  TableStyleMedium2: ['#2867d1', false],
  TableStyleMedium3: ['#e06a1a', false],
  TableStyleMedium7: ['#2a9358', false],
  TableStyleMedium4: ['#545b69', false],
  TableStyleLight9: ['#2867d1', true],
  TableStyleLight1: ['#545b69', true]
}
const FORMAT_TABLE = MENU('formatTable', 'formatTable', tiles(O.formatTable, (v) => <TableStyleGlyph color={TABLE_COLORS[v]?.[0] ?? '#2867d1'} light={TABLE_COLORS[v]?.[1]} />), <Table2 size={ICON} />, { tiles: 3 })
/** Hojas: los menús de «Celdas» (insertar, eliminar, formato), como en Excel. */
const CELLS: Tool[] = [
  MENU('cellsInsert', 'rows', Object.entries(O.cellsInsert).map(([command, label]) => ({ value: '', label, command, icon: command === 'rows' ? <BetweenHorizontalStart size={15} /> : <BetweenVerticalStart size={15} /> })), <BetweenHorizontalStart size={ICON} />),
  MENU('cellsDelete', 'deleteRows', Object.entries(O.cellsDelete).map(([command, label]) => ({ value: '', label, command, icon: command === 'deleteRows' ? <Rows3 size={15} /> : <Columns3 size={15} /> })), <ListX size={ICON} />),
  MENU(
    'cellsFormat',
    'cells',
    [
      { value: '', label: O.cellsFormat.size, heading: true },
      { value: '', label: O.cellsFormat.rowHeight, command: 'rowHeight', icon: <MoveVertical size={15} /> },
      { value: 'autoHeight', label: O.cellsFormat.autoHeight, icon: <UnfoldVertical size={15} /> },
      { value: '', label: O.cellsFormat.columnWidth, command: 'columnWidth', icon: <ArrowLeftToLine size={15} /> },
      { value: 'autoWidth', label: O.cellsFormat.autoWidth, icon: <ChevronsUpDown size={15} style={{ transform: 'rotate(90deg)' }} /> },
      { value: '', label: O.cellsFormat.visibility, heading: true },
      { value: 'hideRows', label: O.cellsFormat.hideRows, icon: <EyeOff size={15} /> },
      { value: 'showRows', label: O.cellsFormat.showRows, icon: <Eye size={15} /> },
      { value: 'hideColumns', label: O.cellsFormat.hideColumns, icon: <EyeOff size={15} /> },
      { value: 'showColumns', label: O.cellsFormat.showColumns, icon: <Eye size={15} /> }
    ],
    <Rows3 size={ICON} />
  )
]
const SUM_MENU = MENU(
  'sumMenu',
  'func',
  [
    { value: 'SUM', label: O.autoSum.SUM, command: 'sum', icon: <Sigma size={15} /> },
    { value: 'AVERAGE', label: O.autoSum.AVERAGE, icon: <Calculator size={15} /> },
    { value: 'COUNT', label: O.autoSum.COUNT, icon: <Hash size={15} /> },
    { value: 'MAX', label: O.autoSum.MAX, icon: <ArrowUpNarrowWide size={15} /> },
    { value: 'MIN', label: O.autoSum.MIN, icon: <ArrowDownWideNarrow size={15} /> },
    { value: '', label: O.autoSum.more, command: 'insertFunction', action: true, icon: <SquareFunction size={15} /> }
  ],
  <Sigma size={ICON} />,
  { caption: true }
)
const SORT_MENU = MENU(
  'sortMenu',
  'sort',
  [
    { value: 'asc', label: T.sortAsc, icon: <ArrowUpNarrowWide size={15} /> },
    { value: 'desc', label: T.sortDesc, icon: <ArrowDownWideNarrow size={15} /> },
    { value: '', label: T.filter, command: 'filter', icon: <Filter size={15} /> },
    { value: '', label: O.sort.clearFilter, command: 'filterClear', icon: <FilterX size={15} /> }
  ],
  <ArrowUpDown size={ICON} />,
  { caption: true }
)
const SORT_FILTER: Tool[] = [
  B('sortAsc', 'sort', { value: 'asc', icon: <ArrowUpNarrowWide size={ICON} /> }),
  B('sortDesc', 'sort', { value: 'desc', icon: <ArrowDownWideNarrow size={ICON} /> }),
  B('filter', 'filter', { icon: <Filter size={ICON} />, caption: true, active: (s) => s.filter })
]
const SUM = B('sum', 'sum', { icon: <Sigma size={ICON} />, caption: true })
const CLEAR = MENU('clear', 'clear', rows(O.clear, { all: <Eraser size={15} />, contents: <Type size={15} />, formats: <RemoveFormatting size={15} />, links: <Link size={15} /> }), <Eraser size={ICON} />)
const CHART_ICONS: Record<string, ReactNode> = {
  columns: <ChartColumn size={20} />,
  lines: <ChartLine size={20} />,
  pie: <ChartPie size={20} />,
  bars: <ChartBar size={20} />,
  area: <ChartArea size={20} />,
  scatter: <ChartScatter size={20} />
}
const FREEZE = MENU(
  'freezeMenu',
  'freezePanes',
  [
    { value: 'panes', label: O.freeze.panes, icon: <Snowflake size={15} /> },
    { value: 'row', label: O.freeze.row, icon: <PanelTop size={15} /> },
    { value: 'col', label: O.freeze.col, icon: <PanelRight size={15} style={{ transform: 'scaleX(-1)' }} /> },
    { value: 'none', label: O.freeze.none, icon: <X size={15} />, action: true }
  ],
  <Snowflake size={ICON} />,
  { caption: true }
)

const cell: AppConfig = {
  kind: 'cell',
  panel: true,
  sheetTabs: true,
  toolbar: 'docked',
  header: [
    { key: 'savePdf', command: 'savePdf' },
    { key: 'save', command: 'save' }
  ],
  modes: [
    {
      id: 'home',
      label: M.home,
      icon: <House size={19} />,
      names: [N.letter, N.format, N.alignment, N.number, N.styles, N.cells, N.editing, N.find],
      groups: [
        [...LETTER, ...GROW],
        [BOLD, ITALIC, UNDERLINE, TEXT_COLOR, { type: 'color', key: 'fill', icon: <PaintBucket size={ICON} />, swatch: (s) => s.fill, none: true, defaultColor: '#fff2cc' }, CELL_BORDERS],
        [CELL_ALIGN, VALIGN, TEXT_ANGLE, B('wrap', 'wrap', { icon: <WrapText size={ICON} />, active: (s) => s.wrap }), MERGE],
        [NUMBER_FORMAT, B('currency', 'currency', { icon: <Euro size={ICON} />, active: (s) => s.numberFormat === 'currency' }), B('percent', 'percent', { icon: <Percent size={ICON} />, active: (s) => s.numberFormat === 'percent' }), B('fewerDecimals', 'fewerDecimals', { icon: <span className="glyph">,0</span> }), B('moreDecimals', 'moreDecimals', { icon: <span className="glyph">,00</span> })],
        [CONDITIONAL, FORMAT_TABLE],
        CELLS,
        [SUM_MENU, SORT_MENU, CLEAR, PAINTER],
        FIND
      ]
    },
    {
      id: 'insert',
      label: M.insert,
      icon: <SquarePlus size={19} />,
      names: [N.cells, N.charts, N.objects],
      groups: [
        [B('rows', 'rows', { icon: <BetweenHorizontalStart size={ICON} />, caption: true }), B('columns', 'columns', { icon: <BetweenVerticalStart size={ICON} />, caption: true })],
        [
          B('columnChart', 'chart', { value: 'columns', icon: <ChartColumn size={ICON} />, caption: true }),
          B('lineChart', 'chart', { value: 'lines', icon: <ChartLine size={ICON} />, caption: true }),
          B('pieChart', 'chart', { value: 'pie', icon: <ChartPie size={ICON} />, caption: true }),
          MENU('moreCharts', 'chart', tiles(O.moreCharts, (v) => CHART_ICONS[v]), <ChartBar size={ICON} />, { tiles: 3 })
        ],
        [B('image', 'image', { icon: <Image size={ICON} />, caption: true }), LINK]
      ]
    },
    {
      id: 'formulas',
      label: M.formulas,
      icon: <SquareFunction size={19} />,
      names: [N.functions, N.quick],
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
      names: [N.sort, N.tools],
      groups: [SORT_FILTER, [B('removeDuplicates', 'removeDuplicates', { icon: <CopyMinus size={ICON} />, caption: true }), B('validation', 'validationList', { icon: <ListChecks size={ICON} />, caption: true })]]
    },
    {
      id: 'pageLayout',
      label: M.layout,
      icon: <LayoutTemplate size={19} />,
      names: [N.page, N.print],
      groups: [
        [
          MENU('pageOrient', 'pageOrient', tiles(O.pageOrient, (v) => <PageGlyph landscape={v === 'landscape'} margin={0.1} />), <RectangleVertical size={ICON} />, { caption: true, tiles: 2 }),
          MENU('paperSize', 'paperSize', tiles(O.paperSize, (v) => <SizeGlyph width={PAPER[v]?.[0] ?? 210} height={PAPER[v]?.[1] ?? 297} />), <Proportions size={ICON} />, { caption: true, tiles: 4 })
        ],
        [
          MENU('fitTo', 'fitTo', rows(O.fitTo, { none: <Maximize size={15} />, width: <Columns3 size={15} />, page: <Shrink size={15} /> }), <Shrink size={ICON} />, { caption: true }),
          MENU('printArea', 'printArea', rows(O.printArea, { set: <Printer size={15} />, clear: <X size={15} /> }), <Printer size={ICON} />, { caption: true })
        ]
      ]
    },
    {
      id: 'view',
      label: M.view,
      icon: <Eye size={19} />,
      names: [N.show, N.panels],
      groups: [
        [
          FREEZE,
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

// ---------------------------------------------------------- Presentaciones

/** Presentaciones: la forma seleccionada (relleno, contorno, organizar, alinear). */
const ARRANGE: Tool[] = [
  MENU('arrange', 'arrange', rows(O.arrange, { front: <BringToFront size={15} />, forward: <Layers size={15} />, backward: <Layers size={15} style={{ opacity: 0.6 }} />, back: <SendToBack size={15} />, group: <Group size={15} />, ungroup: <Ungroup size={15} /> }), <Layers size={ICON} />, { caption: true }),
  MENU(
    'alignShapes',
    'alignShapes',
    tiles(O.alignShapes, (v) =>
      (({
        left: <AlignStartVertical size={20} />,
        center: <AlignHorizontalJustifyCenter size={20} />,
        right: <AlignEndVertical size={20} />,
        top: <AlignStartHorizontal size={20} />,
        middle: <AlignVerticalJustifyCenter size={20} />,
        bottom: <AlignEndHorizontal size={20} />,
        distributeH: <AlignHorizontalDistributeCenter size={20} />,
        distributeV: <AlignVerticalDistributeCenter size={20} />
      }) as Record<string, ReactNode>)[v]
    ),
    <AlignHorizontalJustifyCenter size={ICON} />,
    { caption: true, tiles: 4 }
  )
]
/** Los diseños de la presentación, con su miniatura: para una diapositiva nueva o para cambiar la actual. */
const layoutOptions = (s: EditorState): MenuOption[] =>
  s.layouts.map((l) => ({ value: String(l.index), label: l.name || String(l.index + 1), preview: /^data:image\//.test(l.image) ? <img className="glyph-layout" src={l.image} alt="" /> : <span className="glyph-layout" /> }))
const NEW_SLIDE = MENU('newSlide', 'newSlideLayout', layoutOptions, <Presentation size={ICON} />, { caption: true, tiles: 3 })
const LAYOUT = MENU('layoutMenu', 'layout', layoutOptions, <LayoutTemplate size={ICON} />, { tiles: 3 })
/** Los temas, con su miniatura (la del editor: sdkjs/slide/themes/themeN/). */
const THEMES = MENU(
  'themeMenu',
  'theme',
  (s) => s.themes.map((t) => ({ value: String(t.id), label: t.name, preview: t.url ? <img className="glyph-theme" src={`/sdkjs/slide/themes${t.url}thumbnail@2x.png`} alt="" loading="lazy" /> : <span className="glyph-theme" /> })),
  <Palette size={ICON} />,
  { caption: true, tiles: 3, current: (s) => String(s.activeTheme) }
)

const slide: AppConfig = {
  kind: 'slide',
  panel: false,
  sheetTabs: false,
  toolbar: 'floating',
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
      names: [N.slides, N.letter, N.format, N.paragraph, N.drawing, N.arrange, N.moreFormat, N.tools],
      groups: [
        [NEW_SLIDE, LAYOUT, B('duplicateSlide', 'duplicateSlide', { icon: <Copy size={ICON} /> }), B('deleteSlide', 'deleteSlide', { icon: <Trash2 size={ICON} /> })],
        LETTER,
        [BOLD, ITALIC, UNDERLINE, TEXT_COLOR],
        [ALIGN_MENU, listMenu('slide')],
        [{ ...SHAPES_MENU, caption: false } as Tool, B('image', 'image', { icon: <Image size={ICON} /> }), B('textBox', 'textBox', { icon: <Type size={ICON} /> })],
        ARRANGE.map((t) => ({ ...t, caption: false }) as Tool),
        [STRIKE, ...SCRIPT, CASE, ...GROW, CLEAR_FORMAT],
        [PAINTER, ...FIND]
      ]
    },
    {
      id: 'insert',
      label: M.insert,
      icon: <SquarePlus size={19} />,
      names: [N.objects, N.links, N.headerFooter],
      groups: [
        [
          B('textBox', 'textBox', { icon: <Type size={ICON} />, caption: true }),
          SHAPES_MENU,
          B('image', 'image', { icon: <Image size={ICON} />, caption: true }),
          tableMenu(),
          MENU('chart', 'chart', tiles(O.slideCharts, (v) => CHART_ICONS[v]), <ChartColumn size={ICON} />, { caption: true, tiles: 4 })
        ],
        [LINK, B('symbol', 'symbol', { icon: <Omega size={ICON} />, caption: true })],
        [B('slideFooter', 'slideFooter', { icon: <PanelBottom size={ICON} />, caption: true })]
      ]
    },
    {
      id: 'design',
      label: M.design,
      icon: <Palette size={19} />,
      names: [N.themes, N.size, N.background],
      groups: [
        [THEMES, { ...LAYOUT, caption: true } as Tool],
        [MENU('slideSize', 'slideSize', tiles(O.slideSize, (v) => (v === 'wide' ? <SizeGlyph width={16} height={9} /> : <SizeGlyph width={4} height={3} />)), <Ratio size={ICON} />, { caption: true, tiles: 2 })],
        [{ type: 'color', key: 'background', icon: <PaintBucket size={ICON} />, swatch: () => null, none: true }, B('backgroundAll', 'backgroundAll', { icon: <CopyCheck size={ICON} />, caption: true })]
      ]
    },
    {
      id: 'transitions',
      label: M.transitions,
      icon: <Clapperboard size={19} />,
      names: [N.transition, N.preview, N.animation],
      groups: [
        [
          MENU(
            'transition',
            'transition',
            Object.entries(O.transition).map(([value, label]) => ({ value, label, preview: <span className={`glyph-transition t-${value}`}><i /></span> })),
            <Clapperboard size={ICON} />,
            { caption: true, tiles: 3, current: (s) => s.transition }
          ),
          MENU('duration', 'duration', rows(O.duration, { '500': <Timer size={15} />, '700': <Timer size={15} />, '1000': <Clock size={15} />, '2000': <Clock size={15} /> }), <Timer size={ICON} />, { caption: true, current: (s) => String(s.transitionMs) })
        ],
        [B('transitionPreview', 'transitionPreview', { icon: <Play size={ICON} />, caption: true }), B('transitionAll', 'transitionAll', { icon: <CopyCheck size={ICON} />, caption: true })],
        [MENU('animation', 'animation', Object.entries(O.animation).map(([value, label]) => ({ value, label, preview: <span className={`glyph-transition a-${value}`}><i /></span> })), <Sparkle size={ICON} />, { caption: true, tiles: 4 })]
      ]
    },
    {
      id: 'present',
      label: M.present,
      icon: <Play size={19} />,
      names: [N.present, N.show],
      groups: [
        [B('fromStart', 'present', { icon: <Play size={ICON} />, caption: true }), B('fromHere', 'present', { value: 'here', icon: <Play size={ICON} />, caption: true })],
        [B('hideSlide', 'hideSlide', { icon: <EyeOff size={ICON} />, caption: true, active: (s) => s.slideHidden }), B('notes', 'notes', { icon: <StickyNote size={ICON} />, caption: true, active: (s) => s.notes })]
      ]
    },
    {
      id: 'shape',
      label: M.shape,
      icon: <Shapes size={19} />,
      context: 'shape',
      names: [N.format, N.arrange],
      groups: [
        [
          { type: 'color', key: 'shapeFill', icon: <PaintBucket size={ICON} />, swatch: (s) => s.shapeFill, none: true },
          { type: 'color', key: 'shapeLine', icon: <PenLine size={ICON} />, swatch: (s) => s.lineColor, none: true },
          MENU('lineWidth', 'lineWidth', Object.entries(O.lineWidth).map(([value, label]) => ({ value, label, icon: <LineWidthGlyph width={Number(value)} /> })), <Minus size={ICON} />, { current: (s) => String(s.lineWidth) })
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
      names: [N.arrange],
      groups: [ARRANGE]
    }
  ],
  extra: [
    { label: T.bullets, group: G.format, keywords: L.office.keywords.bullets, command: 'bullets' },
    { label: T.numbers, group: G.format, keywords: L.office.keywords.numbers, command: 'numbers' },
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
 * Avanzado (la pestaña Programador de Office; se activa en Ajustes): los
 * controles de formulario de Word y «Solo rellenar» en Documentos; validar
 * datos, bloquear celdas y proteger la hoja en Hojas; y «Mis scripts» en las
 * tres (en Presentaciones, la pestaña es «Scripts»).
 */
const SCRIPTS = B('scripts', 'scripts', { icon: <SquareTerminal size={ICON} />, caption: true, active: (s) => s.scriptsOpen })
function developerMode(groups: Tool[][], names: string[]): Mode {
  return { id: 'developer', label: M.developer, icon: <Code size={19} />, groups: [...groups, [SCRIPTS]], names: [...names, N.scripts] }
}
word.modes.push(
  developerMode(
    [
      [
        B('ccText', 'control', { value: 'text', icon: <TextCursorInput size={ICON} />, caption: true }),
        B('ccRich', 'control', { value: 'rich', icon: <Pilcrow size={ICON} /> }),
        B('ccCheck', 'control', { value: 'check', icon: <SquareCheck size={ICON} />, caption: true }),
        B('ccList', 'control', { value: 'list', icon: <ChevronsUpDown size={ICON} />, caption: true }),
        B('ccCombo', 'control', { value: 'combo', icon: <ListPlus size={ICON} /> }),
        B('ccDate', 'control', { value: 'date', icon: <CalendarDays size={ICON} />, caption: true }),
        B('ccPicture', 'control', { value: 'picture', icon: <Image size={ICON} /> })
      ],
      [B('ccProps', 'controlAsk', { icon: <SlidersHorizontal size={ICON} />, caption: true, disabled: (s) => !s.control }), B('ccRemove', 'controlRemove', { icon: <Eraser size={ICON} />, disabled: (s) => !s.control })],
      [B('formsOnly', 'formsOnlyAsk', { icon: <Lock size={ICON} />, caption: true, active: (s) => s.formsOnly })]
    ],
    [N.controls, N.control, N.protect]
  )
)
cell.modes.push(
  developerMode(
    [
      [B('validate', 'validateAsk', { icon: <ListChecks size={ICON} />, caption: true }), B('validation', 'validationList', { icon: <ChevronsUpDown size={ICON} /> }), B('validateClear', 'validate', { value: '{"type":"none"}', icon: <ListX size={ICON} /> })],
      [B('lockCells', 'lockCells', { icon: <Lock size={ICON} /> }), B('unlockCells', 'unlockCells', { icon: <LockOpen size={ICON} /> })],
      [B('protectSheet', 'protectSheetAsk', { icon: <ShieldCheck size={ICON} />, caption: true, active: (s) => s.sheetProtected })]
    ],
    [N.validation, N.cells, N.protect]
  )
)
// En Presentaciones solo hay scripts: la pestaña se llama así.
slide.modes.push({ id: 'developer', label: M.scripts, icon: <SquareTerminal size={19} />, groups: [[SCRIPTS]], names: [N.scripts] })

// Lo que añaden las funciones de cada app (features/): botones en las pestañas y pestañas nuevas.
for (const [kind, config] of [
  ['word', word],
  ['cell', cell],
  ['slide', slide]
] as const) {
  for (const feature of FEATURES[kind]) {
    for (const [modeId, addition] of Object.entries(feature.tools ?? {})) {
      const mode = config.modes.find((m) => m.id === modeId)
      if (!mode) continue
      const at = addition.at ?? mode.groups.length
      mode.groups.splice(at, 0, ...addition.groups)
      mode.names = mode.names ?? mode.groups.map(() => '')
      mode.names.splice(at, 0, ...(addition.names ?? addition.groups.map(() => '')))
    }
    // Las pestañas nuevas, antes de «Revisar».
    for (const mode of feature.modes ?? []) {
      const review = config.modes.findIndex((m) => m.id === 'review')
      config.modes.splice(review < 0 ? config.modes.length : review, 0, mode)
    }
    config.extra.push(...(feature.palette ?? []))
  }
}

export const APPS: Record<OfficeKind, AppConfig> = { word, cell, slide }

/** Las opciones de un desplegable ahora (las de los diseños y temas dependen del documento). */
export function optionsOf(tool: Extract<Tool, { type: 'menu' }>, state: EditorState | null): MenuOption[] {
  return typeof tool.options === 'function' ? (state ? tool.options(state) : []) : tool.options
}

/** El nombre de una herramienta: el suyo o el de la lista de herramientas. */
function nameOf(tool: { key: string; label?: string }): string {
  return tool.label ?? (T as Record<string, string>)[tool.key] ?? tool.key
}

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
          if (typeof tool.options === 'function') continue
          for (const option of tool.options) {
            if (option.heading) continue
            add({ label: `${nameOf(tool)}: ${option.label}`, group: mode.label, keywords: '', command: option.command ?? tool.command, value: option.value })
          }
          continue
        }
        if (tool.type !== 'button') continue
        add({
          label: nameOf(tool),
          group: mode.label,
          keywords: (L.office.keywords as Record<string, string>)[tool.key] ?? '',
          command: tool.command,
          value: tool.value
        })
      }
    }
  }
  for (const entry of [...app.extra, ...COMMON_EXTRA]) add(entry)
  return out
}
