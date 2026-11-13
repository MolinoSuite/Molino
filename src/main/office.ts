import { existsSync, readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app, shell } from 'electron'
import type { OfficeLegal, OfficeStatus } from '@shared/office'

/**
 * El motor de oficina: la pieza que necesitan Documentos, Hojas y
 * Presentaciones (editores y conversor de ONLYOFFICE con los cambios de
 * Molino; la arma office/build.py en dist-office).
 *
 * Va dentro del paquete de Molino Suite (Microsoft Store), junto al programa
 * (resources\office): de solo lectura, de la versión de este Molino y
 * actualizada con el paquete. Nada se descarga: la Store no deja traer
 * programas después de instalar (política 10.2.2). El paquete de Molino PDF no
 * la lleva: es solo el PDF.
 */

/** La versión de la pieza de este Molino (scripts/make-suite-msix.mjs la lee de aquí). */
export const OFFICE_PIECE = { version: '10.0.0-1' }

/** Cómo se arma la pieza y los cambios de Molino (office/build.py y office/patches.py): el código que pide la AGPL. */
export const OFFICE_SOURCE_URL = 'https://github.com/MolinoSuite/Molino/tree/main/office'

/** Versión de la pieza de esta versión de Molino. */
export function pieceVersion(): string {
  return OFFICE_PIECE.version
}

/**
 * La carpeta de la pieza, o null si este Molino no la trae (Molino PDF). En el
 * paquete, resources\office; sin empaquetar, la de dist-office (o la de
 * MOLINO_TEST_OFFICE_BUNDLED; «none»: sin pieza, como Molino PDF). Tiene que ser
 * la de esta versión.
 */
export function bundledPieceDir(): string | null {
  const test = app.isPackaged ? undefined : process.env.MOLINO_TEST_OFFICE_BUNDLED
  if (test === 'none') return null
  const dir = app.isPackaged
    ? join(process.resourcesPath, 'office')
    : (test ?? join(app.getAppPath(), 'dist-office', `MolinoOffice-${OFFICE_PIECE.version}`))
  try {
    const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as { piece?: unknown; version?: unknown }
    return manifest.piece === 'office' && manifest.version === OFFICE_PIECE.version ? dir : null
  } catch {
    return null
  }
}

/**
 * Abre un aviso legal de la pieza (``pieceDir``): el de los cambios de Molino
 * (en el idioma de Molino), la licencia de ONLYOFFICE, la carpeta con los
 * componentes de terceros o, en el navegador, el código. Las rutas y
 * direcciones son fijas: de la interfaz solo llega cuál.
 */
export async function openOfficeLegal(pieceDir: string, what: OfficeLegal, language: string): Promise<boolean> {
  if (what === 'source') {
    await shell.openExternal(OFFICE_SOURCE_URL)
    return true
  }
  if (what === 'original') {
    const manifest = JSON.parse(await readFile(join(pieceDir, 'manifest.json'), 'utf8')) as { onlyoffice?: unknown }
    const version = typeof manifest.onlyoffice === 'string' && /^\d{1,3}(\.\d{1,4}){1,3}$/.test(manifest.onlyoffice) ? manifest.onlyoffice : null
    if (!version) return false
    await shell.openExternal(`https://github.com/ONLYOFFICE/DesktopEditors/tree/v${version}`)
    return true
  }
  const target =
    what === 'notice'
      ? join(pieceDir, `MOLINO-NOTICE.${language === 'es' ? 'es' : 'en'}.txt`)
      : what === 'license'
        ? join(pieceDir, 'licenses', 'ONLYOFFICE-LICENSE.txt')
        : join(pieceDir, 'licenses')
  if (!existsSync(target)) return false
  return (await shell.openPath(target)) === ''
}

/**
 * La pieza de este Molino. ``root`` es la carpeta de oficina de los datos del
 * usuario: el índice de fuentes de los editores (officefonts.ts) y las fuentes
 * instaladas solo en Molino (fontcatalog.ts).
 */
export class OfficePiece {
  readonly root: string

  constructor(
    userData: string,
    /** La carpeta de la pieza (bundledPieceDir), o null: este Molino no trae las apps de oficina. */
    readonly dir: string | null
  ) {
    this.root = join(userData, 'office')
  }

  /** ¿Trae este Molino Documentos, Hojas y Presentaciones? */
  get available(): boolean {
    return this.dir !== null
  }

  /** La carpeta de la pieza, si la hay. */
  async ready(): Promise<string | null> {
    return this.dir
  }

  status(): OfficeStatus {
    return { available: this.available, version: this.dir ? OFFICE_PIECE.version : null }
  }
}
