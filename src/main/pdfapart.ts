import { execFile } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { shell } from 'electron'
import { PDF_FAMILY, separatePdfData } from './appx'
import { log } from './log'

/**
 * Molino Suite ya incluye Molino PDF. Si el usuario tenía instalada aparte la
 * app Molino PDF, la suite, al abrirse por primera vez, trae sus datos
 * (migrate.ts: ajustes, recientes, firmas; ipc.ts: la IA) y después la
 * desinstala sola, para que no haya dos «Molino PDF» en el menú Inicio:
 * Windows quita ese paquete del usuario (no hace falta ser administrador). Si
 * esa app está abierta, se espera a la próxima vez (no se cierra nada con
 * trabajo sin guardar); si Windows no deja, el inicio avisa con un botón para
 * hacerlo, y si tampoco, se abre su página en Configuración de Windows.
 *
 * Solo se toca el paquete de Molino PDF del mismo editor (por su familia, que
 * lleva la huella del editor).
 */

/** Marca de que ya se avisó al abrir (después el aviso queda en el inicio). */
const NOTICE_MARKER = 'aviso-molino-pdf.json'
/** Marca de que ya se intentó quitarlo solo (se intenta una vez; después, el aviso). */
const RETIRE_MARKER = 'retiro-molino-pdf.json'
/** La de migrate.ts: la suite trajo los datos de ese Molino PDF. */
const IMPORTED_MARKER = 'desde-molino-pdf.json'

/** ¿Está Molino PDF instalado aparte? (solo lo mira Molino Suite). */
export function separatePdfInstalled(): boolean {
  return separatePdfData() !== null
}

/** ¿La suite ya trajo los datos de ese Molino PDF? */
export function separatePdfImported(userData: string): boolean {
  return existsSync(join(userData, IMPORTED_MARKER))
}

/** ¿Toca quitarlo solo? Si está, si ya se trajeron sus datos y si no se ha intentado antes. */
export function shouldRetireSeparatePdf(userData: string): boolean {
  return separatePdfInstalled() && separatePdfImported(userData) && !existsSync(join(userData, RETIRE_MARKER))
}

/** Anota que ya se intentó (lo que haya pasado). */
export function markRetireTried(userData: string, result: string): void {
  try {
    writeFileSync(join(userData, RETIRE_MARKER), JSON.stringify({ at: new Date().toISOString(), result }))
  } catch {
    // sin marca: se volverá a intentar la próxima vez
  }
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

/** Lo que pasó al quitarlo: quitado, abierto (no se toca), o no se pudo. */
export type RetireResult = 'removed' | 'running' | 'failed'

/**
 * Desinstala Molino PDF (el paquete aparte), salvo si está abierto. Solo
 * comprueba el paquete por su familia; no cierra ninguna ventana.
 */
export async function uninstallSeparatePdf(): Promise<RetireResult> {
  const script = [
    `$p = Get-AppxPackage | Where-Object { $_.PackageFamilyName -eq '${PDF_FAMILY}' }`,
    'if (-not $p) { exit 0 }',
    // Abierto: no se quita (Windows lo cerraría y se perdería lo que no esté guardado).
    `$open = Get-Process -Name Molino -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith($p.InstallLocation, [StringComparison]::OrdinalIgnoreCase) }`,
    'if ($open) { exit 4 }',
    '$p | Remove-AppxPackage -ErrorAction Stop',
    `if (Get-AppxPackage | Where-Object { $_.PackageFamilyName -eq '${PDF_FAMILY}' }) { exit 3 }`
  ].join('; ')
  const code = await new Promise<number>((done) => {
    execFile(
      powershell(),
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true, timeout: 180_000 },
      (error) => done(error ? (typeof error.code === 'number' ? error.code : 1) : 0)
    )
  })
  if (code === 4) {
    log.info('molino pdf aparte: abierto; no se desinstala ahora')
    return 'running'
  }
  if (code === 0 && !separatePdfInstalled()) {
    log.info('molino pdf aparte: desinstalado')
    return 'removed'
  }
  log.warn(`molino pdf aparte: no se pudo desinstalar (${code})`)
  return 'failed'
}

/**
 * Lo mismo desde el botón del inicio: si no se pudo, se abre su página en
 * Configuración de Windows («settings»).
 */
export async function removeSeparatePdf(): Promise<'removed' | 'running' | 'settings'> {
  const result = await uninstallSeparatePdf()
  if (result !== 'failed') return result
  await shell.openExternal(`ms-settings:appsfeatures-app?${PDF_FAMILY}`).catch(() => shell.openExternal('ms-settings:appsfeatures'))
  return 'settings'
}
