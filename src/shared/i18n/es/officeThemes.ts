/** Textos de los temas de documento (renderer/src/office/features/themes/). */
export const officeThemes = {
  tools: {
    themes: 'Temas',
    /** En Presentaciones: los temas de Molino cambian colores y fuentes sin quitar el diseño (como las variantes de PowerPoint). */
    variants: 'Variantes',
    colors: 'Colores',
    fonts: 'Fuentes'
  },
  groups: { themes: 'Temas' },
  /** Los nombres de los temas de Molino (shared/officeThemes.ts). */
  builtIn: {
    'm-molino': 'Molino',
    'm-clasico': 'Clásico',
    'm-moderno': 'Moderno',
    'm-sobrio': 'Sobrio',
    'm-calido': 'Cálido',
    'm-fresco': 'Fresco',
    'm-elegante': 'Elegante',
    'm-tecnico': 'Técnico'
  },
  menu: {
    molino: 'De Molino',
    mine: 'Mis temas',
    /** Colores: las combinaciones que trae el editor (las de Office). */
    more: 'Más combinaciones',
    create: 'Crear un tema…',
    fromDocument: 'Guardar el de este documento como tema…',
    manage: 'Administrar los temas…',
    customFonts: 'Fuentes a medida…',
    useDefault: 'Usar «{name}» en los documentos nuevos',
    stopDefault: 'Dejar de usar «{name}» en los documentos nuevos'
  },
  colorNames: {
    dk1: 'Texto oscuro 1',
    lt1: 'Fondo claro 1',
    dk2: 'Texto oscuro 2',
    lt2: 'Fondo claro 2',
    accent1: 'Énfasis 1',
    accent2: 'Énfasis 2',
    accent3: 'Énfasis 3',
    accent4: 'Énfasis 4',
    accent5: 'Énfasis 5',
    accent6: 'Énfasis 6',
    hlink: 'Vínculo',
    folHlink: 'Vínculo visitado'
  },
  styleNames: { title: 'Título', subtitle: 'Subtítulo', heading1: 'Título 1', heading2: 'Título 2', heading3: 'Título 3', quote: 'Cita' },
  editor: {
    newTitle: 'Tema nuevo',
    editTitle: 'Editar el tema',
    fromDocumentTitle: 'Guardar el tema de este documento',
    name: 'Nombre',
    defaultName: 'Mi tema',
    copyName: '{name} (copia)',
    fonts: 'Fuentes',
    headingFont: 'Fuente de los títulos',
    bodyFont: 'Fuente del texto',
    size: 'Tamaño del texto (pt)',
    colors: 'Colores',
    styles: 'Estilos',
    stylesHint: 'Cómo se ven los títulos y las citas en Documentos. En Hojas y Presentaciones cuentan los colores y las fuentes.',
    style: 'Estilo',
    font: 'Fuente',
    headingKind: 'Títulos',
    bodyKind: 'Texto',
    styleSize: 'Tamaño',
    color: 'Color',
    bold: 'Negrita',
    italic: 'Cursiva',
    before: 'Antes',
    after: 'Después',
    preview: 'Vista previa',
    sampleTitle: 'Informe del trimestre',
    sampleSubtitle: 'Resumen para el equipo',
    sampleHeading: 'Lo más importante',
    sampleText: 'Así se ven el texto, los títulos y los colores de este tema. Puedes cambiarlo cuando quieras con',
    sampleLink: 'un vínculo',
    sampleQuote: 'Lo sencillo, bien hecho.',
    sampleHeading2: 'Próximos pasos',
    sampleText2: 'Las cifras de cada mes, con los colores de énfasis:',
    sampleTable: ['Mes', 'Ventas', 'Gastos', 'Enero', '120', '80', 'Febrero', '150', '90'],
    save: 'Guardar',
    saveApply: 'Guardar y aplicar',
    pick: 'Cambiar el color «{name}»',
    nameTaken: 'Ya tienes un tema con ese nombre.',
    alwaysFonts: 'En cualquier equipo',
    otherFonts: 'En este equipo',
    nameRequired: 'Ponle un nombre.'
  },
  manager: {
    title: 'Temas de documento',
    intro: 'Un tema cambia las fuentes, los colores y los estilos. Tus temas se guardan en Molino y valen en Documentos, Hojas y Presentaciones.',
    molino: 'De Molino',
    mine: 'Mis temas',
    none: 'Aún no tienes temas propios: crea uno o guarda el de un documento.',
    apply: 'Aplicar',
    edit: 'Editar',
    duplicate: 'Duplicar',
    remove: 'Borrar',
    more: 'Más acciones',
    create: 'Crear un tema',
    fromDocument: 'Guardar el de este documento',
    useDefault: 'Usar en los documentos nuevos',
    stopDefault: 'Dejar de usar en los documentos nuevos',
    isDefault: 'Documentos nuevos',
    removeAsk: '¿Borrar «{name}»? Los documentos que ya lo usan no cambian.',
    close: 'Cerrar'
  },
  toasts: {
    applied: 'Tema «{name}» aplicado',
    colors: 'Colores de «{name}» aplicados',
    fonts: 'Fuentes de «{name}» aplicadas',
    saved: 'Tema «{name}» guardado',
    removed: 'Tema «{name}» borrado',
    full: 'Ya tienes {n} temas: borra alguno para guardar otro.',
    defaultSet: 'Los documentos nuevos empezarán con «{name}»',
    defaultOff: 'Los documentos nuevos empezarán como siempre',
    failed: 'No se pudo aplicar el tema'
  },
  customFonts: {
    title: 'Fuentes a medida',
    intro: 'Elige la fuente de los títulos y la del texto de este documento.',
    heading: 'Títulos',
    body: 'Texto'
  },
  /** Ajustes → General (en cada app de oficina). */
  settings: {
    label: 'Tema de los documentos nuevos',
    hint: {
      word: 'Los documentos en blanco empiezan con este tema; los que creas con una plantilla, no.',
      cell: 'Los libros en blanco empiezan con este tema; los que creas con una plantilla, no.',
      slide: 'Las presentaciones en blanco empiezan con este tema; las que creas con una plantilla, no.'
    },
    none: 'El de siempre'
  },
  /** Lo que cambia un tema en cada app (se ve en el administrador). */
  scope: {
    word: 'En Documentos cambia los colores del tema, las fuentes y los estilos principales (Normal, Título, Subtítulo, Título 1 a 3 y Cita).',
    cell: 'En Hojas cambia los colores del tema y la fuente del texto de las celdas que usan la de siempre.',
    slide: 'En Presentaciones cambia los colores y las fuentes del tema sin tocar el diseño de las diapositivas.'
  },
  /** «¿Qué quieres hacer?». */
  palette: {
    apply: 'Aplicar el tema {name}',
    colors: 'Colores del tema {name}',
    fonts: 'Fuentes del tema {name}'
  },
  keywords: {
    themes: 'tema temas estilo estilos colores fuentes aspecto diseño paleta letra tipografia',
    create: 'crear tema nuevo personalizar estilo estilos colores fuentes aspecto diseño',
    fromDocument: 'guardar tema documento copiar estilo estilos colores fuentes aspecto',
    manage: 'administrar temas mis temas editar borrar duplicar predeterminado estilo colores fuentes',
    colors: 'colores tema paleta combinacion aspecto diseño',
    fonts: 'fuentes tema letra tipografia titulos texto aspecto diseño'
  }
}
