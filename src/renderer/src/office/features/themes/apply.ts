/**
 * Poner un tema en el documento abierto y leer el que tiene, con la API de cada
 * editor (lo que se puede, ver más abajo; todo lo comprobado con la pieza real en
 * scripts/e2e/office-temas.mjs):
 *
 * - Colores: el editor solo sabe poner las combinaciones de su lista
 *   (asc_ChangeColorSchemeByIdx); la del tema se añade un momento a esa lista y se
 *   quita después. Así queda en el tema del archivo (a:clrScheme, con el nombre del
 *   tema) y se deshace con Ctrl+Z. En Presentaciones, con la API de documentos
 *   (ApiTheme.SetColorScheme), en todos los patrones.
 * - Fuentes: en Presentaciones, las del tema (ApiTheme: a:fontScheme), que usan los
 *   patrones (+mj-lt, +mn-lt). En Documentos la API no deja cambiar las del tema:
 *   se ponen en la letra predeterminada y en los estilos (como un conjunto de
 *   estilos de Word). En Hojas tampoco: la del texto se pone en las celdas que usan
 *   la de siempre (y en las vacías), y las que tenían otra se quedan con la suya.
 * - Estilos (Documentos): Normal, Título, Subtítulo, Título 1 a 3 y Cita, con su
 *   fuente, tamaño, color del tema, negrita, cursiva y espacio antes y después.
 *
 * Cada aplicación es un solo paso para deshacer: los colores y lo demás van en la
 * misma orden de la API de documentos (en Documentos, editor.asc_ChangeColorSchemeByIdx
 * dentro de ella; en Hojas, Api.SetThemeColors; en Presentaciones, ApiTheme).
 */
import { cleanTheme, type OfficeTheme, THEME_COLOR_KEYS, THEME_STYLE_KEYS, type ThemeColorKey, type ThemeStyleKey } from '@shared/officeThemes'
import type { Api, FeatureContext } from '../types'
import { nearestColor, rgbOf } from './model'

/** La API de documentos del editor: solo existe dentro de las funciones de ctx.builder. */
declare const Api: Api
/** El editor, dentro de esas funciones (allí «Asc» es otro objeto). */
declare const editor: Api

/** Qué se pone del tema: los colores, las fuentes y (en Documentos) el aspecto de los estilos y el tamaño del texto. */
export interface ThemeParts {
  colors: boolean
  fonts: boolean
  looks: boolean
}
export const WHOLE_THEME: ThemeParts = { colors: true, fonts: true, looks: true }

/** Los estilos de Documentos de cada estilo del tema (sus nombres en el editor). */
const WORD_STYLES: Record<ThemeStyleKey, string> = {
  title: 'Title',
  subtitle: 'Subtitle',
  heading1: 'Heading 1',
  heading2: 'Heading 2',
  heading3: 'Heading 3',
  quote: 'Quote'
}
/** Otros estilos de títulos: solo cambian de fuente (la de los títulos), como con las fuentes de un tema de Word. */
const WORD_MORE_HEADINGS = ['Heading 4', 'Heading 5', 'Heading 6', 'Heading 7', 'Heading 8', 'Heading 9', 'TOC Heading']
/** Los colores del tema con otros nombres (texto y fondo) que da el editor al leer un estilo. */
const COLOR_ALIASES: Record<string, ThemeColorKey> = { tx1: 'dk1', tx2: 'dk2', bg1: 'lt1', bg2: 'lt2' }
/**
 * El orden de los colores en Api.CreateThemeColorScheme (el interno del editor,
 * no el de a:clrScheme): comprobado en el archivo guardado.
 */
const BUILDER_COLOR_ORDER: ThemeColorKey[] = ['accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'dk1', 'dk2', 'folHlink', 'hlink', 'lt1', 'lt2']
/** Las celdas de una hoja que se miran, como mucho, para dejar con su fuente las que tienen otra. */
const MAX_CELLS = 100_000

// ------------------------------------------------------------- colores

/**
 * La lista de combinaciones de colores que trae el editor (un nombre interno que
 * cambia con cada versión): se busca por su forma (12 colores, get_name, get_colors).
 */
function schemeList(ew: Api): Api[] | null {
  const common = ew?.AscCommon
  if (!common) return null
  for (const key of Object.keys(common)) {
    let value: unknown
    try {
      value = common[key]
    } catch {
      continue
    }
    if (Array.isArray(value) && value.length > 5 && value.length < 500 && value.every((s) => s && typeof s.get_name === 'function' && typeof s.get_colors === 'function')) return value
  }
  return null
}

/** Cuántas combinaciones trae el editor (las del documento van detrás). */
export function editorSchemeCount(ctx: FeatureContext): number {
  return schemeList(ctx.ew)?.length ?? 0
}

/** Una combinación como las de la lista del editor, con los 12 colores del tema. */
function makeScheme(list: Api[], name: string, colors: Record<ThemeColorKey, string>): Api | null {
  const base = list[0]
  const key = Object.keys(base).find((k) => Array.isArray(base[k]) && base[k].length === 12)
  if (!key) return null
  const Color = base[key][0]?.constructor
  if (typeof Color !== 'function') return null
  const scheme = new base.constructor()
  if (!Array.isArray(scheme[key])) return null
  scheme.name = name
  for (const k of THEME_COLOR_KEYS) {
    const [r, g, b] = rgbOf(colors[k])
    scheme[key].push(new Color(r, g, b))
  }
  return scheme[key].length === 12 ? scheme : null
}

/** Pone los colores del tema (Documentos y Hojas): true si quedaron puestos. */
function applyColors(ctx: FeatureContext, theme: OfficeTheme): boolean {
  const list = schemeList(ctx.ew)
  if (!list) return false
  const scheme = makeScheme(list, theme.name, theme.colors)
  if (!scheme) return false
  list.push(scheme)
  try {
    ctx.api.asc_ChangeColorSchemeByIdx(list.length - 1)
  } finally {
    const at = list.indexOf(scheme)
    if (at >= 0) list.splice(at, 1)
  }
  return String(ctx.api.asc_GetCurrentColorSchemeName?.() ?? '') === theme.name
}

// ----------------------------------------------------------- Documentos

function applyWord(ctx: FeatureContext, theme: OfficeTheme, parts: ThemeParts): boolean {
  const styles = THEME_STYLE_KEYS.map((key) => {
    const s = theme.styles[key]
    return {
      name: WORD_STYLES[key],
      font: s.font === 'heading' ? theme.fonts.heading : theme.fonts.body,
      size: Math.round(s.size * 2),
      color: s.color,
      bold: s.bold,
      italic: s.italic,
      before: Math.round(s.before * 20),
      after: Math.round(s.after * 20)
    }
  })
  // Los colores, con la combinación del tema añadida un momento a la lista del editor.
  const list = parts.colors ? schemeList(ctx.ew) : null
  const scheme = list ? makeScheme(list, theme.name, theme.colors) : null
  if (parts.colors && (!list || !scheme)) return false
  if (list && scheme) list.push(scheme)
  const data = {
    scheme: list && scheme ? list.length - 1 : -1,
    fonts: parts.fonts,
    looks: parts.looks,
    heading: theme.fonts.heading,
    body: theme.fonts.body,
    size: Math.round(theme.size * 2),
    styles,
    more: WORD_MORE_HEADINGS
  }
  let ok = true
  try {
    // Todo en una sola orden de la API de documentos: un solo paso para deshacer.
    ok = ctx.builder(function (scope) {
      const m = scope.molino
      // Dentro de la orden, el editor es «editor» (Asc es otro aquí).
      if (m.scheme >= 0) editor.asc_ChangeColorSchemeByIdx(m.scheme)
      if (!m.fonts && !m.looks) return
      const doc = Api.GetDocument()
      // La letra de siempre (la de todo lo que no tiene otra) y la del estilo Normal.
      const defaults = doc.GetDefaultTextPr()
      if (m.fonts) defaults.SetFontFamily(m.body)
      if (m.looks) defaults.SetFontSize(m.size)
      const normal = doc.GetStyle('Normal')
      if (normal) {
        const text = normal.GetTextPr()
        if (m.fonts) text.SetFontFamily(m.body)
        if (m.looks) text.SetFontSize(m.size)
      }
      for (let i = 0; i < m.styles.length; i++) {
        const s = m.styles[i]
        const style = doc.GetStyle(s.name)
        if (!style) continue
        const text = style.GetTextPr()
        if (m.fonts) text.SetFontFamily(s.font)
        if (m.looks) {
          text.SetFontSize(s.size)
          text.SetColor(Api.ThemeColor(s.color))
          text.SetBold(s.bold)
          text.SetItalic(s.italic)
          const paragraph = style.GetParaPr()
          paragraph.SetSpacingBefore(s.before)
          paragraph.SetSpacingAfter(s.after)
        }
      }
      if (m.fonts) {
        for (let i = 0; i < m.more.length; i++) {
          const style = doc.GetStyle(m.more[i])
          if (style) style.GetTextPr().SetFontFamily(m.heading)
        }
      }
      if (m.looks) {
        const link = doc.GetStyle('Hyperlink')
        if (link) link.GetTextPr().SetColor(Api.ThemeColor('hlink'))
      }
    }, ctx.local(data))
  } finally {
    const at = list && scheme ? list.indexOf(scheme) : -1
    if (at >= 0) list!.splice(at, 1)
  }
  return ok && (!parts.colors || String(ctx.api.asc_GetCurrentColorSchemeName?.() ?? '') === theme.name)
}

// ---------------------------------------------------------------- Hojas

/**
 * Hojas: los colores con Api.SetThemeColors (que pone una de la lista del editor
 * por su nombre: la del tema, añadida un momento) y la fuente en la misma orden
 * de la API de documentos, así se deshace todo con un solo Ctrl+Z.
 */
function applyCell(ctx: FeatureContext, theme: OfficeTheme, parts: ThemeParts): boolean {
  if (!parts.colors && !parts.fonts) return true
  const list = parts.colors ? schemeList(ctx.ew) : null
  const scheme = list ? makeScheme(list, theme.name, theme.colors) : null
  // Si ya hay una combinación del editor con ese nombre, se pondría la suya: entonces, aparte.
  const clash = list ? list.some((s) => String(s.get_name?.() ?? '') === theme.name) || themesNamed(ctx, theme.name) : false
  const inside = Boolean(parts.colors && list && scheme && !clash)
  if (inside) list!.push(scheme)
  let ok = true
  try {
    ok = ctx.builder(function (scope) {
      const m = scope.molino
      if (m.colors) Api.SetThemeColors(m.name)
      if (!m.fonts) return
      const sheets = Api.GetSheets()
      for (let i = 0; i < sheets.length; i++) {
        const sheet = sheets[i]
        // La fuente de siempre de la hoja: la de una celda que nadie toca (la última).
        const fontOf = (range: Api): string => String(range.GetCharacters(1, 1).GetFont().GetName() || '')
        const usual = fontOf(sheet.GetRange('XFD1048576'))
        const keep: [number, number, string][] = []
        const used = sheet.GetUsedRange()
        if (used && used.GetCount() <= m.max) {
          used.ForEach(function (cell: Api) {
            const font = fontOf(cell)
            if (font && font !== usual) keep.push([cell.GetRow() - 1, cell.GetCol() - 1, font])
          })
        }
        sheet.GetCells().SetFontName(m.body)
        for (let k = 0; k < keep.length; k++) sheet.GetRangeByNumber(keep[k][0], keep[k][1]).SetFontName(keep[k][2])
      }
    }, ctx.local({ colors: inside, name: theme.name, fonts: parts.fonts, body: theme.fonts.body, max: MAX_CELLS }))
  } finally {
    const at = inside ? list!.indexOf(scheme) : -1
    if (at >= 0) list!.splice(at, 1)
  }
  if (parts.colors && !inside) ok = applyColors(ctx, theme) && ok
  return ok && (!parts.colors || String(ctx.api.asc_GetCurrentColorSchemeName?.() ?? '') === theme.name)
}

/** ¿Llama el editor de Hojas así (con su nombre traducido) a una de sus combinaciones? */
function themesNamed(ctx: FeatureContext, name: string): boolean {
  try {
    const names: unknown = ctx.api.getJsApi?.()?.GetThemesColors?.()
    return Array.isArray(names) && names.some((n) => String(n) === name)
  } catch {
    return false
  }
}

// ------------------------------------------------------- Presentaciones

function applySlide(ctx: FeatureContext, theme: OfficeTheme, parts: ThemeParts): boolean {
  if (!parts.colors && !parts.fonts) return true
  const data = {
    name: theme.name,
    colors: parts.colors ? BUILDER_COLOR_ORDER.map((k) => rgbOf(theme.colors[k])) : null,
    fonts: parts.fonts ? [theme.fonts.heading, theme.fonts.body] : null
  }
  return ctx.builder(function (scope) {
    const m = scope.molino
    const presentation = Api.GetPresentation()
    // Todos los patrones (cada uno con su tema): el diseño de las diapositivas no se toca.
    const count = presentation.GetMastersCount()
    for (let i = 0; i < count; i++) {
      const master = presentation.GetMaster(i)
      const theme = master && master.GetTheme()
      if (!theme) continue
      if (m.colors) {
        const colors: Api[] = []
        for (let k = 0; k < m.colors.length; k++) colors.push(Api.CreateRGBColor(m.colors[k][0], m.colors[k][1], m.colors[k][2]))
        theme.SetColorScheme(Api.CreateThemeColorScheme(colors, m.name))
      }
      if (m.fonts) {
        const fonts = theme.GetFontScheme()
        fonts.SetFonts(m.fonts[0], '', '', m.fonts[1], '', '')
        fonts.SetSchemeName(m.name)
        // Ponerla otra vez en el tema hace que se vuelva a calcular el texto (si no, se ve con las de antes).
        theme.SetFontScheme(fonts)
      }
    }
  }, ctx.local(data))
}

/**
 * Las fuentes del tema se cargan antes de ponerlas: Presentaciones no vuelve a
 * calcular las diapositivas cuando terminan de cargar (el texto se vería montado)
 * y Documentos, hasta que lo hace, enseña el texto sin espacios. Llama a ``then``
 * cuando se pueden poner. (Hojas ya pinta cada celda cuando llega su fuente.)
 */
export function loadThemeFonts(ctx: FeatureContext, theme: OfficeTheme, then: () => void): void {
  if (ctx.kind === 'cell' || typeof ctx.api?.asc_loadFontsFromServer !== 'function') return then()
  try {
    ctx.api.asc_loadFontsFromServer(ctx.local([theme.fonts.heading, theme.fonts.body]))
  } catch {
    return then()
  }
  setTimeout(then, FONT_LOAD_MS)
}
/** Lo que se espera a que el editor cargue las fuentes de un tema (son archivos del equipo). */
const FONT_LOAD_MS = 600

/** Pone el tema (o parte) en el documento abierto: true si se pudo. */
export function applyTheme(ctx: FeatureContext, theme: OfficeTheme, parts: ThemeParts = WHOLE_THEME): boolean {
  if (!ctx.api) return false
  try {
    if (ctx.kind === 'word') return applyWord(ctx, theme, parts)
    if (ctx.kind === 'cell') return applyCell(ctx, theme, parts)
    return applySlide(ctx, theme, parts)
  } catch {
    return false
  }
}

// -------------------------------------------------------- leer el tema

/** Una combinación de colores de la lista del editor (la del documento, la última). */
export interface SchemeInfo {
  index: number
  name: string
  /** Los 12 colores, en el orden de THEME_COLOR_KEYS. */
  colors: string[]
}

const hexOf = (c: Api): string => `#${[c.get_r(), c.get_g(), c.get_b()].map((x: number) => Number(x).toString(16).padStart(2, '0')).join('')}`

/** Las combinaciones que manda el editor (asc_onSendThemeColorSchemes), con sus 12 colores. */
export function readSchemes(schemes: Api[]): SchemeInfo[] {
  const list: SchemeInfo[] = []
  ;(schemes || []).slice(0, 300).forEach((scheme, index) => {
    try {
      const colors: Api[] = scheme.get_colors()
      if (!colors || colors.length < 12) return
      list.push({ index, name: String(scheme.get_name() ?? '').slice(0, 80) || String(index + 1), colors: colors.slice(0, 12).map(hexOf) })
    } catch {
      /* una combinación sin colores */
    }
  })
  return list
}

/** El color de un estilo leído con la API de documentos: uno del tema o el más parecido. */
function themeColorOf(color: Api, colors: Record<ThemeColorKey, string>, fallback: ThemeColorKey): ThemeColorKey {
  try {
    if (!color || color.IsAutoColor?.()) return fallback
    if (color.IsThemeColor?.()) {
      const name = String(color.GetThemeName?.() ?? '')
      if ((THEME_COLOR_KEYS as readonly string[]).includes(name)) return name as ThemeColorKey
      if (name in COLOR_ALIASES) return COLOR_ALIASES[name]
    }
    const hex = String(color.GetHex?.() ?? '').replace('#', '')
    return /^[0-9a-f]{6}$/i.test(hex) ? nearestColor(`#${hex}`, colors) : fallback
  } catch {
    return fallback
  }
}

/**
 * El tema del documento abierto (para «Guardar el de este documento como
 * tema»): sus colores, sus fuentes y, en Documentos, sus estilos. Lo que no se
 * pueda leer se queda como en ``base``.
 */
export function readDocumentTheme(ctx: FeatureContext, schemes: SchemeInfo[], base: OfficeTheme, name: string): OfficeTheme {
  const theme: OfficeTheme = structuredClone({ ...base, id: '', name })
  const api = ctx.api
  const B = api.getJsApi?.()
  // Los colores del tema del documento (la API de documentos los calcula con su tema);
  // si no, los de la combinación que tiene puesta (la lista llega al abrirlo).
  let read = 0
  for (const key of THEME_COLOR_KEYS) {
    try {
      const hex = String(B?.ThemeColor(key)?.GetHex?.() ?? '').replace('#', '')
      if (/^[0-9a-f]{6}$/i.test(hex)) {
        theme.colors[key] = `#${hex.toLowerCase()}`
        read++
      }
    } catch {
      /* ese color no */
    }
  }
  if (read < THEME_COLOR_KEYS.length) {
    try {
      const index = Number(api.asc_GetCurrentColorSchemeIndex())
      const current = schemes.find((s) => s.index === index)
      if (current) THEME_COLOR_KEYS.forEach((k, i) => (theme.colors[k] = current.colors[i]))
    } catch {
      /* sin colores */
    }
  }
  if (!B) return theme
  try {
    if (ctx.kind === 'word') {
      const doc = B.GetDocument()
      const defaults = doc.GetDefaultTextPr()
      const normal = doc.GetStyle('Normal')?.GetTextPr()
      const body = normal?.GetFontFamily?.() || defaults.GetFontFamily()
      const size = Number(normal?.GetFontSize?.() || defaults.GetFontSize()) / 2
      const heading = doc.GetStyle('Heading 1')?.GetTextPr()?.GetFontFamily?.() || body
      theme.fonts = { heading: String(heading), body: String(body) }
      if (Number.isFinite(size) && size > 0) theme.size = size
      for (const key of THEME_STYLE_KEYS) {
        const style = doc.GetStyle(WORD_STYLES[key])
        if (!style) continue
        const text = style.GetTextPr()
        const paragraph = style.GetParaPr()
        const font = String(text.GetFontFamily?.() ?? '')
        const now = theme.styles[key]
        const half = Number(text.GetFontSize?.())
        const before = Number(paragraph.GetSpacingBefore?.())
        const after = Number(paragraph.GetSpacingAfter?.())
        theme.styles[key] = {
          font: font && font === theme.fonts.body && font !== theme.fonts.heading ? 'body' : font === theme.fonts.heading ? 'heading' : now.font,
          size: Number.isFinite(half) && half > 0 ? half / 2 : now.size,
          color: themeColorOf(text.GetColor?.(), theme.colors, now.color),
          bold: Boolean(text.GetBold?.()),
          italic: Boolean(text.GetItalic?.()),
          before: Number.isFinite(before) && before >= 0 ? before / 20 : now.before,
          after: Number.isFinite(after) && after >= 0 ? after / 20 : now.after
        }
      }
    } else if (ctx.kind === 'slide') {
      const fonts = B.GetPresentation().GetMaster(0).GetTheme().GetFontScheme()
      const heading = String(fonts.GetMajorFont?.() ?? '')
      const body = String(fonts.GetMinorFont?.() ?? '')
      if (heading && body) theme.fonts = { heading, body }
    } else {
      const usual = B.GetActiveSheet().GetRange('XFD1048576').GetCharacters(1, 1).GetFont()
      const body = String(usual.GetName() ?? '')
      const size = Number(usual.GetSize())
      if (body) theme.fonts = { heading: body, body }
      if (Number.isFinite(size) && size > 0) theme.size = size
    }
  } catch {
    /* lo que no se pudo leer se queda como estaba */
  }
  return cleanTheme(theme, base) ?? theme
}
