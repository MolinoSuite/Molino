import { existsSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import type { HomeApp, HomeRecent } from '@shared/home'
import type { OfficeKind } from '@shared/officeui'
import { fmt, L, lang, locale } from './i18n'
import { IMAGE_EXTENSIONS } from './ipc'
import { homeDetails, iconPath, OFFICE_KINDS, officeKindOf, OPENS } from './officeapps'
import { APP_ORIGIN } from './security'
import type { Store } from './store'

/**
 * «Molino», el inicio común de la suite (paso 6 de PLAN-SUITE): todas las
 * apps, «Crea algo nuevo» y los recientes de todo tipo. Es para quien lo
 * quiera: cada app se abre también por sí misma (officeapps.ts). Su página es
 * de Molino (molino://app/home.html, la misma política estricta que Molino
 * PDF) con su propio preload (preload/home.ts); sus canales solo se atienden
 * desde esa página.
 */

const HOME_PAGE = `${APP_ORIGIN}/home.html`

export interface HomeOptions {
  store: Store
  /** Las apps que se pueden usar ahora. */
  apps(): Promise<Record<HomeApp, boolean>>
  launch(app: HomeApp): void
  create(kind: OfficeKind): Promise<boolean>
  /** Abre archivos, cada uno en su app (index.ts). */
  openFiles(paths: string[]): Promise<void>
  dark(): boolean
  /** Molino PDF instalado aparte (pdfapart.ts). */
  pdfApart: { installed(): boolean; imported(): boolean; remove(): Promise<'removed' | 'settings'> }
}

export class HomeWindow {
  private window: BrowserWindow | null = null

  constructor(private readonly options: HomeOptions) {
    this.registerIpc()
  }

  /** La ventana del inicio, delante (la crea si no está). */
  show(): void {
    if (this.window && !this.window.isDestroyed()) {
      if (this.window.isMinimized()) this.window.restore()
      this.window.focus()
      return
    }
    const dark = this.options.dark()
    const window = new BrowserWindow({
      width: 1180,
      height: 780,
      minWidth: 820,
      minHeight: 560,
      show: false,
      title: 'Molino',
      backgroundColor: dark ? '#1c1d20' : '#ffffff',
      icon: iconPath('molino.ico'),
      titleBarStyle: 'hidden',
      titleBarOverlay: { color: dark ? '#1c1d20' : '#ffffff', symbolColor: dark ? '#e5e7eb' : '#1f2937', height: 40 },
      autoHideMenuBar: true,
      webPreferences: {
        preload: join(__dirname, '../preload/home.js'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
        allowRunningInsecureContent: false,
        webviewTag: false,
        spellcheck: false,
        navigateOnDragDrop: false,
        devTools: !app.isPackaged,
        additionalArguments: [`--molino-lang=${lang}`, `--molino-locale=${locale}`, `--molino-theme=${dark ? 'dark' : 'light'}`]
      }
    })
    window.removeMenu()
    if (process.platform === 'win32') window.setAppDetails(homeDetails())
    window.on('page-title-updated', (event) => event.preventDefault())
    window.once('ready-to-show', () => window.show())
    window.on('closed', () => {
      if (this.window === window) this.window = null
    })
    this.window = window
    const devUrl = app.isPackaged ? undefined : process.env.ELECTRON_RENDERER_URL
    void window.loadURL(devUrl ? `${devUrl}/home.html` : HOME_PAGE)
  }

  /** El tema ha cambiado: su barra de título y su página, sin volver a cargarla. */
  setDark(dark: boolean): void {
    const window = this.window
    if (!window || window.isDestroyed()) return
    window.setBackgroundColor(dark ? '#1c1d20' : '#ffffff')
    window.setTitleBarOverlay({ color: dark ? '#1c1d20' : '#ffffff', symbolColor: dark ? '#e5e7eb' : '#1f2937', height: 40 })
    window.webContents.send('home:theme', dark)
  }

  /** Algo de lo que muestra ha cambiado (apps añadidas o quitadas). */
  notify(): void {
    const contents = this.window && !this.window.isDestroyed() ? this.window.webContents : null
    contents?.send('home:changed')
  }

  /** Solo la página del inicio, en su ventana. */
  private trusted(event: IpcMainEvent | IpcMainInvokeEvent): BrowserWindow | null {
    const window = this.window
    const frame = event.senderFrame
    if (!window || window.isDestroyed() || event.sender !== window.webContents || !frame || frame !== event.sender.mainFrame) return null
    const devUrl = app.isPackaged ? undefined : process.env.ELECTRON_RENDERER_URL
    const page = frame.url.split(/[?#]/)[0]
    return page === HOME_PAGE || (devUrl !== undefined && page === `${devUrl}/home.html`) ? window : null
  }

  private recents(): (HomeRecent & { path: string })[] {
    const { store } = this.options
    const pdf = store.recentList().flatMap((r) => {
      const path = store.recentPath(r.id)
      return path ? [{ id: `p${r.id}`, app: 'pdf' as const, name: r.name, folder: r.folder, openedAt: r.openedAt, path }] : []
    })
    const office = store.officeRecent().flatMap((r) => {
      const kind = officeKindOf(r.path)
      return kind ? [{ id: `o${r.id}`, app: kind, name: basename(r.path), folder: dirname(r.path), openedAt: r.openedAt, path: r.path }] : []
    })
    return [...pdf, ...office].sort((a, b) => b.openedAt - a.openedAt).slice(0, 40)
  }

  private recentList(): HomeRecent[] {
    return this.recents().map(({ path: _path, ...shown }) => shown)
  }

  private forget(id: string): void {
    if (id.startsWith('p')) this.options.store.forgetRecent(id.slice(1))
    else if (id.startsWith('o')) this.options.store.forgetOfficeRecent(id.slice(1))
  }

  private registerIpc(): void {
    const apps = new Set<HomeApp>(['pdf', ...OFFICE_KINDS])
    ipcMain.handle('home:apps', async (event) => (this.trusted(event) ? this.options.apps() : null))
    ipcMain.handle('home:pdfApart', (event) => {
      if (!this.trusted(event) || !this.options.pdfApart.installed()) return null
      return this.options.pdfApart.imported() ? 'imported' : 'separate'
    })
    let removing = false
    ipcMain.handle('home:removePdfApart', async (event) => {
      if (!this.trusted(event) || removing) return null
      removing = true
      try {
        return await this.options.pdfApart.remove()
      } finally {
        removing = false
      }
    })
    ipcMain.handle('home:recent', (event) => (this.trusted(event) ? this.recentList() : []))
    ipcMain.handle('home:forgetRecent', (event, raw: unknown) => {
      if (!this.trusted(event)) return []
      if (typeof raw === 'string') this.forget(raw)
      return this.recentList()
    })
    ipcMain.handle('home:openRecent', async (event, raw: unknown) => {
      const window = this.trusted(event)
      const entry = window && typeof raw === 'string' ? this.recents().find((r) => r.id === raw) : undefined
      if (!window || !entry) return false
      if (!existsSync(entry.path)) {
        this.forget(entry.id)
        window.webContents.send('home:notice', fmt(L.main.office.recentMissing, { name: entry.name }))
        return false
      }
      await this.options.openFiles([entry.path])
      return true
    })
    ipcMain.handle('home:launch', async (event, raw: unknown) => {
      if (!this.trusted(event) || typeof raw !== 'string' || !apps.has(raw as HomeApp)) return false
      if (!(await this.options.apps())[raw as HomeApp]) return false
      this.options.launch(raw as HomeApp)
      return true
    })
    ipcMain.handle('home:create', async (event, raw: unknown) => {
      if (!this.trusted(event) || !OFFICE_KINDS.includes(raw as OfficeKind)) return false
      if (!(await this.options.apps())[raw as OfficeKind]) return false
      return this.options.create(raw as OfficeKind)
    })
    ipcMain.handle('home:openDialog', async (event, raw: unknown) => {
      const window = this.trusted(event)
      if (!window) return false
      const available = await this.options.apps()
      const T = L.main.office.filters
      const pdf = { name: T.pdf, extensions: ['pdf', ...IMAGE_EXTENSIONS] }
      const office = OFFICE_KINDS.filter((kind) => available[kind]).map((kind) => ({ name: T[kind], extensions: OPENS[kind].map((ext) => ext.slice(1)) }))
      const filters = raw === 'pdf' ? [pdf] : [{ name: L.main.home.allFiles, extensions: [...pdf.extensions, ...office.flatMap((f) => f.extensions)] }, pdf, ...office]
      const picked = await dialog.showOpenDialog(window, { properties: ['openFile', 'multiSelections'], filters })
      if (picked.canceled || picked.filePaths.length === 0) return false
      await this.options.openFiles(picked.filePaths.slice(0, 20))
      return true
    })
  }
}
