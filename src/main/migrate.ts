import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import { app } from 'electron'
import { DEFAULT_ACCENT } from '@shared/types'
import { separatePdfData } from './appx'

/**
 * Lo que el usuario tenía antes, la primera vez que se abre Molino:
 * - **Molino Suite con Molino PDF instalado aparte**: lo de Molino PDF (la
 *   suite lo incluye; después se ofrece desinstalar el otro, pdfapart.ts).
 * - **Folio**, en otro caso (lo de abajo).
 *
 * Paso de Folio a Molino PDF.
 *
 * La primera vez que Molino PDF se abre en un equipo donde se usó Folio, trae
 * lo que el usuario tenía allí: ajustes, archivos recientes, tamaño de la
 * ventana y firmas guardadas. Los modelos de la IA no se copian aquí (pueden
 * ser varios GB): AiModels los toma de la carpeta de Folio, comprobando su
 * huella, en vez de descargarlos (ver legacyModelsDir).
 *
 * La carpeta de Folio solo se lee: no se borra ni se cambia nada en ella, así
 * que Folio sigue funcionando igual si sigue instalado.
 *
 * Las firmas guardadas van cifradas con la clave que Chromium guarda en
 * «Local State», protegida a su vez con DPAPI y ligada a la cuenta de Windows.
 * Para que Molino PDF pueda leerlas se copia también ese archivo. Por eso el
 * paso solo se hace en una carpeta de datos todavía sin usar y antes de
 * app.ready: Electron lee «Local State» después de ejecutar este código.
 *
 * Lo que se trae se trata igual que cualquier dato del disco: Store lo valida
 * con su esquema y, si no encaja, usa los valores por defecto.
 */

/** Marca que deja el paso en la carpeta de Molino (y que impide repetirlo). */
const MARKER = 'desde-folio.json'
const MARKER_PDF = 'desde-molino-pdf.json'
/** Archivos que se traen, si existen. Las firmas solo junto con su clave. */
const CONFIG = 'config.json'
const SIGNATURES = 'signatures.bin'
const KEYS = 'Local State'
/** Color de acento por defecto de Folio (el añil). */
const FOLIO_ACCENT = '#4f5bd5'

/**
 * Carpeta de datos de Folio en este equipo, o null si no hay que mirar.
 * - Lo normal: %LOCALAPPDATA%\Folio (la de Folio instalado; la de su versión
 *   portable, FolioData, está junto a su Folio.exe y no se busca).
 * - Con --user-data-dir (pruebas y comprobaciones): ninguna, salvo en pruebas
 *   sin empaquetar con MOLINO_TEST_FOLIO_DATA, que apunta a una carpeta de prueba.
 */
export function legacyDataDir(): string | null {
  let dir: string | null = null
  if (app.commandLine.hasSwitch('user-data-dir')) {
    const test = !app.isPackaged ? process.env.MOLINO_TEST_FOLIO_DATA : undefined
    dir = test && isAbsolute(test) ? test : null
  } else if (process.env.LOCALAPPDATA) {
    dir = join(process.env.LOCALAPPDATA, 'Folio')
  }
  return dir && isFolder(dir) ? dir : null
}

/** Carpeta de modelos de IA de Molino PDF instalado aparte o, si no, de Folio (AiModels copia de ahí lo que coincida). */
export function legacyModelsDir(): string | null {
  for (const dir of [separatePdfData(), legacyDataDir()]) {
    const models = dir ? join(dir, 'models') : null
    if (models && isFolder(models)) return models
  }
  return null
}

export interface MigrationReport {
  /** De dónde: «Molino PDF» o «Folio» (para el registro). */
  label: string
  from: string
  copied: string[]
  /** Por qué no se trajeron las firmas, si había. */
  signaturesSkipped?: string
}

/**
 * Trae los datos de Folio a la carpeta de Molino PDF, una sola vez. Devuelve qué
 * se trajo, o null si no había nada que hacer. Nunca lanza: un fallo deja la
 * carpeta como estaba (Molino PDF arranca con sus valores por defecto).
 */
export function migrateLegacy(userData: string): MigrationReport | null {
  const pdf = separatePdfData()
  if (pdf) return migrateFrom(userData, pdf, 'Molino PDF', MARKER_PDF)
  const folio = legacyDataDir()
  return folio ? migrateFrom(userData, folio, 'Folio', MARKER) : null
}

function migrateFrom(userData: string, from: string, label: string, marker: string): MigrationReport | null {
  try {
    if (!isFile(join(from, CONFIG)) && !isFile(join(from, SIGNATURES))) return null
    if (existsSync(join(userData, MARKER)) || existsSync(join(userData, MARKER_PDF))) return null
    // Solo en una carpeta sin usar: si Molino PDF ya tiene sus datos, no se tocan.
    if (existsSync(join(userData, CONFIG)) || existsSync(join(userData, KEYS))) return null
    mkdirSync(userData, { recursive: true })

    const report: MigrationReport = { label, from, copied: [] }
    if (isFile(join(from, CONFIG))) {
      copyFileSync(join(from, CONFIG), join(userData, CONFIG))
      if (marker === MARKER) adoptAccent(join(userData, CONFIG))
      report.copied.push(CONFIG)
    }
    if (isFile(join(from, SIGNATURES))) {
      if (isFile(join(from, KEYS))) {
        copyFileSync(join(from, KEYS), join(userData, KEYS))
        copyFileSync(join(from, SIGNATURES), join(userData, SIGNATURES))
        report.copied.push(KEYS, SIGNATURES)
      } else {
        report.signaturesSkipped = 'sin la clave de cifrado'
      }
    }
    writeFileSync(join(userData, marker), JSON.stringify({ ...report, at: new Date().toISOString() }, null, 2))
    return report
  } catch {
    return null
  }
}

/**
 * Quien tenía en Folio su color por defecto (el añil) pasa al de Molino PDF, el
 * rojo; un color distinto, elegido por el usuario, se respeta. Se cambia en la
 * copia, nunca en Folio. Si el archivo no se entiende, se queda como está.
 */
function adoptAccent(path: string): void {
  try {
    const data = JSON.parse(readFileSync(path, 'utf8')) as { settings?: { accent?: unknown } }
    const accent = data?.settings?.accent
    if (typeof accent === 'string' && accent.toLowerCase() === FOLIO_ACCENT) {
      data.settings!.accent = DEFAULT_ACCENT
      writeFileSync(path, JSON.stringify(data, null, 2))
    }
  } catch {
    // sin cambios: Store lo valida al leerlo
  }
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

function isFolder(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}
