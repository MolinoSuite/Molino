/**
 * El buscador de «¿Qué quieres hacer?» (todas las apps de Molino): entiende lo
 * que se escribe como se diría, no solo el nombre exacto de la orden.
 *
 * - Sin tildes ni mayúsculas: «tamaño» = «tamano», «Página» = «pagina».
 * - Las palabras de relleno no cuentan («crear una tabla» = «tabla»); los
 *   verbos de siempre (crear, poner, añadir…) solo ayudan a ordenar.
 * - Plurales y comienzos de palabra: «tablas», «tab», «subray».
 * - Sinónimos: «foto» encuentra «imagen»; «enlace», «vínculo»; «quitar», «eliminar».
 * - Pequeñas erratas: «tabal», «imagne».
 * - Si nada tiene todas las palabras, salen las órdenes que tienen alguna.
 */

export interface SearchEntry {
  label: string
  group: string
  keywords: string
}

/** Sin tildes ni mayúsculas (la ñ se queda en n, como al escribir sin tildes). */
export function plain(text: string): string {
  return text
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/** Palabras que no dicen qué orden se busca. */
const FILLER = new Set(
  (
    'un una unos unas uno el la los las lo le les de del al a en con sin para por que como cual mi mis tu tus su sus me te se ' +
    'y o u e ni quiero quieres querria necesito necesita puedo puede podria hay ' +
    'esto esta este estos estas eso esa ese ahi aqui donde cuando algo todo toda todos todas mas muy ' +
    'the an of to in on with for my and or i want how do can'
  ).split(' ')
)

/** Verbos de siempre: no hacen falta para encontrar la orden, pero la ordenan mejor. */
const WEAK = new Set(
  (
    'crear crea creo hacer haz hago poner pon pongo anadir anade agregar agrega meter mete insertar inserta incluir usar usa ' +
    'ver mirar abrir abre activar activa cambiar cambia nuevo nueva nuevos nuevas ' +
    'create make add put insert new use open set change'
  ).split(' ')
)

/** Grupos de palabras que significan lo mismo (sin tildes). */
const SYNONYMS: string[][] = [
  ['tabla', 'cuadro', 'cuadricula', 'table'],
  ['imagen', 'foto', 'fotografia', 'picture', 'image', 'ilustracion'],
  ['vinculo', 'enlace', 'hipervinculo', 'link', 'url'],
  ['borrar', 'eliminar', 'quitar', 'suprimir', 'remove', 'delete', 'limpiar'],
  ['buscar', 'encontrar', 'localizar', 'find', 'search'],
  ['reemplazar', 'sustituir', 'replace'],
  ['guardar', 'salvar', 'grabar', 'save'],
  ['imprimir', 'impresora', 'impresion', 'print'],
  ['comentario', 'comentar', 'nota', 'anotacion', 'comment'],
  ['negrita', 'gruesa', 'grueso', 'bold'],
  ['cursiva', 'italica', 'inclinada', 'italic'],
  ['subrayado', 'subrayar', 'underline'],
  ['tachado', 'tachar', 'strikethrough'],
  ['resaltar', 'resaltado', 'marcador', 'fosforito', 'highlight', 'destacar'],
  ['letra', 'fuente', 'tipografia', 'tipo', 'font'],
  ['tamano', 'grande', 'pequeno', 'size'],
  ['color', 'colorear', 'pintar', 'colour'],
  ['lista', 'vinetas', 'vineta', 'puntos', 'numeracion', 'numerar', 'bullets'],
  ['alinear', 'alineacion', 'centrar', 'justificar', 'align'],
  ['encabezado', 'cabecera', 'header'],
  ['pie', 'footer'],
  ['grafico', 'grafica', 'diagrama', 'chart'],
  ['formula', 'funcion', 'calcular', 'calculo', 'suma', 'sumar'],
  ['diapositiva', 'transparencia', 'slide'],
  ['deshacer', 'undo'],
  ['rehacer', 'redo'],
  ['acercar', 'ampliar', 'agrandar', 'aumentar', 'zoom'],
  ['alejar', 'reducir', 'disminuir'],
  ['exportar', 'convertir', 'export', 'pasar'],
  ['firma', 'firmar', 'sign', 'signature'],
  ['ocr', 'reconocer', 'escaneado', 'escanear', 'digitalizar'],
  ['unir', 'combinar', 'juntar', 'fusionar', 'merge'],
  ['dividir', 'separar', 'partir', 'extraer', 'split'],
  ['girar', 'rotar', 'voltear', 'rotate'],
  ['comprimir', 'optimizar', 'aligerar', 'compress'],
  ['proteger', 'contrasena', 'clave', 'cifrar', 'password'],
  ['censurar', 'tapar', 'ocultar', 'redact'],
  ['recortar', 'crop'],
  ['forma', 'figura', 'rectangulo', 'circulo', 'flecha', 'shape'],
  ['texto', 'escribir', 'text'],
  ['pagina', 'paginas', 'page'],
  ['ajustes', 'configuracion', 'preferencias', 'opciones', 'settings'],
  ['atajos', 'teclado', 'shortcuts'],
  ['campo', 'formulario', 'rellenar', 'field', 'form'],
  ['marca', 'agua', 'watermark'],
  ['numero', 'numeros', 'numerar', 'number'],
  ['fecha', 'date'],
  ['fila', 'filas', 'row'],
  ['columna', 'columnas', 'column'],
  ['celda', 'celdas', 'cell'],
  ['ordenar', 'orden', 'sort'],
  ['filtrar', 'filtro', 'filter'],
  ['ortografia', 'corrector', 'faltas', 'spelling'],
  ['palabras', 'contar', 'recuento', 'words'],
  ['propiedades', 'informacion', 'detalles', 'properties'],
  ['cerrar', 'salir', 'close']
]

const SYNONYM_OF = new Map<string, string[]>()
for (const group of SYNONYMS) for (const word of group) SYNONYM_OF.set(word, group)

/** Plural fuera (tablas → tabla, celdas → celda, funciones → funcion). */
function singular(word: string): string {
  if (word.length > 5 && word.endsWith('es') && !word.endsWith('ces')) return word.slice(0, -2)
  if (word.length > 4 && word.endsWith('ces')) return `${word.slice(0, -3)}z`
  if (word.length > 3 && word.endsWith('s')) return word.slice(0, -1)
  return word
}

/** ¿Están a una (o dos, si son largas) letras de distancia? (Dos letras cambiadas de sitio, «tabal», cuentan como una.) */
function near(a: string, b: string): boolean {
  if (a.length < 5 || b.length < 4) return false
  const limit = a.length >= 8 ? 2 : 1
  if (Math.abs(a.length - b.length) > limit) return false
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)))
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[a.length][b.length] <= limit
}

/** Lo que se busca: cada palabra, con sus formas y sinónimos. */
interface Term {
  forms: string[]
  weak: boolean
}

function terms(query: string): Term[] {
  const out: Term[] = []
  for (const raw of plain(query).split(/[^a-z0-9]+/)) {
    if (!raw || FILLER.has(raw)) continue
    const word = singular(raw)
    const forms = new Set([raw, word, ...(SYNONYM_OF.get(raw) ?? []), ...(SYNONYM_OF.get(word) ?? [])])
    out.push({ forms: [...forms], weak: WEAK.has(raw) })
  }
  return out
}

/** Cuánto encaja una palabra en un texto: 3 si está, 2 si empieza así, 1 con una errata; 0 si no. */
function fit(term: Term, words: string[]): number {
  let best = 0
  for (const form of term.forms) {
    for (const word of words) {
      if (word === form || singular(word) === form) return 3
      if (form.length >= 3 && word.startsWith(form)) best = Math.max(best, 2)
      else if (word.length >= 4 && form.startsWith(word) && form.length - word.length <= 2) best = Math.max(best, 2)
      else if (best === 0 && (near(form, word) || near(form, singular(word)))) best = 1
    }
  }
  return best
}

const split = (text: string): string[] => plain(text).split(/[^a-z0-9]+/).filter(Boolean)

/** Las órdenes que encajan con lo escrito, de mejor a peor. Sin nada escrito, todas. */
export function searchCommands<T extends SearchEntry>(entries: T[], query: string): T[] {
  const wanted = terms(query)
  if (wanted.length === 0) return entries
  const strong = wanted.filter((t) => !t.weak)
  // Solo verbos («insertar»): entonces son ellos los que se buscan.
  const required = strong.length > 0 ? strong : wanted
  const scored: { entry: T; score: number; hits: number; index: number }[] = []
  entries.forEach((entry, index) => {
    const label = split(entry.label)
    const rest = split(`${entry.keywords} ${entry.group}`)
    let score = 0
    let hits = 0
    for (const term of wanted) {
      const inLabel = fit(term, label)
      const inRest = inLabel ? 0 : fit(term, rest)
      const value = inLabel ? inLabel * 2 : inRest
      if (value > 0 && required.includes(term)) hits++
      score += term.weak ? value / 2 : value
    }
    if (hits > 0) scored.push({ entry, score, hits, index })
  })
  const full = scored.filter((s) => s.hits === required.length)
  const list = full.length > 0 ? full : scored
  return list.sort((a, b) => b.hits - a.hits || b.score - a.score || a.index - b.index).map((s) => s.entry)
}
