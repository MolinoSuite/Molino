import { existsSync, mkdirSync, statSync } from 'node:fs'
import { userInfo } from 'node:os'
import { readFile } from 'node:fs/promises'
import { isAbsolute, join, resolve } from 'node:path'
import { app, BrowserWindow, dialog, nativeTheme, session } from 'electron'
import { AiModels } from './aimodels'
import { HomeWindow } from './home'
import { EngineClient, type EngineLaunch } from './engine'
import { Bridge, isOpenable } from './ipc'
import { initLang, L } from './i18n'
import { initLog, log } from './log'
import { legacyModelsDir, migrateFromFolio } from './migrate'
import { OfficePiece } from './office'
import type { HomeApp } from '@shared/home'
import type { OfficeKind } from '@shared/officeui'
import { OFFICE_KINDS, requestedApp, syncShell } from './officeapps'
import { isOfficeFile, OfficeWindows } from './officewin'
import { portableDataDir } from './portable'
import { isStoreApp, storeDataDir } from './appx'
import { PrintService } from './print'
import { hardenContents, hardenSession, registerAppScheme, serveApp } from './security'
import { Store } from './store'
import { Updates } from './updates'
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

app.setAppUserModelId('org.molinosuite.molino')

// Todos los datos de la aplicación (ajustes, registro y copias de trabajo de los
// documentos) van a una carpeta local y privada del usuario, no a la itinerante.
// Es la carpeta de la suite (%LOCALAPPDATA%\Molino): las apps que vengan
// compartirán ajustes y modelos de IA. En la versión portable, a MolinoData,
// junto a Molino.exe (ver portable.ts). En la versión de la Microsoft Store, a la
// carpeta del propio paquete (ver appx.ts).
if (!app.commandLine.hasSwitch('user-data-dir')) {
  const portable = portableDataDir()
  const store = portable ? null : storeDataDir()
  if (portable) app.setPath('userData', portable)
  else if (store) app.setPath('userData', store)
  else if (process.env.LOCALAPPDATA) app.setPath('userData', join(process.env.LOCALAPPDATA, 'Molino'))
}

// Una sola instancia por carpeta de datos: los archivos que se abran desde el
// Explorador llegan a la ventana ya abierta, y nadie más usa la carpeta de trabajo
// (por eso es seguro limpiarla al arrancar).
const firstInstance = app.requestSingleInstanceLock()
if (!firstInstance) {
  app.quit()
}

// La primera vez, lo que el usuario tenía en Folio (ver migrate.ts). Tiene que
// ser aquí, antes de app.ready: después Electron ya ha leído la carpeta de datos.
const fromFolio = firstInstance ? migrateFromFolio(app.getPath('userData'), portableDataDir() !== null) : null

registerAppScheme()
hardenContents()

function localBase(): string {
  return app.getPath('userData')
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
let officeWindows: OfficeWindows | null = null
let homeWindow: HomeWindow | null = null
let engine: EngineClient | null = null
let bridge: Bridge | null = null
let updates: Updates | null = null
let mainWindow: BrowserWindow | null = null
let appStore: Store | null = null
let officePiece: OfficePiece | null = null
let quitting = false
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
  if (app.isPackaged) {
    const dir = join(process.resourcesPath, 'engine')
    return {
      command: join(dir, 'molino-engine.exe'),
      args: ['--workdir', workDir, '--resources', join(process.resourcesPath, 'assets'), '--models', modelsRoot, '--office', officeRoot],
      cwd: dir
    }
  }
  const root = app.getAppPath()
  return {
    command: join(root, 'engine', '.venv', 'Scripts', 'python.exe'),
    // -E y -s: el intérprete ignora las variables PYTHON* y los paquetes del
    // perfil del usuario, de modo que el entorno no puede inyectarle código.
    args: ['-E', '-s', '-m', 'molino_engine', '--workdir', workDir, '--resources', join(root, 'resources'), '--models', modelsRoot, '--office', officeRoot],
    cwd: join(root, 'engine')
  }
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

/** ¿Está el motor de oficina? Si no (un acceso que quedó, un «Abrir con»), Molino PDF dice cómo añadirlo. */
async function officeReady(): Promise<boolean> {
  if (officePiece && (await officePiece.ready()) !== null) return true
  const window = showPdfWindow()
  const options = { type: 'info' as const, title: 'Molino', message: L.main.office.notInstalled }
  void (window ? dialog.showMessageBox(window, options) : dialog.showMessageBox(options))
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

/** Las apps que se pueden usar: Molino PDF siempre; las de oficina, con la pieza y si el usuario las quiere ver. */
async function availableApps(): Promise<Record<HomeApp, boolean>> {
  const installed = officePiece !== null && (await officePiece.ready()) !== null
  const shown = appStore?.settings.officeApps ?? { word: false, cell: false, slide: false }
  return { pdf: true, word: installed && shown.word, cell: installed && shown.cell, slide: installed && shown.slide }
}

/** Pone en Windows las apps de oficina que se ven (con la pieza instalada): accesos, tipos de archivo, nombre. */
async function syncOfficeApps(): Promise<void> {
  if (!appStore || !officePiece) return
  const installed = (await officePiece.ready()) !== null
  const shown = appStore.settings.officeApps
  await syncShell(Object.fromEntries(OFFICE_KINDS.map((kind) => [kind, installed && shown[kind]])) as typeof shown)
}

app.on('second-instance', (_event, argv, cwd) => {
  void route(argv, cwd)
})

app.on('window-all-closed', () => app.quit())

app.on('before-quit', (event) => {
  if (quitting) return
  quitting = true
  event.preventDefault()
  // El motor borra sus copias de trabajo al cerrar cada documento y al salir.
  const finish = (): void => {
    // Una versión nueva que el usuario ya descargó se instala al salir, sin
    // volver a abrir Molino PDF. El instalador cierra lo que quede; por si no
    // llegara a arrancar, se sale igualmente al poco.
    if (updates?.install(false)) setTimeout(() => app.exit(0), 5000)
    else app.exit(0)
  }
  if (engine) engine.stop().then(finish, finish)
  else finish()
})

void app.whenReady().then(async () => {
  initLog(join(localBase(), 'logs'))
  log.info(`Molino PDF ${app.getVersion()} iniciado${portableDataDir() ? ' (portable)' : isStoreApp() ? ' (Microsoft Store)' : ''}`)
  // Sin rutas en el registro: solo qué archivos se trajeron.
  if (fromFolio) {
    log.info(`datos traídos de Folio: ${fromFolio.copied.join(', ') || 'ninguno'}${fromFolio.signaturesSkipped ? `; firmas no (${fromFolio.signaturesSkipped})` : ''}`)
  }

  hardenSession(session.defaultSession)

  workDir = prepareWorkDir()
  const store = new Store(app.getPath('userData'))
  appStore = store
  initLang(store.settings.language)
  const aiModels = new AiModels(
    app.getPath('userData'),
    (progress) => bridge?.sendAiProgress(progress),
    legacyModelsDir(portableDataDir() !== null)
  )
  modelsRoot = aiModels.root
  await aiModels.load()
  // El motor de oficina (Documentos, Hojas y Presentaciones), si se ha añadido.
  const office = new OfficePiece(app.getPath('userData'), (progress) => bridge?.sendOfficeProgress(progress))
  await office.load()
  officeRoot = office.root
  officePiece = office
  engine = new EngineClient(engineLaunch)
  const printer = new PrintService(engine)
  serveApp(join(__dirname, '../renderer'), (url) => printer.respond(url), aptosFile)
  updates = new Updates((status) => bridge?.sendUpdate(status))
  bridge = new Bridge(engine, store, printer, updates, aiModels, office)
  // Documentos, Hojas y Presentaciones: sus ventanas, y el motor configurado con
  // la pieza (al arrancar el motor y al añadirla o quitarla).
  const editors = new OfficeWindows({
    engine,
    piece: office,
    rendererDir: join(__dirname, '../renderer'),
    dark: () => store.settings.theme === 'dark' || (store.settings.theme === 'system' && nativeTheme.shouldUseDarkColors),
    author: () => store.settings.author || windowsUser(),
    ignoredFonts: { list: () => store.ignoredFonts(), add: (names) => store.ignoreFonts(names) },
    fontLicenses: join(app.getPath('userData'), 'fonts-licenses'),
    recents: { list: () => store.officeRecent(), add: (path) => store.addOfficeRecent(path), forget: (id) => store.forgetOfficeRecent(id) },
    // Imprimir un documento de oficina: con el cuadro de imprimir de Molino PDF.
    print: (path) => {
      showPdfWindow()
      void bridge?.printFile(path)
    }
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
    dark: () => store.settings.theme === 'dark' || (store.settings.theme === 'system' && nativeTheme.shouldUseDarkColors)
  })
  homeWindow = home
  bridge.officeLaunch = (which) => (which === 'home' ? home.show() : editors.showApp(which))
  // Cada app de oficina, un programa de Windows (officeapps.ts): al arrancar, al
  // añadir o quitar la pieza y al elegir en Ajustes qué apps se ven.
  bridge.onOfficeApps = () => {
    void syncOfficeApps()
    home.notify()
  }
  office.onChange = () => {
    void editors.configure()
    void syncOfficeApps()
    home.notify()
  }
  engine.on('ready', () => void editors.configure())
  // Cada vez que el motor arranca (o rearranca) recibe en memoria las fuentes
  // extra que haya en este equipo (Aptos); después la interfaz recarga la lista.
  engine.on('ready', () => void shareExtraFonts())
  // Y la configuración de la IA (qué modelos hay y si puede usar la gráfica).
  engine.on('ready', () => void bridge?.configureAi())
  engine.start().catch(() => log.error('el motor no arrancó'))

  // Al poco de abrir, y solo si el usuario no lo ha desactivado: mirar si hay
  // versión nueva (solo se avisa; descargar e instalar lo decide él).
  setTimeout(() => {
    if (store.settings.checkUpdates) updates?.check(false)
  }, 6000)
  // Quien tenía la IA en Folio la sigue teniendo: sus modelos se copian
  // (comprobados) en vez de descargarse. Sin red; si falta alguno, no se hace nada.
  setTimeout(() => void bridge?.adoptLegacyAi(), 3000)
  // Al minuto, sin estorbar el arranque: huella de los modelos de IA instalados.
  // En pruebas (sin empaquetar) se puede adelantar con MOLINO_TEST_AI_RECHECK_MS.
  const recheckDelay = !app.isPackaged ? Number(process.env.MOLINO_TEST_AI_RECHECK_MS) : NaN
  setTimeout(() => void bridge?.recheckAi(), Number.isInteger(recheckDelay) && recheckDelay >= 0 ? recheckDelay : 60_000)

  // Lo que se pidió al abrir Molino (y lo que llegó de otras instancias mientras arrancaba).
  await route(process.argv, process.cwd())
  for (const { argv, cwd } of earlyRequests.splice(0)) await route(argv, cwd)
  void syncOfficeApps()
})
