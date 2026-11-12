import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { basename, dirname, extname, join, normalize, parse, resolve, sep } from 'node:path'
import { app, BrowserWindow, clipboard, dialog, ipcMain, session as sessions, shell, type IpcMainEvent, type IpcMainInvokeEvent, type Session } from 'electron'
import { EngineError, type EngineClient } from './engine'
import { fmt, L, lang, locale } from './i18n'
import { setOfficeSession } from './security'
import { log } from './log'
import { type OfficePiece, openOfficeLegal, pieceVersion } from './office'
import type { OfficeProgress } from '@shared/office'
import type { OfficeTabs } from '@shared/officeui'
import { fontTargets, type FontTarget, installFonts, lookupFont } from './fontcatalog'
import { appIcon, officeKindOf, OPENS, windowDetails } from './officeapps'
import { cleanFontIndex, fontAllowed, fontFingerprint, fontFolders, loadFontIndex, ownFontsDir, saveFontIndex } from './officefonts'

/**
 * Las ventanas de Documentos, Hojas y Presentaciones: una por app, con una
 * pestaña por documento.
 *
 * Cada ventana es la interfaz de Molino (React, ``office.html``) con una pestaña
 * por documento; cada pestaña es un marco (``frame.html``) que arranca el
 * editor de ONLYOFFICE (la pieza, office.ts) con su interfaz oculta. La
 * interfaz de Molino maneja el editor por su API (renderer/src/office/engine.ts).
 *
 * Todo corre aparte de Molino PDF:
 * - **su propia sesión**, en memoria, que solo deja pedir ``molino://office/``
 *   (y ``data:`` o ``blob:``): ni red ni la interfaz de Molino PDF;
 * - **su propio anfitrión**, ``molino://office/``, que solo sirve la interfaz,
 *   la pieza, el índice de fuentes, las fuentes que lista (y que están en una
 *   carpeta de fuentes), el puente y las imágenes de los documentos abiertos.
 *   Un documento con letras incrustadas que no están en el equipo tiene su
 *   propio índice, con ellas (del motor: docfonts.py), solo para su editor;
 * - **sandbox, sin Node, contexto aislado**, sin navegar ni abrir ventanas;
 * - **canales** (preload/office.ts) que solo dan acceso a los documentos de su
 *   ventana: los de la interfaz, solo desde su página; los del puente, solo
 *   desde un editor. Las rutas del usuario se quedan en este proceso.
 *
 * Los editores necesitan scripts en línea, ``eval`` y WebAssembly, así que su
 * política de contenido es más abierta; la de la interfaz de Molino es la
 * estricta de Molino PDF. Los documentos se abren, guardan y exportan en el
 * motor aislado (ops/office.py), con x2t dentro de su AppContainer.
 */

const PARTITION = 'molino-office'
const HOST = 'office'
const ORIGIN = `molino://${HOST}`
const UI_PAGE = `${ORIGIN}/__molino__/ui/office.html`
export type Kind = 'word' | 'cell' | 'slide'

export function isOfficeFile(path: string): boolean {
  return officeKindOf(path) !== null
}

// Códigos de formato de x2t con los que el editor pide guardar (ver office.py).
const SAVE_FORMATS: Record<Kind, Record<number, string>> = {
  word: { 65: '.docx', 67: '.odt', 68: '.rtf' },
  cell: { 257: '.xlsx', 259: '.ods', 260: '.csv' },
  slide: { 129: '.pptx', 131: '.odp' }
}
const DEFAULT_SUFFIX: Record<Kind, string> = { word: '.docx', cell: '.xlsx', slide: '.pptx' }
/** Las plantillas para empezar de cada app (resources/templates/<idioma>/). */
const TEMPLATES: Record<Kind, { id: string; file: { es: string; en: string } }[]> = {
  word: [
    { id: 'letter', file: { es: 'carta.docx', en: 'letter.docx' } },
    { id: 'resume', file: { es: 'curriculum.docx', en: 'resume.docx' } }
  ],
  cell: [
    { id: 'invoice', file: { es: 'factura.xlsx', en: 'invoice.xlsx' } },
    { id: 'quote', file: { es: 'presupuesto.xlsx', en: 'quote.xlsx' } },
    { id: 'budget', file: { es: 'presupuesto-domestico.xlsx', en: 'household-budget.xlsx' } }
  ],
  slide: [{ id: 'presentation', file: { es: 'presentacion.pptx', en: 'presentation.pptx' } }]
}

/**
 * «Guardar como PDF» y «Archivo → Exportar»: una copia; el documento abierto
 * sigue siendo el de antes (exportDoc). En el motor, office.SAVE_FORMATS.
 */
const EXPORT_SUFFIXES: Record<Kind, Record<string, string>> = {
  word: { pdf: '.pdf', txt: '.txt', html: '.html', epub: '.epub' },
  cell: { pdf: '.pdf' },
  slide: { pdf: '.pdf', ppsx: '.ppsx' }
}
const PDF_FORMAT = 513
const IMAGE_SUFFIXES = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp']
const MAX_IMAGE = 50 * 1024 * 1024
const DOC_ID = /^o[0-9a-f]{16}$/
/** PDF temporales para imprimir (se borran al arrancar). */
const PRINT_DIR = join(app.getPath('temp'), 'Molino-imprimir')
/** Lo que Molino pide al editor vale este tiempo (si no llega a guardar, no se queda colgado para la próxima vez). */
const INTENT_MS = 60_000
const MEDIA_NAME = /^[A-Za-z0-9_-]{1,64}\.(png|jpe?g|gif|bmp|tiff?|svg|webp|emf|wmf|wdp)$/i
/** Una letra incrustada en el índice propio de un documento: su carpeta del motor, fonts\eNN.ttf. */
const EMBEDDED_FONT = /[\\/](o[0-9a-f]{16})[\\/]fonts[\\/](e[0-9]{2}\.(?:ttf|otf))$/i

/** Los editores de ONLYOFFICE: scripts en línea, eval y WebAssembly. */
const EDITOR_CSP = [
  "default-src 'none'",
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
/** La interfaz de Molino: la estricta de Molino PDF, más los marcos de las pestañas. */
const UI_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "style-src-attr 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'none'",
  "frame-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
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
/** Archivos propios de Molino que se sirven junto a los editores (renderer/public/office). */
const OWN_FILES = new Set(['bridge.js', 'empty.png', 'frame.html', 'frame.js'])
/** Lo que necesita la página de la interfaz: ella misma y sus recursos compilados. */
const UI_ASSET = /^assets\/[\w.-]+\.(js|css|woff2?|svg|png)$/

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
  /** Guardado pedido al cerrar: se resuelve con el código del editor (0 = bien). */
  pendingSave: ((code: number) => void) | null
  /** Lo que Molino pidió al editor que guardara: «Guardar como» o imprimir. */
  intent: { kind: 'saveAs' | 'print'; at: number } | null
  /** Recuperado tras un cierre inesperado: hasta que se guarde, cerrarlo pregunta. */
  recovered: boolean
  /** Las fuentes que nombra (del motor, al abrirlo). */
  fonts: string[]
  /** Su índice de fuentes propio, si trae letras incrustadas que no están en el equipo (lo sirve a su editor). */
  index: { text: string; listed: Set<string>; families: Set<string> } | null
  /** Se dijo «Ahora no» al aviso de fuentes que faltan. */
  fontsDismissed: boolean
}

interface AppWindow {
  kind: Kind
  window: BrowserWindow
  docs: Map<string, OpenDoc>
  /** Orden de las pestañas. */
  order: string[]
  active: string | null
  closing: boolean
  /** Documentos que se están abriendo (la interfaz muestra «Abriendo…»). */
  opening: number
}

interface Setup {
  /** Carpeta de la pieza instalada. */
  piece: string
  allFonts: string
  listed: Set<string>
  folders: string[]
  /** Las familias del índice, en minúsculas. */
  families: Set<string>
}

export interface OfficeOptions {
  engine: EngineClient
  piece: OfficePiece
  /** Carpeta de la interfaz compilada (office.html, assets y office/). */
  rendererDir: string
  /** ¿Tema oscuro? (el de Ajustes de Molino). */
  dark: () => boolean
  /** Quien firma los comentarios y los cambios (Ajustes de Molino o el usuario de Windows). */
  author: () => string
  /** Imprimir: abre ese PDF (temporal) en Molino PDF con su cuadro de imprimir (index.ts). */
  print(path: string): void
  /** Fuentes de las que no se vuelve a avisar (store.ts). */
  ignoredFonts: { list(): string[]; add(names: string[]): void }
  /** El diccionario personal del corrector (store.ts). */
  userWords: { list(): string[]; add(words: string[]): void }
  /** Carpeta donde quedan las licencias de las fuentes instaladas. */
  fontLicenses: string
  /** Los recientes de Documentos, Hojas y Presentaciones (store.ts). */
  recents: {
    list(): { id: string; path: string; openedAt: number }[]
    add(path: string): void
    forget(id: string): void
  }
  /** Carpeta de las plantillas para empezar (resources/templates). */
  templatesDir: string
  /** La IA local de Molino (Ajustes → IA): su estado y abrir sus ajustes (index.ts). */
  ai: {
    status(): Promise<{ on: boolean; ready: boolean }>
    openSettings(): void
  }
}

/**
 * Las operaciones de IA que puede pedir la interfaz de oficina (ops/officeai.py),
 * siempre sobre un documento de su ventana.
 */
const OFFICE_AI = new Set([
  'ai.officeTransform',
  'ai.officeWrite',
  'ai.officeSummarize',
  'ai.officeAsk',
  'ai.formula',
  'ai.explainFormula',
  'ai.dataSummary',
  'ai.slides',
  'ai.notes'
])

export class OfficeWindows {
  private readonly windows = new Map<Kind, AppWindow>()
  private setup: Setup | null = null
  private configuring: Promise<void> = Promise.resolve()
  /** La primera configuración (al arrancar el motor): abrir espera a que acabe. */
  private readonly firstConfigured: Promise<void>
  private markConfigured: () => void = () => undefined
  private readonly session: Session
  private readonly engine: EngineClient
  private readonly piece: OfficePiece
  /** Avance de la pieza nueva que se está instalando sola (en tanto por ciento), para «Abriendo…». */
  private updating: OfficeTabs['updating'] = null
  /** Las peticiones de IA en curso: número de la interfaz → número del motor (para cancelarlas). */
  private readonly aiCalls = new Map<number, number>()

  constructor(private readonly options: OfficeOptions) {
    rmSync(PRINT_DIR, { recursive: true, force: true, maxRetries: 2 })
    this.engine = options.engine
    this.piece = options.piece
    this.firstConfigured = new Promise((done) => {
      this.markConfigured = done
    })
    this.session = sessions.fromPartition(PARTITION)
    hardenOfficeSession(this.session)
    setOfficeSession(this.session)
    this.session.protocol.handle('molino', (request) => this.serve(request))
    this.registerIpc()
  }

  /** El avance de la pieza (office.ts): las ventanas que esperan lo enseñan. Solo cuando cambia el tanto por ciento. */
  pieceProgress(progress: OfficeProgress | null): void {
    const next = progress ? { phase: progress.phase, percent: Math.floor((progress.done / Math.max(progress.total, 1)) * 100) } : null
    if (next?.phase === this.updating?.phase && next?.percent === this.updating?.percent) return
    this.updating = next
    for (const win of this.windows.values()) if (win.opening > 0) this.sendTabs(win)
  }

  /** ¿Hay algún documento de oficina abierto? (entonces la pieza no se puede quitar). */
  get busy(): boolean {
    return [...this.windows.values()].some((w) => w.docs.size > 0)
  }

  private allDocs(): OpenDoc[] {
    return [...this.windows.values()].flatMap((w) => [...w.docs.values()])
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
      const own = ownFontsDir(this.piece.root)
      const fingerprint = await fontFingerprint(version, own)
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
        families: new Set(index.families.map((f) => f.toLowerCase())),
        folders: [...fontFolders(own), join(dir, 'fonts')]
      }
    } catch (error) {
      this.setup = null
      log.warn(`oficina: no se pudo preparar (${error instanceof Error ? `${error.name}: ${error.message.slice(0, 200)}` : '?'})`)
    } finally {
      this.markConfigured()
    }
  }

  // ================================================================ abrir

  /** Abre un documento del usuario en una pestaña de su app (o la trae delante si ya está abierto). */
  async open(path: string): Promise<boolean> {
    for (const win of this.windows.values()) {
      for (const open of win.docs.values()) {
        if (open.path && resolve(open.path).toLowerCase() === resolve(path).toLowerCase()) {
          this.show(win, open.doc)
          return true
        }
      }
    }
    const kind = officeKindOf(path)
    if (!kind) return false
    return this.load(kind, basename(path), path, () => this.engine.request<{ doc?: unknown; kind?: unknown }>('office.open', { path }, { priority: 7 }))
  }

  /** La ventana de una app, delante (sin documentos, con su pantalla de inicio). */
  showApp(kind: Kind): void {
    const win = this.windowFor(kind)
    this.show(win, null)
  }

  /** Lo que se puede recuperar de una app tras un cierre inesperado (motor: office.recoverable). */
  private async recoverable(kind: Kind): Promise<{ id: string; name: string; time: string }[]> {
    try {
      const { result } = await this.engine.request<{ documents?: unknown }>('office.recoverable', {}, { priority: 8 })
      const list = Array.isArray(result.documents) ? result.documents : []
      return list.flatMap((d: { id?: unknown; name?: unknown; kind?: unknown; time?: unknown }) =>
        typeof d.id === 'string' && DOC_ID.test(d.id) && typeof d.name === 'string' && typeof d.time === 'string' && d.kind === kind
          ? [{ id: d.id, name: d.name.slice(0, 300), time: d.time.slice(0, 40) }]
          : []
      )
    } catch {
      return []
    }
  }

  /** Abre lo recuperado en su app, sin archivo propio («Guardar» pregunta dónde). */
  private async recover(win: AppWindow, id: string): Promise<boolean> {
    const entry = (await this.recoverable(win.kind)).find((d) => d.id === id)
    if (!entry) return false
    const name = fmt(L.main.office.recoveredName, { stem: parse(entry.name).name, suffix: DEFAULT_SUFFIX[win.kind] })
    return this.load(win.kind, name, null, () => this.engine.request<{ doc?: unknown; kind?: unknown }>('office.recover', { id }, { priority: 7 }), true)
  }

  /** Documento nuevo de una app, desde la plantilla vacía de la pieza. */
  async create(kind: Kind): Promise<boolean> {
    const name = `${L.main.office.filters[kind]}${DEFAULT_SUFFIX[kind]}`
    return this.load(kind, name, null, () => this.engine.request<{ doc?: unknown; kind?: unknown }>('office.new', { kind }, { priority: 7 }))
  }

  /** Las plantillas para empezar de una app que hay en esta instalación (en el idioma de Molino). */
  templates(kind: Kind): string[] {
    return TEMPLATES[kind].filter((t) => existsSync(this.templatePath(t))).map((t) => t.id)
  }

  private templatePath(template: (typeof TEMPLATES)[Kind][number]): string {
    return join(this.options.templatesDir, lang === 'en' ? 'en' : 'es', template.file[lang === 'en' ? 'en' : 'es'])
  }

  /** Un documento nuevo a partir de una plantilla: sin archivo propio (Guardar pregunta dónde). */
  async fromTemplate(kind: Kind, id: string): Promise<boolean> {
    const template = TEMPLATES[kind].find((t) => t.id === id)
    if (!template) return false
    const path = this.templatePath(template)
    if (!existsSync(path)) return false
    const name = `${(L.main.office.templates as Record<string, string>)[id] ?? L.main.office.filters[kind]}${extname(path)}`
    return this.load(kind, name, null, () => this.engine.request<{ doc?: unknown; kind?: unknown }>('office.open', { path }, { priority: 7 }))
  }

  private async load(
    kind: Kind,
    name: string,
    path: string | null,
    ask: () => Promise<{ result: { doc?: unknown; kind?: unknown }; binary?: Buffer }>,
    recovered = false
  ): Promise<boolean> {
    // La ventana de la app sale enseguida, con «Abriendo…» mientras el motor
    // (que al abrir desde el Explorador puede estar aún arrancando) prepara el documento.
    const win = this.windowFor(kind)
    win.opening++
    this.show(win, null)
    try {
      await Promise.race([this.firstConfigured, new Promise((done) => setTimeout(done, 90_000))])
      await this.configuring
      if (!this.setup && this.piece.outdated) {
        // Molino se ha actualizado y trae otra pieza: se está instalando sola (o
        // falló antes y se intenta otra vez). La ventana espera con su avance.
        await this.piece.install().catch(() => undefined)
        await this.configure()
      }
      if (!this.setup) {
        const installed = (await this.piece.ready()) !== null
        const message = installed ? L.main.office.preparing : this.piece.outdated ? L.main.office.updateFailed : L.main.office.notInstalled
        void dialog.showMessageBox(win.window, { type: 'info', title: 'Molino', message })
        return false
      }
      return await this.loadInto(win, name, path, ask, recovered)
    } finally {
      win.opening--
      if (!win.window.isDestroyed()) this.sendTabs(win)
    }
  }

  private async loadInto(
    win: AppWindow,
    name: string,
    path: string | null,
    ask: () => Promise<{ result: { doc?: unknown; kind?: unknown }; binary?: Buffer }>,
    recovered = false
  ): Promise<boolean> {
    try {
      const { result, binary } = await ask()
      if (typeof result.doc !== 'string' || !DOC_ID.test(result.doc) || result.kind !== win.kind || !binary?.length) {
        throw new Error('respuesta no válida del motor')
      }
      if (win.window.isDestroyed()) {
        // La ventana se cerró mientras se abría: el documento no se queda abierto en el motor.
        this.engine.request('office.close', { doc: result.doc }, { priority: 7 }).catch(() => undefined)
        return false
      }
      // El índice propio (letras incrustadas): del motor aislado, así que se vuelve a leer como datos.
      // Si no vale, el documento se abre igual, con el del equipo.
      const own = (result as { allFonts?: unknown }).allFonts
      let index: ReturnType<typeof cleanFontIndex> | null = null
      try {
        index = typeof own === 'string' ? cleanFontIndex(own) : null
      } catch {
        log.warn('oficina: el índice de fuentes del documento no vale; se usa el del equipo')
      }
      const open: OpenDoc = {
        doc: result.doc,
        kind: win.kind,
        name,
        path,
        canvas: binary.toString('base64'),
        canvasLength: binary.length,
        modified: false,
        pendingSave: null,
        intent: null,
        recovered,
        fonts: Array.isArray((result as { fonts?: unknown }).fonts)
          ? ((result as { fonts: unknown[] }).fonts.filter((f) => typeof f === 'string' && f.length > 0 && f.length <= 64) as string[]).slice(0, 60)
          : [],
        index: index && {
          text: index.text,
          listed: new Set(index.files.map((f) => f.toLowerCase())),
          families: new Set(index.families.map((f) => f.toLowerCase()))
        },
        fontsDismissed: false
      }
      win.docs.set(open.doc, open)
      win.order.push(open.doc)
      this.show(win, open.doc)
      if (path) this.options.recents.add(path)
      return true
    } catch (error) {
      log.warn(`oficina: no se pudo abrir (${error instanceof EngineError ? error.code : error instanceof Error ? error.name : '?'})`)
      const options = {
        type: 'error' as const,
        title: L.main.office.apps[win.kind],
        message: fmt(L.main.office.openFailed, { name }),
        detail: error instanceof EngineError ? error.message : undefined
      }
      void (win.window.isDestroyed() ? dialog.showMessageBox(options) : dialog.showMessageBox(win.window, options))
      return false
    }
  }

  /** La ventana de una app (la crea si no está). */
  private windowFor(kind: Kind): AppWindow {
    const existing = this.windows.get(kind)
    if (existing && !existing.window.isDestroyed()) return existing
    const dark = this.options.dark()
    const window = new BrowserWindow({
      width: 1360,
      height: 880,
      minWidth: 800,
      minHeight: 560,
      show: false,
      title: L.main.office.apps[kind],
      backgroundColor: dark ? '#1c1d20' : '#ffffff',
      icon: appIcon(kind),
      titleBarStyle: 'hidden',
      titleBarOverlay: { color: dark ? '#1c1d20' : '#ffffff', symbolColor: dark ? '#e5e7eb' : '#1f2937', height: 40 },
      autoHideMenuBar: true,
      webPreferences: {
        session: this.session,
        preload: join(__dirname, '../preload/office.js'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        // El preload también en los marcos de las pestañas y del editor (sin Node en ninguno).
        nodeIntegrationInSubFrames: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        webviewTag: false,
        spellcheck: false,
        navigateOnDragDrop: false,
        devTools: !app.isPackaged,
        additionalArguments: [
          `--molino-lang=${lang}`,
          `--molino-locale=${locale}`,
          `--molino-theme=${dark ? 'dark' : 'light'}`,
          `--molino-kind=${kind}`,
          `--molino-version=${app.getVersion()}`,
          `--molino-piece=${pieceVersion()}`,
          `--molino-author=${encodeURIComponent(this.options.author().replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 100))}`
        ]
      }
    })
    window.removeMenu()
    // Cada app es un programa aparte en la barra de tareas: su grupo, su icono y,
    // si se ancla, se vuelve a abrir esa app (officeapps.ts).
    if (process.platform === 'win32') window.setAppDetails(windowDetails(kind))
    const win: AppWindow = { kind, window, docs: new Map(), order: [], active: null, closing: false, opening: 0 }
    this.windows.set(kind, win)
    // El título es el de Molino (documento y app), no el de la página.
    window.on('page-title-updated', (event) => event.preventDefault())
    window.on('close', (event) => {
      if (win.closing) return
      event.preventDefault()
      void this.closeWindow(win)
    })
    // El editor tiene su propio aviso de cambios sin guardar (beforeunload): la
    // pregunta ya la ha hecho Molino.
    window.webContents.on('will-prevent-unload', (event) => {
      if (win.closing) event.preventDefault()
    })
    window.on('closed', () => {
      for (const doc of win.docs.keys()) this.engine.request('office.close', { doc }, { priority: 7 }).catch(() => undefined)
      win.docs.clear()
      if (this.windows.get(kind) === win) this.windows.delete(kind)
    })
    window.once('ready-to-show', () => window.show())
    void window.loadURL(`${UI_PAGE}?kind=${kind}`)
    return win
  }

  private show(win: AppWindow, doc: string | null): void {
    if (doc) win.active = doc
    this.sendTabs(win)
    if (win.window.isMinimized()) win.window.restore()
    if (win.window.isVisible()) win.window.focus()
  }

  private tabs(win: AppWindow): OfficeTabs {
    return {
      kind: win.kind,
      active: win.active,
      opening: win.opening > 0,
      updating: win.opening > 0 ? this.updating : null,
      tabs: win.order.flatMap((doc) => {
        const open = win.docs.get(doc)
        return open
          ? [
              {
                doc,
                name: open.name,
                ext: (extname(open.name) || DEFAULT_SUFFIX[open.kind]).slice(1).toLowerCase(),
                modified: open.modified,
                hasFile: open.path !== null,
                missingFonts: open.fontsDismissed ? [] : this.missingFonts(open)
              }
            ]
          : []
      })
    }
  }

  /** Las fuentes que nombra un documento y no están en el índice (ni se dijo que no se avise de ellas). */
  private missingFonts(open: OpenDoc): string[] {
    const families = this.setup?.families
    if (!families) return []
    const ignored = new Set(this.options.ignoredFonts.list())
    const own = open.index?.families
    return open.fonts.filter((f) => !families.has(f.toLowerCase()) && !own?.has(f.toLowerCase()) && !ignored.has(f.toLowerCase()))
  }

  /**
   * Instala fuentes que faltan en un documento (las del catálogo), rehace el
   * índice y vuelve a abrir los documentos sin cambios que las usaban, para
   * que se vean con ellas.
   */
  private async installFonts(open: OpenDoc, names: string[], into: FontTarget): Promise<{ installed: string[]; failed: string[] }> {
    const missing = new Set(this.missingFonts(open))
    const wanted = names.filter((n) => missing.has(n)).slice(0, 30)
    const result = await installFonts(wanted, this.options.fontLicenses, into, ownFontsDir(this.piece.root))
    if (result.installed.length === 0) return result
    log.info(`fuentes: instaladas ${result.installed.length}`)
    await this.configure()
    const installed = new Set(result.installed.map((n) => n.toLowerCase()))
    for (const w of this.windows.values()) {
      for (const doc of [...w.order]) {
        const item = w.docs.get(doc)
        if (item && item.path && !item.modified && item.fonts.some((f) => installed.has(f.toLowerCase()))) {
          const path = item.path
          if (await this.closeTab(w, doc)) await this.open(path)
        }
      }
      this.sendTabs(w)
    }
    return result
  }

  private sendTabs(win: AppWindow): void {
    const active = win.active ? win.docs.get(win.active) : undefined
    const title = active ? `${active.modified ? '• ' : ''}${active.name} — ${L.main.office.apps[win.kind]}` : L.main.office.apps[win.kind]
    if (!win.window.isDestroyed()) {
      win.window.setTitle(title)
      win.window.webContents.send('office:tabs', this.tabs(win))
    }
  }

  // ================================================================ cerrar

  /** Cierra una pestaña, preguntando antes si tiene cambios. Devuelve si se cerró. */
  private async closeTab(win: AppWindow, doc: string): Promise<boolean> {
    const open = win.docs.get(doc)
    if (!open) return true
    if (open.modified || (open.recovered && !open.path)) {
      const T = L.main.office
      if (win.active !== doc) {
        win.active = doc
        this.sendTabs(win)
      }
      const { response } = await dialog.showMessageBox(win.window, {
        type: 'question',
        title: T.apps[win.kind],
        message: fmt(T.unsaved, { name: open.name }),
        detail: T.unsavedDetail,
        buttons: [T.save, T.dontSave, T.cancel],
        defaultId: 0,
        cancelId: 2,
        noLink: true
      })
      if (response === 2) return false
      if (response === 0 && (await this.saveFromEditor(win, open)) !== 0) return false
    }
    win.docs.delete(doc)
    win.order = win.order.filter((d) => d !== doc)
    if (win.active === doc) win.active = win.order.at(-1) ?? null
    this.engine.request('office.close', { doc }, { priority: 7 }).catch(() => undefined)
    this.sendTabs(win)
    return true
  }

  private async closeWindow(win: AppWindow): Promise<void> {
    for (const doc of [...win.order]) {
      if (!(await this.closeTab(win, doc))) return
    }
    win.closing = true
    if (!win.window.isDestroyed()) win.window.close()
  }

  /** El marco del editor de una pestaña: su padre es el frame.html con su documento. */
  private editorFrame(win: AppWindow, open: OpenDoc): Electron.WebFrameMain | undefined {
    return win.window.webContents.mainFrame.framesInSubtree.find(
      (f) => f.url.includes('/main/index.html') && f.parent !== null && f.parent.url.includes(`doc=${open.doc}`)
    )
  }

  /**
   * «Guardar como» e imprimir: Molino pide al editor que se descargue (como
   * en su menú; así manda antes los cambios que le queden) y, cuando llega a
   * guardar (save), sabe para qué era: preguntar dónde o imprimirlo.
   */
  private async requestDownload(win: AppWindow, open: OpenDoc, kind: 'saveAs' | 'print'): Promise<boolean> {
    const frame = this.editorFrame(win, open)
    if (!frame) return false
    open.intent = { kind, at: Date.now() }
    const ext = (extname(open.name).slice(1) || DEFAULT_SUFFIX[open.kind].slice(1)).toLowerCase()
    const fallback = { word: 'DOCX', cell: 'XLSX', slide: 'PPTX' }[open.kind]
    const format =
      kind === 'print'
        ? 'T.PDF'
        : `({ docx: T.DOCX, odt: T.ODT, rtf: T.RTF, xlsx: T.XLSX, ods: T.ODS, csv: T.CSV, pptx: T.PPTX, odp: T.ODP })[${JSON.stringify(/^[a-z]{3,4}$/.test(ext) ? ext : '')}] || T.${fallback}`
    try {
      return Boolean(
        await frame.executeJavaScript(
          `(function () { var e = window.molinoEditor && window.molinoEditor(); if (!e) return false; var T = window.Asc.c_oAscFileType; e.asc_DownloadAs(new window.Asc.asc_CDownloadOptions(${format})); return true })()`
        )
      )
    } catch {
      open.intent = null
      return false
    }
  }

  /**
   * Exportar (PDF, texto, página web, EPUB, .ppsx): lo hace el motor con lo que
   * tiene (la interfaz ha hecho antes que el editor le mande lo que le quedara).
   * No pasa por el editor: para él, exportar es «guardar como» y daría el
   * documento por guardado.
   */
  private async exportDoc(win: AppWindow, open: OpenDoc, format: string): Promise<boolean> {
    const suffix = EXPORT_SUFFIXES[open.kind][format]
    if (!suffix) return false
    const T = L.main.office.filters
    const F = L.main.office.formats as Record<string, string>
    const folder = open.path ? dirname(open.path) : app.getPath('documents')
    const picked = await dialog.showSaveDialog(win.window, {
      defaultPath: join(folder, `${parse(open.name).name}${suffix}`),
      filters: [{ name: suffix === '.pdf' ? T.pdf : (F[suffix] ?? T[open.kind]), extensions: [suffix.slice(1)] }]
    })
    if (picked.canceled || !picked.filePath) return false
    const dest = extname(picked.filePath).toLowerCase() === suffix ? picked.filePath : `${picked.filePath}${suffix}`
    try {
      if (suffix === '.pdf') await this.engine.request('office.exportPdf', { doc: open.doc, path: dest }, { priority: 7 })
      else await this.engine.request('office.save', { doc: open.doc, path: dest, export: true }, { priority: 7 })
      return true
    } catch (error) {
      log.warn(`oficina: no se pudo exportar (${error instanceof EngineError ? error.code : '?'})`)
      void dialog.showMessageBox(win.window, {
        type: 'error',
        title: L.main.office.apps[open.kind],
        message: fmt(L.main.office.saveFailed, { name: basename(dest) }),
        detail: error instanceof EngineError ? error.message : undefined
      })
      return false
    }
  }

  /** Imprimir: un PDF temporal hecho por el motor, en el cuadro de imprimir de Molino PDF. */
  private async printDoc(open: OpenDoc): Promise<boolean> {
    const folder = join(PRINT_DIR, randomBytes(6).toString('hex'))
    mkdirSync(folder, { recursive: true })
    const dest = join(folder, `${parse(open.name).name}.pdf`)
    try {
      await this.engine.request('office.exportPdf', { doc: open.doc, path: dest }, { priority: 7 })
    } catch (error) {
      log.warn(`oficina: no se pudo preparar la impresión (${error instanceof EngineError ? error.code : '?'})`)
      return false
    }
    this.options.print(dest)
    return true
  }

  /** Guarda como si el usuario pulsara Guardar: así el editor manda antes los cambios que le queden. */
  private saveFromEditor(win: AppWindow, open: OpenDoc): Promise<number> {
    return new Promise((done) => {
      const timer = setTimeout(() => finish(2), 120_000)
      const finish = (code: number): void => {
        clearTimeout(timer)
        open.pendingSave = null
        done(code)
      }
      open.pendingSave = finish
      const frame = this.editorFrame(win, open)
      if (!frame) return finish(2)
      frame.executeJavaScript('window.molinoEditor && window.molinoEditor() && window.molinoEditor().asc_Save(false)').catch(() => finish(2))
    })
  }

  // ================================================================ canales

  private recentFor(kind: Kind): { id: string; name: string; folder: string; openedAt: number }[] {
    return this.options.recents
      .list()
      .filter((r) => officeKindOf(r.path) === kind)
      .slice(0, 50)
      .map((r) => ({ id: r.id, name: basename(r.path), folder: basename(dirname(r.path)), openedAt: r.openedAt }))
  }

  /** La ventana cuya interfaz envía el mensaje (solo desde la página de la interfaz). */
  private uiSender(event: IpcMainEvent | IpcMainInvokeEvent): AppWindow | null {
    const win = [...this.windows.values()].find((w) => !w.window.isDestroyed() && w.window.webContents === event.sender)
    const frame = event.senderFrame
    return win && frame && frame === event.sender.mainFrame && frame.url.startsWith(UI_PAGE) ? win : null
  }

  /** El documento de un editor de esa ventana (solo desde los editores) (A01:2025). */
  private editorDoc(event: IpcMainEvent | IpcMainInvokeEvent, raw: unknown): { win: AppWindow; open: OpenDoc } | null {
    if (typeof raw !== 'string' || !DOC_ID.test(raw)) return null
    const win = [...this.windows.values()].find((w) => !w.window.isDestroyed() && w.window.webContents === event.sender)
    const url = event.senderFrame?.url ?? ''
    const open = win?.docs.get(raw)
    return win && open && url.startsWith(`${ORIGIN}/web-apps/`) ? { win, open } : null
  }

  private registerIpc(): void {
    // ---- la interfaz
    ipcMain.handle('office:tabs', (event) => {
      const win = this.uiSender(event)
      return win ? this.tabs(win) : null
    })
    ipcMain.handle('office:activate', (event, raw: unknown) => {
      const win = this.uiSender(event)
      if (!win || typeof raw !== 'string' || !win.docs.has(raw)) return false
      win.active = raw
      this.sendTabs(win)
      return true
    })
    ipcMain.handle('office:closeTab', async (event, raw: unknown) => {
      const win = this.uiSender(event)
      if (!win || typeof raw !== 'string') return false
      // Sin pestañas, la ventana se queda con la pantalla de inicio de la app (como Molino PDF).
      return this.closeTab(win, raw)
    })
    ipcMain.handle('office:openDialog', async (event) => {
      const win = this.uiSender(event)
      if (!win) return false
      const picked = await dialog.showOpenDialog(win.window, {
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: L.main.office.filters[win.kind], extensions: OPENS[win.kind].map((s) => s.slice(1)) }]
      })
      for (const file of picked.canceled ? [] : picked.filePaths.slice(0, 20)) await this.open(file)
      return true
    })
    ipcMain.handle('office:saveAs', async (event, raw: unknown) => {
      const win = this.uiSender(event)
      const open = win && typeof raw === 'string' ? win.docs.get(raw) : undefined
      return win && open ? this.requestDownload(win, open, 'saveAs') : false
    })
    ipcMain.handle('office:print', async (event, raw: unknown) => {
      const win = this.uiSender(event)
      const open = win && typeof raw === 'string' ? win.docs.get(raw) : undefined
      return win && open ? this.printDoc(open) : false
    })
    ipcMain.handle('office:export', async (event, raw: unknown) => {
      const win = this.uiSender(event)
      const { doc, format } = (raw ?? {}) as { doc?: unknown; format?: unknown }
      const open = win && typeof doc === 'string' ? win.docs.get(doc) : undefined
      return win && open && typeof format === 'string' ? this.exportDoc(win, open, format) : false
    })
    ipcMain.handle('office:new', async (event) => {
      const win = this.uiSender(event)
      return win ? this.create(win.kind) : false
    })
    // Los recientes de la app: la interfaz ve el nombre y la carpeta que lo
    // contiene, nunca la ruta (comparte origen con los editores).
    ipcMain.handle('office:recent', (event) => {
      const win = this.uiSender(event)
      return win ? this.recentFor(win.kind) : []
    })
    ipcMain.handle('office:openRecent', async (event, raw: unknown) => {
      const win = this.uiSender(event)
      const entry = win && typeof raw === 'string' ? this.options.recents.list().find((r) => r.id === raw) : undefined
      if (!win || !entry) return false
      if (!existsSync(entry.path)) {
        this.options.recents.forget(entry.id)
        void dialog.showMessageBox(win.window, { type: 'info', title: L.main.office.apps[win.kind], message: fmt(L.main.office.recentMissing, { name: basename(entry.path) }) })
        return false
      }
      return this.open(entry.path)
    })
    ipcMain.handle('office:recoverable', async (event) => {
      const win = this.uiSender(event)
      return win ? this.recoverable(win.kind) : []
    })
    ipcMain.handle('office:recover', async (event, raw: unknown) => {
      const win = this.uiSender(event)
      return win && typeof raw === 'string' && DOC_ID.test(raw) ? this.recover(win, raw) : false
    })
    ipcMain.handle('office:discardRecovery', async (event, raw: unknown) => {
      const win = this.uiSender(event)
      if (!win) return []
      if (typeof raw === 'string' && DOC_ID.test(raw) && (await this.recoverable(win.kind)).some((d) => d.id === raw)) {
        await this.engine.request('office.discardRecovery', { id: raw }, { priority: 8 }).catch(() => undefined)
      }
      return this.recoverable(win.kind)
    })
    // Fuentes que faltan: qué se puede hacer, instalarlas y «Ahora no».
    ipcMain.handle('office:fontsInfo', (event, raw: unknown) => {
      const win = this.uiSender(event)
      const open = win && typeof raw === 'string' ? win.docs.get(raw) : undefined
      return { targets: fontTargets(), fonts: open ? this.missingFonts(open).map(lookupFont) : [] }
    })
    ipcMain.handle('office:installFonts', async (event, raw: unknown) => {
      const win = this.uiSender(event)
      const { doc, names, into } = (raw ?? {}) as { doc?: unknown; names?: unknown; into?: unknown }
      const open = win && typeof doc === 'string' ? win.docs.get(doc) : undefined
      const where = fontTargets().find((t) => t === into)
      if (!win || !open || !Array.isArray(names) || !where) return { installed: [], failed: [] }
      return this.installFonts(open, names.filter((n): n is string => typeof n === 'string'), where)
    })
    ipcMain.handle('office:legal', async (event, raw: unknown) => {
      const legal = ['notice', 'license', 'thirdParty', 'source', 'original'] as const
      const what = legal.find((w) => w === raw)
      if (!this.uiSender(event) || !what || !this.setup) return false
      return openOfficeLegal(this.setup.piece, what, lang)
    })
    ipcMain.handle('office:dismissFonts', (event, raw: unknown) => {
      const win = this.uiSender(event)
      const { doc, forever } = (raw ?? {}) as { doc?: unknown; forever?: unknown }
      const open = win && typeof doc === 'string' ? win.docs.get(doc) : undefined
      if (!win || !open) return false
      if (forever === true) this.options.ignoredFonts.add(this.missingFonts(open))
      open.fontsDismissed = true
      this.sendTabs(win)
      return true
    })
    ipcMain.handle('office:forgetRecent', (event, raw: unknown) => {
      const win = this.uiSender(event)
      if (!win) return []
      if (typeof raw === 'string') this.options.recents.forget(raw)
      return this.recentFor(win.kind)
    })

    // Cortar, copiar y pegar desde el menú de Molino: en el marco que tiene el teclado
    // (el editor), como si se pulsara Ctrl+X, Ctrl+C o Ctrl+V.
    ipcMain.handle('office:clipboard', (event, raw: unknown) => {
      const win = this.uiSender(event)
      if (!win || (raw !== 'cut' && raw !== 'copy' && raw !== 'paste')) return false
      const contents = win.window.webContents
      if (raw === 'cut') contents.cut()
      else if (raw === 'copy') contents.copy()
      else contents.paste()
      return true
    })

    // Copiar un texto de la interfaz (el resultado de la IA): sin permiso de portapapeles en la página.
    ipcMain.handle('office:copyText', (event, raw: unknown) => {
      if (!this.uiSender(event) || typeof raw !== 'string' || raw.length > 5_000_000) return false
      clipboard.writeText(raw)
      return true
    })

    // Abrir un vínculo del documento (menú del botón derecho): solo web y correo, y
    // siempre preguntando con el destino real, como en los PDF (A01:2025).
    ipcMain.handle('office:openLink', async (event, raw: unknown) => {
      const win = this.uiSender(event)
      if (!win || typeof raw !== 'string' || raw.length > 2000) return false
      let url: URL
      try {
        url = new URL(raw)
      } catch {
        return false
      }
      if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) return false
      const answer = await dialog.showMessageBox(win.window, {
        type: 'question',
        buttons: [L.common.open, L.common.cancel],
        defaultId: 1,
        cancelId: 1,
        title: L.main.link.title,
        message: url.protocol === 'mailto:' ? L.main.link.mail : fmt(L.main.link.web, { host: url.host }),
        detail: url.href.slice(0, 400)
      })
      if (answer.response !== 0) return false
      await shell.openExternal(url.href)
      return true
    })

    // ---- plantillas para empezar
    ipcMain.handle('office:templates', (event) => {
      const win = this.uiSender(event)
      return win ? this.templates(win.kind) : []
    })
    ipcMain.handle('office:fromTemplate', async (event, raw: unknown) => {
      const win = this.uiSender(event)
      return win && typeof raw === 'string' ? this.fromTemplate(win.kind, raw) : false
    })

    // ---- la IA local (Ajustes → IA de Molino), sobre un documento de la ventana
    ipcMain.handle('office:aiStatus', (event) => (this.uiSender(event) ? this.options.ai.status() : { on: false, ready: false }))
    ipcMain.handle('office:aiSettings', (event) => {
      if (!this.uiSender(event)) return false
      this.options.ai.openSettings()
      return true
    })
    ipcMain.handle('office:ai', async (event, raw: unknown) => {
      const win = this.uiSender(event)
      const { doc, method, params, call } = (raw ?? {}) as { doc?: unknown; method?: unknown; params?: unknown; call?: unknown }
      const open = win && typeof doc === 'string' ? win.docs.get(doc) : undefined
      const callId = typeof call === 'number' && Number.isInteger(call) && call > 0 && call < 2_000_000_000 ? call : 0
      if (!win || !open || typeof method !== 'string' || !OFFICE_AI.has(method) || !params || typeof params !== 'object' || Array.isArray(params) || !callId) {
        return { error: { code: 'invalid_params', message: L.main.errors.invalidParams } }
      }
      try {
        const { result } = await this.engine.request(
          method,
          { ...(params as Record<string, unknown>), doc: open.doc },
          {
            priority: 6,
            onId: (id) => this.aiCalls.set(callId, id),
            onProgress: (data) => {
              if (!win.window.isDestroyed()) win.window.webContents.send('office:aiProgress', { call: callId, ...data })
            }
          }
        )
        return { result }
      } catch (error) {
        const e = error as { code?: unknown; message?: unknown }
        return { error: { code: typeof e.code === 'string' ? e.code : 'ai_failed', message: typeof e.message === 'string' ? e.message : String(error) } }
      } finally {
        this.aiCalls.delete(callId)
      }
    })
    ipcMain.on('office:aiCancel', (event, raw: unknown) => {
      if (!this.uiSender(event) || typeof raw !== 'number') return
      const id = this.aiCalls.get(raw)
      if (id !== undefined) this.engine.cancel(id)
    })

    // ---- el puente de cada editor
    ipcMain.handle('office:canvas', (event, raw: unknown) => {
      const found = this.editorDoc(event, raw)
      if (!found || found.open.canvas === null) return null
      const canvas = { b64: found.open.canvas, len: found.open.canvasLength }
      found.open.canvas = null
      return canvas
    })
    ipcMain.handle('office:changes', async (event, raw: unknown) => {
      const { doc, list, index } = (raw ?? {}) as { doc?: unknown; list?: unknown; index?: unknown }
      const found = this.editorDoc(event, doc)
      if (!found || !Array.isArray(list) || !list.every((c) => typeof c === 'string') || list.length > 1_000_000) return { ok: false }
      const from = Number.isInteger(index) && (index as number) >= 0 ? (index as number) : null
      // El motor comprueba la forma de cada cambio; aquí solo van en orden y con la misma prioridad que guardar.
      const { result } = await this.engine.request<{ applied?: number }>(
        'office.changes',
        { doc: found.open.doc, index: from, count: list.length },
        { binary: Buffer.from(list.join('\n'), 'latin1'), priority: 7 }
      )
      return { ok: true, applied: result.applied }
    })
    ipcMain.handle('office:save', async (event, raw: unknown) => {
      const { doc, saveAs, format, options } = (raw ?? {}) as { doc?: unknown; saveAs?: unknown; format?: unknown; options?: unknown }
      const found = this.editorDoc(event, doc)
      if (!found) return { error: 2 }
      const code = await this.save(found.win, found.open, saveAs === true, Number.isInteger(format) ? (format as number) : 0, options)
      found.open.pendingSave?.(code)
      return { error: code }
    })
    ipcMain.handle('office:pickImage', async (event, raw: unknown) => {
      const found = this.editorDoc(event, raw)
      if (!found) return { name: '' }
      const picked = await dialog.showOpenDialog(found.win.window, {
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
        const { result } = await this.engine.request<{ name?: unknown }>('office.addMedia', { doc: found.open.doc, ext }, { binary: data, priority: 7 })
        return { name: typeof result.name === 'string' && MEDIA_NAME.test(result.name) ? result.name : '' }
      } catch {
        return { name: '' }
      }
    })
    ipcMain.on('office:modified', (event, raw: unknown) => {
      const { doc, value } = (raw ?? {}) as { doc?: unknown; value?: unknown }
      const found = this.editorDoc(event, doc)
      if (!found) return
      found.open.modified = value === true
      this.sendTabs(found.win)
    })
    ipcMain.on('office:ready', (event, raw: unknown) => {
      const found = this.editorDoc(event, raw)
      if (found) log.info(`oficina: documento listo (${found.open.kind})`)
    })
    ipcMain.on('office:fullscreen', (event, raw: unknown) => {
      const { doc, value } = (raw ?? {}) as { doc?: unknown; value?: unknown }
      this.editorDoc(event, doc)?.win.window.setFullScreen(value === true)
    })
    // El diccionario personal: lo lee cada editor al empezar y le añade lo que el usuario pide.
    ipcMain.handle('office:userWords', (event, raw: unknown) => (this.editorDoc(event, raw) ? this.options.userWords.list() : []))
    ipcMain.handle('office:addWords', (event, raw: unknown) => {
      const { doc, words } = (raw ?? {}) as { doc?: unknown; words?: unknown }
      if (!this.editorDoc(event, doc) || !Array.isArray(words)) return false
      const list = words.filter((w): w is string => typeof w === 'string').slice(0, 50)
      if (list.length) this.options.userWords.add(list)
      return true
    })
    ipcMain.on('office:log', (event, text: unknown) => {
      // Solo sin empaquetar: lo que cuenta el editor no va al registro del usuario.
      const fromOffice = [...this.windows.values()].some((w) => !w.window.isDestroyed() && w.window.webContents === event.sender)
      if (!app.isPackaged && fromOffice) log.info(`editor: ${String(text).slice(0, 300)}`)
    })
  }

  // ================================================================ guardar

  private async save(win: AppWindow, open: OpenDoc, askedSaveAs: boolean, format: number, rawOptions: unknown): Promise<number> {
    const intent = open.intent && Date.now() - open.intent.at < INTENT_MS ? open.intent.kind : null
    open.intent = null
    const pdf = format === PDF_FORMAT
    const exporting = pdf
    const saveAs = askedSaveAs || intent === 'saveAs'
    const printing = intent === 'print' && pdf
    const current = open.path ? extname(open.path).toLowerCase() : ''
    const keeps = Object.values(SAVE_FORMATS[open.kind]).includes(current)
    const suffix = pdf ? '.pdf' : (SAVE_FORMATS[open.kind][format] ?? (keeps ? current : DEFAULT_SUFFIX[open.kind]))
    let dest = open.path
    if (printing) {
      // Para imprimir: un PDF temporal, sin preguntar.
      const folder = join(PRINT_DIR, randomBytes(6).toString('hex'))
      mkdirSync(folder, { recursive: true })
      dest = join(folder, `${parse(open.name).name}.pdf`)
    } else if (saveAs || exporting || !dest || suffix !== current) {
      // Guardar como, PDF, un documento nuevo o uno de un formato que no se escribe (.doc): se pregunta dónde.
      const T = L.main.office.filters
      const F = L.main.office.formats as Record<string, string>
      const folder = open.path ? dirname(open.path) : app.getPath('documents')
      // Con «Guardar como», los formatos de la app en los que se sigue trabajando (el del documento, el primero).
      const editable = Object.values(SAVE_FORMATS[open.kind])
      const choices = exporting ? [suffix] : saveAs ? [suffix, ...editable.filter((s) => s !== suffix)] : [suffix]
      const picked = await dialog.showSaveDialog(win.window, {
        defaultPath: join(folder, `${parse(open.name).name}${suffix}`),
        filters: choices.map((s) => ({ name: s === '.pdf' ? T.pdf : (F[s] ?? T[open.kind]), extensions: [s.slice(1)] }))
      })
      if (picked.canceled || !picked.filePath) return 1
      dest = picked.filePath
      // Sin una extensión de las que se pueden elegir, la del formato pedido.
      if (!choices.includes(extname(dest).toLowerCase())) dest = `${dest}${suffix}`
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
      void dialog.showMessageBox(win.window, {
        type: 'error',
        title: L.main.office.apps[open.kind],
        message: fmt(L.main.office.saveFailed, { name: basename(dest) }),
        detail: error instanceof EngineError ? error.message : undefined
      })
      return 2
    }
    if (printing) {
      this.options.print(dest)
      return 0
    }
    if (!exporting) {
      if (dest !== open.path) this.options.recents.add(dest)
      open.recovered = false
      open.path = dest
      open.name = basename(dest)
      open.modified = false
      this.sendTabs(win)
    }
    return 0
  }

  // ============================================================ molino://office

  private async serve(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url)
      if (request.method !== 'GET' || url.host !== HOST) return notFound()
      const path = decodeURIComponent(url.pathname)
      // La interfaz de Molino (compilada con la de Molino PDF): política estricta.
      if (path === '/__molino__/ui/office.html') return await this.file(join(this.options.rendererDir, 'office.html'), { csp: UI_CSP })
      if (path.startsWith('/__molino__/ui/')) {
        const rel = path.slice('/__molino__/ui/'.length)
        if (!UI_ASSET.test(rel)) return notFound()
        return await this.file(inside(this.options.rendererDir, rel), { csp: UI_CSP })
      }
      if (path.startsWith('/__molino__/') && OWN_FILES.has(path.slice('/__molino__/'.length))) {
        return await this.file(join(this.options.rendererDir, 'office', path.slice('/__molino__/'.length)), { bridge: true })
      }
      const setup = this.setup
      if (!setup) return notFound()
      const media = /^\/__doc__\/(o[0-9a-f]{16})\/media\/([^/]+)$/.exec(path)
      if (media) return await this.media(media[1], media[2])
      // Cada editor pide su índice y sus fuentes con su documento delante (bridge.js).
      const docFonts = /^\/__doc__\/(o[0-9a-f]{16})\/(AllFonts\.js|fonts\/(.+))$/.exec(path)
      if (docFonts) {
        const open = this.allDocs().find((d) => d.doc === docFonts[1])
        if (!open) return notFound()
        if (!docFonts[3]) return respond(Buffer.from(open.index?.text ?? setup.allFonts, 'utf8'), MIME['.js'], EDITOR_CSP)
        return await this.font(open, docFonts[3], setup)
      }
      if (path === '/sdkjs/common/AllFonts.js') return respond(Buffer.from(setup.allFonts, 'utf8'), MIME['.js'], EDITOR_CSP)
      if (path.startsWith('/dictionaries/')) return await this.file(inside(join(setup.piece, 'dictionaries'), path.slice('/dictionaries/'.length)), { piece: true, bridge: true })
      return await this.file(inside(join(setup.piece, 'editors'), path.slice(1)), { piece: true, bridge: true })
    } catch {
      return notFound()
    }
  }

  /** Una fuente del índice del editor de ``open``: del equipo o de la pieza (del disco), o una letra incrustada suya (del motor). */
  private async font(open: OpenDoc, file: string, setup: Setup): Promise<Response> {
    if (open.index) {
      const key = file.toLowerCase()
      if (!open.index.listed.has(key)) return notFound()
      const embedded = EMBEDDED_FONT.exec(file)
      if (embedded) {
        if (embedded[1] !== open.doc) return notFound()
        const { binary } = await this.engine.request('office.font', { doc: open.doc, name: embedded[2].toLowerCase() }, { priority: 8 })
        return binary ? respond(binary, 'font/ttf', EDITOR_CSP) : notFound()
      }
      return fontAllowed(file, open.index.listed, setup.folders) ? await this.file(file, { type: 'font/ttf' }) : notFound()
    }
    return fontAllowed(file, setup.listed, setup.folders) ? await this.file(file, { type: 'font/ttf' }) : notFound()
  }

  private async media(doc: string, rawName: string): Promise<Response> {
    const name = decodeURIComponent(rawName)
    if (!MEDIA_NAME.test(name) || !this.allDocs().some((d) => d.doc === doc)) return notFound()
    const { binary } = await this.engine.request('office.media', { doc, name }, { priority: 8 })
    return binary ? respond(binary, MIME[extname(name).toLowerCase()] ?? 'application/octet-stream', EDITOR_CSP) : notFound()
  }

  private async file(path: string | null, opts: { type?: string; piece?: boolean; bridge?: boolean; csp?: string } = {}): Promise<Response> {
    if (!path) return notFound()
    const ext = extname(path).toLowerCase()
    const mime = opts.type ?? MIME[ext] ?? (opts.piece ? DATA : undefined)
    if (!mime) return notFound()
    const data = await readFile(path)
    const csp = opts.csp ?? EDITOR_CSP
    if (ext === '.html' && opts.bridge) {
      // El puente, lo primero de cada página de los editores.
      const html = data.toString('utf8').replace(/<head[^>]*>/i, (head) => head + BRIDGE_TAG)
      return respond(Buffer.from(html, 'utf8'), mime, csp)
    }
    return respond(data, mime, csp)
  }
}

/** La ruta resuelta tiene que seguir dentro de ``root``: un "../" no sale de ahí (A01:2025). */
function inside(root: string, relative: string): string | null {
  const base = normalize(root)
  const full = normalize(join(base, relative))
  return full.startsWith(base + sep) ? full : null
}

function respond(data: Buffer, type: string, csp: string): Response {
  return new Response(new Uint8Array(data), {
    status: 200,
    headers: {
      'Content-Type': type,
      'Content-Security-Policy': csp,
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
