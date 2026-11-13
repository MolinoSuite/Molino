import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream, type WriteStream } from 'node:fs'
import { rename, rm, stat } from 'node:fs/promises'
import { net, type Session, session } from 'electron'
import { log } from './log'

/**
 * Descargas de archivos fijados: los modelos de IA (aimodels.ts) y el motor de
 * oficina (office.ts).
 *
 * Seguridad de la cadena de suministro (OWASP A03:2025):
 * - Cada archivo viene con su dirección, su tamaño exacto y su huella SHA-256,
 *   escritos en el código de ESTA versión de Molino. Nada viene de un catálogo
 *   remoto.
 * - Cada descarga usa una sesión de red propia que solo deja pasar los
 *   servidores permitidos, y cada redirección se comprueba una a una.
 * - Un archivo no pasa a su sitio hasta que su tamaño y su huella coinciden; si
 *   no, se borra. Nunca se escribe más de lo anunciado.
 */

export type DownloadFailure = 'disk' | 'integrity' | 'network' | 'cancelled' | 'restart'

export class DownloadError extends Error {
  constructor(readonly reason: DownloadFailure) {
    super(reason)
  }
}

export interface PinnedFile {
  url: string
  size: number
  sha256: string
}

export interface DownloadOptions {
  session: Session
  /** ¿Se puede pedir esta dirección? (también tras cada redirección). */
  allowed: (url: string) => boolean
  progress: (bytes: number) => void
  /** Recibe la función que corta la descarga en curso, o null cuando acaba. */
  onAbort: (abort: (() => void) | null) => void
}

const MAX_REDIRECTS = 5

/**
 * Sesión de red en memoria que solo deja pasar lo permitido (la principal de
 * Molino lo bloquea todo: security.ts). Sin permisos de ningún tipo.
 */
export function restrictedSession(partition: string, allowed: (url: string) => boolean, label: string): Session {
  const own = session.fromPartition(partition)
  own.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  own.setPermissionCheckHandler(() => false)
  own.webRequest.onBeforeRequest((details, callback) => {
    const ok = allowed(details.url)
    if (!ok) log.warn(`${label}: se bloquea una petición a un servidor no permitido`)
    callback({ cancel: !ok })
  })
  return own
}

/**
 * Descarga un archivo a ``part``, comprobando tamaño y huella mientras llega, y
 * solo entonces lo mueve a ``target``. Si se corta, la próxima vez sigue por
 * donde iba (y vuelve a comprobar lo ya bajado); si el servidor no reanuda,
 * empieza de cero una sola vez.
 */
export async function downloadPinned(file: PinnedFile, part: string, target: string, options: DownloadOptions): Promise<void> {
  let hash = createHash('sha256')
  let have = 0
  try {
    const info = await stat(part)
    if (info.isFile() && info.size < file.size) {
      await new Promise<void>((done, fail) => {
        createReadStream(part)
          .on('data', (chunk) => hash.update(chunk))
          .on('end', () => done())
          .on('error', fail)
      })
      have = info.size
    } else {
      await rm(part, { force: true })
    }
  } catch {
    have = 0
  }
  let received: number
  try {
    received = await fetchInto(file.url, part, have, file.size, hash, options)
  } catch (error) {
    if (!(error instanceof DownloadError && error.reason === 'restart')) throw error
    // El servidor no reanudó: se empieza de cero, una sola vez y con la huella nueva.
    hash = createHash('sha256')
    received = await fetchInto(file.url, part, 0, file.size, hash, options)
  }
  if (received !== file.size || hash.digest('hex') !== file.sha256) {
    await rm(part, { force: true })
    throw new DownloadError('integrity')
  }
  await rename(part, target)
}

function fetchInto(
  url: string,
  part: string,
  offset: number,
  size: number,
  hash: ReturnType<typeof createHash>,
  options: DownloadOptions
): Promise<number> {
  return new Promise((done, fail) => {
    let hops = 0
    let finished = false
    // El archivo a medio bajar: se cierra también al cancelar (lo bajado se queda para seguir).
    let out: WriteStream | null = null
    const finish = (error: Error | null, value = 0): void => {
      if (finished) return
      finished = true
      options.onAbort(null)
      if (error) fail(error)
      else done(value)
    }
    if (!options.allowed(url)) return finish(new DownloadError('network'))
    const request = net.request({ url, session: options.session, redirect: 'manual', useSessionCookies: false, credentials: 'omit' })
    if (offset > 0) request.setHeader('Range', `bytes=${offset}-`)
    options.onAbort(() => {
      request.abort()
      out?.end()
      finish(new DownloadError('cancelled'))
    })
    request.on('redirect', (_status, _method, redirectUrl) => {
      hops++
      // Cada salto se comprueba: solo los servidores permitidos.
      if (hops > MAX_REDIRECTS || !options.allowed(redirectUrl)) {
        request.abort()
        finish(new DownloadError('network'))
        return
      }
      request.followRedirect()
    })
    request.on('response', (response) => {
      const resumed = response.statusCode === 206
      if (response.statusCode !== 200 && !resumed) {
        response.on('data', () => undefined)
        finish(new DownloadError('network'))
        return
      }
      // Sin reanudación (200 en vez de 206) y con una parte ya bajada, la huella
      // ya no sirve: se corta con 'restart' y quien llama empieza de cero.
      let written = resumed ? offset : 0
      if (!resumed && offset > 0) {
        request.abort()
        finish(new DownloadError('restart'))
        return
      }
      const file = createWriteStream(part, { flags: resumed ? 'a' : 'w' })
      out = file
      response.on('data', (chunk: Buffer) => {
        if (finished) return
        written += chunk.length
        // Nunca más de lo anunciado (no llenar el disco).
        if (written > size) {
          request.abort()
          file.destroy()
          finish(new DownloadError('integrity'))
          return
        }
        hash.update(chunk)
        file.write(chunk)
        options.progress(written)
      })
      response.on('end', () => file.end(() => finish(null, written)))
      response.on('error', (error) => {
        file.destroy()
        finish(error)
      })
    })
    request.on('error', (error) => finish(error))
    request.end()
  })
}

export function sha256Of(path: string): Promise<string> {
  return new Promise((done, fail) => {
    const hash = createHash('sha256')
    createReadStream(path)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => done(hash.digest('hex')))
      .on('error', fail)
  })
}

/** ¿El archivo que hay ya es el bueno? (tamaño y huella). */
export async function matchesPinned(path: string, file: { size: number; sha256: string }): Promise<boolean> {
  try {
    const info = await stat(path)
    if (!info.isFile() || info.size !== file.size) return false
    return (await sha256Of(path)) === file.sha256
  } catch {
    return false
  }
}
