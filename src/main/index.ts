import { existsSync, mkdirSync, statSync } from 'node:fs'
import { userInfo } from 'node:os'
import { readFile } from 'node:fs/promises'
import { isAbsolute, join, resolve } from 'node:path'
import { app, BrowserWindow, dialog, nativeTheme, session, shell } from 'electron'
import { AiModels } from './aimodels'
import { HomeWindow } from './home'
import { EngineClient, type EngineLaunch } from './engine'
import { Bridge, isOpenable } from './ipc'
import { initLang, L } from './i18n'
import { initLog, log } from './log'
import { legacyModelsDir, migrateLegacy } from './migrate'
import { firstPdfNotice, markRetireTried, removeSeparatePdf, separatePdfImported, separatePdfInstalled, shouldRetireSeparatePdf, uninstallSeparatePdf } from './pdfapart'
import { bundledPieceDir, OfficePiece } from './office'
import type { HomeApp } from '@shared/home'
import type { OfficeKind } from '@shared/officeui'
import { requestedApp } from './officeapps'
import { isOfficeFile, OfficeWindows } from './officewin'
import { isStoreApp, storeAppUserModelId, storeDataDir, SUITE_FAMILY } from './appx'
import { productName } from './edition'
import { PrintService } from './print'
import { hardenContents, hardenSession, registerAppScheme, serveApp } from './security'
import { Store } from './store'
import { Updates } from './updates'
import { darkFor } from '@shared/appearance'
import { aptosFile, findAptos, FONT_STYLES } from './fonts'

async function shareExtraFonts(): Promise<void> {
  const files = await findAptos()
  if (!files.regular || !engine) return
  let shared = 0
  for (const style of FONT_STYLES) {
    const file = files[style]
    if (!file) continue
    try {
      const data = await readFile(file)
      await engine.request('fonts.register', { family: 'Aptos', style }, { binary: new Uint8Array(data), priority: 9 })
      shared++
    } catch {
      log.warn(`fuentes: no se pudo entregar Aptos (${style})`)
    }
  }
  if (shared) bridge?.sendFontsChanged()
}
import { createWindow } from './window'
import { cliArguments, runCli } from './cli'
import { engineLaunchFor } from './enginelaunch'

// Molino PDF; en la Store, la app del paquete (appx.ts). Las ventanas de las
// demás apps llevan la suya (officeapps.ts).
app.setAppUserModelId(storeAppUserModelId('pdf') ?? 'org.molinosuite.molino')

// Todos los datos de la aplicación (ajustes, registro y copias de trabajo de los
// documentos) van a una carpeta local y privada del usuario, no a la itinerante:
// en la versión de la Microsoft Store, la del propio paquete (ver appx.ts); sin
// empaquetar, %LOCALAPPDATA%\Molino.
if (!app.commandLine.hasSwitch('user-data-dir')) {
  const store = storeDataDir()
  if (store) app.setPath('userData', store)
  else if (process.env.LOCALAPPDATA) app.setPath('userData', join(process.env.LOCALAPPDATA, 'Molino'))
}

// Una sola instancia por carpeta de datos: los archivos que se abran desde el
// Explorador llegan a la ventana ya abierta, y nadie más usa la carpeta de trabajo
// (por eso es seguro limpiarla al arrancar).
// La línea de órdenes (``molino convertir…``, cli.ts) no es una ventana más: no
// pide el candado, trabaja en su propia carpeta y no toca la de la app abierta.
const cliArgs = cliArguments(process.argv)
const firstInstance = cliArgs ? false : app.requestSingleInstanceLock()
if (!cliArgs && !firstInstance) {
  app.quit()
}

// La primera vez, lo que el usuario tenía en Molino PDF (si esto es Molino Suite)
// o en Folio (ver migrate.ts). Tiene que ser aquí, antes de app.ready: después
// Electron ya ha leído la carpeta de datos.
const migrated = firstInstance ? migrateLegacy(app.getPath('userData')) : null

registerAppScheme()
hardenContents()

function localBase(): string {
  return app.getPath('userData')
}

/** Molino PDF suelto quitado al abrir la suite: el inicio lo cuenta una vez. */
let pdfRetired = false

/**
 * Molino Suite con Molino PDF instalado aparte, la primera vez: trae su IA (los
 * ajustes, recientes y firmas ya llegaron al arrancar, migrate.ts) y lo
 * desinstala. Si está abierto, se deja para la próxima vez; si Windows no deja,
 * el inicio avisa con su botón.
 */
async function retireSeparatePdf(): Promise<void> {
  const userData = app.getPath('userData')
  await bridge?.adoptLegacyAi()
  const result = await uninstallSeparatePdf()
  if (result !== 'running') markRetireTried(userData, result)
  pdfRetired = result === 'removed'
  if (result === 'removed') log.info('molino pdf aparte: quitado al abrir la suite (sus datos ya estaban traídos)')
  if (result === 'removed' || firstPdfNotice(userData)) homeWindow?.show()
}

/** Archivos pasados en la línea de órdenes (doble clic, «Abrir con»): PDF e imágenes, o de oficina. */
function filesFromArgs(argv: string[], cwd: string, office = false): string[] {
  const out: string[] = []
  for (const arg of argv.slice(1)) {
    if (!arg || arg.startsWith('-') || !(office ? isOfficeFile(arg) : isOpenable(arg))) continue
    const path = isAbsolute(arg) ? arg : resolve(cwd, arg)
    try {
      if (existsSync(path) && statSync(path).isFile()) out.push(path)
    } catch {
      /* argumento que no es un archivo accesible */
    }
  }
  return out
}

let workDir = ''
/** Carpeta de los modelos de IA descargados (la lee el motor; ver aimodels.ts). */
let modelsRoot = ''
/** Carpeta del motor de oficina (la pieza y su índice de fuentes; ver office.ts). */
let officeRoot = ''
/** La pieza de oficina que trae el paquete (Molino Suite); Molino PDF no la trae (office.ts). */
const officeBundled = bundledPieceDir()
let officeWindows: OfficeWindows | null = null
let homeWindow: HomeWindow | null = null
let engine: EngineClient | null = null
let bridge: Bridge | null = null
let updates: Updates | null = null
let mainWindow: BrowserWindow | null = null
let appStore: Store | null = null
let officePiece: OfficePiece | null = null
let quitting = false
/** El tema ha podido cambiar: lo llevan las ventanas de oficina y el inicio (se conecta al arrancar). */
let themeChanged: () => void = () => undefined
/** Lo que llega de otras instancias antes de que Molino esté listo. */
const earlyRequests: { argv: string[]; cwd: string }[] = []

function prepareWorkDir(): string {
  // Carpeta estable: la usa el motor solo si Windows no le deja aislarse (si
  // puede, trabaja en la carpeta privada de su contenedor). Los restos de una
  // ejecución que terminó de golpe los aparta (si tenían cambios sin guardar,
  // para ofrecer recuperarlos) y los borra el propio motor al arrancar.
  const dir = join(localBase(), 'work')
  mkdirSync(dir, { recursive: true })
  return dir
}

function engineLaunch(): EngineLaunch {
  return engineLaunchFor({ workDir, modelsRoot, officeRoot, officeBundled })
}

/** El nombre del usuario de Windows (para firmar comentarios si no hay otro en Ajustes). */
function windowsUser(): string {
  try {
    return userInfo().username
  } catch {
    return ''
  }
}

/** La ventana de Molino PDF, delante (la crea si no está). */
function showPdfWindow(): BrowserWindow | null {
  if (!appStore || !bridge) return null
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
    return mainWindow
  }
  const window = createWindow(appStore, app.getVersion())
  mainWindow = window
  bridge.attach(window)
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null
  })
  return window
}

/**
 * Lo que pide la línea de órdenes, al arrancar o desde otra instancia: los PDF
 * e imágenes, en Molino PDF; los documentos de oficina, en su app;
 * ``--molino-app=docs`` (los accesos del menú Inicio, officeapps.ts), la ventana
 * de esa app. Sin nada de eso, Molino PDF.
 */
async function route(argv: string[], cwd: string): Promise<void> {
  if (!officeWindows || !homeWindow) {
    earlyRequests.push({ argv, cwd })
    return
  }
  const wanted = requestedApp(argv)
  const files = [...filesFromArgs(argv, cwd), ...filesFromArgs(argv, cwd, true)]
  if (wanted === 'home') homeWindow.show()
  else if (wanted === 'pdf') showPdfWindow()
  else if (wanted && files.length === 0) await showOfficeApp(wanted)
  else if (!wanted && files.length === 0) showPdfWindow()
  if (files.length > 0) await openPaths(files)
}

/** ¿Trae este Molino las apps de oficina? Molino PDF no: dice que las trae Molino Suite y ofrece verla en la Store. */
async function officeReady(): Promise<boolean> {
  if (officePiece?.available) return true
  const window = showPdfWindow()
  const options = {
    type: 'info' as const,
    title: 'Molino PDF',
    message: L.main.office.notInstalled,
    buttons: [L.main.office.seeSuite, L.common.close],
    defaultId: 0,
    cancelId: 1
  }
  void (window ? dialog.showMessageBox(window, options) : dialog.showMessageBox(options)).then(({ response }) => {
    if (response === 0) void shell.openExternal(`ms-windows-store://pdp/?PFN=${SUITE_FAMILY}`).catch(() => undefined)
  })
  return false
}

async function showOfficeApp(kind: OfficeKind): Promise<void> {
  if (await officeReady()) officeWindows?.showApp(kind)
}

/** Abre archivos, cada uno en su app: PDF e imágenes en Molino PDF; los de oficina, en la suya. */
async function openPaths(paths: string[]): Promise<void> {
  const pdf = paths.filter(isOpenable)
  const office = paths.filter(isOfficeFile)
  if (pdf.length > 0) {
    showPdfWindow()
    void bridge?.openFromSystem(pdf)
  }
  if (office.length > 0 && (await officeReady())) {
    for (const file of office) await officeWindows?.open(file)
  }
}

/** Las apps que se pueden usar: Molino PDF siempre; las de oficina, si este Molino las trae (Molino Suite). */
async function availableApps(): Promise<Record<HomeApp, boolean>> {
  const office = officePiece?.available ?? false
  return { pdf: true, word: office, cell: office, slide: office }
}

app.on('second-instance', (_event, argv, cwd) => {
  void route(argv, cwd)
})

app.on('window-all-closed', () => {
  if (!cliArgs) app.quit()
})

app.on('before-quit', (event) => {
  if (cliArgs) return
  if (quitting) return
  quitting = true
  event.preventDefault()
  // El motor borra sus copias de trabajo al cerrar cada documento y al salir.
  const finish = (): void => app.exit(0)
  if (engine) engine.stop().then(finish, finish)
  else finish()
})

void app.whenReady().then(async () => {
  if (cliArgs) {
    app.exit(await runCli(cliArgs))
    return
  }
  initLog(join(localBase(), 'logs'))
  log.info(`${productName} ${app.getVersion()} iniciado${isStoreApp() ? ' (Microsoft Store)' : ''}`)
  // Sin rutas en el registro: solo qué archivos se trajeron.
  if (migrated) {
    log.info(`datos traídos de ${migrated.label}: ${migrated.copied.join(', ') || 'ninguno'}${migrated.signaturesSkipped ? `; firmas no (${migrated.signaturesSkipped})` : ''}`)
  }

  hardenSession(session.defaultSession)

  workDir = prepareWorkDir()
  const store = new Store(app.getPath('userData'))
  appStore = store
  initLang(store.settings.language)
  const aiModels = new AiModels(
    app.getPath('userData'),
    (progress) => bridge?.sendAiProgress(progress),
    legacyModelsDir()
  )
  modelsRoot = aiModels.root
  await aiModels.load()
  // El motor de oficina (Documentos, Hojas y Presentaciones), si este Molino lo trae.
  const office = new OfficePiece(app.getPath('userData'), officeBundled)
  officeRoot = office.root
  officePiece = office
  engine = new EngineClient(engineLaunch)
  const printer = new PrintService(engine)
  serveApp(join(__dirname, '../renderer'), (url) => printer.respond(url), aptosFile)
  updates = new Updates((status) => bridge?.sendUpdate(status))
  bridge = new Bridge(engine, store, printer, updates, aiModels, office)
  // Documentos, Hojas y Presentaciones: sus ventanas, y el motor configurado con
  // la pieza (cada vez que arranca).
  const editors = new OfficeWindows({
    engine,
    piece: office,
    rendererDir: join(__dirname, '../renderer'),
    templatesDir: app.isPackaged ? join(process.resourcesPath, 'templates') : join(app.getAppPath(), 'resources', 'templates'),
    // Cada app con su tema (Ajustes → Apariencia de cada una).
    dark: (kind) => darkFor(store.settings, kind, nativeTheme.shouldUseDarkColors),
    author: () => store.settings.author || windowsUser(),
    ignoredFonts: { list: () => store.ignoredFonts(), add: (names) => store.ignoreFonts(names) },
    userWords: { list: () => store.userWords(), add: (words) => store.addUserWords(words) },
    scripts: {
      list: (kind) => store.officeScripts(kind),
      save: (entry) => store.saveOfficeScript(entry),
      remove: (id) => store.removeOfficeScript(id)
    },
    fontLicenses: join(app.getPath('userData'), 'fonts-licenses'),
    recents: { list: () => store.officeRecent(), add: (path) => store.addOfficeRecent(path), forget: (id) => store.forgetOfficeRecent(id) },
    ai: {
      status: async () => (bridge ? bridge.officeAi() : { on: false, ready: false })
    },
    // Imprimir: cada app con su cuadro de imprimir (officeprint.ts).
    printer
  })
  officeWindows = editors
  bridge.officeBusy = () => editors.busy
  // «Molino», el inicio común con todas las apps (home.ts).
  const home = new HomeWindow({
    store,
    apps: availableApps,
    launch: (which) => (which === 'pdf' ? showPdfWindow() : editors.showApp(which)),
    create: (kind) => editors.create(kind),
    openFiles: openPaths,
    // El inicio no tiene ajustes propios: va como Windows.
    dark: () => nativeTheme.shouldUseDarkColors,
    // Molino PDF instalado aparte: antes de quitarlo, la IA que tuviera se trae (si falta).
    pdfApart: {
      installed: separatePdfInstalled,
      // La suite trajo los datos de ese Molino PDF al abrirse por primera vez (migrate.ts).
      imported: () => separatePdfImported(app.getPath('userData')),
      // Se quitó solo al abrir (una vez: el inicio lo cuenta y se olvida).
      retired: () => {
        const told = pdfRetired
        pdfRetired = false
        return told
      },
      remove: async () => {
        await bridge?.adoptLegacyAi()
        return removeSeparatePdf()
      }
    }
  })
  homeWindow = home
  // El tema de cada app (Ajustes → Apariencia en cada una, o el de Windows con «Como Windows»), al momento.
  const KINDS = ['word', 'cell', 'slide'] as const
  const shown = new Map<string, boolean>(KINDS.map((kind) => [kind, darkFor(store.settings, kind, nativeTheme.shouldUseDarkColors)]))
  let homeDark = nativeTheme.shouldUseDarkColors
  themeChanged = () => {
    for (const kind of KINDS) {
      const dark = darkFor(store.settings, kind, nativeTheme.shouldUseDarkColors)
      if (shown.get(kind) === dark) continue
      shown.set(kind, dark)
      editors.setDark(kind, dark)
    }
    if (homeDark !== nativeTheme.shouldUseDarkColors) {
      homeDark = nativeTheme.shouldUseDarkColors
      home.setDark(homeDark)
    }
  }
  bridge.onTheme = () => themeChanged()
  // Ajustes, IA, versiones nuevas…: lo mismo en Documentos, Hojas y Presentaciones (ipc.ts, SHARED_CHANNELS).
  bridge.sharedSender = (event) => editors.uiWindow(event)
  bridge.sharedWindows = () => editors.uiContents()
  nativeTheme.on('updated', () => themeChanged())
  bridge.officeLaunch = (which) => {
    if (which === 'home') home.show()
    else if (which === 'pdf') showPdfWindow()
    else editors.showApp(which)
  }
  engine.on('ready', () => void editors.configure())
  // Cada vez que el motor arranca (o rearranca) recibe en memoria las fuentes
  // extra que haya en este equipo (Aptos); después la interfaz recarga la lista.
  engine.on('ready', () => void shareExtraFonts())
  // Y la configuración de la IA (qué modelos hay y si puede usar la gráfica).
  engine.on('ready', () => void bridge?.configureAi())
  engine.start().catch(() => log.error('el motor no arrancó'))

  // Al poco de abrir, y solo si el usuario no lo ha desactivado: mirar si hay
  // versión nueva (solo se avisa; se actualiza en la Store).
  setTimeout(() => {
    if (store.settings.checkUpdates) updates?.check(false)
  }, 6000)
  // Molino Suite con Molino PDF instalado aparte (pdfapart.ts): la primera vez, una vez traído
  // todo (ajustes, recientes y firmas al arrancar; la IA aquí), se desinstala solo y el inicio
  // lo cuenta. Si está abierto o Windows no deja, el inicio avisa con un botón para hacerlo.
  // Si no, quien tenía la IA en Folio la sigue teniendo: sus modelos se copian (comprobados)
  // en vez de descargarse. Sin red; si falta alguno, no se hace nada.
  setTimeout(() => void (shouldRetireSeparatePdf(app.getPath('userData')) ? retireSeparatePdf() : bridge?.adoptLegacyAi()), 3000)
  if (!shouldRetireSeparatePdf(app.getPath('userData')) && firstPdfNotice(app.getPath('userData'))) setTimeout(() => homeWindow?.show(), 1500)
  // Al minuto, sin estorbar el arranque: huella de los modelos de IA instalados.
  // En pruebas (sin empaquetar) se puede adelantar con MOLINO_TEST_AI_RECHECK_MS.
  const recheckDelay = !app.isPackaged ? Number(process.env.MOLINO_TEST_AI_RECHECK_MS) : NaN
  setTimeout(() => void bridge?.recheckAi(), Number.isInteger(recheckDelay) && recheckDelay >= 0 ? recheckDelay : 60_000)

  // Lo que se pidió al abrir Molino (y lo que llegó de otras instancias mientras arrancaba).
  await route(process.argv, process.cwd())
  for (const { argv, cwd } of earlyRequests.splice(0)) await route(argv, cwd)
})
