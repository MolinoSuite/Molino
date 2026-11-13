import { app, type Session, shell } from 'electron'
import type { UpdateStatus } from '@shared/types'
import { storePackageFamily } from './appx'
import { restrictedSession } from './download'
import { edition } from './edition'
import { L } from './i18n'
import { log } from './log'

/**
 * Versiones nuevas. Molino se instala desde la Microsoft Store, que lo actualiza
 * sola; aquí solo se avisa antes.
 *
 * Al abrir Molino (si el usuario no lo ha desactivado) se mira en GitHub la
 * última versión publicada de este producto: Molino PDF (etiquetas vX.Y.Z) o
 * Molino Suite (suite-vX.Y.Z). La versión de GitHub se publica cuando la Store
 * ya la tiene (scripts/release.mjs). Si es más nueva, se avisa, y «Actualizar»
 * abre la página de Molino en la Store, donde está su botón de actualizar.
 *
 * Solo se habla con api.github.com por HTTPS (la sesión de red corta cualquier
 * otra petición) y de la respuesta solo se usan las etiquetas, validadas.
 */

const RELEASES = 'https://api.github.com/repos/MolinoSuite/Molino/releases?per_page=30'
const TAG: Record<'pdf' | 'suite', RegExp> = {
  pdf: /^v(\d{1,4}\.\d{1,4}\.\d{1,6})$/,
  suite: /^suite-v(\d{1,4}\.\d{1,4}\.\d{1,6})$/
}
const MAX_BYTES = 2 * 1024 * 1024

/** Peticiones de versiones: solo HTTPS a la API de GitHub (y, sin empaquetar, la dirección de prueba). */
export function isUpdateUrl(raw: string, testOrigin: string | null): boolean {
  try {
    const url = new URL(raw)
    if (testOrigin !== null && url.origin === testOrigin) return true
    return url.protocol === 'https:' && url.username === '' && url.password === '' && url.port === '' && url.hostname === 'api.github.com'
  } catch {
    return false
  }
}

/** Solo pruebas, sin empaquetar: un servidor local que hace de GitHub. */
function testFeed(raw: string | undefined): string | null {
  if (app.isPackaged || !raw) return null
  try {
    const url = new URL(raw)
    return url.protocol === 'http:' && url.hostname === '127.0.0.1' ? url.origin : null
  } catch {
    return null
  }
}

/** a > b, con versiones «x.y.z» ya validadas. */
export function newer(a: string, b: string): boolean {
  const x = a.split('.').map(Number)
  const y = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0)
  return false
}

/** La versión más nueva de este producto entre las publicadas (sin borradores ni versiones de prueba). */
export function latestOf(releases: unknown, product: 'pdf' | 'suite'): string | null {
  if (!Array.isArray(releases)) return null
  let best: string | null = null
  for (const release of releases.slice(0, 100)) {
    if (typeof release !== 'object' || release === null) continue
    const { tag_name: tag, draft, prerelease } = release as { tag_name?: unknown; draft?: unknown; prerelease?: unknown }
    if (draft === true || prerelease === true || typeof tag !== 'string') continue
    const version = TAG[product].exec(tag)?.[1]
    if (version && (best === null || newer(version, best))) best = version
  }
  return best
}

export class Updates {
  private status: UpdateStatus
  private readonly feed: string | null
  private readonly active: boolean
  private session: Session | null = null
  private manual = false

  constructor(private readonly notify: (status: UpdateStatus) => void) {
    this.feed = testFeed(process.env.MOLINO_TEST_UPDATES)
    this.active = app.isPackaged || this.feed !== null
    this.status = { state: this.active ? 'idle' : 'unavailable' }
  }

  private set(status: UpdateStatus): void {
    this.status = status
    this.notify(status)
  }

  current(): UpdateStatus {
    return this.status
  }

  /** Mira si hay versión nueva. ``manual``: lo ha pedido el usuario (se le dice también si no la hay o si falla). */
  check(manual: boolean): void {
    if (!this.active || this.status.state === 'checking') return
    this.manual = manual
    this.set({ state: 'checking' })
    void this.fetchLatest().then(
      (latest) => {
        if (latest && newer(latest, app.getVersion())) this.set({ state: 'available', version: latest })
        else this.set({ state: this.manual ? 'current' : 'idle' })
      },
      (error: unknown) => {
        log.warn(`actualizaciones: no se pudo mirar (${error instanceof Error ? error.name : '?'})`)
        // Una comprobación automática que falla (sin conexión, por ejemplo) no molesta.
        this.set(this.manual ? { state: 'error', message: L.main.updates.checkFailed } : { state: 'idle' })
      }
    )
  }

  private async fetchLatest(): Promise<string | null> {
    this.session ??= restrictedSession('molino-updates', (url) => isUpdateUrl(url, this.feed), 'actualizaciones')
    const url = this.feed ? `${this.feed}/releases` : RELEASES
    const response = await this.session.fetch(url, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Molino' },
      redirect: 'error',
      signal: AbortSignal.timeout(20_000)
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const text = await response.text()
    if (text.length > MAX_BYTES) throw new Error('respuesta demasiado grande')
    return latestOf(JSON.parse(text), edition)
  }

  /** «Actualizar»: abre la página de Molino en la Microsoft Store (allí se actualiza). */
  async openStore(): Promise<boolean> {
    const family = storePackageFamily()
    if (!family) {
      log.info('actualizaciones: se abriría la Microsoft Store (sin empaquetar)')
      return true
    }
    try {
      await shell.openExternal(`ms-windows-store://pdp/?PFN=${encodeURIComponent(family)}`)
      return true
    } catch {
      log.warn('actualizaciones: no se pudo abrir la Microsoft Store')
      return false
    }
  }
}
