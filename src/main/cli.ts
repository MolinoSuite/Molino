import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, isAbsolute, join, parse as parsePath, resolve } from 'node:path'
import { app, BrowserWindow } from 'electron'
import { DEFAULT_LAYOUT } from '@shared/printLayout'
import type { DocDescriptor } from '@shared/types'
import { EngineClient, EngineError } from './engine'
import { productName } from './edition'
import { engineLaunchFor } from './enginelaunch'
import { fmt, initLang, L } from './i18n'
import { initLog, log, quietLog } from './log'
import { bundledPieceDir, OfficePiece } from './office'
import { configureOffice } from './officeconfig'
import { defaultPrinter, PrintService } from './print'
import { serveApp } from './security'
import { Store } from './store'

/**
 * La línea de órdenes de Molino: ``molino convertir carta.docx carta.pdf``,
 * ``molino firmar contrato.pdf -o firmado.pdf --certificado "Juan"``…
 *
 * La lanza el comando ``molino`` (el motor en modo consola, que hace de
 * lanzador: engine/molino_engine/cli.py) como ``Molino.exe --molino-cli …``. Es
 * el mismo Molino sin ventanas: el mismo motor aislado, la misma firma con los
 * certificados de Windows, la misma impresión. Trabaja en su propia carpeta y
 * no toca la de la app si está abierta; los ajustes solo se leen (el servidor
 * de sello de tiempo, el idioma).
 *
 * Salida: lo pedido en la salida estándar (con --json, en JSON); los errores,
 * en la de errores. Códigos: 0 bien, 1 error, 2 la orden está mal escrita,
 * 3 «verificar» encontró firmas que no son válidas (o ninguna).
 */

/** Lo que va después de --molino-cli, o null si Molino no se abrió para eso. */
export function cliArguments(argv: string[]): string[] | null {
  const at = argv.indexOf('--molino-cli')
  return at < 0 ? null : argv.slice(at + 1)
}

class UsageError extends Error {}
class Failure extends Error {}

const COMMANDS: Record<string, string> = {
  ayuda: 'help', help: 'help', '-h': 'help', '--help': 'help', '/?': 'help',
  version: 'version', '--version': 'version', '-v': 'version',
  abrir: 'open', open: 'open',
  convertir: 'convert', convert: 'convert',
  unir: 'merge', merge: 'merge',
  extraer: 'extract', extract: 'extract',
  dividir: 'split', split: 'split',
  girar: 'rotate', rotate: 'rotate',
  'borrar-paginas': 'delete', 'delete-pages': 'delete',
  comprimir: 'compress', compress: 'compress',
  ocr: 'ocr',
  proteger: 'protect', protect: 'protect',
  desproteger: 'unprotect', unprotect: 'unprotect',
  'marca-agua': 'watermark', watermark: 'watermark',
  numerar: 'number', 'page-numbers': 'number',
  limpiar: 'sanitize', sanitize: 'sanitize',
  texto: 'text', text: 'text',
  info: 'info',
  firmar: 'sign', sign: 'sign',
  certificados: 'certificates', certificates: 'certificates',
  verificar: 'verify', verify: 'verify',
  campos: 'fields', fields: 'fields',
  rellenar: 'fill', fill: 'fill',
  imprimir: 'print', print: 'print',
  impresoras: 'printers', printers: 'printers'
}

/** Nombres de opción en inglés (y con tilde) → el nombre de Molino. */
const ALIASES: Record<string, string> = {
  o: 'salida', output: 'salida', y: 'sobrescribir', overwrite: 'sobrescribir',
  pages: 'paginas', 'páginas': 'paginas', password: 'contrasena', 'contraseña': 'contrasena',
  'owner-password': 'contrasena-propietario', 'contraseña-propietario': 'contrasena-propietario',
  every: 'cada', ranges: 'rangos', degrees: 'grados', level: 'nivel', grayscale: 'grises',
  languages: 'idiomas', text: 'texto', position: 'posicion', 'posición': 'posicion', opacity: 'opacidad',
  format: 'formato', start: 'inicio', 'no-print': 'sin-imprimir', 'no-copy': 'sin-copiar', 'no-modify': 'sin-modificar',
  certificate: 'certificado', reason: 'motivo', location: 'lugar', 'no-timestamp': 'sin-sello', 'long-term': 'larga-duracion',
  'larga-duración': 'larga-duracion', page: 'pagina', 'página': 'pagina', area: 'zona', online: 'en-linea', 'en-línea': 'en-linea',
  data: 'datos', dpi: 'ppp', 'certificate-password': 'contrasena-certificado', printer: 'impresora', copies: 'copias', duplex: 'doble-cara', 'password-stdin': 'contrasena-stdin'
}
const FLAGS = new Set([
  'sobrescribir', 'grises', 'json', 'sin-imprimir', 'sin-copiar', 'sin-modificar', 'sin-sello', 'larga-duracion',
  'en-linea', 'doble-cara', 'contrasena-stdin', 'help'
])

interface Parsed {
  command: string
  args: string[]
  options: Map<string, string | true>
}

function parse(argv: string[]): Parsed {
  const [first = 'ayuda', ...rest] = argv
  const command = COMMANDS[first.toLowerCase()]
  if (!command) {
    // Solo archivos: se abren en su app, como un doble clic.
    if (argv.length > 0 && argv.every((a) => !a.startsWith('-') && existsSync(resolve(a)))) return { command: 'open', args: argv, options: new Map() }
    throw new UsageError(fmt(L.cli.unknownCommand, { name: first }))
  }
  const args: string[] = []
  const options = new Map<string, string | true>()
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]
    if (!arg.startsWith('-') || arg === '-') {
      args.push(arg)
      continue
    }
    let name = arg.replace(/^-{1,2}/, '')
    let value: string | undefined
    const eq = name.indexOf('=')
    if (eq > 0) {
      value = name.slice(eq + 1)
      name = name.slice(0, eq)
    }
    name = ALIASES[name.toLowerCase()] ?? name.toLowerCase()
    if (FLAGS.has(name)) options.set(name, true)
    else {
      if (value === undefined) value = rest[++i]
      if (value === undefined) throw new UsageError(fmt(L.cli.missingOption, { name }))
      options.set(name, value)
    }
  }
  return { command, args, options }
}

// ------------------------------------------------------------- salida

const out = (text: string): void => void process.stdout.write(`${text}\n`)
const err = (text: string): void => void process.stderr.write(`${text}\n`)

/** Lee una línea de la entrada estándar (la contraseña que pasa el lanzador). */
function readLine(): Promise<string> {
  return new Promise((done) => {
    let data = ''
    const onData = (chunk: Buffer): void => {
      data += chunk.toString('utf8')
      const nl = data.indexOf('\n')
      if (nl >= 0) {
        process.stdin.off('data', onData)
        process.stdin.pause()
        done(data.slice(0, nl).replace(/\r$/, ''))
      }
    }
    process.stdin.on('data', onData)
    process.stdin.on('end', () => done(data.replace(/\r?\n$/, '')))
    process.stdin.resume()
  })
}

// ------------------------------------------------------------- la sesión

const OFFICE = new Set(['.docx', '.doc', '.docm', '.dotx', '.odt', '.rtf', '.xlsx', '.xls', '.xlsm', '.ods', '.csv', '.pptx', '.ppt', '.pptm', '.ppsx', '.odp'])
const IMAGES = new Set(['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tif', '.tiff', '.webp'])

class Session {
  private engine: EngineClient | null = null
  private piece: OfficePiece | null = null
  private officeReady: Promise<boolean> | null = null
  private printWindow: BrowserWindow | null = null
  printer: PrintService | null = null
  readonly store: Store
  private readonly work: string

  constructor(
    readonly p: Parsed,
    private readonly userData: string
  ) {
    this.store = new Store(userData)
    // Su propia carpeta de trabajo, que se borra al acabar.
    this.work = join(userData, 'cli', `${process.pid}-${randomBytes(4).toString('hex')}`)
  }

  opt(name: string): string | undefined {
    const value = this.p.options.get(name)
    return typeof value === 'string' ? value : undefined
  }
  flag(name: string): boolean {
    return this.p.options.get(name) === true
  }

  async start(): Promise<EngineClient> {
    if (this.engine) return this.engine
    mkdirSync(this.work, { recursive: true })
    const officeBundled = bundledPieceDir()
    this.piece = new OfficePiece(this.userData, officeBundled)
    const folders = { workDir: this.work, modelsRoot: join(this.userData, 'models'), officeRoot: this.piece.root, officeBundled }
    const engine = new EngineClient(() => engineLaunchFor(folders))
    this.engine = engine
    this.printer = new PrintService(engine)
    serveApp(join(__dirname, '../renderer'), (url) => this.printer!.respond(url))
    await engine.start()
    return engine
  }

  async request<T = Record<string, unknown>>(method: string, params: Record<string, unknown>): Promise<T> {
    const engine = await this.start()
    return (await engine.request<T>(method, params, { priority: 9 })).result
  }

  /** El motor de oficina, preparado (solo en Molino Suite). */
  async office(): Promise<void> {
    await this.start()
    this.officeReady ??= configureOffice(this.engine!, this.piece!).then((setup) => setup !== null)
    if (!(await this.officeReady)) throw new Failure(L.cli.officeMissing)
  }

  /** Una ventana oculta: la de las impresoras y, al imprimir, de la que cuelga el trabajo. */
  window(): BrowserWindow {
    this.printWindow ??= new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true } })
    return this.printWindow
  }

  async close(): Promise<void> {
    this.printWindow?.destroy()
    await this.engine?.stop().catch(() => undefined)
    rmSync(this.work, { recursive: true, force: true, maxRetries: 3 })
  }

  // --- archivos

  input(index = 0): string {
    const raw = this.p.args[index]
    if (!raw) throw new UsageError(L.cli.missingInput)
    const path = resolve(raw)
    if (!existsSync(path) || !statSync(path).isFile()) throw new UsageError(fmt(L.cli.notFound, { path: raw }))
    return path
  }

  output(input: string | null, fallbackIndex = 1, folder = false): string {
    const raw = this.opt('salida') ?? this.p.args[fallbackIndex]
    if (!raw) throw new UsageError(L.cli.missingOutput)
    const path = resolve(raw)
    if (!folder) {
      if (input && path.toLowerCase() === input.toLowerCase() && !this.flag('sobrescribir')) throw new UsageError(L.cli.sameFile)
      if (existsSync(path) && !this.flag('sobrescribir') && !(input && path.toLowerCase() === input.toLowerCase())) {
        throw new UsageError(fmt(L.cli.exists, { path: raw }))
      }
      mkdirSync(dirname(path), { recursive: true })
    } else mkdirSync(path, { recursive: true })
    return path
  }

  async openPdf(path: string): Promise<DocDescriptor> {
    try {
      return await this.request<DocDescriptor>('doc.open', { path, ...(this.opt('contrasena') ? { password: this.opt('contrasena') } : {}) })
    } catch (error) {
      if (error instanceof EngineError && /password/.test(error.code)) throw new Failure(L.cli.passwordNeeded)
      throw error
    }
  }

  async save(doc: DocDescriptor, path: string): Promise<void> {
    await this.request('doc.save', { doc: doc.doc, path, force: true })
  }

  /** «1-3,5,8-» → los ids de esas páginas (todas si no se pide ninguna). */
  pages(doc: DocDescriptor, spec = this.opt('paginas')): string[] {
    if (!spec) return doc.pages.map((p) => p.id)
    const count = doc.pages.length
    const out: string[] = []
    for (const part of spec.split(/[,;]/).map((s) => s.trim()).filter(Boolean)) {
      const m = /^(\d+)?\s*(-\s*(\d+)?)?$/.exec(part)
      const from = m?.[1] ? Number(m[1]) : m?.[2] ? 1 : NaN
      const to = m?.[2] ? (m[3] ? Number(m[3]) : count) : from
      if (!m || !Number.isInteger(from) || from < 1 || to > count || to < from) throw new UsageError(fmt(L.cli.badPages, { value: spec, count }))
      for (let n = from; n <= to; n++) out.push(doc.pages[n - 1].id)
    }
    if (out.length === 0) throw new UsageError(fmt(L.cli.badPages, { value: spec, count }))
    return out
  }

  /** Una opción de una lista cerrada (en español o en inglés). */
  choice<T extends string>(name: string, values: Record<string, T>, fallback: T): T {
    const raw = this.opt(name)
    if (raw === undefined) return fallback
    const found = values[raw.toLowerCase()]
    if (!found) throw new UsageError(fmt(L.cli.badOption, { name, value: raw }))
    return found
  }

  number(name: string, fallback: number, min: number, max: number): number {
    const raw = this.opt(name)
    if (raw === undefined) return fallback
    const n = Number(raw.replace(',', '.'))
    if (!Number.isFinite(n) || n < min || n > max) throw new UsageError(fmt(L.cli.badOption, { name, value: raw }))
    return n
  }
}

// ------------------------------------------------------------- órdenes

type Command = (s: Session) => Promise<number>

const pdfOut = async (s: Session, change: (doc: DocDescriptor) => Promise<unknown>): Promise<number> => {
  const input = s.input()
  const output = s.output(input)
  const doc = await s.openPdf(input)
  await change(doc)
  await s.save(doc, output)
  out(fmt(L.cli.done, { path: output }))
  return 0
}

const POSITIONS: Record<string, string> = {
  centro: 'center', center: 'center', arriba: 'top', top: 'top', abajo: 'bottom', bottom: 'bottom', izquierda: 'left', left: 'left', derecha: 'right', right: 'right',
  'arriba-izquierda': 'top-left', 'top-left': 'top-left', 'arriba-derecha': 'top-right', 'top-right': 'top-right',
  'abajo-izquierda': 'bottom-left', 'bottom-left': 'bottom-left', 'abajo-derecha': 'bottom-right', 'bottom-right': 'bottom-right'
}
const NUMBER_POSITIONS: Record<string, string> = {
  'abajo-centro': 'bottom-center', 'bottom-center': 'bottom-center', abajo: 'bottom-center', bottom: 'bottom-center',
  'abajo-izquierda': 'bottom-left', 'bottom-left': 'bottom-left', 'abajo-derecha': 'bottom-right', 'bottom-right': 'bottom-right',
  'arriba-centro': 'top-center', 'top-center': 'top-center', arriba: 'top-center', top: 'top-center',
  'arriba-izquierda': 'top-left', 'top-left': 'top-left', 'arriba-derecha': 'top-right', 'top-right': 'top-right'
}

const TIMESTAMP_URLS: Record<string, string> = {
  digicert: 'http://timestamp.digicert.com',
  globalsign: 'http://timestamp.globalsign.com/tsa/r6advanced1',
  sectigo: 'http://timestamp.sectigo.com'
}

interface Certificate {
  thumbprint: string
  subject: { cn?: string; givenName?: string; surname?: string; serialNumber?: string; organization?: string }
  issuer: { cn?: string }
  notAfter: string
  valid: boolean
  canSign: boolean
  displayName?: string
}
const certName = (c: Certificate): string => c.displayName || c.subject.cn || [c.subject.givenName, c.subject.surname].filter(Boolean).join(' ') || c.thumbprint

const COMMAND_RUNNERS: Record<string, Command> = {
  async help() {
    out(L.cli.usage)
    return 0
  },

  async version() {
    out(`${productName} ${app.getVersion()}`)
    return 0
  },

  async open(s) {
    const files = s.p.args.map((a) => resolve(a))
    for (const file of files) if (!existsSync(file)) throw new UsageError(fmt(L.cli.notFound, { path: file }))
    const args = app.isPackaged ? files : [app.getAppPath(), ...files]
    spawn(process.execPath, args, { detached: true, stdio: 'ignore' }).unref()
    return 0
  },

  async convert(s) {
    // Varias imágenes → un PDF: molino convertir a.jpg b.jpg -o todo.pdf
    const many = s.opt('salida') !== undefined && s.p.args.length > 1
    const inputs = many ? s.p.args.map((_, i) => s.input(i)) : [s.input()]
    const input = inputs[0]
    const from = extname(input).toLowerCase()
    const output = s.output(input)
    const to = extname(output).toLowerCase()
    if (inputs.every((i) => IMAGES.has(extname(i).toLowerCase())) && to === '.pdf') {
      const doc = await s.request<DocDescriptor>('doc.fromImages', { paths: inputs })
      await s.save(doc, output)
    } else if (OFFICE.has(from)) {
      await s.office()
      const { doc } = await s.request<{ doc: string }>('office.open', { path: input })
      try {
        if (to === '.pdf') await s.request('office.exportPdf', { doc, path: output })
        else await s.request('office.save', { doc, path: output, export: true })
      } finally {
        await s.request('office.close', { doc }).catch(() => undefined)
      }
    } else if (from === '.pdf') {
      const doc = await s.openPdf(input)
      if (to === '.docx') await s.request('tools.exportWord', { doc: doc.doc, path: output })
      else if (to === '.txt') await s.request('tools.exportText', { doc: doc.doc, path: output })
      else if (to === '.png' || to === '.jpg' || to === '.jpeg') {
        const folder = dirname(output)
        const before = new Set(readdirSync(folder))
        await s.request('tools.exportImages', {
          doc: doc.doc,
          dir: folder,
          format: to === '.png' ? 'png' : 'jpeg',
          prefix: parsePath(output).name,
          dpi: s.number('ppp', 150, 36, 600),
          ...(s.opt('paginas') ? { pages: s.pages(doc) } : {})
        })
        const made = readdirSync(folder).filter((f) => !before.has(f)).length
        out(fmt(L.cli.doneFolder, { count: made, path: folder }))
        return 0
      } else throw new UsageError(fmt(L.cli.cantConvert, { from, to }))
    } else throw new UsageError(fmt(L.cli.cantConvert, { from: from || '?', to: to || '?' }))
    out(fmt(L.cli.done, { path: output }))
    return 0
  },

  async merge(s) {
    const inputs = s.p.args.map((_, i) => s.input(i))
    if (inputs.length < 2) throw new UsageError(L.cli.missingInput)
    const output = s.output(null, -1)
    const doc = await s.request<DocDescriptor>('doc.merge', { paths: inputs })
    await s.save(doc, output)
    out(fmt(L.cli.done, { path: output }))
    return 0
  },

  async extract(s) {
    const input = s.input()
    const output = s.output(input)
    if (!s.opt('paginas')) throw new UsageError(fmt(L.cli.missingOption, { name: 'paginas' }))
    const doc = await s.openPdf(input)
    await s.request('pages.extract', { doc: doc.doc, pages: s.pages(doc), path: output })
    out(fmt(L.cli.done, { path: output }))
    return 0
  },

  async split(s) {
    const input = s.input()
    const folder = s.output(input, 1, true)
    const doc = await s.openPdf(input)
    const count = doc.pages.length
    const params: Record<string, unknown> = { doc: doc.doc, dir: folder, prefix: parsePath(input).name }
    if (s.opt('rangos')) {
      params.mode = 'ranges'
      params.ranges = s.opt('rangos')!.split(/[,;]/).map((part) => {
        const m = /^\s*(\d+)\s*-\s*(\d+)\s*$/.exec(part) ?? /^\s*(\d+)\s*$/.exec(part)
        const from = m ? Number(m[1]) : NaN
        const to = m ? Number(m[2] ?? m[1]) : NaN
        if (!m || from < 1 || to > count || to < from) throw new UsageError(fmt(L.cli.badPages, { value: s.opt('rangos')!, count }))
        return [from - 1, to - 1]
      })
    } else if (s.opt('cada')) {
      params.mode = 'every'
      params.every = s.number('cada', 1, 1, 100_000)
    } else params.mode = 'each'
    const before = new Set(readdirSync(folder))
    await s.request('pages.split', params)
    out(fmt(L.cli.doneFolder, { count: readdirSync(folder).filter((f) => !before.has(f)).length, path: folder }))
    return 0
  },

  rotate: (s) =>
    pdfOut(s, async (doc) => {
      const angle = s.number('grados', 90, -90, 270)
      if (![90, 180, 270, -90].includes(angle)) throw new UsageError(fmt(L.cli.badOption, { name: 'grados', value: String(angle) }))
      await s.request('pages.rotate', { doc: doc.doc, pages: s.pages(doc), angle })
    }),

  delete: (s) =>
    pdfOut(s, async (doc) => {
      if (!s.opt('paginas')) throw new UsageError(fmt(L.cli.missingOption, { name: 'paginas' }))
      await s.request('pages.delete', { doc: doc.doc, pages: s.pages(doc) })
    }),

  async compress(s) {
    const input = s.input()
    const output = s.output(input)
    const doc = await s.openPdf(input)
    const preset = s.choice('nivel', { ligero: 'light', light: 'light', equilibrado: 'balanced', balanced: 'balanced', fuerte: 'strong', strong: 'strong' }, 'balanced')
    await s.request('tools.optimize', { doc: doc.doc, path: output, preset, grayscale: s.flag('grises') })
    const before = statSync(input).size
    const after = statSync(output).size
    out(`${fmt(L.cli.done, { path: output })} (${Math.round(before / 1024)} KB → ${Math.round(after / 1024)} KB)`)
    return 0
  },

  ocr: (s) =>
    pdfOut(s, async (doc) => {
      const languages = (s.opt('idiomas') ?? 'spa,eng').split(/[,;+ ]+/).filter(Boolean).slice(0, 3)
      await s.request('tools.ocr', { doc: doc.doc, languages, ...(s.opt('paginas') ? { pages: s.pages(doc) } : {}) })
    }),

  async protect(s) {
    const input = s.input()
    const output = s.output(input)
    const user = s.opt('contrasena') ?? ''
    const restricted = s.flag('sin-imprimir') || s.flag('sin-copiar') || s.flag('sin-modificar')
    // Con restricciones, la de propietario la pone el usuario (la necesitará para quitarlas);
    // sin ellas, una al azar: tiene que ser distinta de la de apertura.
    const owner = s.opt('contrasena-propietario') ?? (restricted ? '' : randomBytes(18).toString('base64url'))
    if (!user && !owner) throw new UsageError(fmt(L.cli.missingOption, { name: 'contrasena' }))
    if (!owner) throw new UsageError(fmt(L.cli.missingOption, { name: 'contrasena-propietario' }))
    // La contraseña es la nueva: el PDF de entrada se abre sin ella.
    s.p.options.delete('contrasena')
    const doc = await s.openPdf(input)
    const modify = !s.flag('sin-modificar')
    await s.request('tools.protect', {
      doc: doc.doc,
      userPassword: user,
      ownerPassword: owner,
      permissions: { print: !s.flag('sin-imprimir'), printHq: !s.flag('sin-imprimir'), modify, copy: !s.flag('sin-copiar'), annotate: modify, form: true, assemble: modify, accessibility: true }
    })
    await s.save(doc, output)
    out(fmt(L.cli.done, { path: output }))
    // La de propietario que se ha puesto sola: hace falta para quitar la protección.
    if (!s.opt('contrasena-propietario')) out(fmt(L.cli.ownerPassword, { password: owner }))
    return 0
  },

  unprotect: (s) => pdfOut(s, (doc) => s.request('tools.unprotect', { doc: doc.doc })),

  watermark: (s) =>
    pdfOut(s, async (doc) => {
      const text = s.opt('texto')
      if (!text) throw new UsageError(fmt(L.cli.missingOption, { name: 'texto' }))
      await s.request('tools.watermark', {
        doc: doc.doc,
        text: text.slice(0, 200),
        position: s.choice('posicion', POSITIONS, 'center'),
        opacity: s.number('opacidad', 0.25, 0.05, 1),
        ...(s.opt('paginas') ? { pages: s.pages(doc) } : {})
      })
    }),

  number: (s) =>
    pdfOut(s, (doc) =>
      s.request('tools.pageNumbers', {
        doc: doc.doc,
        format: (s.opt('formato') ?? '{page}').slice(0, 80),
        position: s.choice('posicion', NUMBER_POSITIONS, 'bottom-center'),
        start: s.number('inicio', 1, 0, 100_000),
        ...(s.opt('paginas') ? { pages: s.pages(doc) } : {})
      })
    ),

  sanitize: (s) => pdfOut(s, (doc) => s.request('tools.sanitize', { doc: doc.doc })),

  async text(s) {
    const input = s.input()
    const doc = await s.openPdf(input)
    const { text } = await s.request<{ text: string }>('doc.plainText', { doc: doc.doc, ...(s.opt('paginas') ? { pages: s.pages(doc) } : {}) })
    if (s.opt('salida') || s.p.args[1]) {
      const output = s.output(input)
      writeFileSync(output, text.replace(/\f/g, '\n\n'), 'utf8')
      out(fmt(L.cli.done, { path: output }))
    } else out(text.replace(/\f/g, '\n\n'))
    return 0
  },

  async info(s) {
    const input = s.input()
    const doc = await s.openPdf(input)
    if (s.flag('json')) {
      out(JSON.stringify({ file: input, pages: doc.pages.length, meta: doc.meta, info: doc.info, signed: doc.state.signed }, null, 2))
      return 0
    }
    const I = L.cli.info
    const yes = (v: boolean): string => (v ? I.yes : I.no)
    out(`${basename(input)}`)
    out(`  ${I.pages}: ${doc.pages.length}`)
    if (doc.meta.title) out(`  ${I.title}: ${doc.meta.title}`)
    if (doc.meta.author) out(`  ${I.author}: ${doc.meta.author}`)
    out(`  ${I.protected}: ${yes(doc.info.encrypted)}`)
    out(`  ${I.signed}: ${yes(doc.state.signed)}`)
    return 0
  },

  async certificates(s) {
    const { certificates } = await s.request<{ certificates: Certificate[] }>('sign.certificates', {})
    const usable = certificates.filter((c) => c.canSign)
    if (s.flag('json')) return (out(JSON.stringify(usable, null, 2)), 0)
    if (usable.length === 0) return (out(L.cli.noCertificates), 0)
    for (const c of usable) out(`${c.thumbprint}  ${certName(c)}  (${c.issuer.cn ?? ''}, ${c.notAfter.slice(0, 10)})${c.valid ? '' : ' ✗'}`)
    return 0
  },

  async sign(s) {
    const input = s.input()
    const output = s.output(input)
    let source: Record<string, unknown>
    const pfx = s.opt('pfx')
    if (pfx) {
      const path = resolve(pfx)
      if (!existsSync(path)) throw new UsageError(fmt(L.cli.notFound, { path: pfx }))
      // La del certificado: --contrasena-certificado, o la que pasa el lanzador por la entrada estándar.
      const password = s.opt('contrasena-certificado') ?? (s.flag('contrasena-stdin') ? await readLine() : '')
      source = { type: 'pfx', path, password }
    } else {
      const wanted = s.opt('certificado')
      if (!wanted) throw new UsageError(fmt(L.cli.missingOption, { name: 'certificado' }))
      const { certificates } = await s.request<{ certificates: Certificate[] }>('sign.certificates', {})
      const usable = certificates.filter((c) => c.canSign && c.valid)
      const needle = wanted.replace(/\s+/g, '').toUpperCase()
      let found = usable.filter((c) => c.thumbprint.toUpperCase() === needle)
      if (found.length === 0) found = usable.filter((c) => `${certName(c)} ${c.subject.serialNumber ?? ''}`.toLowerCase().includes(wanted.toLowerCase()))
      if (found.length === 0) throw new Failure(fmt(L.cli.noCertificate, { name: wanted }))
      if (found.length > 1) throw new Failure([fmt(L.cli.manyCertificates, { name: wanted }), ...found.map((c) => `  ${c.thumbprint}  ${certName(c)}`)].join('\n'))
      source = { type: 'store', thumbprint: found[0].thumbprint.toUpperCase() }
    }
    const doc = await s.openPdf(input)
    const settings = s.store.settings
    const stamp = !s.flag('sin-sello')
    const timestampUrl = stamp ? (settings.timestampServer === 'custom' ? settings.timestampUrl.trim() : TIMESTAMP_URLS[settings.timestampServer] ?? TIMESTAMP_URLS.digicert) : ''
    const params: Record<string, unknown> = { doc: doc.doc, source, longTerm: s.flag('larga-duracion') }
    if (timestampUrl) params.timestampUrl = timestampUrl
    if (s.opt('motivo')) params.reason = s.opt('motivo')!.slice(0, 200)
    if (s.opt('lugar')) params.location = s.opt('lugar')!.slice(0, 200)
    if (s.opt('pagina')) {
      const n = s.number('pagina', 1, 1, doc.pages.length)
      params.page = doc.pages[n - 1].id
      const zone = (s.opt('zona') ?? '').split(/[,; ]+/).filter(Boolean).map(Number)
      if (zone.length === 4 && zone.every(Number.isFinite)) params.rect = zone
      else if (s.opt('zona')) throw new UsageError(fmt(L.cli.badOption, { name: 'zona', value: s.opt('zona')! }))
      else params.rect = [36, 36, 236, 106]
    }
    await s.request('sign.sign', params)
    await s.save(doc, output)
    out(fmt(L.cli.signed, { path: output }))
    return 0
  },

  async verify(s) {
    const input = s.input()
    const doc = await s.openPdf(input)
    const { signatures } = await s.request<{ signatures: { field: string; signer: { cn?: string }; signedAt: string | null; summary: 'valid' | 'warning' | 'invalid' | 'unknown'; messages: string[] }[] }>(
      'sign.validate',
      { doc: doc.doc, online: s.flag('en-linea') }
    )
    if (s.flag('json')) out(JSON.stringify(signatures, null, 2))
    else if (signatures.length === 0) out(L.cli.noSignatures)
    else
      for (const sig of signatures) {
        out(`${sig.field}: ${L.cli.status[sig.summary]} · ${sig.signer.cn ?? '?'}${sig.signedAt ? ` · ${sig.signedAt}` : ''}`)
        for (const message of sig.messages) out(`  - ${message}`)
      }
    return signatures.length > 0 && signatures.every((sig) => sig.summary === 'valid') ? 0 : 3
  },

  async fields(s) {
    const input = s.input()
    const doc = await s.openPdf(input)
    const { fields } = await s.request<{ fields: { name: string; type: string; value: unknown; options?: unknown }[] }>('form.fields', { doc: doc.doc })
    if (s.flag('json')) return (out(JSON.stringify(fields.map((f) => ({ name: f.name, type: f.type, value: f.value, options: f.options })), null, 2)), 0)
    if (fields.length === 0) return (out(L.cli.noFields), 0)
    const seen = new Set<string>()
    for (const f of fields) {
      if (seen.has(f.name)) continue
      seen.add(f.name)
      out(`${f.name} (${f.type}) = ${JSON.stringify(f.value)}`)
    }
    return 0
  },

  async fill(s) {
    const input = s.input()
    const output = s.output(input)
    const dataPath = s.opt('datos')
    if (!dataPath) throw new UsageError(fmt(L.cli.missingOption, { name: 'datos' }))
    let data: Record<string, unknown>
    try {
      data = JSON.parse(readFileSync(resolve(dataPath), 'utf8')) as Record<string, unknown>
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('no es un objeto')
    } catch {
      throw new UsageError(fmt(L.cli.badData, { path: dataPath }))
    }
    const doc = await s.openPdf(input)
    const { fields } = await s.request<{ fields: { id: string; page: string; name: string; type: string; export?: string | null }[] }>('form.fields', { doc: doc.doc })
    let count = 0
    for (const [name, raw] of Object.entries(data)) {
      const widgets = fields.filter((f) => f.name === name)
      if (widgets.length === 0) {
        err(fmt(L.cli.unknownField, { name }))
        continue
      }
      for (const w of widgets) {
        let value: unknown = raw
        if (w.type === 'checkbox') value = raw === true || raw === 'true' || raw === 'sí' || raw === 'si' || raw === 'yes' || raw === 1 || raw === w.export
        else if (w.type === 'radio') {
          if (String(raw) !== w.export) continue
          value = true
        } else if (w.type === 'list' && Array.isArray(raw)) value = raw.map(String)
        else value = String(raw ?? '')
        await s.request('form.setValue', { doc: doc.doc, page: w.page, id: w.id, value })
      }
      count++
    }
    await s.save(doc, output)
    out(fmt(L.cli.filled, { count, path: output }))
    return 0
  },

  async printers(s) {
    const [list, preferred] = await Promise.all([s.window().webContents.getPrintersAsync(), defaultPrinter()])
    if (s.flag('json')) return (out(JSON.stringify(list.map((p) => ({ name: p.name, default: p.name === preferred })), null, 2)), 0)
    if (list.length === 0) return (out(L.cli.noPrinters), 0)
    for (const p of list) out(`${p.name === preferred ? '* ' : '  '}${p.name}`)
    return 0
  },

  async print(s) {
    const input = s.input()
    let pdf = input
    if (OFFICE.has(extname(input).toLowerCase())) {
      await s.office()
      const { doc } = await s.request<{ doc: string }>('office.open', { path: input })
      pdf = join(app.getPath('temp'), `molino-imprimir-${randomBytes(6).toString('hex')}.pdf`)
      try {
        await s.request('office.exportPdf', { doc, path: pdf })
      } finally {
        await s.request('office.close', { doc }).catch(() => undefined)
      }
    }
    try {
      const doc = await s.openPdf(pdf)
      const [printers, preferredPrinter] = await Promise.all([s.window().webContents.getPrintersAsync(), defaultPrinter()])
      if (printers.length === 0) throw new Failure(L.cli.noPrinters)
      const wanted = s.opt('impresora')
      const printer = wanted
        ? (printers.find((p) => p.name.toLowerCase() === wanted.toLowerCase()) ?? printers.find((p) => p.name.toLowerCase().includes(wanted.toLowerCase())))
        : (printers.find((p) => p.name === preferredPrinter) ?? printers[0])
      if (!printer) throw new Failure(fmt(L.cli.noPrinter, { name: wanted ?? '' }))
      await s.start()
      await s.printer!.print(s.window(), doc.doc, s.pages(doc), {
        mode: 'molino',
        printer: printer.name,
        copies: s.number('copias', 1, 1, 99),
        color: !s.flag('grises'),
        duplex: s.flag('doble-cara') ? 'longEdge' : 'simplex',
        layout: DEFAULT_LAYOUT
      })
      out(fmt(L.cli.printed, { printer: printer.name }))
    } finally {
      if (pdf !== input) rmSync(pdf, { force: true })
    }
    return 0
  }
}

/** Corre la orden y devuelve el código de salida. */
export async function runCli(argv: string[]): Promise<number> {
  const userData = app.getPath('userData')
  quietLog()
  initLog(join(userData, 'logs', 'cli'))
  let parsed: Parsed
  let session: Session | null = null
  try {
    initLang(new Store(userData).settings.language)
    parsed = parse(argv)
    if (parsed.options.get('help') === true) parsed = { ...parsed, command: 'help' }
    session = new Session(parsed, userData)
    return await COMMAND_RUNNERS[parsed.command](session)
  } catch (error) {
    if (error instanceof UsageError) {
      err(error.message)
      return 2
    }
    const message = error instanceof EngineError || error instanceof Failure ? error.message : L.main.errors.unexpected
    if (!(error instanceof EngineError || error instanceof Failure)) log.warn(`línea de órdenes: ${error instanceof Error ? `${error.name}: ${error.message.slice(0, 300)}` : '?'}`)
    err(fmt(L.cli.failed, { message }))
    return 1
  } finally {
    await session?.close().catch(() => undefined)
  }
}

// Las rutas relativas, desde donde se lanzó (el lanzador lo pasa en MOLINO_CLI_CWD).
if (cliArguments(process.argv) && process.env.MOLINO_CLI_CWD && isAbsolute(process.env.MOLINO_CLI_CWD) && existsSync(process.env.MOLINO_CLI_CWD)) {
  try {
    process.chdir(process.env.MOLINO_CLI_CWD)
  } catch {
    // se queda donde esté
  }
}
