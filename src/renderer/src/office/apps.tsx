/**
 * Lo que tiene cada app: modos, herramientas de cada modo, botones de la
 * cabecera y órdenes del buscador. Solo nombres de órdenes de Molino (engine.ts
 * las traduce al editor); nada de aquí conoce ONLYOFFICE. Viene de
 * ``prototipo\ventana\interfaz\apps.js``.
 */
import {
  AlignCenter,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  FileDiff,
  ListX,
  MessageSquarePlus,
  X,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Baseline,
  BetweenHorizontalStart,
  BetweenVerticalStart,
  Bold,
  ChartColumn,
  ChartLine,
  ChartPie,
  Copy,
  Euro,
  Filter,
  GalleryVerticalEnd,
  Grid3x3,
  Image,
  Italic,
  LayoutTemplate,
  List,
  ListOrdered,
  PaintBucket,
  Paintbrush,
  PenLine,
  Percent,
  Pilcrow,
  Play,
  Presentation,
  RectangleHorizontal,
  RectangleVertical,
  Redo2,
  RemoveFormatting,
  SeparatorHorizontal,
  Shapes,
  Sigma,
  SquarePlus,
  Strikethrough,
  Table,
  Table2,
  TableCellsMerge,
  Trash2,
  Type,
  Underline,
  Undo2,
  WrapText
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { OfficeKind } from '@shared/officeui'
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
  | { type: 'color'; key: 'color' | 'fill'; icon: ReactNode; swatch: (s: EditorState) => string | null }

export interface Mode {
  id: string
  label: string
  icon: ReactNode
  groups: Tool[][]
}

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
      id: 'write',
      label: M.write,
      icon: <PenLine size={19} />,
      groups: [UNDO, [{ type: 'style' }], LETTER, FORMAT, ALIGN, LISTS, [B('clearFormat', 'clearFormat', { icon: <RemoveFormatting size={ICON} /> })]]
    },
    {
      id: 'insert',
      label: M.insert,
      icon: <SquarePlus size={19} />,
      groups: [
        [
          B('table', 'table', { value: '3x3', icon: <Table size={ICON} />, caption: true }),
          B('image', 'image', { icon: <Image size={ICON} />, caption: true }),
          B('pageBreak', 'pageBreak', { icon: <SeparatorHorizontal size={ICON} />, caption: true })
        ]
      ]
    },
    {
      id: 'layout',
      label: M.layout,
      icon: <LayoutTemplate size={19} />,
      groups: [
        [
          B('portrait', 'portrait', { icon: <RectangleVertical size={ICON} />, caption: true, active: (s) => s.portrait }),
          B('landscape', 'landscape', { icon: <RectangleHorizontal size={ICON} />, caption: true, active: (s) => !s.portrait })
        ],
        [B('marks', 'marks', { icon: <Pilcrow size={ICON} />, caption: true, active: (s) => s.marks })]
      ]
    }
  ],
  extra: [
    ...Object.entries(L.office.styles).map(([style, label]) => ({ label, group: G.style, keywords: L.office.keywords.style, command: 'style', value: style })),
    { label: T.table2, group: G.insert, keywords: L.office.keywords.table, command: 'table', value: '2x2' },
    { label: T.table4, group: G.insert, keywords: L.office.keywords.table, command: 'table', value: '4x4' }
  ]
}

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
      id: 'data',
      label: M.data,
      icon: <Table2 size={19} />,
      groups: [
        UNDO,
        [
          B('currency', 'currency', { icon: <Euro size={ICON} />, active: (s) => s.numberFormat === 'currency' }),
          B('percent', 'percent', { icon: <Percent size={ICON} />, active: (s) => s.numberFormat === 'percent' }),
          B('fewerDecimals', 'fewerDecimals', { icon: <span className="glyph">,0</span> }),
          B('moreDecimals', 'moreDecimals', { icon: <span className="glyph">,00</span> })
        ],
        [
          B('bold', 'bold', { icon: <Bold size={ICON} />, active: (s) => s.bold }),
          B('italic', 'italic', { icon: <Italic size={ICON} />, active: (s) => s.italic }),
          { type: 'color', key: 'color', icon: <Baseline size={ICON} />, swatch: (s) => s.color },
          { type: 'color', key: 'fill', icon: <PaintBucket size={ICON} />, swatch: (s) => s.fill },
          B('borders', 'borders', { icon: <Grid3x3 size={ICON} /> })
        ],
        [
          B('sum', 'sum', { icon: <Sigma size={ICON} />, caption: true }),
          B('sortAsc', 'sort', { value: 'asc', icon: <ArrowUpNarrowWide size={ICON} /> }),
          B('sortDesc', 'sort', { value: 'desc', icon: <ArrowDownWideNarrow size={ICON} /> }),
          B('filter', 'filter', { icon: <Filter size={ICON} />, caption: true, active: (s) => s.filter }),
          B('columnChart', 'chart', { value: 'columns', icon: <ChartColumn size={ICON} /> })
        ]
      ]
    },
    {
      id: 'format',
      label: M.format,
      icon: <Paintbrush size={19} />,
      groups: [
        UNDO,
        LETTER,
        [
          B('bold', 'bold', { icon: <Bold size={ICON} />, active: (s) => s.bold }),
          B('italic', 'italic', { icon: <Italic size={ICON} />, active: (s) => s.italic }),
          B('underline', 'underline', { icon: <Underline size={ICON} />, active: (s) => s.underline })
        ],
        ALIGN.slice(0, 3),
        [
          B('wrap', 'wrap', { icon: <WrapText size={ICON} />, caption: true, active: (s) => s.wrap }),
          B('merge', 'merge', { icon: <TableCellsMerge size={ICON} />, caption: true })
        ]
      ]
    },
    {
      id: 'insert',
      label: M.insert,
      icon: <SquarePlus size={19} />,
      groups: [
        [
          B('rows', 'rows', { icon: <BetweenHorizontalStart size={ICON} />, caption: true }),
          B('columns', 'columns', { icon: <BetweenVerticalStart size={ICON} />, caption: true }),
          B('lineChart', 'chart', { value: 'lines', icon: <ChartLine size={ICON} />, caption: true }),
          B('pieChart', 'chart', { value: 'pie', icon: <ChartPie size={ICON} />, caption: true }),
          B('image', 'image', { icon: <Image size={ICON} />, caption: true })
        ]
      ]
    }
  ],
  extra: [{ label: T.newSheet, group: G.sheets, keywords: L.office.keywords.newSheet, command: 'newSheet' }]
}

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
      id: 'slides',
      label: M.slides,
      icon: <GalleryVerticalEnd size={19} />,
      groups: [
        UNDO,
        [
          B('newSlide', 'newSlide', { icon: <Presentation size={ICON} />, caption: true }),
          B('duplicateSlide', 'duplicateSlide', { icon: <Copy size={ICON} /> }),
          B('deleteSlide', 'deleteSlide', { icon: <Trash2 size={ICON} /> })
        ],
        LETTER,
        FORMAT,
        ALIGN.slice(0, 3),
        [
          B('textBox', 'textBox', { icon: <Type size={ICON} /> }),
          B('shape', 'shape', { value: 'roundRect', icon: <Shapes size={ICON} /> }),
          B('image', 'image', { icon: <Image size={ICON} /> })
        ]
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
        ]
      ]
    }
  ],
  extra: [
    ...LISTS.flatMap((t) => (t.type === 'button' ? [{ label: T[t.key], group: G.format, keywords: L.office.keywords[t.key as keyof typeof L.office.keywords] ?? '', command: t.command }] : [])),
    { label: T.fit, group: G.view, keywords: L.office.keywords.fit, command: 'fit' }
  ]
}

word.modes.push(reviewMode(true))
cell.modes.push(reviewMode(false))
slide.modes.push(reviewMode(false))

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
