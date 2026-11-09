import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { extname, join } from 'node:path'
import { app, type AppDetailsOptions, shell, type ShortcutDetails } from 'electron'
import { messagesFor } from '@shared/i18n'
import type { OfficeKind } from '@shared/officeui'
import { isStoreApp } from './appx'
import { L, lang } from './i18n'
import { log } from './log'
import { isPortable } from './portable'
import { regDelete, regQuery, regSet } from './registry'

/**
 * Documentos, Hojas y Presentaciones como programas de Windows (paso 6 de
 * PLAN-SUITE): cada una con su acceso en el menú Inicio, su icono, su
 * identidad en la barra de tareas (AppUserModelID: se agrupa y se ancla por
 * separado) y sus tipos de archivo en «Abrir con» y en «Aplicaciones
 * predeterminadas». Todo es del usuario (HKCU y su menú Inicio), sin permisos
 * de administrador, y solo en la versión instalada: la portable no se registra
 * en Windows y la de la Store lo hace con su paquete.
 *
 * Como el motor de oficina se añade después de instalar Molino, esto lo hace la
 * propia aplicación (al arrancar, al añadir o quitar la pieza y al elegir qué
 * apps se ven) y lo deshace el desinstalador (build/installer.nsh).
 */

export const OFFICE_KINDS: OfficeKind[] = ['word', 'cell', 'slide']

/** Extensiones que abre cada app: las que convierte el motor (engine/molino_engine/office.py, OPEN_FORMATS). */
export const OPENS: Record<OfficeKind, string[]> = {
  word: ['.docx', '.doc', '.odt', '.rtf'],
  cell: ['.xlsx', '.xls', '.ods', '.csv'],
  slide: ['.pptx', '.ppt', '.odp']
}

/** La app que abre un archivo, por su extensión (null si ninguna). */
export function officeKindOf(path: string): OfficeKind | null {
  const ext = extname(path).toLowerCase()
  return OFFICE_KINDS.find((kind) => OPENS[kind].includes(ext)) ?? null
}

/** Las apps de Molino y «Molino», el inicio común (home.ts). */
export type MolinoApp = OfficeKind | 'pdf' | 'home'

/** Cómo se pide cada app en la línea de órdenes: ``Molino.exe --molino-app=docs``. */
const APP_ARG: Record<MolinoApp, string> = { pdf: 'pdf', word: 'docs', cell: 'sheets', slide: 'slides', home: 'home' }

/** La app pedida en la línea de órdenes (null si ninguna). */
export function requestedApp(argv: string[]): MolinoApp | null {
  for (const arg of argv) {
    const match = /^--molino-app=([a-z]+)$/.exec(arg)
    const found = match && (Object.keys(APP_ARG) as MolinoApp[]).find((key) => APP_ARG[key] === match[1])
    if (found) return found
  }
  return null
}

/** Identidad de cada app en Windows. Molino PDF usa la de la aplicación (index.ts, setAppUserModelId). */
export const APP_USER_MODEL_ID: Record<OfficeKind, string> = {
  word: 'org.molinosuite.molino.docs',
  cell: 'org.molinosuite.molino.sheets',
  slide: 'org.molinosuite.molino.slides'
}
const HOME_USER_MODEL_ID = 'org.molinosuite.molino.home'

/** Tipo de archivo (ProgId) de cada app, propio de Molino. */
const PROG_ID: Record<OfficeKind, string> = { word: 'Molino.Docs', cell: 'Molino.Sheets', slide: 'Molino.Slides' }

/** Nombre fijo con el que cada app se registra en RegisteredApplications (como «Molino PDF»). */
const REGISTERED: Record<OfficeKind, string> = { word: 'Molino Documentos', cell: 'Molino Hojas', slide: 'Molino Presentaciones' }

const ICON_FILE: Record<OfficeKind, string> = { word: 'documentos.ico', cell: 'hojas.ico', slide: 'presentaciones.ico' }

/**
 * Clave de Molino en «Aplicaciones instaladas»: la que le da electron-builder,
 * un UUID v5 de su appId (org.molinosuite.molino) con su espacio de nombres
 * (NsisTarget.js: ELECTRON_BUILDER_NS_UUID). Se comprobó con la de Folio.
 */
const UNINSTALL_KEY = 'abeea415-e00e-5649-9118-8c5d4998399e'

/** Un icono de build/icons (en la versión instalada, resources\icons). */
export function iconPath(file: string): string {
  return app.isPackaged ? join(process.resourcesPath, 'icons', file) : join(app.getAppPath(), 'build', 'icons', file)
}

export function appIcon(kind: OfficeKind): string {
  return iconPath(ICON_FILE[kind])
}

/** Molino.exe y lo que va antes de los argumentos (sin empaquetar: electron.exe y la carpeta de la app). */
function launcher(): { target: string; args: string[] } {
  return app.isPackaged ? { target: process.execPath, args: [] } : { target: process.execPath, args: [app.getAppPath()] }
}

const quote = (value: string): string => `"${value}"`

/** La orden que abre una app (sin documento) o el inicio. */
function launchCommand(kind: OfficeKind | 'home'): string {
  const { target, args } = launcher()
  return [quote(target), ...args.map(quote), `--molino-app=${APP_ARG[kind]}`].join(' ')
}

/** Para la ventana de una app: su identidad, su icono y cómo volver a abrirla si se ancla a la barra de tareas. */
export function windowDetails(kind: OfficeKind): AppDetailsOptions {
  return {
    appId: APP_USER_MODEL_ID[kind],
    appIconPath: appIcon(kind),
    appIconIndex: 0,
    relaunchCommand: launchCommand(kind),
    relaunchDisplayName: L.main.office.apps[kind]
  }
}

/** Lo mismo para la ventana de «Molino», el inicio común. */
export function homeDetails(): AppDetailsOptions {
  return {
    appId: HOME_USER_MODEL_ID,
    appIconPath: iconPath('molino.ico'),
    appIconIndex: 0,
    relaunchCommand: launchCommand('home'),
    relaunchDisplayName: 'Molino'
  }
}

// ======================================================= menú Inicio y registro

interface Target {
  /** Carpeta de los accesos del menú Inicio. */
  startMenu: string
  /** Raíz del registro (HKCU\Software, o la de pruebas). */
  root: string
}

/** Solo pruebas, sin empaquetar: MOLINO_TEST_SHELL es una carpeta donde poner el «menú Inicio», y el registro va a una clave aparte. */
export const TEST_REGISTRY_ROOT = 'HKCU\\Software\\MolinoPruebas'

function target(): Target | null {
  if (process.platform !== 'win32') return null
  if (!app.isPackaged) {
    const dir = process.env.MOLINO_TEST_SHELL
    return dir ? { startMenu: join(dir, 'Start Menu'), root: TEST_REGISTRY_ROOT } : null
  }
  if (isPortable() || isStoreApp()) return null
  return { startMenu: join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs'), root: 'HKCU\\Software' }
}

/** ¿Registra Molino sus apps en Windows? (no en la portable ni en la de la Store). */
export function shellIntegration(): boolean {
  return target() !== null
}

function syncShortcut(t: Target, kind: OfficeKind | 'home', wanted: boolean): void {
  // «Molino» se llama igual en los dos idiomas; las apps, no.
  const nameIn = (l: 'es' | 'en'): string => (kind === 'home' ? 'Molino' : messagesFor(l).main.office.apps[kind])
  const current = join(t.startMenu, `${nameIn(lang)}.lnk`)
  // Con el otro idioma, el acceso se llamaba de otra forma.
  for (const name of new Set((['es', 'en'] as const).map(nameIn))) {
    const path = join(t.startMenu, `${name}.lnk`)
    if ((!wanted || path !== current) && existsSync(path)) rmSync(path, { force: true })
  }
  if (!wanted) return
  const { target: exe, args } = launcher()
  const details: ShortcutDetails = {
    target: exe,
    args: [...args.map(quote), `--molino-app=${APP_ARG[kind]}`].join(' '),
    description: kind === 'home' ? L.main.home.description : L.main.office.descriptions[kind],
    icon: kind === 'home' ? iconPath('molino.ico') : appIcon(kind),
    iconIndex: 0,
    appUserModelId: kind === 'home' ? HOME_USER_MODEL_ID : APP_USER_MODEL_ID[kind]
  }
  const exists = existsSync(current)
  if (exists) {
    try {
      const has = shell.readShortcutLink(current)
      if (has.target === details.target && has.args === details.args && has.icon === details.icon && has.appUserModelId === details.appUserModelId) return
    } catch {
      /* acceso roto: se vuelve a escribir */
    }
  }
  mkdirSync(t.startMenu, { recursive: true })
  if (!shell.writeShortcutLink(current, exists ? 'replace' : 'create', details)) log.warn(`apps: no se pudo crear el acceso de ${kind}`)
}

/** Lo que se escribe en el registro depende de esto: si no cambia, no se vuelve a escribir al arrancar. */
function marker(kind: OfficeKind): string {
  const hash = createHash('sha256').update(`${launchCommand(kind)}|${appIcon(kind)}|${OPENS[kind].join(',')}`).digest('hex').slice(0, 16)
  return `1 ${app.getVersion()} ${lang} ${hash}`
}

async function syncAssociations(t: Target, kind: OfficeKind, wanted: boolean): Promise<void> {
  const classes = `${t.root}\\Classes`
  const progKey = `${classes}\\${PROG_ID[kind]}`
  const caps = `${t.root}\\CuevasTech\\${REGISTERED[kind]}\\Capabilities`
  const written = await regQuery(progKey, 'MolinoSync')
  if (wanted && written === marker(kind)) return
  if (!wanted) {
    if (written === null) return
    await regDelete(progKey)
    for (const ext of OPENS[kind]) await regDelete(`${classes}\\${ext}\\OpenWithProgids`, PROG_ID[kind])
    await regDelete(`${t.root}\\CuevasTech\\${REGISTERED[kind]}`)
    await regDelete(`${t.root}\\RegisteredApplications`, REGISTERED[kind])
    return
  }
  const icon = `${appIcon(kind)},0`
  const ok = [
    await regSet(progKey, null, L.main.office.fileTypes[kind]),
    await regSet(progKey, 'AppUserModelID', APP_USER_MODEL_ID[kind]),
    await regSet(`${progKey}\\DefaultIcon`, null, icon),
    await regSet(`${progKey}\\shell\\open\\command`, null, `${launchCommand(kind)} "%1"`),
    // En «Abrir con» de cada extensión, sin quitarle nada a nadie.
    ...(await Promise.all(OPENS[kind].map((ext) => regSet(`${classes}\\${ext}\\OpenWithProgids`, PROG_ID[kind], '')))),
    // En «Aplicaciones predeterminadas», donde el usuario la puede elegir.
    await regSet(caps, 'ApplicationName', L.main.office.apps[kind]),
    await regSet(caps, 'ApplicationDescription', L.main.office.descriptions[kind]),
    await regSet(caps, 'ApplicationIcon', icon),
    ...(await Promise.all(OPENS[kind].map((ext) => regSet(`${caps}\\FileAssociations`, ext, PROG_ID[kind])))),
    await regSet(`${t.root}\\RegisteredApplications`, REGISTERED[kind], caps.replace(/^HKCU\\/, ''))
  ]
  // La marca, la última y solo si todo lo demás se escribió.
  if (ok.every(Boolean)) await regSet(progKey, 'MolinoSync', marker(kind))
  else log.warn(`apps: no se pudieron registrar los tipos de archivo de ${kind}`)
}

/** «Aplicaciones instaladas» dice «Molino» cuando hay más de una app, y «Molino PDF» cuando solo está el PDF. */
async function syncInstalledName(t: Target, suite: boolean): Promise<void> {
  const key = `${t.root}\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${UNINSTALL_KEY}`
  const current = await regQuery(key, 'DisplayName')
  // Sin la clave, Molino no está instalado con su instalador (o es una prueba sin ella).
  if (current === null) return
  const name = suite ? 'Molino' : 'Molino PDF'
  if (current === name) return
  await regSet(key, 'DisplayName', name)
  await regSet(key, 'DisplayIcon', suite ? `${iconPath('molino.ico')},0` : `${process.execPath},0`)
}

let queue: Promise<void> = Promise.resolve()

/**
 * Deja Windows como dicen ``shown`` (las apps que el usuario quiere ver, con
 * la pieza instalada): accesos, tipos de archivo y nombre en «Aplicaciones
 * instaladas». Una llamada detrás de otra; los fallos solo van al registro.
 */
export function syncShell(shown: Record<OfficeKind, boolean>): Promise<void> {
  const t = target()
  if (!t) return Promise.resolve()
  queue = queue.then(async () => {
    try {
      for (const kind of OFFICE_KINDS) {
        syncShortcut(t, kind, shown[kind])
        await syncAssociations(t, kind, shown[kind])
      }
      // Con alguna app de oficina, Molino es una suite: su inicio común y su nombre.
      const suite = OFFICE_KINDS.some((kind) => shown[kind])
      syncShortcut(t, 'home', suite)
      await syncInstalledName(t, suite)
    } catch (error) {
      log.warn(`apps: no se pudo poner Molino en Windows (${error instanceof Error ? error.name : '?'})`)
    }
  })
  return queue
}

/** Abre la página de una app en «Aplicaciones predeterminadas» (donde el usuario elige con qué se abren sus archivos). */
export async function openDefaultApps(kind: OfficeKind): Promise<boolean> {
  if (!app.isPackaged) {
    log.info(`apps: se abriría «Aplicaciones predeterminadas» de ${kind} (sin empaquetar)`)
    return true
  }
  try {
    await shell.openExternal(`ms-settings:defaultapps?registeredAppUser=${encodeURIComponent(REGISTERED[kind])}`)
    return true
  } catch {
    try {
      await shell.openExternal('ms-settings:defaultapps')
      return true
    } catch {
      return false
    }
  }
}
