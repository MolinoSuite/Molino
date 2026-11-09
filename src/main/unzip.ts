import { createReadStream, createWriteStream } from 'node:fs'
import { type FileHandle, mkdir, open } from 'node:fs/promises'
import { dirname, relative, resolve, sep } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { crc32, createInflateRaw } from 'node:zlib'

/**
 * Descomprime un zip en una carpeta, sin programas de fuera (el tar de Windows
 * tarda más de veinte minutos con los 3.246 archivos del motor de oficina).
 *
 * Se usa con archivos cuya huella ya se ha comprobado (office.ts), así que todo
 * lo de aquí es defensa en profundidad (OWASP A08:2025). Se rechaza el zip
 * entero si:
 * - una entrada sale de la carpeta («..», rutas absolutas, unidades, barras
 *   invertidas) o tiene un nombre con caracteres raros;
 * - está cifrado, usa zip64 o un método que no sea guardar o deflate;
 * - el número de archivos o los bytes descomprimidos no son los anunciados
 *   (nunca se escribe más de eso: no llena el disco);
 * - el contenido de un archivo no cuadra con su CRC-32 o su tamaño.
 */

export class UnzipError extends Error {}

interface Entry {
  name: string
  method: number
  crc: number
  compressed: number
  size: number
  offset: number
}

export interface UnzipLimits {
  /** Archivos que tiene que haber exactamente. */
  files: number
  /** Bytes descomprimidos que tiene que haber exactamente. */
  bytes: number
}

const EOCD = 0x06054b50
const CENTRAL = 0x02014b50
const LOCAL = 0x04034b50
const SAFE_PART = /^[\w@{}()+,.=~ -]+$/
/** Archivos que se escriben a la vez: el antivirus revisa cada uno al cerrarlo y así se solapa. */
const PARALLEL = 4

async function readAt(handle: FileHandle, position: number, length: number): Promise<Buffer> {
  const buffer = Buffer.alloc(length)
  const { bytesRead } = await handle.read(buffer, 0, length, position)
  if (bytesRead !== length) throw new UnzipError('zip cortado')
  return buffer
}

/** Lee el directorio central y comprueba cada entrada. */
async function readEntries(handle: FileHandle): Promise<Entry[]> {
  const { size } = await handle.stat()
  const tailLength = Math.min(size, 22 + 0xffff)
  const tail = await readAt(handle, size - tailLength, tailLength)
  let at = -1
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tail.readUInt32LE(i) === EOCD) {
      at = i
      break
    }
  }
  if (at < 0) throw new UnzipError('no es un zip')
  const count = tail.readUInt16LE(at + 10)
  const cdSize = tail.readUInt32LE(at + 12)
  const cdOffset = tail.readUInt32LE(at + 16)
  if (count === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) throw new UnzipError('zip64 no admitido')
  if (cdOffset + cdSize > size) throw new UnzipError('directorio fuera del zip')
  const cd = await readAt(handle, cdOffset, cdSize)
  const list: Entry[] = []
  let p = 0
  for (let i = 0; i < count; i++) {
    if (p + 46 > cd.length || cd.readUInt32LE(p) !== CENTRAL) throw new UnzipError('directorio central dañado')
    const flags = cd.readUInt16LE(p + 8)
    const nameLength = cd.readUInt16LE(p + 28)
    const extraLength = cd.readUInt16LE(p + 30)
    const commentLength = cd.readUInt16LE(p + 32)
    const entry: Entry = {
      name: cd.toString('utf8', p + 46, p + 46 + nameLength),
      method: cd.readUInt16LE(p + 10),
      crc: cd.readUInt32LE(p + 16),
      compressed: cd.readUInt32LE(p + 20),
      size: cd.readUInt32LE(p + 24),
      offset: cd.readUInt32LE(p + 42)
    }
    if (flags & 0x1) throw new UnzipError('zip cifrado')
    if (entry.method !== 0 && entry.method !== 8) throw new UnzipError('método no admitido')
    if (entry.compressed === 0xffffffff || entry.size === 0xffffffff || entry.offset === 0xffffffff) throw new UnzipError('zip64 no admitido')
    if (entry.offset + entry.compressed > size) throw new UnzipError('entrada fuera del zip')
    checkName(entry.name)
    list.push(entry)
    p += 46 + nameLength + extraLength + commentLength
  }
  return list
}

/** Solo rutas relativas con «/», sin «.» ni «..» y con caracteres conocidos. */
function checkName(name: string): void {
  const parts = (name.endsWith('/') ? name.slice(0, -1) : name).split('/')
  const bad = (part: string): boolean => part === '.' || part === '..' || !SAFE_PART.test(part) || part.endsWith('.') || part.endsWith(' ')
  if (name.length > 200 || parts.some(bad)) throw new UnzipError('nombre no admitido en el zip')
}

/**
 * Descomprime ``zip`` en ``dest`` (que debe existir y estar vacía). ``progress``
 * recibe los archivos ya escritos. Con ``signal`` se puede cortar a medias:
 * quien llama borra entonces ``dest``.
 */
export async function unzip(
  zip: string,
  dest: string,
  limits: UnzipLimits,
  progress: (files: number) => void,
  signal?: AbortSignal
): Promise<void> {
  const handle = await open(zip, 'r')
  try {
    const files = (await readEntries(handle)).filter((e) => !e.name.endsWith('/'))
    if (files.length !== limits.files) throw new UnzipError(`el zip trae ${files.length} archivos en vez de ${limits.files}`)
    if (files.reduce((sum, e) => sum + e.size, 0) !== limits.bytes) throw new UnzipError('el zip no ocupa lo anunciado')
    const root = resolve(dest)
    const seen = new Set<string>()
    const targets = files.map((entry) => {
      const full = resolve(root, ...entry.name.split('/'))
      const rel = relative(root, full)
      if (rel === '' || rel.startsWith('..') || rel.includes(`..${sep}`)) throw new UnzipError('ruta fuera de la carpeta')
      // Windows no distingue mayúsculas: dos entradas que solo se diferencian en eso, fuera.
      const key = rel.toLowerCase()
      if (seen.has(key)) throw new UnzipError('entrada repetida en el zip')
      seen.add(key)
      return { entry, full }
    })
    let done = 0
    // Al primer fallo paran todos, y no se vuelve hasta que han parado: quien
    // llama borra la carpeta y nadie debe seguir escribiendo en ella.
    let failure: unknown = null
    const worker = async (): Promise<void> => {
      for (let next = targets.shift(); next && failure === null; next = targets.shift()) {
        try {
          if (signal?.aborted) throw new UnzipError('cancelado')
          await mkdir(dirname(next.full), { recursive: true })
          await extractOne(handle, zip, next.entry, next.full, signal)
          progress(++done)
        } catch (error) {
          failure ??= error
        }
      }
    }
    await Promise.all(Array.from({ length: PARALLEL }, worker))
    if (failure !== null) throw failure
  } finally {
    await handle.close()
  }
}

async function extractOne(handle: FileHandle, zip: string, entry: Entry, out: string, signal?: AbortSignal): Promise<void> {
  const header = await readAt(handle, entry.offset, 30)
  if (header.readUInt32LE(0) !== LOCAL) throw new UnzipError('cabecera local dañada')
  const start = entry.offset + 30 + header.readUInt16LE(26) + header.readUInt16LE(28)
  let written = 0
  let crc = 0
  const meter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      written += chunk.length
      if (written > entry.size) return callback(new UnzipError('un archivo ocupa más de lo anunciado'))
      crc = crc32(chunk, crc)
      callback(null, chunk)
    }
  })
  // createReadStream no admite un intervalo vacío (archivos guardados de cero bytes).
  const source = entry.compressed > 0 ? createReadStream(zip, { start, end: start + entry.compressed - 1 }) : Readable.from([])
  // «wx»: nunca se escribe encima de algo que ya esté.
  const sink = createWriteStream(out, { flags: 'wx' })
  if (entry.method === 8) await pipeline(source, createInflateRaw(), meter, sink, { signal })
  else await pipeline(source, meter, sink, { signal })
  if (written !== entry.size || crc >>> 0 !== entry.crc) throw new UnzipError('un archivo no cuadra con su CRC')
}
