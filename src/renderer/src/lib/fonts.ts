import type { FontFamily } from '@shared/types'

const loaded = new Set<string>()

/**
 * Aptos no viene con Windows: el proceso principal la sirve en
 * molino://app/fonts/… (ver src/main/fonts.ts). Se carga aquí para que lo que se
 * ve al escribir coincida con lo que el motor escribe en el PDF.
 */
export async function loadExtraFontFaces(fonts: FontFamily[]): Promise<void> {
  // Aptos (del equipo) e Inter (la de Molino): las dos se sirven en molino://app/fonts/…
  for (const family of ['Aptos', 'Inter']) {
    const found = fonts.find((font) => font.family === family)
    if (!found || loaded.has(family)) continue
    loaded.add(family)
    const variants: [string, FontFaceDescriptors][] = [
      ['regular', {}],
      ...(found.bold ? ([['bold', { weight: '700' }]] as [string, FontFaceDescriptors][]) : []),
      ...(found.italic ? ([['italic', { style: 'italic' }]] as [string, FontFaceDescriptors][]) : []),
      ...(found.boldItalic ? ([['boldItalic', { weight: '700', style: 'italic' }]] as [string, FontFaceDescriptors][]) : [])
    ]
    for (const [style, descriptors] of variants) {
      try {
        const face = new FontFace(family, `url(molino://app/fonts/${family.toLowerCase()}-${style}.ttf)`, descriptors)
        document.fonts.add(await face.load())
      } catch {
        // La vista previa usará otra fuente; el PDF lleva la de verdad igualmente.
      }
    }
  }
}
