/**
 * Controles comunes de los modos de trabajo (modes/common, modes/index.ts) y
 * textos que comparten los modos Editar y Anotar.
 */
export const modes = {
  colorPicker: {
    none: 'Sin color',
    custom: 'Otro color…'
  },
  numberField: {
    up: 'Subir',
    down: 'Bajar'
  },
  /** Elección de páginas de los diálogos de herramientas (modes/common/PageRange.tsx). */
  pageRange: {
    label: 'Páginas que tratar',
    all: 'Todas ({n})',
    current: 'La actual ({n})',
    some: 'Estas:',
    placeholder: 'Por ejemplo, 1-3, 5',
    error: 'Páginas del 1 al {count}, separadas por comas: 1-3, 5'
  },
  /** Páginas en blanco: documento nuevo e «Insertar» del modo Páginas (modes/common/BlankPages.tsx). */
  blankPages: {
    paper: 'Tamaño de página',
    papers: {
      same: 'Como la página anterior',
      A4: 'A4 (210 × 297 mm)',
      A3: 'A3 (297 × 420 mm)',
      A5: 'A5 (148 × 210 mm)',
      letter: 'Carta (216 × 279 mm)',
      legal: 'Legal (216 × 356 mm)'
    },
    orientation: 'Orientación',
    portrait: 'Vertical',
    landscape: 'Horizontal',
    count: 'Número de páginas'
  },
  textStyle: {
    font: 'Fuente',
    size: 'Tamaño',
    bold: 'Negrita',
    italic: 'Cursiva',
    color: 'Color del texto',
    alignLeft: 'Alinear a la izquierda',
    alignCenter: 'Centrar',
    alignRight: 'Alinear a la derecha',
    justify: 'Justificar'
  },
  select: 'Seleccionar',
  shape: 'Forma',
  shapes: {
    rect: 'Rectángulo',
    ellipse: 'Elipse',
    line: 'Línea'
  },
  color: 'Color',
  fill: 'Relleno',
  thickness: 'Grosor',
  deleteTip: 'Eliminar (Supr)',
  /** Nombre de la tecla de borrar, como aparece en los menús. */
  deleteKey: 'Supr'
}
