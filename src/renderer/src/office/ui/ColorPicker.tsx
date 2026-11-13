import { Pipette } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/cn'
import { L } from '../i18n'

/**
 * Elegir un color, como en Office: los colores del tema con sus tonos (más
 * claros y más oscuros), los estándar, los últimos que se han usado y uno a
 * medida (con su código o el selector de Windows). Lo usan el color del texto,
 * el resaltado, el relleno, el contorno y el fondo de las tres apps.
 */

/** Los colores base (los de Molino), cada uno con sus tonos debajo. */
const BASE = ['#ffffff', '#000000', '#545b69', '#2867d1', '#c4505a', '#e06a1a', '#d4a72c', '#2a9358', '#7a5af5', '#b4357a']
/** Los estándar de Office. */
const STANDARD = ['#c00000', '#ff0000', '#ffc000', '#ffff00', '#92d050', '#00b050', '#00b0f0', '#0070c0', '#002060', '#7030a0']
const RECENT_KEY = 'molino.office.colors'
const MAX_RECENT = 10

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function toHex(parts: number[]): string {
  return `#${parts.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`
}
/** Más claro (t > 0, hacia el blanco) o más oscuro (t < 0, hacia el negro). */
function tint(hex: string, t: number): string {
  const c = rgb(hex)
  return toHex(c.map((v) => (t > 0 ? v + (255 - v) * t : v * (1 + t))))
}
/** Los cinco tonos de cada color base (como la paleta del tema de Office). */
function shades(hex: string): string[] {
  if (hex === '#ffffff') return [tint(hex, -0.05), tint(hex, -0.15), tint(hex, -0.25), tint(hex, -0.35), tint(hex, -0.5)]
  if (hex === '#000000') return [tint(hex, 0.5), tint(hex, 0.35), tint(hex, 0.25), tint(hex, 0.15), tint(hex, 0.05)]
  return [tint(hex, 0.8), tint(hex, 0.6), tint(hex, 0.4), tint(hex, -0.25), tint(hex, -0.5)]
}

function recentColors(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as unknown
    return Array.isArray(list) ? list.filter((c): c is string => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)).slice(0, MAX_RECENT) : []
  } catch {
    return []
  }
}
function remember(color: string): void {
  try {
    const list = [color, ...recentColors().filter((c) => c !== color)].slice(0, MAX_RECENT)
    localStorage.setItem(RECENT_KEY, JSON.stringify(list))
  } catch {
    /* sin almacenamiento: no se recuerdan */
  }
}

export function ColorPicker({
  current,
  swatches,
  none,
  noneLabel,
  onPick
}: {
  current: string | null
  /** Solo estos colores (el resaltado de Word solo admite unos pocos). */
  swatches?: string[]
  /** Botón «Sin color» (o «Automático»). */
  none?: boolean
  noneLabel?: string
  onPick: (color: string) => void
}) {
  const C = L.office.colorPicker
  const [custom, setCustom] = useState(current && /^#[0-9a-f]{6}$/i.test(current) ? current : '#2867d1')
  const pick = (color: string): void => {
    if (color) remember(color.toLowerCase())
    onPick(color)
  }
  const chip = (color: string, title?: string) => (
    <button
      key={color}
      type="button"
      className={cn('office-swatch', current?.toLowerCase() === color.toLowerCase() && 'on')}
      style={{ background: color }}
      aria-label={title ?? color}
      data-tip={title ?? color.toUpperCase()}
      onClick={() => pick(color)}
    />
  )
  const recent = recentColors()
  return (
    <div className="office-colors">
      {none && (
        <button type="button" className="office-color-none" onClick={() => onPick('')}>
          <span className="office-swatch empty" />
          {noneLabel ?? C.none}
        </button>
      )}
      {swatches ? (
        <div className="office-swatches">{swatches.map((c) => chip(c))}</div>
      ) : (
        <>
          <span className="office-colors-title">{C.theme}</span>
          <div className="office-swatches theme">
            {BASE.map((c) => chip(c))}
            {[0, 1, 2, 3, 4].map((row) => BASE.map((c) => chip(shades(c)[row])))}
          </div>
          <span className="office-colors-title">{C.standard}</span>
          <div className="office-swatches">{STANDARD.map((c) => chip(c))}</div>
        </>
      )}
      {recent.length > 0 && !swatches && (
        <>
          <span className="office-colors-title">{C.recent}</span>
          <div className="office-swatches">{recent.map((c) => chip(c))}</div>
        </>
      )}
      {!swatches && (
        <div className="office-color-custom">
          <label className="office-color-native" data-tip={C.more}>
            <Pipette size={14} />
            <input type="color" aria-label={C.more} value={custom} onChange={(e) => setCustom(e.target.value)} />
          </label>
          <input
            className="input"
            aria-label={C.code}
            value={custom.toUpperCase()}
            maxLength={7}
            spellCheck={false}
            onChange={(e) => {
              const value = e.target.value.trim()
              setCustom(value.startsWith('#') ? value : `#${value}`)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && /^#[0-9a-f]{6}$/i.test(custom)) pick(custom)
            }}
          />
          <span className="office-swatch" style={{ background: /^#[0-9a-f]{6}$/i.test(custom) ? custom : 'transparent' }} />
          <button type="button" className="btn sm" disabled={!/^#[0-9a-f]{6}$/i.test(custom)} onClick={() => pick(custom)}>
            {C.apply}
          </button>
        </div>
      )}
    </div>
  )
}
