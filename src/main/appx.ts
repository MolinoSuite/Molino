import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * La versión de la Microsoft Store (paquete MSIX; electron-builder, destino appx).
 *
 * Windows ejecuta un paquete con su propia identidad y guarda aparte, en una
 * carpeta privada del paquete, lo que el programa crea en AppData: los
 * procesos del paquete ven esa carpeta, pero los demás no. El motor aislado y
 * sus auxiliares corren en su propio AppContainer, fuera del paquete, y tienen
 * que leer la carpeta de datos (modelos de IA, carpeta de trabajo…). Por eso,
 * en la versión de la Store, los datos van en la carpeta del propio paquete
 * (``%LOCALAPPDATA%\Packages\<familia>\LocalState``): es una carpeta de verdad,
 * igual para todos los procesos, y Windows la borra al desinstalar.
 *
 * Las versiones nuevas llegan por la Store (updates.ts no busca nada) y las
 * asociaciones de archivos van en el manifiesto del paquete
 * (build/appx-manifest).
 */

/** Carpeta de instalación de un paquete: ...\WindowsApps\<nombre>_<versión>_<arquitectura>_<recurso>_<editor>\ */
const PACKAGE_FOLDER = /\\WindowsApps\\([A-Za-z0-9.-]{3,50})_[0-9.]+_[A-Za-z0-9]*_[A-Za-z0-9.-]*_([a-z0-9]{13})\\/i

/** ¿Es la versión de la Microsoft Store? (Electron lo sabe por la identidad del paquete). */
export function isStoreApp(): boolean {
  return process.windowsStore === true
}

/**
 * El identificador del editor en la familia del paquete (13 caracteres), como
 * lo calcula Windows: los 8 primeros bytes del SHA-256 del editor (en UTF-16LE)
 * en base 32 (con un bit 0 al final).
 */
export function publisherId(publisher: string): string {
  const hash = createHash('sha256').update(Buffer.from(publisher, 'utf16le')).digest()
  const alphabet = '0123456789abcdefghjkmnpqrstvwxyz'
  let bits = ''
  for (const byte of hash.subarray(0, 8)) bits += byte.toString(2).padStart(8, '0')
  bits += '0'
  let id = ''
  for (let i = 0; i < bits.length; i += 5) id += alphabet[parseInt(bits.slice(i, i + 5), 2)]
  return id
}

const decodeXml = (value: string): string =>
  value.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

let family: string | null | undefined

/**
 * Familia del paquete («nombre_editor»): de la carpeta donde está instalado
 * (...\WindowsApps\<nombre>_..._<editor>\) o, si no está ahí (un paquete
 * registrado desde una carpeta, en modo de desarrollador), de su manifiesto.
 */
export function storePackageFamily(): string | null {
  if (!isStoreApp()) return null
  if (family !== undefined) return family
  const match = PACKAGE_FOLDER.exec(process.execPath)
  if (match) return (family = `${match[1]}_${match[2]}`)
  try {
    // El programa está en app\ y el manifiesto, en la raíz del paquete.
    const manifest = readFileSync(join(dirname(process.execPath), '..', 'AppxManifest.xml'), 'utf8')
    const identity = /<Identity\b[^>]*>/.exec(manifest)?.[0] ?? ''
    const name = /\sName\s*=\s*["']([A-Za-z0-9.-]{3,50})["']/.exec(identity)?.[1]
    const publisher = /\sPublisher\s*=\s*(?:"([^"]+)"|'([^']+)')/.exec(identity)
    family = name && publisher ? `${name}_${publisherId(decodeXml(publisher[1] ?? publisher[2]))}` : null
  } catch {
    family = null
  }
  return family
}

/** La familia del paquete de Molino Suite (Partner Center: CuevasTech.MolinoSuite, del mismo editor): para abrirla en la Store desde Molino PDF. */
export const SUITE_FAMILY = 'CuevasTech.MolinoSuite_txf9mqjyats40'
/** La de Molino PDF, el paquete solo de PDF (Partner Center: CuevasTech.MolinoPDF, del mismo editor). */
export const PDF_FAMILY = 'CuevasTech.MolinoPDF_txf9mqjyats40'

/**
 * La carpeta de datos de Molino PDF instalado aparte (su LocalState), vista
 * desde Molino Suite; null si no está instalado o si esto no es Molino Suite.
 * Windows la crea al instalar el paquete y la borra al desinstalarlo.
 */
export function separatePdfData(): string | null {
  if (storePackageFamily() !== SUITE_FAMILY || !process.env.LOCALAPPDATA) return null
  const folder = join(process.env.LOCALAPPDATA, 'Packages', PDF_FAMILY, 'LocalState')
  return existsSync(folder) ? folder : null
}

/**
 * Cada app del paquete: el Id de su <Application> en el manifiesto. El paquete
 * de Molino PDF solo lleva la suya; el de Molino Suite, todas
 * (build/appx-manifest y build/suite/AppxManifest.xml).
 */
export const STORE_APP_ID = { pdf: 'MolinoPDF', word: 'MolinoDocs', cell: 'MolinoSheets', slide: 'MolinoSlides', home: 'Molino' } as const

/**
 * La identidad de una app en la versión de la Store («familia!Id»), o null
 * fuera de ella. Sus ventanas la llevan para que Windows las agrupe, las ancle
 * y las vuelva a abrir como la app del paquete que son.
 */
export function storeAppUserModelId(which: keyof typeof STORE_APP_ID): string | null {
  const family = storePackageFamily()
  return family ? `${family}!${STORE_APP_ID[which]}` : null
}

/** Carpeta de datos de la versión de la Store (LocalState del paquete), o null. */
export function storeDataDir(): string | null {
  const family = storePackageFamily()
  const local = process.env.LOCALAPPDATA
  if (!family || !local) return null
  const folder = join(local, 'Packages', family, 'LocalState')
  return existsSync(folder) ? folder : null
}
