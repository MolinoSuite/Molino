import { ChevronDown, CircleDot, Eraser, Highlighter, Pen, Square, Trash2 } from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import type { InkColor } from '@shared/officeui'
import { L } from '../i18n'
import { COLORS, type HandTool, INK_HEX, type Screen } from './ink'
import './inktools.css'

const K = L.officeSlide.ink
const WIDTHS = [1, 2, 3] as const

/**
 * La barrita de herramientas de la presentación: láser, bolígrafo, rotulador,
 * color y grosor, borrador, borrar la tinta, y pantalla en negro o en blanco.
 * La misma en la vista del moderador (debajo de la diapositiva) y en la propia
 * presentación (abajo a la izquierda, slide/ShowLayer.tsx); ``before`` y
 * ``after``, lo que cada una pone a los lados (pasar de diapositiva, terminar).
 */
export function InkTools({
  tool,
  color,
  width,
  screen,
  onTool,
  onColor,
  onWidth,
  onClear,
  onScreen,
  before,
  after,
  className
}: {
  tool: HandTool
  color: InkColor
  width: 1 | 2 | 3
  screen: Screen
  onTool: (tool: HandTool) => void
  onColor: (color: InkColor) => void
  onWidth: (width: 1 | 2 | 3) => void
  onClear: () => void
  onScreen: (screen: Screen) => void
  before?: ReactNode
  after?: ReactNode
  className?: string
}) {
  const [colors, setColors] = useState(false)
  const pop = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!colors) return
    const close = (event: Event): void => {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return
      if (event instanceof PointerEvent && pop.current?.contains(event.target as Node)) return
      if (event instanceof KeyboardEvent) event.stopPropagation()
      setColors(false)
    }
    window.addEventListener('pointerdown', close, true)
    window.addEventListener('keydown', close, true)
    return () => {
      window.removeEventListener('pointerdown', close, true)
      window.removeEventListener('keydown', close, true)
    }
  }, [colors])

  const hand = (which: Exclude<HandTool, null>, icon: ReactNode, label: string, tip: string) => (
    <button className={`tool ink-tool${tool === which ? ' on' : ''}`} aria-pressed={tool === which} aria-label={label} data-tip={tip} data-tip-side="top" onClick={() => onTool(tool === which ? null : which)}>
      {icon}
      <span>{label}</span>
    </button>
  )
  const cover = (which: 'black' | 'white', label: string, tip: string) => (
    <button className={`tool ink-tool${screen === which ? ' on' : ''}`} aria-pressed={screen === which} aria-label={label} data-tip={tip} data-tip-side="top" onClick={() => onScreen(screen === which ? null : which)}>
      <Square size={15} className={`ink-screen-icon ${which}`} />
      <span>{label}</span>
    </button>
  )
  return (
    <div className={`ink-tools${className ? ` ${className}` : ''}`} role="toolbar" aria-label={K.label}>
      {before}
      <div className="ink-group">
        {hand('laser', <CircleDot size={15} className="ink-laser-icon" />, K.laser, K.laserTip)}
        {hand('pen', <Pen size={15} />, K.pen, K.penTip)}
        {hand('highlighter', <Highlighter size={15} />, K.highlighter, K.highlighterTip)}
        <div className="ink-color" ref={pop}>
          <button className={`tool icon ink-color-btn${colors ? ' on' : ''}`} aria-label={K.color} data-tip={colors ? undefined : K.color} data-tip-side="top" aria-expanded={colors} aria-haspopup="dialog" onClick={() => setColors(!colors)}>
            <span className="ink-dot" style={{ background: INK_HEX[color] }} />
            <ChevronDown size={11} />
          </button>
          {colors && (
            <div className="ink-pop" role="dialog" aria-label={K.color}>
              <div className="ink-swatches">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    className={`ink-swatch${c === color ? ' on' : ''}`}
                    aria-label={K.colors[c]}
                    aria-pressed={c === color}
                    data-tip={K.colors[c]}
                    data-tip-side="top"
                    style={{ background: INK_HEX[c] }}
                    onClick={() => {
                      onColor(c)
                      if (tool !== 'pen' && tool !== 'highlighter') onTool('pen')
                    }}
                  />
                ))}
              </div>
              <div className="ink-widths">
                {WIDTHS.map((w) => (
                  <button key={w} className={`ink-width${w === width ? ' on' : ''}`} aria-label={K.widths[w]} aria-pressed={w === width} data-tip={K.widths[w]} data-tip-side="top" onClick={() => onWidth(w)}>
                    <i style={{ width: 4 + w * 3, height: 4 + w * 3, background: INK_HEX[color] }} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {hand('eraser', <Eraser size={15} />, K.eraser, K.eraserTip)}
        <button className="tool ink-tool" aria-label={K.clear} data-tip={K.clearTip} data-tip-side="top" onClick={onClear}>
          <Trash2 size={15} />
          <span>{K.clear}</span>
        </button>
      </div>
      <div className="ink-group">
        {cover('black', K.black, K.blackTip)}
        {cover('white', K.white, K.whiteTip)}
      </div>
      {after}
    </div>
  )
}
