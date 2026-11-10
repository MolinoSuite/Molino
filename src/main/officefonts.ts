import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'

/**
 * El índice de fuentes de los editores (AllFonts.js y font_selection.bin).
 *
 * Lo crea x2t dentro del motor aislado (``office.fonts``) con las fuentes de
 * Windows, las instaladas solo para el usuario, las que descarga Office y las
 * instaladas solo en Molino (``office\own-fonts``, ``ownFontsDir``). Se
 * guarda en ``office\fonts\<huella>``: la huella sale de la versión de la pieza
 * y de las fuentes del equipo (nombre, tamaño y fecha de cada archivo), así que
 * al instalar o quitar una fuente se crea uno nuevo.
 *
 * Los editores cargan AllFonts.js como JavaScript. Aunque el motor ya lo
 * devuelve reescrito, aquí se vuelve a leer como datos y a escribir
 * (``cleanFontIndex``): lo que llega del motor aislado no se da por bueno.
 */

/** Las fuentes instaladas solo en Molino (fontcatalog.ts): las lee x2t y solo las ven los editores. */
export function ownFontsDir(officeRoot: string): string {
  return join(officeRoot, 'own-fonts')
}

/** Carpetas de fuentes que van en el índice: las del equipo y, si se da, las instaladas solo en Molino. */
export function fontFolders(ownFonts?: string): string[] {
  const windows = process.env.WINDIR ?? process.env.SystemRoot ?? 'C:\\Windows'
  const folders = [join(windows, 'Fonts')]
  const local = process.env.LOCALAPPDATA
  if (local) {
    folders.push(join(local, 'Microsoft', 'Windows', 'Fonts'), join(local, 'Microsoft', 'FontCache', '4', 'CloudFonts'))
  }
  if (ownFonts) folders.push(ownFonts)
  return folders
}

async function listing(folder: string, depth = 0): Promise<string[]> {
  const out: string[] = []
  let entries
  try {
    entries = await readdir(folder, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    const full = join(folder, entry.name)
    if (entry.isDirectory()) {
      // CloudFonts guarda cada familia en su carpeta.
      if (depth < 2) out.push(...(await listing(full, depth + 1)))
    } else if (entry.isFile()) {
      try {
        const info = await stat(full)
        out.push(`${full.toLowerCase()}|${info.size}|${Math.round(info.mtimeMs)}`)
      } catch {
        /* desapareció mientras se miraba */
      }
    }
  }
  return out
}

/** Huella de las fuentes del equipo, de las de Molino y de la pieza (16 cifras hexadecimales). */
export async function fontFingerprint(pieceVersion: string, ownFonts?: string): Promise<string> {
  const hash = createHash('sha256').update(`pieza:${pieceVersion}\n`)
  for (const folder of fontFolders(ownFonts)) {
    const lines = (await listing(folder)).sort()
    hash.update(`${folder.toLowerCase()}\n${lines.join('\n')}\n`)
  }
  return hash.digest('hex').slice(0, 16)
}

const KEYS = ['__all_fonts_js_version__', '__fonts_files', '__fonts_infos', '__fonts_ranges', 'g_fonts_selection_bin'] as const
type Key = (typeof KEYS)[number]

class IndexError extends Error {}

/** Dónde acaba el valor JSON que empieza en ``start``: un número, una cadena o listas de ellos. */
function valueEnd(text: string, start: number): number {
  let depth = 0
  let inString = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (inString) {
      if (c === '\\') i++
      else if (c === '"') {
        inString = false
        if (depth === 0) return i + 1
      }
      continue
    }
    if (c === '"') inString = true
    else if (c === '[') depth++
    else if (c === ']') {
      depth--
      if (depth === 0) return i + 1
      if (depth < 0) break
    } else if (depth === 0) {
      const number = /-?\d+/y
      number.lastIndex = i
      if (number.exec(text)) return number.lastIndex
      break
    }
  }
  throw new IndexError('valor no válido')
}

const isInt = (n: unknown, min: number, max: number): boolean => Number.isInteger(n) && (n as number) >= min && (n as number) < max

/**
 * Lee AllFonts.js como datos y lo vuelve a escribir: así no puede llevar código.
 * Devuelve el texto nuevo y la lista de archivos de fuentes (lo único que los
 * editores pueden pedir después). Si algo no encaja, lanza un error.
 */
export function cleanFontIndex(raw: string): { text: string; files: string[]; families: string[] } {
  const text = raw.replace(/^\uFEFF/, '')
  const values = new Map<Key, unknown>()
  let at = 0
  for (;;) {
    while (at < text.length && /\s/.test(text[at])) at++
    if (at >= text.length) break
    const head = /window\["([A-Za-z_]+)"\]\s*=\s*/y
    head.lastIndex = at
    const match = head.exec(text)
    const key = match?.[1] as Key | undefined
    if (!match || !key || !KEYS.includes(key) || values.has(key)) throw new IndexError('asignación no válida')
    const end = valueEnd(text, head.lastIndex)
    values.set(key, JSON.parse(text.slice(head.lastIndex, end)))
    const semicolon = /\s*;/y
    semicolon.lastIndex = end
    if (!semicolon.exec(text)) throw new IndexError('falta el punto y coma')
    at = semicolon.lastIndex
  }
  if (values.size !== KEYS.length) throw new IndexError('índice incompleto')
  const version = values.get('__all_fonts_js_version__')
  const files = values.get('__fonts_files')
  const infos = values.get('__fonts_infos')
  const ranges = values.get('__fonts_ranges')
  const selection = values.get('g_fonts_selection_bin')
  const ok =
    (version === 1 || version === 2) &&
    Array.isArray(files) &&
    files.every((f) => typeof f === 'string' && f.length > 0 && f.length < 1024) &&
    Array.isArray(infos) &&
    infos.every(
      (i) =>
        Array.isArray(i) && i.length === 9 && typeof i[0] === 'string' && i[0].length < 512 && i.slice(1).every((n) => isInt(n, -1, 1_000_000))
    ) &&
    Array.isArray(ranges) &&
    ranges.every((n) => isInt(n, 0, 2 ** 31)) &&
    typeof selection === 'string' &&
    /^[A-Za-z0-9+/]*={0,2}$/.test(selection)
  if (!ok) throw new IndexError('tipos no válidos')
  const list = files as string[]
  const out = [
    `window["__all_fonts_js_version__"] = ${version as number};`,
    `window["__fonts_files"] = [\n${list.map((f) => JSON.stringify(f)).join(',\n')}\n];`,
    `window["__fonts_infos"] = [\n${(infos as unknown[]).map((i) => JSON.stringify(i)).join(',\n')}\n];`,
    `window["__fonts_ranges"] = ${JSON.stringify(ranges)};`,
    `window["g_fonts_selection_bin"] = ${JSON.stringify(selection)};`
  ]
  // Las familias que conoce (para avisar de las que faltan en un documento).
  const families = [...new Set((infos as [string, ...number[]][]).map((i) => i[0]))]
  return { text: `${out.join('\n\n')}\n`, files: list, families }
}

/** Guarda el índice en ``office\fonts\<huella>`` (primero aparte; entero o nada) y borra los anteriores. */
export async function saveFontIndex(officeRoot: string, fingerprint: string, text: string, selection: Buffer): Promise<string> {
  if (!/^[0-9a-f]{16}$/.test(fingerprint)) throw new IndexError('huella no válida')
  const fonts = join(officeRoot, 'fonts')
  const target = join(fonts, fingerprint)
  const temp = join(fonts, `.${fingerprint}-${process.pid}`)
  await rm(temp, { recursive: true, force: true })
  await mkdir(temp, { recursive: true })
  await writeFile(join(temp, 'AllFonts.js'), text, 'utf8')
  await writeFile(join(temp, 'font_selection.bin'), selection)
  await rm(target, { recursive: true, force: true })
  await rename(temp, target)
  for (const name of await readdir(fonts).catch(() => [] as string[])) {
    if (name !== fingerprint) await rm(join(fonts, name), { recursive: true, force: true }).catch(() => undefined)
  }
  return target
}

/** El índice ya guardado para esta huella, leído y comprobado; null si no está o no vale. */
export async function loadFontIndex(officeRoot: string, fingerprint: string): Promise<{ text: string; files: string[]; families: string[] } | null> {
  try {
    const folder = join(officeRoot, 'fonts', fingerprint)
    await stat(join(folder, 'font_selection.bin'))
    return cleanFontIndex(await readFile(join(folder, 'AllFonts.js'), 'utf8'))
  } catch {
    return null
  }
}

/** ¿Es ``file`` una fuente que los editores pueden pedir? (está en el índice y en una carpeta de fuentes). */
export function fontAllowed(file: string, listed: ReadonlySet<string>, folders: readonly string[]): boolean {
  if (!listed.has(file.toLowerCase())) return false
  const full = resolve(file).toLowerCase()
  return folders.some((folder) => full.startsWith(resolve(folder).toLowerCase() + sep))
}
