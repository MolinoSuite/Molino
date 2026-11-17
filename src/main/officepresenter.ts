import { app, BrowserWindow, ipcMain, screen, type IpcMainEvent, type IpcMainInvokeEvent, type NativeImage, type Rectangle, type Session } from 'electron'
import { INK_COLORS, type InkOp, type InkStroke, type PresenterAction, type PresenterMark, type PresenterScreen, type PresenterState } from '@shared/officeui'
import { fmt, L } from './i18n'

/**
 * Presentar con la vista del moderador (Presentaciones), como en PowerPoint.
 *
 * Con dos pantallas (el portátil y el proyector), la presentación sigue siendo
 * la del editor de ONLYOFFICE, en la ventana de Presentaciones, que se mueve a
 * la otra pantalla y se pone a pantalla completa; en la del portátil se abre la
 * vista del moderador: una página de Molino (presenter.html) en su propia
 * ventana. Con una sola pantalla todo sigue igual, salvo que se pida la vista
 * del moderador para ensayar (se abre encima de la presentación).
 *
 * La vista del moderador no toca el editor: la interfaz de la ventana de
 * Presentaciones le manda, por aquí, las imágenes de la diapositiva que se ve y
 * de la siguiente, sus notas y en cuál va (``office:presenterState``), y ella
 * pide pasar de diapositiva o terminar (``presenter:command``), que llega a esa
 * interfaz. Lo que se dibuja encima de la presentación (tinta, puntero láser,
 * pantalla en negro o en blanco) va y viene entre las dos por
 * ``presenter:mark`` y ``office:presenterMark``, comprobado aquí (cleanMark). Cada mensaje se atiende solo de quien debe mandarlo: la interfaz de
 * esa ventana para su documento, y la página de la vista del moderador desde su
 * ventana. La vista del moderador se cierra al terminar la presentación, al
 * cerrar el documento o su ventana; y cerrarla termina la presentación.
 *
 * En pruebas (sin empaquetar), MOLINO_TEST_SCREENS=2 (o 3, 4) simula otras
 * pantallas: la principal partida en trozos, y «pantalla completa» en una de
 * ellas es ocuparla; con 1, una sola (aunque el equipo tenga más).
 */

/** Una pantalla, con lo que hace falta para colocar ventanas en ella. */
interface Screen extends PresenterScreen {
  bounds: Rectangle
  workArea: Rectangle
  /** Simulada (solo en pruebas): la ventana la ocupa en vez de ponerse a pantalla completa. */
  simulated: boolean
}

interface Show {
  /** La ventana de Presentaciones y el documento que presenta. */
  owner: BrowserWindow
  doc: string
  /** La ventana de la vista del moderador (null: sin ella). */
  presenter: BrowserWindow | null
  /** La pantalla a la que se ha llevado la presentación (null: se queda donde está). */
  target: Screen | null
  /** Dónde estaba la ventana antes (para dejarla igual al terminar). */
  before: { bounds: Rectangle; maximized: boolean } | null
  /** Lo último que mandó la interfaz (para la vista del moderador cuando termina de cargar). */
  state: PresenterState | null
  ending: boolean
}

/** Lo que la vista del moderador necesita de officewin.ts. */
export interface PresenterHost {
  session: Session
  preload: string
  /** La dirección de su página (molino://office/__molino__/ui/presenter.html). */
  page: string
  icon: NativeImage | string | undefined
  /** En la barra de tareas, con Presentaciones (officeapps.ts). */
  appDetails: Electron.AppDetailsOptions
  /** Los argumentos de las ventanas de Presentaciones (idioma, tema…). */
  args: (dark: boolean) => string[]
  dark: () => boolean
  /** La ventana de Presentaciones cuya interfaz manda el mensaje (solo desde la página de su interfaz). */
  uiWindow: (event: IpcMainEvent | IpcMainInvokeEvent) => BrowserWindow | null
  /** ¿Es ese documento de esa ventana? */
  hasDoc: (window: BrowserWindow, doc: string) => boolean
  /** Las ventanas de Presentaciones abiertas (para avisarles de las pantallas). */
  windows: () => BrowserWindow[]
}

const ACTIONS: ReadonlySet<string> = new Set<PresenterAction>(['next', 'prev', 'first', 'last', 'goto', 'end'])
const IMAGE = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/
const MAX_IMAGE = 8 * 1024 * 1024
const MAX_SLIDES = 10_000
const ACCENT = /^#[0-9a-f]{6}$/i

/** Una imagen de una diapositiva, si es de verdad una imagen PNG o JPEG en base64 y no muy grande. */
function image(raw: unknown): string | null {
  return typeof raw === 'string' && raw.length <= MAX_IMAGE && IMAGE.test(raw) ? raw : null
}

function slideIndex(raw: unknown, max = MAX_SLIDES): number | null {
  return typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw < max ? raw : null
}

/** Lo que manda la interfaz para la vista del moderador, comprobado (null si no vale). */
function cleanState(raw: unknown): PresenterState | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Record<string, unknown>
  const count = slideIndex(s.count, MAX_SLIDES + 1)
  const index = slideIndex(s.index, MAX_SLIDES + 1)
  if (count === null || index === null || count < 1 || index > count) return null
  let next: PresenterState['next'] = null
  if (s.next && typeof s.next === 'object') {
    const n = s.next as Record<string, unknown>
    const at = slideIndex(n.index, count)
    if (at !== null) next = { index: at, image: image(n.image) }
  }
  return {
    title: typeof s.title === 'string' ? s.title.slice(0, 300) : '',
    index,
    count,
    finished: s.finished === true,
    notes: typeof s.notes === 'string' ? s.notes.slice(0, 20_000) : '',
    current: image(s.current),
    next
  }
}

// ------------------------------------------------------------ tinta y láser

/** Lo más que se acepta de un trazo y de una diapositiva (cada número es una coordenada). */
const MAX_OP_NUMBERS = 4_000
const MAX_STROKE_NUMBERS = 40_000
const MAX_STROKES = 1_000
const STROKE_ID = /^[a-z][0-9a-z]{0,23}$/
const COLORS: ReadonlySet<string> = new Set(INK_COLORS)

/** Una coordenada en proporción de la diapositiva (de 0 a 1). */
const unit = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1

/** Una lista de puntos (x0, y0, x1, y1…), todos de 0 a 1, de pares y sin pasarse; null si no vale. */
function points(raw: unknown, max: number): number[] | null {
  if (!Array.isArray(raw) || raw.length % 2 !== 0 || raw.length > max) return null
  for (const n of raw) if (!unit(n)) return null
  // Con cuatro decimales basta (y lo que se reenvía es una copia hecha aquí).
  return raw.map((n: number) => Math.round(n * 10_000) / 10_000)
}

function stroke(raw: unknown): InkStroke | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Record<string, unknown>
  const list = points(s.points, MAX_STROKE_NUMBERS)
  if (typeof s.id !== 'string' || !STROKE_ID.test(s.id) || (s.tool !== 'pen' && s.tool !== 'highlighter')) return null
  if (typeof s.color !== 'string' || !COLORS.has(s.color) || (s.width !== 1 && s.width !== 2 && s.width !== 3) || !list) return null
  return { id: s.id, tool: s.tool, color: s.color as InkStroke['color'], width: s.width, points: list }
}

function inkOp(raw: unknown): InkOp | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const slide = slideIndex(o.slide, MAX_SLIDES + 1)
  if (slide === null) return null
  if (o.op === 'begin') {
    const s = stroke(o.stroke)
    return s && s.points.length <= MAX_OP_NUMBERS ? { op: 'begin', slide, stroke: s } : null
  }
  if (o.op === 'add') {
    const list = points(o.points, MAX_OP_NUMBERS)
    return typeof o.id === 'string' && STROKE_ID.test(o.id) && list ? { op: 'add', slide, id: o.id, points: list } : null
  }
  if (o.op === 'erase') {
    const ids = Array.isArray(o.ids) && o.ids.length <= MAX_STROKES ? o.ids : null
    return ids && ids.every((id) => typeof id === 'string' && STROKE_ID.test(id)) ? { op: 'erase', slide, ids: ids as string[] } : null
  }
  if (o.op === 'clear') return { op: 'clear', slide }
  return null
}

/**
 * Tinta, láser o pantalla en negro, comprobado (null si no vale): coordenadas de
 * 0 a 1, colores de la lista, grosores y tamaños con límite. ``sync`` (toda la
 * tinta de una diapositiva) solo vale de la ventana de la presentación.
 */
function cleanMark(raw: unknown, fromUi: boolean): PresenterMark | null {
  if (!raw || typeof raw !== 'object') return null
  const m = raw as Record<string, unknown>
  if (m.kind === 'ink') {
    const op = inkOp(m.op)
    return op ? { kind: 'ink', op } : null
  }
  if (m.kind === 'laser') {
    if (m.at === null) return { kind: 'laser', at: null }
    const at = m.at && typeof m.at === 'object' ? (m.at as Record<string, unknown>) : null
    return at && unit(at.x) && unit(at.y) ? { kind: 'laser', at: { x: at.x, y: at.y } } : null
  }
  if (m.kind === 'screen') return m.screen === 'black' || m.screen === 'white' || m.screen === null ? { kind: 'screen', screen: m.screen } : null
  if (m.kind === 'sync' && fromUi) {
    const slide = slideIndex(m.slide, MAX_SLIDES + 1)
    if (slide === null || !Array.isArray(m.strokes) || m.strokes.length > MAX_STROKES) return null
    const strokes: InkStroke[] = []
    for (const one of m.strokes) {
      const s = stroke(one)
      if (!s) return null
      strokes.push(s)
    }
    return { kind: 'sync', slide, strokes }
  }
  return null
}

export class OfficePresenter {
  private readonly shows = new Map<BrowserWindow, Show>()

  constructor(private readonly host: PresenterHost) {
    this.register()
    // Se conecta o se quita una pantalla (el proyector): las ventanas de Presentaciones actualizan su lista.
    const changed = (): void => {
      const list = this.publicScreens()
      for (const w of host.windows()) if (!w.isDestroyed()) w.webContents.send('office:presenterScreens', list)
    }
    screen.on('display-added', changed)
    screen.on('display-removed', changed)
  }

  // --------------------------------------------------------------- pantallas

  private screens(): Screen[] {
    const primary = screen.getPrimaryDisplay()
    const simulated = !app.isPackaged ? Number(process.env.MOLINO_TEST_SCREENS) : NaN
    if (Number.isInteger(simulated) && simulated >= 1 && simulated <= 4) {
      // Pruebas: la pantalla principal, en trozos iguales de izquierda a derecha (o entera, con 1).
      const area = primary.workArea
      const width = Math.floor(area.width / simulated)
      return Array.from({ length: simulated }, (_, i) => {
        const part = { x: area.x + i * width, y: area.y, width, height: area.height }
        return { id: 9001 + i, label: fmt(L.main.office.presenter.simulated, { n: i + 1 }), primary: i === 0, bounds: part, workArea: part, simulated: true }
      })
    }
    return screen
      .getAllDisplays()
      .sort((a, b) => a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y)
      .map((d, i) => {
        const isPrimary = d.id === primary.id
        const size = { n: i + 1, width: Math.round(d.size.width * d.scaleFactor), height: Math.round(d.size.height * d.scaleFactor) }
        const label = fmt(isPrimary ? L.main.office.presenter.primary : L.main.office.presenter.screen, size)
        return { id: d.id, label, primary: isPrimary, bounds: d.bounds, workArea: d.workArea, simulated: false }
      })
  }

  private publicScreens(): PresenterScreen[] {
    return this.screens().map(({ id, label, primary }) => ({ id, label, primary }))
  }

  // ------------------------------------------------------------- presentar

  /**
   * Antes de empezar a presentar: con dos pantallas, la ventana va a la de la
   * presentación (la elegida o, si no, la que no es la principal) y la vista del
   * moderador se abre en otra (la principal, si está libre). Con una, la vista del
   * moderador solo si se pide para ensayar.
   */
  private start(owner: BrowserWindow, doc: string, options: { presenter: boolean; screen: number | null; rehearse: boolean; accent: string }): { presenter: boolean } {
    this.finish(owner)
    const list = this.screens()
    const show: Show = { owner, doc, presenter: null, target: null, before: null, state: null, ending: false }
    let presenterOn: Screen | null = null
    if (list.length > 1) {
      const chosen = options.screen === null ? undefined : list.find((s) => s.id === options.screen)
      const target = chosen ?? list.find((s) => !s.primary) ?? list[1]
      show.target = target
      if (options.presenter || options.rehearse) presenterOn = list.find((s) => s.primary && s.id !== target.id) ?? list.find((s) => s.id !== target.id) ?? null
    } else if (options.rehearse && list.length === 1) {
      presenterOn = list[0]
    }
    this.shows.set(owner, show)
    // Con la vista del moderador encima (o la ventana en otra pantalla), la presentación tiene que seguir
    // dibujándose aunque Windows la dé por tapada: si no, sus animaciones y transiciones se paran.
    if (!owner.isDestroyed()) owner.webContents.setBackgroundThrottling(false)
    if (show.target) this.moveTo(show, show.target)
    if (presenterOn) show.presenter = this.openPresenter(show, presenterOn, options.accent)
    return { presenter: show.presenter !== null }
  }

  /** La ventana de Presentaciones, a la pantalla de la presentación (aún sin pantalla completa: eso lo pide el editor). */
  private moveTo(show: Show, target: Screen): void {
    const w = show.owner
    show.before = { bounds: w.getNormalBounds(), maximized: w.isMaximized() }
    if (w.isFullScreen()) w.setFullScreen(false)
    if (w.isMaximized()) w.unmaximize()
    const area = target.workArea
    const width = Math.min(show.before.bounds.width, area.width)
    const height = Math.min(show.before.bounds.height, area.height)
    w.setBounds({ x: area.x + Math.round((area.width - width) / 2), y: area.y + Math.round((area.height - height) / 2), width, height })
  }

  private openPresenter(show: Show, where: Screen, accent: string): BrowserWindow {
    const dark = this.host.dark()
    const area = where.workArea
    const win = new BrowserWindow({
      x: area.x,
      y: area.y,
      width: area.width,
      height: area.height,
      minWidth: 640,
      minHeight: 420,
      show: false,
      title: L.main.office.presenter.title,
      backgroundColor: dark ? '#1c1d20' : '#ffffff',
      icon: this.host.icon,
      titleBarStyle: 'hidden',
      titleBarOverlay: { color: dark ? '#1c1d20' : '#ffffff', symbolColor: dark ? '#e5e7eb' : '#1f2937', height: 40 },
      autoHideMenuBar: true,
      webPreferences: {
        session: this.host.session,
        preload: this.host.preload,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
        allowRunningInsecureContent: false,
        webviewTag: false,
        spellcheck: false,
        navigateOnDragDrop: false,
        devTools: !app.isPackaged,
        additionalArguments: this.host.args(dark)
      }
    })
    win.removeMenu()
    if (process.platform === 'win32') win.setAppDetails(this.host.appDetails)
    win.once('ready-to-show', () => {
      if (win.isDestroyed()) return
      if (where.simulated) win.setBounds(area)
      else win.maximize()
      win.show()
      win.focus()
    })
    win.on('closed', () => {
      if (show.presenter === win) show.presenter = null
      // Cerrar la vista del moderador termina la presentación (como en PowerPoint).
      if (!show.ending && this.shows.get(show.owner) === show && !show.owner.isDestroyed()) {
        show.owner.webContents.send('office:presenterCommand', { doc: show.doc, action: 'end' })
      }
    })
    const query = new URLSearchParams({ accent: ACCENT.test(accent) ? accent : '' })
    void win.loadURL(`${this.host.page}?${query}`)
    return win
  }

  /**
   * El editor entra o sale de presentar (bridge.js → office:fullscreen). Con la
   * vista del moderador, esta se queda delante con el teclado. En una pantalla
   * simulada, la ventana la ocupa (true: ya está hecho, no hay que poner la
   * ventana a pantalla completa).
   */
  fullscreen(owner: BrowserWindow, on: boolean): boolean {
    const show = this.shows.get(owner)
    if (!show) return false
    if (on && show.presenter) {
      const presenter = show.presenter
      setTimeout(() => {
        if (presenter.isDestroyed() || !presenter.isVisible()) return
        presenter.moveTop()
        presenter.focus()
      }, 400)
    }
    if (!show.target?.simulated) return false
    if (on) owner.setBounds(show.target.bounds)
    return true
  }

  /** Termina: se cierra la vista del moderador y la ventana vuelve adonde estaba. */
  private finish(owner: BrowserWindow, restore = true): void {
    const show = this.shows.get(owner)
    if (!show) return
    this.shows.delete(owner)
    show.ending = true
    if (!owner.isDestroyed()) owner.webContents.setBackgroundThrottling(true)
    if (show.presenter && !show.presenter.isDestroyed()) show.presenter.close()
    show.presenter = null
    const before = show.before
    if (!restore || !before || owner.isDestroyed()) return
    const put = (): void => {
      if (owner.isDestroyed()) return
      owner.setBounds(before.bounds)
      if (before.maximized) owner.maximize()
    }
    if (owner.isFullScreen()) {
      // Primero sale de la pantalla completa (lo pide el editor al terminar); después, a su sitio.
      let done = false
      const once = (): void => {
        if (done) return
        done = true
        put()
      }
      owner.once('leave-full-screen', once)
      setTimeout(once, 2000)
    } else put()
  }

  /** Se cierra un documento: si es el que se presenta, se termina (aunque el editor ya no lo diga). */
  closeDoc(owner: BrowserWindow, doc: string): void {
    const show = this.shows.get(owner)
    if (!show || show.doc !== doc) return
    if (!owner.isDestroyed() && owner.isFullScreen()) owner.setFullScreen(false)
    this.finish(owner)
  }

  /** Se ha cerrado la ventana de Presentaciones. */
  closeOwner(owner: BrowserWindow): void {
    this.finish(owner, false)
  }

  /** El tema ha cambiado (Ajustes): también en la vista del moderador. */
  setDark(dark: boolean): void {
    for (const show of this.shows.values()) {
      const win = show.presenter
      if (!win || win.isDestroyed()) continue
      win.setBackgroundColor(dark ? '#1c1d20' : '#ffffff')
      win.setTitleBarOverlay({ color: dark ? '#1c1d20' : '#ffffff', symbolColor: dark ? '#e5e7eb' : '#1f2937', height: 40 })
      win.webContents.send('office:theme', dark)
    }
  }

  // ------------------------------------------------------------------ canales

  /** La presentación cuya vista del moderador manda el mensaje (solo su página, en su ventana) (A01:2025). */
  private fromPresenter(event: IpcMainEvent): Show | null {
    const frame = event.senderFrame
    for (const show of this.shows.values()) {
      const win = show.presenter
      if (!win || win.isDestroyed() || event.sender !== win.webContents) continue
      return frame && frame === win.webContents.mainFrame && frame.url.startsWith(this.host.page) ? show : null
    }
    return null
  }

  /** La presentación de la ventana cuya interfaz manda el mensaje, si es de ese documento. */
  private fromUi(event: IpcMainEvent | IpcMainInvokeEvent, doc: unknown): Show | null {
    const owner = this.host.uiWindow(event)
    const show = owner ? this.shows.get(owner) : undefined
    return show && typeof doc === 'string' && show.doc === doc ? show : null
  }

  private register(): void {
    // ---- la interfaz de la ventana de Presentaciones
    ipcMain.handle('office:presenterScreens', (event) => (this.host.uiWindow(event) ? this.publicScreens() : []))
    ipcMain.handle('office:presenterStart', (event, raw: unknown) => {
      const { doc, presenter, screen: id, rehearse, accent } = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
      const owner = this.host.uiWindow(event)
      if (!owner || typeof doc !== 'string' || !this.host.hasDoc(owner, doc)) return { presenter: false }
      return this.start(owner, doc, {
        presenter: presenter === true,
        screen: typeof id === 'number' && Number.isSafeInteger(id) ? id : null,
        rehearse: rehearse === true,
        accent: typeof accent === 'string' && ACCENT.test(accent) ? accent : ''
      })
    })
    ipcMain.on('office:presenterState', (event, raw: unknown) => {
      const { doc, state } = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
      const show = this.fromUi(event, doc)
      const clean = show ? cleanState(state) : null
      if (!show || !clean) return
      show.state = clean
      if (show.presenter && !show.presenter.isDestroyed()) show.presenter.webContents.send('presenter:state', clean)
    })
    ipcMain.on('office:presenterEnd', (event, raw: unknown) => {
      const show = this.fromUi(event, raw)
      if (show) this.finish(show.owner)
    })
    // Tinta, láser y pantalla en negro de la ventana de la presentación, a la vista del moderador.
    ipcMain.on('office:presenterMark', (event, raw: unknown) => {
      const { doc, mark } = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
      const show = this.fromUi(event, doc)
      const clean = show ? cleanMark(mark, true) : null
      if (!show || !clean || !show.presenter || show.presenter.isDestroyed()) return
      show.presenter.webContents.send('presenter:mark', clean)
    })

    // ---- la vista del moderador
    ipcMain.on('presenter:ready', (event) => {
      const show = this.fromPresenter(event)
      if (show?.state) event.sender.send('presenter:state', show.state)
      // Lo que ya hay dibujado (y si está en negro): lo manda la ventana de la presentación.
      if (show && !show.owner.isDestroyed()) show.owner.webContents.send('office:presenterReady', show.doc)
    })
    // Tinta, láser y pantalla en negro de la vista del moderador, a la presentación.
    ipcMain.on('presenter:mark', (event, raw: unknown) => {
      const show = this.fromPresenter(event)
      const clean = show ? cleanMark(raw, false) : null
      if (!show || !clean || show.owner.isDestroyed()) return
      show.owner.webContents.send('office:presenterMark', { doc: show.doc, mark: clean })
    })
    ipcMain.on('presenter:command', (event, raw: unknown) => {
      const show = this.fromPresenter(event)
      if (!show || show.owner.isDestroyed()) return
      const { action, slide } = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
      if (typeof action !== 'string' || !ACTIONS.has(action)) return
      const at = action === 'goto' ? slideIndex(slide) : null
      if (action === 'goto' && at === null) return
      show.owner.webContents.send('office:presenterCommand', { doc: show.doc, action, ...(at === null ? {} : { slide: at }) })
    })
  }
}
