import { readFile, stat } from 'node:fs/promises'
import { basename, dirname, extname, join, normalize, parse, resolve, sep } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, session as sessions, type IpcMainEvent, type IpcMainInvokeEvent, type Session } from 'electron'
import { EngineError, type EngineClient } from './engine'
import { fmt, L, lang } from './i18n'
import { setOfficeSession } from './security'
import { log } from './log'
import { type OfficePiece, pieceVersion } from './office'
import { cleanFontIndex, fontAllowed, fontFingerprint, fontFolders, loadFontIndex, saveFontIndex } from './officefonts'

/**
 * Las ventanas de Documentos, Hojas y Presentaciones.
 *
 * Los editores son los de ONLYOFFICE (la pieza, office.ts) y corren aparte de
 * todo lo de Molino PDF:
 * - **su propia sesión**, en memoria, que solo deja pedir ``molino://office/``
 *   (y ``data:`` o ``blob:``): ni red ni la interfaz de Molino PDF;
 * - **su propio anfitrión**, ``molino://office/``, que solo sirve la pieza, el
 *   índice de fuentes, las fuentes que lista (y que están en una carpeta de
 *   fuentes), el puente y las imágenes de los documentos abiertos;
 * - **sandbox, sin Node, contexto aislado**, sin navegar ni abrir ventanas;
 * - **canales** (preload/office.ts) que solo dan acceso al documento de su
 *   ventana; las rutas del usuario se quedan en este proceso.
 *
 * Los editores necesitan scripts en línea, ``eval`` y WebAssembly, así que su
 * política de contenido es más abierta que la de Molino PDF; lo que protege es
 * lo de arriba. Los documentos se abren, guardan y exportan en el motor
 * aislado (ops/office.py), con x2t dentro de su AppContainer.
 */

const PARTITION = 'molino-office'
const HOST = 'office'
const ORIGIN = `molino://${HOST}`
type Kind = 'word' | 'cell' | 'slide'

/** Extensiones que abren los editores. */
export const OFFICE_EXTENSIONS = new Set(['.docx', '.doc', '.odt', '.rtf', '.xlsx', '.xls', '.ods', '.pptx', '.ppt', '.odp'])
export function isOfficeFile(path: string): boolean {
  return OFFICE_EXTENSIONS.has(extname(path).toLowerCase())
}

// Códigos de formato de x2t con los que el editor pide guardar (ver office.py).
const SAVE_FORMATS: Record<Kind, Record<number, string>> = {
  word: { 65: '.docx', 67: '.odt', 68: '.rtf' },
  cell: { 257: '.xlsx', 259: '.ods' },
  slide: { 129: '.pptx', 131: '.odp' }
}
const DEFAULT_SUFFIX: Record<Kind, string> = { word: '.docx', cell: '.xlsx', slide: '.pptx' }
const PDF_FORMAT = 513
const IMAGE_SUFFIXES = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp']
const MAX_IMAGE = 50 * 1024 * 1024
const DOC_ID = /^o[0-9a-f]{16}$/
const MEDIA_NAME = /^[A-Za-z0-9_-]{1,64}\.(png|jpe?g|gif|bmp|tiff?|svg|webp|emf|wmf|wdp)$/i

const CSP = [
  "default-src 'none'",
  // Los editores llevan scripts en línea, usan eval y WebAssembly.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data: blob:",
  "connect-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "frame-src 'self'",
  "base-uri 'self'",
  "form-action 'none'",
  "object-src 'none'"
].join('; ')

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
  '.mp3': 'audio/mpeg',
  '.txt': 'text/plain; charset=utf-8',
  '.dic': 'text/plain; charset=utf-8',
  '.aff': 'text/plain; charset=utf-8',
  // Plantillas de la interfaz de los editores (las piden como texto).
  '.template': 'text/plain; charset=utf-8',
  '.cur': 'image/x-icon',
  '.bin': 'application/octet-stream'
}
/** Lo demás de la pieza (temas .pptx, licencias…): datos, nunca algo que se ejecute (nosniff). */
const DATA = 'application/octet-stream'
const BRIDGE_TAG = '<script src="/__molino__/bridge.js"></script>'

interface OpenDoc {
  doc: string
  kind: Kind
  name: string
  /** Archivo del usuario (null: documento nuevo aún sin guardar). */
  path: string | null
  /** Editor.bin en base64 hasta que el editor lo pide. */
  canvas: string | null
  canvasLength: number
  modified: boolean
  closing: boolean
  window: BrowserWindow
  /** Guardado pedido al cerrar: se resuelve con el código del editor (0 = bien). */
  pendingSave: ((code: number) => void) | null
}

interface Setup {
  /** Carpeta de la pieza instalada. */
  piece: string
  allFonts: string
  listed: Set<string>
  folders: string[]
}

export class OfficeWindows {
  private readonly docs = new Map<number, OpenDoc>()
  private setup: Setup | null = null
  private configuring: Promise<void> = Promise.resolve()
  /** La primera configuración (al arrancar el motor): abrir espera a que acabe. */
  private readonly firstConfigured: Promise<void>
  private markConfigured: () => void = () => undefined
  private readonly session: Session

  constructor(
    private readonly engine: EngineClient,
    private readonly piece: OfficePiece,
    /** Carpeta de la interfaz compilada (ahí está office/bridge.js). */
    private readonly rendererDir: string
  ) {
    this.firstConfigured = new Promise((done) => {
      this.markConfigured = done
    })
    this.session = sessions.fromPartition(PARTITION)
    hardenOfficeSession(this.session)
    setOfficeSession(this.session)
    this.session.protocol.handle('molino', (request) => this.serve(request))
    this.registerIpc()
  }

  /** ¿Hay algún documento de oficina abierto? (entonces la pieza no se puede quitar). */
  get busy(): boolean {
    return this.docs.size > 0
  }

  /** ¿Es una ventana de editor? (para que el resto de Molino no la toque). */
  owns(window: BrowserWindow): boolean {
    return [...this.docs.values()].some((d) => d.window === window)
  }

  // ======================================================== motor y fuentes

  /**
   * Configura el motor con la pieza instalada y su índice de fuentes (lo crea
   * si hace falta). Al arrancar el motor y al añadir o quitar la pieza.
   */
  configure(): Promise<void> {
    this.configuring = this.configuring.catch(() => undefined).then(() => this.doConfigure())
    return this.configuring
  }

  private async doConfigure(): Promise<void> {
    try {
      const dir = await this.piece.ready()
      if (!dir) {
        this.setup = null
        await this.engine.request('office.configure', {}, { priority: 9 })
        return
      }
      const version = pieceVersion()
      const fingerprint = await fontFingerprint(version)
      let index = await loadFontIndex(this.piece.root, fingerprint)
      if (!index) {
        await this.engine.request('office.configure', { piece: version }, { priority: 9 })
        const { result, binary } = await this.engine.request<{ allFonts?: unknown }>('office.fonts', {}, { priority: 9 })
        index = cleanFontIndex(typeof result.allFonts === 'string' ? result.allFonts : '')
        if (!binary?.length) throw new Error('índice de fuentes sin font_selection.bin')
        await saveFontIndex(this.piece.root, fingerprint, index.text, binary)
        log.info(`oficina: índice de fuentes creado (${index.files.length} archivos)`)
      }
      await this.engine.request('office.configure', { piece: version, fonts: fingerprint }, { priority: 9 })
      this.setup = {
        piece: dir,
        allFonts: index.text,
        listed: new Set(index.files.map((f) => f.toLowerCase())),
        folders: [...fontFolders(), join(dir, 'fonts')]
      }
    } catch (error) {
      this.setup = null
      log.warn(`oficina: no se pudo preparar (${error instanceof Error ? `${error.name}: ${error.message.slice(0, 200)}` : '?'})`)
    } finally {
      this.markConfigured()
    }
  }

  // ================================================================ abrir

  /** Abre un documento del usuario en una ventana de su editor (o la trae delante si ya está abierto). */
  async open(path: string): Promise<boolean> {
    for (const open of this.docs.values()) {
      if (open.path && resolve(open.path).toLowerCase() === resolve(path).toLowerCase()) {
        if (open.window.isMinimized()) open.window.restore()
        open.window.focus()
        return true
      }
    }
    return this.load(basename(path), path, () => this.engine.request<{ doc?: unknown; kind?: unknown }>('office.open', { path }, { priority: 7 }))
  }

  /** Documento nuevo de un editor, desde la plantilla vacía de la pieza. */
  async create(kind: Kind): Promise<boolean> {
    const name = `${L.main.office.filters[kind]}${DEFAULT_SUFFIX[kind]}`
    return this.load(name, null, () => this.engine.request<{ doc?: unknown; kind?: unknown }>('office.new', { kind }, { priority: 7 }))
  }

  private async load(
    name: string,
    path: string | null,
    ask: () => Promise<{ result: { doc?: unknown; kind?: unknown }; binary?: Buffer }>
  ): Promise<boolean> {
    // Al abrir desde el Explorador, el motor puede estar aún arrancando.
    await Promise.race([this.firstConfigured, new Promise((done) => setTimeout(done, 90_000))])
    await this.configuring
    if (!this.setup) {
      const installed = (await this.piece.ready()) !== null
      void dialog.showMessageBox({ type: 'info', title: 'Molino', message: installed ? L.main.office.preparing : L.main.office.notInstalled })
      return false
    }
    try {
      const { result, binary } = await ask()
      const kind = result.kind
      if (typeof result.doc !== 'string' || !DOC_ID.test(result.doc) || (kind !== 'word' && kind !== 'cell' && kind !== 'slide') || !binary?.length) {
        throw new Error('respuesta no válida del motor')
      }
      this.createWindow({ doc: result.doc, kind, name, path, canvas: binary.toString('base64'), canvasLength: binary.length })
      return true
    } catch (error) {
      log.warn(`oficina: no se pudo abrir (${error instanceof EngineError ? error.code : error instanceof Error ? error.name : '?'})`)
      void dialog.showMessageBox({
        type: 'error',
        title: 'Molino',
        message: fmt(L.main.office.openFailed, { name }),
        detail: error instanceof EngineError ? error.message : undefined
      })
      return false
    }
  }

  private createWindow(doc: Omit<OpenDoc, 'modified' | 'closing' | 'window' | 'pendingSave'>): void {
    const window = new BrowserWindow({
      width: 1360,
      height: 880,
      minWidth: 800,
      minHeight: 560,
      show: false,
      title: this.title(doc.name, doc.kind, false),
      backgroundColor: '#ffffff',
      icon: app.isPackaged ? undefined : join(app.getAppPath(), 'build', 'icon.ico'),
      autoHideMenuBar: true,
      webPreferences: {
        session: this.session,
        preload: join(__dirname, '../preload/office.js'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        // El preload también en el iframe del editor (sin Node en ninguno).
        nodeIntegrationInSubFrames: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        webviewTag: false,
        spellcheck: false,
        navigateOnDragDrop: false,
        devTools: !app.isPackaged
      }
    })
    window.removeMenu()
    const open: OpenDoc = { ...doc, modified: false, closing: false, window, pendingSave: null }
    const id = window.webContents.id
    this.docs.set(id, open)
    // El título es el de Molino (nombre y app), no el de la página del editor:
    // ONLYOFFICE es marca de Ascensio y Molino no la usa como suya.
    window.on('page-title-updated', (event) => event.preventDefault())
    window.on('close', (event) => {
      if (open.closing || !open.modified) {
        open.closing = true
        return
      }
      event.preventDefault()
      void this.askToClose(open)
    })
    // El editor tiene su propio aviso de cambios sin guardar (beforeunload), que
    // dejaría la ventana sin cerrar: la pregunta ya la ha hecho Molino.
    window.webContents.on('will-prevent-unload', (event) => {
      if (open.closing) event.preventDefault()
    })
    window.on('closed', () => {
      this.docs.delete(id)
      this.engine.request('office.close', { doc: open.doc }, { priority: 7 }).catch(() => undefined)
    })
    window.once('ready-to-show', () => window.show())
    const query = new URLSearchParams({
      type: 'desktop',
      doctype: doc.kind,
      mode: 'edit',
      lang,
      uitheme: 'theme-light',
      title: doc.name,
      filetype: (extname(doc.name) || DEFAULT_SUFFIX[doc.kind]).slice(1).toLowerCase(),
      userid: '1',
      username: 'Molino'
    })
    void window.loadURL(`${ORIGIN}/web-apps/apps/api/documents/index.html?${query}`)
  }

  private title(name: string, kind: Kind, modified: boolean): string {
    return `${modified ? '• ' : ''}${name} — ${L.main.office.apps[kind]}`
  }

  private async askToClose(open: OpenDoc): Promise<void> {
    const T = L.main.office
    const { response } = await dialog.showMessageBox(open.window, {
      type: 'question',
      title: T.apps[open.kind],
      message: fmt(T.unsaved, { name: open.name }),
      detail: T.unsavedDetail,
      buttons: [T.save, T.dontSave, T.cancel],
      defaultId: 0,
      cancelId: 2,
      noLink: true
    })
    if (response === 2) return
    if (response === 0 && (await this.saveFromEditor(open)) !== 0) return
    open.closing = true
    if (!open.window.isDestroyed()) open.window.close()
  }

  /** Guarda como si el usuario pulsara Guardar: así el editor manda antes los cambios que le queden. */
  private saveFromEditor(open: OpenDoc): Promise<number> {
    return new Promise((done) => {
      const timer = setTimeout(() => finish(2), 120_000)
      const finish = (code: number): void => {
        clearTimeout(timer)
        open.pendingSave = null
        done(code)
      }
      open.pendingSave = finish
      const frame = open.window.webContents.mainFrame.framesInSubtree.find((f) => f.url.includes('/main/index.html'))
      if (!frame) return finish(2)
      frame.executeJavaScript('window.molinoEditor && window.molinoEditor() && window.molinoEditor().asc_Save(false)').catch(() => finish(2))
    })
  }

  // ================================================================ canales

  /** El documento de la ventana que envía el mensaje, si viene de un editor (A01:2025). */
  private sender(event: IpcMainEvent | IpcMainInvokeEvent): OpenDoc | null {
    const open = this.docs.get(event.sender.id)
    const url = event.senderFrame?.url ?? ''
    return open && open.window.webContents === event.sender && url.startsWith(`${ORIGIN}/`) ? open : null
  }

  private registerIpc(): void {
    ipcMain.on('office:info', (event) => {
      const open = this.sender(event)
      event.returnValue = open ? { doc: open.doc, name: open.name, kind: open.kind } : null
    })
    ipcMain.handle('office:canvas', (event) => {
      const open = this.sender(event)
      if (!open || open.canvas === null) return null
      const canvas = { b64: open.canvas, len: open.canvasLength }
      open.canvas = null
      return canvas
    })
    ipcMain.handle('office:changes', async (event, raw: unknown) => {
      const open = this.sender(event)
      const { list, index } = (raw ?? {}) as { list?: unknown; index?: unknown }
      if (!open || !Array.isArray(list) || !list.every((c) => typeof c === 'string') || list.length > 1_000_000) return { ok: false }
      const from = Number.isInteger(index) && (index as number) >= 0 ? (index as number) : null
      // El motor comprueba la forma de cada cambio; aquí solo van en orden y con la misma prioridad que guardar.
      const { result } = await this.engine.request<{ applied?: number }>(
        'office.changes',
        { doc: open.doc, index: from, count: list.length },
        { binary: Buffer.from(list.join('\n'), 'latin1'), priority: 7 }
      )
      return { ok: true, applied: result.applied }
    })
    ipcMain.handle('office:save', async (event, raw: unknown) => {
      const open = this.sender(event)
      if (!open) return { error: 2 }
      const { saveAs, format, options } = (raw ?? {}) as { saveAs?: unknown; format?: unknown; options?: unknown }
      const code = await this.save(open, saveAs === true, Number.isInteger(format) ? (format as number) : 0, options)
      open.pendingSave?.(code)
      return { error: code }
    })
    ipcMain.handle('office:pickImage', async (event) => {
      const open = this.sender(event)
      if (!open) return { name: '' }
      const picked = await dialog.showOpenDialog(open.window, {
        title: L.main.dialogs.pickImage,
        properties: ['openFile'],
        filters: [{ name: L.main.office.filters.images, extensions: IMAGE_SUFFIXES.map((s) => s.slice(1)) }]
      })
      const file = picked.canceled ? undefined : picked.filePaths[0]
      const ext = file ? extname(file).toLowerCase() : ''
      if (!file || !IMAGE_SUFFIXES.includes(ext)) return { name: '' }
      try {
        if ((await stat(file)).size > MAX_IMAGE) return { name: '' }
        const data = await readFile(file)
        const { result } = await this.engine.request<{ name?: unknown }>('office.addMedia', { doc: open.doc, ext }, { binary: data, priority: 7 })
        return { name: typeof result.name === 'string' && MEDIA_NAME.test(result.name) ? result.name : '' }
      } catch {
        return { name: '' }
      }
    })
    ipcMain.on('office:modified', (event, value: unknown) => {
      const open = this.sender(event)
      if (!open) return
      open.modified = value === true
      open.window.setTitle(this.title(open.name, open.kind, open.modified))
    })
    ipcMain.on('office:ready', (event) => {
      const open = this.sender(event)
      if (open) log.info(`oficina: documento listo (${open.kind})`)
    })
    ipcMain.on('office:fullscreen', (event, value: unknown) => {
      this.sender(event)?.window.setFullScreen(value === true)
    })
    ipcMain.on('office:log', (event, text: unknown) => {
      // Solo sin empaquetar: lo que cuenta el editor no va al registro del usuario.
      if (!app.isPackaged && this.sender(event)) log.info(`editor: ${String(text).slice(0, 300)}`)
    })
  }

  // ================================================================ guardar

  private async save(open: OpenDoc, saveAs: boolean, format: number, rawOptions: unknown): Promise<number> {
    const pdf = format === PDF_FORMAT
    const current = open.path ? extname(open.path).toLowerCase() : ''
    const keeps = Object.values(SAVE_FORMATS[open.kind]).includes(current)
    const suffix = pdf ? '.pdf' : (SAVE_FORMATS[open.kind][format] ?? (keeps ? current : DEFAULT_SUFFIX[open.kind]))
    let dest = open.path
    // Guardar como, PDF, un documento nuevo o uno de un formato que no se escribe (.doc): se pregunta dónde.
    if (saveAs || pdf || !dest || suffix !== current) {
      const T = L.main.office.filters
      const folder = open.path ? dirname(open.path) : app.getPath('documents')
      const picked = await dialog.showSaveDialog(open.window, {
        defaultPath: join(folder, `${parse(open.name).name}${suffix}`),
        filters: [{ name: pdf ? T.pdf : T[open.kind], extensions: [suffix.slice(1)] }]
      })
      if (picked.canceled || !picked.filePath) return 1
      dest = picked.filePath
    }
    let options: Record<string, unknown> | undefined
    if (typeof rawOptions === 'string' && rawOptions.length > 0 && rawOptions.length < 65_536) {
      try {
        const parsed = JSON.parse(rawOptions) as unknown
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) options = parsed as Record<string, unknown>
      } catch {
        options = undefined
      }
    }
    try {
      await this.engine.request(pdf ? 'office.exportPdf' : 'office.save', { doc: open.doc, path: dest, ...(options ? { options } : {}) }, { priority: 7 })
    } catch (error) {
      log.warn(`oficina: no se pudo guardar (${error instanceof EngineError ? error.code : '?'})`)
      void dialog.showMessageBox(open.window, {
        type: 'error',
        title: L.main.office.apps[open.kind],
        message: fmt(L.main.office.saveFailed, { name: basename(dest) }),
        detail: error instanceof EngineError ? error.message : undefined
      })
      return 2
    }
    if (!pdf) {
      open.path = dest
      open.name = basename(dest)
      open.modified = false
      if (!open.window.isDestroyed()) open.window.setTitle(this.title(open.name, open.kind, false))
    }
    return 0
  }

  // ============================================================ molino://office

  private async serve(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url)
      if (request.method !== 'GET' || url.host !== HOST) return notFound()
      const path = decodeURIComponent(url.pathname)
      if (path === '/__molino__/bridge.js' || path === '/__molino__/empty.png') {
        return await this.file(join(this.rendererDir, 'office', basename(path)))
      }
      const setup = this.setup
      if (!setup) return notFound()
      const media = /^\/__doc__\/(o[0-9a-f]{16})\/media\/([^/]+)$/.exec(path)
      if (media) return await this.media(media[1], media[2])
      if (path.startsWith('/__fonts__/')) {
        const file = path.slice('/__fonts__/'.length)
        if (!fontAllowed(file, setup.listed, setup.folders)) return notFound()
        return await this.file(file, 'font/ttf')
      }
      if (path === '/sdkjs/common/AllFonts.js') return respond(Buffer.from(setup.allFonts, 'utf8'), MIME['.js'])
      if (path.startsWith('/dictionaries/')) return await this.file(inside(join(setup.piece, 'dictionaries'), path.slice('/dictionaries/'.length)), undefined, true)
      return await this.file(inside(join(setup.piece, 'editors'), path.slice(1)), undefined, true)
    } catch {
      return notFound()
    }
  }

  private async media(doc: string, rawName: string): Promise<Response> {
    const name = decodeURIComponent(rawName)
    if (!MEDIA_NAME.test(name) || ![...this.docs.values()].some((d) => d.doc === doc)) return notFound()
    const { binary } = await this.engine.request('office.media', { doc, name }, { priority: 8 })
    return binary ? respond(binary, MIME[extname(name).toLowerCase()] ?? 'application/octet-stream') : notFound()
  }

  private async file(path: string | null, type?: string, piece = false): Promise<Response> {
    if (!path) return notFound()
    const ext = extname(path).toLowerCase()
    const mime = type ?? MIME[ext] ?? (piece ? DATA : undefined)
    if (!mime) return notFound()
    const data = await readFile(path)
    if (ext === '.html') {
      // El puente, lo primero de cada página de los editores.
      const html = data.toString('utf8').replace(/<head[^>]*>/i, (head) => head + BRIDGE_TAG)
      return respond(Buffer.from(html, 'utf8'), mime)
    }
    return respond(data, mime)
  }
}

/** La ruta resuelta tiene que seguir dentro de ``root``: un "../" no sale de ahí (A01:2025). */
function inside(root: string, relative: string): string | null {
  const base = normalize(root)
  const full = normalize(join(base, relative))
  return full.startsWith(base + sep) ? full : null
}

function respond(data: Buffer, type: string): Response {
  return new Response(new Uint8Array(data), {
    status: 200,
    headers: {
      'Content-Type': type,
      'Content-Security-Policy': CSP,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Cache-Control': 'no-cache'
    }
  })
}

function notFound(): Response {
  return new Response(null, { status: 404 })
}

/** Sin permisos del navegador y sin más red que molino://office (los editores no necesitan nada más). */
function hardenOfficeSession(session: Session): void {
  session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  session.setPermissionCheckHandler(() => false)
  session.webRequest.onBeforeRequest((details, callback) => {
    let allowed = false
    try {
      const url = new URL(details.url)
      allowed = (url.protocol === 'molino:' && url.host === HOST) || ['data:', 'blob:', 'devtools:'].includes(url.protocol)
    } catch {
      allowed = false
    }
    callback({ cancel: !allowed })
  })
}
