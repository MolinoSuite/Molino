import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { safeStorage } from 'electron'
import { z } from 'zod'
import type { SavedSignature } from '@shared/api'
import { MAX_USER_THEMES, MOLINO_THEME_ID, THEME_COLOR_KEYS, THEME_FONT_MAX, THEME_NAME_MAX, THEME_SIZE, THEME_SPACE, THEME_STYLE_KEYS, USER_THEME_ID } from '@shared/officeThemes'
import { APP_ACCENTS, DEFAULT_ACCENT, type RecentFile, type Settings } from '@shared/types'
import { log } from './log'

/**
 * Datos persistentes de la aplicación: ajustes, archivos recientes y la
 * biblioteca de firmas manuscritas.
 *
 * Lo que se lee del disco se trata como dato no fiable (puede estar corrupto o
 * manipulado): se valida con un esquema y, si no encaja, se usan los valores
 * por defecto en lugar de fallar (OWASP A08:2025).
 */

/**
 * Dirección del servidor de sello de tiempo: vacía o una URL http(s) normal,
 * sin usuario ni contraseña incrustados. El motor la vuelve a comprobar y además
 * solo se conecta a direcciones públicas (lista blanca, OWASP A05:2025).
 */
function isTimestampUrl(value: string): boolean {
  if (value === '') return true
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname !== '' && url.username === '' && url.password === ''
  } catch {
    return false
  }
}

/** El aspecto de una app de oficina (Ajustes → Apariencia en cada una). */
const LookSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']).default('system'),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/)
})

/** Un color #rrggbb. */
const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/)
/** Un nombre de fuente: letras, números, espacios y poco más (nada de control ni de comillas). */
const FontName = z.string().min(1).max(THEME_FONT_MAX).regex(/^[\p{L}\p{N}][\p{L}\p{N} ._&+-]*$/u)
const ThemeStyle = z.object({
  font: z.enum(['heading', 'body']),
  size: z.number().min(THEME_SIZE.min).max(THEME_SIZE.max),
  color: z.enum(THEME_COLOR_KEYS),
  bold: z.boolean(),
  italic: z.boolean(),
  before: z.number().min(THEME_SPACE.min).max(THEME_SPACE.max),
  after: z.number().min(THEME_SPACE.min).max(THEME_SPACE.max)
})
/** Un tema de documento del usuario (Documentos, Hojas y Presentaciones; ver shared/officeThemes.ts). */
const OfficeThemeSchema = z.object({
  id: z.string().regex(USER_THEME_ID),
  name: z.string().min(1).max(THEME_NAME_MAX).regex(/^[^\u0000-\u001f\u007f]+$/),
  fonts: z.object({ heading: FontName, body: FontName }),
  size: z.number().min(THEME_SIZE.min).max(THEME_SIZE.max),
  colors: z.object(Object.fromEntries(THEME_COLOR_KEYS.map((k) => [k, HexColor])) as Record<(typeof THEME_COLOR_KEYS)[number], typeof HexColor>),
  styles: z.object(Object.fromEntries(THEME_STYLE_KEYS.map((k) => [k, ThemeStyle])) as Record<(typeof THEME_STYLE_KEYS)[number], typeof ThemeStyle>)
})
/** El tema de los documentos nuevos de cada app: uno de Molino o uno del usuario. */
const ThemeRef = z.string().refine((id) => USER_THEME_ID.test(id) || MOLINO_THEME_ID.test(id))

/** Una versión de Molino, x.y.z (la de app.getVersion(); ver whatsnew.ts). */
export const VERSION_RE = /^\d{1,4}\.\d{1,4}\.\d{1,6}$/

// Las claves que ya no existen se descartan al leer (z.object las quita), sin tocar
// los demás ajustes: p. ej. checkUpdates, el aviso de versiones nuevas que había hasta
// Molino PDF 0.7.5 y Molino Suite 1.0.0. Al guardar algo, desaparecen de config.json.
const SettingsSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']).default('system'),
  accent: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default(DEFAULT_ACCENT),
  sidebarOpen: z.boolean().default(true),
  highlightFields: z.boolean().default(true),
  defaultZoom: z.enum(['fit-width', 'fit-page', 'actual']).default('fit-width'),
  author: z.string().max(120).default(''),
  timestampUrl: z.string().max(300).refine(isTimestampUrl).default(''),
  signReason: z.string().max(200).default(''),
  signLocation: z.string().max(200).default(''),
  dateStyle: z.enum(['short', 'shortTime', 'medium', 'long', 'full', 'iso']).default('short'),
  // Por defecto, un servicio de sello de tiempo conocido: la firma con sello funciona sin configurar nada.
  timestampServer: z.enum(['digicert', 'globalsign', 'sectigo', 'custom']).default('digicert'),
  signLevel: z.enum(['basic', 'timestamp', 'longTerm']).default('timestamp'),
  askDefaultPdf: z.boolean().default(true),
  closeMany: z.enum(['ask', 'all', 'current']).default('ask'),
  linuxUpdates: z.boolean().default(true),
  // Solo el nombre de la impresora, que Windows ya conoce; se comprueba al imprimir.
  printer: z.string().max(260).default(''),
  language: z.enum(['auto', 'es', 'en']).default('auto'),
  // Cada app de oficina, con su aspecto (Molino PDF usa theme y accent).
  appearance: z.object({ word: LookSchema.optional(), cell: LookSchema.optional(), slide: LookSchema.optional() }).default({}),
  // La pestaña Programador de cada app de oficina: oculta hasta que se activa en Ajustes.
  developer: z.array(z.enum(['word', 'cell', 'slide'])).max(3).default([]),
  // IA local: apagada hasta que el usuario la activa y descarga los modelos.
  aiTier: z.enum(['off', 'basic', 'advanced']).default('off'),
  aiGpu: z.boolean().default(true),
  // Temas de documento propios (compartidos por las tres apps de oficina) y el de los documentos nuevos de cada una.
  officeThemes: z
    .array(OfficeThemeSchema)
    .max(MAX_USER_THEMES)
    .refine((list) => new Set(list.map((t) => t.id)).size === list.length)
    .default([]),
  officeDefaultTheme: z.object({ word: ThemeRef.optional(), cell: ThemeRef.optional(), slide: ThemeRef.optional() }).default({})
})

const BoundsSchema = z.object({
  x: z.number().int().optional(),
  y: z.number().int().optional(),
  width: z.number().int().min(400).max(20000),
  height: z.number().int().min(300).max(20000),
  maximized: z.boolean().default(false)
})

const RecentSchema = z.object({
  id: z.string().regex(/^[0-9a-f]{16}$/),
  path: z.string().min(3).max(32000),
  openedAt: z.number()
})

/** Palabras del diccionario personal (como el de Word, que admite unas 5.000 por archivo). */
const MAX_USER_WORDS = 5000
/** Mis scripts: cuántos y de qué tamaño, como mucho. */
const MAX_SCRIPTS = 200
const MAX_SCRIPT_CODE = 100_000

/** Un script del usuario (pestaña Programador de Documentos, Hojas y Presentaciones). */
const OfficeScript = z.object({
  id: z.string().regex(/^[0-9a-f]{16}$/),
  kind: z.enum(['word', 'cell', 'slide']),
  name: z.string().min(1).max(80),
  code: z.string().max(MAX_SCRIPT_CODE)
})
export type OfficeScriptEntry = z.infer<typeof OfficeScript>

const ConfigSchema = z.object({
  settings: SettingsSchema.default(SettingsSchema.parse({})),
  window: BoundsSchema.optional(),
  recent: z.array(RecentSchema).max(200).default([]),
  // Los de Documentos, Hojas y Presentaciones, aparte (la pantalla inicial de Molino PDF solo abre PDF).
  officeRecent: z.array(RecentSchema).max(200).default([]),
  // Fuentes de las que no se vuelve a avisar al abrir un documento (en minúsculas).
  ignoredFonts: z.array(z.string().min(1).max(64)).max(300).default([]),
  // Diccionario personal del corrector de Documentos, Hojas y Presentaciones.
  // (Si algo no encaja, se pierde solo la lista, no los demás ajustes.)
  userWords: z.array(z.string().min(1).max(64)).max(MAX_USER_WORDS).default([]).catch([]),
  officeScripts: z.array(OfficeScript).max(MAX_SCRIPTS).default([]).catch([]),
  // La última versión cuyo aviso de novedades ya no hay que enseñar (whatsnew.ts). Si no
  // vale, se pierde solo ella (cuenta como una versión que aún no la guardaba).
  seenVersion: z.string().regex(VERSION_RE).optional().catch(undefined)
})

type Config = z.infer<typeof ConfigSchema>
export type WindowBounds = z.infer<typeof BoundsSchema>

const SignatureSchema = z.object({
  id: z.string().regex(/^[0-9a-f]{16}$/),
  kind: z.enum(['signature', 'initials']),
  png: z.string().max(4_000_000), // base64
  width: z.number().positive().max(10000),
  height: z.number().positive().max(10000),
  createdAt: z.number()
})

// La pantalla inicial tiene buscador: caben muchos sin agobiar.
const MAX_RECENT = 100
/** Una palabra del diccionario personal: sin espacios ni caracteres de control. */
const USER_WORD = /^[^\s\u0000-\u001f\u007f]{1,64}$/u
const MAX_SIGNATURES = 12
const MAX_SIGNATURE_BYTES = 2_000_000
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** Quita de los ajustes leídos del disco los temas que no valen (y el predeterminado que no vale). */
function sanitizeThemes(settings: Record<string, unknown>): void {
  if (settings.officeThemes !== undefined) {
    const seen = new Set<string>()
    const list = Array.isArray(settings.officeThemes) ? settings.officeThemes : []
    settings.officeThemes = list
      .flatMap((raw) => {
        const parsed = OfficeThemeSchema.safeParse(raw)
        if (!parsed.success || seen.has(parsed.data.id)) return []
        seen.add(parsed.data.id)
        return [parsed.data]
      })
      .slice(0, MAX_USER_THEMES)
  }
  if (settings.officeDefaultTheme !== undefined && !SettingsSchema.shape.officeDefaultTheme.safeParse(settings.officeDefaultTheme).success) {
    delete settings.officeDefaultTheme
  }
}

/** Escritura atómica: un corte de luz a mitad no deja el archivo a medias. */
/**
 * Si se puede cifrar de verdad con la cuenta del usuario. En Linux, sin llavero
 * de sesión (GNOME, KDE…), Electron «cifra» con una clave fija («basic_text»):
 * eso no protege nada, así que cuenta como no disponible.
 */
function encryptionAvailable(): boolean {
  if (!safeStorage.isEncryptionAvailable()) return false
  if (process.platform !== 'linux') return true
  const backend = safeStorage.getSelectedStorageBackend()
  return backend !== 'basic_text' && backend !== 'unknown'
}

function writeAtomic(file: string, data: string | Buffer): void {
  mkdirSync(dirname(file), { recursive: true })
  const tmp = `${file}.${randomBytes(4).toString('hex')}.tmp`
  try {
    writeFileSync(tmp, data)
    renameSync(tmp, file)
  } finally {
    if (existsSync(tmp)) {
      try {
        unlinkSync(tmp)
      } catch {
        /* nada que hacer */
      }
    }
  }
}

export class Store {
  private config: Config
  private readonly configFile: string
  private readonly signaturesFile: string
  private signatures: z.infer<typeof SignatureSchema>[] | null = null

  constructor(dir: string) {
    this.configFile = join(dir, 'config.json')
    this.signaturesFile = join(dir, 'signatures.bin')
    this.config = this.load()
  }

  private load(): Config {
    try {
      if (existsSync(this.configFile)) {
        const raw = JSON.parse(readFileSync(this.configFile, 'utf8')) as { settings?: Record<string, unknown> }
        // Quien ya había escrito un servidor de sello a mano (versiones anteriores) lo conserva.
        if (raw?.settings && raw.settings.timestampServer === undefined && typeof raw.settings.timestampUrl === 'string' && raw.settings.timestampUrl) {
          raw.settings.timestampServer = 'custom'
        }
        // Antes el tema era uno para todas las apps: cada app de oficina se queda con el que había.
        if (raw?.settings && raw.settings.appearance === undefined && (raw.settings.theme === 'light' || raw.settings.theme === 'dark')) {
          const theme = raw.settings.theme
          raw.settings.appearance = Object.fromEntries((['word', 'cell', 'slide'] as const).map((app) => [app, { theme, accent: APP_ACCENTS[app] }]))
        }
        // Un tema propio que no vale (o el predeterminado) se pierde solo él, no todos los ajustes.
        if (raw?.settings) sanitizeThemes(raw.settings)
        const parsed = ConfigSchema.safeParse(raw)
        if (parsed.success) return parsed.data
        log.warn('ajustes no válidos; se usan los valores por defecto')
      }
    } catch {
      log.warn('no se pudieron leer los ajustes; se usan los valores por defecto')
    }
    return ConfigSchema.parse({})
  }

  private persist(): void {
    try {
      writeAtomic(this.configFile, JSON.stringify(this.config, null, 2))
    } catch {
      log.warn('no se pudieron guardar los ajustes')
    }
  }

  // ---------------------------------------------------------------- ajustes

  get settings(): Settings {
    return { ...this.config.settings }
  }

  updateSettings(patch: unknown): Settings {
    const partial = SettingsSchema.partial().safeParse(patch)
    if (partial.success && typeof patch === 'object' && patch !== null) {
      // Zod 4 rellena con su valor por defecto los ajustes que NO vienen en el
      // cambio; aplicarlos tal cual devolvería los demás a su valor de fábrica.
      // Solo se aplica lo que se ha pedido cambiar.
      const sent = new Set(Object.keys(patch))
      const changes = Object.fromEntries(Object.entries(partial.data).filter(([key]) => sent.has(key)))
      this.config.settings = SettingsSchema.parse({ ...this.config.settings, ...changes })
      this.persist()
    }
    return this.settings
  }

  get windowBounds(): WindowBounds | undefined {
    return this.config.window
  }

  setWindowBounds(bounds: WindowBounds): void {
    const parsed = BoundsSchema.safeParse(bounds)
    if (parsed.success) {
      this.config.window = parsed.data
      this.persist()
    }
  }

  // ----------------------------------------------------------- recientes

  /** Lo que ve la interfaz: nunca recibe la ruta completa, solo un identificador. */
  recentList(): RecentFile[] {
    return this.config.recent.map((entry) => ({
      id: entry.id,
      name: basename(entry.path),
      folder: dirname(entry.path),
      openedAt: entry.openedAt
    }))
  }

  recentPath(id: string): string | null {
    return this.config.recent.find((entry) => entry.id === id)?.path ?? null
  }

  addRecent(path: string): void {
    const key = path.toLowerCase()
    const rest = this.config.recent.filter((entry) => entry.path.toLowerCase() !== key)
    this.config.recent = [{ id: randomBytes(8).toString('hex'), path, openedAt: Date.now() }, ...rest].slice(0, MAX_RECENT)
    this.persist()
  }

  removeRecent(path: string): void {
    const key = path.toLowerCase()
    this.config.recent = this.config.recent.filter((entry) => entry.path.toLowerCase() !== key)
    this.persist()
  }

  /** Quita uno de la lista por su identificador. */
  forgetRecent(id: string): RecentFile[] {
    this.config.recent = this.config.recent.filter((entry) => entry.id !== id)
    this.persist()
    return this.recentList()
  }

  // ------------------------------------- recientes de Documentos, Hojas y Presentaciones

  /** Rutas completas, para el proceso principal (officewin.ts decide qué ve cada ventana). */
  officeRecent(): { id: string; path: string; openedAt: number }[] {
    return this.config.officeRecent.map((entry) => ({ ...entry }))
  }

  addOfficeRecent(path: string): void {
    const key = path.toLowerCase()
    const rest = this.config.officeRecent.filter((entry) => entry.path.toLowerCase() !== key)
    this.config.officeRecent = [{ id: randomBytes(8).toString('hex'), path, openedAt: Date.now() }, ...rest].slice(0, MAX_RECENT)
    this.persist()
  }

  ignoredFonts(): string[] {
    return [...this.config.ignoredFonts]
  }

  ignoreFonts(names: string[]): void {
    const all = new Set([...this.config.ignoredFonts, ...names.map((n) => n.toLowerCase().slice(0, 64))])
    this.config.ignoredFonts = [...all].slice(-300)
    this.persist()
  }

  /** El diccionario personal del corrector (las palabras que el usuario añade). */
  userWords(): string[] {
    return [...this.config.userWords]
  }

  addUserWords(words: string[]): void {
    const valid = words.map((w) => w.normalize('NFC')).filter((w) => w.length <= 64 && USER_WORD.test(w))
    const all = new Set([...this.config.userWords, ...valid])
    this.config.userWords = [...all].slice(-MAX_USER_WORDS)
    this.persist()
  }

  removeUserWords(words: string[]): void {
    const gone = new Set(words)
    this.config.userWords = this.config.userWords.filter((w) => !gone.has(w))
    this.persist()
  }

  // ------------------------------------------------------- mis scripts

  officeScripts(kind: OfficeScriptEntry['kind']): OfficeScriptEntry[] {
    return this.config.officeScripts.filter((entry) => entry.kind === kind).map((entry) => ({ ...entry }))
  }

  /** Guarda un script (nuevo si no trae id); devuelve su id, o null si no vale. */
  saveOfficeScript(entry: { id?: string; kind: OfficeScriptEntry['kind']; name: string; code: string }): string | null {
    const id = entry.id ?? randomBytes(8).toString('hex')
    const parsed = OfficeScript.safeParse({ ...entry, id, name: entry.name.trim().slice(0, 80) })
    if (!parsed.success) return null
    const others = this.config.officeScripts.filter((s) => s.id !== id)
    if (others.length >= MAX_SCRIPTS) return null
    this.config.officeScripts = [...others, parsed.data]
    this.persist()
    return id
  }

  removeOfficeScript(id: string): void {
    this.config.officeScripts = this.config.officeScripts.filter((s) => s.id !== id)
    this.persist()
  }

  forgetOfficeRecent(id: string): void {
    this.config.officeRecent = this.config.officeRecent.filter((entry) => entry.id !== id)
    this.persist()
  }

  // ---------------------------------------------------------- novedades

  /** La última versión cuyo aviso de novedades ya no hay que enseñar (whatsnew.ts). */
  get seenVersion(): string | undefined {
    return this.config.seenVersion
  }

  setSeenVersion(version: string): void {
    if (!VERSION_RE.test(version) || this.config.seenVersion === version) return
    this.config.seenVersion = version
    this.persist()
  }

  // ------------------------------------------------------------- firmas

  /**
   * Las firmas manuscritas guardadas son un dato especialmente sensible: quien
   * las copie puede estamparlas en otros documentos. Se guardan cifradas con la
   * protección de datos de Windows (DPAPI, a través de safeStorage), ligada a la
   * cuenta del usuario, o en Linux con el llavero de la sesión (GNOME o KDE); si
   * el cifrado no está disponible, no se guardan en disco (OWASP A04:2025).
   */
  private loadSignatures(): z.infer<typeof SignatureSchema>[] {
    if (this.signatures) return this.signatures
    this.signatures = []
    try {
      if (existsSync(this.signaturesFile) && encryptionAvailable()) {
        const json = safeStorage.decryptString(readFileSync(this.signaturesFile))
        const parsed = z.array(SignatureSchema).max(MAX_SIGNATURES).safeParse(JSON.parse(json))
        if (parsed.success) this.signatures = parsed.data
      }
    } catch {
      log.warn('no se pudo leer la biblioteca de firmas')
    }
    return this.signatures
  }

  private persistSignatures(): void {
    if (!this.signatures || !encryptionAvailable()) return
    try {
      writeAtomic(this.signaturesFile, safeStorage.encryptString(JSON.stringify(this.signatures)))
    } catch {
      log.warn('no se pudo guardar la biblioteca de firmas')
    }
  }

  signatureList(): SavedSignature[] {
    return this.loadSignatures().map((s) => ({
      id: s.id,
      kind: s.kind,
      png: new Uint8Array(Buffer.from(s.png, 'base64')),
      width: s.width,
      height: s.height,
      createdAt: s.createdAt
    }))
  }

  addSignature(input: { kind: 'signature' | 'initials'; png: Uint8Array; width: number; height: number }): SavedSignature[] {
    const data = Buffer.from(input.png)
    // Solo PNG reales y de tamaño acotado.
    if (data.length < PNG_MAGIC.length || data.length > MAX_SIGNATURE_BYTES || !data.subarray(0, 8).equals(PNG_MAGIC)) {
      return this.signatureList()
    }
    const list = this.loadSignatures()
    list.unshift({
      id: randomBytes(8).toString('hex'),
      kind: input.kind,
      png: data.toString('base64'),
      width: input.width,
      height: input.height,
      createdAt: Date.now()
    })
    this.signatures = list.slice(0, MAX_SIGNATURES)
    this.persistSignatures()
    return this.signatureList()
  }

  removeSignature(id: string): SavedSignature[] {
    this.signatures = this.loadSignatures().filter((s) => s.id !== id)
    this.persistSignatures()
    return this.signatureList()
  }
}
