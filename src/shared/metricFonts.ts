/**
 * Fuentes con las mismas medidas: cada letra ocupa lo mismo, así que un
 * documento corta las líneas y las páginas igual con cualquiera del grupo.
 *
 * Cuando falta la que pide un documento, los editores y x2t ponen otra de su
 * grupo: en Linux, Arial sale con Liberation Sans y Calibri con Carlito; en
 * Windows, Liberation Sans sale con Arial. Así que no se avisa de que falta.
 * Solo están las que se ha comprobado que se sustituyen así (con Arimo, Tinos
 * o Cousine, del mismo diseño, no lo hacen: ponen DejaVu).
 */
const GROUPS: readonly (readonly string[])[] = [
  ['arial', 'liberation sans', 'helvetica', 'nimbus sans l'],
  ['times new roman', 'liberation serif'],
  ['courier new', 'liberation mono'],
  ['calibri', 'carlito'],
  ['cambria', 'caladea']
]
const GROUP_OF = new Map(GROUPS.flatMap((group) => group.map((name) => [name, group] as const)))

/** ¿Se ve igual ``name`` con las familias de este equipo? (``families``, en minúsculas). */
export function fontAvailable(name: string, families: ReadonlySet<string>): boolean {
  const key = name.toLowerCase()
  return families.has(key) || (GROUP_OF.get(key)?.some((family) => families.has(family)) ?? false)
}
