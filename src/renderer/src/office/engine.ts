/**
 * La capa entre la interfaz de Molino y los editores de ONLYOFFICE.
 *
 * Es lo ÚNICO que conoce la API de los editores. La interfaz pide órdenes con
 * nombres de Molino (``session.run('bold')``) y lee un estado de Molino
 * (``session.state.bold``). Cambiar o actualizar el motor de oficina toca solo
 * este archivo. Viene de ``prototipo\ventana\interfaz\motor.js``.
 *
 * Cada pestaña es un marco (frame.html) donde la API de los editores crea el
 * suyo; aquí se espera a que ese marco cargue y se usa su ``Asc.editor``. Es del
 * mismo origen (molino://office), así que se accede directamente.
 */
import type { OfficeKind } from '@shared/officeui'
import { FEATURES } from './features'
import type { FeatureContext } from './features/types'

/** La API de los editores no tiene tipos: todo lo que viene de ella es «any». */
type Api = any
/**
 * La API de documentos del editor («builder»): solo existe dentro de las funciones
 * que se le pasan como texto (ver EditorSession.builder).
 */
declare const Api: any

export type Align = 'left' | 'center' | 'right' | 'justify'

/** Un comentario del documento, como lo enseña Molino. */
export interface CommentInfo {
  id: string
  author: string
  /** Fecha ya escrita en el idioma del editor. */
  date: string
  /** El texto comentado (vacío si es de todo el documento). */
  quote: string
  text: string
  resolved: boolean
  replies: { id: string; author: string; date: string; text: string }[]
}

export interface EditorState {
  ready: boolean
  modified: boolean
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
  align: Align
  style: string
  font: string
  /** Las fuentes que tiene el editor: las del equipo y las de la pieza. */
  fonts: string[]
  size: number
  color: string
  fill: string | null
  canUndo: boolean
  canRedo: boolean
  list: 'none' | 'bullets' | 'numbers'
  portrait: boolean
  marks: boolean
  zoom: number
  page: number
  pages: number
  // Hojas
  numberFormat: 'general' | 'currency' | 'percent'
  filter: boolean
  wrap: boolean
  selection: { name: string; sum: string; average: string; count: string; max: string; min: string }
  sheets: { index: number; name: string; color: string }[]
  activeSheet: number
  /** Vista de la hoja: paneles inmovilizados, líneas de cuadrícula, encabezados. */
  frozen: boolean
  gridlines: boolean
  headings: boolean
  // Presentaciones
  themes: { id: number; name: string; url?: string }[]
  activeTheme: number
  layouts: { index: number; name: string; image: string }[]
  /** Las notas del orador, debajo de la diapositiva. */
  notes: boolean
  // Revisar
  comments: CommentInfo[]
  /** Control de cambios encendido (solo Documentos). */
  track: boolean
  /** Lo seleccionado que tiene su pestaña de contexto (tabla, imagen, forma, gráfico). */
  objects: ('table' | 'image' | 'shape' | 'chart')[]
  // Formato del texto (Documentos y Presentaciones)
  superscript: boolean
  subscript: boolean
  /** Color de resaltado del texto (null: sin resaltar). */
  highlight: string | null
  /** «Copiar formato» encendido. */
  painting: boolean
  /** Buscar: el resultado actual (desde 1) y cuántos hay; null si no se ha buscado. */
  search: { current: number; total: number } | null
  /** Hojas ocultas del libro (para «Mostrar»). */
  hiddenSheets: { index: number; name: string }[]
  // Presentaciones: la diapositiva y la forma seleccionadas
  slideHidden: boolean
  /** Transición de la diapositiva (none, fade…) y su duración en milisegundos. */
  transition: string
  transitionMs: number
  shapeFill: string | null
  lineColor: string | null
  /** Grosor del contorno, en puntos. */
  lineWidth: number
  /** El panel lateral abierto (lo pone la ventana, no el editor). */
  sidePanel: boolean
  /** Documentos: los estilos de párrafo propios del documento (los de fábrica ya están en la galería). */
  customStyles: string[]
  /** Lo de las funciones de features/ (cada una, sus claves). */
  extra: Record<string, unknown>
  /** El panel «Mis scripts» abierto (lo pone la ventana). */
  scriptsOpen: boolean
  /** Sube con cada cambio del documento (para volver a contar las palabras). */
  edits: number
  /** Documentos: el control de contenido donde está el cursor (su tipo), o null. */
  control: ControlType | null
  /** Documentos: protegido para que solo se puedan rellenar los controles. */
  formsOnly: boolean
  /** Hojas: la hoja está protegida. */
  sheetProtected: boolean
}

/** Los controles de contenido de Word (pestaña Programador). */
export type ControlType = 'text' | 'rich' | 'check' | 'combo' | 'list' | 'date' | 'picture'

/** Lo que se puede cambiar de un control de contenido (su cuadro de Propiedades). */
export interface ControlInfo {
  type: ControlType
  title: string
  tag: string
  placeholder: string
  /** 'none' | 'delete' (no se puede borrar) | 'edit' (no se puede cambiar el contenido) | 'both'. */
  lock: 'none' | 'delete' | 'edit' | 'both'
  /** Las opciones de una lista o un cuadro combinado. */
  items: string[]
  /** El formato de una fecha (p. ej. dd/MM/yyyy). */
  dateFormat: string
}

/** Lo que devuelve un script del usuario. */
export interface ScriptOutcome {
  ok: boolean
  output: string[]
  error: string
}

function initialState(): EditorState {
  return {
    scriptsOpen: false,
    edits: 0,
    control: null,
    formsOnly: false,
    sheetProtected: false,
    ready: false,
    modified: false,
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    align: 'left',
    style: 'Normal',
    font: '',
    fonts: [],
    size: 11,
    color: '#000000',
    fill: null,
    canUndo: false,
    canRedo: false,
    list: 'none',
    portrait: true,
    marks: false,
    zoom: 100,
    page: 1,
    pages: 1,
    numberFormat: 'general',
    filter: false,
    wrap: false,
    selection: { name: '', sum: '', average: '', count: '', max: '', min: '' },
    sheets: [],
    activeSheet: 0,
    frozen: false,
    gridlines: true,
    headings: true,
    themes: [],
    activeTheme: -1,
    layouts: [],
    notes: true,
    comments: [],
    track: false,
    objects: [],
    superscript: false,
    subscript: false,
    highlight: null,
    painting: false,
    search: null,
    hiddenSheets: [],
    slideHidden: false,
    transition: 'none',
    transitionMs: 700,
    shapeFill: null,
    lineColor: null,
    lineWidth: 1,
    sidePanel: false,
    customStyles: [],
    extra: {}
  }
}

// Disposición de Documentos (en milímetros; márgenes: arriba, izquierda, abajo, derecha).
const MARGINS: Record<string, [number, number, number, number]> = {
  normal: [25, 30, 25, 30],
  narrow: [12.7, 12.7, 12.7, 12.7],
  moderate: [25.4, 19.1, 25.4, 19.1],
  wide: [25.4, 50.8, 25.4, 50.8]
}
const PAGE_SIZES: Record<string, [number, number]> = { a4: [210, 297], letter: [215.9, 279.4], a5: [148, 210], legal: [215.9, 355.6] }
// Constantes de los editores (las define su interfaz, no la API).
const LINERULE_AUTO = 1
const PAGE_NUM = { top: 0x01, bottom: 0x02, center: 2 }
/** Las funciones de «Fórmulas» (con el nombre que entiende el editor). */
const FUNCTIONS = new Set(['SUM', 'AVERAGE', 'COUNT', 'MAX', 'MIN'])
/** «Copiar formato»: AscCommon.c_oAscFormatPainterState. */
const PAINTER = { off: 0, on: 1, multiple: 2 }
/** Espaciado entre párrafos: puntos antes y después. */
const PARA_SPACING: Record<string, [number, number]> = { none: [0, 0], compact: [0, 4], normal: [0, 8], open: [6, 12], wide: [12, 18] }
/** Las formas que se pueden insertar (nombres de los editores, comprobados en su lista). */
export const SHAPE_NAMES = ['rect', 'roundRect', 'ellipse', 'triangle', 'rtTriangle', 'diamond', 'hexagon', 'star5', 'rightArrow', 'leftArrow', 'upArrow', 'downArrow', 'line', 'lineWithArrow', 'wedgeRectCallout', 'cloud', 'heart'] as const
const SHAPES = new Set<string>(SHAPE_NAMES)
/** Formatos de número de «Formato de número»: su lugar en la lista de asc_getFormatCells. */
const NUMBER_FORMATS: Record<string, number> = { general: 0, number: 1, scientific: 2, accounting: 3, currency: 4, shortDate: 5, longDate: 6, time: 7, percent: 8, fraction: 9, text: 10 }
const NUMBER_FALLBACK: Record<string, string> = { general: 'General', number: '0.00', scientific: '0.00E+00', accounting: '#,##0.00 €', currency: '#,##0.00 €', shortDate: 'dd/mm/yyyy', longDate: 'dddd, d mmmm yyyy', time: 'hh:mm:ss', percent: '0.00%', fraction: '# ?/?', text: '@' }
/** Formato condicional: los colores de «Resaltar» (texto y relleno, como en Excel). */
const CF_STYLES: Record<string, [string, string]> = { red: ['#9c0006', '#ffc7ce'], yellow: ['#9c5700', '#ffeb9c'], green: ['#006100', '#c6efce'] }
/** Separador de párrafos y celdas al sacar texto para la IA. */
const TEXT_OPTIONS = { Numbering: true, Math: false, ParaSeparator: '\n', TableCellSeparator: '\t', TableRowSeparator: '\n', NewLineSeparator: '\n', TabSymbol: '\t' }
/** AscCommon.c_oAscClipboardDataFormat.Text */
const PASTE_TEXT = 1

/** Un aviso del editor (los que su interfaz enseña con Common.UI.alert), para enseñarlo con el aspecto de Molino. */
export interface EditorNotice {
  title: string
  text: string
  buttons: { value: string; label: string; primary: boolean }[]
  answer: (value: string) => void
}

/** Lo que hay bajo el botón derecho, para el menú de Molino. */
export interface ContextInfo {
  x: number
  y: number
  /** Documentos: el clic fue en el encabezado o el pie (para «Editar encabezado»). */
  header?: 'header' | 'footer'
  page?: number
  /** La palabra mal escrita bajo el cursor y lo que propone el corrector. */
  spelling?: { word: string; variants: string[] }
}

const LISTS = {
  bullets:
    '{"Type":"bullet","Lvl":[{"lvlJc":"left","suff":"tab","numFmt":{"val":"bullet"},"lvlText":"·","rPr":{"rFonts":{"ascii":"Symbol","cs":"Symbol","eastAsia":"Symbol","hAnsi":"Symbol"}}}]}',
  numbers: '{"Type":"number","Lvl":[{"lvlJc":"left","suff":"tab","numFmt":{"val":"decimal"},"lvlText":"%1."}]}',
  none: '{"Type":"remove"}'
}

/** Un vínculo del cuadro de Molino: solo http, https y mailto (lo comprueba también OfficeApp). */
function parseLink(json: string | undefined): { text: string; url: string; tip: string } | null {
  try {
    const raw = JSON.parse(String(json ?? ''))
    const url = String(raw.url ?? '').trim().slice(0, 2000)
    if (!/^(https?:\/\/|mailto:)\S+$/i.test(url)) return null
    return { url, text: String(raw.text ?? url).slice(0, 500) || url, tip: String(raw.tip ?? '').slice(0, 500) }
  } catch {
    return null
  }
}

export class EditorSession {
  readonly state: EditorState = initialState()
  private ew: Api = null

  /** Cambia el tema del editor (claro u oscuro) sin volver a cargarlo, como hace ONLYOFFICE de escritorio. */
  setTheme(dark: boolean): void {
    const w = this.ew
    // Los colores de Molino (bridge.js) con el acento de ahora, y el editor los vuelve a leer al cambiar de tema.
    if (w && typeof w.molinoReskin === 'function') w.molinoReskin()
    if (w && typeof w.on_native_message === 'function') w.on_native_message('theme:changed', dark ? 'theme-dark' : 'theme-light')
  }
  private api: Api = null
  private readonly listeners = new Set<() => void>()
  private pending = 0
  private disposed = false
  private attached = false
  private watching = false
  /** Hojas: vuelve a leer la celda activa (formato, filtro…). */
  private rereadCell: () => void = () => undefined
  /** Documentos: recortando una imagen. */
  private cropping = false
  /** Documentos: lo que va contando el editor para «Contar palabras». */
  private docInfo: Record<string, number> = {}
  private statsDone: ((stats: Record<string, number>) => void) | null = null
  /** Lo que pide la interfaz cuando el editor quiere enseñar su menú o un aviso. */
  onContextMenu: (info: ContextInfo | null) => void = () => undefined
  /** Se ha soltado el ratón con texto seleccionado (dónde, en la ventana de Molino), o ya no hay selección. */
  onSelectionBar: (at: { x: number; y: number } | null) => void = () => undefined
  private statsRunning: Promise<Record<string, number>> | null = null
  onNotice: (notice: EditorNotice) => void = () => undefined
  /** La última palabra mal escrita bajo el cursor (para el menú del botón derecho). */
  private spellObject: Api = null

  constructor(
    readonly kind: OfficeKind,
    /** Lo que se nombra en las hojas nuevas («Hoja», «Sheet»). */
    private readonly sheetName: string
  ) {}

  /** Avisa cuando cambia el estado (varios avisos seguidos del editor, un solo aviso). */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private changed(): void {
    if (this.pending || this.disposed) return
    this.pending = requestAnimationFrame(() => {
      this.pending = 0
      for (const listener of this.listeners) listener()
    })
  }

  dispose(): void {
    this.disposed = true
    this.listeners.clear()
  }

  /**
   * Se llama cuando el marco de la pestaña ha cargado. Espera al marco del
   * editor que crea dentro y, cuando ha cargado, a su API. No se toca su
   * ventana antes de que cargue: tocarla mientras aún es about:blank hace que
   * Electron no le ponga el preload, y sin él el editor se queda sin puente.
   */
  attach(tab: HTMLIFrameElement): void {
    if (this.attached) return
    this.attached = true
    const findEditor = (): void => {
      if (this.disposed) return
      const frame = tab.contentDocument?.querySelector<HTMLIFrameElement>('iframe[name="frameEditor"]')
      if (!frame) return void setTimeout(findEditor, 40)
      const waitApi = (): void => {
        if (this.disposed) return
        const w = frame.contentWindow as Api
        const api = w && ((w.Asc && w.Asc.editor) || w.editor)
        if (!api || !api.asc_registerCallback) return void setTimeout(waitApi, 50)
        this.ew = w
        this.api = api
        this.listen()
        this.watchSelection(w)
      }
      // El «load» de la pestaña llega cuando ya ha cargado también el editor
      // que lleva dentro: entonces ya no hay «load» que esperar.
      let loaded = false
      try {
        const doc = frame.contentDocument
        loaded = Boolean(doc && doc.readyState === 'complete' && doc.location.href !== 'about:blank')
      } catch {
        loaded = false
      }
      if (loaded) waitApi()
      else frame.addEventListener('load', waitApi, { once: true })
    }
    findEditor()
  }

  /** La ventana del editor (para el teclado y las pruebas). */
  get editorWindow(): Window | null {
    return this.ew as Window | null
  }

  // -------------------------------------------------------------- órdenes

  private alignments(): Record<Align, number> {
    const A = this.ew.AscCommon
    return { left: A.align_Left, center: A.align_Center, right: A.align_Right, justify: A.align_Justify }
  }

  private alignName(value: number): Align {
    const found = Object.entries(this.alignments()).find(([, n]) => n === value)
    return (found?.[0] as Align | undefined) ?? 'left'
  }

  private hex(c: Api): string | null {
    if (!c || (c.get_auto && c.get_auto())) return null
    const rgb: number[] = c.get_r ? [c.get_r(), c.get_g(), c.get_b()] : [c.asc_getR(), c.asc_getG(), c.asc_getB()]
    return `#${rgb.map((x) => x.toString(16).padStart(2, '0')).join('')}`
  }

  private color(hex: string): Api {
    const n = parseInt(hex.slice(1), 16)
    const c = new this.ew.Asc.asc_CColor()
    c.put_type(this.ew.Asc.c_oAscColor.COLOR_TYPE_SRGB)
    c.put_r(n >> 16)
    c.put_g((n >> 8) & 255)
    c.put_b(n & 255)
    c.put_a(255)
    return c
  }

  private setList(which: 'bullets' | 'numbers'): void {
    // La lista se crea en la ventana del editor: con un objeto de esta, no hace nada (otro «realm»).
    this.api.put_ListTypeCustom(this.ew.JSON.parse(LISTS[this.state.list === which ? 'none' : which]))
  }

  /** Lo que las funciones de features/ usan del editor de esta pestaña. */
  featureContext(): FeatureContext {
    return {
      api: this.api,
      ew: this.ew,
      state: this.state,
      kind: this.kind,
      changed: () => this.changed(),
      color: (hex) => this.color(hex),
      local: (value) => this.ew.JSON.parse(JSON.stringify(value)),
      builder: (fn, data) => this.builder(fn, data)
    }
  }

  /** Las órdenes de las funciones de esta app (se crean una vez: guardan lo suyo, como la vista previa de un estilo). */
  private featureCommands: Record<string, (value?: string) => void> | null = null
  private features(): Record<string, (value?: string) => void> {
    if (!this.api) return {}
    if (!this.featureCommands) {
      const ctx = this.featureContext()
      this.featureCommands = Object.assign({}, ...FEATURES[this.kind].map((f) => f.commands?.(ctx) ?? {}))
    }
    return this.featureCommands ?? {}
  }

  private newSheetName(): string {
    const used = new Set(this.state.sheets.map((s) => s.name.toLowerCase()))
    let n = this.state.sheets.length + 1
    while (used.has(`${this.sheetName}${n}`.toLowerCase())) n++
    return `${this.sheetName}${n}`
  }

  /** «Hoja1 (2)», «Hoja1 (3)»…: el nombre de la copia de una hoja. */
  private copyName(name: string): string {
    const api = this.api
    const used = new Set<string>()
    for (let i = 0; i < api.asc_getWorksheetsCount(); i++) used.add(String(api.asc_getWorksheetName(i)).toLowerCase())
    for (let n = 2; n < 1000; n++) {
      const candidate = `${name.slice(0, 26)} (${n})`
      if (!used.has(candidate.toLowerCase())) return candidate
    }
    return this.newSheetName()
  }

  /** Superíndice, subíndice y mayúsculas: lo mismo en Documentos y en el texto de Presentaciones. */
  private textExtras(): Record<string, (value?: string) => void> {
    const api = this.api
    const s = this.state
    const A = this.ew.Asc
    return {
      superscript: () => api.put_TextPrBaseline(s.superscript ? A.vertalign_Baseline : A.vertalign_SuperScript),
      subscript: () => api.put_TextPrBaseline(s.subscript ? A.vertalign_Baseline : A.vertalign_SubScript),
      changeCase: (v) => {
        const C = A.c_oAscChangeTextCaseType
        const type = { sentence: C.SentenceCase, lower: C.LowerCase, upper: C.UpperCase, capitalize: C.CapitalizeWords, toggle: C.ToggleCase }[v ?? '']
        if (type !== undefined) api.asc_ChangeTextCase(type)
      }
    }
  }

  /** El vínculo donde está el cursor (Documentos y Presentaciones). */
  private linkElement(): Api | null {
    const T = this.ew.Asc.c_oAscTypeSelectElement
    try {
      for (const el of this.api.getSelectedElements() || []) if (el.get_ObjectType() === T.Hyperlink) return el.get_ObjectValue()
    } catch {
      return null
    }
    return null
  }

  private setLink(json: string | undefined): void {
    const link = parseLink(json)
    if (!link) return
    const props = new this.ew.Asc.CHyperlinkProperty()
    props.put_Value(link.url)
    props.put_Text(link.text)
    props.put_ToolTip(link.tip)
    if (this.linkElement()) this.api.change_Hyperlink(props)
    else this.api.add_Hyperlink(props)
  }

  private setCellLink(json: string): void {
    const link = parseLink(json)
    if (!link) return
    const props = new this.ew.Asc.asc_CHyperlink()
    props.asc_setType(this.ew.Asc.c_oAscHyperlinkType.WebLink)
    props.asc_setHyperlinkUrl(link.url)
    props.asc_setText(link.text)
    props.asc_setTooltip(link.tip)
    this.api.asc_insertHyperlink(props)
  }

  /** Documentos: bordes de las celdas seleccionadas de una tabla (todos, fuera, dentro, ninguno). */
  private tableBorders(which: string): void {
    const A = this.ew.Asc
    const letters = { all: 'lrtbcm', outside: 'lrtb', inside: 'cm', none: '' }[which]
    if (letters === undefined) return
    const side = (on: boolean): Api => {
      const border = new A.asc_CTextBorder()
      border.put_Value(on ? 1 : 0)
      if (on) {
        border.put_Size((0.5 * 25.4) / 72)
        border.put_Color(this.color('#000000'))
      }
      return border
    }
    const borders = new A.CBorders()
    const names: [string, string][] = [['l', 'Left'], ['r', 'Right'], ['t', 'Top'], ['b', 'Bottom'], ['c', 'InsideV'], ['m', 'InsideH']]
    for (const [letter, name] of names) {
      if (letters.includes(letter)) borders[`put_${name}`](side(true))
      else if (which === 'none') borders[`put_${name}`](side(false))
    }
    const props = new A.CTableProp()
    props.put_CellBorders(borders)
    props.put_CellSelect(true)
    this.api.tblApply(props)
  }

  /** Documentos: marca de agua de texto, en diagonal y semitransparente (o ninguna). */
  private watermark(value: string): void {
    const A = this.ew.Asc
    const props = this.api.asc_GetWatermarkProps()
    if (!props) return
    if (value === 'none') props.put_Type(A.c_oAscWatermarkType.None)
    else {
      const text = value.startsWith('text:') ? value.slice(5).trim().slice(0, 60) : ''
      if (!text) return
      props.put_Type(A.c_oAscWatermarkType.Text)
      props.put_Text(text)
      props.put_IsDiagonal(true)
      props.put_Opacity(128)
    }
    this.api.asc_SetWatermarkProps(props)
  }

  /** Un relleno de color liso (o sin relleno, con ''), para formas y fondos. */
  private solidFill(hex: string | undefined): Api {
    const A = this.ew.Asc
    const fill = new A.asc_CShapeFill()
    if (hex && /^#[0-9a-f]{6}$/i.test(hex)) {
      fill.put_type(A.c_oAscFill.FILL_TYPE_SOLID)
      fill.put_fill(new A.asc_CFillSolid())
      fill.get_fill().put_color(this.color(hex))
    } else {
      fill.put_type(A.c_oAscFill.FILL_TYPE_NOFILL)
      fill.put_fill(null)
    }
    return fill
  }

  /** Presentaciones: lo que hay en «Encabezado y pie» de la diapositiva actual. */
  slideFooter(): { number: boolean; date: boolean; footer: string } {
    try {
      const props = this.api.asc_getHeaderFooterProperties()?.get_Slide()
      if (props) return { number: !!props.get_ShowSlideNum(), date: !!props.get_ShowDateTime(), footer: String(props.get_Footer() ?? '') }
    } catch {
      /* sin propiedades */
    }
    return { number: false, date: false, footer: '' }
  }

  private setSlideFooter(json: string): void {
    let wanted: { number?: boolean; date?: boolean; footer?: string; all?: boolean }
    try {
      wanted = JSON.parse(json)
    } catch {
      return
    }
    const ew = this.ew
    const all = this.api.asc_getHeaderFooterProperties()
    const props = all.get_Slide() || new ew.AscCommonSlide.CAscHFProps()
    props.put_ShowSlideNum(Boolean(wanted.number))
    props.put_ShowDateTime(Boolean(wanted.date))
    const footer = String(wanted.footer ?? '').slice(0, 255)
    props.put_ShowFooter(footer.length > 0)
    props.put_Footer(footer)
    props.put_ShowOnTitleSlide(true)
    if (wanted.date) {
      const date = new ew.AscCommonSlide.CAscDateTime()
      date.put_Lang(this.api.asc_getDefaultLanguage?.() ?? 0x0c0a)
      date.put_DateTime('datetime1')
      props.put_DateTime(date)
    }
    all.put_Slide(props)
    this.api.asc_setHeaderFooterProperties(all, wanted.all !== false)
  }

  /**
   * Código del editor con su API de documentos («builder»): con un punto para
   * deshacer y el documento recalculado al acabar. La función se pasa como
   * texto: no puede usar nada de fuera salvo ``Api`` y ``Asc.scope.molino``.
   */
  private builder(fn: (scope: { molino: any }) => void, data: unknown): boolean {
    const api = this.api
    if (typeof api.native_callCommand !== 'function') return false
    this.ew.Asc.scope = { molino: data }
    api.native_callCommand(fn, this.ew.Asc.scope)
    return true
  }

  /** El texto de una diapositiva (con la API de documentos). */
  private static shapesText(slide: Api): string {
    const parts: string[] = []
    for (const shape of slide?.GetAllShapes?.() ?? []) {
      // Sin texto, no se pide (GetDocContent le crearía uno, fuera de un paso para deshacer).
      if (shape?.HasTextContent && !shape.HasTextContent()) continue
      const content = shape.GetDocContent?.()
      const text = content?.GetText?.({ ParaSeparator: '\n', NewLineSeparator: '\n', TabSymbol: '\t' })
      if (typeof text === 'string' && text.trim()) parts.push(text.trim())
    }
    return parts.join('\n')
  }

  /** Presentaciones: el texto de la diapositiva actual. */
  slideText(): string {
    try {
      return EditorSession.shapesText(this.api.getJsApi().GetPresentation().GetCurrentSlide())
    } catch {
      return ''
    }
  }

  /** Presentaciones: el texto de todas, separadas por una línea en blanco. */
  private slidesText(B: Api): string {
    const out: string[] = []
    for (const slide of B.GetPresentation().GetAllSlides?.() ?? []) {
      const text = EditorSession.shapesText(slide)
      if (text) out.push(text)
    }
    return out.join('\n\n')
  }

  /** Presentaciones: las notas del orador de la diapositiva actual (en lugar de las que haya). */
  setNotes(text: string): void {
    if (!text.trim()) return
    try {
      this.builder(
        function (scope) {
          const molino = scope.molino
          const notes = Api.GetPresentation().GetCurrentSlide().GetNotesPage()
          if (!notes) return
          const body = notes.GetBodyShape()
          if (body && body.GetDocContent()) body.GetDocContent().RemoveAllElements()
          notes.AddBodyShapeText(molino.text)
        },
        { text: text.slice(0, 10_000) }
      )
      if (!this.state.notes) this.run('notes')
    } catch (error) {
      console.error('notas:', error)
    }
    this.focus()
  }

  /**
   * Presentaciones: diapositivas nuevas detrás de la actual, con su título y sus
   * puntos (la primera con el diseño de título; las demás, título y contenido).
   */
  addSlides(slides: { title: string; bullets: string[] }[]): void {
    const layout = (title: boolean): number => {
      const names = this.state.layouts
      const found = names.findIndex((l, i) => (title ? i === 0 : i > 0 && /content|contenido|objeto|object|texto|text/i.test(l.name)))
      return found >= 0 ? names[found].index : title ? 0 : Math.min(1, Math.max(0, names.length - 1))
    }
    try {
      slides.slice(0, 12).forEach((slide, i) => {
        const isTitle = i === 0 && slide.bullets.length <= 1
        this.api.AddSlide(layout(isTitle))
        this.builder(
          function (scope) {
            const data = scope.molino
            const shapes = Api.GetPresentation().GetCurrentSlide().GetAllShapes()
            let bodyDone = false
            for (let k = 0; k < shapes.length; k++) {
              const placeholder = shapes[k].GetPlaceholder ? shapes[k].GetPlaceholder() : null
              const type = placeholder ? placeholder.GetType() : ''
              const content = shapes[k].GetDocContent ? shapes[k].GetDocContent() : null
              if (!content) continue
              // El título, en su hueco; los puntos, en el primer hueco de contenido (que
              // según el diseño se llama body, object, subTitle o no tiene tipo).
              const isTitle = type === 'title' || type === 'ctrTitle'
              const isBody = placeholder && !isTitle && !['date', 'footer', 'header', 'sldNumber', 'sldImage', 'picture', 'chart', 'table', 'media', 'clipArt'].includes(type)
              const lines = isTitle ? [data.title] : !bodyDone && isBody ? data.lines : null
              if (!lines) continue
              if (!isTitle) bodyDone = true
              content.RemoveAllElements()
              for (let j = 0; j < lines.length; j++) {
                const paragraph = Api.CreateParagraph()
                paragraph.AddText(String(lines[j]))
                content.Push(paragraph)
              }
            }
          },
          { title: slide.title.slice(0, 200), lines: (isTitle ? slide.bullets.slice(0, 1) : slide.bullets.slice(0, 6)).map((b) => b.slice(0, 400)) }
        )
      })
    } catch (error) {
      console.error('diapositivas:', error)
    }
    this.focus()
  }

  /** Hojas: los formatos de número en el idioma de la hoja (los da el editor). */
  private formatStrings(): string[] {
    try {
      const A = this.ew.Asc
      const info = new A.asc_CFormatCellsInfo()
      info.asc_setType(A.c_oAscNumFormatType.None)
      info.asc_setSymbol(this.api.asc_getLocale() || 0x0409)
      const list = this.api.asc_getFormatCells(info)
      return Array.isArray(list) ? list.map(String) : []
    } catch {
      return []
    }
  }

  private setNumberFormat(which: string): void {
    if (which.startsWith('code:')) {
      const code = which.slice(5).trim()
      if (code && code.length <= 255) this.api.asc_setCellFormat(code)
      return
    }
    const index = NUMBER_FORMATS[which]
    if (index === undefined) return
    this.api.asc_setCellFormat(this.formatStrings()[index] || NUMBER_FALLBACK[which])
  }

  /** El código del formato de número de la celda activa (para «Personalizado»). */
  numberFormatCode(): string {
    try {
      return String(this.api.asc_getCellInfo().asc_getXfs().asc_getNumFormat() ?? '')
    } catch {
      return ''
    }
  }

  /** Hojas: una regla de «Resaltar celdas» sobre la selección. */
  private conditionalRule(json: string): void {
    let spec: { kind?: string; a?: string; b?: string; style?: string }
    try {
      spec = JSON.parse(json)
    } catch {
      return
    }
    const A = this.ew.Asc
    const T = A.c_oAscCFType
    const O = A.c_oAscCFOperator
    const rule = new A.asc_CConditionalFormattingRule()
    const value = (v: string | undefined): string => String(v ?? '').slice(0, 255)
    switch (spec.kind) {
      case 'greater':
      case 'less':
      case 'equal':
      case 'between':
        rule.asc_setType(T.cellIs)
        rule.asc_setOperator({ greater: O.greaterThan, less: O.lessThan, equal: O.equal, between: O.between }[spec.kind])
        rule.asc_setValue1(value(spec.a))
        if (spec.kind === 'between') rule.asc_setValue2(value(spec.b))
        break
      case 'text':
        rule.asc_setType(T.containsText)
        rule.asc_setContainsText(value(spec.a))
        break
      case 'duplicates':
        rule.asc_setType(T.duplicateValues)
        break
      case 'top10':
        rule.asc_setType(T.top10)
        rule.asc_setBottom(false)
        rule.asc_setPercent(false)
        rule.asc_setRank(10)
        break
      case 'aboveAverage':
        rule.asc_setType(T.aboveAverage)
        rule.asc_setAboveAverage(true)
        rule.asc_setEqualAverage(false)
        rule.asc_setStdDev(0)
        break
      default:
        return
    }
    const [font, fill] = CF_STYLES[spec.style ?? 'red'] ?? CF_STYLES.red
    const xfs = new A.asc_CellXfs()
    xfs.asc_setFontColor(this.color(font))
    xfs.asc_setFillColor(this.color(fill))
    rule.asc_setDxf(xfs)
    this.api.asc_setCF([rule], [])
  }

  /** Hojas: quitar los duplicados de la selección (con encabezados, si los hay, como propone el editor). */
  private removeDuplicates(): void {
    const api = this.api
    const E = this.ew.Asc.c_oAscSelectionSortExpand
    const expand = api.asc_sortCellsRangeExpand()
    const props = api.asc_getRemoveDuplicates(expand === E.showExpandMessage || expand === E.expandAndNotShowMessage)
    if (!props || typeof props !== 'object') return
    props.asc_updateColumnList()
    api.asc_setRemoveDuplicates(props, false)
  }

  /** Hojas: una lista desplegable en las celdas seleccionadas («Sí;No;Quizá» o un rango como =$A$1:$A$5). */
  private validationList(source: string): void {
    const text = source.trim().slice(0, 255)
    if (!text) return
    const A = this.ew.Asc
    const props = this.api.asc_getDataValidationProps()
    if (!props || typeof props !== 'object') return
    props.asc_setType(A.c_oAscEDataValidationType.List)
    props.asc_setFormula1(new A.CDataFormula())
    props.asc_getFormula1().asc_setValue(text)
    props.asc_setShowDropDown(false)
    this.api.asc_setDataValidation(props)
  }

  private commands(): Record<string, (value?: string) => void> {
    const api = this.api
    const s = this.state
    const ew = this.ew
    // Texto (Documentos y el texto de Presentaciones): las mismas órdenes.
    const text: Record<string, (value?: string) => void> = {
      bold: () => api.put_TextPrBold(!s.bold),
      italic: () => api.put_TextPrItalic(!s.italic),
      underline: () => api.put_TextPrUnderline(!s.underline),
      strike: () => api.put_TextPrStrikeout(!s.strike),
      font: (f) => api.put_TextPrFontName(f),
      size: (v) => api.put_TextPrFontSize(Number(v)),
      grow: () => api.FontSizeIn(),
      shrink: () => api.FontSizeOut(),
      color: (h) => h && api.put_TextColor(this.color(h)),
      align: (a) => api.put_PrAlign(this.alignments()[(a as Align) ?? 'left']),
      bullets: () => this.setList('bullets'),
      numbers: () => this.setList('numbers'),
      undo: () => api.Undo(),
      redo: () => api.Redo(),
      image: () => api.asc_addImage(),
      zoomIn: () => api.zoomIn(),
      zoomOut: () => api.zoomOut(),
      zoomTo: (v) => {
        const n = Number(v)
        if (Number.isFinite(n) && n >= 10 && n <= 500) api.zoom(n)
      },
      fitWidth: () => api.zoomFitToWidth(),
      fitPage: () => api.zoomFitToPage(),
      goToPage: (v) => {
        const n = Number(v)
        if (Number.isInteger(n) && n >= 1 && n <= s.pages) api.goToPage(n - 1)
      }
    }
    if (this.kind === 'word') {
      return {
        ...text,
        // Programador: controles de contenido (como en Word) y «solo rellenar».
        control: (type) => this.addControl(type as ControlType),
        controlRemove: () => {
          const props = api.asc_IsContentControl() ? api.asc_GetContentControlProperties() : null
          if (props) api.asc_RemoveContentControlWrapper(props.get_InternalId())
        },
        controlProps: (json) => this.setControl(json ?? ''),
        formsOnly: (password) => this.setFormsOnly(password),
        style: (n) => api.put_Style(n),
        clearFormat: () => api.ClearFormating(),
        table: (d) => {
          const [cols, rows] = String(d || '3x3').split('x').map(Number)
          api.put_Table(cols, rows)
        },
        pageBreak: () => api.put_AddPageBreak(),
        portrait: () => api.change_PageOrient(true),
        landscape: () => api.change_PageOrient(false),
        indentLess: () => api.DecreaseIndent(),
        indentMore: () => api.IncreaseIndent(),
        lineSpacing: (v) => {
          const n = Number(v)
          if (n > 0 && n <= 3) api.put_PrLineSpacing(LINERULE_AUTO, n)
        },
        header: () => api.GoToHeader(api.getCurrentPage()),
        footer: () => api.GoToFooter(api.getCurrentPage()),
        pageNumber: (where) => api.put_PageNum(where === 'top' ? PAGE_NUM.top : PAGE_NUM.bottom, PAGE_NUM.center),
        equation: () => api.asc_AddMath(),
        margins: (v) => {
          const m = MARGINS[v ?? '']
          if (!m) return
          const props = new ew.Asc.CDocumentSectionProps()
          props.put_TopMargin(m[0])
          props.put_LeftMargin(m[1])
          props.put_BottomMargin(m[2])
          props.put_RightMargin(m[3])
          api.asc_SetSectionProps(props)
        },
        pageSize: (v) => {
          // En vertical: el editor lo pone en horizontal si la página lo está.
          const size = PAGE_SIZES[v ?? '']
          if (size) api.change_DocSize(size[0], size[1])
        },
        pageColumns: (v) => {
          const n = Number(v)
          if (![1, 2, 3].includes(n)) return
          const props = new ew.Asc.CDocumentColumnsProps()
          props.put_EqualWidth(true)
          props.put_Num(n)
          props.put_Space(12.5)
          api.asc_SetColumnsProps(props)
        },
        toc: () => {
          const props = new ew.Asc.CTableOfContentsPr()
          props.put_OutlineRange(1, 9)
          props.put_Hyperlink(true)
          props.put_ShowPageNumbers(true)
          props.put_RightAlignTab(true)
          props.put_TabLeader(ew.Asc.c_oAscTabLeader.Dot)
          api.asc_AddTableOfContents(null, props)
        },
        footnote: () => api.asc_AddFootnote(),
        endnote: () => api.asc_AddEndnote(),
        breaks: (v) => {
          const S = ew.Asc.c_oAscSectionBreakType
          const actions: Record<string, () => void> = {
            page: () => api.put_AddPageBreak(),
            column: () => api.put_AddColumnBreak(),
            nextPage: () => api.add_SectionBreak(S.NextPage),
            continuous: () => api.add_SectionBreak(S.Continuous)
          }
          actions[v ?? '']?.()
        },
        watermark: (v) => this.watermark(v ?? ''),
        // El editor no avisa al cambiarlas (asc_onShowParaMarks solo llega al cargar):
        // lo que devuelve es lo que queda.
        marks: () => {
          const shown = api.put_ShowParaMarks(!s.marks)
          s.marks = typeof shown === 'boolean' ? shown : !s.marks
          this.changed()
        },
        ...this.textExtras(),
        formatPainter: () => api.SetPaintFormat(s.painting ? PAINTER.off : PAINTER.on),
        highlight: (h) => {
          // El modo «rotulador» se queda puesto tras resaltar lo seleccionado: se quita.
          if (h) {
            const n = parseInt(h.slice(1), 16)
            api.SetMarkerFormat(true, true, n >> 16, (n >> 8) & 255, n & 255)
          } else api.SetMarkerFormat(true, false)
          api.SetMarkerFormat(false)
          this.readHighlight()
        },
        paraSpacing: (v) => {
          const spacing = PARA_SPACING[v ?? '']
          if (!spacing) return
          api.put_LineSpacingBeforeAfter(0, (spacing[0] * 25.4) / 72)
          api.put_LineSpacingBeforeAfter(1, (spacing[1] * 25.4) / 72)
        },
        shape: (f) => api.StartAddShape(SHAPES.has(f ?? '') ? f : 'rect', true),
        textBox: () => api.StartAddShape('textRect', true),
        setLink: (json) => this.setLink(json),
        removeLink: () => {
          const link = this.linkElement()
          if (link) api.remove_Hyperlink(link)
        },
        // Tabla seleccionada
        rowAbove: () => api.addRowAbove(),
        rowBelow: () => api.addRowBelow(),
        colLeft: () => api.addColumnLeft(),
        colRight: () => api.addColumnRight(),
        deleteRow: () => api.remRow(),
        deleteCol: () => api.remColumn(),
        deleteTable: () => api.remTable(),
        mergeCells: () => api.CheckBeforeMergeCells() && api.MergeCells(),
        splitCell: (v) => {
          const [cols, rows] = String(v || '2x1').split('x').map(Number)
          if (api.CheckBeforeSplitCells() && cols > 0 && rows > 0) api.SplitCell(Math.min(cols, 20), Math.min(rows, 20))
        },
        tableBorders: (v) => this.tableBorders(v ?? 'all'),
        // Imagen seleccionada
        wrapping: (v) => {
          const W = ew.Asc.c_oAscWrapStyle2
          const style = { inline: W.Inline, square: W.Square, tight: W.Tight, topBottom: W.TopAndBottom, behind: W.Behind, front: W.InFront }[v ?? '']
          if (style === undefined) return
          const props = new ew.Asc.asc_CImgProperty()
          props.put_WrappingStyle(style)
          api.ImgApply(props)
        },
        originalSize: () => {
          const size = api.asc_getCropOriginalImageSize()
          if (!size) return
          const props = new ew.Asc.asc_CImgProperty()
          props.put_Width(size.get_ImageWidth())
          props.put_Height(size.get_ImageHeight())
          props.put_Rot(0)
          api.ImgApply(props)
        },
        crop: () => {
          if (this.cropping) api.asc_endEditCrop()
          else if (api.asc_canEditCrop()) api.asc_startEditCrop()
          else return
          this.cropping = !this.cropping
        }
      }
    }
    if (this.kind === 'cell') {
      return {
        // Programador: validar lo que se escribe, bloquear celdas y proteger la hoja.
        validate: (json) => this.validate(json ?? ''),
        lockCells: () => api.asc_setCellLocked(true),
        unlockCells: () => api.asc_setCellLocked(false),
        protectSheet: (password) => this.protectSheet(password),
        bold: () => api.asc_setCellBold(!s.bold),
        italic: () => api.asc_setCellItalic(!s.italic),
        underline: () => api.asc_setCellUnderline(!s.underline),
        strike: () => api.asc_setCellStrikeout(!s.strike),
        font: (f) => api.asc_setCellFontName(f),
        size: (v) => api.asc_setCellFontSize(Number(v)),
        grow: () => api.asc_increaseFontSize(),
        shrink: () => api.asc_decreaseFontSize(),
        color: (h) => h && api.asc_setCellTextColor(this.color(h)),
        fill: (h) => api.asc_setCellBackgroundColor(h ? this.color(h) : null),
        align: (a) => api.asc_setCellAlign(this.alignments()[(a as Align) ?? 'left']),
        currency: () => this.setNumberFormat('currency'),
        percent: () => this.setNumberFormat('percent'),
        moreDecimals: () => api.asc_increaseCellDigitNumbers(),
        fewerDecimals: () => api.asc_decreaseCellDigitNumbers(),
        borders: () => {
          const B = ew.Asc.c_oAscBorderOptions
          const side = (): Api => new ew.Asc.asc_CBorder(ew.Asc.c_oAscBorderStyles.Thin, this.color('#000000'))
          const all: Api[] = []
          for (const k of ['Left', 'Top', 'Right', 'Bottom', 'InnerV', 'InnerH']) all[B[k]] = side()
          api.asc_setCellBorders(all)
        },
        merge: () => api.asc_mergeCells(ew.Asc.c_oAscMergeOptions.MergeCenter),
        wrap: () => api.asc_setCellTextWrap(!s.wrap),
        sum: () => api.asc_insertInCell(api.asc_getFormulaLocaleName('SUM'), ew.Asc.c_oAscPopUpSelectorType.Func, true),
        func: (name) => {
          if (name && FUNCTIONS.has(name)) api.asc_insertInCell(api.asc_getFormulaLocaleName(name), ew.Asc.c_oAscPopUpSelectorType.Func, true)
        },
        freeze: () => api.asc_freezePane(),
        gridlines: () => api.asc_setDisplayGridlines(!s.gridlines),
        headings: () => api.asc_setDisplayHeadings(!s.headings),
        sort: (direction) => {
          const E = ew.Asc.c_oAscSelectionSortExpand
          const expand = api.asc_sortCellsRangeExpand()
          const order = direction === 'desc' ? ew.Asc.c_oAscSortOptions.Descending : ew.Asc.c_oAscSortOptions.Ascending
          // Si hay datos al lado, se ordenan con ellos (lo sensato; el editor lo pregunta).
          api.asc_sortColFilter(order, '', undefined, undefined, expand === E.showExpandMessage || expand === E.expandAndNotShowMessage)
        },
        filter: () => {
          const info = api.asc_getCellInfo()
          const table = info.asc_getFormatTableInfo()
          const name = table ? table.asc_getTableName() : undefined
          if (name || s.filter) api.asc_changeAutoFilter(name, ew.Asc.c_oAscChangeFilterOptions.filter, !s.filter)
          else api.asc_addAutoFilter()
        },
        chart: (which) => {
          const T = ew.Asc.c_oAscChartTypeSettings
          const props = api.asc_getChartSettings(true)
          if (!props) return
          const type = ({ columns: T.barNormal, lines: T.lineNormal, pie: T.pie, bars: T.hBarNormal, area: T.areaNormal, scatter: T.scatter } as Record<string, number>)[which || 'columns']
          if (type === undefined) return
          props.putType(type)
          api.asc_addChartDrawingObject(props)
        },
        rows: () => api.asc_insertCells(ew.Asc.c_oAscInsertOptions.InsertRows),
        columns: () => api.asc_insertCells(ew.Asc.c_oAscInsertOptions.InsertColumns),
        deleteRows: () => api.asc_deleteCells(ew.Asc.c_oAscDeleteOptions.DeleteRows),
        deleteColumns: () => api.asc_deleteCells(ew.Asc.c_oAscDeleteOptions.DeleteColumns),
        cells: (v) => {
          const actions: Record<string, () => void> = {
            hideRows: () => api.asc_hideRows(),
            showRows: () => api.asc_showRows(),
            hideColumns: () => api.asc_hideColumns(),
            showColumns: () => api.asc_showColumns(),
            autoWidth: () => api.asc_autoFitColumnWidth(),
            autoHeight: () => api.asc_autoFitRowHeight()
          }
          actions[v ?? '']?.()
        },
        columnWidth: (v) => {
          const n = Number(v)
          if (n >= 0 && n <= 255) api.asc_setColumnWidth(n)
        },
        rowHeight: (v) => {
          const n = Number(v)
          if (n >= 0 && n <= 409.5) api.asc_setRowHeight(n)
        },
        numberFormat: (v) => this.setNumberFormat(v ?? ''),
        formatPainter: () => {
          api.asc_formatPainter(s.painting ? PAINTER.off : PAINTER.on)
          s.painting = !s.painting
          this.changed()
        },
        clear: (v) => {
          const C = ew.Asc.c_oAscCleanOptions
          const option = { all: C.All, contents: C.Text, formats: C.Format, links: C.Hyperlinks }[v ?? '']
          if (option !== undefined) api.asc_emptyCells(option)
        },
        cfPreset: (v) => {
          const [type, index] = String(v || '').split(':')
          const R = ew.Asc.c_oAscCFRuleTypeSettings
          const kind = { bars: R.dataBar, scale: R.colorScale, icons: R.icons }[type]
          if (kind !== undefined && /^\d{1,2}$/.test(index ?? '')) api.asc_setCF([], [], [kind, Number(index)])
        },
        cfRule: (json) => this.conditionalRule(json ?? ''),
        cfQuick: (v) => this.conditionalRule(JSON.stringify({ kind: v, a: '', b: '', style: 'red' })),
        cfClear: (v) => {
          const W = ew.Asc.c_oAscSelectionForCFType
          api.asc_clearCF(v === 'sheet' ? W.worksheet : W.selection)
        },
        formatTable: (style) => {
          if (/^TableStyle(Light|Medium|Dark)\d{1,2}$/.test(style ?? '')) api.asc_addAutoFilter(style)
        },
        pageOrient: (v) => api.asc_changePageOrient(v !== 'landscape', api.asc_getActiveWorksheetIndex()),
        paperSize: (v) => {
          const size = PAGE_SIZES[v ?? '']
          if (size) api.asc_changeDocSize(size[0], size[1], api.asc_getActiveWorksheetIndex())
        },
        fitTo: (v) => {
          const fit: Record<string, [number, number, number]> = { none: [0, 0, 100], width: [1, 0, 100], page: [1, 1, 100] }
          const chosen = fit[v ?? '']
          if (chosen) api.asc_SetPrintScale(...chosen)
        },
        printArea: (v) => {
          const P = ew.Asc.c_oAscChangePrintAreaType
          api.asc_ChangePrintArea(v === 'clear' ? P.clear : P.set)
        },
        setLink: (json) => this.setCellLink(json ?? ''),
        removeLink: () => api.asc_removeHyperlink(),
        renameSheet: (v) => {
          const [i, ...rest] = String(v || '').split('|')
          const name = rest.join('|').trim()
          if (name && name.length <= 31 && !/[\\/?*[\]:]/.test(name)) api.asc_renameWorksheet(name, api.asc_getWorksheetId(Number(i)))
        },
        deleteSheet: (i) => api.asc_deleteWorksheet([Number(i)]),
        copySheet: (i) => {
          const index = Number(i)
          api.asc_copyWorksheet(index + 1, [this.copyName(api.asc_getWorksheetName(index))], [index])
        },
        moveSheet: (v) => {
          const [i, where] = String(v || '').split('|')
          const index = Number(i)
          const visible = s.sheets.map((sheet) => sheet.index)
          const at = visible.indexOf(index)
          if (where === 'left' && at > 0) api.asc_moveWorksheet(visible[at - 1], [index])
          // Ante la que va después de la siguiente (o al final).
          else if (where === 'right' && at >= 0 && at < visible.length - 1) api.asc_moveWorksheet(at + 2 < visible.length ? visible[at + 2] : api.asc_getWorksheetsCount(), [index])
        },
        // Arrastrando la pestaña: la hoja va al hueco «gap» (0: antes de la primera; n: al final).
        moveSheetTo: (v) => {
          const [i, g] = String(v || '').split('|')
          const index = Number(i)
          const gap = Number(g)
          const visible = s.sheets.map((sheet) => sheet.index)
          const at = visible.indexOf(index)
          if (at < 0 || !Number.isInteger(gap) || gap < 0 || gap > visible.length || gap === at || gap === at + 1) return
          api.asc_moveWorksheet(gap < visible.length ? visible[gap] : api.asc_getWorksheetsCount(), [index])
        },
        sheetColor: (v) => {
          const [i, hex] = String(v || '').split('|')
          api.asc_setWorksheetTabColor(/^#[0-9a-f]{6}$/i.test(hex ?? '') ? this.color(hex) : null, [Number(i)])
        },
        hideSheet: (i) => api.asc_hideWorksheet([Number(i)]),
        showSheet: (i) => api.asc_showWorksheet(Number(i)),
        removeDuplicates: () => this.removeDuplicates(),
        defineName: (name) => {
          const clean = String(name ?? '').trim()
          // Como en Excel: empieza por una letra o _, sin espacios.
          if (!/^[\p{L}_][\p{L}\p{N}_.]{0,254}$/u.test(clean)) return
          const current = api.asc_getDefaultDefinedName()
          api.asc_setDefinedNames(new ew.Asc.asc_CDefName(clean, current.asc_getRef(), null, current.asc_getType(), undefined, undefined, undefined, true))
        },
        validationList: (src) => this.validationList(src ?? ''),
        goSheet: (i) => api.asc_showWorksheet(Number(i)),
        newSheet: () => api.asc_addWorksheet(this.newSheetName()),
        image: () => api.asc_addImage(),
        undo: () => api.asc_Undo(),
        redo: () => api.asc_Redo(),
        zoomIn: () => api.asc_setZoom(Math.min(5, (s.zoom + 10) / 100)),
        zoomOut: () => api.asc_setZoom(Math.max(0.1, (s.zoom - 10) / 100)),
        zoomTo: (v) => {
          const n = Number(v)
          if (Number.isFinite(n) && n >= 10 && n <= 500) api.asc_setZoom(n / 100)
        }
      }
    }
    return {
      ...text,
      newSlide: () => api.AddSlide(),
      duplicateSlide: () => api.DublicateSlide(),
      deleteSlide: () => api.DeleteSlide(),
      theme: (id) => api.ChangeTheme(Number(id)),
      layout: (i) => api.ChangeLayout(Number(i)),
      textBox: () => api.StartAddShape('textRect', true),
      table: (d) => {
        const [cols, rows] = String(d || '3x3').split('x').map(Number)
        api.put_Table(cols, rows)
      },
      slideSize: (v) => {
        // Se queda el alto y cambia el ancho (como PowerPoint): 16:9 o 4:3.
        const height = api.get_PresentationHeight()
        const Z = ew.Asc.c_oAscSlideSZType
        if (v === 'standard') api.changeSlideSize((height * 4) / 3, height, Z.SzScreen4x3, 1)
        else if (v === 'wide') api.changeSlideSize((height * 16) / 9, height, Z.SzCustom, 1)
      },
      notes: () => {
        api.asc_ShowNotes(!s.notes)
        s.notes = !s.notes
        this.changed()
      },
      shape: (f) => api.StartAddShape(SHAPES.has(f ?? '') ? f : 'rect', true),
      ...this.textExtras(),
      formatPainter: () => api.SetPaintFormat(s.painting ? PAINTER.off : PAINTER.on),
      setLink: (json) => this.setLink(json),
      removeLink: () => api.remove_Hyperlink(),
      chart: (which) => {
        const T = ew.Asc.c_oAscChartTypeSettings
        const type = ({ columns: T.barNormal, lines: T.lineNormal, pie: T.pie, bars: T.hBarNormal } as Record<string, number>)[which || 'columns']
        if (type !== undefined) api.asc_addChartDrawingObject(type, undefined, true)
      },
      // Forma seleccionada: relleno, contorno, grosor
      shapeFill: (h) => {
        const props = new ew.Asc.asc_CShapeProperty()
        props.put_fill(this.solidFill(h))
        api.ShapeApply(props)
      },
      shapeLine: (h) => {
        const props = new ew.Asc.asc_CShapeProperty()
        const stroke = new ew.Asc.asc_CStroke()
        if (h) {
          stroke.put_type(ew.Asc.c_oAscStrokeType.STROKE_COLOR)
          stroke.put_color(this.color(h))
          stroke.put_width(((s.lineWidth || 1) * 25.4) / 72)
        } else stroke.put_type(ew.Asc.c_oAscStrokeType.STROKE_NONE)
        props.put_stroke(stroke)
        api.ShapeApply(props)
      },
      lineWidth: (v) => {
        const pt = Number(v)
        if (!(pt > 0 && pt <= 20)) return
        const props = new ew.Asc.asc_CShapeProperty()
        const stroke = new ew.Asc.asc_CStroke()
        stroke.put_type(ew.Asc.c_oAscStrokeType.STROKE_COLOR)
        stroke.put_color(this.color(s.lineColor || '#000000'))
        stroke.put_width((pt * 25.4) / 72)
        props.put_stroke(stroke)
        api.ShapeApply(props)
        s.lineWidth = pt
      },
      arrange: (v) => {
        const actions: Record<string, () => void> = {
          front: () => api.shapes_bringToFront(),
          back: () => api.shapes_bringToBack(),
          forward: () => api.shapes_bringForward(),
          backward: () => api.shapes_bringBackward(),
          group: () => api.groupShapes(),
          ungroup: () => api.unGroupShapes()
        }
        actions[v ?? '']?.()
      },
      alignShapes: (v) => {
        const A = ew.Asc.c_oAscAlignShapeType
        const relTo = ew.Asc.c_oAscObjectsAlignType.Slide
        if (v === 'distributeH') return api.DistributeHorizontally(relTo)
        if (v === 'distributeV') return api.DistributeVertically(relTo)
        const type = { left: A.ALIGN_LEFT, center: A.ALIGN_CENTER, right: A.ALIGN_RIGHT, top: A.ALIGN_TOP, middle: A.ALIGN_MIDDLE, bottom: A.ALIGN_BOTTOM }[v ?? '']
        if (type !== undefined) api.put_ShapesAlign(type, relTo)
      },
      // Diapositiva: fondo, transición, ocultar, encabezado y pie, animación
      background: (h) => {
        const props = new ew.Asc.CAscSlideProps()
        if (h) props.put_background(this.solidFill(h))
        else props.put_ResetBackground(true)
        api.SetSlideProps(props)
      },
      backgroundAll: () => {
        const props = new ew.Asc.CAscSlideProps()
        props.put_ApplyBackgroundToAll(true)
        api.SetSlideProps(props)
      },
      transition: (v) => {
        const T = ew.Asc.c_oAscSlideTransitionTypes
        const P = ew.Asc.c_oAscSlideTransitionParams
        const chosen: Record<string, [number, number]> = {
          none: [T.None, 0],
          fade: [T.Fade, P.Fade_Smoothly],
          push: [T.Push, P.Param_Bottom],
          wipe: [T.Wipe, P.Param_Left],
          split: [T.Split, P.Split_VerticalOut],
          uncover: [T.UnCover, P.Param_Left],
          cover: [T.Cover, P.Param_Left],
          clock: [T.Clock, P.Clock_Clockwise],
          zoom: [T.Zoom, P.Zoom_In]
        }
        const pick = chosen[v ?? '']
        if (!pick) return
        const props = new ew.Asc.CAscSlideProps()
        const transition = new ew.Asc.CAscSlideTransition()
        transition.put_TransitionType(pick[0])
        transition.put_TransitionOption(pick[1])
        if (pick[0] !== T.None) transition.put_TransitionDuration(s.transitionMs || 700)
        props.put_transition(transition)
        api.SetSlideProps(props)
      },
      duration: (v) => {
        const ms = Number(v)
        if (!(ms >= 100 && ms <= 20_000)) return
        const props = new ew.Asc.CAscSlideProps()
        const transition = new ew.Asc.CAscSlideTransition()
        transition.put_TransitionDuration(ms)
        props.put_transition(transition)
        api.SetSlideProps(props)
      },
      transitionAll: () => api.SlideTransitionApplyToAll(),
      transitionPreview: () => api.SlideTransitionPlay(),
      hideSlide: () => api.asc_HideSlides(!s.slideHidden),
      slideFooter: (json) => this.setSlideFooter(json ?? ''),
      animation: (v) => {
        const F = ew.AscFormat
        if (!F) return
        if (v === 'none') return api.asc_AddAnimation(undefined, F.ANIM_PRESET_NONE, 0, null, true, false)
        const effect: Record<string, [number, number]> = {
          appear: [F.ENTRANCE_APPEAR, 0],
          fade: [F.ENTRANCE_FADE, 0],
          fly: [F.ENTRANCE_FLY_IN_FROM, F.ENTRANCE_FLY_IN_FROM_BOTTOM]
        }
        const pick = effect[v ?? '']
        if (pick) api.asc_AddAnimation(F.PRESET_CLASS_ENTR, pick[0], pick[1], null, true, true)
      },
      // Tabla seleccionada (como en Documentos)
      rowAbove: () => api.addRowAbove(),
      rowBelow: () => api.addRowBelow(),
      colLeft: () => api.addColumnLeft(),
      colRight: () => api.addColumnRight(),
      deleteRow: () => api.remRow(),
      deleteCol: () => api.remColumn(),
      deleteTable: () => api.remTable(),
      mergeCells: () => api.CheckBeforeMergeCells() && api.MergeCells(),
      splitCell: (v) => {
        const [cols, rows] = String(v || '2x1').split('x').map(Number)
        if (api.CheckBeforeSplitCells() && cols > 0 && rows > 0) api.SplitCell(Math.min(cols, 20), Math.min(rows, 20))
      },
      // Presentar desde el principio, desde aquí o con la vista del moderador (otra ventana, bridge.js).
      present: (from) => ew.Common.NotificationCenter.trigger('preview:start', from === 'here' ? api.getCurrentPage() : 0, from === 'presenter', false, from === 'here'),
      fit: () => api.zoomFitToPage()
    }
  }

  /** El controlador de comentarios de la interfaz del editor (oculta, pero cargada): tiene la lista. */
  private commentsController(): Api {
    try {
      const editorApp = this.ew.DE || this.ew.SSE || this.ew.PE
      return editorApp ? editorApp.getController('Common.Controllers.Comments') : null
    } catch {
      return null
    }
  }

  /** Un cambio en un comentario: {id, reply?, text?} (el texto, hasta 10 000 caracteres y no vacío). */
  private commentEdit(json: string | undefined, apply: (ctrl: Api, edit: { id: string; reply: string; text: string }) => void, needsText = true): void {
    const ctrl = this.commentsController()
    if (!ctrl) return
    let edit: { id?: unknown; reply?: unknown; text?: unknown }
    try {
      edit = JSON.parse(String(json ?? ''))
    } catch {
      return
    }
    const id = typeof edit.id === 'string' ? edit.id : ''
    const reply = typeof edit.reply === 'string' ? edit.reply : ''
    const text = typeof edit.text === 'string' ? edit.text.trim().slice(0, 10_000) : ''
    if (!id || (needsText && !text)) return
    apply(ctrl, { id, reply, text })
  }

  private review(): Record<string, (value?: string) => void> {
    const api = this.api
    const ew = this.ew
    const comments: Record<string, (value?: string) => void> = {
      comment: (text) => {
        const value = String(text || '').trim()
        if (!value) return
        const ctrl = this.commentsController()
        const Data = ew.Asc.asc_CCommentDataWord || ew.Asc.asc_CCommentData
        const data = new Data(null)
        const now = new Date()
        data.asc_putText(value.slice(0, 10_000))
        data.asc_putTime(ctrl ? ctrl.utcDateToString(now) : String(now.getTime() + now.getTimezoneOffset() * 60_000))
        data.asc_putOnlyOfficeTime(String(now.getTime()))
        data.asc_putUserId(ctrl && ctrl.currentUserId ? ctrl.currentUserId : '1')
        data.asc_putUserName(ew.AscCommon.UserInfoParser.getCurrentName())
        data.asc_putSolved(false)
        api.asc_addComment(data)
      },
      resolveComment: (id) => {
        const ctrl = this.commentsController()
        if (id && ctrl) ctrl.onResolveComment(id)
      },
      removeComment: (id) => id && api.asc_removeComment(id),
      // Responder, cambiar el texto de un comentario o de una respuesta, y quitar una respuesta
      // (con el controlador de comentarios del editor, que guarda autor y fecha).
      replyComment: (json) => this.commentEdit(json, (ctrl, e) => ctrl.onAddReplyComment(e.id, e.text)),
      editComment: (json) => this.commentEdit(json, (ctrl, e) => ctrl.onChangeComment(e.id, e.text)),
      editReply: (json) => this.commentEdit(json, (ctrl, e) => ctrl.onChangeReplyComment(e.id, e.reply, e.text)),
      removeReply: (json) => this.commentEdit(json, (ctrl, e) => ctrl.onRemoveReplyComment(e.id, e.reply), false),
      showComment: (id) => {
        if (!id) return
        api.asc_selectComment(id)
        api.asc_showComment(id, false)
      }
    }
    if (this.kind !== 'word') return comments
    return {
      ...comments,
      track: () => api.asc_SetTrackRevisions(!this.state.track),
      prevChange: () => api.asc_GetPrevRevisionsChange(),
      nextChange: () => api.asc_GetNextRevisionsChange(),
      acceptChange: () => api.asc_AcceptChangesBySelection(true),
      rejectChange: () => api.asc_RejectChangesBySelection(true),
      acceptAll: () => api.asc_AcceptAllChanges(),
      rejectAll: () => api.asc_RejectAllChanges()
    }
  }

  private common(): Record<string, (value?: string) => void> {
    return {
      save: () => this.api.asc_Save(false),

    }
  }

  /** ¿Tiene esta app la orden? */
  can(command: string): boolean {
    if (!this.api) return false
    return command in this.features() || command in this.commands() || command in this.review() || command in this.common()
  }

  /** Las propiedades del documento (título, asunto, autor, palabras clave, descripción). */
  coreProps(): { title: string; subject: string; creator: string; keywords: string; description: string } {
    const out = { title: '', subject: '', creator: '', keywords: '', description: '' }
    try {
      const props = this.api?.asc_getCoreProps?.()
      if (!props) return out
      const text = (v: unknown): string => (typeof v === 'string' ? v : '')
      out.title = text(props.asc_getTitle?.())
      out.subject = text(props.asc_getSubject?.())
      out.creator = text(props.asc_getCreator?.())
      out.keywords = text(props.asc_getKeywords?.())
      out.description = text(props.asc_getDescription?.())
    } catch {
      /* sin propiedades */
    }
    return out
  }

  /** Cambia las propiedades del documento (se guardan con él). */
  setCoreProps(values: Record<string, string>): void {
    const api = this.api
    if (!api?.asc_getCoreProps) return
    const props = api.asc_getCoreProps()
    const clip = (key: string, max: number): string => String(values[key] ?? '').slice(0, max)
    props.asc_putTitle?.(clip('title', 255))
    props.asc_putSubject?.(clip('subject', 255))
    props.asc_putCreator?.(clip('creator', 255))
    props.asc_putKeywords?.(clip('keywords', 255))
    props.asc_putDescription?.(clip('description', 2000))
    api.asc_setCoreProps(props)
  }

  /** Hace una orden; devuelve si se pudo. El teclado vuelve después al documento. */
  run(command: string, value?: string): boolean {
    if (!this.api) return false
    const fn = this.features()[command] ?? this.commands()[command] ?? this.review()[command] ?? this.common()[command]
    if (!fn) return false
    try {
      fn(value)
    } catch (error) {
      console.error(`orden ${command}:`, error)
      return false
    }
    if (this.kind === 'cell') {
      // Dar formato a una celda no siempre avisa (asc_onSelectionChanged): los
      // botones (ajustar texto, porcentaje…) se leen otra vez, ahora y al
      // terminar lo que el editor haga después.
      this.rereadCell()
      setTimeout(() => this.rereadCell(), 0)
    }
    this.focus()
    return true
  }

  /**
   * Antes de exportar o imprimir (que hace el motor con lo que tiene): el editor
   * manda los cambios que le queden y se espera a que lleguen (bridge.js).
   */
  async flush(): Promise<void> {
    try {
      await this.ew?.molinoFlush?.()
    } catch {
      /* sin cambios que mandar */
    }
  }

  get ready(): boolean {
    return Boolean(this.api) && this.state.ready
  }

  // ------------------------------------------------------- buscar y reemplazar

  private searchSettings(text: string, options: { matchCase: boolean; wholeWords: boolean }): Api {
    const settings = new this.ew.AscCommon.CSearchSettings()
    settings.put_Text(text)
    settings.put_MatchCase(options.matchCase)
    settings.put_WholeWords(options.wholeWords)
    return settings
  }

  private cellFindOptions(text: string, options: { matchCase: boolean; wholeWords: boolean }, back: boolean): Api {
    const A = this.ew.Asc
    const find = new A.asc_CFindOptions()
    find.asc_setFindWhat(text)
    find.asc_setScanForward(!back)
    find.asc_setIsMatchCase(options.matchCase)
    find.asc_setIsWholeCell(options.wholeWords)
    find.asc_setScanOnOnlySheet(A.c_oAscSearchBy.Sheet)
    find.asc_setScanByRows(true)
    find.asc_setLookIn(A.c_oAscFindLookIn.Formulas)
    return find
  }

  /** Busca el siguiente (o el anterior); el editor avisa de cuál es y cuántos hay. */
  find(text: string, options: { matchCase: boolean; wholeWords: boolean }, back: boolean): void {
    if (!this.api || !text) return
    try {
      if (this.kind === 'cell') {
        const found = this.api.asc_findText(this.cellFindOptions(text, options, back))
        if (!found) this.state.search = { current: 0, total: 0 }
      } else {
        const count = this.api.asc_findText(this.searchSettings(text, options), !back)
        if (typeof count === 'number') this.state.search = { current: count ? Math.max(1, this.state.search?.current ?? 1) : 0, total: count }
      }
    } catch (error) {
      console.error('buscar:', error)
    }
    this.changed()
  }

  /** Reemplaza el actual (y busca el siguiente) o todos. */
  replace(text: string, by: string, all: boolean, options: { matchCase: boolean; wholeWords: boolean }): void {
    if (!this.api || !text) return
    try {
      if (this.kind === 'cell') {
        const find = this.cellFindOptions(text, options, false)
        find.asc_setReplaceWith(by)
        find.asc_setIsReplaceAll(all)
        this.api.asc_replaceText(find)
      } else {
        this.api.asc_replaceText(this.searchSettings(text, options), by, all)
        if (!all) this.find(text, options, false)
      }
      if (all) this.state.search = { current: 0, total: 0 }
    } catch (error) {
      console.error('reemplazar:', error)
    }
    this.changed()
  }

  endFind(): void {
    try {
      if (this.kind !== 'cell') this.api?.asc_endFindText()
    } catch {
      /* ya no buscaba */
    }
    this.state.search = null
    this.changed()
  }

  // --------------------------------------------------------- cuadros de Molino

  // --------------------------------------------------------- Programador

  /** El tipo de un control a partir de sus propiedades. */
  private controlType(props: Api): ControlType {
    const A = this.ew.Asc
    const T = A.c_oAscContentControlSpecificType
    switch (props.get_SpecificType()) {
      case T.CheckBox:
        return 'check'
      case T.ComboBox:
        return 'combo'
      case T.DropDownList:
        return 'list'
      case T.DateTime:
        return 'date'
      case T.Picture:
        return 'picture'
      default:
        return props.get_ContentControlType() === A.c_oAscSdtLevelType.Block ? 'rich' : 'text'
    }
  }

  /** Documentos: ¿hay un control de contenido donde está el cursor? */
  private readControl(): void {
    try {
      const props = this.api.asc_IsContentControl() ? this.api.asc_GetContentControlProperties() : null
      this.state.control = props ? this.controlType(props) : null
    } catch {
      this.state.control = null
    }
  }

  /** Inserta un control de contenido como los de la pestaña Programador de Word. */
  private addControl(type: ControlType): void {
    const api = this.api
    const A = this.ew.Asc
    if (type === 'text' || type === 'rich') api.asc_AddContentControl(type === 'text' ? A.c_oAscSdtLevelType.Inline : A.c_oAscSdtLevelType.Block)
    else if (type === 'check') api.asc_AddContentControlCheckBox()
    else if (type === 'combo' || type === 'list') api.asc_AddContentControlList(type === 'combo')
    else if (type === 'date') api.asc_AddContentControlDatePicker()
    else if (type === 'picture') api.asc_AddContentControlPicture()
    this.readControl()
  }

  /** Las propiedades del control donde está el cursor (para su cuadro), o null. */
  controlInfo(): ControlInfo | null {
    if (!this.api || this.kind !== 'word') return null
    try {
      if (!this.api.asc_IsContentControl()) return null
      const props = this.api.asc_GetContentControlProperties()
      if (!props) return null
      const type = this.controlType(props)
      const L = this.ew.Asc.c_oAscSdtLockType
      const lock = props.get_Lock()
      const items: string[] = []
      const list = type === 'combo' ? props.get_ComboBoxPr() : type === 'list' ? props.get_DropDownListPr() : null
      if (list) for (let i = 0; i < list.get_ItemsCount(); i++) items.push(String(list.get_ItemDisplayText(i)))
      const date = type === 'date' ? props.get_DateTimePr() : null
      return {
        type,
        title: String(props.get_Alias() ?? ''),
        tag: String(props.get_Tag() ?? ''),
        placeholder: String(props.get_PlaceholderText?.() ?? '').trim(),
        lock: lock === L.SdtContentLocked ? 'both' : lock === L.SdtLocked ? 'delete' : lock === L.ContentLocked ? 'edit' : 'none',
        items,
        dateFormat: date ? String(date.get_DateFormat() ?? '') : ''
      }
    } catch {
      return null
    }
  }

  /** Cambia el control donde está el cursor (lo que llega del cuadro Propiedades, en JSON). */
  private setControl(json: string): void {
    const api = this.api
    let wanted: Partial<ControlInfo>
    try {
      wanted = JSON.parse(json) as Partial<ControlInfo>
    } catch {
      return
    }
    if (!api.asc_IsContentControl()) return
    const current = api.asc_GetContentControlProperties()
    if (!current) return
    const type = this.controlType(current)
    const props = new this.ew.AscCommon.CContentControlPr()
    const text = (v: unknown, max: number): string => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').slice(0, max)
    props.put_Alias(text(wanted.title, 64))
    props.put_Tag(text(wanted.tag, 64))
    if (type === 'text' || type === 'rich' || type === 'combo' || type === 'list' || type === 'date') props.put_PlaceholderText(text(wanted.placeholder, 255) || '    ')
    const L = this.ew.Asc.c_oAscSdtLockType
    props.put_Lock({ both: L.SdtContentLocked, delete: L.SdtLocked, edit: L.ContentLocked, none: L.Unlocked }[wanted.lock ?? 'none'] ?? L.Unlocked)
    if ((type === 'combo' || type === 'list') && Array.isArray(wanted.items)) {
      const list = type === 'combo' ? current.get_ComboBoxPr() : current.get_DropDownListPr()
      list.clear()
      for (const item of wanted.items.map((i) => text(i, 255).trim()).filter(Boolean).slice(0, 200)) list.add_Item(item, item)
      if (type === 'combo') props.put_ComboBoxPr(list)
      else props.put_DropDownListPr(list)
    }
    if (type === 'date' && wanted.dateFormat) {
      const date = current.get_DateTimePr()
      date.put_DateFormat(text(wanted.dateFormat, 64))
      props.put_DateTimePr(date)
    }
    api.asc_SetContentControlProperties(props, current.get_InternalId())
  }

  /**
   * Documentos: «Solo rellenar» (como Restringir la edición → Rellenar
   * formularios de Word: se guarda en el .docx). Con el documento ya
   * protegido, lo quita (con su contraseña, si la tiene).
   */
  private setFormsOnly(password?: string): void {
    const api = this.api
    const A = this.ew.Asc
    const current = api.asc_getDocumentProtection ? api.asc_getDocumentProtection() : null
    const on = Boolean(current && current.asc_getEditType() === A.c_oAscEDocProtect.Forms)
    const props = current || new this.ew.AscCommonWord.CDocProtect()
    props.asc_setEditType(on ? A.c_oAscEDocProtect.None : A.c_oAscEDocProtect.Forms)
    if (password) props.asc_setPassword(String(password).slice(0, 15))
    api.asc_setDocumentProtection(props)
    this.readProtection()
  }

  private readProtection(): void {
    try {
      if (this.kind === 'word') {
        const p = this.api.asc_getDocumentProtection ? this.api.asc_getDocumentProtection() : null
        this.state.formsOnly = Boolean(p && p.asc_getEditType() === this.ew.Asc.c_oAscEDocProtect.Forms)
      } else if (this.kind === 'cell') {
        this.state.sheetProtected = Boolean(this.api.asc_isProtectedSheet())
      }
    } catch {
      // sin cambios
    }
  }

  /** ¿Tiene contraseña la protección puesta? (para pedirla al quitarla). */
  protectionHasPassword(): boolean {
    try {
      if (this.kind === 'word') {
        const p = this.api.asc_getDocumentProtection ? this.api.asc_getDocumentProtection() : null
        return Boolean(p && p.asc_getIsPassword())
      }
      if (this.kind === 'cell') return Boolean(this.api.asc_getProtectedSheet().asc_isPassword())
    } catch {
      return false
    }
    return false
  }

  /** Hojas: proteger la hoja (solo se cambian las celdas desbloqueadas) o quitar la protección. */
  private protectSheet(password?: string): void {
    const props = this.api.asc_getProtectedSheet()
    if (this.api.asc_isProtectedSheet()) props.asc_setSheet(password ? String(password).slice(0, 255) : undefined)
    else props.asc_setSheet(password ? String(password).slice(0, 255) : '')
    this.api.asc_setProtectedSheet(props)
    this.readProtection()
  }

  /**
   * Hojas: qué se puede escribir en las celdas seleccionadas (número entero o
   * decimal entre dos valores, fecha, largo del texto, una lista) y el mensaje
   * de ayuda que sale al elegirlas. type 'none' quita la regla.
   */
  private validate(json: string): void {
    let rule: { type?: string; min?: string; max?: string; source?: string; title?: string; message?: string }
    try {
      rule = JSON.parse(json) as typeof rule
    } catch {
      return
    }
    const A = this.ew.Asc
    const V = A.c_oAscEDataValidationType
    const types: Record<string, number> = { none: V.None, whole: V.Whole, decimal: V.Decimal, date: V.Date, length: V.TextLength, list: V.List }
    const type = types[rule.type ?? 'none']
    if (type === undefined) return
    const props = this.api.asc_getDataValidationProps()
    props.asc_setType(type)
    const formula = (value: string): Api => {
      const f = new A.CDataFormula()
      f.asc_setValue(value)
      return f
    }
    if (type === V.List) {
      props.asc_setFormula1(formula(String(rule.source ?? '').slice(0, 255)))
      props.asc_setShowDropDown(false)
    } else if (type !== V.None) {
      props.asc_setOperator(A.EDataValidationOperator.Between)
      props.asc_setFormula1(formula(String(rule.min ?? '').slice(0, 64)))
      props.asc_setFormula2(formula(String(rule.max ?? '').slice(0, 64)))
    }
    const title = String(rule.title ?? '').slice(0, 32)
    const message = String(rule.message ?? '').slice(0, 255)
    props.asc_setShowInputMessage(type !== V.None && Boolean(title || message))
    props.asc_setPromptTitle(title)
    props.asc_setPrompt(message)
    props.asc_setShowErrorMessage(type !== V.None)
    this.api.asc_setDataValidation(props)
  }

  /**
   * Mis scripts: corre código del usuario con la API de documentos de
   * ONLYOFFICE (Api.GetDocument(), Api.GetActiveSheet()…), como sus macros.
   * Solo el que escribe el usuario: Molino nunca ejecuta las macros que traen
   * los documentos. Se deshace de una vez. ``print(...)`` escribe en la salida.
   */
  runScript(code: string): ScriptOutcome {
    const api = this.api
    if (!api || typeof api.native_callCommand !== 'function') return { ok: false, output: [], error: 'unavailable' }
    // El editor ejecuta el código aparte (sin la ventana): lo que escribe print()
    // y el error vuelven como lo que devuelve la función.
    const source = [
      'function () {',
      '  var __out = [], __error = "";',
      '  var print = function () { if (__out.length < 500) __out.push(Array.prototype.map.call(arguments, function (a) { try { return typeof a === "string" ? a : JSON.stringify(a) } catch (e) { return String(a) } }).join(" ").slice(0, 2000)) };',
      '  try {',
      code,
      '  } catch (e) { __error = String((e && e.message) || e).slice(0, 500) }',
      '  return JSON.stringify({ output: __out, error: __error });',
      '}'
    ].join(String.fromCharCode(10))
    let reply: unknown
    try {
      reply = api.native_callCommand(source, {})
    } catch (error) {
      return { ok: false, output: [], error: String(error instanceof Error ? error.message : error).slice(0, 500) }
    }
    this.changed()
    try {
      const parsed = JSON.parse(String(reply)) as { output?: unknown; error?: unknown }
      const output = Array.isArray(parsed.output) ? parsed.output.map((line) => String(line)).slice(0, 500) : []
      const error = typeof parsed.error === 'string' ? parsed.error : ''
      return { ok: !error, output, error }
    } catch {
      // Sin respuesta: el código no se pudo ni leer (un error de sintaxis).
      return { ok: false, output: [], error: 'syntax' }
    }
  }


  /** Documentos: páginas, palabras, caracteres y párrafos (el editor los cuenta poco a poco). */
  stats(): Promise<Record<string, number>> {
    if (!this.api || this.kind !== 'word') return Promise.resolve({})
    if (this.statsRunning) return this.statsRunning
    const running = new Promise<Record<string, number>>((resolve) => {
      this.docInfo = {}
      this.statsDone = resolve
      try {
        this.api.startGetDocInfo()
      } catch {
        this.statsDone = null
        resolve({})
      }
    })
    this.statsRunning = running
    void running.finally(() => {
      if (this.statsRunning === running) this.statsRunning = null
    })
    return running
  }

  /** El vínculo donde está el cursor (o el de la celda activa). */
  currentLink(): { text: string; url: string; tip: string } | null {
    if (!this.api) return null
    try {
      if (this.kind === 'cell') {
        const link = this.api.asc_getCellInfo().asc_getHyperlink()
        return link ? { text: String(link.asc_getText() ?? ''), url: String(link.asc_getHyperlinkUrl() ?? ''), tip: String(link.asc_getTooltip() ?? '') } : null
      }
      const link = this.linkElement()
      return link ? { text: String(link.get_Text() ?? ''), url: String(link.get_Value() ?? ''), tip: String(link.get_ToolTip() ?? '') } : null
    } catch {
      return null
    }
  }

  /** Hojas: el ancho de la columna o el alto de la fila activa. */
  cellSize(which: 'column' | 'row'): number | null {
    try {
      const n = which === 'column' ? this.api.asc_getColumnWidth() : this.api.asc_getRowHeight()
      return typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 100) / 100 : null
    } catch {
      return null
    }
  }

  /** Hojas → Insertar función: todas las del editor, con su nombre en el idioma de la hoja y su ayuda. */
  functions(): { name: string; local: string; group: string; syntax: string; description: string }[] {
    const out: { name: string; local: string; group: string; syntax: string; description: string }[] = []
    try {
      const help = this.functionHelp()
      const separator = this.api.asc_getFunctionArgumentSeparator?.() ?? ','
      for (const group of this.api.asc_getFormulasInfo() || []) {
        const groupName = String(group.asc_getGroupName())
        if (groupName === 'Custom') continue
        for (const f of group.asc_getFormulasArray() || []) {
          const name = String(f.asc_getName())
          const local = String(f.asc_getLocaleName?.() ?? name)
          const info = help[name]
          out.push({ name, local, group: groupName, syntax: `${local}${String(info?.a ?? '()').replace(/[,;]/g, separator)}`, description: String(info?.d ?? '') })
        }
      }
    } catch (error) {
      console.error('funciones:', error)
    }
    return out.sort((a, b) => a.local.localeCompare(b.local))
  }

  /** Las categorías de las funciones (las que da el editor, con su nombre en el idioma de Molino). */
  functionGroups(): { id: string; label: string }[] {
    try {
      return (this.api.asc_getFormulasInfo() || []).map((g: Api) => String(g.asc_getGroupName())).filter((id: string) => id !== 'Custom').map((id: string) => ({ id, label: this.groupLabel(id) }))
    } catch {
      return []
    }
  }

  /** Nombres de las categorías, que pone OfficeApp (en el idioma de Molino). */
  groupLabel: (id: string) => string = (id) => id

  /** La ayuda de las funciones ({lang}_desc.json de la pieza), que se carga una vez. */
  private helpCache: Record<string, { a?: string; d?: string }> | null = null
  private functionHelp(): Record<string, { a?: string; d?: string }> {
    if (this.helpCache) return this.helpCache
    this.helpCache = {}
    const lang = (this.ew.Common?.Locale?.getCurrentLanguage?.() as string | undefined) ?? 'en'
    for (const file of [`${lang}_desc.json`, 'en_desc.json']) {
      try {
        const request = new this.ew.XMLHttpRequest()
        request.open('GET', `../../../apps/spreadsheeteditor/main/resources/formula-lang/${file}`, false)
        request.send()
        if (request.status === 200) {
          this.helpCache = JSON.parse(request.responseText)
          break
        }
      } catch {
        /* sin ayuda en ese idioma */
      }
    }
    return this.helpCache ?? {}
  }

  // -------------------------------------------------------------- portapapeles

  /** Cortar, copiar o pegar desde el menú de Molino: el proceso principal lo hace en el editor (como el teclado). */
  clipboard(action: 'cut' | 'copy' | 'paste'): void {
    this.focus()
    setTimeout(() => void window.molinoOffice.clipboard(action), 0)
  }

  // ---------------------------------------------------------------- corrector

  replaceWord(word: string): void {
    try {
      if (this.spellObject) this.api.asc_replaceMisspelledWord(word, this.spellObject)
    } catch (error) {
      console.error('corrector:', error)
    }
    this.focus()
  }

  ignoreWord(all: boolean): void {
    try {
      if (this.spellObject) this.api.asc_ignoreMisspelledWord(this.spellObject, all)
    } catch (error) {
      console.error('corrector:', error)
    }
    this.focus()
  }

  addWord(): void {
    try {
      if (this.spellObject) this.api.asc_spellCheckAddToDictionary(this.spellObject)
    } catch (error) {
      console.error('corrector:', error)
    }
    this.focus()
  }

  // ----------------------------------------------------------- texto para la IA

  /** Lo seleccionado, como texto (párrafos en líneas, celdas con tabuladores). */
  selectedText(): string {
    if (!this.api) return ''
    try {
      if (this.kind === 'cell') {
        const value = this.api.getJsApi().GetSelection().GetText?.() ?? this.api.getJsApi().GetSelection().GetValue()
        return Array.isArray(value) ? value.map((row: unknown) => (Array.isArray(row) ? row.join('\t') : String(row))).join('\n') : String(value ?? '')
      }
      const text = this.api.pluginMethod_GetSelectedText ? this.api.pluginMethod_GetSelectedText(TEXT_OPTIONS) : this.api.asc_GetSelectedText()
      return typeof text === 'string' ? text : ''
    } catch {
      return ''
    }
  }

  /** Todo el texto del documento (o de la presentación). */
  documentText(): string {
    if (!this.api) return ''
    try {
      const B = this.api.getJsApi()
      if (this.kind === 'word') return EditorSession.contentText(B.GetDocument())
      if (this.kind === 'slide') return this.slidesText(B)
      return ''
    } catch (error) {
      console.error('texto del documento:', error)
      return ''
    }
  }

  /**
   * El texto de un contenido de la API de documentos (el documento o una
   * celda), párrafo a párrafo; las tablas, fila a fila con tabuladores. Lo que
   * no se puede leer se salta (sin que falle lo demás).
   */
  private static contentText(content: Api, depth = 0): string {
    const parts: string[] = []
    const count = Number(content?.GetElementsCount?.() ?? 0)
    for (let i = 0; i < count && parts.length < 100_000; i++) {
      try {
        const el = content.GetElement(i)
        if (el?.GetClassType?.() === 'table' && depth < 4) {
          for (let r = 0; r < el.GetRowsCount(); r++) {
            const row = el.GetRow(r)
            const cells: string[] = []
            for (let c = 0; c < row.GetCellsCount(); c++) cells.push(EditorSession.contentText(row.GetCell(c).GetContent(), depth + 1).replace(/\n/g, ' '))
            parts.push(cells.join('\t'))
          }
        } else if (typeof el?.GetText === 'function') parts.push(String(el.GetText(TEXT_OPTIONS) ?? ''))
      } catch {
        /* un elemento que no se puede leer */
      }
    }
    return parts.join('\n')
  }

  /** Inserta texto donde está el cursor (o en lugar de lo seleccionado). */
  insertText(text: string): void {
    if (!this.api || !text) return
    try {
      // Varias líneas: como si se pegara texto sin formato (cada línea, un párrafo).
      // Una sola: se escribe donde está el cursor (o en lugar de lo seleccionado).
      const api = this.api
      if (/[\r\n]/.test(text) && typeof api.pluginMethod_PasteText === 'function') api.pluginMethod_PasteText(text.replace(/\r\n?/g, '\n'))
      else if (typeof api.asc_AddText === 'function') api.asc_AddText(text.replace(/[\r\n]+/g, ' '))
      else if (typeof api.asc_PasteData === 'function') api.asc_PasteData(PASTE_TEXT, text)
    } catch (error) {
      console.error('insertar texto:', error)
    }
    this.focus()
  }

  replaceSelection(text: string): void {
    this.insertText(text)
  }

  // ------------------------------------------------------------ Hojas y la IA

  private columnLetter(n: number): string {
    let out = ''
    for (let c = n; c > 0; c = Math.floor((c - 1) / 26)) out = String.fromCharCode(65 + ((c - 1) % 26)) + out
    return out
  }

  /** Lo que la IA necesita para escribir una fórmula: encabezados (fila 1), filas con datos y la celda activa. */
  sheetContext(): { columns: { letter: string; name: string }[]; first: number; last: number; cell: string } {
    const fallback = { columns: [], first: 2, last: 2, cell: 'A1' }
    if (!this.api || this.kind !== 'cell') return fallback
    try {
      const B = this.api.getJsApi()
      const sheet = B.GetActiveSheet()
      const cell = String(sheet.GetActiveCell().GetAddress(false, false, 'xlA1', false) ?? 'A1').replace(/\$/g, '')
      const used = sheet.GetUsedRange()
      const rows = Math.min(Number(used.GetRowCount?.() ?? 0) || 0, 100_000)
      const cols = Math.min(Number(used.GetColumnCount?.() ?? 0) || 0, 60)
      const startRow = Number(used.GetRow?.() ?? 1) || 1
      const startCol = Number(used.GetCol?.() ?? 1) || 1
      const columns: { letter: string; name: string }[] = []
      for (let c = 0; c < cols; c++) {
        const letter = this.columnLetter(startCol + c)
        const name = String(sheet.GetRange(`${letter}${startRow}`).GetText() ?? '').trim().slice(0, 120)
        if (name) columns.push({ letter, name })
      }
      return { columns, first: startRow + 1, last: Math.max(startRow + 1, startRow + rows - 1), cell: /^[A-Z]{1,3}[0-9]{1,7}$/.test(cell) ? cell : 'A1' }
    } catch (error) {
      console.error('contexto de la hoja:', error)
      return fallback
    }
  }

  /** ¿Vale la fórmula? Devuelve el problema (o '' si vale): las funciones tienen que existir. */
  checkFormula(formula: string): string {
    if (!/^=/.test(formula) || formula.length > 1000) return 'no es una fórmula'
    const known = new Set<string>()
    try {
      for (const group of this.api.asc_getFormulasInfo() || []) for (const f of group.asc_getFormulasArray() || []) known.add(String(f.asc_getName()).toUpperCase())
    } catch {
      return ''
    }
    // Sin el texto entre comillas: ahí puede haber cualquier cosa.
    const code = formula.replace(/"[^"]*"/g, '""')
    for (const match of code.matchAll(/([A-Za-z_][A-Za-z0-9_.]*)\s*\(/g)) {
      const name = match[1].toUpperCase().replace(/^_XLFN\./, '')
      if (!known.has(name)) return match[1]
    }
    return ''
  }

  /** La fórmula de la celda activa (o '' si no tiene). */
  activeFormula(): string {
    try {
      const B = this.api.getJsApi()
      const formula = String(B.GetActiveSheet().GetActiveCell().GetFormula?.() ?? '')
      return formula.startsWith('=') ? formula : ''
    } catch {
      return ''
    }
  }

  /** Pone una fórmula (en inglés, como la escribe la IA) en la celda activa; se puede deshacer. */
  putFormula(formula: string): void {
    if (!this.api || !formula.startsWith('=') || this.checkFormula(formula)) return
    try {
      const done = this.builder(
        function (scope) {
          Api.GetActiveSheet().GetActiveCell().SetValue(scope.molino.formula)
        },
        { formula }
      )
      if (!done) {
        // Sin el gestor de complementos: como si se escribiera en la celda, en el idioma de la hoja.
        this.api.asc_insertInCell(this.localFormula(formula), this.ew.Asc.c_oAscPopUpSelectorType.None, true)
        this.api.asc_closeCellEditor?.(false)
      }
    } catch (error) {
      console.error('poner la fórmula:', error)
    }
    this.focus()
  }

  /** La fórmula en el idioma de la hoja: nombres de las funciones y separador de argumentos. */
  private localFormula(formula: string): string {
    const separator = String(this.api.asc_getFunctionArgumentSeparator?.() ?? ',')
    let out = ''
    let quoted = false
    for (let i = 0; i < formula.length; i++) {
      const c = formula[i]
      if (c === '"') quoted = !quoted
      if (!quoted && c === ',') {
        out += separator
        continue
      }
      if (!quoted && /[A-Za-z_]/.test(c) && (i === 0 || !/[A-Za-z0-9_.$]/.test(formula[i - 1]))) {
        const name = /^[A-Za-z_][A-Za-z0-9_.]*(?=\s*\()/.exec(formula.slice(i))
        if (name) {
          out += this.api.asc_getFormulaLocaleName(name[0].toUpperCase()) || name[0]
          i += name[0].length - 1
          continue
        }
      }
      // Los decimales, con la coma si la hoja la usa (y los argumentos van con «;»).
      if (!quoted && c === '.' && separator === ';' && /\d/.test(formula[i - 1] ?? '') && /\d/.test(formula[i + 1] ?? '')) {
        out += ','
        continue
      }
      out += c
    }
    return out
  }

  /** Las celdas seleccionadas como CSV (para «Resumir los datos»). */
  selectionCsv(): string {
    try {
      const value = this.api.getJsApi().GetSelection().GetValue()
      const rows: unknown[][] = Array.isArray(value) ? value.map((r: unknown) => (Array.isArray(r) ? r : [r])) : [[value]]
      const cell = (v: unknown): string => {
        const text = String(v ?? '')
        return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
      }
      return rows
        .slice(0, 2000)
        .map((r) => r.slice(0, 60).map(cell).join(','))
        .join('\n')
        .slice(0, 20_000)
    } catch {
      return ''
    }
  }

  /** El teclado vuelve al documento (lo mismo que hace la interfaz del editor con «edit:complete»). */
  focus(): void {
    if (!this.ew) return
    try {
      this.ew.Common.NotificationCenter.trigger('edit:complete')
    } catch {
      this.ew.focus()
    }
  }

  /** El color de resaltado de lo seleccionado (Documentos). */
  private readHighlight(): void {
    try {
      const value = this.api.get_TextProps()?.get_TextPr()?.get_HighLight()
      this.state.highlight = !value || value === -1 ? null : `#${String(value.get_hex()).replace('#', '').toLowerCase()}`
    } catch {
      this.state.highlight = null
    }
  }

  /**
   * La barra de lo seleccionado (diseño D): al soltar el ratón con texto
   * seleccionado, dónde; al pulsar, escribir o desplazar, que se quite.
   */
  private watchSelection(w: Window): void {
    if (this.kind === 'cell') return
    const hide = (): void => this.onSelectionBar(null)
    // Con el puntero: el editor cancela los eventos de ratón de compatibilidad.
    w.addEventListener(
      'pointerup',
      (event: PointerEvent) => {
        if (event.button !== 0) return
        const at = this.toTop(event.clientX, event.clientY)
        // Después del editor, que es quien termina la selección.
        setTimeout(() => {
          if (this.disposed) return
          this.onSelectionBar(this.selectedText().trim() ? at : null)
        }, 30)
      },
      true
    )
    w.addEventListener('pointerdown', hide, true)
    w.addEventListener('keydown', hide, true)
    w.addEventListener('wheel', hide, { capture: true, passive: true })
  }

  /** Un punto de la ventana del editor, en la de Molino (sumando los marcos que hay por medio). */
  private toTop(x: number, y: number): { x: number; y: number } {
    let win: Window | null = this.ew as Window
    while (win && win !== window) {
      const frame = win.frameElement
      if (!frame) break
      const box = frame.getBoundingClientRect()
      x += box.left
      y += box.top
      win = win.parent
    }
    return { x, y }
  }

  /**
   * El menú del botón derecho y los avisos, con el aspecto de Molino: la
   * interfaz del editor (oculta) ya no los enseña; se avisa a OfficeApp.
   */
  private takeOver(on: (name: string, fn: (...args: Api[]) => void) => void): void {
    const api = this.api
    const ew = this.ew
    try {
      if (ew.Common?.UI) {
        ew.Common.UI.alert = (options: Api) => {
          this.notice(options)
          return { $window: { attr: () => undefined } }
        }
      }
    } catch (error) {
      console.error('avisos:', error)
    }
    if (this.kind === 'cell') {
      // Quitar el aviso del menú de la interfaz del editor (sin función: todos) y poner el nuestro.
      api.asc_unregisterCallback('asc_onContextMenu')
      on('asc_onContextMenu', (event) => {
        if (!event || typeof event.pageX !== 'number') return this.onContextMenu(null)
        this.onContextMenu(this.toTop(event.pageX, event.pageY))
      })
      return
    }
    try {
      const editorApp = this.kind === 'word' ? ew.DE : ew.PE
      const holder = editorApp.getController('DocumentHolder')
      holder.showObjectMenu = () => undefined
      holder.showPopupMenu = () => undefined
    } catch (error) {
      console.error('menú del editor:', error)
    }
    let last: ContextInfo | null = null
    const read = (event: Api): ContextInfo => {
      const area = ew.document.getElementById('editor_sdk')?.getBoundingClientRect()
      const at = this.toTop((area?.left ?? 0) + event.get_X(), (area?.top ?? 0) + event.get_Y())
      const info: ContextInfo = { ...at }
      if (this.kind === 'word' && event.get_Type() === ew.Asc.c_oAscContextMenuTypes.ChangeHdrFtr) {
        info.header = event.is_Header() ? 'header' : 'footer'
        info.page = event.get_PageNum()
      }
      return info
    }
    const spelling = (info: ContextInfo): ContextInfo => {
      this.spellObject = null
      try {
        const T = ew.Asc.c_oAscTypeSelectElement
        for (const el of api.getSelectedElements(true) || []) {
          if (el.get_ObjectType() !== T.SpellCheck) continue
          const value = el.get_ObjectValue()
          if (value.get_Checked() !== false) continue
          this.spellObject = value
          return { ...info, spelling: { word: String(value.get_Word()), variants: (value.get_Variants() || []).map(String).slice(0, 6) } }
        }
      } catch {
        /* sin corrector */
      }
      return { ...info, spelling: undefined }
    }
    on('asc_onContextMenu', (event) => {
      last = event ? spelling(read(event)) : null
      this.onContextMenu(last)
    })
    // Las propuestas del corrector llegan después del clic: el menú se rehace con ellas.
    on('asc_onSpellCheckVariantsFound', () => {
      if (last) this.onContextMenu((last = spelling(last)))
    })
  }

  private notice(options: Api): void {
    const raw: Api[] = Array.isArray(options?.buttons) && options.buttons.length ? options.buttons : ['ok']
    const primary = options?.primary ?? (raw.includes('ok') ? 'ok' : raw.includes('yes') ? 'yes' : undefined)
    const buttons = raw.map((b) =>
      typeof b === 'string' ? { value: b, label: b, primary: b === primary } : { value: String(b.value), label: String(b.caption ?? b.value), primary: Boolean(b.primary) || b.value === primary }
    )
    // El texto, sin etiquetas (el aviso se enseña como texto, nunca como HTML). Con
    // DOMParser, el documento es inerte: ni scripts ni imágenes que carguen.
    const parsed = new DOMParser().parseFromString(String(options?.msg ?? '').replace(/<br\s*\/?>/gi, '\n'), 'text/html')
    this.onNotice({
      title: String(options?.title ?? ''),
      text: (parsed.body.textContent ?? '').trim().slice(0, 4000),
      buttons,
      answer: (value) => {
        try {
          options?.callback?.call(options.scope ?? null, value, false)
        } catch (error) {
          console.error('aviso:', error)
        }
        this.focus()
      }
    })
  }

  // -------------------------------------------------------- avisos del editor

  private listen(): void {
    const api = this.api
    const s = this.state
    const on = (name: string, fn: (...args: Api[]) => void): void =>
      api.asc_registerCallback(name, (...args: Api[]) => {
        try {
          fn(...args)
        } catch (error) {
          console.error(`aviso ${name}:`, error)
        }
        this.changed()
      })
    const modified = (): void => {
      s.modified = !!(api.isDocumentModified ? api.isDocumentModified() : api.asc_isDocumentModified && api.asc_isDocumentModified())
    }
    on('asc_onDocumentModifiedChanged', modified)
    // Lo que escuchan las funciones de esta app (features/).
    const ctx = this.featureContext()
    for (const feature of FEATURES[this.kind]) feature.listen?.(ctx, on)
    const fontNames = (names: unknown[]): string[] =>
      [...new Set(names.filter((n): n is string => typeof n === 'string' && n.length > 0 && n.length < 200))].sort((a, b) => a.localeCompare(b))
    on('asc_onInitEditorFonts', (fonts: Api[]) => {
      s.fonts = fontNames((fonts || []).map((f) => f && f.asc_getFontName && f.asc_getFontName()))
    })
    // La lista ya llegó al cargar (antes de que la sesión escuchara): la guarda la
    // interfaz del editor, que está oculta pero cargada.
    const readFonts = (): void => {
      if (s.fonts.length) return
      try {
        const editorApp = this.ew.DE || this.ew.SSE || this.ew.PE
        const names = editorApp && editorApp.getCollection('Common.Collections.Fonts').pluck('name')
        if (Array.isArray(names)) s.fonts = fontNames(names)
      } catch {
        /* sin lista: la interfaz usa la suya */
      }
    }

    if (this.kind === 'word' || this.kind === 'slide') {
      on('asc_onBold', (v) => (s.bold = !!v))
      on('asc_onItalic', (v) => (s.italic = !!v))
      on('asc_onUnderline', (v) => (s.underline = !!v))
      on('asc_onStrikeout', (v) => (s.strike = !!v))
      on('asc_onPrAlign', (v) => (s.align = this.alignName(v)))
      on('asc_onFontSize', (v) => (s.size = v))
      on('asc_onFontFamily', (f) => (s.font = f && (f.get_Name ? f.get_Name() : f.asc_getFontName())))
      on('asc_onTextColor', (c) => (s.color = this.hex(c) ?? '#000000'))
      on('asc_onCanUndo', (v) => {
        s.canUndo = !!v
        s.edits++
      })
      on('asc_onCanRedo', (v) => (s.canRedo = !!v))
      on('asc_onZoomChange', (z) => (s.zoom = z))
      on('asc_onCountPages', (n) => (s.pages = n))
      on('asc_onCurrentPage', (n) => (s.page = n + 1))
      on('asc_onFocusObject', () => {
        const id = api.asc_GetCurrentNumberingId ? api.asc_GetCurrentNumberingId() : null
        if (id === null || id === undefined) {
          s.list = 'none'
          return
        }
        const format = api.asc_GetNumberingPr(id).get_Lvl(api.asc_GetCurrentNumberingLvl()).get_Format()
        const N = this.ew.Asc.c_oAscNumberingFormat
        s.list = format === N.Bullet ? 'bullets' : format === N.None ? 'none' : 'numbers'
      })
    }
    if (this.kind === 'word') {
      on('asc_onFocusObject', () => {
        this.readControl()
        this.readProtection()
      })
      on('asc_onParaStyleName', (n) => (s.style = n))
      on('asc_onPageOrient', (v) => (s.portrait = !!v))
      on('asc_onShowParaMarks', (v) => (s.marks = !!v))
      on('asc_onTextHighLight', () => this.readHighlight())
      on('asc_onPaintFormatChanged', (v) => (s.painting = !!v))
      on('asc_onReplaceAll', () => (s.search = { current: 0, total: 0 }))
      on('asc_onDocInfo', (info) => {
        if (!info) return
        const n = (v: unknown): number | undefined => (typeof v === 'number' && v >= 0 ? v : undefined)
        const read: Record<string, number | undefined> = {
          pages: n(info.get_PageCount()),
          words: n(info.get_WordsCount()),
          paragraphs: n(info.get_ParagraphCount()),
          chars: n(info.get_SymbolsCount()),
          charsSpaces: n(info.get_SymbolsWSCount())
        }
        for (const [key, value] of Object.entries(read)) if (value !== undefined) this.docInfo[key] = value
      })
      on('asc_onGetDocInfoEnd', () => {
        this.statsDone?.({ ...this.docInfo })
        this.statsDone = null
      })
      // Lo seleccionado: tabla, imagen, forma o gráfico (sus pestañas de contexto).
      on('asc_onFocusObject', (list: Api[]) => {
        const T = this.ew.Asc.c_oAscTypeSelectElement
        const found = new Set<EditorState['objects'][number]>()
        for (const el of list || []) {
          const type = el.get_ObjectType()
          if (type === T.Table) found.add('table')
          else if (type === T.Image) {
            const value = el.get_ObjectValue()
            const shape = value.get_ShapeProperties?.()
            if (value.get_ChartProperties?.() || shape?.get_FromChart?.()) found.add('chart')
            else if (shape && !shape.get_FromImage?.()) found.add('shape')
            else found.add('image')
          }
        }
        s.objects = [...found]
        if (!found.has('image')) this.cropping = false
      })
    }
    if (this.kind === 'slide') {
      on('asc_onPaintFormatChanged', (v) => (s.painting = !!v))
      on('asc_onReplaceAll', () => (s.search = { current: 0, total: 0 }))
      // Lo seleccionado en la diapositiva (sus pestañas de contexto) y la propia diapositiva.
      on('asc_onFocusObject', (list: Api[]) => {
        const T = this.ew.Asc.c_oAscTypeSelectElement
        const found = new Set<EditorState['objects'][number]>()
        for (const el of list || []) {
          const type = el.get_ObjectType()
          const value = el.get_ObjectValue()
          if (type === T.Table) found.add('table')
          else if (type === T.Chart) found.add('chart')
          else if (type === T.Image) found.add('image')
          else if (type === T.Shape) {
            found.add('shape')
            try {
              const fill = value.get_fill()
              s.shapeFill = fill && fill.get_type() === this.ew.Asc.c_oAscFill.FILL_TYPE_SOLID ? this.hex(fill.get_fill().get_color()) : null
              const stroke = value.get_stroke()
              s.lineColor = stroke && stroke.get_type() !== this.ew.Asc.c_oAscStrokeType.STROKE_NONE ? this.hex(stroke.get_color()) : null
              const width = stroke ? Number(stroke.get_width()) : 0
              if (width > 0) s.lineWidth = Math.round(((width * 72) / 25.4) * 4) / 4
            } catch {
              /* sin relleno ni contorno */
            }
          } else if (type === T.Slide) {
            try {
              s.slideHidden = !!value.get_IsHidden()
              const transition = value.get_transition()
              if (transition) {
                const N = this.ew.Asc.c_oAscSlideTransitionTypes
                const names: Record<number, string> = { [N.None]: 'none', [N.Fade]: 'fade', [N.Push]: 'push', [N.Wipe]: 'wipe', [N.Split]: 'split', [N.UnCover]: 'uncover', [N.Cover]: 'cover', [N.Clock]: 'clock', [N.Zoom]: 'zoom' }
                s.transition = names[transition.get_TransitionType()] ?? 'none'
                const ms = Number(transition.get_TransitionDuration())
                if (ms > 0) s.transitionMs = ms
              }
            } catch {
              /* sin propiedades de la diapositiva */
            }
          }
        }
        // Una imagen también llega como forma (sus propiedades): solo cuenta como imagen.
        if (found.has('image')) found.delete('shape')
        s.objects = [...found]
      })
    }
    if (this.kind === 'word' || this.kind === 'slide') {
      on('asc_onVerticalAlign', (v) => {
        s.superscript = v === this.ew.Asc.vertalign_SuperScript
        s.subscript = v === this.ew.Asc.vertalign_SubScript
      })
    }
    // Buscar: cuál es el actual (desde 0) y cuántos hay.
    on('asc_onSetSearchCurrent', (current, all) => {
      if (typeof all === 'number') s.search = { current: typeof current === 'number' && current >= 0 ? current + 1 : (s.search?.current ?? 0), total: all }
    })
    if (this.kind === 'slide') {
      // Al aplicar un tema, el editor lo copia en la presentación y avisa de él
      // como tema del documento (índice negativo, con su nombre). Se marca el
      // tema de la lista que se llama igual (si lo hay).
      let docThemes: { id: number; name: string }[] = []
      let current = -1
      const markTheme = (): void => {
        const own = current < 0 ? docThemes.find((t) => t.id === current) : undefined
        s.activeTheme = current >= 0 ? current : (s.themes.find((t) => own && t.name === own.name)?.id ?? -1)
      }
      on('asc_onInitEditorStyles', (t) => {
        const names: Api[] = (t && t[0]) || []
        // Con la carpeta de su miniatura (sdkjs/slide/themes/themeN/), para la galería de temas.
        s.themes = names.map((x) => ({ id: x.get_Index(), name: x.get_Name(), url: typeof x.get_Url === 'function' ? String(x.get_Url() || '') : '' }))
        docThemes = ((t && t[1]) || []).map((x: Api) => ({ id: x.get_Index(), name: x.get_Name() }))
        markTheme()
      })
      on('asc_onUpdateThemeIndex', (i) => {
        current = typeof i === 'number' ? i : -1
        markTheme()
      })
      on('asc_onUpdateLayout', (layouts: Api[]) => {
        s.layouts = (layouts || []).map((l, i) => ({ index: l.getIndex ? l.getIndex() : i, name: l.get_Name() || '', image: l.get_Image() }))
      })
    }
    let readCell = (_info: Api): void => undefined
    let readSheets = (): void => undefined
    if (this.kind === 'cell') {
      on('asc_onCanUndoChanged', (v) => (s.canUndo = !!v))
      on('asc_onCanRedoChanged', (v) => (s.canRedo = !!v))
      on('asc_onZoomChanged', (z) => (s.zoom = Math.floor((z + 0.005) * 100)))
      on('asc_onSelectionNameChanged', (n) => (s.selection = { ...s.selection, name: n }))
      on('asc_onSelectionMathChanged', (i) => {
        s.selection = { ...s.selection, sum: i.asc_getSum(), average: i.asc_getAverage(), count: i.asc_getCount(), max: i.asc_getMax(), min: i.asc_getMin() }
      })
      readCell = (info: Api): void => {
        if (!info) return
        this.readProtection()
        const xfs = info.asc_getXfs()
        s.bold = !!xfs.asc_getFontBold()
        s.italic = !!xfs.asc_getFontItalic()
        s.underline = !!xfs.asc_getFontUnderline()
        s.strike = !!xfs.asc_getFontStrikeout()
        s.font = xfs.asc_getFontName()
        s.size = xfs.asc_getFontSize()
        s.color = this.hex(xfs.asc_getFontColor()) ?? '#000000'
        s.fill = this.hex(xfs.asc_getFillColor())
        s.align = this.alignName(xfs.asc_getHorAlign())
        s.wrap = !!xfs.asc_getWrapText()
        const T = this.ew.Asc.c_oAscNumFormatType
        const type = xfs.asc_getNumFormatInfo() ? xfs.asc_getNumFormatInfo().asc_getType() : T.General
        s.numberFormat = type === T.Currency || type === T.Accounting ? 'currency' : type === T.Percent ? 'percent' : 'general'
        const filter = info.asc_getAutoFilterInfo()
        s.filter = !!(filter && filter.asc_getIsAutoFilter())
        // Imagen, forma o gráfico seleccionados: sus pestañas de contexto.
        const R = this.ew.Asc.c_oAscSelectionType
        const selection = info.asc_getSelectionType()
        s.objects =
          selection === R.RangeImage ? ['image'] : selection === R.RangeChart || selection === R.RangeChartText ? ['chart'] : selection === R.RangeShape || selection === R.RangeShapeText ? ['shape'] : []
        const view = api.asc_getSheetViewSettings()
        if (view) {
          s.frozen = !!view.asc_getIsFreezePane()
          s.gridlines = !!view.asc_getShowGridLines()
          s.headings = !!view.asc_getShowRowColHeaders()
        }
      }
      readSheets = (): void => {
        const n = api.asc_getWorksheetsCount()
        const sheets: EditorState['sheets'] = []
        const hidden: EditorState['hiddenSheets'] = []
        for (let i = 0; i < n; i++) {
          const name = String(api.asc_getWorksheetName(i))
          if (api.asc_isWorksheetHidden(i)) hidden.push({ index: i, name })
          else {
            let color = ''
            try {
              color = this.hex(api.asc_getWorksheetTabColor(i)) ?? ''
            } catch {
              color = ''
            }
            sheets.push({ index: i, name, color })
          }
        }
        s.sheets = sheets
        s.hiddenSheets = hidden
        s.activeSheet = api.asc_getActiveWorksheetIndex()
      }
      on('asc_onSelectionChanged', (info) => readCell(info))
      this.rereadCell = () => {
        try {
          readCell(api.asc_getCellInfo())
        } catch {
          return
        }
        this.changed()
      }
      on('asc_onSheetsChanged', () => readSheets())
      on('asc_onUpdateTabColor', () => readSheets())
      on('asc_onStopFormatPainter', () => (s.painting = false))
      on('asc_onRenameCellTextEnd', () => (s.search = { current: 0, total: 0 }))
      on('asc_onUpdateSheetViewSettings', () => this.rereadCell())
      on('asc_onActiveSheetChanged', () => readSheets())
    }

    if (this.kind === 'word') on('asc_onOnTrackRevisionsChange', (v) => (s.track = !!v))
    // Los comentarios: los lleva el controlador de la interfaz del editor, que
    // también recibe los que trae el documento al abrirse.
    const readComments = (): void => {
      const ctrl = this.commentsController()
      const models: Api[] = (ctrl && ctrl.collection && ctrl.collection.models) || []
      const text = (v: unknown): string => (typeof v === 'string' ? v : '')
      s.comments = models
        .filter((m) => !m.get('hide'))
        .map((m) => ({
          id: text(m.get('uid')),
          author: text(m.get('username')),
          date: text(m.get('date')),
          quote: text(m.get('quote')),
          text: text(m.get('comment')),
          resolved: !!m.get('resolved'),
          replies: ((m.get('replys') as Api[]) || []).map((r) => ({ id: String(r.get('id') ?? ''), author: text(r.get('username')), date: text(r.get('date')), text: text(r.get('reply')) }))
        }))
        .filter((c) => c.id)
    }
    const watchComments = (): void => {
      const ctrl = this.commentsController()
      if (!ctrl || !ctrl.collection || this.watching) return
      this.watching = true
      ctrl.collection.on('add remove change reset', () => {
        readComments()
        this.changed()
      })
      readComments()
    }

    const whenReady = (): void => {
      if (s.ready) return
      s.ready = true
      modified()
      readFonts()
      watchComments()
      try {
        if (this.kind === 'word') s.track = !!api.asc_IsTrackRevisions()
      } catch {
        /* sin control de cambios */
      }
      if (this.kind === 'cell') {
        readSheets()
        readCell(api.asc_getCellInfo())
      }
      this.takeOver(on)
      try {
        if (this.kind !== 'cell') api.asc_SetViewRulers(false)
      } catch {
        /* sin reglas en esta versión */
      }
      this.changed()
      this.focus()
    }
    on('asc_onDocumentContentReady', whenReady)
    if (api.isDocumentLoadComplete) whenReady()
  }
}
