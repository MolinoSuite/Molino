import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import type { OfficeKind } from '@shared/officeui'
import { edition } from './edition'

/**
 * Linux: las apps de Molino en el escritorio. Sus accesos (.desktop) los pone el
 * paquete (build/linux y scripts/make-linux.mjs) o, con la AppImage, la propia
 * app (appimage.ts), con los mismos nombres. Aquí, qué acceso es el de cada app
 * y elegirlas como programa predeterminado de sus tipos de archivo, con
 * xdg-mime (de xdg-utils, que el paquete pide).
 */

type LinuxApp = OfficeKind | 'pdf'

/** El acceso de cada app: en Molino PDF, el suyo; en Molino Suite, los de cada una. */
export function desktopFile(app: LinuxApp | 'home'): string {
  if (edition === 'pdf') return 'molino-pdf.desktop'
  const suffix: Record<LinuxApp | 'home', string> = { home: '', pdf: '-pdf', word: '-docs', cell: '-sheets', slide: '-slides' }
  return `molino-suite${suffix[app]}.desktop`
}

/** Los tipos de archivo de cada app (los mismos que en sus .desktop). */
export const MIME_TYPES: Record<LinuxApp, string[]> = {
  pdf: ['application/pdf'],
  word: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.oasis.opendocument.text',
    'application/rtf',
    'text/rtf'
  ],
  cell: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'application/vnd.oasis.opendocument.spreadsheet', 'text/csv'],
  slide: ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.ms-powerpoint', 'application/vnd.oasis.opendocument.presentation']
}

const XDG_MIME = ['/usr/bin/xdg-mime', '/bin/xdg-mime'].find((path) => existsSync(path)) ?? null

/** xdg-mime por su ruta completa, sin intérprete de órdenes y con argumentos fijos; su salida (o null si falla). */
function xdgMime(args: string[]): Promise<string | null> {
  if (!XDG_MIME) return Promise.resolve(null)
  return new Promise((done) => {
    execFile(XDG_MIME, args, { timeout: 10_000, maxBuffer: 64 * 1024 }, (error, stdout) => done(error ? null : String(stdout).trim()))
  })
}

/** ¿Abre el sistema ese tipo de archivo con esta app? null si no se puede saber. */
export async function isDefaultFor(app: LinuxApp): Promise<boolean | null> {
  const chosen = await xdgMime(['query', 'default', MIME_TYPES[app][0]])
  if (chosen === null) return null
  return chosen === desktopFile(app)
}

/** Esta app, la predeterminada de sus tipos de archivo para este usuario. */
export async function makeDefaultFor(app: LinuxApp): Promise<boolean> {
  const result = await xdgMime(['default', desktopFile(app), ...MIME_TYPES[app]])
  return result !== null
}
