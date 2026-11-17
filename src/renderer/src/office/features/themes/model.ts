/**
 * Los temas de documento en la interfaz: los de Molino (con su nombre en el
 * idioma de Molino) y los del usuario (en sus ajustes, compartidos por las tres
 * apps), y guardarlos, borrarlos o elegir el de los documentos nuevos.
 */
import type { OfficeKind } from '@shared/officeui'
import { cleanTheme, findTheme, MAX_USER_THEMES, MOLINO_THEMES, type OfficeTheme, THEME_COLOR_KEYS, type ThemeColorKey } from '@shared/officeThemes'
import { useApp } from '@/state/app'
import { updateSettings } from '@/state/settings'
import { fmt, L } from '../../i18n'

const TH = L.officeThemes

/** El nombre que se ve de un tema (los de Molino, traducidos). */
export function themeName(theme: OfficeTheme): string {
  return (TH.builtIn as Record<string, string>)[theme.id] ?? theme.name
}

/** Los de Molino, con su nombre en el idioma de Molino (el que va al archivo). */
export function molinoThemes(): OfficeTheme[] {
  return MOLINO_THEMES.map((t) => ({ ...t, name: themeName(t) }))
}

/** Los temas propios (los de los ajustes; ya validados por el proceso principal). */
export function userThemes(): OfficeTheme[] {
  return useApp.getState().settings.officeThemes ?? []
}

/** Un tema por su identificador (de Molino o propio), con su nombre que se ve. */
export function themeById(id: string | undefined): OfficeTheme | null {
  const found = findTheme(id, userThemes())
  return found ? { ...found, name: themeName(found) } : null
}

/** Un identificador nuevo para un tema propio (16 cifras hexadecimales). */
export function newThemeId(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Un nombre que no tenga ya otro tema propio («Mi tema», «Mi tema 2»…). */
export function freeName(wanted: string, except?: string): string {
  const used = new Set(userThemes().filter((t) => t.id !== except).map((t) => t.name.toLowerCase()))
  const base = wanted.trim().slice(0, 56) || TH.editor.defaultName
  if (!used.has(base.toLowerCase())) return base
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base} ${n}`
    if (!used.has(candidate.toLowerCase())) return candidate
  }
  return base
}

/** Guarda un tema propio (nuevo o cambiado); su identificador, o null si no se pudo. */
export async function saveTheme(raw: OfficeTheme): Promise<string | null> {
  const toast = useApp.getState().toast
  const id = raw.id && /^[0-9a-f]{16}$/.test(raw.id) ? raw.id : newThemeId()
  const theme = cleanTheme({ ...raw, id })
  if (!theme) return null
  const list = userThemes()
  const others = list.filter((t) => t.id !== id)
  if (others.length >= MAX_USER_THEMES) {
    toast('error', fmt(TH.toasts.full, { n: MAX_USER_THEMES }))
    return null
  }
  const at = list.findIndex((t) => t.id === id)
  const next = at >= 0 ? list.map((t) => (t.id === id ? theme : t)) : [...list, theme]
  await updateSettings({ officeThemes: next })
  if (!userThemes().some((t) => t.id === id)) return null
  toast('success', fmt(TH.toasts.saved, { name: theme.name }))
  return id
}

/** Borra un tema propio (y deja de ser el de los documentos nuevos donde lo fuera). */
export async function removeTheme(id: string): Promise<void> {
  const settings = useApp.getState().settings
  const theme = settings.officeThemes.find((t) => t.id === id)
  if (!theme) return
  const defaults = Object.fromEntries(Object.entries(settings.officeDefaultTheme ?? {}).filter(([, v]) => v !== id))
  await updateSettings({ officeThemes: settings.officeThemes.filter((t) => t.id !== id), officeDefaultTheme: defaults })
  useApp.getState().toast('info', fmt(TH.toasts.removed, { name: theme.name }))
}

/** El tema de los documentos nuevos de una app ('' o null: el de siempre). */
export async function setDefaultTheme(kind: OfficeKind, id: string | null): Promise<void> {
  const settings = useApp.getState().settings
  const next = { ...(settings.officeDefaultTheme ?? {}) }
  const theme = id ? themeById(id) : null
  if (theme) next[kind] = theme.id
  else delete next[kind]
  await updateSettings({ officeDefaultTheme: next })
  useApp.getState().toast('success', theme ? fmt(TH.toasts.defaultSet, { name: theme.name }) : TH.toasts.defaultOff)
}

// ------------------------------------------------------------------ colores

export function rgbOf(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16) || 0
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** El color del tema más parecido a uno cualquiera (para leer los estilos de un documento). */
export function nearestColor(hex: string, colors: Record<ThemeColorKey, string>): ThemeColorKey {
  const [r, g, b] = rgbOf(hex)
  let best: ThemeColorKey = 'dk1'
  let distance = Number.POSITIVE_INFINITY
  for (const key of THEME_COLOR_KEYS) {
    const [r2, g2, b2] = rgbOf(colors[key])
    const d = (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2
    if (d < distance) {
      distance = d
      best = key
    }
  }
  return best
}

/** Un tema vacío para empezar uno nuevo: el de Molino con otro nombre. */
export function blankTheme(): OfficeTheme {
  const base = molinoThemes()[0]
  return { ...structuredClone(base), id: '', name: freeName(TH.editor.defaultName) }
}
