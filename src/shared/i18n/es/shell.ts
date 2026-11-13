/**
 * Marco de la aplicación (App.tsx y components/: barra de título, carril de
 * modos, barras flotantes, avisos, panel lateral, recuperación…).
 */
export const shell = {
  /** Porcentaje (zoom, progreso). */
  percent: '{n} %',
  dismiss: 'Cerrar aviso',
  app: {
    dropToOpen: 'Suelta para abrir'
  },
  commands: {
    button: '¿Qué quieres hacer?',
    placeholder: 'Escribe lo que quieres hacer: «crear una tabla», «poner una foto»…',
    empty: 'No encuentro nada con eso. Prueba con otras palabras.',
    groups: {
      file: 'Archivo',
      view: 'Ver',
      modes: 'Ir a',
      annotate: 'Anotar',
      edit: 'Editar',
      form: 'Formularios',
      sign: 'Firmar',
      pages: 'Páginas',
      tools: 'Herramientas',
      help: 'Ayuda'
    },
    labels: {
      find: 'Buscar en el documento',
      close: 'Cerrar el documento',
      undo: 'Deshacer',
      redo: 'Rehacer',
      zoomIn: 'Acercar',
      zoomOut: 'Alejar',
      fitWidth: 'Ajustar al ancho',
      rotatePages: 'Girar páginas',
      deletePages: 'Eliminar páginas',
      insertPages: 'Insertar páginas',
      extractPages: 'Extraer páginas a un PDF nuevo',
      splitPdf: 'Dividir el PDF',
      reorderPages: 'Ordenar las páginas',
      duplicatePages: 'Duplicar páginas',
      fillForm: 'Rellenar el formulario',
      designForm: 'Diseñar el formulario',
      exportFormData: 'Exportar los datos del formulario'
    },
    keywords: {
      open: 'abrir archivo documento pdf cargar',
      blank: 'nuevo pdf en blanco vacio documento',
      merge: 'unir combinar juntar varios pdf archivos',
      images: 'imagenes fotos jpg png convertir a pdf',
      scan: 'escanear escaner digitalizar papel',
      save: 'guardar cambios',
      saveAs: 'guardar como copia otro nombre',
      print: 'imprimir impresora papel',
      properties: 'propiedades titulo autor informacion',
      showInFolder: 'carpeta explorador donde esta',
      find: 'buscar encontrar palabra texto',
      close: 'cerrar pestana',
      undo: 'deshacer atras',
      redo: 'rehacer',
      zoom: 'zoom tamano ver',
      highlight: 'resaltar marcador fosforito subrayar color texto',
      underline: 'subrayar texto linea',
      strikeout: 'tachar texto',
      note: 'nota comentario post-it',
      ink: 'dibujar lapiz mano alzada boligrafo',
      shape: 'forma figura dibujar',
      text: 'texto escribir anadir cuadro',
      image: 'imagen foto logo insertar',
      whiteout: 'tapar blanco borrar ocultar corrector tipex',
      content: 'editar cambiar texto existente modificar corregir',
      field: 'campo formulario rellenable crear',
      formData: 'exportar datos formulario json csv hoja de calculo',
      signature: 'firma manuscrita firmar rubrica',
      fillText: 'texto escribir rellenar',
      check: 'marca visto tick casilla',
      cross: 'aspa cruz x',
      date: 'fecha hoy dia',
      cert: 'firma digital certificado electronico dnie fnmt',
      verify: 'comprobar verificar firmas validas',
      pages: 'paginas organizar',
      ocr: 'ocr reconocer texto escaneado buscar copiar',
      redact: 'censurar tapar ocultar datos privados borrar',
      sanitize: 'limpiar metadatos ocultos privacidad',
      protect: 'proteger contrasena clave cifrar',
      unprotect: 'quitar contrasena desproteger',
      optimize: 'comprimir reducir tamano peso optimizar',
      exportImages: 'exportar imagenes jpg png',
      word: 'exportar convertir word docx editable',
      exportText: 'exportar texto txt',
      crop: 'recortar margenes',
      watermark: 'marca de agua sello confidencial',
      headerFooter: 'encabezado pie de pagina cabecera',
      pageNumbers: 'numerar paginas numeros',
      removeAdded: 'quitar marca de agua encabezado numeros',
      flatten: 'acoplar aplanar anotaciones formulario',
      settings: 'ajustes configuracion preferencias opciones tema oscuro',
      shortcuts: 'atajos teclado',
      feedback: 'comentarios sugerencia fallo error opinion',
      sponsor: 'cafe donar apoyar donacion',
      about: 'acerca de version licencia',
      ai: 'ia inteligencia artificial resumir preguntar asistente'
    }
  },
  titleBar: {
    unsaved: 'Cambios sin guardar',
    closeTab: 'Cerrar {name}',
    openOrCreate: 'Abrir o crear',
    isolation: {
      tip: 'Protección reducida',
      label: 'Protección reducida: el motor de documentos no está aislado',
      warning:
        'Windows no ha permitido aislar el motor que lee los PDF. Molino PDF funciona con normalidad, pero un PDF malicioso tendría más margen: abre solo documentos de confianza.'
    },
    undoAction: 'Deshacer: {action}',
    redoAction: 'Rehacer: {action}',
    save: 'Guardar (Ctrl+S)',
    noChanges: 'Sin cambios pendientes',
    more: 'Más',
    printTip: 'Imprimir (Ctrl+P)',
    menuTip: 'Menú',
    create: {
      open: 'Abrir…',
      blank: 'Documento en blanco…',
      merge: 'Combinar archivos…',
      images: 'Imágenes a PDF…',
      scan: 'Digitalizar documento…'
    },
    menu: {
      saveAsKbd: 'Ctrl+Mayús+S',
      print: 'Imprimir…',
      showInFolder: 'Mostrar en la carpeta',
      properties: 'Propiedades del documento',
      settings: 'Ajustes',
      shortcuts: 'Atajos de teclado',
      feedback: 'Enviar comentarios…',
      sponsor: 'Invítame a un café',
      about: 'Acerca de Molino PDF'
    }
  },
  rail: {
    label: 'Modos',
    settings: 'Ajustes',
    view: { label: 'Ver', hint: 'Leer, buscar y copiar' },
    edit: { label: 'Editar', hint: 'Texto, imágenes y contenido' },
    annotate: { label: 'Anotar', hint: 'Resaltar, notas y dibujo' },
    form: { label: 'Formulario', hint: 'Rellenar y preparar campos' },
    sign: { label: 'Firmar', hint: 'Firma manuscrita y con certificado' },
    pages: { label: 'Páginas', hint: 'Ordenar, girar, insertar y extraer' },
    tools: { label: 'Más', hint: 'OCR, proteger, comprimir, convertir…' }
  },
  toolbar: {
    label: 'Herramientas',
    select: 'Seleccionar',
    selectTip: 'Seleccionar y copiar texto',
    hand: 'Mover',
    handTip: 'Arrastrar para desplazarse',
    search: 'Buscar',
    searchTip: 'Buscar (Ctrl+F)'
  },
  findBar: {
    placeholder: 'Buscar en el documento',
    searching: 'Buscando…',
    noResults: 'Sin resultados',
    count: '{n} de {total}',
    countMore: '{n} de {total}+',
    matchCase: 'Distinguir mayúsculas',
    wholeWord: 'Palabras completas',
    previous: 'Anterior',
    next: 'Siguiente'
  },
  dock: {
    sidePanel: 'Panel lateral',
    previousPage: 'Página anterior',
    nextPage: 'Página siguiente',
    ofTotal: 'de {total}',
    zoomOut: 'Alejar',
    zoomIn: 'Acercar',
    fitWidth: 'Ajustar al ancho',
    fitPage: 'Página completa'
  },
  sidePanel: {
    outline: 'Marcadores',
    noOutline: 'Este documento no tiene marcadores.'
  },
  banner: {
    locked: 'Este documento está firmado y bloqueado: se puede ver, imprimir y exportar, pero no modificar.',
    lockedForm: 'Este documento está firmado: quien lo firmó solo permite rellenar el formulario y firmar.',
    lockedComments: 'Este documento está firmado: quien lo firmó solo permite rellenar, firmar y añadir comentarios.',
    signed: 'Este documento está firmado digitalmente.',
    invalidated: 'Este documento tenía firmas digitales que los cambios han invalidado.',
    restricted: 'El autor de este PDF ha limitado lo que se puede hacer con él.',
    viewSignatures: 'Ver firmas',
    unlock: 'Desbloquear'
  },
  busy: {
    working: 'Trabajando…'
  },
  update: {
    available: 'Hay una versión nueva de {app}',
    availableVersion: 'Hay una versión nueva de {app} ({version})',
    hint: 'Se actualiza desde la Microsoft Store.',
    update: 'Actualizar',
    notNow: 'Ahora no'
  },
  recovery: {
    title: 'Recuperar documentos',
    discardAll: 'Descartar todos',
    later: 'Más tarde',
    text: 'Molino PDF se cerró antes de guardar los cambios de estos documentos. Puedes recuperarlos y guardarlos donde quieras.',
    password: 'Contraseña del documento',
    discard: 'Descartar',
    recover: 'Recuperar'
  }
}
