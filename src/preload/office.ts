import { contextBridge, ipcRenderer } from 'electron'
import type { Lang } from '@shared/i18n'
import type { OfficeTabs, OfficeUiApi } from '@shared/officeui'

/**
 * Lo único que ven las páginas de Documentos, Hojas y Presentaciones de este
 * lado. Corre en todos los marcos de la ventana (la interfaz, cada pestaña y
 * su editor), sin Node y con canales fijos:
 *
 * - ``molinoOffice``: la interfaz de Molino (pestañas, abrir, documento nuevo).
 *   El proceso principal solo lo atiende desde la página de la interfaz.
 * - ``molinoHost``: el puente de cada editor (office/bridge.js), que hace de
 *   «app de escritorio» de ONLYOFFICE. Cada llamada lleva su documento y el
 *   proceso principal solo la atiende desde un editor y para los documentos
 *   de esa ventana (officewin.ts).
 */

// La misma forma que LOCALE_RE de @shared/i18n, copiada: un preload con sandbox es un
// solo archivo, y lo que comparte con el de Molino PDF acabaria en un trozo aparte
// que no podria cargar.
const LOCALE_RE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8}){0,3}$/

const argValue = (name: string): string => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1] ?? ''
const lang: Lang = argValue('molino-lang') === 'en' ? 'en' : 'es'
const localeArg = argValue('molino-locale')
const kindArg = argValue('molino-kind')

const ui: OfficeUiApi = {
  env: {
    lang,
    locale: LOCALE_RE.test(localeArg) ? localeArg : lang === 'en' ? 'en-US' : 'es-ES',
    dark: argValue('molino-theme') === 'dark',
    kind: kindArg === 'cell' || kindArg === 'slide' ? kindArg : 'word',
    version: /^\d{1,4}\.\d{1,4}\.\d{1,6}/.test(argValue('molino-version')) ? argValue('molino-version') : '',
    piece: /^[\w.-]{1,40}$/.test(argValue('molino-piece')) ? argValue('molino-piece') : '',
    author: (() => {
      try {
        return decodeURIComponent(argValue('molino-author')).slice(0, 100)
      } catch {
        return ''
      }
    })()
  },
  tabs: () => ipcRenderer.invoke('office:tabs'),
  activate: (doc) => ipcRenderer.invoke('office:activate', doc),
  closeTab: (doc) => ipcRenderer.invoke('office:closeTab', doc),
  openDialog: () => ipcRenderer.invoke('office:openDialog'),
  saveAs: (doc) => ipcRenderer.invoke('office:saveAs', doc),
  print: (doc) => ipcRenderer.invoke('office:print', doc),
  newDoc: () => ipcRenderer.invoke('office:new'),
  recent: () => ipcRenderer.invoke('office:recent'),
  openRecent: (id) => ipcRenderer.invoke('office:openRecent', id),
  forgetRecent: (id) => ipcRenderer.invoke('office:forgetRecent', id),
  recoverable: () => ipcRenderer.invoke('office:recoverable'),
  recover: (id) => ipcRenderer.invoke('office:recover', id),
  discardRecovery: (id) => ipcRenderer.invoke('office:discardRecovery', id),
  fontsInfo: (doc) => ipcRenderer.invoke('office:fontsInfo', doc),
  installFonts: (doc, names, into) => ipcRenderer.invoke('office:installFonts', { doc, names, into }),
  dismissFonts: (doc, forever) => ipcRenderer.invoke('office:dismissFonts', { doc, forever }),
  legal: (what) => ipcRenderer.invoke('office:legal', what),
  onTabs: (listener) => {
    const wrapped = (_event: Electron.IpcRendererEvent, tabs: OfficeTabs): void => listener(tabs)
    ipcRenderer.on('office:tabs', wrapped)
    return () => ipcRenderer.removeListener('office:tabs', wrapped)
  }
}
contextBridge.exposeInMainWorld('molinoOffice', ui)

contextBridge.exposeInMainWorld('molinoHost', {
  /** Editor.bin del documento, en base64 (se entrega una vez). */
  canvas: (doc: unknown) => ipcRenderer.invoke('office:canvas', doc),
  /** Una tanda de cambios del editor; ``index``: cuántos había cuando se hizo. */
  changes: (doc: unknown, list: unknown, index: unknown) => ipcRenderer.invoke('office:changes', { doc, list, index }),
  save: (doc: unknown, options: Record<string, unknown>) => ipcRenderer.invoke('office:save', { ...options, doc }),
  /** Elegir una imagen para insertar: devuelve su nombre dentro del documento. */
  pickImage: (doc: unknown) => ipcRenderer.invoke('office:pickImage', doc),
  modified: (doc: unknown, value: unknown) => ipcRenderer.send('office:modified', { doc, value: value === true }),
  ready: (doc: unknown) => ipcRenderer.send('office:ready', doc),
  fullscreen: (doc: unknown, value: unknown) => ipcRenderer.send('office:fullscreen', { doc, value: value === true }),
  log: (text: unknown) => ipcRenderer.send('office:log', String(text).slice(0, 500)),
  userWords: (doc: unknown) => ipcRenderer.invoke('office:userWords', doc),
  addWords: (doc: unknown, words: unknown) => ipcRenderer.invoke('office:addWords', { doc, words })
})
