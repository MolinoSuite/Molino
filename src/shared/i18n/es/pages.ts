/** Modo Páginas (modes/pages): organizador de páginas y diálogo de dividir. */
export const pages = {
  rotateLeft: 'Girar a la izquierda',
  rotateRight: 'Girar a la derecha',
  unprotected: 'Los archivos creados no llevan la contraseña del documento original. Protégelos aparte si hace falta.',
  keepOne: 'Un documento debe conservar al menos una página',
  tagsRemoved: 'Se han quitado las etiquetas de accesibilidad del documento para que no quede rastro de las páginas borradas.',
  extracted: { one: 'Se han extraído {n} páginas a un PDF nuevo', other: 'Se han extraído {n} páginas a un PDF nuevo' },
  duplicate: 'Duplicar',
  duplicateTip: 'Duplicar las páginas seleccionadas',
  extract: 'Extraer',
  extractTip: 'Guardar las páginas seleccionadas como un PDF nuevo',
  deleteTip: 'Eliminar las páginas seleccionadas (Supr)',
  insert: 'Insertar',
  insertTip: 'Añadir páginas después de la selección',
  insertBlank: 'Páginas en blanco…',
  insertFile: 'Páginas de otro archivo…',
  insertBlankDialog: {
    title: 'Insertar páginas en blanco',
    run: 'Insertar'
  },
  insertFileDialog: {
    title: 'Insertar páginas de otro archivo',
    run: 'Elegir archivo e insertar',
    retry: 'Insertar',
    other: 'Elegir otro archivo…',
    pagesLabel: 'Páginas del otro archivo',
    all: 'Todas',
    some: 'Estas:',
    placeholder: 'Por ejemplo, 1-3, 5',
    badList: 'Escribe números de página separados por comas: 1-3, 5',
    hasPages: { one: 'Tiene {n} página.', other: 'Tiene {n} páginas.' },
    password: 'Contraseña del archivo'
  },
  split: 'Dividir',
  splitTip: 'Repartir el documento en varios archivos',
  selectNone: 'Quitar selección',
  selectAll: 'Seleccionar todo',
  splitDialog: {
    title: 'Dividir el documento',
    run: 'Elegir carpeta y dividir',
    busy: 'Dividiendo el documento',
    badRange: '«{part}» no es un intervalo válido. Usa por ejemplo 1-3, 4, 5-{total}.',
    noRanges: 'Indica al menos un intervalo de páginas.',
    created: { one: 'Se han creado {n} archivos', other: 'Se han creado {n} archivos' },
    each: 'Una página por archivo',
    every: 'Cada N páginas',
    ranges: 'Por intervalos',
    perFile: 'Páginas por archivo',
    rangesLabel: 'Intervalos',
    rangesHint: { one: 'Separados por comas. El documento tiene {n} páginas.', other: 'Separados por comas. El documento tiene {n} páginas.' },
    note: 'El documento abierto no se modifica: los archivos nuevos se guardan en la carpeta que elijas.'
  }
}
