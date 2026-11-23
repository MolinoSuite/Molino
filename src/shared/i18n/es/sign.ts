/** Modo Firmar (modes/sign): firma manuscrita, firma con certificado y comprobación de firmas. */
export const sign = {
  tools: {
    select: 'Seleccionar',
    signature: 'Firma',
    signatureTip: 'Estampar tu firma manuscrita',
    signatureItem: 'Firma {n}',
    initialsItem: 'Iniciales {n}',
    newSignature: 'Nueva firma…',
    manage: 'Gestionar firmas guardadas…',
    text: 'Texto',
    textTip: 'Escribir sobre el documento',
    check: 'Marca',
    cross: 'Aspa',
    date: 'Fecha de hoy',
    cert: 'Con certificado',
    certTip: 'Firmar con tu certificado digital',
    signatures: 'Firmas',
    signaturesTip: 'Comprobar las firmas digitales del documento',
    tramite: 'Trámite',
    tramiteTip: 'Comprobar si el documento está listo para presentarlo en una sede electrónica'
  },
  options: {
    format: 'Formato',
    dateFormat: 'Formato de la fecha',
    size: 'Tamaño',
    color: 'Color',
    clickToPlace: 'Haz clic en el documento donde quieras colocarlo',
    placeSignature: 'Haz clic o arrastra donde quieras estampar la firma',
    createFirst: 'Crea primero tu firma en el menú Firma',
    drawCertBox: 'Dibuja el recuadro donde se verá la firma',
    signInvisible: 'Firmar sin marca visible'
  },
  /** Diálogo «Nueva firma» (firma manuscrita). */
  pad: {
    title: 'Nueva firma',
    saveForReuse: 'Guardar para reutilizarla',
    use: 'Usar esta firma',
    draw: 'Dibujar',
    type: 'Escribir',
    image: 'Imagen',
    signature: 'Firma',
    initials: 'Iniciales',
    drawHint: 'Firma aquí con el ratón o el dedo',
    yourName: 'Tu nombre',
    importedAlt: 'Firma importada',
    imageHint: 'Elige una foto o escaneo de tu firma sobre papel blanco',
    noStrokes: 'No se ha encontrado ningún trazo en la imagen',
    pickImage: 'Elegir imagen…',
    whiteRemoved: 'El fondo blanco se elimina automáticamente.',
    ink: 'Tinta',
    inkBlue: 'Azul',
    inkBlack: 'Negro'
  },
  /** Diálogo «Firmas guardadas». */
  saved: {
    title: 'Firmas guardadas',
    done: 'Listo',
    empty: 'No tienes firmas guardadas.',
    alt: 'Firma guardada',
    remove: 'Eliminar esta firma',
    privacy: 'Las firmas se guardan cifradas con tu cuenta de Windows y no salen de este equipo.'
  },
  /** Diálogo «Firmar con certificado digital». */
  cert: {
    title: 'Firmar con certificado digital',
    usePfx: 'Usar un archivo .pfx…',
    sign: 'Firmar',
    signing: 'Firmando…',
    certificate: 'Certificado',
    pfxFile: 'Archivo de certificado',
    change: 'Cambiar',
    issuedBy: 'Emitido por {issuer}',
    validUntil: 'válido hasta {date}',
    notValid: 'caducado o aún no válido',
    hardware: 'en tarjeta o dispositivo',
    password: 'Contraseña del certificado',
    passwordHint: 'Solo se usa para esta firma; no se guarda.',
    wrongPassword: 'La contraseña del certificado no es correcta.',
    searching: 'Buscando certificados en este equipo…',
    none: 'No hay certificados con clave privada instalados en tu cuenta de Windows. Puedes usar un archivo .pfx o .p12.',
    searchAgain: 'Buscar de nuevo',
    /** Los dos certificados del DNIe llevan el mismo nombre: cuál es cada uno. */
    dnieSignature: 'DNIe, firma',
    dnieAuthentication: 'DNIe, autenticación',
    /** Linux: dónde está el certificado y lo que pide para firmar (en Windows lo pide Windows). */
    inFirefox: 'en Firefox',
    inChrome: 'en Chrome y Chromium',
    pin: 'PIN',
    primaryPassword: 'Contraseña principal de Firefox',
    storePassword: 'Contraseña del almacén de certificados',
    pinHint: 'Solo se usa para esta firma; no se guarda.',
    pinpad: 'Escribe el PIN en el teclado del lector cuando te lo pida.',
    pinLow: 'Quedan pocos intentos antes de que el PIN se bloquee.',
    pinFinal: 'Queda un solo intento: si el PIN no es correcto, se bloqueará.',
    pinLocked: 'El PIN de esta tarjeta está bloqueado. Desbloquéalo con el programa de la tarjeta (el del DNIe, en un punto de actualización de una comisaría).',
    dnieConsent: 'Al firmar, el DNIe te pedirá confirmarlo en otra ventana.',
    /** Motivos por los que un certificado puede no servir. */
    issue: {
      expired: 'caducado',
      notYetValid: 'aún no es válido',
      weakKey: 'clave demasiado débil',
      unsupportedKey: 'tipo de clave no admitido',
      noSigningUsage: 'no declara uso de firma',
      other: 'no sirve para firmar'
    },
    reason: 'Motivo (opcional)',
    reasonPlaceholder: 'Conforme',
    location: 'Lugar (opcional)',
    /**
     * Vista previa de la firma visible. El motor escribe estos mismos textos
     * dentro del PDF (engine/molino_engine/sign/appearance.py).
     */
    appearance: {
      signedBy: 'Firmado digitalmente por',
      date: 'Fecha: {date}',
      reason: 'Motivo: {text}',
      location: 'Lugar: {text}'
    },
    includeHandwritten: 'Incluir mi firma manuscrita',
    includeHandwrittenNone: 'Incluir mi firma manuscrita (crea una primero en el menú Firma)',
    invisible: 'La firma no dejará ninguna marca visible en las páginas, pero quedará incrustada en el documento y se podrá comprobar.',
    level: 'Tipo de firma',
    /** Tipos de firma con certificado, de menos a más. */
    levels: {
      basic: {
        title: 'Básica',
        text: 'Como AutoFirma o Adobe sin más ajustes: la fecha de la firma es la del reloj de tu equipo. No necesita Internet.'
      },
      timestamp: {
        title: 'Con sello de tiempo · recomendada',
        text: '{service} certifica la fecha y hora exactas de la firma, en lugar del reloj de tu equipo. Necesita Internet y solo recibe una huella, nunca el documento.',
        anyService: 'Un servicio de confianza'
      },
      longTerm: {
        title: 'De larga duración',
        text: 'Además guarda en el PDF la prueba de que tu certificado era válido al firmar, para que se pueda comprobar dentro de muchos años aunque haya caducado. Necesita Internet y tarda unos segundos más.'
      }
    },
    noTimestampService: 'Para firmar con sello de tiempo, elige un servicio en Ajustes → Servicio de sello de tiempo.',
    lock: 'Bloquear el documento: después no se podrá modificar ni firmar',
    unlockedHint: 'Sin bloquear se puede seguir firmando (por ejemplo, otra persona) y cualquier cambio posterior quedará a la vista al comprobar la firma.',
    withoutTimestamp: 'Firmar sin sello de tiempo',
    timestampOnly: 'Firmar solo con sello de tiempo',
    done: 'Documento firmado. Guárdalo para conservar la firma.',
    notLocked: 'Firmado, pero sin bloquear: el documento ya tenía firmas y este campo no admite bloqueo. Para bloquearlo, firma en una zona nueva.',
    /** Nombre propuesto al guardar el documento firmado; {name} es el original sin «.pdf». */
    fileName: '{name}-firmado.pdf',
    /** Botón del aviso que sale al guardar el documento firmado. */
    checkTramite: 'Comprobar'
  },
  /** Diálogo «Firmas digitales del documento». */
  check: {
    title: 'Firmas digitales del documento',
    revocation: 'Comprobar revocación en línea',
    revocationTip: 'Consulta a la autoridad de certificación si los certificados siguen en vigor',
    checking: 'Comprobando las firmas…',
    none: 'Este documento no contiene firmas digitales.',
    timestampAuthority: 'Autoridad de sellado',
    unknownSigner: 'Firmante desconocido',
    issuedBy: 'emitido por {issuer}',
    status: {
      valid: 'Firma válida',
      timestampValid: 'Sello de tiempo válido',
      timestampWarning: 'Sello de tiempo con avisos',
      warning: 'Firma válida con avisos',
      unverified: 'Firma íntegra, identidad sin verificar',
      invalid: 'Firma no válida',
      timestampInvalid: 'Sello de tiempo no válido',
      unknown: 'No se ha podido comprobar'
    }
  },
  /**
   * «Comprobar para un trámite» (modes/sign/tramite.tsx): si el PDF está listo
   * para presentarlo en una sede electrónica. Nunca se promete una conformidad
   * que no se ha comprobado: lo de PDF/A es lo que el documento dice ser y lo
   * básico que se puede mirar.
   */
  tramite: {
    title: 'Comprobar para un trámite',
    checking: 'Comprobando el documento…',
    offer: '¿Lo compruebas antes de presentarlo en la sede?',
    verdict: {
      ready: 'Listo para presentar',
      readyText: 'No hay nada que impida presentarlo. Aun así, mira los requisitos de la sede: cada una pone los suyos.',
      review: 'Revisa los avisos antes de presentarlo',
      reviewText: 'Hay cosas que alguna sede podría no aceptar. Abajo tienes qué es y cómo arreglarlo.',
      notReady: 'Aún no está listo para presentar',
      notReadyText: 'Hay problemas que impiden presentarlo. Abajo tienes qué falta y cómo arreglarlo.'
    },
    toReview: 'Por revisar',
    passed: 'Comprobado',
    signaturesTitle: 'Firmas',
    details: 'Más detalles',
    note: 'Es una comprobación básica y automática: no sustituye a los requisitos de cada sede ni a una validación completa de PDF/A.',
    /** Botones que llevan a la herramienta que lo arregla. */
    fix: {
      save: 'Guardar',
      saveAs: 'Guardar como…',
      rename: 'Guardar con otro nombre…',
      sign: 'Firmar…',
      compress: 'Comprimir…',
      clean: 'Limpiar…',
      unprotect: 'Quitar la protección'
    },
    saved: {
      saved: 'Guardado: se comprueba el archivo tal como lo vas a presentar.',
      changes: 'Tiene cambios sin guardar. Lo que se presenta es el archivo guardado: guárdalo antes.',
      new: 'Todavía no es un archivo: guárdalo para poder presentarlo.'
    },
    signatures: {
      none: 'No lleva firma digital. Si el trámite pide el documento firmado, fírmalo con tu certificado.',
      valid: { one: 'Lleva {n} firma válida.', other: 'Lleva {n} firmas válidas.' },
      invalid: 'Alguna firma no es válida o no se ha podido comprobar: mira el detalle más abajo.',
      modified: 'El documento se modificó después de firmarlo: lo que se ve puede no ser lo que se firmó.',
      untrusted: 'Las firmas están íntegras, pero este equipo no reconoce a la autoridad que emitió algún certificado: la sede podría no aceptarlo.',
      expired: 'Algún certificado ha caducado y no hay un sello de tiempo que demuestre que se firmó cuando era válido.',
      warning: 'Las firmas tienen avisos: mira el detalle más abajo.',
      stamped: 'Con sello de tiempo.',
      notStamped: 'Sin sello de tiempo: la fecha es la del equipo de quien firmó.'
    },
    /** Los datos de cada firma. */
    signature: {
      unchanged: 'Sin cambios después de firmar',
      allowed: 'Después solo se añadieron firmas o se rellenaron campos',
      changed: 'Con cambios después de firmar',
      stamp: 'Sello de tiempo del {date}',
      noStamp: 'Sin sello de tiempo',
      validUntil: 'Certificado válido hasta el {date}',
      expiredOn: 'Certificado caducado el {date}'
    },
    protection: {
      none: 'Sin contraseña ni restricciones.',
      password: 'Pide una contraseña para abrirlo: la sede no podrá leerlo. Quítala antes de presentarlo.',
      restricted: 'Está protegido con restricciones de uso (imprimir, copiar…). Algunas sedes no aceptan PDF protegidos.'
    },
    pdfa: {
      none: 'No es PDF/A. Si te lo piden así, guárdalo como PDF/A desde Documentos, Hojas o Presentaciones (Molino PDF no convierte un PDF que ya existe).',
      ok: 'Dice ser {version} y lo básico que se puede comprobar aquí está bien.',
      problems: 'Dice ser {version}, pero {list}.',
      problem: {
        outputIntent: 'le falta el perfil de color',
        fonts: 'hay letras sin incrustar',
        encrypted: 'está cifrado',
        javascript: 'lleva código JavaScript'
      }
    },
    fonts: {
      ok: 'Todas las letras van dentro del archivo.',
      missing: {
        one: 'Hay {n} letra que no va dentro del archivo ({names}): en otro equipo puede verse distinta.',
        other: 'Hay {n} letras que no van dentro del archivo ({names}): en otro equipo pueden verse distintas.'
      }
    },
    javascript: {
      ok: 'Sin código JavaScript.',
      found: 'Lleva código JavaScript. Algunas sedes rechazan los PDF con código: quítalo con «Limpiar datos ocultos».'
    },
    attachments: {
      ok: 'Sin archivos adjuntos.',
      found: {
        one: 'Lleva {n} archivo adjunto dentro. Algunas sedes no lo aceptan: si hace falta, preséntalo aparte.',
        other: 'Lleva {n} archivos adjuntos dentro. Algunas sedes no lo aceptan: si hace falta, preséntalos aparte.'
      }
    },
    size: {
      ok: 'Pesa {size}.',
      unsaved: 'Pesará unos {size}.',
      large: 'Pesa {size}. Cada sede pone su límite de tamaño (o ninguno): mira el de la tuya y, si se pasa, comprímelo.',
      /** Firmado: comprimirlo ahora anularía la firma. */
      largeSigned: 'Pesa {size}. Cada sede pone su límite de tamaño (o ninguno): mira el de la tuya. Si se pasa, comprime el documento sin firmar y fírmalo después.'
    },
    name: {
      ok: 'El nombre del archivo no da problemas.',
      issues: 'El nombre tiene {list}, que algunas sedes no aceptan. Mejor así: «{suggestion}».',
      issue: {
        accents: 'tildes o eñes',
        spaces: 'espacios',
        symbols: 'signos',
        dots: 'más de un punto',
        long: 'demasiados caracteres',
        extension: 'una extensión que no es .pdf'
      }
    },
    /** Con el documento firmado, lo que lo arregla anularía la firma. */
    signedHint: 'Arreglarlo ahora anularía la firma: hazlo en el documento sin firmar y fírmalo después.'
  }
}
