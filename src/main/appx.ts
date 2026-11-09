import { existsSync } from 'node:fs'
import { join } from 'node:path'

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

/** Familia del paquete («nombre_editor»), sacada de la carpeta donde está instalado. */
export function storePackageFamily(): string | null {
  if (!isStoreApp()) return null
  const match = PACKAGE_FOLDER.exec(process.execPath)
  return match ? `${match[1]}_${match[2]}` : null
}

/** Carpeta de datos de la versión de la Store (LocalState del paquete), o null. */
export function storeDataDir(): string | null {
  const family = storePackageFamily()
  const local = process.env.LOCALAPPDATA
  if (!family || !local) return null
  const folder = join(local, 'Packages', family, 'LocalState')
  return existsSync(folder) ? folder : null
}
