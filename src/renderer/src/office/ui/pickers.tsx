import { Check, ChevronDown, Plus, Search } from 'lucide-react'
import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { type MenuOption, optionsOf, type Tool } from '../apps'
import type { EditorState } from '../engine'
import { L } from '../i18n'
import { ColorPicker } from './ColorPicker'
import { Pop, usePopButton } from './pop'

const T = L.office
type Run = (command: string, value?: string) => unknown

/** El nombre de una herramienta: el suyo o el de la lista de herramientas. */
export function toolLabel(tool: { key: string; label?: string }): string {
  return tool.label ?? (T.tools as Record<string, string>)[tool.key] ?? tool.key
}

// ------------------------------------------------------------ menús visuales

/**
 * Un desplegable de opciones (márgenes, listas, bordes…): con miniaturas en
 * cuadrícula si las opciones las tienen, o en lista con su icono. Las de
 * acción (``action``) van debajo, como en los menús de Office.
 */
export function VisualMenu({
  tool,
  state,
  ready,
  run,
  showLabel
}: {
  tool: Extract<Tool, { type: 'menu' }>
  state: EditorState | null
  ready: boolean
  run: Run
  showLabel?: boolean
}) {
  const pop = usePopButton()
  const label = toolLabel(tool)
  const current = state && tool.current ? tool.current(state) : null
  const caption = tool.caption || showLabel
  const choose = (option: MenuOption): void => {
    pop.close()
    run(option.command ?? tool.command, option.value)
  }
  // Las opciones en bloques: cada título abre uno nuevo.
  const sections: { title?: string; options: MenuOption[] }[] = []
  for (const option of optionsOf(tool, state)) {
    if (option.heading) sections.push({ title: option.label, options: [] })
    else {
      if (!sections.length) sections.push({ options: [] })
      sections[sections.length - 1].options.push(option)
    }
  }
  return (
    <>
      <button
        ref={pop.button}
        className={cn('tool', !caption && 'icon', pop.anchor && 'on')}
        aria-label={label}
        data-tip={caption || pop.anchor ? undefined : label}
        aria-haspopup="menu"
        aria-expanded={pop.anchor !== null}
        disabled={!ready}
        onClick={pop.toggle}
      >
        {tool.icon}
        {caption && <span>{label}</span>}
        <ChevronDown size={11} className="tool-caret" />
      </button>
      {pop.anchor && (
        <Pop anchor={pop.anchor} trigger={pop.button} onClose={pop.close} label={label} className={cn('office-visual', tool.tiles ? 'tiles' : undefined)} role="menu">
          {sections.map((section, s) => {
            const tiles = section.options.filter((o) => !o.action && (o.preview || tool.tiles))
            const rows = section.options.filter((o) => !tiles.includes(o))
            return (
              <div key={s} className="office-visual-section">
                {section.title && <div className="office-visual-title">{section.title}</div>}
                {tiles.length > 0 && (
                  <div className="office-tiles" style={{ gridTemplateColumns: `repeat(${tool.tiles ?? 3}, minmax(0, 1fr))` }}>
                    {tiles.map((option, i) => (
                      <button
                        key={`${option.value}-${i}`}
                        role="menuitemradio"
                        aria-checked={current !== null && current === option.value}
                        className={cn('office-tile', current !== null && current === option.value && 'on')}
                        title={option.hint ?? option.label}
                        onClick={() => choose(option)}
                      >
                        <span className="office-tile-art">{option.preview ?? option.icon}</span>
                        <span className="office-tile-label">{option.label}</span>
                      </button>
                    ))}
                  </div>
                )}
                {rows.length > 0 && (
                  <div className="office-rows">
                    {rows.map((option, i) => (
                      <button key={`${option.value}-${i}`} role="menuitem" className={cn('office-row', option.action && 'action')} onClick={() => choose(option)}>
                        <span className="office-row-icon">{option.icon ?? option.preview}</span>
                        <span className="office-row-label">{option.label}</span>
                        {current !== null && current === option.value && !option.action && <Check size={14} className="tick" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </Pop>
      )}
    </>
  )
}

// ---------------------------------------------------------------- colores

/** El último color usado con cada herramienta: el botón lo pone sin abrir la paleta (como en Office). */
const lastColor = new Map<string, string>()

/**
 * Un color (texto, resaltado, relleno, contorno, fondo): el botón pone el
 * último usado; la flecha abre la paleta completa.
 */
export function ColorTool({ tool, state, ready, run }: { tool: Extract<Tool, { type: 'color' }>; state: EditorState | null; ready: boolean; run: Run }) {
  const pop = usePopButton()
  const label = toolLabel(tool)
  const command = tool.command ?? tool.key
  const swatch = (state && tool.swatch(state)) || null
  const last = lastColor.get(tool.key) ?? tool.defaultColor ?? null
  const apply = (color: string): void => {
    if (color) lastColor.set(tool.key, color)
    pop.close()
    run(command, color)
  }
  return (
    <span className="office-colortool">
      <button className="tool icon office-colortool-main" aria-label={label} data-tip={label} disabled={!ready} onClick={() => (last ? apply(last) : pop.toggle())}>
        {tool.icon}
        <span className="swatch" style={{ background: last ?? swatch ?? 'transparent' }} />
      </button>
      <button ref={pop.button} className={cn('tool office-colortool-more', pop.anchor && 'on')} aria-label={`${label}: ${T.colors}`} aria-haspopup="dialog" aria-expanded={pop.anchor !== null} disabled={!ready} onClick={pop.toggle}>
        <ChevronDown size={11} />
      </button>
      {pop.anchor && (
        <Pop anchor={pop.anchor} trigger={pop.button} onClose={pop.close} label={label} className="office-colorpop">
          <ColorPicker current={swatch} swatches={tool.swatches} none={tool.none} noneLabel={tool.key === 'highlight' ? T.noHighlight : tool.key === 'color' ? T.colorPicker.automatic : T.noFill} onPick={apply} />
        </Pop>
      )}
    </span>
  )
}

// ---------------------------------------------------------- letra y tamaño

const FONT_RECENT = 'molino.office.fonts'
/** La letra de la interfaz que se ve como cada fuente (Inter es la variable de la interfaz). */
const faceOf = (font: string): string => (font === 'Inter' ? '"Inter Variable", Inter' : `"${font}"`)

function recentFonts(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(FONT_RECENT) ?? '[]') as unknown
    return Array.isArray(list) ? list.filter((f): f is string => typeof f === 'string').slice(0, 6) : []
  } catch {
    return []
  }
}

/** La fuente: cada una escrita con su letra, con buscador y las últimas usadas arriba. */
export function FontPicker({ state, ready, run, fallback }: { state: EditorState | null; ready: boolean; run: Run; fallback: string[] }) {
  const pop = usePopButton()
  const [query, setQuery] = useState('')
  const list = useRef<HTMLDivElement>(null)
  const fonts = useMemo(() => {
    const known = state?.fonts.length ? state.fonts : fallback
    return [...new Set(known)].sort((a, b) => a.localeCompare(b))
  }, [state?.fonts, fallback])
  const current = state?.font ?? ''
  const plain = query.trim().toLowerCase()
  const shown = plain ? fonts.filter((f) => f.toLowerCase().includes(plain)) : fonts
  const recent = plain ? [] : recentFonts().filter((f) => fonts.includes(f))
  const choose = (font: string): void => {
    try {
      localStorage.setItem(FONT_RECENT, JSON.stringify([font, ...recentFonts().filter((f) => f !== font)].slice(0, 6)))
    } catch {
      /* sin almacenamiento */
    }
    pop.close()
    setQuery('')
    run('font', font)
  }
  useEffect(() => {
    if (!pop.anchor) return
    // La que está puesta, a la vista.
    requestAnimationFrame(() => list.current?.querySelector('.on')?.scrollIntoView({ block: 'center' }))
  }, [pop.anchor])
  const item = (font: string, key: string) => (
    <button key={key} role="option" aria-selected={font === current} className={cn('office-font', font === current && 'on')} style={{ fontFamily: `${faceOf(font)}, var(--font-ui)` }} onClick={() => choose(font)}>
      {font}
      {font === current && <Check size={13} className="tick" />}
    </button>
  )
  return (
    <>
      <button ref={pop.button} className={cn('tool office-picker wide', pop.anchor && 'on')} aria-label={T.tools.font} data-tip={T.tools.font} aria-haspopup="listbox" disabled={!ready} onClick={pop.toggle}>
        <span style={{ fontFamily: `${faceOf(current)}, var(--font-ui)` }}>{current || '—'}</span>
        <ChevronDown size={11} className="tool-caret" />
      </button>
      {pop.anchor && (
        <Pop anchor={pop.anchor} trigger={pop.button} onClose={pop.close} label={T.tools.font} className="office-fontpop">
          <label className="office-search">
            <Search size={14} />
            <input
              autoFocus
              value={query}
              placeholder={T.fontPicker.search}
              aria-label={T.fontPicker.search}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && shown[0]) choose(shown[0])
              }}
            />
          </label>
          <div ref={list} className="office-fonts" role="listbox" aria-label={T.tools.font}>
            {recent.length > 0 && (
              <>
                <div className="office-visual-title">{T.fontPicker.recent}</div>
                {recent.map((f) => item(f, `r-${f}`))}
                <div className="office-visual-title">{T.fontPicker.all}</div>
              </>
            )}
            {shown.map((f) => item(f, f))}
            {shown.length === 0 && <p className="hint office-empty-note">{T.fontPicker.none}</p>}
          </div>
        </Pop>
      )}
    </>
  )
}

const SIZES = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 44, 54, 72]

/** El tamaño: se escribe o se elige de la lista; y los botones para hacerla más grande o más pequeña. */
export function SizePicker({ state, ready, run }: { state: EditorState | null; ready: boolean; run: Run }) {
  const pop = usePopButton()
  const size = state?.size ?? 11
  const [draft, setDraft] = useState(String(size))
  useEffect(() => setDraft(String(size).replace('.', ',')), [size])
  const apply = (value: string): void => {
    const n = Number(value.replace(',', '.'))
    if (Number.isFinite(n) && n >= 1 && n <= 409) run('size', String(Math.round(n * 2) / 2))
    else setDraft(String(size))
  }
  return (
    <span className="office-size">
      <input
        className="office-size-input"
        value={draft}
        aria-label={T.tools.size}
        data-tip={T.tools.size}
        disabled={!ready}
        inputMode="decimal"
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9.,]/g, '').slice(0, 5))}
        onFocus={(e) => e.target.select()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') apply(draft)
          if (e.key === 'Escape') setDraft(String(size))
        }}
        onBlur={() => setDraft(String(size).replace('.', ','))}
      />
      <button ref={pop.button} className={cn('tool office-size-more', pop.anchor && 'on')} aria-label={T.fontPicker.sizes} aria-haspopup="listbox" disabled={!ready} onClick={pop.toggle}>
        <ChevronDown size={11} />
      </button>
      {pop.anchor && (
        <Pop anchor={pop.anchor} trigger={pop.button} onClose={pop.close} label={T.tools.size} className="office-sizepop">
          <div className="office-sizes" role="listbox">
            {SIZES.map((n) => (
              <button
                key={n}
                role="option"
                aria-selected={n === size}
                className={cn('office-font', n === size && 'on')}
                onClick={() => {
                  pop.close()
                  run('size', String(n))
                }}
              >
                {String(n).replace('.', ',')}
              </button>
            ))}
          </div>
        </Pop>
      )}
    </span>
  )
}

// ----------------------------------------------------------------- estilos

/** Cómo se ve cada estilo en su vista previa (aproximado, con la letra del documento). */
const STYLE_LOOK: Record<string, CSSProperties> = {
  Normal: { fontSize: 13 },
  'No Spacing': { fontSize: 13, letterSpacing: '-0.01em' },
  Title: { fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em' },
  Subtitle: { fontSize: 14, color: 'var(--text-2)' },
  'Heading 1': { fontSize: 17, fontWeight: 700, color: 'var(--accent-fg)' },
  'Heading 2': { fontSize: 15, fontWeight: 700, color: 'var(--accent-fg)' },
  'Heading 3': { fontSize: 13.5, fontWeight: 650, color: 'var(--text-2)' },
  Quote: { fontSize: 13, fontStyle: 'italic', color: 'var(--text-2)' }
}

/**
 * Estilos: cada uno escrito como es (los de siempre y los propios del
 * documento). Al pasar el ratón por encima se ve en el texto, como en Word;
 * al pulsar se queda. «Nuevo estilo» lo crea con el formato de lo seleccionado.
 */
export function StylePicker({ state, ready, run, onNew }: { state: EditorState | null; ready: boolean; run: Run; onNew: () => void }) {
  const pop = usePopButton()
  const current = state?.style ?? 'Normal'
  const names = T.styles as Record<string, string>
  const custom = (state?.customStyles ?? []).filter((s) => !(s in names))
  const previewing = useRef(false)
  const endPreview = (): void => {
    if (!previewing.current) return
    previewing.current = false
    run('stylePreviewEnd')
  }
  const close = (): void => {
    endPreview()
    pop.close()
  }
  const tile = (key: string, title: string, look?: CSSProperties) => (
    <button
      key={key}
      role="option"
      aria-selected={key === current}
      className={cn('office-style-card', key === current && 'on')}
      onMouseEnter={() => {
        previewing.current = true
        run('stylePreview', key)
      }}
      onClick={() => {
        previewing.current = false
        pop.close()
        run('style', key)
      }}
    >
      <span style={look ?? { fontSize: 13 }}>{title}</span>
    </button>
  )
  return (
    <>
      <button ref={pop.button} className={cn('tool office-style-btn', pop.anchor && 'on')} aria-label={T.tools.style} aria-haspopup="listbox" aria-expanded={pop.anchor !== null} disabled={!ready} onClick={() => (pop.anchor ? close() : pop.toggle())}>
        <span style={{ ...(STYLE_LOOK[current] ?? {}), fontSize: 13, color: undefined }}>{names[current] ?? current}</span>
        <ChevronDown size={11} className="tool-caret" />
      </button>
      {pop.anchor && (
        <Pop anchor={pop.anchor} trigger={pop.button} onClose={close} label={T.tools.style} className="office-styles">
          <div className="office-styles-grid" role="listbox" aria-label={T.tools.style} onMouseLeave={endPreview}>
            {Object.keys(names).map((key) => tile(key, names[key], STYLE_LOOK[key]))}
            {custom.map((key) => tile(key, key))}
          </div>
          <div className="office-rows">
            <button
              className="office-row action"
              onClick={() => {
                close()
                onNew()
              }}
            >
              <span className="office-row-icon">
                <Plus size={15} />
              </span>
              <span className="office-row-label">{T.stylePicker.new}</span>
            </button>
          </div>
        </Pop>
      )}
    </>
  )
}

/** Un botón con su icono y, si se pide, su nombre (en «Más» van todos con nombre). */
export function ToolButton({ icon, label, caption, on, disabled, onClick }: { icon: ReactNode; label: string; caption?: boolean; on?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button className={cn('tool', !caption && 'icon', on && 'on')} aria-label={label} aria-pressed={on} data-tip={caption ? undefined : label} disabled={disabled} onClick={onClick}>
      {icon}
      {caption && <span>{label}</span>}
    </button>
  )
}
