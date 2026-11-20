import { spawn } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { EngineError } from './engine'
import { L } from './i18n'
import { log } from './log'
import type { ScannerInfo, ScanRequest } from './scanner'

/**
 * Linux: escáneres a través de SANE, con su programa ``scanimage`` (paquete
 * sane-utils o sane-backends). Sirve con los USB que reconoce SANE y con los de
 * red y de las impresoras multifunción (eSCL y WSD, con sane-airscan, que traen
 * las distribuciones de escritorio), sin instalar nada más.
 *
 * Se lanza por su ruta completa, nunca por la que diga el PATH (A08:2025), sin
 * intérprete de órdenes y con los argumentos en una lista: el escáner (con forma
 * comprobada y sin poder pasar por una opción), el origen, el color y la
 * resolución, elegidos entre los que el propio escáner dice que tiene
 * (A05:2025). Con LANG=C, para reconocer en sus mensajes qué le pasa al escáner.
 */

const SCANIMAGE = ['/usr/bin/scanimage', '/bin/scanimage'].find((path) => existsSync(path)) ?? null
const LIST_TIMEOUT_MS = 30_000
const OPTIONS_TIMEOUT_MS = 30_000
const SCAN_TIMEOUT_MS = 15 * 60_000
const MAX_PAGES = 300
const MAX_OUTPUT = 256 * 1024
/** Nombre de un escáner de SANE (``pixma:04A9…``, ``airscan:e0:Canon…``): imprimible y que no empiece por «-». */
export const SANE_DEVICE = /^[\x21-\x2c\x2e-\x7e][\x20-\x7e]{0,299}$/
const PAGE = /^pagina-\d{3}\.png$/

type ScannerText = keyof typeof L.main.scanner

/** Lo que dice SANE (sane_strstatus, en inglés) → texto para el usuario. El primero que aparezca. */
const PROBLEMS: [RegExp, ScannerText][] = [
  [/out of documents/i, 'noPaper'],
  [/jammed/i, 'paperJam'],
  [/cover is open/i, 'coverOpen'],
  [/device busy/i, 'busy'],
  [/lamp not ready/i, 'warmingUp'],
  [/locked for transport/i, 'locked'],
  [/error during device i\/o/i, 'noConnection'],
  [/open of device .* failed|no sane devices found/i, 'notFound']
]

const failure = (text: ScannerText): EngineError => new EngineError({ code: 'scan_failed', message: L.main.scanner[text] })
const cancelled = (): EngineError => new EngineError({ code: 'cancelled', message: L.main.scanner.cancelled })

interface Run {
  out: string
  err: string
  code: number | null
}

function run(args: string[], timeoutMs: number, signal?: AbortSignal): Promise<Run> {
  return new Promise((done, fail) => {
    if (!SCANIMAGE) {
      fail(new Error('sin scanimage'))
      return
    }
    const child = spawn(SCANIMAGE, args, {
      env: { ...process.env, LANG: 'C', LC_ALL: 'C', LANGUAGE: '' },
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let out = ''
    let err = ''
    let finished = false
    // SIGTERM: scanimage cancela el escaneo y suelta el escáner antes de salir.
    const stop = (): void => {
      if (child.exitCode === null) child.kill('SIGTERM')
    }
    const timer = setTimeout(stop, timeoutMs)
    signal?.addEventListener('abort', stop, { once: true })
    // Tope de lo que se guarda: nada que diga el proceso puede llenar la memoria.
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      if (out.length < MAX_OUTPUT) out += chunk
    })
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
      if (err.length < MAX_OUTPUT) err += chunk
    })
    const finish = (): void => {
      finished = true
      clearTimeout(timer)
      signal?.removeEventListener('abort', stop)
    }
    child.on('error', (error) => {
      if (finished) return
      finish()
      fail(error)
    })
    child.on('close', (code) => {
      if (finished) return
      finish()
      done({ out, err, code })
    })
  })
}

/** Los escáneres que ve SANE (también los de red, si está sane-airscan). */
export async function listSaneScanners(): Promise<ScannerInfo[]> {
  let result: Run
  try {
    result = await run(['--formatted-device-list=%d\t%v %m%n'], LIST_TIMEOUT_MS)
  } catch {
    log.warn('escáneres: no está scanimage (sane-utils)')
    return []
  }
  const found: ScannerInfo[] = []
  for (const line of result.out.split('\n')) {
    const [id = '', ...rest] = line.split('\t')
    const name = rest.join(' ').trim().slice(0, 120)
    if (SANE_DEVICE.test(id)) found.push({ id, name: name || L.main.scanner.unnamed })
  }
  if (result.code !== 0) log.warn(`escáneres: scanimage respondió con el código ${result.code}`)
  return found.slice(0, 50)
}

/** Una opción del escáner en ``scanimage -A``: sus valores (lista) o su intervalo (números). */
interface SaneOption {
  values: string[]
  range: [number, number] | null
}

/** Las opciones --source, --mode y --resolution que dice tener el escáner. */
export function parseOptions(text: string): Record<'source' | 'mode' | 'resolution', SaneOption | null> {
  const option = (name: string): SaneOption | null => {
    const line = new RegExp(`^\\s+--${name}(?:=|\\s)(.+?)(?:\\s\\[[^\\]]*\\])?\\s*$`, 'm').exec(text)
    if (!line) return null
    const spec = line[1].trim().replace(/dpi$/i, '')
    const range = /^(\d+(?:\.\d+)?)\.\.(\d+(?:\.\d+)?)/.exec(spec)
    if (range) return { values: [], range: [Number(range[1]), Number(range[2])] }
    return { values: spec.split('|').map((v) => v.trim().replace(/dpi$/i, '')).filter(Boolean).slice(0, 40), range: null }
  }
  return { source: option('source'), mode: option('mode'), resolution: option('resolution') }
}

const SOURCES: Record<ScanRequest['source'], (v: string) => boolean> = {
  flatbed: (v) => /flatbed|platen|glass/i.test(v),
  feeder: (v) => /adf|feeder/i.test(v) && !/duplex|both|back/i.test(v),
  duplex: (v) => /duplex|both/i.test(v)
}
const MODES: Record<ScanRequest['color'], (v: string) => boolean> = {
  color: (v) => /colou?r/i.test(v),
  gray: (v) => /gr[ae]y/i.test(v),
  bw: (v) => /lineart|binary|black|halftone/i.test(v)
}

/** Los argumentos del escaneo: solo valores que el escáner dice tener (si no tiene la opción, la suya). */
export function scanArguments(request: ScanRequest, options: ReturnType<typeof parseOptions>): string[] {
  const args: string[] = []
  const source = options.source?.values.find(SOURCES[request.source])
  if (source) args.push(`--source=${source}`)
  const mode = options.mode?.values.find(MODES[request.color])
  if (mode) args.push(`--mode=${mode}`)
  const resolution = options.resolution
  if (resolution?.range) {
    args.push(`--resolution=${Math.round(Math.min(Math.max(request.dpi, resolution.range[0]), resolution.range[1]))}`)
  } else if (resolution && resolution.values.length > 0) {
    const numbers = resolution.values.map(Number).filter((n) => Number.isFinite(n) && n > 0)
    const closest = numbers.sort((a, b) => Math.abs(a - request.dpi) - Math.abs(b - request.dpi))[0]
    if (closest) args.push(`--resolution=${closest}`)
  }
  return args
}

/** Qué le ha pasado al escáner, por lo que dijo SANE (sin registrarlo: puede nombrar rutas, A09:2025). */
function problemOf(err: string): ScannerText {
  return PROBLEMS.find(([pattern]) => pattern.test(err))?.[1] ?? 'failed'
}

/**
 * Escanea en ``folder`` (carpeta propia, vacía) y devuelve las imágenes, en
 * orden: una del cristal o todas las del alimentador.
 */
export async function scanSanePages(request: ScanRequest, folder: string, signal?: AbortSignal): Promise<string[]> {
  if (!SANE_DEVICE.test(request.device)) throw failure('notFound')
  const own = resolve(folder) + sep
  let options: Run
  try {
    options = await run([`--device-name=${request.device}`, '--all-options'], OPTIONS_TIMEOUT_MS, signal)
  } catch {
    throw failure('failed')
  }
  if (signal?.aborted) throw cancelled()
  if (options.code !== 0) throw failure(problemOf(options.err))
  const chosen = scanArguments(request, parseOptions(options.out))
  const pages =
    request.source === 'flatbed'
      ? ['--format=png', `--output-file=${join(own, 'pagina-001.png')}`]
      : ['--format=png', `--batch=${join(own, 'pagina-%03d.png')}`, `--batch-count=${MAX_PAGES}`]
  const result = await run([`--device-name=${request.device}`, ...chosen, ...pages], SCAN_TIMEOUT_MS, signal)
  if (signal?.aborted) throw cancelled()
  const made = readdirSync(own)
    .filter((name) => PAGE.test(name))
    .sort()
    .map((name) => join(own, name))
  if (made.length === 0 || (result.code !== 0 && request.source === 'flatbed')) {
    const problem = problemOf(result.err)
    log.warn(`escáner: no se pudo escanear (${problem}, código ${result.code})`)
    throw failure(problem)
  }
  return made.slice(0, MAX_PAGES)
}
