import { execFile } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { app, type BrowserWindow, dialog } from 'electron'
import { edition, productName } from './edition'
import { fmt, L } from './i18n'
import { desktopFile, MIME_TYPES } from './linuxDesktop'
import { log } from './log'

/**
 * Linux, con la AppImage: Molino en el menú de aplicaciones.
 *
 * Una AppImage es un solo archivo que no instala nada. La primera vez, Molino
 * pregunta si se añade al menú; si se acepta, pone para este usuario
 * (~/.local/share) los accesos de sus apps (en Molino Suite, cinco) con sus
 * iconos y sus tipos de archivo, apuntando a ese archivo. Son los mismos que
 * pone el .deb o el .rpm (linuxDesktop.ts), así que «programa predeterminado»
 * funciona igual. Si la AppImage se mueve o se actualiza, se rehacen al abrirla.
 */

const APPIMAGE = process.platform === 'linux' && app.isPackaged ? process.env.APPIMAGE : undefined

interface Entry {
  file: string
  name: string
  nameEn: string
  generic: string
  genericEn: string
  /** El icono en build/linux/hicolor y el nombre con el que se instala. */
  icon: [string, string]
  arg: string | null
  mime: string[]
  categories: string
}

function entries(): Entry[] {
  if (edition === 'pdf') {
    return [
      { file: desktopFile('pdf'), name: 'Molino PDF', nameEn: 'Molino PDF', generic: 'Visor y editor de PDF', genericEn: 'PDF viewer and editor', icon: ['molino-pdf', 'molino-pdf'], arg: null, mime: MIME_TYPES.pdf, categories: 'Office;Viewer;' }
    ]
  }
  return [
    { file: desktopFile('home'), name: 'Molino', nameEn: 'Molino', generic: 'Suite ofimática', genericEn: 'Office suite', icon: ['molino', 'molino-suite'], arg: 'home', mime: [], categories: 'Office;' },
    { file: desktopFile('pdf'), name: 'Molino PDF', nameEn: 'Molino PDF', generic: 'Visor y editor de PDF', genericEn: 'PDF viewer and editor', icon: ['molino-pdf', 'molino-suite-pdf'], arg: 'pdf', mime: MIME_TYPES.pdf, categories: 'Office;Viewer;' },
    { file: desktopFile('word'), name: 'Molino Documentos', nameEn: 'Molino Docs', generic: 'Procesador de textos', genericEn: 'Word processor', icon: ['molino-documentos', 'molino-documentos'], arg: 'docs', mime: MIME_TYPES.word, categories: 'Office;WordProcessor;' },
    { file: desktopFile('cell'), name: 'Molino Hojas', nameEn: 'Molino Sheets', generic: 'Hoja de cálculo', genericEn: 'Spreadsheet', icon: ['molino-hojas', 'molino-hojas'], arg: 'sheets', mime: MIME_TYPES.cell, categories: 'Office;Spreadsheet;' },
    { file: desktopFile('slide'), name: 'Molino Presentaciones', nameEn: 'Molino Slides', generic: 'Presentaciones', genericEn: 'Presentations', icon: ['molino-presentaciones', 'molino-presentaciones'], arg: 'slides', mime: MIME_TYPES.slide, categories: 'Office;Presentation;' }
  ]
}

/**
 * La ruta, como argumento de Exec de un .desktop (especificación de freedesktop):
 * entre comillas con «"», «`», «$» y la barra invertida escapados; después, como
 * todo valor de texto del archivo, cada barra invertida doblada; y «%» como «%%».
 */
function execQuote(path: string): string {
  const quoted = `"${path.replace(/[\\"`$]/g, (c) => `\\${c}`)}"`
  return quoted.replace(/\\/g, '\\\\').replace(/%/g, '%%')
}

function desktopText(entry: Entry, appImage: string): string {
  const wmClass = edition === 'pdf' ? 'molino-pdf' : 'molino-suite'
  return [
    '[Desktop Entry]',
    'Type=Application',
    `Name=${entry.name}`,
    `Name[en]=${entry.nameEn}`,
    `GenericName=${entry.generic}`,
    `GenericName[en]=${entry.genericEn}`,
    `Exec=${execQuote(appImage)}${entry.arg ? ` --molino-app=${entry.arg}` : ''} %U`,
    `Icon=${entry.icon[1]}`,
    'Terminal=false',
    `StartupWMClass=${wmClass}`,
    `Categories=${entry.categories}`,
    ...(entry.mime.length > 0 ? [`MimeType=${entry.mime.join(';')};`] : []),
    // Lo puso Molino desde su AppImage (para reconocerlo).
    'X-Molino-AppImage=true',
    ''
  ].join('\n')
}

function dataHome(): string {
  const xdg = process.env.XDG_DATA_HOME
  return xdg && isAbsolute(xdg) ? xdg : join(homedir(), '.local', 'share')
}

/** Lo que se recuerda: si se preguntó, si se aceptó y para qué AppImage y versión se pusieron los accesos. */
interface State {
  asked: boolean
  accepted: boolean
  path?: string
  version?: string
}

function stateFile(): string {
  return join(app.getPath('userData'), 'appimage.json')
}

function readState(): State {
  try {
    const raw = JSON.parse(readFileSync(stateFile(), 'utf8')) as Partial<State>
    return { asked: raw.asked === true, accepted: raw.accepted === true, path: typeof raw.path === 'string' ? raw.path : undefined, version: typeof raw.version === 'string' ? raw.version : undefined }
  } catch {
    return { asked: false, accepted: false }
  }
}

function writeState(state: State): void {
  try {
    writeFileSync(stateFile(), JSON.stringify(state))
  } catch {
    /* se volverá a preguntar */
  }
}

/** Pone (o rehace) los accesos y los iconos de este usuario. */
function integrate(appImage: string): boolean {
  try {
    const icons = join(process.resourcesPath, 'linux-icons')
    const share = dataHome()
    const applications = join(share, 'applications')
    mkdirSync(applications, { recursive: true })
    for (const entry of entries()) {
      for (const size of readdirSync(icons).filter((d) => /^\d+x\d+$/.test(d))) {
        const from = join(icons, size, 'apps', `${entry.icon[0]}.png`)
        if (!existsSync(from)) continue
        const target = join(share, 'icons', 'hicolor', size, 'apps')
        mkdirSync(target, { recursive: true })
        cpSync(from, join(target, `${entry.icon[1]}.png`))
      }
      writeFileSync(join(applications, entry.file), desktopText(entry, appImage), { mode: 0o644 })
    }
    // Que el menú y «Abrir con» lo vean ya (si están las herramientas; si no, al reiniciar la sesión).
    execFile('/usr/bin/update-desktop-database', [applications], () => undefined)
    log.info(`appimage: accesos en el menú (${entries().length})`)
    return true
  } catch {
    log.warn('appimage: no se pudieron poner los accesos en el menú')
    return false
  }
}

/**
 * Con la AppImage: la primera vez, ofrece añadir Molino al menú; si ya se
 * aceptó, rehace los accesos si la AppImage ha cambiado de sitio o de versión.
 */
export async function offerAppImageIntegration(parent: () => BrowserWindow | null): Promise<void> {
  // eslint-disable-next-line no-control-regex
  if (!APPIMAGE || !isAbsolute(APPIMAGE) || /[\x00-\x1f\x7f]/.test(APPIMAGE)) return
  try {
    if (!statSync(APPIMAGE).isFile()) return
  } catch {
    return
  }
  const state = readState()
  const version = app.getVersion()
  if (state.accepted) {
    if (state.path !== APPIMAGE || state.version !== version) {
      if (integrate(APPIMAGE)) writeState({ ...state, path: APPIMAGE, version })
    }
    return
  }
  if (state.asked) return
  const T = L.main.appimage
  const options = {
    type: 'question' as const,
    title: productName,
    message: fmt(T.message, { name: productName }),
    detail: T.detail,
    buttons: [T.add, T.notNow],
    defaultId: 0,
    cancelId: 1
  }
  const window = parent()
  const { response } = await (window ? dialog.showMessageBox(window, options) : dialog.showMessageBox(options))
  const accepted = response === 0 && integrate(APPIMAGE)
  writeState({ asked: true, accepted, ...(accepted ? { path: APPIMAGE, version } : {}) })
}
