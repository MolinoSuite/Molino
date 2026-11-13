import type { OfficeAppId } from '@shared/types'
import { fmt, L } from '@/i18n'

/**
 * La app de esta ventana: Molino PDF o una de oficina (Documentos, Hojas o
 * Presentaciones). Lo común a todas (Ajustes, Acerca de, Enviar comentarios)
 * enseña lo suyo y dice su nombre. La ventana de oficina lo fija al arrancar
 * (office/main.tsx); si no, es Molino PDF.
 */
export type CurrentApp = 'pdf' | OfficeAppId

let current: CurrentApp = 'pdf'

export function setCurrentApp(app: CurrentApp): void {
  current = app
}

export function currentApp(): CurrentApp {
  return current
}

/** El nombre de la app de esta ventana («Molino Documentos»…). */
export function currentAppName(): string {
  return L.common.appNames[current]
}

/** Un texto común con el nombre de la app de esta ventana en {app}. */
export function withApp(text: string, values: Record<string, string | number> = {}): string {
  return fmt(text, { app: currentAppName(), ...values })
}
