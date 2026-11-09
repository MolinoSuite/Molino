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

/** La API de los editores no tiene tipos: todo lo que viene de ella es «any». */
type Api = any

export type Align = 'left' | 'center' | 'right' | 'justify'

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
  sheets: { index: number; name: string }[]
  activeSheet: number
  // Presentaciones
  themes: { id: number; name: string }[]
  activeTheme: number
  layouts: { index: number; name: string; image: string }[]
}

function initialState(): EditorState {
  return {
    ready: false,
    modified: false,
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    align: 'left',
    style: 'Normal',
    font: '',
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
    themes: [],
    activeTheme: -1,
    layouts: []
  }
}

const LISTS = {
  bullets:
    '{"Type":"bullet","Lvl":[{"lvlJc":"left","suff":"tab","numFmt":{"val":"bullet"},"lvlText":"·","rPr":{"rFonts":{"ascii":"Symbol","cs":"Symbol","eastAsia":"Symbol","hAnsi":"Symbol"}}}]}',
  numbers: '{"Type":"number","Lvl":[{"lvlJc":"left","suff":"tab","numFmt":{"val":"decimal"},"lvlText":"%1."}]}',
  none: '{"Type":"remove"}'
}

export class EditorSession {
  readonly state: EditorState = initialState()
  private ew: Api = null
  private api: Api = null
  private readonly listeners = new Set<() => void>()
  private pending = 0
  private disposed = false
  private attached = false

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
    this.api.put_ListTypeCustom(JSON.parse(LISTS[this.state.list === which ? 'none' : which]))
  }

  private newSheetName(): string {
    const used = new Set(this.state.sheets.map((s) => s.name.toLowerCase()))
    let n = this.state.sheets.length + 1
    while (used.has(`${this.sheetName}${n}`.toLowerCase())) n++
    return `${this.sheetName}${n}`
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
      zoomOut: () => api.zoomOut()
    }
    if (this.kind === 'word') {
      return {
        ...text,
        style: (n) => api.put_Style(n),
        clearFormat: () => api.ClearFormating(),
        table: (d) => {
          const [cols, rows] = String(d || '3x3').split('x').map(Number)
          api.put_Table(cols, rows)
        },
        pageBreak: () => api.put_AddPageBreak(),
        portrait: () => api.change_PageOrient(true),
        landscape: () => api.change_PageOrient(false),
        marks: () => api.put_ShowParaMarks(!s.marks)
      }
    }
    if (this.kind === 'cell') {
      return {
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
        currency: () => api.asc_setCellStyle('Currency'),
        percent: () => api.asc_setCellStyle('Percent'),
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
          props.putType(({ columns: T.barNormal, lines: T.lineNormal, pie: T.pie } as Record<string, number>)[which || 'columns'])
          api.asc_addChartDrawingObject(props)
        },
        rows: () => api.asc_insertCells(ew.Asc.c_oAscInsertOptions.InsertRows),
        columns: () => api.asc_insertCells(ew.Asc.c_oAscInsertOptions.InsertColumns),
        goSheet: (i) => api.asc_showWorksheet(Number(i)),
        newSheet: () => api.asc_addWorksheet(this.newSheetName()),
        image: () => api.asc_addImage(),
        undo: () => api.asc_Undo(),
        redo: () => api.asc_Redo(),
        zoomIn: () => api.asc_setZoom(Math.min(5, (s.zoom + 10) / 100)),
        zoomOut: () => api.asc_setZoom(Math.max(0.1, (s.zoom - 10) / 100))
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
      shape: (f) => api.StartAddShape(f || 'rect', true),
      present: (from) => ew.Common.NotificationCenter.trigger('preview:start', from === 'here' ? api.getCurrentPage() : 0, false, false, from === 'here'),
      fit: () => api.zoomFitToPage()
    }
  }

  private common(): Record<string, () => void> {
    return {
      save: () => this.api.asc_Save(false),
      savePdf: () => this.api.asc_DownloadAs(new this.ew.Asc.asc_CDownloadOptions(this.ew.Asc.c_oAscFileType.PDF))
    }
  }

  /** ¿Tiene esta app la orden? */
  can(command: string): boolean {
    if (!this.api) return false
    return command in this.commands() || command in this.common()
  }

  /** Hace una orden; devuelve si se pudo. El teclado vuelve después al documento. */
  run(command: string, value?: string): boolean {
    if (!this.api) return false
    const fn = this.commands()[command] ?? this.common()[command]
    if (!fn) return false
    try {
      fn(value)
    } catch (error) {
      console.error(`orden ${command}:`, error)
      return false
    }
    this.focus()
    return true
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

    if (this.kind === 'word' || this.kind === 'slide') {
      on('asc_onBold', (v) => (s.bold = !!v))
      on('asc_onItalic', (v) => (s.italic = !!v))
      on('asc_onUnderline', (v) => (s.underline = !!v))
      on('asc_onStrikeout', (v) => (s.strike = !!v))
      on('asc_onPrAlign', (v) => (s.align = this.alignName(v)))
      on('asc_onFontSize', (v) => (s.size = v))
      on('asc_onFontFamily', (f) => (s.font = f && (f.get_Name ? f.get_Name() : f.asc_getFontName())))
      on('asc_onTextColor', (c) => (s.color = this.hex(c) ?? '#000000'))
      on('asc_onCanUndo', (v) => (s.canUndo = !!v))
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
      on('asc_onParaStyleName', (n) => (s.style = n))
      on('asc_onPageOrient', (v) => (s.portrait = !!v))
      on('asc_onShowParaMarks', (v) => (s.marks = !!v))
    }
    if (this.kind === 'slide') {
      on('asc_onInitEditorStyles', (t) => {
        const names: Api[] = (t && t[0]) || []
        s.themes = names.map((x) => ({ id: x.get_Index(), name: x.get_Name() }))
      })
      on('asc_onUpdateThemeIndex', (i) => (s.activeTheme = i))
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
      }
      readSheets = (): void => {
        const n = api.asc_getWorksheetsCount()
        const sheets: { index: number; name: string }[] = []
        for (let i = 0; i < n; i++) if (!api.asc_isWorksheetHidden(i)) sheets.push({ index: i, name: api.asc_getWorksheetName(i) })
        s.sheets = sheets
        s.activeSheet = api.asc_getActiveWorksheetIndex()
      }
      on('asc_onSelectionChanged', (info) => readCell(info))
      on('asc_onSheetsChanged', () => readSheets())
      on('asc_onActiveSheetChanged', () => readSheets())
    }

    const whenReady = (): void => {
      if (s.ready) return
      s.ready = true
      modified()
      if (this.kind === 'cell') {
        readSheets()
        readCell(api.asc_getCellInfo())
      }
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
