/**
 * Documentos nuevos con el tema predeterminado de su app (Ajustes → General):
 * una copia de la plantilla vacía de Molino con los colores y las fuentes del
 * tema en su tema (a:clrScheme y a:fontScheme) y, en Documentos, la letra de
 * siempre y los estilos principales; en Hojas, la letra de las celdas. Así el
 * documento se abre ya con el tema, sin nada que deshacer y «sin cambios» (si el
 * editor lo pusiera al abrirlo, el documento quedaría con cambios).
 *
 * Solo se tocan las plantillas vacías de Molino (resources/templates), que son
 * pequeñas y conocidas; el tema viene de los ajustes, ya validado (store.ts), y
 * todo lo que va al XML se escapa.
 */
import { crc32, deflateRawSync, inflateRawSync } from 'node:zlib'
import { type OfficeTheme, THEME_COLOR_KEYS, type ThemeColorKey, type ThemeStyleKey } from '@shared/officeThemes'
import type { OfficeKind } from '@shared/officeui'

/** Lo más que se lee de una plantilla vacía (son de pocos KB). */
const MAX_TEMPLATE = 4 * 1024 * 1024
const MAX_ENTRIES = 200

interface ZipEntry {
  name: string
  data: Buffer
}

/** Las partes de un zip (las plantillas: sin cifrar, guardadas o comprimidas con deflate). */
function readZip(data: Buffer): ZipEntry[] | null {
  if (data.length < 22 || data.length > MAX_TEMPLATE) return null
  let end = data.length - 22
  while (end >= Math.max(0, data.length - 22 - 65_535) && data.readUInt32LE(end) !== 0x06054b50) end--
  if (end < 0 || data.readUInt32LE(end) !== 0x06054b50) return null
  const count = data.readUInt16LE(end + 10)
  if (count > MAX_ENTRIES) return null
  let at = data.readUInt32LE(end + 16)
  const out: ZipEntry[] = []
  let total = 0
  for (let i = 0; i < count; i++) {
    if (at + 46 > data.length || data.readUInt32LE(at) !== 0x02014b50) return null
    const flags = data.readUInt16LE(at + 8)
    const method = data.readUInt16LE(at + 10)
    const size = data.readUInt32LE(at + 20)
    const nameLength = data.readUInt16LE(at + 28)
    const extra = data.readUInt16LE(at + 30)
    const comment = data.readUInt16LE(at + 32)
    const offset = data.readUInt32LE(at + 42)
    const name = data.toString('utf8', at + 46, at + 46 + nameLength)
    if ((flags & 1) !== 0 || (method !== 0 && method !== 8) || offset + 30 > data.length) return null
    const start = offset + 30 + data.readUInt16LE(offset + 26) + data.readUInt16LE(offset + 28)
    if (start + size > data.length) return null
    const raw = data.subarray(start, start + size)
    const content = method === 8 ? inflateRawSync(raw, { maxOutputLength: MAX_TEMPLATE }) : Buffer.from(raw)
    total += content.length
    if (total > 4 * MAX_TEMPLATE) return null
    out.push({ name, data: content })
    at += 46 + nameLength + extra + comment
  }
  return out
}

/** Un zip con esas partes (comprimidas con deflate, como las guarda Office). */
function writeZip(entries: ZipEntry[]): Buffer {
  const parts: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0
  for (const { name, data } of entries) {
    const packed = deflateRawSync(data)
    const file = Buffer.from(name, 'utf8')
    const crc = crc32(data) >>> 0
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6)
    local.writeUInt16LE(8, 8)
    local.writeUInt16LE(0x21, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(packed.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(file.length, 26)
    const entry = Buffer.alloc(46)
    entry.writeUInt32LE(0x02014b50, 0)
    entry.writeUInt16LE(20, 4)
    entry.writeUInt16LE(20, 6)
    entry.writeUInt16LE(0x0800, 8)
    entry.writeUInt16LE(8, 10)
    entry.writeUInt16LE(0x21, 14)
    entry.writeUInt32LE(crc, 16)
    entry.writeUInt32LE(packed.length, 20)
    entry.writeUInt32LE(data.length, 24)
    entry.writeUInt16LE(file.length, 28)
    entry.writeUInt32LE(offset, 42)
    parts.push(local, file, packed)
    central.push(entry, file)
    offset += local.length + file.length + packed.length
  }
  const directory = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(directory.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...parts, directory, end])
}

/** Un texto para un atributo XML. */
function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}
const hex = (color: string): string => color.replace('#', '').toUpperCase()

// --------------------------------------------------------------- el tema

/** Los colores y las fuentes del tema en un a:theme (theme1.xml); null si no tiene la forma de siempre. */
export function patchThemeXml(xml: string, theme: OfficeTheme): string | null {
  const scheme = /<a:clrScheme\b[^>]*>[\s\S]*?<\/a:clrScheme>/
  if (!scheme.test(xml) || !/<a:majorFont>/.test(xml) || !/<a:minorFont>/.test(xml)) return null
  const colors = THEME_COLOR_KEYS.map((k) => `<a:${k}><a:srgbClr val="${hex(theme.colors[k])}"/></a:${k}>`).join('')
  // La fuente latina (sin su clasificación «panose», que era la de la otra fuente).
  const font = (part: string, typeface: string): string => part.replace(/<a:latin\b[^>]*?(?:\/>|>\s*<\/a:latin>)/, `<a:latin typeface="${esc(typeface)}"/>`)
  return xml
    .replace(scheme, `<a:clrScheme name="${esc(theme.name)}">${colors}</a:clrScheme>`)
    .replace(/<a:fontScheme\b[^>]*>/, `<a:fontScheme name="${esc(theme.name)}">`)
    .replace(/<a:majorFont>[\s\S]*?<\/a:majorFont>/, (part) => font(part, theme.fonts.heading))
    .replace(/<a:minorFont>[\s\S]*?<\/a:minorFont>/, (part) => font(part, theme.fonts.body))
}

// ---------------------------------------------------------- Documentos

/** Los nombres de los colores del tema en w:color (ST_ThemeColor). */
const WORD_THEME_COLOR: Record<ThemeColorKey, string> = {
  dk1: 'dark1',
  lt1: 'light1',
  dk2: 'dark2',
  lt2: 'light2',
  accent1: 'accent1',
  accent2: 'accent2',
  accent3: 'accent3',
  accent4: 'accent4',
  accent5: 'accent5',
  accent6: 'accent6',
  hlink: 'hyperlink',
  folHlink: 'followedHyperlink'
}
/** Los estilos que se escriben: su identificador, su nombre (el de Word), su prioridad y lo que llevan siempre. */
const WORD_STYLES: { key: ThemeStyleKey | 'heading4' | 'heading5' | 'heading6'; id: string; name: string; priority: number; outline?: number }[] = [
  { key: 'title', id: 'Title', name: 'Title', priority: 10 },
  { key: 'subtitle', id: 'Subtitle', name: 'Subtitle', priority: 11 },
  { key: 'heading1', id: 'Heading1', name: 'heading 1', priority: 9, outline: 0 },
  { key: 'heading2', id: 'Heading2', name: 'heading 2', priority: 9, outline: 1 },
  { key: 'heading3', id: 'Heading3', name: 'heading 3', priority: 9, outline: 2 },
  { key: 'heading4', id: 'Heading4', name: 'heading 4', priority: 9, outline: 3 },
  { key: 'heading5', id: 'Heading5', name: 'heading 5', priority: 9, outline: 4 },
  { key: 'heading6', id: 'Heading6', name: 'heading 6', priority: 9, outline: 5 },
  { key: 'quote', id: 'Quote', name: 'Quote', priority: 29 }
]
const rFonts = (font: string): string => `<w:rFonts w:ascii="${esc(font)}" w:eastAsia="${esc(font)}" w:hAnsi="${esc(font)}" w:cs="${esc(font)}"/>`

/** La letra de siempre y los estilos principales del tema en word/styles.xml; null si no tiene la forma de siempre. */
export function patchWordStyles(xml: string, theme: OfficeTheme): string | null {
  if (!/<w:docDefaults>[\s\S]*<w:rPrDefault>/.test(xml) || !xml.includes('</w:styles>')) return null
  const half = Math.round(theme.size * 2)
  // La letra de siempre: la del texto, con su tamaño.
  let out = xml.replace(/<w:rPrDefault>[\s\S]*?<\/w:rPrDefault>/, (part) => {
    let next = /<w:rFonts\b[^>]*\/>/.test(part) ? part.replace(/<w:rFonts\b[^>]*\/>/, rFonts(theme.fonts.body)) : part.replace('<w:rPr>', `<w:rPr>${rFonts(theme.fonts.body)}`)
    next = /<w:sz\b[^>]*\/>/.test(next) ? next.replace(/<w:sz\b[^>]*\/>/, `<w:sz w:val="${half}"/>`) : next.replace('</w:rPr>', `<w:sz w:val="${half}"/></w:rPr>`)
    next = /<w:szCs\b[^>]*\/>/.test(next) ? next.replace(/<w:szCs\b[^>]*\/>/, `<w:szCs w:val="${half}"/>`) : next.replace('</w:rPr>', `<w:szCs w:val="${half}"/></w:rPr>`)
    return next
  })
  // El estilo Normal (el de párrafo predeterminado): su identificador, para basar en él los demás.
  const tags = out.match(/<w:style\b[^>]*>/g) ?? []
  const normal = tags.find((t) => /w:type="paragraph"/.test(t) && /w:default="1"/.test(t))?.match(/w:styleId="([^"]+)"/)?.[1]
  if (!normal) return null
  const ids = new Set(tags.map((t) => t.match(/w:styleId="([^"]+)"/)?.[1] ?? ''))
  const names = new Set((out.match(/<w:name w:val="[^"]*"\/>/g) ?? []).map((n) => n.slice(15, -3).toLowerCase()))
  const added: string[] = []
  for (const spec of WORD_STYLES) {
    if (ids.has(spec.id) || names.has(spec.name.toLowerCase())) continue
    const look =
      spec.key === 'heading4' || spec.key === 'heading5' || spec.key === 'heading6'
        ? { ...theme.styles.heading3, size: theme.size, italic: spec.key === 'heading4', bold: spec.key !== 'heading6' }
        : theme.styles[spec.key]
    const font = look.font === 'heading' ? theme.fonts.heading : theme.fonts.body
    const ppr = [
      spec.outline !== undefined ? '<w:keepNext/><w:keepLines/>' : '',
      `<w:spacing w:before="${Math.round(look.before * 20)}" w:after="${Math.round(look.after * 20)}"/>`,
      spec.outline !== undefined ? `<w:outlineLvl w:val="${spec.outline}"/>` : ''
    ].join('')
    const rpr = [
      rFonts(font),
      look.bold ? '<w:b/><w:bCs/>' : '',
      look.italic ? '<w:i/><w:iCs/>' : '',
      `<w:color w:val="${hex(theme.colors[look.color])}" w:themeColor="${WORD_THEME_COLOR[look.color]}"/>`,
      `<w:sz w:val="${Math.round(look.size * 2)}"/><w:szCs w:val="${Math.round(look.size * 2)}"/>`
    ].join('')
    added.push(
      `<w:style w:type="paragraph" w:styleId="${spec.id}"><w:name w:val="${spec.name}"/><w:basedOn w:val="${esc(normal)}"/><w:next w:val="${esc(normal)}"/><w:uiPriority w:val="${spec.priority}"/><w:qFormat/><w:pPr>${ppr}</w:pPr><w:rPr>${rpr}</w:rPr></w:style>`
    )
  }
  out = out.replace('</w:styles>', `${added.join('')}</w:styles>`)
  return out
}

// ---------------------------------------------------------------- Hojas

/** La letra de las celdas (las fuentes del libro con la del texto o la de los títulos del tema). */
export function patchCellStyles(xml: string, theme: OfficeTheme): string | null {
  const fonts = /<fonts\b[^>]*>[\s\S]*?<\/fonts>/
  if (!fonts.test(xml)) return null
  return xml.replace(fonts, (part) =>
    part.replace(/<font>[\s\S]*?<\/font>/g, (font) => {
      const major = /<scheme val="major"\/>/.test(font)
      return font.replace(/<name val="[^"]*"\/>/, `<name val="${esc(major ? theme.fonts.heading : theme.fonts.body)}"/>`)
    })
  )
}

// ---------------------------------------------------------------- todo

/**
 * La plantilla vacía de una app con el tema puesto (el contenido de un .docx,
 * .xlsx o .pptx); null si no tiene la forma esperada (se abre la de siempre).
 */
export function themedTemplate(data: Buffer, kind: OfficeKind, theme: OfficeTheme): Buffer | null {
  const entries = readZip(data)
  if (!entries) return null
  const get = (name: string): ZipEntry | undefined => entries.find((e) => e.name === name)
  const patch = (name: string, change: (xml: string) => string | null): boolean => {
    const entry = get(name)
    if (!entry) return false
    const next = change(entry.data.toString('utf8'))
    if (next === null) return false
    entry.data = Buffer.from(next, 'utf8')
    return true
  }
  if (kind === 'word') {
    if (!patch('word/theme/theme1.xml', (x) => patchThemeXml(x, theme)) || !patch('word/styles.xml', (x) => patchWordStyles(x, theme))) return null
  } else if (kind === 'cell') {
    if (!patch('xl/theme/theme1.xml', (x) => patchThemeXml(x, theme)) || !patch('xl/styles.xml', (x) => patchCellStyles(x, theme))) return null
  } else {
    // Los temas de los patrones de diapositivas (no los de las notas).
    const themes = new Set<string>()
    for (const entry of entries) {
      if (!/^ppt\/slideMasters\/_rels\/slideMaster\d+\.xml\.rels$/.test(entry.name)) continue
      for (const target of entry.data.toString('utf8').match(/Target="\.\.\/theme\/theme\d+\.xml"/g) ?? []) themes.add(`ppt/theme/${target.slice(17, -1)}`)
    }
    if (!themes.size) return null
    for (const name of themes) if (!patch(name, (x) => patchThemeXml(x, theme))) return null
  }
  return writeZip(entries)
}
