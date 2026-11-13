/**
 * Las listas de Documentos y Presentaciones (como las de Word): viñetas,
 * numeraciones y multinivel, en el formato que entiende el editor
 * (put_ListTypeCustom, el mismo de sus propias galerías). Cada nivel va un poco
 * más adentro; los niveles de dentro de una lista de un nivel siguen el
 * dibujo de Word (◦, ▪… y a), i)…).
 */

export interface BulletPreset {
  /** El carácter en su fuente (la de Word: Symbol, Wingdings, Courier New). */
  char: string
  font: string
  /** Cómo se ve en la interfaz. */
  shown: string
}

export const BULLETS: Record<string, BulletPreset> = {
  disc: { char: '·', font: 'Symbol', shown: '•' },
  circle: { char: 'o', font: 'Courier New', shown: '◦' },
  square: { char: '§', font: 'Wingdings', shown: '▪' },
  arrow: { char: 'Ø', font: 'Wingdings', shown: '➢' },
  check: { char: 'ü', font: 'Wingdings', shown: '✓' },
  diamond: { char: 'v', font: 'Wingdings', shown: '❖' },
  dash: { char: '–', font: 'Arial', shown: '–' },
  star: { char: '«', font: 'Wingdings', shown: '★' }
}

export interface NumberPreset {
  format: string
  /** El texto de cada número: %1 es el número. */
  text: string
  /** Cómo se ven los tres primeros. */
  shown: [string, string, string]
}

export const NUMBERS: Record<string, NumberPreset> = {
  decimal: { format: 'decimal', text: '%1.', shown: ['1.', '2.', '3.'] },
  decimalParen: { format: 'decimal', text: '%1)', shown: ['1)', '2)', '3)'] },
  upperLetter: { format: 'upperLetter', text: '%1.', shown: ['A.', 'B.', 'C.'] },
  lowerLetter: { format: 'lowerLetter', text: '%1)', shown: ['a)', 'b)', 'c)'] },
  upperRoman: { format: 'upperRoman', text: '%1.', shown: ['I.', 'II.', 'III.'] },
  lowerRoman: { format: 'lowerRoman', text: '%1.', shown: ['i.', 'ii.', 'iii.'] }
}

export const OUTLINES: Record<string, { shown: [string, string, string] }> = {
  decimal: { shown: ['1.', '1.1.', '1.1.1.'] },
  mixed: { shown: ['1)', 'a)', 'i)'] }
}

const LEVELS = 9
const STEP = 360
type Level = Record<string, unknown>

function indent(level: number, hanging = 360): Level {
  return { ind: { left: STEP * (level + 1), firstLine: -hanging } }
}

function bulletLevel(char: string, font: string, level: number): Level {
  return {
    lvlJc: 'left',
    suff: 'tab',
    numFmt: { val: 'bullet' },
    lvlText: char,
    pPr: indent(level),
    rPr: { rFonts: { ascii: font, cs: font, eastAsia: font, hAnsi: font } }
  }
}

function numberLevel(format: string, text: string, level: number, hanging = 360): Level {
  return { lvlJc: 'left', suff: 'tab', numFmt: { val: format }, lvlText: text, pPr: indent(level, hanging) }
}

/** Los niveles de dentro de una lista de viñetas, como en Word. */
const INNER_BULLETS = [BULLETS.circle, BULLETS.square, BULLETS.disc]
const INNER_FORMATS = ['lowerLetter', 'lowerRoman', 'decimal']

export function bulletList(id: string): object | null {
  const preset = BULLETS[id]
  if (!preset) return null
  const Lvl = Array.from({ length: LEVELS }, (_, i) => {
    const b = i === 0 ? preset : INNER_BULLETS[(i - 1) % INNER_BULLETS.length]
    return bulletLevel(b.char, b.font, i)
  })
  return { Type: 'bullet', Lvl }
}

export function numberList(id: string): object | null {
  const preset = NUMBERS[id]
  if (!preset) return null
  const Lvl = Array.from({ length: LEVELS }, (_, i) =>
    i === 0 ? numberLevel(preset.format, preset.text, 0) : numberLevel(INNER_FORMATS[(i - 1) % INNER_FORMATS.length], `%${i + 1}.`, i)
  )
  return { Type: 'number', Lvl }
}

export function outlineList(id: string): object | null {
  if (id === 'decimal') {
    // 1. · 1.1. · 1.1.1. (la de capítulos y apartados)
    const Lvl = Array.from({ length: LEVELS }, (_, i) =>
      numberLevel('decimal', Array.from({ length: i + 1 }, (_, k) => `%${k + 1}.`).join(''), i, 360 + i * 72)
    )
    return { Type: 'number', Lvl }
  }
  if (id === 'mixed') {
    const formats = ['decimal', 'lowerLetter', 'lowerRoman']
    const Lvl = Array.from({ length: LEVELS }, (_, i) => numberLevel(formats[i % 3], `%${i + 1})`, i))
    return { Type: 'number', Lvl }
  }
  return null
}

/** Una lista a medida (Personalizar lista): viñeta con su carácter, o número con su formato y su texto. */
export function customList(spec: { type: 'bullet' | 'number'; symbol?: string; format?: string; text?: string; indent?: number }): object | null {
  const step = Math.round(Math.max(0.3, Math.min(5, spec.indent ?? 0.63)) * 567)
  const at = (level: number, hanging = 360): Level => ({ ind: { left: step * (level + 1), firstLine: -hanging } })
  if (spec.type === 'bullet') {
    const char = [...(spec.symbol ?? '•')][0] ?? '•'
    const Lvl = Array.from({ length: LEVELS }, (_, i) => ({ ...bulletLevel(char, 'Arial', i), pPr: at(i) }))
    return { Type: 'bullet', Lvl }
  }
  const format = ['decimal', 'lowerLetter', 'upperLetter', 'lowerRoman', 'upperRoman'].includes(spec.format ?? '') ? spec.format! : 'decimal'
  const text = (spec.text ?? '%1.').includes('%1') ? (spec.text ?? '%1.').slice(0, 30) : '%1.'
  const Lvl = Array.from({ length: LEVELS }, (_, i) => ({ ...numberLevel(i === 0 ? format : INNER_FORMATS[(i - 1) % 3], i === 0 ? text : `%${i + 1}.`, i), pPr: at(i) }))
  return { Type: 'number', Lvl }
}

/** La lista de una orden «list» (bullet:disc, number:decimal, outline:decimal, none). */
export function listFor(value: string): object | null {
  const [kind, id = ''] = value.split(':')
  if (kind === 'none') return { Type: 'remove' }
  if (kind === 'bullet') return bulletList(id)
  if (kind === 'number') return numberList(id)
  if (kind === 'outline') return outlineList(id)
  return null
}
