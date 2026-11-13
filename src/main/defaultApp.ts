import { app, shell } from 'electron'
import type { DefaultAppStatus } from '@shared/types'
import { storeAppUserModelId } from './appx'
import { log } from './log'
import { regQuery } from './registry'

/**
 * Molino PDF como programa predeterminado para abrir PDF.
 *
 * Windows no deja que un programa se ponga solo como predeterminado (para que
 * nadie se lo quite a otro a escondidas): lo decide el usuario en
 * Configuración. Molino solo mira si ya lo es y, si se lo pide, abre su página
 * en «Aplicaciones predeterminadas», donde basta un clic.
 *
 * El paquete de la Store declara los PDF en su manifiesto y Windows les pone un
 * tipo de archivo propio («AppX…»), cuya clave dice de qué app es
 * (Application\AppUserModelID): así se sabe si la elegida es esta.
 */

const CHOICE = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\.pdf'

/** Solo pruebas, sin empaquetar: simular el estado y no abrir Configuración de verdad. */
function testState(): DefaultAppStatus | null {
  if (app.isPackaged) return null
  const value = process.env.MOLINO_TEST_DEFAULT_APP
  return value === 'default' || value === 'other' ? value : null
}

async function readStatus(): Promise<DefaultAppStatus> {
  const simulated = testState()
  if (simulated) return simulated
  const own = storeAppUserModelId('pdf')
  if (!own || process.platform !== 'win32') return 'unknown'
  // Windows 11 reciente guarda la elección en el valor ProgId de la subclave
  // UserChoiceLatest\ProgId; antes, en UserChoice.
  const chosen = (await regQuery(`${CHOICE}\\UserChoiceLatest\\ProgId`, 'ProgId')) ?? (await regQuery(`${CHOICE}\\UserChoice`, 'ProgId'))
  if (chosen === null) return 'unknown'
  if (!/^AppX[0-9a-z]{1,40}$/i.test(chosen)) return 'other'
  const owner = await regQuery(`HKCU\\Software\\Classes\\${chosen}\\Application`, 'AppUserModelID')
  return owner !== null && owner.toLowerCase() === own.toLowerCase() ? 'default' : 'other'
}

let lastStatus: DefaultAppStatus | null = null

/** ¿Abre Windows los PDF con Molino PDF? 'unknown' si no se puede saber (sin empaquetar, por ejemplo). */
export async function pdfDefaultStatus(): Promise<DefaultAppStatus> {
  const status = await readStatus()
  // Al registro solo cuando cambia (se consulta cada vez que la ventana vuelve a primer plano).
  if (status !== lastStatus) log.info(`predeterminado para PDF: ${status}`)
  lastStatus = status
  return status
}

/**
 * Abre en «Aplicaciones predeterminadas» la página de una app del paquete
 * (``aumid``; por omisión, Molino PDF), o la general si no se puede.
 */
export async function openDefaultAppSettings(aumid: string | null = storeAppUserModelId('pdf')): Promise<boolean> {
  if (testState() || !app.isPackaged) {
    log.info('predeterminado: se abriría Configuración (prueba)')
    return true
  }
  try {
    await shell.openExternal(aumid ? `ms-settings:defaultapps?registeredAUMID=${encodeURIComponent(aumid)}` : 'ms-settings:defaultapps')
    return true
  } catch {
    try {
      await shell.openExternal('ms-settings:defaultapps')
      return true
    } catch {
      log.warn('predeterminado: no se pudo abrir Configuración')
      return false
    }
  }
}
