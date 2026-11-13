/**
 * La ventana de Documentos, Hojas o Presentaciones: pestañas, carril de modos,
 * herramientas, el documento (el editor de ONLYOFFICE con su interfaz oculta),
 * panel, barra de estado y buscador de órdenes. Lo de cada app está en
 * apps.tsx; lo que toca al editor, en engine.ts.
 */
import { Bold, ChevronDown, ChevronUp, CircleAlert, CircleHelp, Coffee, FilePlusCorner, FileText, FolderOpen, GalleryHorizontal, PenLine, GalleryVertical, Info, Italic, Keyboard, Link, MessageSquare, MessageSquarePlus, Minus, PanelLeftClose, Play, Plus, Printer, Redo2, Save, SaveAll, Search, Settings, Sparkles, SquareArrowOutUpRight, StickyNote, TriangleAlert, Underline, Undo2, X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { OfficeTabs, OfficeAsk, OfficeKind, OfficeScript } from '@shared/officeui'
import { Dialog, Menu, MenuButton, type MenuEntry } from '@/components/ui'
import { cn } from '@/lib/cn'
import { AI_TASKS, AiPanel, type AiTask } from './AiPanel'
import { aiMode, APPS, HIGHLIGHT, paletteEntries, TEXT_COLOR, type Tool } from './apps'
import { FEATURES } from './features'
import { SheetTabs } from './SheetTabs'
import { ToolBar } from './Toolbar'
import { ColorTool } from './ui/pickers'
import { FindBar, FunctionDialog, PromptDialog, type PromptSpec, StatsDialog, SymbolsDialog } from './dialogs'
import { type ContextInfo, type EditorNotice, EditorSession, type EditorState } from './engine'
import { env, fmt, L } from './i18n'
import { ICONS } from './icons'
import { FontsDialog, FontsNotice } from './MissingFonts'
import { CommandPalette, CommandSearchButton } from '@/components/CommandPalette'
import { AboutDialog } from '@/components/About'
import { FeedbackDialog } from '@/components/FeedbackDialog'
import { type PrintableDoc, PrintDialogView } from '@/components/Print'
import { Toasts } from '@/components/Toasts'
import { SettingsDialog } from '@/components/Settings'
import { useApp } from '@/state/app'
import { setSettingsTab } from '@/state/settings'
import { OfficeStart } from './OfficeStart'

const T = L.office

/** Quita acentos y pasa a minúsculas (para buscar órdenes). */
/** Órdenes del buscador que no van al editor, sino a Molino (imprimir, guardar como). */
const HOST_COMMANDS: Record<string, (doc: string, session: EditorSession | null, value?: string) => void> = {
  // Imprimir y exportar los hace el motor: antes, el editor le manda lo que le quede.
  print: (doc, session) => void session?.flush().then(() => window.molinoOffice.print(doc)),
  savePdf: (doc, session) => void session?.flush().then(() => window.molinoOffice.exportDoc(doc, 'pdf')),
  exportAs: (doc, session, value) => void session?.flush().then(() => window.molinoOffice.exportDoc(doc, value ?? '')),
  saveAs: (doc) => void window.molinoOffice.saveAs(doc)
}

/** Los cuadros de Molino que se abren sobre el documento. */
type OfficeDialog =
  | { type: 'prompt'; spec: PromptSpec }
  | { type: 'symbols' }
  | { type: 'stats'; stats: Record<string, number> | null }
  | { type: 'functions' }


/**
 * Los atajos de la ventana, como en Office: Ctrl+F buscar, Ctrl+H reemplazar,
 * Ctrl+K vínculo, Alt+Q el buscador de órdenes. Los mismos que en bridge.js
 * (que los manda aquí cuando el teclado está en el documento).
 */
function shortcutOf(event: globalThis.KeyboardEvent): string | null {
  const key = event.key.toLowerCase()
  if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && key === 'q') return 'palette'
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return null
  if (key === 'tab') return event.shiftKey ? 'prevTab' : 'nextTab'
  if (event.shiftKey) return key === 's' ? 'saveAs' : null
  return ({ o: 'o', n: 'n', w: 'w', p: 'p', s: 's', f: 'find', h: 'replace', k: 'link', ',': 'settings' } as Record<string, string>)[key] ?? null
}

export function OfficeApp() {
  const kind = env.kind
  const app = APPS[kind]
  const [tabs, setTabs] = useState<OfficeTabs | null>(null)
  const sessions = useRef(new Map<string, EditorSession>())
  const [mode, setMode] = useState(app.modes[0].id)
  const [palette, setPalette] = useState(false)
  const [about, setAbout] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  // Diseño D: la barra de lo seleccionado, donde se suelta el ratón.
  const [selBar, setSelBar] = useState<{ doc: string; x: number; y: number } | null>(null)
  // Avisos y preguntas del proceso principal (guardar al cerrar, errores…), con el aspecto de la app.
  const [asks, setAsks] = useState<OfficeAsk[]>([])
  useEffect(() => window.molinoOffice.onAsk((ask) => setAsks((list) => [...list, ask])), [])
  // Programador: el panel «Mis scripts».
  const [scriptsOpen, setScriptsOpen] = useState(false)
  // El panel y el cuadro de una función de features/ (run('panel', id), run('dialog', 'id:valor')).
  const [featurePanel, setFeaturePanel] = useState<string | null>(null)
  const [featureDialog, setFeatureDialog] = useState<{ id: string; value?: string } | null>(null)
  // El cuadro de imprimir de esta app, con el PDF temporal del documento (officeprint.ts).
  const [printing, setPrinting] = useState<PrintableDoc | null>(null)
  // «La actual» es la página (o diapositiva) donde está el cursor, como en Office.
  const currentPage = useRef(1)
  useEffect(
    () =>
      window.molinoOffice.onPrint((pdf) =>
        setPrinting({ id: pdf.doc, pages: pdf.pages, current: (pdf.pages[currentPage.current - 1] ?? pdf.pages[0])?.id ?? '', info: pdf.info })
      ),
    []
  )
  const closePrint = (): void => {
    if (printing) void window.molinoOffice.printClose(printing.id)
    setPrinting(null)
  }
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  // Como en Molino PDF: con la IA activada en Ajustes (el panel dice si falta descargar algo).
  const aiOn = useApp((s) => s.settings.aiTier !== 'off')
  // La pestaña Programador (Scripts en Presentaciones): solo si se ha activado en Ajustes.
  const developerOn = useApp((s) => s.settings.developer.includes(kind))
  /** Ajustes de Molino en esta app; ``tab``: la pestaña con la que se abre. */
  const openSettings = (tab?: string): void => {
    if (tab) setSettingsTab(tab)
    setSettingsOpen(true)
  }
  // El tema puede cambiar con la ventana abierta (Ajustes de cualquier app, o Windows).
  const [dark, setDark] = useState(env.dark)
  // Cada pestaña se carga con el tema de cuando se abrió: su dirección no cambia (si cambiara, se volvería a cargar).
  const frameDark = useRef(new Map<string, boolean>())
  const frameTheme = (doc: string): boolean => {
    if (!frameDark.current.has(doc)) frameDark.current.set(doc, dark)
    return frameDark.current.get(doc) ?? dark
  }
  const [presenting, setPresenting] = useState(false)
  const [fontsFor, setFontsFor] = useState<string | null>(null)
  const [fileMenu, setFileMenu] = useState<DOMRect | null>(null)
  const [find, setFind] = useState<{ replace: boolean } | null>(null)
  const [dialog, setDialog] = useState<OfficeDialog | null>(null)
  const [aiTask, setAiTask] = useState<AiTask>(AI_TASKS[kind][0])
  const [menu, setMenu] = useState<{ doc: string; info: ContextInfo } | null>(null)
  const [notice, setNotice] = useState<EditorNotice | null>(null)
  useEffect(() => {
    void window.molinoOffice.tabs().then((t) => t && setTabs(t))
    return window.molinoOffice.onTabs(setTabs)
  }, [])

  useEffect(
    () =>
      window.molinoOffice.onTheme((next) => {
        document.documentElement.dataset.theme = next ? 'dark' : 'light'
        setDark(next)
        for (const s of sessions.current.values()) s.setTheme(next)
      }),
    []
  )

  // El color de la app (Ajustes → Apariencia): los editores lo vuelven a leer (bridge.js).
  const accent = useApp((s) => s.settings.appearance[kind]?.accent ?? '')
  useEffect(() => {
    const timer = setTimeout(() => {
      for (const s of sessions.current.values()) s.setTheme(dark)
    }, 50)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accent])

  // Las sesiones de las pestañas que se cierran se sueltan.
  useEffect(() => {
    const open = new Set(tabs?.tabs.map((t) => t.doc) ?? [])
    for (const [doc, session] of sessions.current) {
      if (!open.has(doc)) {
        session.dispose()
        sessions.current.delete(doc)
      }
    }
  }, [tabs])

  const session = (doc: string): EditorSession => {
    let found = sessions.current.get(doc)
    if (!found) {
      found = new EditorSession(kind, T.sheetName)
      // El menú del botón derecho y los avisos del editor, con el aspecto de Molino.
      found.onContextMenu = (info) => setMenu(info ? { doc, info } : null)
      found.onNotice = setNotice
      found.onSelectionBar = (at) => setSelBar(at ? { doc, ...at } : null)
      found.groupLabel = (id) => (T.functionGroups as Record<string, string>)[id] ?? id
      sessions.current.set(doc, found)
    }
    return found
  }
  const active = tabs?.active ? session(tabs.active) : null
  // El panel lateral: en Hojas, cerrado al empezar (como en Excel: las cifras van en la
  // barra de estado); en Presentaciones, abierto (temas y diseños). Se recuerda.
  const [sidePanel, setSidePanel] = useState(() => {
    try {
      const saved = localStorage.getItem(`molino.office.panel.${kind}`)
      return saved === null ? kind !== 'cell' : saved === '1'
    } catch {
      return kind !== 'cell'
    }
  })
  const togglePanel = useCallback(() => {
    setSidePanel((open) => {
      try {
        localStorage.setItem(`molino.office.panel.${kind}`, open ? '0' : '1')
      } catch {
        /* sin almacenamiento: no se recuerda */
      }
      return !open
    })
  }, [kind])
  const sessionState = useSessionState(active)
  currentPage.current = kind === 'cell' ? 1 : (sessionState?.page ?? 1)
  const state = sessionState ? { ...sessionState, sidePanel, scriptsOpen } : null
  // Documentos: las palabras, en la barra de abajo (se vuelven a contar un poco después de cada cambio).
  const [words, setWords] = useState<number | null>(null)
  const counting = kind === 'word' && Boolean(active) && Boolean(state?.ready)
  const edits = state?.edits ?? 0
  useEffect(() => {
    if (!counting || !active) return setWords(null)
    let alive = true
    const timer = setTimeout(
      () => void active.stats().then((info) => alive && setWords(typeof info.words === 'number' ? info.words : null)),
      edits === 0 ? 400 : 1500
    )
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [counting, active, edits])
  const activeHasFile = tabs?.tabs.find((t) => t.doc === tabs.active)?.hasFile ?? true
  const run = useCallback(
    (command: string, value?: string) => {
      // «Comentario»: se escribe en el panel de comentarios, que está en el modo Revisar.
      if (command === 'focusComment') {
        setMode('review')
        setTimeout(() => document.getElementById('office-comment-input')?.focus(), 50)
        return true
      }
      if (!active?.ready) return false
      // Lo que pregunta algo antes (buscar, vínculo, símbolo, función…): un cuadro de Molino.
      if (command === 'find' || command === 'replace') {
        setFind({ replace: command === 'replace' })
        return true
      }
      if (command === 'ai') {
        setAiTask((value as AiTask | undefined) ?? AI_TASKS[kind][0])
        setMode('ai')
        return true
      }
      if (command === 'scripts') {
        setMode('developer')
        setScriptsOpen((open) => !open)
        return true
      }
      if (command === 'panel' && value) {
        setScriptsOpen(false)
        setFeaturePanel((open) => (open === value ? null : value))
        return true
      }
      if (command === 'dialog' && value) {
        const [id, ...rest] = value.split(':')
        setFeatureDialog({ id, value: rest.length ? rest.join(':') : undefined })
        return true
      }
      if (command === 'symbol') return (setDialog({ type: 'symbols' }), true)
      if (command === 'togglePanel') return (togglePanel(), true)
      if (command === 'wordCount') {
        setDialog({ type: 'stats', stats: null })
        void active.stats().then((stats) => setDialog((d) => (d?.type === 'stats' ? { type: 'stats', stats } : d)))
        return true
      }
      if (command === 'insertFunction') return (setDialog({ type: 'functions' }), true)
      const direct = (c: string, v?: string): boolean => active.run(c, v)
      const spec = askFor(command, value, active, direct) ?? FEATURES[kind].map((f) => f.ask?.(command, value, active, direct) ?? null).find(Boolean) ?? null
      if (spec) return (setDialog({ type: 'prompt', spec }), true)
      // Sin archivo propio (nuevo o recuperado), guardar es «Guardar como»: el editor
      // no guarda lo que cree que no ha cambiado.
      const host = HOST_COMMANDS[command === 'save' && !activeHasFile ? 'saveAs' : command]
      if (host) return tabs?.active ? (host(tabs.active, active, value), true) : false
      return active.run(command, value)
    },
    [active, tabs?.active, activeHasFile, kind, togglePanel]
  )
  const ask = useCallback((spec: PromptSpec) => setDialog({ type: 'prompt', spec }), [])
  const closeDialog = useCallback(() => {
    setDialog(null)
    active?.focus()
  }, [active])

  const step = useCallback(
    (delta: number) => {
      if (!tabs || tabs.tabs.length < 2) return
      const index = tabs.tabs.findIndex((t) => t.doc === tabs.active)
      const next = tabs.tabs[(index + delta + tabs.tabs.length) % tabs.tabs.length]
      void window.molinoOffice.activate(next.doc)
    },
    [tabs]
  )
  const shortcut = useCallback(
    (key: string) => {
      if (key === 'palette') setPalette(Boolean(tabs?.tabs.length))
      else if (key === 'find' || key === 'replace' || key === 'link') run(key)
      else if (key === 's') run('save')
      else if (key === 'saveAs' && tabs?.active) void window.molinoOffice.saveAs(tabs.active)
      else if (key === 'p' && tabs?.active) run('print')
      else if (key === 'o') void window.molinoOffice.openDialog()
      else if (key === 'n') void window.molinoOffice.newDoc()
      else if (key === 'w' && tabs?.active) void window.molinoOffice.closeTab(tabs.active)
      else if (key === 'settings') setSettingsOpen(true)
      else if (key === 'nextTab') step(1)
      else if (key === 'prevTab') step(-1)
    },
    [tabs, step, run]
  )
  // Los atajos llegan del editor (bridge.js) o de la propia interfaz. Ctrl+S solo
  // llega de aquí: dentro del documento lo atiende el propio editor.
  useEffect(() => {
    window.molinoShortcut = shortcut
    window.molinoFullscreen = setPresenting
    window.molinoNeedsSaveAs = () => !activeHasFile
    const onKey = (event: globalThis.KeyboardEvent): void => {
      const mapped = shortcutOf(event)
      if (!mapped) return
      event.preventDefault()
      shortcut(mapped)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [shortcut, activeHasFile])

  // Las pestañas de contexto (tabla, imagen…) solo con su objeto seleccionado; si
  // se deja de seleccionar, se vuelve a la última de las de siempre.
  // El modo «IA», como en Molino PDF: solo con la IA activada (Ajustes → IA).
  const modes = [
    ...app.modes.filter((m) => (!m.context || Boolean(state?.objects.includes(m.context))) && (m.id !== 'developer' || developerOn)),
    ...(aiOn ? [aiMode(kind)] : [])
  ]
  const lastPlain = useRef(app.modes[0].id)
  const plainMode = app.modes.find((m) => m.id === mode && !m.context)
  if (plainMode) lastPlain.current = plainMode.id
  const currentMode = modes.find((m) => m.id === mode) ?? modes.find((m) => m.id === lastPlain.current) ?? modes[0]
  const activeTab = tabs?.tabs.find((t) => t.doc === tabs.active)
  // Sin documentos: la pantalla de inicio de la app (o «Abriendo…» si viene uno).
  const empty = !tabs || tabs.tabs.length === 0

  return (
    <div className={cn('office', presenting && 'presenting')} data-app={kind}>
      <header className="titlebar office-titlebar">
        <button
          className="brand app-menu"
          aria-label={T.file.menu}
          data-tip={T.file.menu}
          aria-haspopup="menu"
          aria-expanded={fileMenu !== null}
          onClick={(e) => setFileMenu(fileMenu ? null : e.currentTarget.getBoundingClientRect())}
        >
          <img src={ICONS[kind]} width={22} height={22} alt="" />
          <ChevronDown size={11} />
        </button>
        {fileMenu && (
          <Menu
            anchor={fileMenu}
            minWidth={220}
            onClose={() => setFileMenu(null)}
            entries={fileEntries({
              kind,
              hasDoc: !empty && Boolean(state?.ready),
              run,
              about: () => setAbout(true),
              settings: () => setSettingsOpen(true),
              shortcuts: () => setShortcutsOpen(true),
              feedback: () => setFeedbackOpen(true),
              doc: tabs?.active ?? null,
              hasFile: Boolean(activeTab?.hasFile)
            })}
          />
        )}
        <div className="tabs" role="tablist" aria-label={T.tabs.label}>
          {tabs?.tabs.map((tab) => (
            <div key={tab.doc} className={cn('tab', tab.doc === tabs.active && 'on')} role="tab" aria-selected={tab.doc === tabs.active} title={tab.name}>
              <button className="tab-name" onClick={() => void window.molinoOffice.activate(tab.doc)}>
                {tab.name}
              </button>
              {tab.modified && <span className="tab-dot" aria-label={T.tabs.unsaved} />}
              <button className="tab-close" aria-label={T.tabs.close} data-tip={T.tabs.close} onClick={() => void window.molinoOffice.closeTab(tab.doc)}>
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
        <button className="icon-btn sm" aria-label={T.tabs.new[kind]} data-tip={T.tabs.new[kind]} onClick={() => void window.molinoOffice.newDoc()}>
          <Plus size={16} />
        </button>
        <button className="icon-btn sm" aria-label={T.tabs.open} data-tip={T.tabs.open} onClick={() => void window.molinoOffice.openDialog()}>
          <FolderOpen size={16} />
        </button>
        <div className="titlebar-fill" />
        {!empty && (
          <CommandSearchButton onClick={() => setPalette(true)} />
        )}
        <div className="titlebar-fill" />
        <div className="office-actions" hidden={empty}>
          <button className="icon-btn sm" aria-label={T.tools.undo} data-tip={T.tools.undo} disabled={!state?.ready || !state.canUndo} onClick={() => run('undo')}>
            <Undo2 size={16} />
          </button>
          <button className="icon-btn sm" aria-label={T.tools.redo} data-tip={T.tools.redo} disabled={!state?.ready || !state.canRedo} onClick={() => run('redo')}>
            <Redo2 size={16} />
          </button>
          <span className="office-actions-sep" />
          <button className="icon-btn sm" aria-label={T.actions.findTip} data-tip={T.actions.findTip} onClick={() => run('find')}>
            <Search size={16} />
          </button>
          <button
            className="icon-btn sm"
            aria-label={T.actions.printTip}
            data-tip={T.actions.printTip}
            disabled={!state?.ready}
            onClick={() => run('print')}
          >
            <Printer size={16} />
          </button>
          {app.header.map((b, i) => (
            <button
              key={b.key}
              className={cn('btn sm', i === app.header.length - 1 ? 'primary' : 'ghost')}
              disabled={!state?.ready}
              onClick={() => run(b.command, b.value)}
            >
              {T.actions[b.key]}
            </button>
          ))}
        </div>
      </header>

      {empty ? (
        tabs && !tabs.opening ? (
          <div className="office-empty">
            <OfficeStart kind={kind} />
            <button className="office-credit" onClick={() => setAbout(true)}>
              {T.status.basedOn}
            </button>
          </div>
        ) : (
          <div className="office-loading office-opening">
            <span className="spinner" />
            {T.loading}
          </div>
        )
      ) : (
      <div className="office-body">
        <nav className="rail" aria-label={T.modes.label}>
          {modes.map((m) => (
            <button key={m.id} className={cn('rail-item', m.id === currentMode.id && 'on', m.context && 'context')} aria-pressed={m.id === currentMode.id} onClick={() => setMode(m.id)}>
              {m.icon}
              <span>{m.label}</span>
            </button>
          ))}
          <div className="rail-spacer" />
          <button className="icon-btn" aria-label={T.file.settings.replace('…', '')} data-tip={T.file.settings.replace('…', '')} data-tip-side="right" onClick={() => setSettingsOpen(true)}>
            <Settings size={18} />
          </button>
        </nav>
        <div className="office-main">
          <ToolBar key={currentMode.id} mode={currentMode} state={state} run={run} docked={app.toolbar === 'docked'} />
          <main className="office-stage">
            {tabs?.tabs.map((tab) => (
              <iframe
                key={tab.doc}
                className={cn('office-frame', tab.doc === tabs.active && 'on')}
                title={tab.name}
                src={`/__molino__/frame.html?${new URLSearchParams({ doc: tab.doc, kind, name: tab.name, ext: tab.ext, lang: env.lang, dark: frameTheme(tab.doc) ? '1' : '0', author: env.author })}`}
                onLoad={(event) => session(tab.doc).attach(event.currentTarget)}
              />
            ))}
            {activeTab && state?.ready && <FontsNotice tab={activeTab} onFind={() => setFontsFor(activeTab.doc)} />}
            {find && state?.ready && active && (
              <FindBar
                replace={find.replace}
                result={state.search}
                onFind={(text, options, back) => active.find(text, options, back)}
                onReplace={(text, by, all, options) => active.replace(text, by, all, options)}
                onClose={() => {
                  active.endFind()
                  setFind(null)
                  active.focus()
                }}
              />
            )}
            {(!state || !state.ready) && (
              <div className="office-loading">
                <span className="spinner" />
                {T.loading}
              </div>
            )}
            {state?.ready && <OfficeDock kind={kind} state={state} run={run} words={words} />}
          </main>
          {app.sheetTabs && state?.ready && (
            <div className="office-sheetbar">
              <SheetTabs state={state} run={run} ask={ask} />
            </div>
          )}
        </div>
        {scriptsOpen && currentMode.id === 'developer' && state?.ready && active ? (
          <ScriptsPanel kind={kind} session={active} onClose={() => setScriptsOpen(false)} />
        ) : featurePanel && state?.ready && active && panelOf(kind, featurePanel) ? (
          <aside className="office-panel office-feature-panel" aria-label={panelOf(kind, featurePanel)!.title}>
            <header className="office-scripts-head">
              <strong>{panelOf(kind, featurePanel)!.title}</strong>
              <button className="icon-btn sm" aria-label={T.about.close} onClick={() => setFeaturePanel(null)}>
                <X size={14} />
              </button>
            </header>
            {panelOf(kind, featurePanel)!.render({ session: active, state, run, close: () => setFeaturePanel(null) })}
          </aside>
        ) : currentMode.id === 'review' && state?.ready ? (
          <CommentsPanel state={state} run={run} />
        ) : currentMode.id === 'ai' && state?.ready && active && tabs?.active ? (
          <AiPanel key={tabs.active} kind={kind} doc={tabs.active} session={active} task={aiTask} setTask={setAiTask} onSettings={() => openSettings('ai')} />
        ) : (
          app.panel && sidePanel && state?.ready && <SidePanel kind={kind} state={state} run={run} />
        )}
      </div>
      )}


      {palette && (
        <CommandPalette
          entries={paletteEntries(app).map((e) => ({ ...e, key: `${e.command}:${e.value ?? ''}` }))}
          onChoose={(e) => run(e.command, e.value)}
          onClose={() => {
            setPalette(false)
            active?.focus()
          }}
        />
      )}
      {about && <AboutDialog onClose={() => setAbout(false)} />}
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
      {feedbackOpen && <FeedbackDialog onClose={() => setFeedbackOpen(false)} onSent={() => undefined} />}
      {shortcutsOpen && <ShortcutsOffice onClose={() => setShortcutsOpen(false)} />}
      {printing && <PrintDialogView doc={printing} selectedIds={null} onClose={closePrint} />}
      {selBar && state?.ready && selBar.doc === tabs?.active && !palette && currentMode.id !== 'ai' && (
        <SelectionBar
          at={selBar}
          kind={kind}
          state={state}
          run={(command, value) => {
            setSelBar(null)
            run(command, value)
          }}
          rewrite={
            aiOn
              ? () => {
                  setSelBar(null)
                  setAiTask('rewrite')
                  setMode('ai')
                }
              : null
          }
        />
      )}
      {asks[0] && (
        <AskDialog
          key={asks[0].id}
          ask={asks[0]}
          onAnswer={(response) => {
            window.molinoOffice.answer(asks[0].id, response)
            setAsks((list) => list.slice(1))
          }}
        />
      )}
      <Toasts />
      {fontsFor && <FontsDialog doc={fontsFor} onClose={() => setFontsFor(null)} />}
      {dialog?.type === 'prompt' && <PromptDialog spec={dialog.spec} onClose={closeDialog} />}
      {menu && active && menu.doc === tabs?.active && state && (
        <Menu
          anchor={{ x: menu.info.x, y: menu.info.y }}
          minWidth={230}
          entries={[...contextEntries(kind, state, active, run, menu.info), ...FEATURES[kind].flatMap((f) => { const more = f.context?.(state, active, run) ?? []; return more.length ? (['sep', ...more] as MenuEntry[]) : [] })]}
          onClose={() => setMenu(null)}
        />
      )}
      {notice && <NoticeDialog notice={notice} onClose={() => setNotice(null)} />}
      {featureDialog && active && state && dialogOf(kind, featureDialog.id)?.({
        session: active,
        state,
        run,
        value: featureDialog.value,
        close: () => {
          setFeatureDialog(null)
          active.focus()
        }
      })}
      {dialog?.type === 'symbols' && <SymbolsDialog onPick={(c) => active?.insertText(c)} onClose={closeDialog} />}
      {dialog?.type === 'stats' && <StatsDialog stats={dialog.stats} onClose={closeDialog} />}
      {dialog?.type === 'functions' && active && (
        <FunctionDialog functions={active.functions()} groups={active.functionGroups()} onPick={(name) => active.run('func', name)} onClose={closeDialog} />
      )}
    </div>
  )
}

/** El estado de la sesión activa, que se repinta cuando el editor avisa. */
/** El panel de una función de esta app (features/), o undefined. */
function panelOf(kind: OfficeKind, id: string) {
  for (const feature of FEATURES[kind]) if (feature.panels?.[id]) return feature.panels[id]
  return undefined
}
/** El cuadro de una función de esta app (features/), o undefined. */
function dialogOf(kind: OfficeKind, id: string) {
  for (const feature of FEATURES[kind]) if (feature.dialogs?.[id]) return feature.dialogs[id]
  return undefined
}

function useSessionState(session: EditorSession | null): EditorState | null {
  const [, force] = useState(0)
  useEffect(() => (session ? session.subscribe(() => force((n) => n + 1)) : undefined), [session])
  return session ? { ...session.state } : null
}

function statusText(kind: string, state: EditorState | null): string {
  if (!state || !state.ready) return ''
  if (kind === 'word') return fmt(T.status.page, { n: state.page, total: state.pages })
  if (kind === 'slide') return fmt(T.status.slide, { n: state.page, total: state.pages })
  const s = state.selection
  return s.count !== '' && Number(s.count) > 1 ? fmt(T.status.stats, { sum: s.sum, average: s.average, count: s.count }) : s.name
}

/** El menú «Archivo»: lo de siempre de un documento, con sus atajos. */
function fileEntries({
  kind,
  hasDoc,
  run,
  about,
  settings,
  shortcuts,
  feedback,
  doc,
  hasFile
}: {
  kind: string
  hasDoc: boolean
  /** El documento activo tiene archivo propio (para «Mostrar en la carpeta»). */
  hasFile: boolean
  run: (command: string, value?: string) => void
  about: () => void
  settings: () => void
  shortcuts: () => void
  feedback: () => void
  doc: string | null
}): MenuEntry[] {
  const F = T.file
  // Exportar: como el PDF, el documento sigue siendo el de antes.
  const exports: MenuEntry[] =
    kind === 'word'
      ? [
          { label: F.exportTxt, icon: <FileText size={15} />, disabled: !hasDoc, onSelect: () => run('exportAs', 'txt') },
          { label: F.exportHtml, icon: <FileText size={15} />, disabled: !hasDoc, onSelect: () => run('exportAs', 'html') },
          { label: F.exportEpub, icon: <FileText size={15} />, disabled: !hasDoc, onSelect: () => run('exportAs', 'epub') }
        ]
      : kind === 'slide'
        ? [{ label: F.exportPpsx, icon: <FileText size={15} />, disabled: !hasDoc, onSelect: () => run('exportAs', 'ppsx') }]
        : []
  return [
    { label: F.new, icon: <FilePlusCorner size={15} />, kbd: 'Ctrl+N', onSelect: () => void window.molinoOffice.newDoc() },
    { label: F.open, icon: <FolderOpen size={15} />, kbd: 'Ctrl+O', onSelect: () => void window.molinoOffice.openDialog() },
    'sep',
    { label: F.save, icon: <Save size={15} />, kbd: 'Ctrl+S', disabled: !hasDoc, onSelect: () => run('save') },
    { label: F.saveAs, icon: <SaveAll size={15} />, kbd: 'Ctrl+Mayús+S', disabled: !hasDoc || !doc, onSelect: () => doc && void window.molinoOffice.saveAs(doc) },
    { label: F.savePdf, icon: <FileText size={15} />, disabled: !hasDoc, onSelect: () => run('savePdf') },
    ...exports,
    { label: F.print, icon: <Printer size={15} />, kbd: 'Ctrl+P', disabled: !hasDoc || !doc, onSelect: () => run('print') },
    { label: F.showInFolder, icon: <SquareArrowOutUpRight size={15} />, disabled: !hasFile || !doc, onSelect: () => doc && void window.molinoOffice.showInFolder(doc) },
    'sep',
    { label: F.settings, icon: <Settings size={15} />, kbd: 'Ctrl+,', onSelect: settings },
    { label: F.shortcuts, icon: <Keyboard size={15} />, onSelect: shortcuts },
    { label: F.feedback, icon: <MessageSquare size={15} />, onSelect: feedback },
    { label: F.sponsor, icon: <Coffee size={15} />, onSelect: () => void window.molino.about.open('sponsors') },
    { label: F.about, icon: <Info size={15} />, onSelect: about }
  ]
}

/** La barra flotante de abajo, como la de Molino PDF: página (o lo seleccionado en Hojas), palabras y zoom. */
function OfficeDock({ kind, state, run, words }: { kind: string; state: EditorState; run: (command: string, value?: string) => void; words: number | null }) {
  const D = T.dock
  const [draft, setDraft] = useState(String(state.page))
  useEffect(() => setDraft(String(state.page)), [state.page])
  const paged = kind !== 'cell'
  const zoomMenu: MenuEntry[] = [
    ...(paged ? ([{ label: D.fitWidth, onSelect: () => run('fitWidth') }, { label: D.fitPage, onSelect: () => run('fitPage') }, 'sep'] as MenuEntry[]) : []),
    ...[50, 75, 100, 125, 150, 200].map((n): MenuEntry => ({ label: `${n} %`, checked: state.zoom === n, onSelect: () => run('zoomTo', String(n)) }))
  ]
  const go = (n: number): void => {
    if (n >= 1 && n <= state.pages) run('goToPage', String(n))
  }
  return (
    <div className={cn('dock office-dock', kind, kind === 'slide' && state.notes && 'notes')}>
      {paged ? (
        <>
          <button className="icon-btn" aria-label={D.previous} data-tip={D.previous} data-tip-side="top" disabled={state.page <= 1} onClick={() => go(state.page - 1)}>
            <ChevronUp size={15} />
          </button>
          <div className="dock-page">
            <input
              value={draft}
              inputMode="numeric"
              aria-label={kind === 'slide' ? D.slide : D.page}
              onChange={(event) => setDraft(event.target.value.replace(/[^0-9]/g, '').slice(0, 5))}
              onFocus={(event) => event.target.select()}
              onBlur={() => setDraft(String(state.page))}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  go(parseInt(draft, 10))
                  event.currentTarget.blur()
                } else if (event.key === 'Escape') event.currentTarget.blur()
              }}
            />
            <span>{fmt(D.ofTotal, { total: state.pages })}</span>
          </div>
          <button className="icon-btn" aria-label={D.next} data-tip={D.next} data-tip-side="top" disabled={state.page >= state.pages} onClick={() => go(state.page + 1)}>
            <ChevronDown size={15} />
          </button>
        </>
      ) : (
        <span className="office-dock-text">{statusText(kind, state)}</span>
      )}
      {kind === 'word' && words !== null && (
        <>
          <div className="sep" />
          <span className="office-dock-text">{fmt(words === 1 ? D.word : D.words, { n: words.toLocaleString(env.locale) })}</span>
        </>
      )}
      {kind === 'slide' && (
        <>
          <div className="sep" />
          <MenuButton
            className={cn('icon-btn', state.extra.thumbs === 'hide' && 'off')}
            side="top"
            tip={T.thumbs.label}
            tipSide="top"
            entries={(['left', 'bottom', 'right', 'hide'] as const).map(
              (where): MenuEntry => ({
                label: T.thumbs[where],
                icon: where === 'bottom' ? <GalleryHorizontal size={15} /> : where === 'hide' ? <PanelLeftClose size={15} /> : <GalleryVertical size={15} />,
                checked: (state.extra.thumbs ?? 'left') === where,
                onSelect: () => run('thumbs', where)
              })
            )}
          >
            {state.extra.thumbs === 'bottom' ? <GalleryHorizontal size={15} /> : <GalleryVertical size={15} />}
          </MenuButton>
          <button className={cn('icon-btn', state.notes && 'on')} aria-pressed={state.notes} aria-label={T.tools.notes} data-tip={T.tools.notes} data-tip-side="top" onClick={() => run('notes')}>
            <StickyNote size={15} />
          </button>
        </>
      )}
      <div className="sep" />
      <button className="icon-btn" aria-label={T.status.zoomOut} data-tip={T.status.zoomOut} data-tip-side="top" onClick={() => run('zoomOut')}>
        <Minus size={15} />
      </button>
      <MenuButton className="dock-zoom" entries={zoomMenu} side="top" tip={D.zoom} tipSide="top">
        {`${state.zoom} %`}
      </MenuButton>
      <button className="icon-btn" aria-label={T.status.zoomIn} data-tip={T.status.zoomIn} data-tip-side="top" onClick={() => run('zoomIn')}>
        <Plus size={15} />
      </button>
    </div>
  )
}

/**
 * Lo seleccionado (diseño D): negrita, cursiva, subrayado, color, resaltado,
 * vínculo, comentario y, con la IA activada, reescribirlo. Sale donde se suelta
 * el ratón y no quita la selección al pulsarla.
 */
function SelectionBar({
  at,
  kind,
  state,
  run,
  rewrite
}: {
  at: { x: number; y: number }
  kind: string
  state: EditorState
  run: (command: string, value?: string) => void
  rewrite: (() => void) | null
}) {
  const bar = useRef<HTMLDivElement>(null)
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null)
  useLayoutEffect(() => {
    const width = bar.current?.offsetWidth ?? 420
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, at.x - width / 2))
    const top = at.y - 58 < 56 ? at.y + 20 : at.y - 58
    setPlace({ left, top })
  }, [at])
  const S = T.selbar
  return (
    <div ref={bar} className="office-selbar" role="toolbar" aria-label={S.label} style={place ?? { left: -9999, top: -9999 }} onMouseDown={(e) => e.preventDefault()}>
      <button className={cn('tool icon', state.bold && 'on')} aria-label={T.tools.bold} data-tip={T.tools.bold} onClick={() => run('bold')}>
        <Bold size={15} />
      </button>
      <button className={cn('tool icon', state.italic && 'on')} aria-label={T.tools.italic} data-tip={T.tools.italic} onClick={() => run('italic')}>
        <Italic size={15} />
      </button>
      <button className={cn('tool icon', state.underline && 'on')} aria-label={T.tools.underline} data-tip={T.tools.underline} onClick={() => run('underline')}>
        <Underline size={15} />
      </button>
      <span className="office-selbar-sep" />
      <ColorTool tool={TEXT_COLOR as Extract<Tool, { type: 'color' }>} state={state} ready run={run} />
      {kind === 'word' && <ColorTool tool={HIGHLIGHT as Extract<Tool, { type: 'color' }>} state={state} ready run={run} />}
      <span className="office-selbar-sep" />
      <button className="tool" onClick={() => run('link')}>
        <Link size={15} />
        <span>{T.tools.link}</span>
      </button>
      <button className="tool" onClick={() => run('focusComment')}>
        <MessageSquarePlus size={15} />
        <span>{S.comment}</span>
      </button>
      {rewrite && (
        <button className="tool office-selbar-ai" onClick={rewrite}>
          <Sparkles size={15} />
          <span>{S.rewrite}</span>
        </button>
      )}
    </div>
  )
}

// ------------------------------------------------- panel y buscador

/** Hojas: lo seleccionado (suma, promedio…) y un gráfico rápido. */
function SidePanel({ kind, state, run }: { kind: string; state: EditorState; run: (command: string, value?: string) => void }) {
  const P = T.panel
  if (kind === 'cell') {
    const s = state.selection
    const rows: [string, string][] = [
      [P.sum, s.sum],
      [P.average, s.average],
      [P.max, s.max],
      [P.min, s.min],
      [P.count, s.count]
    ]
    return (
      <aside className="office-panel">
        <section>
          <h3>
            {P.selection} {s.name && <span className="hint">· {s.name}</span>}
          </h3>
          {s.count !== '' && s.count !== '0' ? (
            <dl className="office-stats">
              {/* Las que el editor no da (con una sola celda, la suma y la media) no se enseñan. */}
              {rows.filter(([, v]) => String(v ?? '').trim() !== '').map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="hint">{P.selectionHint}</p>
          )}
        </section>
        <section>
          <h3>{P.quickChart}</h3>
          <p className="hint">{P.quickChartHint}</p>
          <div className="office-cards">
            {(
              [
                ['columns', P.columns],
                ['lines', P.lines],
                ['pie', P.pie]
              ] as const
            ).map(([value, label]) => (
              <button key={value} className="btn sm" onClick={() => run('chart', value)}>
                {label}
              </button>
            ))}
          </div>
        </section>
      </aside>
    )
  }
  return null
}

function CommentsPanel({ state, run }: { state: EditorState; run: (command: string, value?: string) => void }) {
  const C = T.panel.comments
  const [text, setText] = useState('')
  const send = (): void => {
    if (!text.trim()) return
    run('comment', text)
    setText('')
  }
  return (
    <aside className="office-panel office-comments" aria-label={C.title}>
      <section>
        <h3>{C.title}</h3>
        <textarea
          id="office-comment-input"
          className="office-comment-input"
          value={text}
          rows={3}
          maxLength={10_000}
          placeholder={C.placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              send()
            }
          }}
        />
        <div className="row">
          <span className="hint grow">{C.hint}</span>
          <button className="btn sm primary" disabled={!text.trim()} onClick={send}>
            {C.add}
          </button>
        </div>
      </section>
      <section className="office-comment-list">
        {state.comments.length === 0 && <p className="hint">{C.empty}</p>}
        {state.comments.map((c) => (
          <CommentCard key={c.id} comment={c} run={run} />
        ))}
      </section>
    </aside>
  )
}

/**
 * Un comentario con sus respuestas: responder, cambiar el texto (el suyo o el
 * de una respuesta), resolver y borrar, como en Word.
 */
function CommentCard({ comment: c, run }: { comment: EditorState['comments'][number]; run: (command: string, value?: string) => void }) {
  const C = T.panel.comments
  // Lo que se está escribiendo: una respuesta, el texto del comentario o el de una respuesta.
  const [editing, setEditing] = useState<{ kind: 'reply' | 'edit' | 'editReply'; reply?: string; text: string } | null>(null)
  const send = (): void => {
    if (!editing || !editing.text.trim()) return
    const value = JSON.stringify({ id: c.id, reply: editing.reply ?? '', text: editing.text })
    run(editing.kind === 'reply' ? 'replyComment' : editing.kind === 'edit' ? 'editComment' : 'editReply', value)
    setEditing(null)
  }
  const box = (
    <div className="office-comment-edit">
      <textarea
        className="office-comment-input"
        autoFocus
        rows={2}
        maxLength={10_000}
        value={editing?.text ?? ''}
        placeholder={editing?.kind === 'reply' ? C.replyPlaceholder : ''}
        onChange={(e) => setEditing((now) => (now ? { ...now, text: e.target.value } : now))}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            send()
          } else if (e.key === 'Escape') setEditing(null)
        }}
      />
      <div className="row">
        <span className="grow" />
        <button className="btn sm ghost" onClick={() => setEditing(null)}>
          {L.common.cancel}
        </button>
        <button className="btn sm primary" disabled={!editing?.text.trim()} onClick={send}>
          {editing?.kind === 'reply' ? C.reply : C.saveEdit}
        </button>
      </div>
    </div>
  )
  return (
    <article className={cn('office-comment', c.resolved && 'resolved')}>
      <button className="office-comment-body" onClick={() => run('showComment', c.id)}>
        <span className="who">
          {c.author}
          {c.date && <span className="hint"> · {c.date}</span>}
          {c.resolved && <span className="hint"> · {C.resolved}</span>}
        </span>
        {c.quote && <span className="quote">{c.quote}</span>}
        {editing?.kind !== 'edit' && <span className="text">{c.text}</span>}
      </button>
      {editing?.kind === 'edit' && box}
      {c.replies.map((r, i) =>
        editing?.kind === 'editReply' && editing.reply === r.id ? (
          <div key={r.id || i}>{box}</div>
        ) : (
          <div key={r.id || i} className="office-comment-reply">
            <span className="reply">
              <b>{r.author}</b> {r.text}
            </span>
            {r.id && (
              <span className="office-comment-reply-tools">
                <button className="icon-btn sm" aria-label={C.editReply} data-tip={C.editReply} onClick={() => setEditing({ kind: 'editReply', reply: r.id, text: r.text })}>
                  <PenLine size={12} />
                </button>
                <button className="icon-btn sm" aria-label={C.removeReply} data-tip={C.removeReply} onClick={() => run('removeReply', JSON.stringify({ id: c.id, reply: r.id }))}>
                  <X size={12} />
                </button>
              </span>
            )}
          </div>
        )
      )}
      {editing?.kind === 'reply' && box}
      {!editing && (
        <div className="row">
          <button className="btn sm ghost" onClick={() => setEditing({ kind: 'reply', text: '' })}>
            {C.reply}
          </button>
          <button className="btn sm ghost" onClick={() => setEditing({ kind: 'edit', text: c.text })}>
            {C.edit}
          </button>
          <button className="btn sm ghost" onClick={() => run('resolveComment', c.id)}>
            {c.resolved ? C.reopen : C.resolve}
          </button>
          <button className="btn sm ghost" onClick={() => run('removeComment', c.id)}>
            {C.remove}
          </button>
        </div>
      )}
    </article>
  )
}

/** Los atajos de teclado de Documentos, Hojas y Presentaciones (como los de Office). */
function ShortcutsOffice({ onClose }: { onClose: () => void }) {
  const K = T.shortcuts
  return (
    <Dialog
      title={K.title}
      onClose={onClose}
      footer={
        <button className="btn primary" onClick={onClose}>
          {T.about.close}
        </button>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '9px 18px', alignItems: 'center' }}>
        {K.list.map(([keys, label]) => (
          <div key={keys} style={{ display: 'contents' }}>
            <span className="kbd" style={{ justifySelf: 'start', padding: '2px 7px' }}>
              {keys}
            </span>
            <span style={{ color: 'var(--text)' }}>{label}</span>
          </div>
        ))}
      </div>
    </Dialog>
  )
}

/**
 * Las órdenes que preguntan algo antes de hacerse: el cuadro de Molino con sus
 * campos y, al aceptar, la orden del editor con lo escrito. null: la orden no pregunta.
 */
function askFor(command: string, value: string | undefined, session: EditorSession, run: (command: string, value?: string) => void): PromptSpec | null {
  const D = T.dialogs
  const Q = T.asks
  if (command === 'link') {
    const current = session.currentLink()
    return {
      title: D.link.title,
      fields: [
        { key: 'text', label: D.link.text, value: current?.text ?? session.selectedText().slice(0, 500), maxLength: 500 },
        { key: 'url', label: D.link.url, value: current?.url ?? '', maxLength: 2000, hint: D.link.urlHint, placeholder: 'https://' },
        ...(env.kind === 'cell' ? [] : [{ key: 'tip', label: D.link.tip, value: current?.tip ?? '', maxLength: 500 }])
      ],
      extra: current ? { label: D.link.remove, onSelect: () => run('removeLink') } : undefined,
      onOk: (v) => {
        const url = normalizeUrl(v.url)
        if (url) run('setLink', JSON.stringify({ text: v.text || url, url, tip: v.tip ?? '' }))
      }
    }
  }
  if (command === 'columnWidth' || command === 'rowHeight') {
    const current = session.cellSize(command === 'columnWidth' ? 'column' : 'row')
    return {
      title: Q[command],
      fields: [{ key: 'size', label: Q[`${command}Label`], value: current ? String(current) : '', type: 'number', min: 0, max: command === 'columnWidth' ? 255 : 409 }],
      onOk: (v) => run(command, v.size)
    }
  }
  if (command === 'cf' && value && ['greater', 'less', 'between', 'equal', 'text'].includes(value)) {
    const two = value === 'between'
    return {
      title: Q.cf[value as 'greater' | 'less' | 'between' | 'equal' | 'text'],
      intro: Q.cfIntro,
      fields: [
        { key: 'a', label: two ? Q.from : value === 'text' ? Q.textContains : Q.value, value: '', maxLength: 255, type: value === 'text' ? 'text' : undefined },
        ...(two ? [{ key: 'b', label: Q.to, value: '', maxLength: 255 }] : []),
        {
          key: 'style',
          label: Q.style,
          value: 'red',
          options: (['red', 'yellow', 'green'] as const).map((s) => ({ value: s, label: Q.styles[s] }))
        }
      ],
      onOk: (v) => run('cfRule', JSON.stringify({ kind: value, a: v.a, b: v.b ?? '', style: v.style }))
    }
  }
  if (command === 'numberFormat' && value === 'custom') {
    return {
      title: Q.customFormat,
      fields: [{ key: 'format', label: Q.formatCode, value: session.numberFormatCode(), maxLength: 255, hint: Q.formatHint }],
      onOk: (v) => run('numberFormat', `code:${v.format}`)
    }
  }
  // Listas: empezar en un número, o una a medida.
  const LS = T.lists
  if (command === 'listRestartAsk') {
    return {
      title: LS.restartTitle,
      fields: [{ key: 'n', label: LS.restartLabel, value: '1', type: 'number', min: 1, max: 32767 }],
      onOk: (v) => run('listRestart', v.n)
    }
  }
  if (command === 'listCustomAsk') {
    return {
      title: LS.customTitle,
      fields: [
        { key: 'type', label: LS.type, value: 'bullet', options: [{ value: 'bullet', label: LS.typeBullet }, { value: 'number', label: LS.typeNumber }] },
        { key: 'symbol', label: LS.symbol, value: '•', maxLength: 2, hint: LS.symbolHint },
        { key: 'format', label: LS.format, value: 'decimal', options: Object.entries(LS.formats).map(([value, label]) => ({ value, label })) },
        { key: 'text', label: LS.text, value: '%1.', maxLength: 30, hint: LS.textHint },
        { key: 'indent', label: LS.indent, value: '0,63', maxLength: 5 }
      ],
      onOk: (v) => run('listCustom', JSON.stringify({ type: v.type, symbol: v.symbol, format: v.format, text: v.text, indent: Number(String(v.indent).replace(',', '.')) }))
    }
  }
  // Una tabla a medida (filas y columnas).
  if (command === 'tableAsk') {
    return {
      title: T.tableMenu.title,
      fields: [
        { key: 'cols', label: T.tableMenu.cols, value: '4', type: 'number', min: 1, max: 63 },
        { key: 'rows', label: T.tableMenu.rows, value: '4', type: 'number', min: 1, max: 500 }
      ],
      onOk: (v) => run('table', `${v.cols}x${v.rows}`)
    }
  }
  // Documentos: un estilo nuevo con el formato de la selección.
  if (command === 'newStyleAsk') {
    return {
      title: T.stylePicker.newTitle,
      intro: T.stylePicker.newHint,
      fields: [{ key: 'name', label: T.stylePicker.newName, value: '', maxLength: 60 }],
      onOk: (v) => v.name.trim() && run('newStyle', v.name.trim())
    }
  }
  const P = T.developer
  if (command === 'controlAsk') {
    const info = session.controlInfo()
    if (!info) return null
    const listed = info.type === 'combo' || info.type === 'list'
    const fields: PromptSpec['fields'] = [
      { key: 'title', label: P.title, value: info.title, maxLength: 64, hint: P.titleHint },
      { key: 'tag', label: P.tag, value: info.tag, maxLength: 64, hint: P.tagHint }
    ]
    if (info.type !== 'check' && info.type !== 'picture') fields.push({ key: 'placeholder', label: P.placeholder, value: info.placeholder, maxLength: 255 })
    if (listed) fields.push({ key: 'items', label: P.items, value: info.items.join('\n'), type: 'textarea', maxLength: 8000, hint: P.itemsHint })
    if (info.type === 'date') fields.push({ key: 'dateFormat', label: P.dateFormat, value: info.dateFormat || 'dd/MM/yyyy', maxLength: 64, hint: P.dateFormatHint })
    fields.push({
      key: 'lock',
      label: P.lock,
      value: info.lock,
      options: [
        { value: 'none', label: P.lockNone },
        { value: 'delete', label: P.lockDelete },
        { value: 'edit', label: P.lockEdit },
        { value: 'both', label: P.lockBoth }
      ]
    })
    return {
      title: fmt(P.propsTitle, { type: P.types[info.type] }),
      fields,
      onOk: (v) =>
        run(
          'controlProps',
          JSON.stringify({ title: v.title, tag: v.tag, placeholder: v.placeholder ?? '', lock: v.lock, items: (v.items ?? '').split(/\r?\n/), dateFormat: v.dateFormat ?? '' })
        )
    }
  }
  if (command === 'formsOnlyAsk' || command === 'protectSheetAsk') {
    const word = command === 'formsOnlyAsk'
    const on = word ? session.state.formsOnly : session.state.sheetProtected
    const action = word ? 'formsOnly' : 'protectSheet'
    if (on && !session.protectionHasPassword()) return (run(action), null)
    return {
      title: on ? P.unprotectTitle : word ? P.formsOnlyTitle : P.protectSheetTitle,
      intro: on ? P.unprotectIntro : word ? P.formsOnlyIntro : P.protectSheetIntro,
      fields: [{ key: 'password', label: on ? P.password : P.passwordOptional, value: '', type: 'password', maxLength: word ? 15 : 255 }],
      ok: on ? P.unprotect : P.protect,
      onOk: (v) => run(action, v.password || undefined)
    }
  }
  if (command === 'validateAsk') {
    return {
      title: P.validateTitle,
      intro: P.validateIntro,
      fields: [
        {
          key: 'type',
          label: P.allow,
          value: 'whole',
          options: [
            { value: 'whole', label: P.allowWhole },
            { value: 'decimal', label: P.allowDecimal },
            { value: 'date', label: P.allowDate },
            { value: 'length', label: P.allowLength },
            { value: 'list', label: P.allowList }
          ]
        },
        { key: 'min', label: P.min, value: '', maxLength: 64, hint: P.minHint },
        { key: 'max', label: P.max, value: '', maxLength: 64 },
        { key: 'source', label: P.source, value: '', maxLength: 255, placeholder: Q.validationExample, hint: P.sourceHint },
        { key: 'title', label: P.messageTitle, value: '', maxLength: 32 },
        { key: 'message', label: P.message, value: '', maxLength: 255, hint: P.messageHint }
      ],
      onOk: (v) => run('validate', JSON.stringify(v))
    }
  }
  if (command === 'validationList' && !value) {
    return {
      title: Q.validation,
      intro: Q.validationIntro,
      fields: [{ key: 'source', label: Q.validationSource, value: '', maxLength: 255, placeholder: Q.validationExample }],
      onOk: (v) => run('validationList', v.source)
    }
  }
  if (command === 'watermark' && value === 'custom') {
    return {
      title: Q.watermark,
      fields: [{ key: 'text', label: Q.watermarkText, value: '', maxLength: 60 }],
      onOk: (v) => v.text.trim() && run('watermark', `text:${v.text.trim()}`)
    }
  }
  if (command === 'defineName' && !value) {
    return {
      title: Q.defineName,
      intro: Q.defineNameIntro,
      fields: [{ key: 'name', label: Q.name, value: '', maxLength: 255, placeholder: Q.nameExample }],
      onOk: (v) => run('defineName', v.name.trim())
    }
  }
  if (command === 'splitCell' && !value) {
    return {
      title: Q.splitCell,
      fields: [
        { key: 'cols', label: Q.cols, value: '2', type: 'number', min: 1, max: 20 },
        { key: 'rows', label: Q.rows, value: '1', type: 'number', min: 1, max: 20 }
      ],
      onOk: (v) => run('splitCell', `${v.cols}x${v.rows}`)
    }
  }
  if (command === 'slideFooter') {
    const now = session.slideFooter()
    return {
      title: Q.slideFooter,
      fields: [
        { key: 'number', label: Q.slideNumber, value: now.number ? 'yes' : 'no', options: [{ value: 'yes', label: Q.yes }, { value: 'no', label: Q.no }] },
        { key: 'date', label: Q.date, value: now.date ? 'yes' : 'no', options: [{ value: 'yes', label: Q.yes }, { value: 'no', label: Q.no }] },
        { key: 'footer', label: Q.footerText, value: now.footer, maxLength: 255 },
        { key: 'all', label: Q.applyTo, value: 'all', options: [{ value: 'all', label: Q.allSlides }, { value: 'one', label: Q.thisSlide }] }
      ],
      onOk: (v) => run('slideFooter', JSON.stringify({ number: v.number === 'yes', date: v.date === 'yes', footer: v.footer, all: v.all === 'all' }))
    }
  }
  return null
}

/** Una dirección escrita a mano: «molinosuite.org» → https://…, «a@b.es» → mailto:… (solo http, https y mailto). */
function normalizeUrl(raw: string): string {
  const text = raw.trim()
  if (!text) return ''
  if (/^(https?:\/\/|mailto:)/i.test(text)) return text
  if (/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(text)) return `mailto:${text}`
  if (/^[a-z][a-z0-9+.-]*:/i.test(text)) return ''
  return `https://${text}`
}

/**
 * El menú del botón derecho: lo del corrector, cortar, copiar y pegar, y lo de
 * lo que hay seleccionado (vínculo, tabla, imagen, forma, celdas).
 */
function contextEntries(kind: string, state: EditorState, session: EditorSession, run: (command: string, value?: string) => unknown, info: ContextInfo): MenuEntry[] {
  const C = T.context
  const out: MenuEntry[] = []
  const item = (label: string, command: string, value?: string): MenuEntry => ({ label, onSelect: () => void run(command, value) })
  if (info.spelling) {
    for (const word of info.spelling.variants) out.push({ label: word, onSelect: () => session.replaceWord(word) })
    if (!info.spelling.variants.length) out.push({ label: C.noSuggestions, disabled: true, onSelect: () => undefined })
    out.push(
      { label: C.ignore, onSelect: () => session.ignoreWord(false) },
      { label: C.ignoreAll, onSelect: () => session.ignoreWord(true) },
      { label: C.addWord, onSelect: () => session.addWord() },
      'sep'
    )
  }
  if (info.header) out.push(item(info.header === 'header' ? C.editHeader : C.editFooter, info.header), 'sep')
  out.push(
    { label: C.cut, kbd: 'Ctrl+X', onSelect: () => session.clipboard('cut') },
    { label: C.copy, kbd: 'Ctrl+C', onSelect: () => session.clipboard('copy') },
    { label: C.paste, kbd: 'Ctrl+V', onSelect: () => session.clipboard('paste') }
  )
  const link = session.currentLink()
  if (kind === 'cell') {
    out.push(
      'sep',
      item(T.tools.rows, 'rows'),
      item(T.tools.columns, 'columns'),
      item(T.options.cellsDelete.deleteRows, 'deleteRows'),
      item(T.options.cellsDelete.deleteColumns, 'deleteColumns'),
      'sep',
      item(T.options.clear.contents, 'clear', 'contents'),
      item(T.options.clear.formats, 'clear', 'formats'),
      'sep',
      item(link ? C.editLink : C.addLink, 'link')
    )
    if (link) out.push({ label: C.openLink, onSelect: () => void window.molinoOffice.openLink(link.url) }, item(C.removeLink, 'removeLink'))
    out.push(item(T.tools.comment, 'focusComment'))
    return out
  }
  out.push('sep', item(link ? C.editLink : C.addLink, 'link'))
  if (link) out.push({ label: C.openLink, onSelect: () => void window.molinoOffice.openLink(link.url) }, item(C.removeLink, 'removeLink'))
  if (state.objects.includes('table')) {
    out.push(
      'sep',
      item(T.tools.rowAbove, 'rowAbove'),
      item(T.tools.rowBelow, 'rowBelow'),
      item(T.tools.colLeft, 'colLeft'),
      item(T.tools.colRight, 'colRight'),
      item(T.tools.deleteRow, 'deleteRow'),
      item(T.tools.deleteCol, 'deleteCol'),
      item(T.tools.mergeCells, 'mergeCells')
    )
  }
  if (kind === 'word' && (state.objects.includes('image') || state.objects.includes('shape'))) {
    out.push('sep', { heading: T.tools.wrapping }, ...Object.entries(T.options.wrapping).map(([value, label]) => item(label, 'wrapping', value)))
  }
  if (kind === 'slide' && state.objects.some((o) => o !== 'table')) {
    out.push('sep', ...(['front', 'back', 'group', 'ungroup'] as const).map((v) => item(T.options.arrange[v], 'arrange', v)))
  }
  if (kind === 'slide' && state.objects.length === 0) {
    out.push('sep', item(T.tools.newSlide, 'newSlide'), item(T.tools.duplicateSlide, 'duplicateSlide'), item(T.tools.hideSlide, 'hideSlide'))
  }
  out.push('sep', item(T.tools.comment, 'focusComment'))
  return out
}

/** Un aviso del editor (por ejemplo, «no hay títulos para la tabla de contenido»), con el aspecto de Molino. */
const ASK_ICONS: Record<OfficeAsk['type'], ReactNode> = {
  info: <Info size={20} />,
  question: <CircleHelp size={20} />,
  warning: <TriangleAlert size={20} />,
  error: <CircleAlert size={20} />
}

/** Un aviso o una pregunta del proceso principal, como los demás cuadros de la app. */
function AskDialog({ ask, onAnswer }: { ask: OfficeAsk; onAnswer: (response: number) => void }) {
  return (
    <Dialog
      title={ask.title}
      onClose={() => onAnswer(ask.cancelId)}
      footer={
        <>
          {ask.buttons.map((label, i) => (
            <button key={i} className={cn('btn', i === ask.defaultId && 'primary')} data-autofocus={i === ask.defaultId || undefined} onClick={() => onAnswer(i)}>
              {label}
            </button>
          ))}
        </>
      }
    >
      <div className={cn('office-ask', ask.type)}>
        {ASK_ICONS[ask.type]}
        <div>
          <p className="office-ask-message">{ask.message}</p>
          {ask.detail && <p className="office-ask-detail">{ask.detail}</p>}
        </div>
      </div>
    </Dialog>
  )
}

function NoticeDialog({ notice, onClose }: { notice: EditorNotice; onClose: () => void }) {
  const N = T.notice
  const label = (b: { value: string; label: string }): string => (N.buttons as Record<string, string>)[b.value] ?? b.label
  const answer = (value: string): void => {
    onClose()
    notice.answer(value)
  }
  const cancel = notice.buttons.find((b) => b.value === 'cancel' || b.value === 'no')?.value ?? notice.buttons[0]?.value ?? 'ok'
  return (
    <Dialog
      title={notice.title || N.title}
      onClose={() => answer(cancel)}
      footer={
        <>
          {notice.buttons.map((b) => (
            <button key={b.value} className={cn('btn', b.primary && 'primary')} onClick={() => answer(b.value)}>
              {label(b)}
            </button>
          ))}
        </>
      }
    >
      <p className="office-notice">{notice.text}</p>
    </Dialog>
  )
}

/** Ejemplos para empezar: uno o dos por app, con la API de documentos de ONLYOFFICE. */
const SCRIPT_EXAMPLES: Record<string, { name: string; code: string }[]> = {
  word: [
    { name: T.developer.examples.countParagraphs, code: "var doc = Api.GetDocument();\nprint('Párrafos:', doc.GetElementsCount());" },
    {
      name: T.developer.examples.dateAtEnd,
      code: "var doc = Api.GetDocument();\nvar p = Api.CreateParagraph();\np.AddText('Fecha: ' + new Date().toLocaleDateString('es-ES'));\ndoc.Push(p);"
    }
  ],
  cell: [
    {
      name: T.developer.examples.timesTable,
      code: 'var sheet = Api.GetActiveSheet();\nfor (var i = 1; i <= 10; i++) {\n  for (var j = 1; j <= 10; j++) {\n    sheet.GetRangeByNumber(i - 1, j - 1).SetValue(i * j);\n  }\n}'
    },
    {
      name: T.developer.examples.sumSelection,
      code: "var total = 0;\nApi.GetSelection().ForEach(function (cell) {\n  var n = parseFloat(cell.GetValue());\n  if (!isNaN(n)) total += n;\n});\nprint('Suma:', total);"
    }
  ],
  slide: [
    { name: T.developer.examples.countSlides, code: "print('Diapositivas:', Api.GetPresentation().GetSlidesCount());" },
    { name: T.developer.examples.newSlide, code: 'var presentation = Api.GetPresentation();\npresentation.AddSlide(Api.CreateSlide());' }
  ]
}

/**
 * Mis scripts (pestaña Programador): los guarda Molino, se escriben aquí y se
 * ejecutan sobre el documento abierto con la API de documentos (como las
 * macros de ONLYOFFICE). Las macros que traen los documentos no se ejecutan nunca.
 */
function ScriptsPanel({ kind, session, onClose }: { kind: string; session: EditorSession; onClose: () => void }) {
  const P = T.developer
  const [list, setList] = useState<OfficeScript[]>([])
  const [current, setCurrent] = useState<{ id?: string; name: string; code: string }>({ name: P.untitled, code: '' })
  const [result, setResult] = useState<{ ok: boolean; lines: string[] } | null>(null)
  const [dirty, setDirty] = useState(false)
  const reload = useCallback(() => void window.molinoOffice.scripts().then(setList), [])
  useEffect(() => reload(), [reload])
  const choose = (script: { id?: string; name: string; code: string }): void => {
    setCurrent(script)
    setResult(null)
    setDirty(false)
  }
  const save = async (): Promise<void> => {
    const id = await window.molinoOffice.saveScript({ id: current.id, name: current.name.trim() || P.untitled, code: current.code })
    if (id) {
      setCurrent({ ...current, id })
      setDirty(false)
      reload()
    }
  }
  const remove = async (): Promise<void> => {
    if (current.id) await window.molinoOffice.removeScript(current.id)
    choose({ name: P.untitled, code: '' })
    reload()
  }
  const runIt = (): void => {
    const outcome = session.runScript(current.code)
    setResult({ ok: outcome.ok, lines: outcome.error ? [...outcome.output, outcome.error === 'unavailable' ? P.unavailable : fmt(P.failed, { error: outcome.error })] : outcome.output.length ? outcome.output : [P.done] })
    session.focus()
  }
  const examples = SCRIPT_EXAMPLES[kind] ?? []
  return (
    <aside className="office-panel office-scripts" aria-label={P.scripts}>
      <header className="office-scripts-head">
        <strong>{P.scripts}</strong>
        <button className="icon-btn sm" aria-label={T.about.close} onClick={onClose}>
          <X size={14} />
        </button>
      </header>
      <div className="office-scripts-list">
        <button className={cn('chip', !current.id && 'on')} onClick={() => choose({ name: P.untitled, code: '' })}>
          <Plus size={13} />
          {P.new}
        </button>
        {list.map((script) => (
          <button key={script.id} className={cn('chip', current.id === script.id && 'on')} onClick={() => choose(script)}>
            {script.name}
          </button>
        ))}
        {examples.map((example) => (
          <button key={example.name} className="chip example" onClick={() => choose({ name: example.name, code: example.code })}>
            {fmt(P.example, { name: example.name })}
          </button>
        ))}
      </div>
      <input
        className="input"
        aria-label={P.name}
        value={current.name}
        maxLength={80}
        onChange={(e) => {
          setCurrent({ ...current, name: e.target.value })
          setDirty(true)
        }}
      />
      <textarea
        className="office-scripts-code"
        aria-label={P.code}
        value={current.code}
        spellCheck={false}
        maxLength={100_000}
        placeholder={P.codePlaceholder}
        onChange={(e) => {
          setCurrent({ ...current, code: e.target.value })
          setDirty(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            runIt()
          } else if (e.key === 'Tab' && !e.shiftKey) {
            e.preventDefault()
            const area = e.currentTarget
            const at = area.selectionStart
            const code = `${area.value.slice(0, at)}  ${area.value.slice(area.selectionEnd)}`
            setCurrent({ ...current, code })
            setDirty(true)
            requestAnimationFrame(() => area.setSelectionRange(at + 2, at + 2))
          }
        }}
      />
      <div className="row">
        <button className="btn primary sm" disabled={!current.code.trim()} onClick={runIt} data-tip="Ctrl+Intro">
          <Play size={14} />
          {P.run}
        </button>
        <button className="btn sm" disabled={!current.code.trim() || (!dirty && Boolean(current.id))} onClick={() => void save()}>
          {P.save}
        </button>
        {current.id && (
          <button className="btn ghost sm" onClick={() => void remove()}>
            {P.remove}
          </button>
        )}
      </div>
      {result && (
        <pre className={cn('office-scripts-out', !result.ok && 'error')} aria-live="polite">
          {result.lines.join('\n')}
        </pre>
      )}
      <p className="hint">{P.note}</p>
      <button className="btn ghost sm" onClick={() => void window.molino.shell.openExternal('https://api.onlyoffice.com/docs/office-api/get-started/overview/')}>
        {P.reference}
      </button>
    </aside>
  )
}
