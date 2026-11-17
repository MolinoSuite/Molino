/**
 * El buscador de «¿Qué quieres hacer?» (todas las apps de Molino): entiende lo
 * que se escribe como se diría, no solo el nombre exacto de la orden. Sin red
 * ni IA: unas reglas pequeñas y una lista de sinónimos.
 *
 * - Sin tildes ni mayúsculas: «tamaño» = «tamano», «Página» = «pagina».
 * - Las palabras vacías no cuentan («el», «de», «quiero», «cómo», «please»…).
 * - Los verbos de petición («crear», «poner», «añadir», «nuevo», «add»…) y las
 *   palabras de siempre («documento», «archivo») no hacen falta para encontrar
 *   la orden, pero ayudan a ordenar: «añadir una diapositiva» pone antes
 *   «Diapositiva nueva» que «Borrar la diapositiva». Si solo se escriben esas,
 *   son ellas las que se buscan.
 * - Singular y plural, y la misma raíz: «tablas», «firmar» = «firma».
 * - Comienzos de palabra mientras se escribe: «tab», «subray».
 * - Sinónimos de siempre y los de cada app: «foto» encuentra «imagen»; en
 *   Presentaciones, «página nueva» es una diapositiva.
 * - Pequeñas faltas en palabras de 5 letras o más: «tabal», «negirta».
 * - Por relevancia: primero las que tienen todas las palabras importantes;
 *   después, las que tienen las más raras (las que distinguen una orden de
 *   otra), y antes en el nombre que en las palabras clave o la pestaña.
 */

export interface SearchEntry {
  label: string
  group: string
  keywords: string
}

/** La app del buscador: cada una tiene sus sinónimos. */
export type SearchApp = 'pdf' | 'word' | 'cell' | 'slide'

/** Sin tildes ni mayúsculas (la ñ se queda en n, como al escribir sin tildes). */
export function plain(text: string): string {
  return text
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

const list = (text: string): string[] => text.split(/\s+/).filter(Boolean)

/** Palabras vacías: no dicen nada de la orden que se busca. */
const STOP = new Set(
  list(`
    un una unos unas uno el la los las lo le les de del al a en con sin para por que como cual cuales mi mis tu tus su sus me te se nos
    y o u e ni si no ya pues entonces asi tambien solo
    quiero quieres quiere queria querria quisiera necesito necesita necesitaria puedo puede podria podrias hay tengo tiene tendria
    gustaria favor porfa ayudame dime sabes saber manera
    esto esta este estos estas eso esa ese esos esas aquello ahi aqui alli donde cuando algo alguno alguna todo
    mas muy poco bastante
    the an of to in on at with for from by into onto my your our this that these those it its and or
    i we you me us want wanna would like need needs please how do does can could should let lets some any
  `)
)

/**
 * Verbos de petición y palabras de siempre: no hacen falta para encontrar la
 * orden, pero la ordenan mejor (y si no se escribe otra cosa, se buscan ellas).
 */
const WEAK = new Set(
  list(`
    crear crea creo cree hacer haz hago haga poner pon pongo ponga anadir anade anado agregar agrega agrego meter mete meto
    insertar inserta inserto incluir incluye usar usa utilizar ver mirar activar activa cambiar cambia
    nuevo nueva nuevos nuevas otro otra otros otras dos tres cuatro varios varias
    documento documentos archivo archivos fichero ficheros pdf
    create make add put insert include use set change new another two three several
    document documents file files
  `)
)

/** Las de crear y las de quitar: una petición de crear pone detrás las órdenes de quitar (y al revés). */
const CREATE = new Set(list('crear hacer poner anadir agregar meter insertar incluir nuevo nueva nuevos nuevas create make add put insert include new'))
const REMOVE = new Set(list('quitar borrar eliminar suprimir limpiar desactivar remove delete erase clear'))

/** Grupos de palabras que significan lo mismo (sin tildes), en español y en inglés. */
const SYNONYMS: string[][] = [
  ['crear', 'anadir', 'agregar', 'insertar', 'poner', 'meter', 'incluir', 'hacer', 'nuevo', 'nueva', 'create', 'add', 'insert', 'put', 'make', 'new'],
  ['tabla', 'cuadricula', 'rejilla', 'table', 'grid'],
  ['imagen', 'foto', 'fotografia', 'ilustracion', 'logo', 'picture', 'image', 'photo', 'pic'],
  ['vinculo', 'enlace', 'hipervinculo', 'link', 'hyperlink', 'url'],
  ['quitar', 'borrar', 'eliminar', 'suprimir', 'remove', 'delete', 'erase', 'clear'],
  ['buscar', 'encontrar', 'localizar', 'find', 'search', 'look'],
  ['reemplazar', 'sustituir', 'replace'],
  ['guardar', 'salvar', 'grabar', 'save'],
  ['imprimir', 'impresora', 'impresion', 'print', 'printer'],
  ['comentario', 'comentar', 'anotacion', 'comment'],
  ['negrita', 'negrilla', 'gruesa', 'grueso', 'remarcar', 'bold'],
  ['cursiva', 'italica', 'inclinada', 'italic', 'italics'],
  ['subrayado', 'subrayar', 'underline', 'underlined'],
  ['tachado', 'tachar', 'strikethrough', 'strike'],
  ['resaltar', 'resaltado', 'marcador', 'fosforito', 'subrayador', 'destacar', 'highlight', 'highlighter'],
  ['letra', 'fuente', 'tipografia', 'font', 'typeface'],
  ['tamano', 'size'],
  ['grande', 'mayor', 'aumentar', 'agrandar', 'bigger', 'larger', 'increase', 'grow'],
  ['pequena', 'pequeno', 'menor', 'disminuir', 'reducir', 'smaller', 'decrease'],
  ['color', 'colorear', 'colour'],
  ['vineta', 'punto', 'bullet', 'bulleted', 'point', 'dot'],
  ['numeracion', 'numerada', 'numerado', 'enumerar', 'numbering', 'numbered'],
  ['alinear', 'alineacion', 'align', 'alignment'],
  ['centrar', 'centrado', 'centro', 'center', 'centre'],
  ['encabezado', 'cabecera', 'header'],
  ['pie', 'footer'],
  ['grafico', 'grafica', 'diagrama', 'chart', 'graph'],
  ['formula', 'funcion', 'calcular', 'calculo', 'function', 'calculate'],
  ['promedio', 'media', 'average', 'mean'],
  ['suma', 'sumar', 'total', 'autosuma', 'sum', 'autosum'],
  ['diapositiva', 'slide'],
  ['deshacer', 'undo'],
  ['rehacer', 'redo'],
  ['acercar', 'ampliar', 'agrandar', 'zoom'],
  ['alejar', 'reducir', 'disminuir', 'shrink'],
  ['exportar', 'convertir', 'export', 'convert'],
  ['firma', 'firmar', 'rubrica', 'sign', 'signature'],
  ['certificado', 'certificate'],
  ['ocr', 'reconocer', 'escaneado', 'recognize', 'scanned'],
  ['escanear', 'digitalizar', 'escaner', 'scan', 'scanner'],
  ['unir', 'combinar', 'juntar', 'fusionar', 'merge', 'combine', 'join'],
  ['dividir', 'separar', 'partir', 'split'],
  ['girar', 'rotar', 'voltear', 'rotate', 'turn'],
  ['comprimir', 'optimizar', 'aligerar', 'compress', 'optimize', 'smaller'],
  ['contrasena', 'clave', 'password'],
  ['proteger', 'cifrar', 'protect', 'encrypt'],
  ['censurar', 'tapar', 'ocultar', 'redact', 'hide'],
  ['recortar', 'crop'],
  ['forma', 'figura', 'rectangulo', 'circulo', 'flecha', 'shape'],
  ['texto', 'escribir', 'text', 'write'],
  ['pagina', 'page'],
  ['ajustes', 'configuracion', 'preferencias', 'opciones', 'settings', 'preferences', 'options'],
  ['atajos', 'teclado', 'shortcuts', 'keyboard'],
  ['campo', 'formulario', 'rellenar', 'field', 'form', 'fill'],
  ['numero', 'number'],
  ['fecha', 'date'],
  ['fila', 'row'],
  ['columna', 'column'],
  ['celda', 'cell'],
  ['ordenar', 'orden', 'sort'],
  ['filtrar', 'filtro', 'filter'],
  ['ortografia', 'corrector', 'faltas', 'spelling'],
  ['palabras', 'contar', 'recuento', 'words', 'count'],
  ['propiedades', 'informacion', 'detalles', 'properties', 'info'],
  ['cerrar', 'salir', 'close'],
  ['presentar', 'proyectar', 'exponer', 'present', 'presentation'],
  ['duplicar', 'copiar', 'duplicate', 'copy'],
  ['abrir', 'cargar', 'open', 'load']
]

/**
 * Palabras que se usan para lo mismo sin ser lo mismo: cuentan, pero menos
 * («firmar con certificado» es antes «Firmar con certificado digital» que «Firmar»).
 */
const RELATED: string[][] = [
  ['tabla', 'cuadro', 'table', 'box'],
  ['imagen', 'dibujo', 'picture', 'image', 'drawing'],
  ['lista', 'vineta', 'punto', 'numeracion', 'list', 'bullet', 'bulleted', 'numbering'],
  ['firma', 'firmar', 'certificado', 'sign', 'signature', 'certificate'],
  ['negrita', 'resaltar', 'destacar', 'bold', 'emphasis'],
  ['nota', 'comentario', 'note', 'comment'],
  ['formula', 'funcion', 'suma', 'sumar', 'function', 'sum'],
  ['calcular', 'suma', 'sumar', 'calculate', 'sum'],
  ['proteger', 'contrasena', 'protect', 'password'],
  ['ocr', 'escaneado', 'escanear', 'digitalizar', 'scan', 'scanned']
]

/** Lo que cada app llama de otra manera: en Presentaciones, «página» u «hoja» es una diapositiva. */
const APP_SYNONYMS: Record<SearchApp, string[][]> = {
  pdf: [['pagina', 'hoja', 'page', 'sheet']],
  word: [['pagina', 'hoja', 'page', 'sheet']],
  cell: [['hoja', 'pestana', 'sheet', 'worksheet', 'tab']],
  slide: [['diapositiva', 'pagina', 'hoja', 'slide', 'page', 'sheet']]
}

/**
 * Plural fuera (tablas → tabla, luces → luz). Lo que queda de los plurales en
 * «-es» (funcione, colore, shape) lo iguala la raíz (``stem``).
 */
function singular(word: string): string {
  if (word.length > 4 && word.endsWith('ces')) return `${word.slice(0, -3)}z`
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1)
  return word
}

/** Terminaciones que no cambian lo que se pide (firmar, firmado, firma → firm). */
const ENDINGS = list('aciones acion iciones icion amiento imiento ando iendo ados adas idos idas ado ada ido ida ing ed ar er ir')

/** La raíz de una palabra (sin plural ni terminación); al menos 4 letras. */
function stem(word: string): string {
  const w = singular(word)
  for (const end of ENDINGS) if (w.length - end.length >= 4 && w.endsWith(end)) return w.slice(0, -end.length)
  return w.length > 4 && /[aeo]$/.test(w) ? w.slice(0, -1) : w
}

/** Distancia de edición (con dos letras cambiadas de sitio como una sola); deja de contar pasado ``limit``. */
function distance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1
  let before: number[] = []
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    let best = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let d = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, before[j - 2] + 1)
      row.push(d)
      best = Math.min(best, d)
    }
    if (best > limit) return limit + 1
    before = prev
    prev = row
  }
  return prev[b.length]
}

/** Cuántas faltas se perdonan: ninguna en palabras cortas, una hasta 7 letras, dos en las largas. */
const typos = (word: string): number => (word.length < 5 ? 0 : word.length < 8 ? 1 : 2)

const words = (text: string): string[] => plain(text).split(/[^a-z0-9]+/).filter(Boolean)

interface Token {
  word: string
  single: string
  stem: string
  /** Cuánto cuenta (el nombre del menú en «Menú: opción», algo menos que la opción). */
  weight: number
}
const token = (word: string, weight = 1): Token => ({ word, single: singular(word), stem: stem(word), weight })

/** Una orden, troceada para buscar. */
interface Prepared {
  label: Token[]
  /** Las palabras de su nombre que dicen algo, cada una una vez (para ver cuánto de él cubre lo escrito). */
  telling: Token[]
  keywords: Token[]
  group: Token[]
  /** Su nombre habla de crear (o de quitar). */
  create: boolean
  remove: boolean
}

/** Una palabra de lo escrito, con sus formas (ella misma y sus sinónimos) y cuánto cuenta cada una. */
interface Term {
  forms: string[]
  factors: number[]
  /** Cuántas de ``forms`` son la propia palabra (las primeras; las demás son sinónimos). */
  own: number
  weak: boolean
}

/** Cuánto cuenta un sinónimo y una palabra relacionada (la propia palabra, 1). */
const SYNONYM = 0.9
const RELATED_WORD = 0.6

/** Las palabras que significan lo mismo que cada una (también por su raíz), con las de la app, y cuánto cuentan. */
type Related = Map<string, number>
interface Synonyms {
  byWord: Map<string, Related>
  byStem: Map<string, Related>
}
function synonymMap(app: SearchApp | undefined): Synonyms {
  const byWord = new Map<string, Related>()
  const byStem = new Map<string, Related>()
  const link = (groups: string[][], factor: number): void => {
    for (const group of groups) {
      for (const word of group) {
        for (const [map, key] of [
          [byWord, word],
          [byStem, stem(word)]
        ] as const) {
          const related = map.get(key) ?? new Map<string, number>()
          for (const other of group) related.set(other, Math.max(related.get(other) ?? 0, factor))
          map.set(key, related)
        }
      }
    }
  }
  link([...SYNONYMS, ...(app ? APP_SYNONYMS[app] : [])], SYNONYM)
  link(RELATED, RELATED_WORD)
  return { byWord, byStem }
}
const SYNONYM_MAPS = new Map<string, Synonyms>()
function synonymsFor(app: SearchApp | undefined): Synonyms {
  const key = app ?? ''
  let map = SYNONYM_MAPS.get(key)
  if (!map) SYNONYM_MAPS.set(key, (map = synonymMap(app)))
  return map
}
/** Los sinónimos de una palabra (por ella, su singular o su raíz: «imágenes» → imagen, foto…). */
const synonymsOf = (synonyms: Synonyms, word: string): Related | undefined =>
  synonyms.byWord.get(word) ?? synonyms.byWord.get(singular(word)) ?? (stem(word).length >= 4 ? synonyms.byStem.get(stem(word)) : undefined)

/** Cuánto se parece una forma de lo escrito a una palabra de la orden (1, la misma; 0, nada). */
function closeness(form: string, formStem: string, own: boolean, t: Token): number {
  if (t.word === form || t.single === form) return 1
  if (formStem.length >= 4 && formStem === t.stem) return 0.85
  // Lo que se está escribiendo («tab» → tabla) o una forma más corta («firmar» → firma).
  if (form.length >= 3 && t.word.startsWith(form)) return 0.75
  if (t.word.length >= 4 && form.startsWith(t.word) && form.length - t.word.length <= 3) return 0.7
  // Una falta (solo la propia palabra: con los sinónimos, saldría de todo).
  if (own && typos(form) > 0 && t.word.length >= 4 && distance(form, t.word, typos(form)) <= typos(form)) return 0.55
  return 0
}

/** Lo mejor que encaja una palabra de lo escrito en una lista de palabras de la orden. */
function fit(term: Term, stems: string[], tokens: Token[]): number {
  let best = 0
  for (let f = 0; f < term.forms.length; f++) {
    const factor = term.factors[f]
    if (best >= factor) continue
    for (const t of tokens) {
      const value = closeness(term.forms[f], stems[f], f < term.own, t) * factor * t.weight
      if (value > best) best = value
      if (best >= factor) break
    }
  }
  return best
}

const PREPARED = new WeakMap<object, Prepared[]>()
function prepare(entries: SearchEntry[]): Prepared[] {
  let out = PREPARED.get(entries)
  if (!out) {
    out = entries.map((entry) => {
      // Sin el atajo de teclado («Negrita (Ctrl+B)»): nadie lo busca así.
      const name = entry.label.replace(/\((?:ctrl|alt|mayús|shift|f\d)[^)]*\)/gi, '')
      // «Menú: opción»: la opción cuenta entera; el nombre del menú, algo menos.
      const colon = name.indexOf(': ')
      const label = [...words(colon > 0 ? name.slice(0, colon) : '').map((w) => token(w, 0.9)), ...words(colon > 0 ? name.slice(colon + 2) : name).map((w) => token(w))]
      return {
        label,
        telling: [...new Map(label.filter((t) => t.word.length > 1 && !/^\d+$/.test(t.word) && !STOP.has(t.word)).map((t) => [t.stem, t])).values()],
        keywords: words(entry.keywords).map((w) => token(w)),
        group: words(entry.group).map((w) => token(w)),
        create: label.some((t) => CREATE.has(t.word)),
        remove: label.some((t) => REMOVE.has(t.word))
      }
    })
    PREPARED.set(entries, out)
  }
  return out
}

/**
 * Una palabra que no está en ninguna orden ni entre los sinónimos (una falta,
 * «negirta»): la más parecida de las que sí están, si la hay.
 */
function correct(word: string, vocabulary: Set<string>): string | null {
  const limit = typos(word)
  if (!limit) return null
  let best: string | null = null
  let bestDistance = limit + 1
  for (const known of vocabulary) {
    if (known.length < 4) continue
    const d = distance(word, known, limit)
    if (d < bestDistance) {
      best = known
      bestDistance = d
    }
  }
  return best
}

function terms(query: string, prepared: Prepared[], synonyms: Synonyms): Term[] {
  const out: Term[] = []
  let vocabulary: Set<string> | null = null
  for (const raw of words(query)) {
    if (STOP.has(raw)) continue
    const single = singular(raw)
    const root = stem(raw)
    let word = raw
    // Una palabra corregida (una falta) cuenta algo menos.
    let ownFactor = 1
    const weak = WEAK.has(raw) || WEAK.has(single)
    let related = synonymsOf(synonyms, raw)
    // ¿Está en alguna orden o entre los sinónimos? Si no, quizá es una falta.
    if (!weak && !related) {
      const seen = prepared.some((p) =>
        [p.label, p.keywords].some((list) => list.some((t) => t.word === raw || t.single === single || (root.length >= 4 && t.stem === root) || (raw.length >= 3 && t.word.startsWith(raw))))
      )
      if (!seen) {
        if (!vocabulary) {
          vocabulary = new Set(synonyms.byWord.keys())
          for (const p of prepared) for (const t of [...p.label, ...p.keywords]) vocabulary.add(t.single)
        }
        const near = correct(raw, vocabulary)
        if (near) {
          word = near
          ownFactor = 0.8
          related = synonymsOf(synonyms, near)
        }
      }
    }
    const own = [...new Set([raw, single, word])]
    const others = [...(related ?? new Map<string, number>())].filter(([form]) => !own.includes(form))
    out.push({
      forms: [...own, ...others.map(([form]) => form)],
      factors: [...own.map(() => ownFactor), ...others.map(([, factor]) => factor * ownFactor)],
      own: own.length,
      weak
    })
  }
  return out
}

/** Las órdenes que encajan con lo escrito, de mejor a peor. Sin nada escrito, todas. */
export function searchCommands<T extends SearchEntry>(entries: T[], query: string, app?: SearchApp): T[] {
  const prepared = prepare(entries)
  const synonyms = synonymsFor(app)
  const wanted = terms(query, prepared, synonyms)
  if (wanted.length === 0) return entries
  const strong = wanted.filter((t) => !t.weak)
  // Solo verbos o palabras de siempre («insertar», «nuevo documento»): entonces son ellas las que se buscan.
  const required = strong.length > 0 ? strong : wanted
  const queryWords = words(query)
  const asksCreate = queryWords.some((w) => CREATE.has(w))
  const asksRemove = queryWords.some((w) => REMOVE.has(w) || REMOVE.has(singular(w)))

  // Cuánto encaja cada palabra en cada orden: en el nombre cuenta entero; en las palabras clave, algo menos; en la pestaña, poco.
  const stemsOf = wanted.map((term) => term.forms.map(stem))
  const fits = prepared.map((p) =>
    wanted.map((term, i) => Math.max(fit(term, stemsOf[i], p.label), 0.7 * fit(term, stemsOf[i], p.keywords), 0.4 * fit(term, stemsOf[i], p.group)))
  )
  // Las palabras que salen en pocas órdenes distinguen más (las que salen en muchas, «texto», casi no).
  const weights = wanted.map((_, i) => {
    const found = fits.filter((f) => f[i] > 0).length
    return Math.log(1 + entries.length / (1 + found))
  })

  const scored: { entry: T; all: boolean; score: number; index: number }[] = []
  entries.forEach((entry, index) => {
    const f = fits[index]
    let all = true
    let any = false
    let score = 0
    wanted.forEach((term, i) => {
      const isRequired = required.includes(term)
      if (isRequired) {
        if (f[i] > 0) any = true
        else all = false
        score += weights[i] * f[i]
      } else score += 0.08 * weights[i] * f[i]
    })
    if (!any) return
    // Mejor si lo escrito cubre todo su nombre: «firmar el documento» es «Firmar», no «Comprobar las firmas del documento».
    const p = prepared[index]
    if (p.telling.length) {
      const covered = p.telling.filter((t) => wanted.some((term, i) => term.forms.some((form, k) => closeness(form, stemsOf[i][k], k < term.own, t) > 0))).length
      score *= 0.85 + 0.15 * (covered / p.telling.length)
    }
    // «Añadir una diapositiva» no busca «Borrar la diapositiva» (ni «quitar», «Insertar…»).
    if ((asksCreate && !asksRemove && p.remove) || (asksRemove && !asksCreate && p.create)) score *= 0.85
    scored.push({ entry, all, score, index })
  })
  return scored.sort((a, b) => Number(b.all) - Number(a.all) || b.score - a.score || a.index - b.index).map((s) => s.entry)
}
