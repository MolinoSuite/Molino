import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, type BrowserWindow, dialog } from 'electron'
import { autoUpdater } from 'electron-updater'
import { productName } from './edition'
import { fmt, L } from './i18n'
import { log } from './log'

/**
 * Linux: las versiones nuevas (en Windows las trae la Microsoft Store).
 *
 * electron-updater mira la ficha de la última versión en la web de Molino
 * (https://molinosuite.org/linux/<pdf|suite>/latest-linux*.yml: número,
 * paquetes y su SHA-512; los paquetes, en GitHub Releases) y descarga la nueva
 * comprobando su huella. Solo pide eso a la web: nada del usuario ni de sus
 * documentos.
 * - AppImage: se cambia el archivo al cerrar Molino; al abrirlo, la tarjeta de
 *   novedades.
 * - .deb y .rpm: instalarla pide la contraseña del sistema, así que, ya
 *   descargada, Molino pregunta si se instala ahora (y vuelve a abrirse) o más tarde.
 */

const FIRST_CHECK_MS = 60_000
const EVERY_MS = 6 * 60 * 60_000

/** Cómo se instaló: AppImage, .deb o .rpm (lo deja electron-builder en resources/package-type). */
function packageType(): 'appimage' | 'deb' | 'rpm' | null {
  if (process.env.APPIMAGE) return 'appimage'
  try {
    const type = readFileSync(join(process.resourcesPath, 'package-type'), 'utf8').trim()
    return type === 'deb' || type === 'rpm' ? type : null
  } catch {
    return null
  }
}

export function startUpdates(parent: () => BrowserWindow | null): void {
  if (process.platform !== 'linux' || !app.isPackaged) return
  const type = packageType()
  if (!type) return
  // Al registro, solo lo que pasa (sin rutas ni direcciones).
  autoUpdater.logger = null
  autoUpdater.autoDownload = true
  autoUpdater.allowDowngrade = false
  autoUpdater.autoInstallOnAppQuit = type === 'appimage'
  let offered: string | null = null
  autoUpdater.on('update-available', (info) => log.info(`actualización: hay la ${info.version}, descargando`))
  autoUpdater.on('error', (error) => log.warn(`actualización: no se pudo (${error instanceof Error ? error.name : 'error'})`))
  autoUpdater.on('update-downloaded', (info) => {
    log.info(`actualización: ${info.version} descargada (${type})`)
    if (type === 'appimage' || offered === info.version) return
    offered = info.version
    const T = L.main.updates
    const options = {
      type: 'info' as const,
      title: productName,
      message: fmt(T.message, { name: productName, version: info.version }),
      detail: fmt(T.detail, { name: productName }),
      buttons: [T.install, T.later],
      defaultId: 0,
      cancelId: 1
    }
    const window = parent()
    void (window ? dialog.showMessageBox(window, options) : dialog.showMessageBox(options)).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall(false, true)
    })
  })
  const check = (): void => void autoUpdater.checkForUpdates().catch(() => undefined)
  setTimeout(check, FIRST_CHECK_MS)
  setInterval(check, EVERY_MS)
}
