// Puente entre los editores de ONLYOFFICE y Molino (Documentos, Hojas y Presentaciones).
//
// En la app de escritorio de ONLYOFFICE, window.AscDesktopEditor es código
// nativo. En Molino es este archivo: lo sirve molino://office/ y se carga el
// primero en cada página de los editores (src/main/officewin.ts lo añade). Habla
// con el proceso principal por window.molinoHost (src/preload/office.ts), que
// solo da acceso a los documentos de esta ventana. Cada pestaña es un marco
// (frame.html) con su documento en la dirección: de ahí sale el de este editor.
//
// Los métodos que Molino no tiene no existen: el editor comprueba si están
// antes de usarlos, y fingir que existen cambia lo que hace.
(() => {
  'use strict'
  const w = window
  const host = w.molinoHost
  if (!host || w.AscDesktopEditor) return

  // El documento de esta pestaña: en la dirección de su frame.html (este marco o su padre).
  const tabParams = (() => {
    const FRAME = '/__molino__/frame.html'
    if (location.pathname === FRAME) return new URLSearchParams(location.search)
    try {
      if (w.parent !== w && w.parent.location.pathname === FRAME) return new URLSearchParams(w.parent.location.search)
    } catch {
      /* no es de esta ventana */
    }
    return null
  })()
  if (!tabParams || !/^o[0-9a-f]{16}$/.test(tabParams.get('doc') || '')) return
  const info = { doc: tabParams.get('doc'), name: tabParams.get('name') || '', kind: tabParams.get('kind') || 'word' }

  const isEditor = /\/apps\/\w+editor\/main\/index\.html$/.test(location.pathname)
  const where = isEditor ? 'editor' : 'pestaña'
  const log = (...parts) => host.log(`[${where}] ${parts.join(' ')}`)
  w.addEventListener('error', (e) => log('error:', e.message, e.lineno || ''))
  w.addEventListener('unhandledrejection', (e) => log('promesa:', String(e.reason).slice(0, 200)))

  // -- la interfaz de Molino ----------------------------------------------------
  // Si la ventana es la de Molino (data-molino="interfaz"), la interfaz del editor
  // se oculta: solo queda el documento. Y los atajos de la ventana (buscador de
  // órdenes, pestañas, abrir…) llegan a Molino aunque el teclado esté en el documento.
  const molinoUi = (() => {
    try {
      return isEditor && w.top.document.documentElement.dataset.molino === 'interfaz'
    } catch {
      return false
    }
  })()
  if (molinoUi) {
    const css = w.document.createElement('style')
    // En Hojas se queda la barra de fórmulas del editor (#cell-editing-box), unida a su editor de celdas.
    css.textContent =
      '#app-title,#toolbar,#left-menu,#right-menu,#statusbar,#left-panel-history,#file-menu-panel,#header-logo{display:none!important}' +
      '#cell-editing-box,#cell-editing-box *{font-family:"Inter Variable","Segoe UI Variable Text","Segoe UI",system-ui,sans-serif}'
    ;(w.document.head || w.document.documentElement).appendChild(css)
    w.addEventListener(
      'keydown',
      (e) => {
        const key = e.key.toLowerCase()
        const ctrl = (e.ctrlKey || e.metaKey) && !e.altKey
        const shortcut =
          ctrl &&
          (['k', 'o', 'n', 'w', 'p', 's'].includes(key) && !e.shiftKey
            ? key
            : key === 's' && e.shiftKey
              ? 'saveAs'
              : key === 'tab'
                ? e.shiftKey
                  ? 'prevTab'
                  : 'nextTab'
                : null)
        // Ctrl+S es del editor, salvo en un documento sin archivo propio (nuevo o
        // recuperado): ahí Molino pregunta dónde guardarlo.
        if (shortcut === 's' && !(typeof w.top.molinoNeedsSaveAs === 'function' && w.top.molinoNeedsSaveAs())) return
        if (shortcut && typeof w.top.molinoShortcut === 'function') {
          e.preventDefault()
          e.stopImmediatePropagation()
          w.top.molinoShortcut(shortcut)
        }
      },
      true
    )
  }
  const MEDIA_NAME = /^[A-Za-z0-9_-]{1,64}\.(png|jpe?g|gif|bmp|tiff?|svg|webp|emf|wmf|wdp)$/i

  // -- el corrector ----------------------------------------------------------------
  // El editor manda «clear» al empezar y espera «clear» de vuelta; después,
  // tandas de palabras ({type: 'spell' | 'suggest', usrWords, usrLang…}) que el
  // Worker devuelve corregidas. Las respuestas van a asc_nativeOnSpellCheck.
  let speller = null
  const answer = (data) => {
    // Lo que ha dicho de cada palabra, a la vista de las pruebas (las últimas 500).
    if (data && Array.isArray(data.usrWords) && Array.isArray(data.usrCorrect)) {
      const seen = (w.molinoSpellSeen = w.molinoSpellSeen || new Map())
      data.usrWords.forEach((word, i) => seen.set(String(word), data.usrCorrect[i] === true))
      while (seen.size > 500) seen.delete(seen.keys().next().value)
    }
    if (typeof w.asc_nativeOnSpellCheck === 'function') w.asc_nativeOnSpellCheck(data)
  }
  const spellWorker = () => {
    if (speller) return speller
    const languages = {}
    try {
      const all = w.AscCommon.spellcheckGetLanguages()
      for (const id of Object.keys(all)) if (all[id] && all[id].name) languages[id] = all[id].name
    } catch {
      return null
    }
    speller = new Worker('/sdkjs/common/spell/spell/spell.js')
    speller.onmessage = (e) => answer(e.data)
    speller.onerror = (e) => {
      log('corrector:', (e && e.message) || 'error')
      e.preventDefault && e.preventDefault()
    }
    speller.postMessage({ type: 'init', dictionaries_path: '/dictionaries', languages })
    return speller
  }
  const spell = (json) => {
    if (json === 'clear') {
      setTimeout(() => answer('clear'), 0)
      return
    }
    let message
    try {
      message = JSON.parse(String(json))
    } catch {
      return
    }
    // Las palabras que el usuario añade al diccionario: de momento, solo en esta sesión del corrector.
    const worker = spellWorker()
    if (worker && message && typeof message === 'object') worker.postMessage(message)
  }

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

  // El tema de Molino (claro u oscuro), que llega en la dirección de la pestaña.
  const dark = tabParams.get('dark') === '1'
  w.RendererProcessVariable = { theme: { id: dark ? 'theme-dark' : 'theme-light', type: dark ? 'dark' : 'light', system: dark ? 'dark' : 'light' }, rtl: false }

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
        .canvas(info.doc)
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
      host.ready(info.doc)
    },
    onDocumentModifiedChanged(modified) {
      saved = !modified
      host.modified(info.doc, !!modified)
    },

    // --- editar: cada tanda de cambios va al motor (en orden)
    LocalFileSaveChanges(changes, index, count) {
      // Normalmente una lista; con muchísimos, una cadena unida con '","' (como el nativo).
      const list = Array.isArray(changes) ? changes.map(String) : changes == null ? [] : String(changes).split('","')
      const from = index == null ? null : index | 0
      if ((count | 0) !== list.length) log('aviso: la tanda dice', count | 0, 'cambios y trae', list.length)
      if (from !== null && from < applied) applied = from
      applied += list.length
      host.changes(info.doc, list, from).catch((e) => log('error: el motor no aceptó una tanda de cambios:', String(e).slice(0, 200)))
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
        .save(info.doc, {
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
      const answer = images ? host.pickImage(info.doc) : Promise.resolve({ name: '' })
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
    SetFullscreen: (on) => {
      host.fullscreen(info.doc, !!on)
      if (molinoUi && typeof w.top.molinoFullscreen === 'function') w.top.molinoFullscreen(!!on)
    },
    // El corrector: en la app de escritorio lo hace el nativo; aquí, el de los
    // propios editores (hunspell en WebAssembly, en un Worker) con los
    // diccionarios de la pieza. Las peticiones y las respuestas tienen la misma
    // forma en los dos casos.
    SpellCheck: (json) => spell(json),
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
