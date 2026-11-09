import { contextBridge, ipcRenderer } from 'electron'

/**
 * Lo único que ven las páginas de los editores (Documentos, Hojas y
 * Presentaciones) de este lado: el documento de su ventana. Corre en todos los
 * marcos, porque el editor vive en un iframe; el puente (office/bridge.js) lo
 * usa para hacer de «app de escritorio» de ONLYOFFICE.
 *
 * Nada de rutas ni de módulos de Node: canales fijos, y el proceso principal
 * comprueba en cada mensaje que viene de una ventana de editor y de
 * molino://office (officewin.ts).
 */

interface DocInfo {
  doc: string
  name: string
  kind: 'word' | 'cell' | 'slide'
}

// Una sola consulta síncrona al cargar: el puente necesita el nombre y el tipo
// antes de que el editor pregunte por ellos.
const info = ipcRenderer.sendSync('office:info') as DocInfo | null

contextBridge.exposeInMainWorld('molinoHost', {
  info,
  /** Editor.bin del documento, en base64 (se entrega una vez). */
  canvas: () => ipcRenderer.invoke('office:canvas'),
  /** Una tanda de cambios del editor; ``index``: cuántos había cuando se hizo. */
  changes: (list: unknown, index: unknown) => ipcRenderer.invoke('office:changes', { list, index }),
  save: (options: unknown) => ipcRenderer.invoke('office:save', options),
  /** Elegir una imagen para insertar: devuelve su nombre dentro del documento. */
  pickImage: () => ipcRenderer.invoke('office:pickImage'),
  modified: (value: unknown) => ipcRenderer.send('office:modified', value === true),
  ready: () => ipcRenderer.send('office:ready'),
  fullscreen: (value: unknown) => ipcRenderer.send('office:fullscreen', value === true),
  log: (text: unknown) => ipcRenderer.send('office:log', String(text).slice(0, 500))
})
