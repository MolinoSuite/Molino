import { contextBridge, ipcRenderer } from 'electron'
import type { AiDownloadError, AiDownloadProgress } from '@shared/ai'
import type { MolinoShared } from '@shared/api'
import type { Lang } from '@shared/i18n'
import type { OfficeAsk, OfficeTabs, OfficeUiApi } from '@shared/officeui'
import type { DocDescriptor, ProgressInfo, Settings, UpdateStatus } from '@shared/types'

/**
 * Lo único que ven las páginas de Documentos, Hojas y Presentaciones de este
 * lado. Corre en todos los marcos de la ventana (la interfaz, cada pestaña y
 * su editor), sin Node y con canales fijos:
 *
 * - ``molinoOffice``: la interfaz de Molino (pestañas, abrir, documento nuevo).
 *   El proceso principal solo lo atiende desde la página de la interfaz.
 * - ``molino``: solo en la página de la interfaz, lo que comparten todas las
 *   apps de Molino (ajustes, IA, versiones nuevas, comentarios, avisos legales):
 *   los mismos canales que Molino PDF, que el proceso principal atiende desde
 *   la interfaz de cada app (ipc.ts, SHARED_CHANNELS).
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
  showInFolder: (doc) => ipcRenderer.invoke('office:showInFolder', doc),
  scripts: () => ipcRenderer.invoke('office:scripts'),
  saveScript: (script) => ipcRenderer.invoke('office:scriptSave', script),
  removeScript: (id) => ipcRenderer.invoke('office:scriptRemove', id),
  exportDoc: (doc, format) => ipcRenderer.invoke('office:export', { doc, format }),
  newDoc: () => ipcRenderer.invoke('office:new'),
  recent: () => ipcRenderer.invoke('office:recent'),
  openRecent: (id) => ipcRenderer.invoke('office:openRecent', id),
  forgetRecent: (id) => ipcRenderer.invoke('office:forgetRecent', id),
  recoverable: () => ipcRenderer.invoke('office:recoverable'),
  recover: (id) => ipcRenderer.invoke('office:recover', id),
  discardRecovery: (id) => ipcRenderer.invoke('office:discardRecovery', id),
  fontsInfo: (doc) => ipcRenderer.invoke('office:fontsInfo', doc),
  installFonts: (doc, names) => ipcRenderer.invoke('office:installFonts', { doc, names }),
  dismissFonts: (doc, forever) => ipcRenderer.invoke('office:dismissFonts', { doc, forever }),
  legal: (what) => ipcRenderer.invoke('office:legal', what),
  clipboard: (action) => ipcRenderer.invoke('office:clipboard', action),
  copyText: (text) => ipcRenderer.invoke('office:copyText', text),
  openLink: (url) => ipcRenderer.invoke('office:openLink', url),
  templates: () => ipcRenderer.invoke('office:templates'),
  fromTemplate: (id) => ipcRenderer.invoke('office:fromTemplate', id),
  ai: {
    status: () => ipcRenderer.invoke('office:aiStatus'),
    run: (call, doc, method, params) => ipcRenderer.invoke('office:ai', { call, doc, method, params }),
    cancel: (call) => ipcRenderer.send('office:aiCancel', call),
    onProgress: (listener) => {
      const wrapped = (_event: Electron.IpcRendererEvent, progress: { call: number; done: number; total: number; message: string; text?: string }): void => listener(progress)
      ipcRenderer.on('office:aiProgress', wrapped)
      return () => ipcRenderer.removeListener('office:aiProgress', wrapped)
    }
  },
  onTabs: (listener) => {
    const wrapped = (_event: Electron.IpcRendererEvent, tabs: OfficeTabs): void => listener(tabs)
    ipcRenderer.on('office:tabs', wrapped)
    return () => ipcRenderer.removeListener('office:tabs', wrapped)
  },
  onTheme: (listener) => {
    const wrapped = (_event: Electron.IpcRendererEvent, dark: boolean): void => listener(dark === true)
    ipcRenderer.on('office:theme', wrapped)
    return () => ipcRenderer.removeListener('office:theme', wrapped)
  },
  onPrint: (listener) => {
    const wrapped = (_event: Electron.IpcRendererEvent, pdf: DocDescriptor): void => listener(pdf)
    ipcRenderer.on('office:printOpen', wrapped)
    return () => ipcRenderer.removeListener('office:printOpen', wrapped)
  },
  printClose: (doc) => ipcRenderer.invoke('office:printClose', doc),
  onAsk: (listener) => {
    const wrapped = (_event: Electron.IpcRendererEvent, ask: OfficeAsk): void => listener(ask)
    ipcRenderer.on('office:ask', wrapped)
    ipcRenderer.send('office:askReady')
    return () => ipcRenderer.removeListener('office:ask', wrapped)
  },
  answer: (id, response, password) => ipcRenderer.send('office:answer', { id, response, password }),
  setPassword: (doc, password) => ipcRenderer.invoke('office:setPassword', { doc, password })
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


function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  const wrapped = (_event: Electron.IpcRendererEvent, payload: T): void => listener(payload)
  ipcRenderer.on(channel, wrapped)
  return () => ipcRenderer.removeListener(channel, wrapped)
}

const frameUrl = (globalThis as { location?: { href?: string } }).location?.href ?? ''
if (frameUrl.startsWith('molino://office/__molino__/ui/')) {
  const shared: MolinoShared = {
    env: { version: ui.env.version, built: '', dev: process.argv.includes('--molino-dev'), lang: ui.env.lang, locale: ui.env.locale },
    // Solo para el cuadro de imprimir: dibujar las páginas del PDF temporal e imprimirlo (officeprint.ts).
    engine: (method, params, options) => ipcRenderer.invoke('office:printRender', { method, params, priority: options?.priority }),
    cancel: (callId) => ipcRenderer.send('office:printCancel', callId),
    onProgress: (listener) => subscribe<ProgressInfo>('engine:progress', listener),
    print: {
      printers: () => ipcRenderer.invoke('office:printers'),
      start: (doc, pages, request, callId) => ipcRenderer.invoke('office:printStart', { doc, pages, request, callId })
    },
    settings: {
      get: () => ipcRenderer.invoke('settings:get'),
      set: (patch) => ipcRenderer.invoke('settings:set', patch),
      onChanged: (listener) => subscribe<Settings>('settings:changed', listener)
    },
    shell: { openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url) },
    updates: {
      status: () => ipcRenderer.invoke('updates:status'),
      check: () => ipcRenderer.send('updates:check'),
      openStore: () => ipcRenderer.invoke('updates:openStore'),
      onStatus: (listener) => subscribe<UpdateStatus>('updates:status', listener)
    },
    about: {
      open: (what) => ipcRenderer.invoke('about:open', what),
      office: (what) => ipcRenderer.invoke('about:office', what)
    },
    ai: {
      status: () => ipcRenderer.invoke('ai:status'),
      install: () => ipcRenderer.invoke('ai:install'),
      cancel: () => ipcRenderer.invoke('ai:cancel'),
      remove: () => ipcRenderer.invoke('ai:remove'),
      onProgress: (listener) => subscribe<AiDownloadProgress | null>('ai:progress', listener),
      onChanged: (listener) => subscribe<void>('ai:changed', () => listener()),
      onError: (listener) => subscribe<AiDownloadError>('ai:error', listener)
    },
    office: {
      status: () => ipcRenderer.invoke('office:status'),
      launch: (app) => ipcRenderer.invoke('office:launch', app),
      defaultApps: (app) => ipcRenderer.invoke('office:defaultApps', app),
      userWords: () => ipcRenderer.invoke('office:userWordsList'),
      removeUserWords: (words) => ipcRenderer.invoke('office:removeUserWords', words)
    },
    feedback: {
      available: () => ipcRenderer.invoke('feedback:available'),
      send: (kind, message) => ipcRenderer.invoke('feedback:send', { kind, message })
    },
    defaultApp: {
      status: () => ipcRenderer.invoke('defaultApp:status'),
      open: () => ipcRenderer.invoke('defaultApp:open')
    }
  }
  contextBridge.exposeInMainWorld('molino', shared)
}
