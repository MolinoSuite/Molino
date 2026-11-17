/**
 * Temas de documento de Documentos, Hojas y Presentaciones (como Diseño → Temas
 * de Office): las fuentes de títulos y de texto, el tamaño del texto, los 12
 * colores del tema y el aspecto de los estilos principales. Los de Molino van
 * aquí; los del usuario, en sus ajustes (store.ts los valida con el mismo
 * contrato). Lo que se hace con ellos en cada editor: renderer/src/office/features/themes/.
 */

/** Los 12 colores de un tema, en el orden de OOXML (a:clrScheme). */
export const THEME_COLOR_KEYS = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'] as const
export type ThemeColorKey = (typeof THEME_COLOR_KEYS)[number]

/** Los estilos que lleva un tema (en Documentos; en Hojas y Presentaciones solo cuentan colores y fuentes). */
export const THEME_STYLE_KEYS = ['title', 'subtitle', 'heading1', 'heading2', 'heading3', 'quote'] as const
export type ThemeStyleKey = (typeof THEME_STYLE_KEYS)[number]

/** El aspecto de un estilo: qué fuente del tema usa, tamaño (pt), color del tema, negrita, cursiva y espacio antes y después (pt). */
export interface OfficeThemeStyle {
  font: 'heading' | 'body'
  size: number
  color: ThemeColorKey
  bold: boolean
  italic: boolean
  before: number
  after: number
}

export interface OfficeTheme {
  /** Los de Molino: «m-…»; los del usuario: 16 cifras hexadecimales. */
  id: string
  name: string
  fonts: { heading: string; body: string }
  /** El tamaño del texto normal, en puntos. */
  size: number
  /** #rrggbb */
  colors: Record<ThemeColorKey, string>
  styles: Record<ThemeStyleKey, OfficeThemeStyle>
}

/** Cuántos temas propios se guardan, como mucho. */
export const MAX_USER_THEMES = 40
export const THEME_NAME_MAX = 60
export const THEME_FONT_MAX = 64
/** Los límites de los tamaños (pt) y del espacio antes y después (pt). */
export const THEME_SIZE = { min: 6, max: 96 } as const
export const THEME_SPACE = { min: 0, max: 72 } as const
export const USER_THEME_ID = /^[0-9a-f]{16}$/
export const MOLINO_THEME_ID = /^m-[a-z]{2,20}$/
const HEX = /^#[0-9a-f]{6}$/i
/** Un nombre de fuente: letras, números, espacios y poco más (nada de control ni de comillas). */
const FONT_NAME = /^[\p{L}\p{N}][\p{L}\p{N} ._&+-]{0,63}$/u

/**
 * Fuentes que hay siempre: las que trae Molino (Inter) y la pieza de oficina
 * (Open Sans, Carlito, Caladea) y las de cualquier Windows. Los temas de Molino
 * solo usan estas.
 */
export const ALWAYS_FONTS = [
  'Inter',
  'Open Sans',
  'Carlito',
  'Caladea',
  'Arial',
  'Calibri',
  'Cambria',
  'Candara',
  'Consolas',
  'Constantia',
  'Corbel',
  'Franklin Gothic Medium',
  'Georgia',
  'Palatino Linotype',
  'Segoe UI',
  'Tahoma',
  'Times New Roman',
  'Trebuchet MS',
  'Verdana'
] as const

const style = (font: 'heading' | 'body', size: number, color: ThemeColorKey, bold: boolean, before: number, after: number, italic = false): OfficeThemeStyle => ({
  font,
  size,
  color,
  bold,
  italic,
  before,
  after
})
const palette = (hex: string[]): Record<ThemeColorKey, string> => Object.fromEntries(THEME_COLOR_KEYS.map((k, i) => [k, hex[i]])) as Record<ThemeColorKey, string>

/**
 * Los temas de Molino (sus nombres, en los textos: L.officeThemes.builtIn). Cada
 * uno con su carácter: el de la casa, uno clásico con remates, uno moderno y
 * vivo, uno sobrio, uno cálido, uno fresco, uno elegante y uno técnico.
 */
export const MOLINO_THEMES: OfficeTheme[] = [
  {
    id: 'm-molino',
    name: 'Molino',
    fonts: { heading: 'Inter', body: 'Inter' },
    size: 11,
    colors: palette(['#1f2328', '#ffffff', '#2b313b', '#f3f1ee', '#c4505a', '#2867d1', '#2a9358', '#e06a1a', '#7a5af5', '#0f9d8a', '#2867d1', '#7a5af5']),
    styles: {
      title: style('heading', 28, 'dk2', true, 0, 6),
      subtitle: style('body', 14, 'accent1', false, 0, 12),
      heading1: style('heading', 16, 'accent1', true, 18, 6),
      heading2: style('heading', 13, 'dk2', true, 14, 4),
      heading3: style('heading', 12, 'accent1', true, 12, 3),
      quote: style('body', 11, 'dk2', false, 8, 8, true)
    }
  },
  {
    id: 'm-clasico',
    name: 'Clásico',
    fonts: { heading: 'Georgia', body: 'Cambria' },
    size: 11,
    colors: palette(['#1b1b1b', '#ffffff', '#1f3864', '#eeece1', '#2e4a7d', '#8b2635', '#b08d3c', '#4f6d3a', '#5b5f97', '#8c6e5d', '#2e4a7d', '#8b2635']),
    styles: {
      title: style('heading', 26, 'dk2', false, 0, 6),
      subtitle: style('heading', 14, 'accent2', false, 0, 12, true),
      heading1: style('heading', 16, 'dk2', true, 18, 6),
      heading2: style('heading', 13, 'accent1', true, 14, 4),
      heading3: style('heading', 12, 'accent2', false, 12, 3, true),
      quote: style('body', 11, 'accent2', false, 8, 8, true)
    }
  },
  {
    id: 'm-moderno',
    name: 'Moderno',
    fonts: { heading: 'Segoe UI', body: 'Segoe UI' },
    size: 10.5,
    colors: palette(['#111827', '#ffffff', '#0f172a', '#f1f5f9', '#2563eb', '#db2777', '#f59e0b', '#10b981', '#8b5cf6', '#06b6d4', '#2563eb', '#8b5cf6']),
    styles: {
      title: style('heading', 30, 'accent1', true, 0, 4),
      subtitle: style('body', 14, 'accent2', false, 0, 14),
      heading1: style('heading', 18, 'accent1', true, 20, 6),
      heading2: style('heading', 14, 'accent2', true, 14, 4),
      heading3: style('heading', 12, 'dk2', true, 12, 3),
      quote: style('body', 11, 'accent5', false, 8, 8, true)
    }
  },
  {
    id: 'm-sobrio',
    name: 'Sobrio',
    fonts: { heading: 'Arial', body: 'Arial' },
    size: 10.5,
    colors: palette(['#222222', '#ffffff', '#3a3a3a', '#ededed', '#4a5568', '#718096', '#2b6cb0', '#a0aec0', '#2d3748', '#9c4221', '#2b6cb0', '#4a5568']),
    styles: {
      title: style('heading', 24, 'dk1', true, 0, 6),
      subtitle: style('body', 13, 'accent2', false, 0, 12),
      heading1: style('heading', 15, 'dk1', true, 16, 6),
      heading2: style('heading', 12.5, 'accent1', true, 12, 4),
      heading3: style('heading', 11, 'accent1', true, 10, 3),
      quote: style('body', 10.5, 'accent2', false, 8, 8, true)
    }
  },
  {
    id: 'm-calido',
    name: 'Cálido',
    fonts: { heading: 'Constantia', body: 'Candara' },
    size: 11,
    colors: palette(['#2b2118', '#ffffff', '#5a3e2b', '#f6efe6', '#c0582b', '#d9a441', '#7a8b3d', '#a23e48', '#8c5e3c', '#3e7c7b', '#a23e48', '#8c5e3c']),
    styles: {
      title: style('heading', 28, 'accent1', true, 0, 6),
      subtitle: style('heading', 14, 'dk2', false, 0, 12, true),
      heading1: style('heading', 16, 'accent1', true, 18, 6),
      heading2: style('heading', 13, 'dk2', true, 14, 4),
      heading3: style('heading', 12, 'accent4', true, 12, 3),
      quote: style('heading', 11.5, 'accent1', false, 8, 8, true)
    }
  },
  {
    id: 'm-fresco',
    name: 'Fresco',
    fonts: { heading: 'Trebuchet MS', body: 'Trebuchet MS' },
    size: 10.5,
    colors: palette(['#10282e', '#ffffff', '#164e63', '#ecfeff', '#0ea5a4', '#38bdf8', '#84cc16', '#f472b6', '#facc15', '#6366f1', '#0e7490', '#6366f1']),
    styles: {
      title: style('heading', 28, 'dk2', true, 0, 4),
      subtitle: style('body', 14, 'accent1', false, 0, 12),
      heading1: style('heading', 16, 'accent1', true, 18, 6),
      heading2: style('heading', 13, 'accent2', true, 14, 4),
      heading3: style('heading', 11.5, 'dk2', true, 12, 3),
      quote: style('body', 11, 'accent1', false, 8, 8, true)
    }
  },
  {
    id: 'm-elegante',
    name: 'Elegante',
    fonts: { heading: 'Palatino Linotype', body: 'Palatino Linotype' },
    size: 11,
    colors: palette(['#1a1a1a', '#ffffff', '#2e2a3a', '#f4f2f7', '#5b3a6e', '#a67c52', '#4b6584', '#8e7dbe', '#3c6e71', '#b23a48', '#5b3a6e', '#8e7dbe']),
    styles: {
      title: style('heading', 30, 'accent1', false, 0, 6),
      subtitle: style('heading', 14, 'accent2', false, 0, 14, true),
      heading1: style('heading', 17, 'accent1', false, 20, 6),
      heading2: style('heading', 13.5, 'dk2', true, 14, 4),
      heading3: style('heading', 12, 'accent2', false, 12, 3, true),
      quote: style('heading', 12, 'accent1', false, 10, 10, true)
    }
  },
  {
    id: 'm-tecnico',
    name: 'Técnico',
    fonts: { heading: 'Consolas', body: 'Calibri' },
    size: 11,
    colors: palette(['#0b1220', '#ffffff', '#1e293b', '#e2e8f0', '#0284c7', '#16a34a', '#ea580c', '#9333ea', '#dc2626', '#0891b2', '#0284c7', '#9333ea']),
    styles: {
      title: style('heading', 24, 'dk2', true, 0, 6),
      subtitle: style('body', 13, 'accent1', false, 0, 12),
      heading1: style('heading', 15, 'accent1', true, 16, 6),
      heading2: style('heading', 12.5, 'accent2', true, 12, 4),
      heading3: style('heading', 11, 'dk2', true, 10, 3),
      quote: style('body', 11, 'accent1', false, 8, 8, true)
    }
  }
]

function num(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n * 2) / 2)) : fallback
}

/** Un nombre de fuente que vale (o null). */
export function cleanFont(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const font = value.trim().replace(/\s+/g, ' ')
  return font.length > 0 && font.length <= THEME_FONT_MAX && FONT_NAME.test(font) ? font : null
}

/**
 * Un tema que llega de fuera (del documento, de un cuadro, de los ajustes):
 * se rehace con lo que vale y se completa con el de Molino; null si no tiene
 * ni nombre ni fuentes que valgan.
 */
export function cleanTheme(raw: unknown, base: OfficeTheme = MOLINO_THEMES[0]): OfficeTheme | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const name = typeof r.name === 'string' ? r.name.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, THEME_NAME_MAX) : ''
  const fonts = (r.fonts ?? {}) as Record<string, unknown>
  const heading = cleanFont(fonts.heading)
  const body = cleanFont(fonts.body)
  if (!name || !heading || !body) return null
  const id = typeof r.id === 'string' && (USER_THEME_ID.test(r.id) || MOLINO_THEME_ID.test(r.id)) ? r.id : ''
  const colorsIn = (r.colors ?? {}) as Record<string, unknown>
  const colors = Object.fromEntries(
    THEME_COLOR_KEYS.map((k) => {
      const c = colorsIn[k]
      return [k, typeof c === 'string' && HEX.test(c) ? c.toLowerCase() : base.colors[k]]
    })
  ) as Record<ThemeColorKey, string>
  const stylesIn = (r.styles ?? {}) as Record<string, unknown>
  const styles = Object.fromEntries(
    THEME_STYLE_KEYS.map((k) => {
      const s = (stylesIn[k] ?? {}) as Record<string, unknown>
      const b = base.styles[k]
      return [
        k,
        {
          font: s.font === 'heading' || s.font === 'body' ? s.font : b.font,
          size: num(s.size, THEME_SIZE.min, THEME_SIZE.max, b.size),
          color: (THEME_COLOR_KEYS as readonly string[]).includes(String(s.color)) ? (s.color as ThemeColorKey) : b.color,
          bold: typeof s.bold === 'boolean' ? s.bold : b.bold,
          italic: typeof s.italic === 'boolean' ? s.italic : b.italic,
          before: num(s.before, THEME_SPACE.min, THEME_SPACE.max, b.before),
          after: num(s.after, THEME_SPACE.min, THEME_SPACE.max, b.after)
        }
      ]
    })
  ) as Record<ThemeStyleKey, OfficeThemeStyle>
  return { id, name, fonts: { heading, body }, size: num(r.size, THEME_SIZE.min, THEME_SIZE.max, base.size), colors, styles }
}

/** Un tema por su identificador: de Molino o de los del usuario. */
export function findTheme(id: string | undefined, own: readonly OfficeTheme[]): OfficeTheme | null {
  if (!id) return null
  return MOLINO_THEMES.find((t) => t.id === id) ?? own.find((t) => t.id === id) ?? null
}
