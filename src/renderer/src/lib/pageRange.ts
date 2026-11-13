/** Máximo de páginas que admite el motor en una lista (engine/molino_engine/ops/pages.py, MAX_PAGES). */
export const MAX_PAGE_NUMBER = 100_000

/**
 * «1-3, 5, 8-» → posiciones (desde 0), en ese orden y sin repetir; null si no
 * se entiende o se sale del documento. Solo admite cifras, guiones, comas,
 * punto y coma y espacios: cualquier otra cosa invalida la lista entera.
 *
 * Con ``count`` null (otro archivo, de tamaño aún desconocido) no se admiten
 * intervalos abiertos («8-») y el tope es el del motor: será el motor quien
 * diga si el archivo tiene esas páginas.
 */
export function parsePageList(text: string, count: number | null): number[] | null {
  if (text.length > 500) return null
  const parts = text
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length === 0) return null
  const limit = count ?? MAX_PAGE_NUMBER
  const out: number[] = []
  const seen = new Set<number>()
  for (const part of parts) {
    const match = /^(\d{1,6})(\s*-\s*(\d{1,6})?)?$/.exec(part)
    if (!match) return null
    const from = Number(match[1])
    if (match[2] && !match[3] && count === null) return null
    const to = match[2] ? (match[3] ? Number(match[3]) : limit) : from
    if (from < 1 || to < from || to > limit) return null
    for (let page = from; page <= to; page++) {
      if (seen.has(page)) continue
      seen.add(page)
      out.push(page - 1)
    }
  }
  return out
}
