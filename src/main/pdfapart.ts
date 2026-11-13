import { execFile } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { shell } from 'electron'
import { PDF_FAMILY, separatePdfData } from './appx'
import { log } from './log'

/**
 * Molino Suite ya incluye Molino PDF. Si el usuario tenía instalada aparte la
 * app Molino PDF, la suite trae sus datos al abrirse por primera vez
 * (migrate.ts) y el inicio le avisa de que puede quitarla, con un botón que lo
 * hace: Windows desinstala ese paquete del usuario (no hace falta ser
 * administrador). Si no se deja, se abre su página en Configuración de Windows,
 * con el botón «Desinstalar».
 *
 * Solo se toca el paquete de Molino PDF del mismo editor (por su familia, que
 * lleva la huella del editor), y solo cuando el usuario lo pide.
 */

/** Marca de que ya se avisó al abrir (después el aviso queda en el inicio). */
const NOTICE_MARKER = 'aviso-molino-pdf.json'

/** ¿Está Molino PDF instalado aparte? (solo lo mira Molino Suite). */
export function separatePdfInstalled(): boolean {
  return separatePdfData() !== null
}

/** La primera vez que se ve: true (y queda anotado); las demás, false. */
export function firstPdfNotice(userData: string): boolean {
  if (!separatePdfInstalled()) return false
  const marker = join(userData, NOTICE_MARKER)
  if (existsSync(marker)) return false
  try {
    writeFileSync(marker, JSON.stringify({ at: new Date().toISOString() }))
  } catch {
    // sin marca: se volverá a avisar la próxima vez
  }
  return true
}

function powershell(): string {
  return join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
}

/**
 * Desinstala Molino PDF (el paquete aparte). «removed» si ya no está;
 * «settings» si no se pudo y se ha abierto su página en Configuración.
 */
export async function removeSeparatePdf(): Promise<'removed' | 'settings'> {
  const script = [
    `$p = Get-AppxPackage | Where-Object { $_.PackageFamilyName -eq '${PDF_FAMILY}' }`,
    `if ($p) { $p | Remove-AppxPackage -ErrorAction Stop }`,
    `if (Get-AppxPackage | Where-Object { $_.PackageFamilyName -eq '${PDF_FAMILY}' }) { exit 3 }`
  ].join('; ')
  const ok = await new Promise<boolean>((done) => {
    execFile(
      powershell(),
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true, timeout: 180_000 },
      (error) => done(!error)
    )
  })
  if (ok && !separatePdfInstalled()) {
    log.info('molino pdf aparte: desinstalado')
    return 'removed'
  }
  log.warn('molino pdf aparte: no se pudo desinstalar; se abre Configuración')
  await shell.openExternal(`ms-settings:appsfeatures-app?${PDF_FAMILY}`).catch(() => shell.openExternal('ms-settings:appsfeatures'))
  return 'settings'
}
