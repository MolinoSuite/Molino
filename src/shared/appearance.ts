import { APP_ACCENTS, type AppLook, type OfficeAppId, type Settings } from './types'

/** El aspecto de una app: el de Molino PDF es theme y accent; cada app de oficina tiene el suyo (o el de fábrica: como Windows y su color). */
export function lookOf(settings: Pick<Settings, 'theme' | 'accent' | 'appearance'>, app: 'pdf' | OfficeAppId): AppLook {
  if (app === 'pdf') return { theme: settings.theme, accent: settings.accent }
  return settings.appearance?.[app] ?? { theme: 'system', accent: APP_ACCENTS[app] }
}

/** ¿Esa app va en oscuro? (`systemDark`: el tema de Windows). */
export function darkFor(settings: Pick<Settings, 'theme' | 'accent' | 'appearance'>, app: 'pdf' | OfficeAppId, systemDark: boolean): boolean {
  const { theme } = lookOf(settings, app)
  return theme === 'dark' || (theme === 'system' && systemDark)
}
