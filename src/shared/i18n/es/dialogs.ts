/**
 * Diálogos generales (components/Dialogs.tsx): contraseñas, ajustes con sus
 * pestañas, acerca de, propiedades del documento y atajos de teclado.
 */
export const dialogs = {
  password: {
    title: 'Documento protegido',
    message: '«{name}» necesita una contraseña para abrirse.',
    label: 'Contraseña',
    wrong: 'La contraseña no es correcta. Inténtalo de nuevo.'
  },
  unlock: {
    title: 'Este PDF tiene restricciones',
    message: 'Su autor ha limitado lo que se puede hacer con él. Para modificarlo, introduce la contraseña de propietario.',
    label: 'Contraseña de propietario',
    action: 'Desbloquear',
    wrong: 'Esa no es la contraseña de propietario.'
  },
  settings: {
    title: 'Ajustes',
    done: 'Listo',
    sections: 'Secciones de los ajustes',
    tabs: {
      general: 'General',
      appearance: 'Apariencia',
      apps: 'Aplicaciones',
      documents: 'Documentos',
      pdf: 'PDF',
      signature: 'Firma',
      dictionary: 'Diccionario'
    },
    language: {
      label: 'Idioma',
      auto: 'Automático (como Windows)',
      es: 'Español',
      en: 'English',
      hint: 'Se aplica la próxima vez que abras {app}.'
    },
    theme: {
      label: 'Tema',
      system: 'Como Windows',
      light: 'Claro',
      dark: 'Oscuro'
    },
    accent: {
      label: 'Color de acento',
      color: 'Color {color}'
    },
    zoom: {
      label: 'Zoom al abrir un documento',
      fitWidth: 'Ajustar al ancho',
      fitPage: 'Página completa',
      actual: '100 %'
    },
    sidebarOpen: 'Mostrar el panel de páginas al abrir',
    highlightFields: 'Resaltar los campos de formulario que se pueden rellenar',
    author: {
      label: 'Tu nombre',
      hint: 'Firma las notas de los PDF y los comentarios y cambios de los documentos. Vacío: el de tu usuario de Windows.'
    },
    signLevel: {
      label: 'Tipo de firma con certificado',
      hint: 'El que aparece elegido al firmar. Puedes cambiarlo en cada firma y Molino PDF recuerda el último que uses.',
      basic: 'Básica',
      timestamp: 'Con sello de tiempo',
      longTerm: 'De larga duración'
    },
    timestamp: {
      label: 'Servicio de sello de tiempo',
      hint: 'Certifica la fecha y hora de tus firmas con certificado. Solo recibe una huella de la firma, nunca el documento.',
      urlPlaceholder: 'Dirección RFC 3161, por ejemplo https://…',
      urlLabel: 'Dirección del servicio de sello de tiempo'
    },
    dateStyle: {
      label: 'Formato de «Fecha de hoy»',
      hint: 'La fecha que se escribe con la herramienta «Fecha de hoy» al firmar.'
    },
    defaultApp: {
      label: 'Programa para abrir PDF',
      isDefault: 'Los PDF se abren con Molino PDF.',
      use: 'Usar Molino PDF para abrir los PDF',
      confirmHint: 'Windows te pedirá confirmarlo en su Configuración.',
      ask: 'Proponérmelo al abrir Molino PDF'
    },
    developer: {
      label: 'Pestaña Programador',
      labelSlide: 'Pestaña Scripts',
      show: 'Mostrar la pestaña Programador',
      showSlide: 'Mostrar la pestaña Scripts',
      hint: {
        word: 'Controles de formulario, «Solo rellenar» y tus scripts.',
        cell: 'Validar datos, bloquear celdas, proteger la hoja y tus scripts.',
        slide: 'Escribe y ejecuta tus scripts sobre la presentación.'
      }
    },
    closeMany: {
      label: 'Al cerrar con varios archivos abiertos',
      ask: 'Preguntar',
      all: 'Cerrar todos',
      current: 'Solo el actual'
    },
    updates: {
      label: 'Versiones nuevas',
      check: 'Avisarme al abrir Molino si hay una versión nueva',
      checkNow: 'Buscar ahora',
      openStore: 'Actualizar en la Store',
      store: 'Las versiones nuevas se instalan desde la Microsoft Store; Windows también lo hace solo.',
      unavailable: 'Esta copia de Molino no mira si hay versiones nuevas.',
      checking: 'Buscando…',
      current: 'Tienes la versión más reciente.',
      available: 'Hay una versión nueva.',
      availableVersion: 'Hay una versión nueva: {version}.'
    },
    apps: {
      title: 'Aplicaciones',
      open: 'Abrir',
      current: 'Abierta',
      defaultApps: 'Predeterminada…',
      defaultAppsTip: 'Para abrir sus archivos con doble clic: abre la página de {name} en «Aplicaciones predeterminadas» de Windows.',
      dictionary: 'Diccionario personal',
      dictionaryHint: 'Las palabras que añades con «Añadir al diccionario» al corregir en Documentos, Hojas o Presentaciones: el corrector las da por buenas en todos tus documentos.',
      dictionaryCount: '{n} palabras.',
      dictionaryOne: '1 palabra.',
      dictionaryEmpty: 'Aún no has añadido ninguna.',
      dictionaryRemove: 'Quitar «{word}» del diccionario'
    }
  },
  about: {
    title: 'Acerca de {app}',
    taglines: {
      pdf: 'Todo lo que necesitas hacer con un PDF, en un solo sitio.',
      word: 'Escribe, revisa y comparte tus documentos.',
      cell: 'Cuentas, listas y datos en hojas de cálculo.',
      slide: 'Presentaciones claras sin complicarte.'
    },
    built: 'Compilada el {date}',
    license:
      '{app} es software libre: puedes redistribuirlo y modificarlo según los términos de la Licencia Pública General Affero de GNU (AGPL), versión 3 o posterior. Se ofrece SIN NINGUNA GARANTÍA, ni siquiera la implícita de comerciabilidad o de idoneidad para un propósito concreto.',
    licenseButton: 'Licencia',
    source: 'Código fuente',
    notices: 'Componentes de terceros',
    officeTitle: 'Documentos, Hojas y Presentaciones',
    officeTextOne: 'Usa una versión modificada de los editores de ONLYOFFICE (AGPL-3.0, con los términos adicionales de su §7).',
    officeText: 'Usan una versión modificada de los editores de ONLYOFFICE (AGPL-3.0, con los términos adicionales de su §7).',
    officeNotice: 'Cambios de Molino',
    officeLicense: 'Licencia de ONLYOFFICE',
    officeSource: 'Código del motor',
    officeTrademark: 'ONLYOFFICE es una marca de Ascensio System SIA. Molino no está afiliado a Ascensio System SIA ni cuenta con su respaldo.',
    support: 'Molino es gratis y lo seguirá siendo. Si te resulta útil, puedes invitarme a un café en GitHub Sponsors.',
    coffee: 'Invítame a un café'
  },
  properties: {
    title: 'Propiedades del documento',
    saveChanges: 'Guardar cambios',
    fields: {
      title: 'Título',
      author: 'Autor',
      subject: 'Asunto',
      keywords: 'Palabras clave'
    },
    rows: {
      file: 'Archivo',
      size: 'Tamaño',
      format: 'Formato',
      created: 'Creado',
      modified: 'Modificado',
      creator: 'Aplicación',
      producer: 'Generado con',
      protection: 'Protección',
      signatures: 'Firmas digitales'
    },
    notSaved: 'Sin guardar todavía',
    encrypted: 'Cifrado',
    notEncrypted: 'Sin cifrar'
  },
  shortcuts: {
    title: 'Atajos de teclado',
    keys: {
      saveAs: 'Ctrl + Mayús + S',
      wheel: 'Ctrl + rueda',
      delete: 'Supr',
      arrows: 'Flechas',
      escape: 'Esc'
    },
    saveAs: 'Guardar como',
    print: 'Imprimir',
    closeDoc: 'Cerrar el documento',
    nextDoc: 'Documento siguiente',
    undoRedo: 'Deshacer / Rehacer',
    find: 'Buscar',
    zoom: 'Acercar o alejar',
    fit: 'Ajustar al ancho / 100 %',
    deleteSelection: 'Eliminar lo seleccionado',
    moveSelection: 'Mover lo seleccionado',
    escape: 'Soltar la herramienta o la selección'
  }
}
