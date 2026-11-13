import type { Settings } from '@shared/types'
import { useApp } from './app'

/**
 * Los ajustes de Molino, que son los mismos en todas sus apps (store.ts los
 * guarda en un solo sitio). Cada ventana los tiene en su estado (useApp) y los
 * cambia con updateSettings; las demás se enteran por «settings:changed».
 */

let applied: (settings: Settings) => void = () => undefined

/** Lo que hace esta ventana después de un cambio (Molino PDF aplica su tema; ver actions.ts). */
export function whenSettingsApplied(fn: (settings: Settings) => void): void {
  applied = fn
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  const next = await window.molino.settings.set(patch)
  if (next) {
    useApp.getState().setSettings(next)
    applied(next)
  }
}

/** La pestaña con la que abrir Ajustes la próxima vez (el panel de la IA pide la suya). */
let nextTab: string | null = null
export function setSettingsTab(tab: string): void {
  nextTab = tab
}
export function takeSettingsTab(): string | null {
  const tab = nextTab
  nextTab = null
  return tab
}
