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
      signature: 'Firma'
    },
    language: {
      label: 'Idioma',
      auto: 'Automático (como Windows)',
      es: 'Español',
      en: 'English',
      hint: 'Se aplica la próxima vez que abras Molino PDF.'
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
      label: 'Nombre para comentarios',
      hint: 'Se guarda como autor de las notas y anotaciones que añadas.'
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
    closeMany: {
      label: 'Al cerrar con varios archivos abiertos',
      ask: 'Preguntar',
      all: 'Cerrar todos',
      current: 'Solo el actual'
    },
    updates: {
      label: 'Versiones nuevas de Molino PDF',
      check: 'Avisarme al abrir Molino PDF si hay una versión nueva (no se descarga nada sin preguntarte)',
      checkNow: 'Buscar ahora',
      unavailable: 'Esta copia de Molino PDF no se actualiza sola.',
      checking: 'Buscando…',
      current: 'Tienes la versión más reciente.',
      downloading: 'Descargando la versión nueva…',
      ready: 'La versión nueva se instalará al cerrar Molino PDF.',
      available: 'Hay una versión nueva.',
      availableVersion: 'Hay una versión nueva: {version}.'
    },
    apps: {
      title: 'Aplicaciones de Molino',
      intro: 'Instala solo las que uses. Las que añadas funcionan sin Internet, como Molino PDF.',
      pdf: 'Molino PDF',
      pdfHint: 'Ver, rellenar, firmar y editar PDF.',
      office: 'Documentos, Hojas y Presentaciones',
      officeHint: 'Textos, hojas de cálculo y presentaciones, con archivos de Word, Excel y PowerPoint u OpenDocument. Se descargan juntas: {size} ({unpacked} en el disco).',
      installed: 'Instalada',
      added: 'Añadidas',
      add: 'Añadir ({size})',
      update: 'Actualizar ({size})',
      updateHint: 'Hay una versión nueva para este Molino.',
      downloading: 'Descargando… {done} de {total}',
      installing: 'Instalando… {done} de {total} archivos',
      cancel: 'Cancelar',
      remove: 'Quitar',
      removeConfirm: 'Se quitarán Documentos, Hojas y Presentaciones de este equipo ({size}). Tus documentos no se tocan y puedes volver a añadirlas cuando quieras.',
      noDisk: 'No hay espacio suficiente en el disco: hacen falta {size}.',
      basedOn: 'Usan el motor de ONLYOFFICE (AGPL-3.0) con los cambios de Molino.',
      errors: {
        disk: 'No hay espacio suficiente en el disco.',
        integrity: 'Lo descargado no coincide con el original y se ha borrado. Inténtalo de nuevo.',
        network: 'No se pudo descargar. Comprueba la conexión e inténtalo de nuevo.',
        cancelled: 'Cancelado.',
        restart: 'La descarga tuvo que empezar de nuevo. Inténtalo otra vez.',
        install: 'No se pudo instalar. Inténtalo de nuevo; si sigue fallando, reinicia el equipo.'
      }
    }
  },
  about: {
    title: 'Acerca de Molino PDF',
    tagline: 'Todo lo que necesitas hacer con un PDF, en un solo sitio.',
    built: 'Compilada el {date}',
    license:
      'Molino PDF es software libre: puedes redistribuirlo y modificarlo según los términos de la Licencia Pública General Affero de GNU (AGPL), versión 3 o posterior. Se ofrece SIN NINGUNA GARANTÍA, ni siquiera la implícita de comerciabilidad o de idoneidad para un propósito concreto.',
    licenseButton: 'Licencia',
    source: 'Código fuente',
    notices: 'Componentes de terceros',
    support: 'Molino PDF es gratis y lo seguirá siendo. Si te resulta útil, puedes invitarme a un café en GitHub Sponsors.',
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
