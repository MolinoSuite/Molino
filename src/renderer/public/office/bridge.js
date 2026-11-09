// Puente entre los editores de ONLYOFFICE y Molino (Documentos, Hojas y Presentaciones).
//
// En la app de escritorio de ONLYOFFICE, window.AscDesktopEditor es código
// nativo. En Molino es este archivo: lo sirve molino://office/ y se carga el
// primero en cada página de los editores (src/main/officewin.ts lo añade). Habla
// con el proceso principal por window.molinoHost (src/preload/office.ts), que
// solo da acceso al documento de esta ventana.
//
// Los métodos que Molino no tiene no existen: el editor comprueba si están
// antes de usarlos, y fingir que existen cambia lo que hace.
(() => {
  'use strict'
  const w = window
  const host = w.molinoHost
  if (!host || w.AscDesktopEditor) return

  const where = w.top === w ? 'exterior' : 'editor'
  const log = (...parts) => host.log(`[${where}] ${parts.join(' ')}`)
  w.addEventListener('error', (e) => log('error:', e.message, e.lineno || ''))
  w.addEventListener('unhandledrejection', (e) => log('promesa:', String(e.reason).slice(0, 200)))

  const info = host.info
  const MEDIA_NAME = /^[A-Za-z0-9_-]{1,64}\.(png|jpe?g|gif|bmp|tiff?|svg|webp|emf|wmf|wdp)$/i

  // -- imágenes del documento -------------------------------------------------
  // El editor las pide a file:///doc/media/<nombre>; se sirven desde el motor.
  const MEDIA = 'file:///doc/media/'
  const imageSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')
  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    configurable: true,
    enumerable: true,
    get: imageSrc.get,
    set(value) {
      if (typeof value === 'string' && value.startsWith(MEDIA)) {
        value = `molino://office/__doc__/${info.doc}/media/${encodeURIComponent(value.slice(MEDIA.length))}`
      }
      imageSrc.set.call(this, value)
    }
  })

  // -- fuentes ------------------------------------------------------------------
  // El editor pide cada fuente a ascdesktop://fonts/<archivo del índice>.
  const FONTS = 'ascdesktop://fonts/'
  const xhrOpen = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function (method, url) {
    if (typeof url === 'string' && url.startsWith(FONTS)) {
      arguments[1] = `molino://office/__fonts__/${encodeURIComponent(url.slice(FONTS.length))}`
    }
    return xhrOpen.apply(this, arguments)
  }

  w.RendererProcessVariable = { theme: { id: 'theme-light', type: 'light', system: 'light' }, rtl: false }

  const editor = () => (w.Asc && w.Asc.editor) || w.editor
  let saved = true
  let delivered = false
  // Cuántos cambios hay apuntados (como m_nCurrentChangesIndex del nativo).
  let applied = 0

  const impl = {
    // --- abrir: el editor ya cargado pide el documento (una sola vez)
    LocalStartOpen() {
      if (delivered) return
      delivered = true
      host
        .canvas()
        .then((canvas) => {
          if (!canvas || !canvas.b64) {
            log('error: no hay documento convertido')
            return
          }
          w.DesktopOfflineAppDocumentEndLoad('/doc', canvas.b64, canvas.len)
        })
        .catch((e) => log('error al abrir:', String(e).slice(0, 200)))
    },
    CheckUserId: () => '1',
    // Solo el nombre: las rutas del usuario se quedan en el proceso principal.
    LocalFileGetSourcePath: () => info.name,
    SetDocumentName: () => {},
    onDocumentContentReady() {
      w.molinoReady = true
      host.ready()
    },
    onDocumentModifiedChanged(modified) {
      saved = !modified
      host.modified(!!modified)
    },

    // --- editar: cada tanda de cambios va al motor (en orden)
    LocalFileSaveChanges(changes, index, count) {
      // Normalmente una lista; con muchísimos, una cadena unida con '","' (como el nativo).
      const list = Array.isArray(changes) ? changes.map(String) : changes == null ? [] : String(changes).split('","')
      const from = index == null ? null : index | 0
      if ((count | 0) !== list.length) log('aviso: la tanda dice', count | 0, 'cambios y trae', list.length)
      if (from !== null && from < applied) applied = from
      applied += list.length
      host.changes(list, from).catch((e) => log('error: el motor no aceptó una tanda de cambios:', String(e).slice(0, 200)))
    },
    LocalFileGetOpenChangesCount: () => 0,
    LocalFileSetOpenChangesCount: () => {},
    LocalFileGetCurrentChangesIndex: () => applied,

    // --- guardar: el proceso principal convierte Editor.bin + cambios con x2t
    LocalFileGetSaved: () => saved,
    LocalFileSetSaved: (value) => {
      saved = !!value
    },
    LocalFileSave(params, key, _docinfo, type, options) {
      host
        .save({
          saveAs: String(params || '').includes('saveas=true'),
          format: type | 0,
          options: typeof options === 'string' ? options : ''
        })
        .then((r) => {
          if (r.error === 0) saved = true
          w.DesktopOfflineAppDocumentEndSave(r.error, '', key || '')
        })
        .catch((e) => {
          log('error al guardar:', String(e).slice(0, 200))
          w.DesktopOfflineAppDocumentEndSave(2, '', key || '')
        })
    },
    OnSave() {
      saved = true
    },
    AddChanges: () => {},

    // --- imágenes que el usuario inserta: el proceso principal las elige y
    // las pasa al motor, que devuelve su nombre dentro del documento.
    IsLocalFile: () => true,
    IsLocalFileExist: () => false,
    IsImageFile: (p) => /\.(png|jpe?g|gif|bmp|webp)$/i.test(String(p || '')),
    LocalFileGetImageUrlCorrect: (p) => p,
    LocalFileGetImageUrl: (p) => (MEDIA_NAME.test(String(p || '')) ? String(p) : ''),
    OpenFilenameDialog(filter, multiple, done) {
      const images = /image/i.test(String(filter || ''))
      const answer = images ? host.pickImage() : Promise.resolve({ name: '' })
      answer
        .then((r) => {
          const name = (r && r.name) || ''
          if (done) done(multiple ? (name ? [name] : []) : name)
        })
        .catch(() => done && done(multiple ? [] : ''))
    },
    LocalFileRecents: () => {},
    LocalFileRecovers: () => '[]',
    LocalFileGetRelativePath: () => '',
    GetImageFormat: (p) => String(p || '').split('.').pop(),
    GetImageBase64: () => '',
    GetDropFiles: () => [],
    loadLocalFile: (_file, done) => {
      if (typeof done === 'function') done(undefined)
    },

    // --- lo que el editor pregunta sin comprobar antes (su ausencia lo rompe)
    isSupportNetworkFunctionality: () => false,
    isSupportPlugins: () => false,
    isSupportMacroses: () => false,
    isBlockchainSupport: () => false,
    IsSignaturesSupport: () => false,
    IsProtectionSupport: () => false,
    IsSupportMedia: () => false,
    IsSupportNativePrint: () => false,
    IsCloudCryptoSupport: () => false,
    IsNativeViewer: () => false,
    IsFilePrinting: () => false,
    isFileCrypt: () => false,
    GetCryptoMode: () => 0,
    CryptoMode: 0,
    getEngineVersion: () => 'molino',
    GetSupportedScaleValues: () => [],
    GetInstallPlugins: () => {
      const none = { url: '/sdkjs-plugins/', pluginsData: [] }
      return JSON.stringify([none, none])
    },
    GetBackupPlugins: () => '[]',
    getViewportSettings: () => ({}),
    _getViewportSettings: () => '{}',
    GetFontThumbnailHeight: () => 28,
    getFontsSprite: () => 'molino://office/__molino__/empty.png',
    getDictionariesPath: () => '/dictionaries',
    GetEncryptedHeader: () => 'ENCRYPTED;',
    CheckNeedWheel: () => true,
    LoadJS: () => 0,
    GetOpenedFile: () => undefined,
    OpenWorkbook: () => undefined,
    onFileLockedClose: () => undefined,
    nativeClipboardWrite: () => undefined,
    MediaStart: () => undefined,
    startReporter: () => undefined,
    endReporter: () => undefined,
    sendToReporter: () => undefined,
    sendFromReporter: () => undefined,
    PluginUninstall: () => false,
    IsCachedPdfCloudPrintFileInfo: () => false,
    SetFullscreen: (on) => host.fullscreen(!!on),
    // Sin corrector por ahora (paso 7): el editor no subraya nada.
    SpellCheck: () => {},
    SetAdvancedOptions: () => {},
    SaveQuestion: () => {},
    LoadFontBase64: () => {},
    PreloadCryptoImage: () => {},
    NativeViewerOpen: () => {},
    startExternalConvertation: () => {},
    localSaveToDrawingFormat: () => {},
    localSaveToDrawingFormat2: () => {},
    emulateCloudPrinting: () => {},
    // Imprimir llega con la impresión de Molino PDF (paso 7).
    Print: () => log('imprimir: aún no'),
    Print_Start: () => {},
    Print_Page: () => {},
    Print_End: () => {},
    RemoveFile: () => {},
    ResaveFile: () => {},
    CallInAllWindows: () => {},
    PluginInstall: () => {},
    buildCryptedStart: () => {},
    buildCryptedEnd: () => {},
    convertFile: () => {},
    openExternalReference: () => {},
    sendSystemMessage: () => {},
    DownloadFiles: () => {},
    CreateEditorApi: () => {},
    _CreateEditorApi: () => {},
    // El canal por el que la interfaz del editor pide casi todo lo demás.
    execCommand(command) {
      log('execCommand', String(command).slice(0, 80))
    }
  }

  // El editor decide una vez si es «de escritorio sin conexión» (asc_isOffline):
  // se fuerza en cuanto carga sdk-all-min.js, antes de que lo pregunte.
  w.document.addEventListener(
    'load',
    (e) => {
      const src = (e.target && e.target.src) || ''
      if (!src.includes('/sdk-all-min.js')) return
      const classes = [w.AscCommon && w.AscCommon.baseEditorsApi, ...Object.values(w.Asc || {})]
      for (const c of classes) {
        if (typeof c === 'function' && Object.hasOwn(c.prototype || {}, 'asc_isOffline')) c.prototype.asc_isOffline = () => true
      }
    },
    true
  )

  const asked = new Set()
  w.AscDesktopEditor = new Proxy(impl, {
    get(target, key) {
      if (key in target) return target[key]
      if (typeof key === 'string' && key !== 'then' && !key.startsWith('@') && !asked.has(key)) {
        asked.add(key)
        log('pregunta por', key)
      }
      return undefined
    }
  })

  // Los errores del documento llegan por un evento del editor, no como excepción.
  const waiting = setInterval(() => {
    const api = editor()
    if (!api || !api.asc_registerCallback) return
    clearInterval(waiting)
    api.asc_registerCallback('asc_onError', (code, level) => log('asc_onError', code, level))
  }, 200)

  // Para las pruebas y para la interfaz de Molino (paso 5).
  w.molinoEditor = editor
})()
