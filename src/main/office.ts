import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, readdir, readFile, rename, rm, statfs, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { app, type Session, shell } from 'electron'
import { z } from 'zod'
import type { OfficeFailure, OfficeLegal, OfficeProgress, OfficeStatus } from '@shared/office'
import { DownloadError, downloadPinned, matchesPinned, type PinnedFile, restrictedSession } from './download'
import { log } from './log'
import { unzip, UnzipError } from './unzip'

/**
 * El motor de oficina: la pieza que necesitan Documentos, Hojas y
 * Presentaciones (editores y conversor de ONLYOFFICE con los cambios de
 * Molino; la arma office/build.py). Molino PDF no la necesita: solo se
 * descarga si el usuario añade esas apps (..\PLAN-SUITE.md, «Decisiones»).
 *
 * Igual que los modelos de IA (download.ts): solo la pieza de ESTA versión de
 * Molino, de su dirección fija, con su tamaño y su huella. Además:
 * - se descomprime en una carpeta aparte (unzip.ts, que vuelve a comprobar
 *   nombres, número de archivos, bytes y CRC) y solo pasa a su sitio entera;
 * - se instala en la carpeta de datos (%LOCALAPPDATA%\Molino\office\<versión>,
 *   o MolinoData\office en la portable) y la desinstalación la borra
 *   (build/installer.nsh);
 * - el zip descargado se guarda hasta acabar de instalar: si se cierra Molino a
 *   medias, la próxima vez no se vuelve a descargar.
 *
 * Una pieza nueva se instala sola (``autoUpdate``): si Molino se actualiza y
 * trae otra, quien ya tenía las apps la recibe en segundo plano, con las mismas
 * comprobaciones, sin volver a pedirlo; la anterior se borra al acabar.
 */

export interface PieceFile extends PinnedFile {
  version: string
  /** Archivos y bytes una vez descomprimida (se comprueban al instalar). */
  files: number
  unpacked: number
}

/**
 * La pieza de esta versión de Molino. Se publica como archivo de la versión de
 * Molino que la estrena (después, las siguientes siguen apuntando ahí hasta que
 * cambie). Vale la huella del zip publicado: la precompilada de Hojas no sale
 * igual dos veces (office/build.py).
 */
export const OFFICE_PIECE: PieceFile = {
  version: '10.0.0-1',
  url: 'https://github.com/MolinoSuite/Molino/releases/download/v0.8.0/MolinoOffice-10.0.0-1.zip',
  size: 176_316_584,
  sha256: '405b2321de515f68f281d9a6fdcc7b9cffe194590cd5200acdb0f06cee262636',
  files: 3_246,
  unpacked: 432_369_386
}

/**
 * Documentos, Hojas y Presentaciones aún no están dentro de Molino
 * (PLAN-SUITE.md, pasos 3 a 5) y la pieza no está publicada: hasta entonces
 * solo se ofrece sin empaquetar (desarrollo y pruebas).
 */
const OFFERED_WHEN_PACKAGED = false

/** Cómo se arma la pieza y los cambios de Molino (office/build.py y office/patches.py): el código que pide la AGPL. */
export const OFFICE_SOURCE_URL = 'https://github.com/MolinoSuite/Molino/tree/main/office'

/**
 * Abre un aviso legal de la pieza instalada en ``pieceDir`` (paso 8 de
 * PLAN-SUITE): el de los cambios de Molino (en el idioma de Molino), la
 * licencia de ONLYOFFICE, la carpeta con los componentes de terceros o, en el
 * navegador, el código. Las rutas y direcciones son fijas: de la interfaz solo
 * llega cuál.
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

/** Ruta de las descargas de las versiones de Molino en GitHub (y nada más de github.com). */
const RELEASES_PATH = '/MolinoSuite/Molino/releases/download/'
/** Adonde redirige GitHub los archivos de una versión (el segundo, el de antes de 2025). */
const RELEASE_HOSTS = new Set(['release-assets.githubusercontent.com', 'objects.githubusercontent.com'])
const DISK_MARGIN = 512 * 1024 ** 2

// ---------------------------------------------------------------- pruebas

const TestPiece = z.object({
  origin: z.string().regex(/^http:\/\/127\.0\.0\.1:\d{2,5}$/),
  piece: z.object({
    version: z.string().regex(/^[\w.-]{1,40}$/),
    url: z.string(),
    size: z.number().int().positive(),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    files: z.number().int().positive(),
    unpacked: z.number().int().nonnegative()
  })
})

/**
 * Solo en pruebas (sin empaquetar): MOLINO_TEST_OFFICE_PIECE apunta a una pieza
 * pequeña servida desde un servidor local. En la aplicación instalada no existe.
 */
function testPiece(): z.infer<typeof TestPiece> | null {
  const path = !app.isPackaged ? process.env.MOLINO_TEST_OFFICE_PIECE : undefined
  if (!path) return null
  try {
    return TestPiece.parse(JSON.parse(readFileSync(path, 'utf8')))
  } catch (error) {
    // Una pieza de prueba que no vale no se cambia por la de verdad: una prueba
    // nunca debe acabar bajando 176 MB.
    console.error('pieza de oficina de prueba no válida:', error instanceof Error ? error.message.slice(0, 300) : error)
    const nowhere = 'http://127.0.0.1:1'
    return { origin: nowhere, piece: { ...OFFICE_PIECE, url: `${nowhere}/no-existe.zip` } }
  }
}

const test = testPiece()
/** La pieza en uso: la de esta versión o, en pruebas, la de prueba. */
const PIECE: PieceFile = test ? test.piece : OFFICE_PIECE

/** Versión de la pieza de esta versión de Molino (la carpeta en la que se instala). */
export function pieceVersion(): string {
  return PIECE.version
}

/** Solo HTTPS a las descargas de Molino en GitHub y a su red de distribución. */
export function isOfficeHost(raw: string): boolean {
  try {
    const url = new URL(raw)
    if (test && url.origin === test.origin) return true
    if (url.protocol !== 'https:' || url.username !== '' || url.password !== '' || url.port !== '') return false
    const host = url.hostname.toLowerCase()
    if (host === 'github.com') return url.pathname.startsWith(RELEASES_PATH)
    return RELEASE_HOSTS.has(host)
  } catch {
    return false
  }
}

let pieceSession: Session | null = null
function downloadSession(): Session {
  pieceSession ??= restrictedSession('molino-office', isOfficeHost, 'oficina')
  return pieceSession
}

export class OfficeError extends Error {
  constructor(readonly reason: OfficeFailure) {
    super(reason)
  }
}

function failureOf(error: unknown): OfficeFailure {
  if (error instanceof OfficeError || error instanceof DownloadError) return error.reason
  if (error instanceof UnzipError) return 'integrity'
  const code = (error as NodeJS.ErrnoException | null)?.code
  if (code === 'ENOSPC') return 'disk'
  // Errores del disco (archivo en uso, sin permiso…): no es la red.
  if (typeof code === 'string' && /^E[A-Z]+$/.test(code)) return 'install'
  return 'network'
}

const InstalledSchema = z.object({ version: z.string().regex(/^[\w.-]{1,40}$/) })

export class OfficePiece {
  readonly root: string
  /** Se llama cuando la pieza queda instalada o se quita (para reconfigurar el motor). */
  onChange: () => void = () => undefined
  /** Versión instalada según installed.json (puede ser una anterior). */
  private installed: string | null = null
  private running: Promise<void> | null = null
  private abort: (() => void) | null = null

  constructor(
    userData: string,
    private readonly onProgress: (progress: OfficeProgress | null) => void
  ) {
    this.root = join(userData, 'office')
  }

  /** Toda ruta que se toca está dentro de la carpeta de la pieza (A01:2025). */
  private inside(...parts: string[]): string {
    const full = resolve(this.root, ...parts)
    const rel = relative(resolve(this.root), full)
    if (rel === '' || rel.startsWith('..') || rel.includes(`..${sep}`)) throw new Error('ruta fuera de la carpeta de la pieza')
    return full
  }

  private partialDir(): string {
    return this.inside('.partial')
  }

  async load(): Promise<void> {
    try {
      const parsed = InstalledSchema.safeParse(JSON.parse(await readFile(join(this.root, 'installed.json'), 'utf8')))
      this.installed = parsed.success ? parsed.data.version : null
      if (!parsed.success) log.warn('oficina: installed.json no válido; se ignora')
    } catch {
      this.installed = null
    }
    // Restos de una instalación cortada (Molino se cerró a medias). La descarga
    // (.part y .zip) se queda para seguir la próxima vez.
    for (const name of await readdir(join(this.root, '.partial')).catch(() => [] as string[])) {
      if (!/\.(part|zip)$/.test(name)) await rm(this.inside('.partial', name), { recursive: true, force: true }).catch(() => undefined)
    }
  }

  /** ¿Ofrece esta versión de Molino añadir la pieza? (si no, ni se enseña ni se instala). */
  get offered(): boolean {
    return OFFERED_WHEN_PACKAGED || !app.isPackaged
  }

  /** La pieza instalada es de una versión anterior de Molino: hay que poner la de esta (se hace sola). */
  get outdated(): boolean {
    return this.offered && this.installed !== null && this.installed !== PIECE.version
  }

  /**
   * Si la pieza instalada es de una versión anterior de Molino, descarga e
   * instala en segundo plano la de esta (paso 8 de PLAN-SUITE: «una pieza nueva
   * se instala sola, como los modelos de IA»). Quien añadió las apps ya dijo
   * que las quería. Si falla (sin red), se vuelve a intentar al abrir un
   * documento o al arrancar otra vez; mientras, Ajustes ofrece «Actualizar».
   */
  autoUpdate(): void {
    if (!this.outdated || this.running) return
    log.info(`oficina: poniendo al día la pieza (${this.installed} → ${PIECE.version})`)
    const running = this.install()
    this.onUpdate()
    void running.catch(() => undefined).finally(() => this.onUpdate())
  }

  /** Se llama al empezar y al acabar una puesta al día sola (para que Ajustes vuelva a mirar el estado). */
  onUpdate: () => void = () => undefined

  /** Carpeta de la pieza instalada, si es la de esta versión y está entera. */
  async ready(): Promise<string | null> {
    if (this.installed !== PIECE.version) return null
    const dir = this.inside(PIECE.version)
    try {
      const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8')) as { piece?: unknown; version?: unknown }
      return manifest.piece === 'office' && manifest.version === PIECE.version ? dir : null
    } catch {
      return null
    }
  }

  /** Lo que sabe la pieza; si Molino se pone en Windows lo añade ipc.ts. */
  async status(): Promise<Omit<OfficeStatus, 'shell'>> {
    const installed = (await this.ready()) !== null
    let freeDisk = 0
    try {
      // Sin crear la carpeta solo por mirar: si aún no existe, el disco de la de arriba.
      const info = await statfs(existsSync(this.root) ? this.root : dirname(this.root))
      freeDisk = info.bavail * info.bsize
    } catch {
      freeDisk = 0
    }
    return {
      available: this.offered,
      installed,
      update: !installed && this.installed !== null && this.installed !== PIECE.version,
      size: PIECE.size,
      unpacked: PIECE.unpacked,
      freeDisk,
      busy: this.running !== null
    }
  }

  /** Descarga e instala la pieza (si ya se está haciendo, espera a eso). Falla con OfficeError. */
  install(): Promise<void> {
    if (!this.offered) return Promise.reject(new OfficeError('network'))
    if (!this.running) {
      this.running = this.doInstall().finally(() => {
        this.running = null
        this.abort = null
        this.onProgress(null)
      })
    }
    return this.running
  }

  cancel(): void {
    this.abort?.()
  }

  private async doInstall(): Promise<void> {
    try {
      if (await this.ready()) return
      const partial = this.partialDir()
      await mkdir(partial, { recursive: true })
      const zip = join(partial, `${PIECE.sha256}.zip`)
      const downloaded = await matchesPinned(zip, PIECE)
      const info = await statfs(partial)
      const needed = (downloaded ? 0 : PIECE.size) + PIECE.unpacked + DISK_MARGIN
      if (info.bavail * info.bsize < needed) throw new OfficeError('disk')
      if (!downloaded) {
        await rm(zip, { force: true })
        await downloadPinned(PIECE, join(partial, `${PIECE.sha256}.part`), zip, {
          session: downloadSession(),
          allowed: isOfficeHost,
          progress: (bytes) => this.onProgress({ phase: 'download', done: bytes, total: PIECE.size }),
          onAbort: (abort) => {
            this.abort = abort
          }
        })
      }
      await this.unpack(zip)
      // La anterior, la descarga y los restos ya no hacen falta.
      await rm(partial, { recursive: true, force: true })
      await this.tidy()
      log.info(`oficina: pieza ${PIECE.version} instalada`)
      this.onChange()
    } catch (error) {
      const reason = failureOf(error)
      if (reason !== 'cancelled') log.warn(`oficina: no se pudo añadir (${reason}${error instanceof Error && !(error instanceof OfficeError) ? `: ${error.message.slice(0, 200)}` : ''})`)
      throw error instanceof OfficeError ? error : new OfficeError(reason)
    }
  }

  /** Descomprime en una carpeta aparte y, entera y comprobada, la pasa a su sitio. */
  private async unpack(zip: string): Promise<void> {
    const controller = new AbortController()
    this.abort = () => controller.abort()
    const unpacking = this.inside('.partial', `${PIECE.version}-${randomBytes(4).toString('hex')}`)
    await mkdir(unpacking)
    try {
      await unzip(zip, unpacking, { files: PIECE.files, bytes: PIECE.unpacked }, (files) => {
        this.onProgress({ phase: 'install', done: files, total: PIECE.files })
      }, controller.signal)
      const manifest = JSON.parse(await readFile(join(unpacking, 'manifest.json'), 'utf8')) as { piece?: unknown; version?: unknown }
      if (manifest.piece !== 'office' || manifest.version !== PIECE.version) throw new UnzipError('la pieza no es la esperada')
      const target = this.inside(PIECE.version)
      await rm(target, { recursive: true, force: true })
      await rename(unpacking, target)
    } catch (error) {
      await rm(unpacking, { recursive: true, force: true }).catch(() => undefined)
      if (controller.signal.aborted) throw new OfficeError('cancelled')
      // Un zip con la huella buena que no se descomprime bien no se vuelve a usar.
      if (error instanceof UnzipError) await rm(zip, { force: true })
      throw error
    } finally {
      this.abort = null
    }
    this.installed = PIECE.version
    await this.saveInstalled()
  }

  private async saveInstalled(): Promise<void> {
    const temp = join(this.root, 'installed.json.tmp')
    await writeFile(temp, JSON.stringify({ version: this.installed }, null, 2), 'utf8')
    await rename(temp, join(this.root, 'installed.json'))
  }

  /** Quita lo que no sea la versión instalada (versiones anteriores, carpetas sueltas). */
  private async tidy(): Promise<void> {
    for (const name of await readdir(this.root).catch(() => [] as string[])) {
      // fonts: el índice de fuentes de los editores (officefonts.ts), que se rehace
      // solo; own-fonts: las instaladas solo en Molino (fontcatalog.ts).
      if (['installed.json', '.partial', 'fonts', 'own-fonts', this.installed].includes(name)) continue
      await rm(this.inside(name), { recursive: true, force: true }).catch(() => log.warn('oficina: no se pudo borrar una versión anterior'))
    }
  }

  /** Quita la pieza entera (si se estaba instalando, primero lo cancela). */
  async remove(): Promise<void> {
    if (this.running) {
      this.cancel()
      await this.running.catch(() => undefined)
    }
    this.installed = null
    if (existsSync(this.root)) await rm(this.root, { recursive: true, force: true })
    log.info('oficina: pieza quitada')
    this.onChange()
  }
}
