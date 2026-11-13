import { extname, join } from 'node:path'
import { app, type AppDetailsOptions } from 'electron'
import type { OfficeKind } from '@shared/officeui'
import { storeAppUserModelId } from './appx'
import { openDefaultAppSettings } from './defaultApp'

/**
 * Documentos, Hojas y Presentaciones como programas de Windows. En Molino Suite
 * (Microsoft Store) cada una es una app del paquete (build/suite/AppxManifest.xml):
 * su entrada en el menú Inicio, su icono, sus tipos de archivo y su identidad
 * en la barra de tareas (se agrupa y se ancla por separado). Todas son el mismo
 * Molino.exe, que sabe cuál abrir por ``--molino-app``.
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

/** Cómo se pide cada app en la línea de órdenes (y en el manifiesto del paquete): ``Molino.exe --molino-app=docs``. */
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

/** Sin empaquetar (desarrollo y pruebas): una identidad propia para cada app, como en el paquete. */
const DEV_USER_MODEL_ID: Record<OfficeKind | 'home', string> = {
  word: 'org.molinosuite.molino.docs',
  cell: 'org.molinosuite.molino.sheets',
  slide: 'org.molinosuite.molino.slides',
  home: 'org.molinosuite.molino.home'
}

const ICON_FILE: Record<OfficeKind, string> = { word: 'documentos.ico', cell: 'hojas.ico', slide: 'presentaciones.ico' }

/** Un icono de build/icons (en el paquete, resources\icons). */
export function iconPath(file: string): string {
  return app.isPackaged ? join(process.resourcesPath, 'icons', file) : join(app.getAppPath(), 'build', 'icons', file)
}

export function appIcon(kind: OfficeKind): string {
  return iconPath(ICON_FILE[kind])
}

/** Para la ventana de una app: su identidad (en la Store, la de su app del paquete: Windows sabe su icono y cómo abrirla). */
export function windowDetails(kind: OfficeKind): AppDetailsOptions {
  return { appId: storeAppUserModelId(kind) ?? DEV_USER_MODEL_ID[kind], appIconPath: appIcon(kind), appIconIndex: 0 }
}

/** Lo mismo para la ventana de «Molino», el inicio común. */
export function homeDetails(): AppDetailsOptions {
  return { appId: storeAppUserModelId('home') ?? DEV_USER_MODEL_ID.home, appIconPath: iconPath('molino.ico'), appIconIndex: 0 }
}

/** Abre la página de una app en «Aplicaciones predeterminadas» (donde el usuario elige con qué se abren sus archivos). */
export function openDefaultApps(kind: OfficeKind): Promise<boolean> {
  return openDefaultAppSettings(storeAppUserModelId(kind))
}
