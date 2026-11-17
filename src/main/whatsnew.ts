import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { app, shell } from 'electron'
import type { Lang } from '@shared/i18n'
import type { WhatsNewNotice } from '@shared/types'
import { edition } from './edition'
import { lang } from './i18n'
import { log } from './log'
import { type Store, VERSION_RE } from './store'
import { newer } from './updates'

/**
 * Novedades: la página de la web con lo nuevo de cada versión, y el aviso que
 * sale tras actualizar Molino («Molino PDF se ha actualizado»).
 *
 * La dirección es fija, una por idioma, y el ancla sale del producto y de la
 * versión que está corriendo, con guiones en lugar de puntos: #pdf-0-7-6,
 * #suite-1-0-2. La interfaz nunca la manda: solo pide abrirla. Sin red: el
 * aviso sale de comparar la versión con la última guardada en config.json, así
 * que sale aunque el aviso de versiones nuevas esté desactivado en Ajustes.
 */

const PAGES: Record<Lang, string> = {
  es: 'https://molinosuite.org/novedades/',
  en: 'https://molinosuite.org/en/whats-new/'
}

/** La página de novedades de esa versión. Si la versión no tiene forma x.y.z, la página sin ancla. */
export function whatsNewUrl(language: Lang, product: 'pdf' | 'suite', version: string): string {
  const page = PAGES[language] ?? PAGES.es
  return VERSION_RE.test(version) ? `${page}#${product}-${version.replace(/\./g, '-')}` : page
}

/**
 * ¿Se había abierto Molino antes en esta carpeta de datos? Lo dice su registro
 * (logs\molino.log), que escriben al arrancar todas las versiones (la línea de
 * órdenes escribe el suyo aparte, en logs\cli). Se mira antes de initLog y del
 * paso de datos (migrate.ts), que no lo copia: la primera vez de Molino Suite con
 * los datos de Molino PDF (o de Molino PDF con los de Folio) no cuenta como una
 * actualización. config.json no sirve para esto: ese paso lo copia, y solo se
 * escribe al tocar un ajuste, mover la ventana o abrir algo.
 */
export function openedBefore(userData: string): boolean {
  const logs = join(userData, 'logs')
  return existsSync(join(logs, 'molino.log')) || existsSync(join(logs, 'molino.1.log'))
}

/** Las ventanas que enseñan los avisos al abrir: «Molino», el inicio de la suite, o Molino PDF. */
export type StartWindow = 'home' | 'pdf'

/**
 * Qué ventana enseña un aviso: la primera que lo pide en esta sesión (y otra
 * igual, si se cierra y se vuelve a abrir). Así no sale repetido en el inicio y
 * en Molino PDF a la vez.
 */
export class NoticeOwner {
  private owner: StartWindow | null = null

  claim(who: StartWindow): boolean {
    this.owner ??= who
    return this.owner === who
  }
}

export class WhatsNew {
  private readonly version = app.getVersion()
  private pending: boolean
  private readonly owner = new NoticeOwner()

  /** ``usedBefore``: openedBefore(), mirado al arrancar. */
  constructor(
    private readonly store: Store,
    usedBefore: boolean
  ) {
    const seen = store.seenVersion
    if (!VERSION_RE.test(this.version)) {
      this.pending = false
    } else if (!usedBefore) {
      // La primera vez, nada que contar, aunque config.json traiga una versión de otra
      // instalación (Molino PDF al pasar a la suite). Se guarda ya: así la próxima no
      // parece una actualización.
      this.pending = false
      store.setSeenVersion(this.version)
    } else {
      // Ya se había abierto: sin versión guardada, viene de una versión que aún no la guardaba.
      this.pending = seen === undefined || newer(this.version, seen)
    }
    if (this.pending) log.info(`novedades: actualizado a ${this.version}${seen ? ` desde ${seen}` : ''}`)
  }

  /** Lo que cuenta el aviso en esa ventana, o null (no hay nada nuevo o ya lo enseña otra). */
  claim(who: StartWindow): WhatsNewNotice | null {
    return this.pending && this.owner.claim(who) ? { product: edition, version: this.version } : null
  }

  /** «Cerrar» (o la página ya abierta): no vuelve a salir hasta la próxima versión. */
  dismiss(): void {
    if (!this.pending) return
    this.pending = false
    this.store.setSeenVersion(this.version)
  }

  /** Abre la página de novedades de esta versión, en el idioma de Molino. Con eso, el aviso ya está visto. */
  async open(): Promise<boolean> {
    this.dismiss()
    try {
      await shell.openExternal(whatsNewUrl(lang, edition, this.version))
      return true
    } catch {
      log.warn('novedades: no se pudo abrir la página')
      return false
    }
  }
}
