import { Ellipsis } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import type { Mode, Tool } from './apps'
import type { EditorState } from './engine'
import { L } from './i18n'
import { ColorTool, FontPicker, SizePicker, StylePicker, toolLabel, VisualMenu } from './ui/pickers'
import { Pop, usePopButton } from './ui/pop'

const T = L.office
type Run = (command: string, value?: string) => unknown

/** Las fuentes de la lista si el editor aún no ha dado las suyas. */
const FONTS = ['Inter', 'Aptos', 'Calibri', 'Arial', 'Cambria', 'Georgia', 'Times New Roman', 'Verdana', 'Segoe UI', 'Courier New', 'Carlito', 'Open Sans']

/** Una herramienta de la barra (o de «Más», donde todas llevan su nombre). */
export function ToolView({ tool, state, ready, run, showLabel = false }: { tool: Tool; state: EditorState | null; ready: boolean; run: Run; showLabel?: boolean }) {
  if (tool.type === 'font') return <FontPicker state={state} ready={ready} run={run} fallback={FONTS} />
  if (tool.type === 'size') return <SizePicker state={state} ready={ready} run={run} />
  if (tool.type === 'style') return <StylePicker state={state} ready={ready} run={run} onNew={() => run('newStyleAsk')} />
  if (tool.type === 'menu') return <VisualMenu tool={tool} state={state} ready={ready} run={run} showLabel={showLabel} />
  if (tool.type === 'color') return <ColorTool tool={tool} state={state} ready={ready} run={run} />
  const label = toolLabel(tool)
  const on = state ? Boolean(tool.active?.(state)) : false
  const disabled = !ready || (state ? Boolean(tool.disabled?.(state)) : true)
  const caption = tool.caption || showLabel
  return (
    <button
      className={cn('tool', !caption && 'icon', on && 'on')}
      aria-label={label}
      aria-pressed={tool.active ? on : undefined}
      data-tip={caption ? undefined : label}
      disabled={disabled}
      onClick={() => run(tool.command, tool.value)}
    >
      {tool.icon}
      {caption && <span>{label}</span>}
    </button>
  )
}

/** El borde y el relleno de la barra flotante. */
const PILL_CHROME = 18
/** Lo más ancha que se hace la flotante (con más sitio, sigue igual: lo demás está en «Más»). */
const PILL_MAX = 940
/** Lo que ocupa el botón «Más» (y un poco de aire). */
const MORE_WIDTH = 84

/**
 * La barra de un modo, en una sola fila: flotante sobre el documento
 * (Documentos y Presentaciones) o fija arriba (Hojas). Los grupos que no
 * caben pasan, del último hacia atrás, a «Más», cada uno con su nombre. Se
 * monta de nuevo con cada modo (key): entonces se ven todos, se miden y se
 * reparten antes de pintar.
 */
export function ToolBar({ mode, state, run, docked }: { mode: Mode; state: EditorState | null; run: Run; docked: boolean }) {
  const ready = Boolean(state?.ready)
  const bar = useRef<HTMLDivElement>(null)
  const widths = useRef<number[]>([])
  const [shown, setShown] = useState(mode.groups.length)
  const more = usePopButton()
  const max = docked ? Number.POSITIVE_INFINITY : PILL_MAX

  useLayoutEffect(() => {
    const element = bar.current
    if (!element) return
    const fit = (): void => {
      const groups = element.querySelectorAll<HTMLElement>(':scope > .office-pill > .office-group')
      groups.forEach((group, i) => {
        widths.current[i] = group.getBoundingClientRect().width
      })
      const style = getComputedStyle(element)
      const gap = parseFloat(style.columnGap) || 0
      const available = Math.min(max, element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)) - PILL_CHROME
      const sizes = mode.groups.map((_, i) => (widths.current[i] ?? 0) + gap)
      if (sizes.reduce((a, b) => a + b, 0) <= available) return setShown(mode.groups.length)
      let used = MORE_WIDTH
      let n = 0
      while (n < sizes.length && used + sizes[n] <= available) used += sizes[n++]
      setShown(Math.max(1, n))
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(element)
    return () => observer.disconnect()
  }, [mode, max])

  // Por si las medidas se quedan cortas (un panel que aparece a la vez, letras que
  // tardan en cargar): si la barra se sale, un grupo más pasa a «Más».
  useLayoutEffect(() => {
    const element = bar.current
    const pill = element?.querySelector<HTMLElement>(':scope > .office-pill')
    if (!element || !pill || shown <= 1) return
    // Solo los grupos y «Más»: las etiquetas emergentes (invisibles) también desbordan y no cuentan.
    const limit = Math.min(pill.getBoundingClientRect().right - parseFloat(getComputedStyle(pill).paddingRight), element.getBoundingClientRect().right)
    const parts = pill.querySelectorAll<HTMLElement>(':scope > .office-group, :scope > .office-more')
    const right = Math.max(...[...parts].map((part) => part.getBoundingClientRect().right))
    if (right > limit + 1) setShown(shown - 1)
  })

  const hidden = mode.groups.slice(shown)
  // Una herramienta de «Más» cierra «Más» (sus menús y colores, al elegir).
  const runFromMore = (command: string, value?: string): unknown => {
    more.close()
    return run(command, value)
  }
  return (
    <div ref={bar} className={cn('office-toolbar', docked && 'docked')}>
      <div className="office-pill" role="toolbar" aria-label={T.tools.label}>
        {mode.groups.slice(0, shown).map((group, g) => (
          <div key={`${mode.id}-${g}`} className="office-group" data-group={mode.names?.[g] || undefined}>
            {group.map((tool, i) => (
              <ToolView key={i} tool={tool} state={state} ready={ready} run={run} />
            ))}
          </div>
        ))}
        {hidden.length > 0 && (
          <div className="office-more">
            <button ref={more.button} className={cn('tool', more.anchor && 'on')} aria-haspopup="dialog" aria-expanded={more.anchor !== null} onClick={more.toggle}>
              <Ellipsis size={16} />
              <span>{T.tools.more}</span>
            </button>
            {more.anchor && (
              <Pop anchor={more.anchor} trigger={more.button} onClose={more.close} align="end" label={T.tools.more} className="office-more-pop">
                {hidden.map((group, g) => (
                  <section key={`${mode.id}-more-${g}`} className="office-more-section">
                    {mode.names?.[shown + g] && <h4>{mode.names[shown + g]}</h4>}
                    <div className="office-more-tools">
                      {group.map((tool, i) => (
                        <ToolView key={i} tool={tool} state={state} ready={ready} run={runFromMore} showLabel />
                      ))}
                    </div>
                  </section>
                ))}
              </Pop>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
