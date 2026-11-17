/**
 * Los menús visuales de los temas (Temas, Colores y Fuentes, como en Office) y
 * sus miniaturas: «Aa» con la fuente de los títulos sobre el fondo del tema y una
 * tira con sus colores; las combinaciones, en una tira; las fuentes, escritas
 * con su letra.
 */
import { BookmarkPlus, PaintbrushVertical, Palette, Plus, Settings2, SlidersHorizontal, Star, StarOff, Type } from 'lucide-react'
import type { CSSProperties } from 'react'
import { messagesFor } from '@shared/i18n'
import { MOLINO_THEMES, type OfficeTheme } from '@shared/officeThemes'
import type { MenuOption, Tool } from '../../apps'
import type { EditorState } from '../../engine'
import { useApp } from '@/state/app'
import { env, fmt, L } from '../../i18n'
import type { SchemeInfo } from './apply'
import { molinoThemes, themeById, userThemes } from './model'

const TH = L.officeThemes
const ICON = 16

/** La letra con que se ve una fuente en la interfaz (Inter es la variable de la interfaz). */
export const faceOf = (font: string): string => `${font === 'Inter' ? '"Inter Variable", Inter' : `"${font.replace(/["\\]/g, '')}"`}, var(--font-ui)`

/** La miniatura de un tema: «Aa» en la fuente de los títulos, sobre su fondo, con sus colores debajo. */
export function ThemeTile({ theme, large }: { theme: OfficeTheme; large?: boolean }) {
  const c = theme.colors
  return (
    <span className={large ? 'theme-tile large' : 'theme-tile'} style={{ background: c.lt1, color: c.dk1 }} aria-hidden="true">
      <span className="theme-tile-aa">
        <b style={{ fontFamily: faceOf(theme.fonts.heading), color: c.dk2 }}>Aa</b>
        <span style={{ fontFamily: faceOf(theme.fonts.body) }}>Aa</span>
      </span>
      <span className="theme-tile-strip">
        {(['accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'] as const).map((k) => (
          <i key={k} style={{ background: c[k] }} />
        ))}
      </span>
    </span>
  )
}

/** Una tira con los colores de una combinación (texto oscuro 2, fondo claro 2 y los seis de énfasis). */
export function PaletteStrip({ colors }: { colors: string[] }) {
  return (
    <span className="theme-palette" aria-hidden="true">
      {colors.map((c, i) => (
        <i key={i} style={{ background: c }} />
      ))}
    </span>
  )
}
const stripOf = (t: OfficeTheme): string[] => [t.colors.dk2, t.colors.lt2, t.colors.accent1, t.colors.accent2, t.colors.accent3, t.colors.accent4, t.colors.accent5, t.colors.accent6]

/** Las dos fuentes de un tema, cada una escrita con la suya. */
export function FontPair({ heading, body }: { heading: string; body: string }) {
  return (
    <span className="theme-fontpair" aria-hidden="true">
      <b style={{ fontFamily: faceOf(heading) }}>{heading}</b>
      <span style={{ fontFamily: faceOf(body) }}>{body}</span>
    </span>
  )
}

// ---------------------------------------------------------------- opciones

/** Los temas de Molino y los propios, cada uno con su miniatura. */
function themeTiles(command?: string, art: (t: OfficeTheme) => MenuOption['preview'] = (t) => <ThemeTile theme={t} />): MenuOption[] {
  const own = userThemes()
  return [
    { value: '', label: TH.menu.molino, heading: true },
    ...molinoThemes().map((t) => ({ value: t.id, label: t.name, preview: art(t), command })),
    ...(own.length ? [{ value: '', label: TH.menu.mine, heading: true }, ...own.map((t) => ({ value: t.id, label: t.name, preview: art(t), command }))] : [])
  ]
}

/** El tema que tiene puesto el documento (por el nombre de sus colores, que es el del tema). */
export function currentThemeId(s: EditorState): string {
  const name = String(s.extra.themeSchemeName ?? '')
  if (!name) return ''
  // Los de Molino, con su nombre en cualquiera de los idiomas (el documento pudo hacerse en el otro).
  const molino = MOLINO_THEMES.find((t) => (['es', 'en'] as const).some((lang) => (messagesFor(lang).officeThemes.builtIn as Record<string, string>)[t.id] === name))
  return molino?.id ?? userThemes().find((t) => t.name === name)?.id ?? ''
}

const ACTIONS: MenuOption[] = [
  { value: '', label: TH.menu.manage, heading: true },
  { value: 'themeEdit:new', label: TH.menu.create, command: 'dialog', action: true, icon: <Plus size={15} /> },
  { value: 'themeEdit:doc', label: TH.menu.fromDocument, command: 'dialog', action: true, icon: <BookmarkPlus size={15} /> },
  { value: 'themes', label: TH.menu.manage, command: 'dialog', action: true, icon: <Settings2 size={15} /> }
]

/** Temas: la galería (y crear, guardar el del documento y administrar). */
export const THEMES_MENU: Tool = {
  type: 'menu',
  key: 'themesMenu',
  label: TH.tools.themes,
  command: 'themeApply',
  icon: <Palette size={ICON} />,
  caption: true,
  tiles: 4,
  options: (s) => [...themeTiles(), ...ACTIONS.slice(1), ...defaultAction(s)],
  current: currentThemeId
}

/** Usar (o dejar de usar) el tema del documento en los documentos nuevos de esta app, como en Office. */
function defaultAction(s: EditorState): MenuOption[] {
  const id = currentThemeId(s)
  const theme = id ? themeById(id) : null
  if (!theme) return []
  const chosen = useApp.getState().settings.officeDefaultTheme?.[env.kind] === theme.id
  return [
    chosen
      ? { value: '', label: fmt(TH.menu.stopDefault, { name: theme.name }), command: 'themeDefault', action: true, icon: <StarOff size={15} /> }
      : { value: theme.id, label: fmt(TH.menu.useDefault, { name: theme.name }), command: 'themeDefault', action: true, icon: <Star size={15} /> }
  ]
}
/** En Presentaciones: «Variantes» (colores y fuentes del tema, sin tocar el diseño). */
export const VARIANTS_MENU: Tool = { ...THEMES_MENU, key: 'themeVariants', label: TH.tools.variants, icon: <PaintbrushVertical size={ICON} /> } as Tool

/**
 * Colores: los de cada tema (miniatura) y las combinaciones que trae el
 * editor (filas, como las de Office). Presentaciones añade las del editor en su menú.
 */
export function paletteOptions(): MenuOption[] {
  return themeTiles('themeColors', (t) => <PaletteStrip colors={stripOf(t)} />)
}
export const COLORS_MENU: Tool = {
  type: 'menu',
  key: 'themeColorsMenu',
  label: TH.tools.colors,
  command: 'themeColors',
  icon: <Palette size={ICON} />,
  caption: true,
  tiles: 3,
  options: (s) => {
    const count = Number(s.extra.themeSchemeCount ?? 0)
    const schemes = ((s.extra.themeSchemes as SchemeInfo[] | undefined) ?? []).filter((x) => x.index < count)
    return [
      ...paletteOptions(),
      ...(schemes.length
        ? [
            { value: '', label: TH.menu.more, heading: true },
            ...schemes.map((x) => ({ value: String(x.index), label: x.name, command: 'colorScheme', icon: <PaletteStrip colors={[x.colors[2], x.colors[3], ...x.colors.slice(4, 10)]} /> }))
          ]
        : [])
    ]
  },
  current: (s) => {
    const theme = currentThemeId(s)
    return theme || String(s.extra.themeSchemeIndex ?? '')
  }
}

/** Fuentes: las de cada tema (escritas con su letra) y unas a medida. */
export const FONTS_MENU: Tool = {
  type: 'menu',
  key: 'themeFontsMenu',
  label: TH.tools.fonts,
  command: 'themeFonts',
  icon: <Type size={ICON} />,
  caption: true,
  tiles: 2,
  options: () => [
    ...themeTiles('themeFonts', (t) => <FontPair heading={t.fonts.heading} body={t.fonts.body} />),
    { value: '', label: TH.menu.customFonts, command: 'themeFontsAsk', action: true, icon: <SlidersHorizontal size={15} /> }
  ]
}

/** Estilo de la vista previa de un texto con un estilo del tema (pt → px de la vista previa). */
export function previewStyle(theme: OfficeTheme, key: keyof OfficeTheme['styles'], scale = 0.92): CSSProperties {
  const s = theme.styles[key]
  return {
    fontFamily: faceOf(s.font === 'heading' ? theme.fonts.heading : theme.fonts.body),
    fontSize: `${Math.max(7, s.size * scale)}px`,
    color: theme.colors[s.color],
    fontWeight: s.bold ? 700 : 400,
    fontStyle: s.italic ? 'italic' : 'normal',
    marginTop: `${s.before * scale * 0.6}px`,
    marginBottom: `${s.after * scale * 0.6}px`
  }
}
