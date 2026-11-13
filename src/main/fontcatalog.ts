import { createHash } from 'node:crypto'
import { existsSync, mkdirSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { app, type Session } from 'electron'
import type { OfficeFontInfo } from '@shared/officeui'
import { restrictedSession } from './download'
import catalog from './fonts-catalog.json'
import { log } from './log'

/**
 * «Fuentes que faltan» (paso 7 de PLAN-SUITE): un documento nombra fuentes que
 * no están en el equipo. Molino las busca en un catálogo de fuentes libres que
 * va dentro de la aplicación (fonts-catalog.json, de scripts/fonts-catalog.mjs:
 * Google Fonts en una revisión fija de github.com/google/fonts) y, si el
 * usuario dice que sí, las instala solo en Molino (``office\own-fonts``, que
 * leen x2t y los editores), sin tocar Windows: una app de la Store no puede
 * instalar fuentes en Windows. Solo se baja de esa revisión, con el tamaño y la
 * huella del catálogo, y solo TTF u OTF.
 */

type Family = { dir: string; license: string; licenseFile: [string, number, string]; files: [string, number, string][] }
// Datos propios, generados por scripts/fonts-catalog.mjs (no vienen de fuera al usarlo).
const FAMILIES = (catalog as unknown as { families: Record<string, Family> }).families
const RAW = `https://raw.githubusercontent.com/${catalog.repo}/${catalog.commit}/`
const MAX_FILE = 30 * 1024 * 1024
const FILE_NAME = /^[A-Za-z0-9_\-[\],.]{1,120}\.(ttf|otf)$/

/** Nombre de familia → clave del catálogo (la carpeta de google/fonts: minúsculas, sin espacios). */
const key = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * Las de Microsoft (y otras de pago que vienen con Windows u Office): no se
 * pueden descargar. Para Calibri y Cambria, la pieza trae otras que ocupan lo
 * mismo (las líneas y las páginas no se mueven).
 */
const MICROSOFT = [
  'calibri', 'cambria', 'candara', 'consolas', 'constantia', 'corbel', 'segoe', 'aptos', 'arial', 'timesnewroman', 'verdana', 'tahoma',
  'georgia', 'trebuchet', 'couriernew', 'comicsans', 'impact', 'centurygothic', 'bookantiqua', 'palatinolinotype', 'garamond',
  'bookmanoldstyle', 'lucida', 'franklingothic', 'gillsans', 'rockwell', 'twcenmt', 'bahnschrift', 'sitka', 'symbol', 'wingdings',
  'webdings', 'marlett', 'msgothic', 'msmincho', 'mspgothic', 'yugothic', 'meiryo', 'simsun', 'simhei', 'microsoftyahei', 'microsoftjhenghei',
  'malgungothic', 'gulim', 'batang', 'dotum', 'mangal', 'nirmala', 'ebrima', 'gadugi', 'leelawadee', 'javanese', 'mongolianbaiti', 'sylfaen',
  'cooperblack', 'brushscript', 'edwardianscript', 'freestylescript', 'monotypecorsiva', 'bodonimt', 'baskervilleoldface', 'perpetua', 'goudyoldstyle'
]
const SUBSTITUTES: Record<string, string> = { calibri: 'Carlito', calibrilight: 'Carlito', cambria: 'Caladea' }

/** Qué se puede hacer con una fuente que falta. */
export function lookupFont(name: string): OfficeFontInfo {
  const k = key(name)
  const family = FAMILIES[k]
  if (family) {
    const size = family.files.reduce((total, f) => total + f[1], 0)
    return { name, status: 'free', license: family.license as 'ofl' | 'apache' | 'ufl', size, files: family.files.length }
  }
  if (MICROSOFT.some((m) => k.startsWith(m))) return { name, status: 'microsoft', substitute: SUBSTITUTES[k] ?? null }
  return { name, status: 'unknown' }
}

let fontSession: Session | null = null
function downloads(): Session {
  // Solo pruebas, sin empaquetar: el catálogo se sirve desde un servidor local.
  const origin = !app.isPackaged ? process.env.MOLINO_TEST_FONTS_ORIGIN : undefined
  const prefix = origin ? `${origin}/` : RAW
  fontSession ??= restrictedSession('molino-fonts', (url) => url.startsWith(prefix), 'fuentes')
  return fontSession
}

function urlOf(path: string): string {
  const origin = !app.isPackaged ? process.env.MOLINO_TEST_FONTS_ORIGIN : undefined
  return `${origin ? `${origin}/` : RAW}${path.split('/').map(encodeURIComponent).join('/')}`
}

/** La huella con la que Git guarda un archivo (la del catálogo). */
const gitBlob = (data: Buffer): string => createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex')

/** Baja un archivo del catálogo y lo da por bueno solo si su tamaño y su huella coinciden. */
async function fetchPinned(path: string, size: number, sha1: string): Promise<Buffer> {
  if (size <= 0 || size > MAX_FILE) throw new Error('tamaño fuera de lo admitido')
  const response = await downloads().fetch(urlOf(path), { cache: 'no-store', redirect: 'error' })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const data = Buffer.from(await response.arrayBuffer())
  if (data.length !== size || gitBlob(data) !== sha1) throw new Error('no coincide con el catálogo')
  return data
}

/** ¿Es una fuente TrueType u OpenType? (por su firma; ni colecciones ni otra cosa). */
function isFont(data: Buffer, ext: string): boolean {
  const tag = data.subarray(0, 4)
  if (ext === '.otf') return tag.toString('latin1') === 'OTTO' || tag.equals(Buffer.from([0, 1, 0, 0]))
  return tag.equals(Buffer.from([0, 1, 0, 0])) || tag.toString('latin1') === 'true'
}

/**
 * Instala solo en Molino (``ownFonts``: office\own-fonts) las familias de esas
 * fuentes (solo las que están en el catálogo). Devuelve las instaladas y las
 * que no se pudieron; las licencias quedan en ``licenses`` (una por familia).
 */
export async function installFonts(names: string[], licenses: string, ownFonts: string): Promise<{ installed: string[]; failed: string[] }> {
  const where = { fonts: ownFonts }
  const installed: string[] = []
  const failed: string[] = []
  mkdirSync(where.fonts, { recursive: true })
  mkdirSync(licenses, { recursive: true })
  for (const name of names) {
    const k = key(name)
    const family = FAMILIES[k]
    if (!family) {
      failed.push(name)
      continue
    }
    try {
      for (const [file, size, sha1] of family.files) {
        const base = basename(file)
        if (!FILE_NAME.test(base)) throw new Error('nombre de archivo no válido')
        const dest = join(where.fonts, base)
        if (existsSync(dest)) {
          // Ya está (de antes o de otra familia): si es la misma, nada; si es otra, no se pisa.
          if (gitBlob(await readFile(dest)) === sha1) continue
          throw new Error('ya hay otra fuente con ese nombre')
        }
        const data = await fetchPinned(`${family.dir}/${file}`, size, sha1)
        if (!isFont(data, extname(base).toLowerCase())) throw new Error('no es una fuente TrueType u OpenType')
        await writeFile(dest, data, { flag: 'wx' })
      }
      const [licenseFile, licenseSize, licenseSha] = family.licenseFile
      const text = await fetchPinned(`${family.dir}/${licenseFile}`, licenseSize, licenseSha)
      await writeFile(join(licenses, `${k}-${licenseFile}`), text)
      installed.push(name)
    } catch (error) {
      log.warn(`fuentes: no se pudo instalar una familia (${error instanceof Error ? error.message : '?'})`)
      failed.push(name)
    }
  }
  return { installed, failed }
}
