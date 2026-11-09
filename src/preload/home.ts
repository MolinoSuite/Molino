import { contextBridge, ipcRenderer } from 'electron'
import type { HomeApi } from '@shared/home'

/**
 * Lo que ve la página de «Molino», el inicio común (main/home.ts): canales
 * fijos, sin Node. Va aparte del preload de Molino PDF: un preload con sandbox
 * es un solo archivo y no puede cargar trozos compartidos.
 */

const LOCALE_RE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8}){0,3}$/
const argValue = (name: string): string => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1] ?? ''
const lang = argValue('molino-lang') === 'en' ? 'en' : 'es'
const localeArg = argValue('molino-locale')

const api: HomeApi = {
  env: {
    lang,
    locale: LOCALE_RE.test(localeArg) ? localeArg : lang === 'en' ? 'en-US' : 'es-ES',
    dark: argValue('molino-theme') === 'dark'
  },
  apps: () => ipcRenderer.invoke('home:apps'),
  recent: () => ipcRenderer.invoke('home:recent'),
  openRecent: (id) => ipcRenderer.invoke('home:openRecent', id),
  forgetRecent: (id) => ipcRenderer.invoke('home:forgetRecent', id),
  launch: (app) => ipcRenderer.invoke('home:launch', app),
  create: (app) => ipcRenderer.invoke('home:create', app),
  openDialog: (only) => ipcRenderer.invoke('home:openDialog', only),
  onChanged: (listener) => {
    const wrapped = (): void => listener()
    ipcRenderer.on('home:changed', wrapped)
    return () => ipcRenderer.removeListener('home:changed', wrapped)
  }
}
contextBridge.exposeInMainWorld('molinoHome', api)
