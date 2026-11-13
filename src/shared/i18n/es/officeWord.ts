/** Textos de las funciones de Documentos (renderer/src/office/features/word.tsx). */
export const officeWord = {
  /** Los nombres de los grupos nuevos (salen en «Más»). */
  groups: {
    toc: 'Tabla de contenido',
    references: 'Títulos y referencias',
    headerFooter: 'Opciones y campos',
    chart: 'Gráfico',
    tableStyle: 'Estilo de tabla',
    language: 'Idioma',
    compare: 'Comparar',
    hfOptions: 'Opciones',
    hfGo: 'Ir a',
    hfInsert: 'Insertar',
    hfClose: 'Cerrar',
    chartType: 'Tipo',
    chartTitle: 'Título',
    mailMerge: 'Correspondencia'
  },

  /** Palabras del buscador «¿Qué quieres hacer?». */
  keywords: {
    updateFields: 'actualizar campos fecha pagina referencias',
    docLang: 'idioma lengua corrector ortografia documento',
    bookmarks: 'marcador marcadores ir a',
    navigation: 'navegacion titulos esquema panel'
  },

  // Índice: la tabla de contenido y el panel de navegación.
  toc: {
    update: 'Actualizar tabla',
    all: 'Toda la tabla',
    pages: 'Solo los números de página',
    remove: 'Quitar la tabla',
    missing: 'El documento no tiene ninguna tabla de contenido.'
  },
  nav: {
    button: 'Navegación',
    title: 'Navegación',
    empty: 'No hay títulos. Los párrafos con los estilos «Título 1», «Título 2»… salen aquí.',
    beginning: 'Principio del documento'
  },

  // Encabezado y pie de página.
  hf: {
    tab: 'Encabezado y pie',
    options: 'Opciones de encabezado',
    first: 'Primera página diferente',
    oddEven: 'Pares e impares diferentes',
    link: 'Vincular a la sección anterior',
    removeHeader: 'Quitar el encabezado',
    removeFooter: 'Quitar el pie de página',
    close: 'Cerrar',
    goHeader: 'Ir al encabezado',
    goFooter: 'Ir al pie de página'
  },

  // Campos: número de página, páginas, fecha…
  fields: {
    menu: 'Campos',
    pageOfPages: 'Página X de Y (en el pie)',
    page: 'Número de página',
    pages: 'Número de páginas',
    date: 'Fecha',
    dateLong: 'Fecha larga',
    time: 'Hora',
    update: 'Actualizar campos',
    /** «Página 3 de 10»: lo que va antes del número y entre los dos. */
    pageWord: 'Página ',
    ofWord: ' de '
  },

  // Tabla seleccionada: estilos y sombreado.
  tableStyles: {
    menu: 'Estilos de tabla',
    shading: 'Sombreado',
    loading: 'Preparando los estilos…',
    plain: 'Sin formato',
    grid: 'Cuadrícula',
    list: 'Lista',
    lined: 'Con bordes y líneas',
    custom: 'Del documento',
    other: 'Otros',
    // Para nombrar cada estilo («Grid Table 4 - Accent 1» → «Cuadrícula 4 · Énfasis 1»).
    names: {
      'Table Grid': 'Tabla con cuadrícula',
      'Plain Table': 'Sin formato',
      'Grid Table': 'Cuadrícula',
      'List Table': 'Lista',
      Light: 'clara',
      Dark: 'oscura',
      Colorful: 'de colores',
      Accent: 'Énfasis',
      'Bordered & Lined': 'Bordes y líneas',
      Bordered: 'Bordes',
      Lined: 'Líneas'
    }
  },

  // Marcadores, referencias cruzadas y títulos.
  bookmarks: {
    button: 'Marcador',
    title: 'Marcadores',
    name: 'Nombre del marcador',
    nameHint: 'Empieza por una letra; solo letras, números y «_», sin espacios.',
    add: 'Añadir',
    go: 'Ir a',
    remove: 'Eliminar',
    list: 'Marcadores del documento',
    empty: 'Aún no hay marcadores.',
    invalid: 'Ese nombre no vale para un marcador.',
    exists: 'Ya hay un marcador con ese nombre: «Añadir» lo mueve aquí.'
  },
  crossRef: {
    button: 'Referencia cruzada',
    title: 'Insertar una referencia cruzada',
    type: 'A qué',
    types: { heading: 'Título', bookmark: 'Marcador', footnote: 'Nota al pie', endnote: 'Nota al final', caption: 'Título de tabla o imagen' },
    label: 'Rótulo',
    insert: 'Insertar',
    what: 'Qué se escribe',
    refs: {
      text: 'El texto',
      page: 'El número de página',
      number: 'El número',
      noteNumber: 'El número de la nota',
      aboveBelow: '«encima» o «debajo»',
      labelNumber: 'Solo el rótulo y el número',
      captionText: 'Solo el texto del título'
    },
    link: 'Como vínculo (Ctrl+clic lleva allí)',
    which: 'Cuál',
    empty: 'No hay nada de este tipo en el documento.'
  },
  caption: {
    button: 'Insertar título',
    title: 'Insertar un título',
    intro: 'El título se numera solo («Tabla 1», «Tabla 2»…) y sirve para las referencias cruzadas.',
    label: 'Rótulo',
    labels: { table: 'Tabla', figure: 'Ilustración', equation: 'Ecuación' },
    text: 'Texto (opcional)',
    position: 'Dónde',
    above: 'Encima',
    below: 'Debajo'
  },

  // Idioma del texto (para el corrector).
  lang: {
    menu: 'Idioma',
    selection: 'Lo seleccionado',
    documentAsk: 'Idioma del documento…',
    documentTitle: 'Idioma del documento',
    documentIntro: 'El corrector revisa todo el texto en este idioma (también lo que ya está escrito).',
    language: 'Idioma',
    names: {
      'es-ES': 'Español (España)',
      'ca-ES': 'Catalán',
      'ca-ES-valencia': 'Valenciano',
      'gl-ES': 'Gallego',
      'eu-ES': 'Euskera',
      'en-GB': 'Inglés (Reino Unido)',
      'en-US': 'Inglés (Estados Unidos)',
      'fr-FR': 'Francés',
      'pt-PT': 'Portugués (Portugal)',
      'pt-BR': 'Portugués (Brasil)',
      'de-DE': 'Alemán',
      'it-IT': 'Italiano'
    }
  },

  // Comparar y combinar.
  compare: {
    menu: 'Comparar',
    compare: 'Comparar con otro documento…',
    combine: 'Combinar con otro documento…',
    compareTitle: 'Comparar documentos',
    combineTitle: 'Combinar documentos',
    compareIntro: 'Las diferencias del otro documento aparecen aquí como cambios controlados, para aceptarlas o rechazarlas.',
    combineIntro: 'Los cambios controlados y los comentarios del otro documento se juntan con los de este.',
    other: 'El otro documento',
    otherHint: 'Ábrelo antes en Documentos (Ctrl+O): sale en esta lista.',
    none: 'No hay otro documento abierto. Ábrelo en Documentos (Ctrl+O) y vuelve aquí.',
    words: 'Comparar palabras enteras (si no, letra a letra)',
    go: 'Comparar',
    goCombine: 'Combinar',
    failed: 'No se ha podido leer el otro documento.'
  },

  // Gráficos.
  chart: {
    insert: 'Gráfico',
    types: { column: 'Columnas', bar: 'Barras', line: 'Líneas', pie: 'Circular', area: 'Áreas', doughnut: 'Anillo' },
    tab: 'Gráfico',
    type: 'Tipo de gráfico',
    title: 'Título',
    titleAsk: 'Título del gráfico',
    titleLabel: 'Título',
    legend: 'Leyenda',
    legends: { bottom: 'Abajo', right: 'A la derecha', top: 'Arriba', none: 'Sin leyenda' },
    /** Los datos de ejemplo de un gráfico nuevo. */
    sample: {
      title: 'Título del gráfico',
      series: ['Serie 1', 'Serie 2', 'Serie 3'],
      categories: ['Categoría 1', 'Categoría 2', 'Categoría 3', 'Categoría 4']
    }
  },

  // Combinar correspondencia.
  mailMerge: {
    button: 'Combinar correspondencia',
    title: 'Combinar correspondencia',
    intro: 'Escribe la carta una vez y Documentos pone en cada copia los datos de una fila de la lista (un CSV con los nombres de las columnas en la primera fila).',
    pick: 'Elegir la lista (CSV)…',
    paste: 'O pega la lista aquí',
    pasteHint: 'Una fila por línea, separadas por «;», «,» o tabuladores; la primera, con los nombres.',
    use: 'Usar esta lista',
    rows: '{n} filas',
    fields: 'Campos: pulsa uno para ponerlo donde está el cursor',
    preview: 'Ver con los datos',
    previewOff: 'Ver los campos',
    highlight: 'Resaltar los campos',
    record: 'Fila {n} de {total}',
    prev: 'Anterior',
    next: 'Siguiente',
    finish: 'Para crear las copias (una por fila) hace falta que Molino guarde el documento combinado: aún no está.',
    bad: 'No se ha podido leer la lista: hace falta una fila de nombres y al menos una de datos.',
    tooBig: 'La lista es demasiado grande (como mucho {n} filas).'
  }
}
