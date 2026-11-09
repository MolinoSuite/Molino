import { execFile } from 'node:child_process'
import { join } from 'node:path'

/**
 * El registro de Windows, con reg.exe: ruta absoluta del sistema y argumentos
 * fijos, sin intérprete de órdenes (nada de lo que llega se interpreta como
 * orden). Los datos van como argumentos de Windows (Unicode), así que se
 * escriben bien aunque lleven letras como «é»; al leer, en cambio, reg.exe
 * escribe en la página de códigos de la consola: lo leído solo se compara con
 * textos sin esas letras o con lo que el propio Molino escribió.
 */

const REG_EXE = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'reg.exe')

function reg(args: string[]): Promise<{ ok: boolean; stdout: string }> {
  return new Promise((resolve) => {
    execFile(REG_EXE, args, { windowsHide: true, timeout: 5000 }, (error, stdout) => resolve({ ok: !error, stdout: String(stdout ?? '') }))
  })
}

/** Saca de la salida de «reg query» el texto del valor con ese nombre (null si no está). */
export function parseRegValue(stdout: string, value: string): string | null {
  // «    ProgId    REG_SZ    Acrobat.Document.DC». Se busca el valor por su
  // nombre: el predeterminado de una clave sin él sale como «(valor no
  // establecido)», traducido, y se confundía con un dato de verdad.
  const name = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`^\\s*${name}\\s+REG_SZ\\s+(.+?)\\s*$`, 'im').exec(stdout)
  return match ? match[1].trim() : null
}

/** Lee un valor de texto. Devuelve null si no existe o no se puede leer. */
export async function regQuery(key: string, value: string): Promise<string | null> {
  const { ok, stdout } = await reg(['query', key, '/v', value])
  return ok ? parseRegValue(stdout, value) : null
}

/**
 * El valor predeterminado de una clave, tal cual lo da reg.exe (null si la
 * clave no existe). Sin valor puesto, reg.exe da un texto traducido: solo
 * sirve para comparar con lo que se espera.
 */
export async function regDefault(key: string): Promise<string | null> {
  const { ok, stdout } = await reg(['query', key, '/ve'])
  if (!ok) return null
  const match = /^\s+\S.*?\s+REG_SZ\s+(.*?)\s*$/m.exec(stdout)
  return match ? match[1] : null
}

/** Escribe un valor de texto (``name`` null: el predeterminado de la clave). */
export async function regSet(key: string, name: string | null, data: string): Promise<boolean> {
  const which = name === null ? ['/ve'] : ['/v', name]
  return (await reg(['add', key, ...which, '/t', 'REG_SZ', '/d', data, '/f'])).ok
}

/** Borra una clave entera o, con ``name``, solo ese valor. No es un error que no esté. */
export async function regDelete(key: string, name?: string): Promise<void> {
  await reg(['delete', key, ...(name === undefined ? [] : ['/v', name]), '/f'])
}
