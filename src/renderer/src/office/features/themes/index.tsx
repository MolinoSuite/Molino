import { cleanFont, MOLINO_THEMES, type OfficeTheme } from '@shared/officeThemes'
import { useApp } from '@/state/app'
import type { PaletteEntry } from '../../apps'
import { fmt, L } from '../../i18n'
import type { Api, Feature, FeatureContext } from '../types'
import { applyTheme, editorSchemeCount, loadThemeFonts, readSchemes, type ThemeParts, WHOLE_THEME } from './apply'
import { COLORS_MENU, FONTS_MENU, THEMES_MENU, VARIANTS_MENU } from './menus'
import { molinoThemes, setDefaultTheme, themeById, themeName } from './model'
import { ThemeEditorDialog, ThemesDialog } from './ThemeDialogs'
import './themes.css'

/**
 * Temas de documento en Documentos, Hojas y Presentaciones (como Diseño → Temas
 * de Office): la galería «Temas» (en Presentaciones, «Variantes»), «Colores» y
 * «Fuentes», crear y administrar los propios, guardar el del documento y elegir
 * el de los documentos nuevos (que pone el proceso principal al crearlos:
 * main/officethemes.ts). Lo que cambia en cada editor: apply.ts. Ver types.ts.
 */

const TH = L.officeThemes

/** Lo que el editor dice de sus colores: la combinación puesta (su nombre es el del tema). */
function readCurrent(ctx: FeatureContext): void {
  try {
    ctx.state.extra.themeSchemeName = String(ctx.api.asc_GetCurrentColorSchemeName?.() ?? '')
    ctx.state.extra.themeSchemeIndex = Number(ctx.api.asc_GetCurrentColorSchemeIndex?.() ?? -1)
  } catch {
    /* sin tema */
  }
}

function themeCommands(ctx: FeatureContext): Record<string, (value?: string) => void> {
  const toast = (kind: 'success' | 'error', text: string): void => useApp.getState().toast(kind, text)
  const put = (theme: OfficeTheme | null, parts: ThemeParts, done: string): void => {
    if (!theme) return
    const apply = (): void => {
      if (applyTheme(ctx, theme, parts)) {
        readCurrent(ctx)
        toast('success', fmt(done, { name: theme.name }))
      } else toast('error', TH.toasts.failed)
      ctx.changed()
    }
    if (parts.fonts) loadThemeFonts(ctx, theme, apply)
    else apply()
  }
  const commands: Record<string, (value?: string) => void> = {
    themeApply: (id) => put(themeById(id), WHOLE_THEME, TH.toasts.applied),
    themeColors: (id) => put(themeById(id), { colors: true, fonts: false, looks: false }, TH.toasts.colors),
    themeFonts: (id) => put(themeById(id), { colors: false, fonts: true, looks: false }, TH.toasts.fonts),
    // Fuentes a medida: las dos que se elijan (con los estilos de los títulos de siempre).
    themeFontsCustom: (json) => {
      let raw: { heading?: unknown; body?: unknown }
      try {
        raw = JSON.parse(json ?? '')
      } catch {
        return
      }
      const heading = cleanFont(raw.heading)
      const body = cleanFont(raw.body)
      if (!heading || !body) return
      const base = molinoThemes()[0]
      put({ ...base, name: `${heading} · ${body}`, fonts: { heading, body } }, { colors: false, fonts: true, looks: false }, TH.toasts.fonts)
    },
    themeDefault: (id) => void setDefaultTheme(ctx.kind, id || null)
  }
  // Documentos y Hojas: las combinaciones de colores del editor (en Presentaciones ya las pone slide.tsx).
  if (ctx.kind !== 'slide') {
    commands.colorScheme = (value) => {
      const n = Number(value)
      if (!Number.isInteger(n) || n < 0 || n >= editorSchemeCount(ctx)) return
      ctx.api.asc_ChangeColorSchemeByIdx(n)
      readCurrent(ctx)
      ctx.changed()
    }
  }
  return commands
}

function listen(ctx: FeatureContext, on: (name: string, fn: (...args: Api[]) => void) => void): void {
  const extra = ctx.state.extra
  // Las combinaciones de colores (las del editor y, detrás, la del documento), con sus 12 colores.
  on('asc_onSendThemeColorSchemes', (schemes: Api[]) => {
    extra.themeSchemes = readSchemes(schemes)
    extra.themeSchemeCount = editorSchemeCount(ctx)
    readCurrent(ctx)
  })
  on('asc_onSendThemeColors', () => readCurrent(ctx))
  let started = false
  const start = (): void => {
    if (started || !ctx.api || !ctx.state.ready) return
    started = true
    readCurrent(ctx)
    extra.themeSchemeCount = editorSchemeCount(ctx)
    ctx.changed()
  }
  on('asc_onDocumentContentReady', () => setTimeout(start, 200))
  // Si el documento ya estaba listo al escuchar.
  const retry = (left: number): void => {
    if (started || left <= 0) return
    if (ctx.state.ready) start()
    else setTimeout(() => retry(left - 1), 500)
  }
  setTimeout(() => retry(40), 800)
}

const GROUP = [TH.groups.themes]
const K = TH.keywords
const MODE = L.office.modes

/** «¿Qué quieres hacer?»: los cuadros y cada tema de Molino (los propios, desde la galería). */
function palette(group: string): PaletteEntry[] {
  return [
    { label: TH.menu.manage, group, keywords: K.manage, command: 'dialog', value: 'themes' },
    { label: TH.menu.create, group, keywords: K.create, command: 'dialog', value: 'themeEdit:new' },
    { label: TH.menu.fromDocument, group, keywords: K.fromDocument, command: 'dialog', value: 'themeEdit:doc' },
    { label: TH.menu.customFonts, group, keywords: K.fonts, command: 'themeFontsAsk' },
    ...MOLINO_THEMES.map((t) => ({ label: fmt(TH.palette.apply, { name: themeName(t) }), group, keywords: K.themes, command: 'themeApply', value: t.id })),
    ...MOLINO_THEMES.map((t) => ({ label: fmt(TH.palette.colors, { name: themeName(t) }), group, keywords: K.colors, command: 'themeColors', value: t.id })),
    ...MOLINO_THEMES.map((t) => ({ label: fmt(TH.palette.fonts, { name: themeName(t) }), group, keywords: K.fonts, command: 'themeFonts', value: t.id }))
  ]
}

const dialogs: Feature['dialogs'] = {
  themes: (props) => <ThemesDialog {...props} />,
  themeEdit: (props) => <ThemeEditorDialog {...props} />
}

/** Las fuentes a medida: las dos del documento, de la lista de fuentes del editor. */
const ask: Feature['ask'] = (command, _value, session, run) => {
  if (command !== 'themeFontsAsk') return null
  const C = TH.customFonts
  const fonts = [...new Set([...session.state.fonts])].sort((a, b) => a.localeCompare(b))
  const options = fonts.map((f) => ({ value: f, label: f }))
  const now = session.state.font || 'Inter'
  return {
    title: C.title,
    intro: C.intro,
    fields: [
      { key: 'heading', label: C.heading, value: now, options },
      { key: 'body', label: C.body, value: now, options }
    ],
    onOk: (v) => void run('themeFontsCustom', JSON.stringify({ heading: v.heading, body: v.body }))
  }
}

/** Documentos: en «Página» (Disposición), delante. */
export const wordThemesFeature: Feature = {
  commands: themeCommands,
  listen,
  tools: { layout: { at: 0, groups: [[THEMES_MENU, COLORS_MENU, FONTS_MENU]], names: GROUP } },
  ask,
  dialogs,
  palette: palette(MODE.layout)
}

/** Hojas: en «Página» (Diseño de página de Excel), delante. */
export const cellThemesFeature: Feature = {
  commands: themeCommands,
  listen,
  tools: { pageLayout: { at: 0, groups: [[THEMES_MENU, COLORS_MENU, FONTS_MENU]], names: GROUP } },
  ask,
  dialogs,
  palette: palette(MODE.layout)
}

/**
 * Presentaciones: en «Diseño», detrás de los temas de diapositiva y de sus
 * colores (slide.tsx pone los de los temas de Molino en su menú «Colores»).
 */
export const slideThemesFeature: Feature = {
  commands: themeCommands,
  listen,
  tools: { design: { at: 2, groups: [[VARIANTS_MENU, FONTS_MENU]], names: GROUP } },
  ask,
  dialogs,
  palette: palette(MODE.design)
}
