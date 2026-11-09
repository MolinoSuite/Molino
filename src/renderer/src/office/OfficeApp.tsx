/**
 * La ventana de Documentos, Hojas o Presentaciones: pestañas, carril de modos,
 * herramientas, el documento (el editor de ONLYOFFICE con su interfaz oculta),
 * panel, barra de estado y buscador de órdenes. Lo de cada app está en
 * apps.tsx; lo que toca al editor, en engine.ts.
 */
import { ChevronDown, FolderOpen, Minus, Plus, Printer, Search, X } from 'lucide-react'
import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { OfficeTabs } from '@shared/officeui'
import { Dialog } from '@/components/ui'
import { cn } from '@/lib/cn'
import { APPS, type Mode, paletteEntries, type PaletteEntry, type Tool } from './apps'
import { EditorSession, type EditorState } from './engine'
import { env, fmt, L } from './i18n'
import { ICONS } from './icons'
import { FontsDialog, FontsNotice } from './MissingFonts'
import { OfficeStart } from './OfficeStart'

const FONTS = ['Aptos', 'Calibri', 'Arial', 'Cambria', 'Georgia', 'Times New Roman', 'Verdana', 'Segoe UI', 'Courier New', 'Carlito', 'Open Sans']
const SIZES = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 44, 54, 72]
const SWATCHES = ['#000000', '#545b69', '#c4505a', '#e06a1a', '#d4a72c', '#2a9358', '#2867d1', '#7a5af5', '#b4357a', '#0f766e', '#9ca3af', '#ffffff']
const T = L.office

/** Quita acentos y pasa a minúsculas (para buscar órdenes). */
/** Órdenes del buscador que no van al editor, sino a Molino (imprimir, guardar como). */
const HOST_COMMANDS: Record<string, (doc: string) => void> = {
  print: (doc) => void window.molinoOffice.print(doc),
  saveAs: (doc) => void window.molinoOffice.saveAs(doc)
}

const plain = (text: string): string => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

export function OfficeApp() {
  const kind = env.kind
  const app = APPS[kind]
  const [tabs, setTabs] = useState<OfficeTabs | null>(null)
  const sessions = useRef(new Map<string, EditorSession>())
  const [mode, setMode] = useState(app.modes[0].id)
  const [palette, setPalette] = useState(false)
  const [about, setAbout] = useState(false)
  const [presenting, setPresenting] = useState(false)
  const [fontsFor, setFontsFor] = useState<string | null>(null)

  useEffect(() => {
    void window.molinoOffice.tabs().then((t) => t && setTabs(t))
    return window.molinoOffice.onTabs(setTabs)
  }, [])

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
      sessions.current.set(doc, found)
    }
    return found
  }
  const active = tabs?.active ? session(tabs.active) : null
  const state = useSessionState(active)
  const activeHasFile = tabs?.tabs.find((t) => t.doc === tabs.active)?.hasFile ?? true
  const run = useCallback(
    (command: string, value?: string) => {
      // «Comentario»: se escribe en el panel de comentarios, que está en el modo Revisar.
      if (command === 'focusComment') {
        setMode('review')
        setTimeout(() => document.getElementById('office-comment-input')?.focus(), 50)
        return true
      }
      // Sin archivo propio (nuevo o recuperado), guardar es «Guardar como»: el editor
      // no guarda lo que cree que no ha cambiado.
      const host = HOST_COMMANDS[command === 'save' && !activeHasFile ? 'saveAs' : command]
      if (host) return tabs?.active ? (host(tabs.active), true) : false
      return active?.run(command, value)
    },
    [active, tabs?.active, activeHasFile]
  )

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
      if (key === 'k') setPalette(Boolean(tabs?.tabs.length))
      else if (key === 's') run('save')
      else if (key === 'saveAs' && tabs?.active) void window.molinoOffice.saveAs(tabs.active)
      else if (key === 'p' && tabs?.active) void window.molinoOffice.print(tabs.active)
      else if (key === 'o') void window.molinoOffice.openDialog()
      else if (key === 'n') void window.molinoOffice.newDoc()
      else if (key === 'w' && tabs?.active) void window.molinoOffice.closeTab(tabs.active)
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
      const key = event.key.toLowerCase()
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return
      const mapped =
        ['k', 'o', 'n', 'w', 's', 'p'].includes(key) && !event.shiftKey
          ? key
          : key === 's'
            ? 'saveAs'
            : key === 'tab'
              ? event.shiftKey
                ? 'prevTab'
                : 'nextTab'
              : null
      if (!mapped) return
      event.preventDefault()
      shortcut(mapped)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [shortcut, activeHasFile])

  const currentMode = app.modes.find((m) => m.id === mode) ?? app.modes[0]
  const activeTab = tabs?.tabs.find((t) => t.doc === tabs.active)
  // Sin documentos: la pantalla de inicio de la app (o «Abriendo…» si viene uno).
  const empty = !tabs || tabs.tabs.length === 0

  return (
    <div className={cn('office', presenting && 'presenting')} data-app={kind}>
      <header className="titlebar office-titlebar">
        <div className="brand">
          <img src={ICONS[kind]} width={22} height={22} alt="" />
        </div>
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
          <button className="office-search" onClick={() => setPalette(true)}>
            <Search size={15} />
            <span>{T.search.button}</span>
            <kbd>Ctrl K</kbd>
          </button>
        )}
        <div className="titlebar-fill" />
        <div className="office-actions" hidden={empty}>
          <button
            className="icon-btn sm"
            aria-label={T.actions.printTip}
            data-tip={T.actions.printTip}
            disabled={!state?.ready}
            onClick={() => tabs?.active && void window.molinoOffice.print(tabs.active)}
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
          <OfficeStart kind={kind} />
        ) : (
          <div className="office-loading office-opening">
            <span className="spinner" />
            {T.loading}
          </div>
        )
      ) : (
      <div className="office-body">
        <nav className="rail" aria-label={T.modes.label}>
          {app.modes.map((m) => (
            <button key={m.id} className={cn('rail-item', m.id === currentMode.id && 'on')} aria-pressed={m.id === currentMode.id} onClick={() => setMode(m.id)}>
              {m.icon}
              <span>{m.label}</span>
            </button>
          ))}
        </nav>
        <div className="office-main">
          <ToolBar mode={currentMode} state={state} run={run} />
          <main className="office-stage">
            {tabs?.tabs.map((tab) => (
              <iframe
                key={tab.doc}
                className={cn('office-frame', tab.doc === tabs.active && 'on')}
                title={tab.name}
                src={`/__molino__/frame.html?${new URLSearchParams({ doc: tab.doc, kind, name: tab.name, ext: tab.ext, lang: env.lang, dark: env.dark ? '1' : '0', author: env.author })}`}
                onLoad={(event) => session(tab.doc).attach(event.currentTarget)}
              />
            ))}
            {activeTab && state?.ready && <FontsNotice tab={activeTab} onFind={() => setFontsFor(activeTab.doc)} />}
            {(!state || !state.ready) && (
              <div className="office-loading">
                <span className="spinner" />
                {T.loading}
              </div>
            )}
          </main>
          {app.sheetTabs && state?.ready && <SheetTabs state={state} run={run} />}
        </div>
        {currentMode.id === 'review' && state?.ready ? (
          <CommentsPanel state={state} run={run} />
        ) : (
          app.panel && state?.ready && <SidePanel kind={kind} state={state} run={run} />
        )}
      </div>
      )}

      <footer className="office-status">
        <span className="grow">{statusText(kind, state)}</span>
        {activeTab && <span className={activeTab.modified ? 'warn' : 'ok'}>{activeTab.modified ? T.status.unsaved : T.status.saved}</span>}
        <button className="office-credit" onClick={() => setAbout(true)}>
          {T.status.basedOn}
        </button>
        <div className="office-zoom" hidden={empty}>
          <button className="icon-btn sm" aria-label={T.status.zoomOut} data-tip={T.status.zoomOut} onClick={() => run('zoomOut')}>
            <Minus size={14} />
          </button>
          <span>{state ? `${state.zoom} %` : ''}</span>
          <button className="icon-btn sm" aria-label={T.status.zoomIn} data-tip={T.status.zoomIn} onClick={() => run('zoomIn')}>
            <Plus size={14} />
          </button>
        </div>
      </footer>

      {palette && <Palette entries={paletteEntries(app)} onRun={run} onClose={() => {
        setPalette(false)
        active?.focus()
      }} />}
      {about && <AboutOffice onClose={() => setAbout(false)} />}
      {fontsFor && <FontsDialog doc={fontsFor} onClose={() => setFontsFor(null)} />}
    </div>
  )
}

/** El estado de la sesión activa, que se repinta cuando el editor avisa. */
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

// ------------------------------------------------------------ herramientas

function ToolBar({ mode, state, run }: { mode: Mode; state: EditorState | null; run: (command: string, value?: string) => void }) {
  const ready = Boolean(state?.ready)
  return (
    <div className="office-toolbar" role="toolbar" aria-label={T.tools.label}>
      {mode.groups.map((group, g) => (
        <div key={`${mode.id}-${g}`} className="office-group">
          {group.map((tool, i) => (
            <ToolView key={i} tool={tool} state={state} ready={ready} run={run} />
          ))}
        </div>
      ))}
    </div>
  )
}

function ToolView({ tool, state, ready, run }: { tool: Tool; state: EditorState | null; ready: boolean; run: (command: string, value?: string) => void }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const shut = (event: Event): void => {
      if (!(event.target instanceof Element && event.target.closest('.office-color'))) setOpen(false)
    }
    window.addEventListener('mousedown', shut)
    window.addEventListener('blur', shut)
    return () => {
      window.removeEventListener('mousedown', shut)
      window.removeEventListener('blur', shut)
    }
  }, [open])
  if (tool.type === 'font') {
    const known = state?.fonts.length ? state.fonts : FONTS
    const fonts = state?.font && !known.includes(state.font) ? [state.font, ...known] : known
    return (
      <select className="office-select wide" aria-label={T.tools.font} disabled={!ready} value={state?.font ?? ''} onChange={(e) => run('font', e.target.value)}>
        {fonts.map((f) => (
          <option key={f} value={f} style={{ fontFamily: `"${f}", var(--font-ui)` }}>
            {f}
          </option>
        ))}
      </select>
    )
  }
  if (tool.type === 'size') {
    const sizes = state && !SIZES.includes(state.size) ? [state.size, ...SIZES].sort((a, b) => a - b) : SIZES
    return (
      <select className="office-select" aria-label={T.tools.size} disabled={!ready} value={state?.size ?? 11} onChange={(e) => run('size', e.target.value)}>
        {sizes.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    )
  }
  if (tool.type === 'style') {
    const styles = Object.entries(T.styles)
    const current = state?.style ?? 'Normal'
    return (
      <select className="office-select wide" aria-label={T.tools.style} disabled={!ready} value={current} onChange={(e) => run('style', e.target.value)}>
        {!styles.some(([key]) => key === current) && <option value={current}>{current}</option>}
        {styles.map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
    )
  }
  if (tool.type === 'color') {
    const label = T.tools[tool.key]
    return (
      <div className="office-color">
        <button className="tool icon" aria-label={label} data-tip={label} disabled={!ready} aria-expanded={open} onClick={() => setOpen(!open)}>
          {tool.icon}
          <span className="swatch" style={{ background: (state && tool.swatch(state)) || 'transparent' }} />
          <ChevronDown size={11} />
        </button>
        {open && (
          <div className="office-pop" role="dialog" aria-label={T.colors}>
            {SWATCHES.map((c) => (
              <button key={c} className="chip" style={{ background: c }} aria-label={c} onClick={() => {
                setOpen(false)
                run(tool.key, c)
              }} />
            ))}
            {tool.key === 'fill' && (
              <button className="btn sm ghost no-fill" onClick={() => {
                setOpen(false)
                run('fill', '')
              }}>
                {T.noFill}
              </button>
            )}
          </div>
        )}
      </div>
    )
  }
  const label = T.tools[tool.key]
  const on = state ? Boolean(tool.active?.(state)) : false
  const disabled = !ready || (state ? Boolean(tool.disabled?.(state)) : true)
  return (
    <button
      className={cn('tool', !tool.caption && 'icon', on && 'on')}
      aria-label={label}
      aria-pressed={tool.active ? on : undefined}
      data-tip={tool.caption ? undefined : label}
      disabled={disabled}
      onClick={() => run(tool.command, tool.value)}
    >
      {tool.icon}
      {tool.caption && <span>{label}</span>}
    </button>
  )
}

// ------------------------------------------------- hojas, panel y buscador

function SheetTabs({ state, run }: { state: EditorState; run: (command: string, value?: string) => void }) {
  return (
    <div className="office-sheets">
      {state.sheets.map((sheet) => (
        <button key={sheet.index} className={cn('sheet', sheet.index === state.activeSheet && 'on')} aria-pressed={sheet.index === state.activeSheet} onClick={() => run('goSheet', String(sheet.index))}>
          {sheet.name}
        </button>
      ))}
      <button className="icon-btn sm" aria-label={T.tools.newSheet} data-tip={T.tools.newSheet} onClick={() => run('newSheet')}>
        <Plus size={14} />
      </button>
    </div>
  )
}

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
              {rows.filter(([, v]) => v !== '' && v !== undefined).map(([k, v]) => (
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
  return (
    <aside className="office-panel">
      <section>
        <h3>{P.theme}</h3>
        {state.themes.length === 0 ? (
          <p className="hint">{P.loadingThemes}</p>
        ) : (
          <div className="office-list">
            {state.themes.map((t) => (
              <button key={t.id} className={cn('office-item', t.id === state.activeTheme && 'on')} aria-pressed={t.id === state.activeTheme} onClick={() => run('theme', String(t.id))}>
                {t.name}
              </button>
            ))}
          </div>
        )}
      </section>
      <section>
        <h3>{P.layout}</h3>
        <div className="office-layouts">
          {state.layouts.map((l) => (
            <button key={l.index} className="office-layout" title={l.name} aria-label={l.name} onClick={() => run('layout', String(l.index))}>
              {/^data:image\//.test(l.image) && <img src={l.image} alt="" />}
            </button>
          ))}
        </div>
      </section>
    </aside>
  )
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
          <article key={c.id} className={cn('office-comment', c.resolved && 'resolved')}>
            <button className="office-comment-body" onClick={() => run('showComment', c.id)}>
              <span className="who">
                {c.author}
                {c.date && <span className="hint"> · {c.date}</span>}
                {c.resolved && <span className="hint"> · {C.resolved}</span>}
              </span>
              {c.quote && <span className="quote">{c.quote}</span>}
              <span className="text">{c.text}</span>
              {c.replies.map((r, i) => (
                <span key={i} className="reply">
                  <b>{r.author}</b> {r.text}
                </span>
              ))}
            </button>
            <div className="row">
              <button className="btn sm ghost" onClick={() => run('resolveComment', c.id)}>
                {c.resolved ? C.reopen : C.resolve}
              </button>
              <button className="btn sm ghost" onClick={() => run('removeComment', c.id)}>
                {C.remove}
              </button>
            </div>
          </article>
        ))}
      </section>
    </aside>
  )
}

function Palette({ entries, onRun, onClose }: { entries: PaletteEntry[]; onRun: (command: string, value?: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const found = useMemo(() => {
    const words = plain(query).split(/\s+/).filter(Boolean)
    if (!words.length) return entries
    return entries.filter((e) => {
      const hay = plain(`${e.label} ${e.group} ${e.keywords}`)
      return words.every((w) => hay.includes(w))
    })
  }, [entries, query])
  const choose = (entry: PaletteEntry | undefined): void => {
    if (!entry) return
    onClose()
    // Después de cerrar: así el teclado vuelve al documento antes de la orden.
    setTimeout(() => onRun(entry.command, entry.value), 0)
  }
  const onKey = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Escape') onClose()
    else if (event.key === 'ArrowDown') {
      event.preventDefault()
      setIndex((i) => Math.min(found.length - 1, i + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setIndex((i) => Math.max(0, i - 1))
    } else if (event.key === 'Enter') choose(found[index])
  }
  return (
    <div className="office-palette" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="office-palette-box" role="dialog" aria-label={T.search.button}>
        <input
          autoFocus
          value={query}
          placeholder={T.search.placeholder}
          spellCheck={false}
          onChange={(e) => {
            setQuery(e.target.value)
            setIndex(0)
          }}
          onKeyDown={onKey}
        />
        <ul role="listbox">
          {found.map((entry, i) => (
            <li key={`${entry.command}:${entry.value ?? ''}`} role="option" aria-selected={i === index} className={cn(i === index && 'on')} onMouseEnter={() => setIndex(i)} onClick={() => choose(entry)}>
              <span>{entry.label}</span>
              <span className="hint">{entry.group}</span>
            </li>
          ))}
          {found.length === 0 && <li className="hint">{T.search.empty}</li>}
        </ul>
      </div>
    </div>
  )
}

function AboutOffice({ onClose }: { onClose: () => void }) {
  const A = T.about
  return (
    <Dialog
      title={A.title}
      onClose={onClose}
      footer={
        <button className="btn primary" onClick={onClose}>
          {A.close}
        </button>
      }
    >
      <div className="office-about">
        <p>{A.free}</p>
        <p>
          <b>{A.engine}</b>
          <br />
          <i lang="en">{A.based}</i>
        </p>
        <p>{A.modified}</p>
        <p className="hint">{A.trademark}</p>
      </div>
    </Dialog>
  )
}

