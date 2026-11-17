import type { ReactNode } from 'react'
import type { Api, FeatureContext } from '../types'

/**
 * Las miniaturas de los diseños de diapositiva (Inicio → Diapositiva nueva y
 * Diseño de la diapositiva): dibujadas por Molino en SVG, con los colores de la
 * interfaz y el de la app, en vez de la vista previa del editor (cuadros de
 * líneas de puntos). Cada diseño se dibuja con sus huecos de verdad (dónde
 * están y de qué tipo son: título, texto, imagen, gráfico…), leídos con la API
 * de documentos del editor; así salen bien también los diseños propios de cada
 * plantilla. Si no se pueden leer, se dibuja según el tipo del diseño.
 */

/** Un hueco de un diseño: su tipo y dónde está (en proporción de la diapositiva, de 0 a 1). */
export interface LayoutBox {
  kind: 'title' | 'ctrTitle' | 'subTitle' | 'body' | 'content' | 'picture' | 'chart' | 'table' | 'media' | 'diagram'
  x: number
  y: number
  w: number
  h: number
  /** Texto en vertical. */
  vert?: boolean
}

/** Lo que se guarda en el estado (extra.layoutArt): los huecos de cada diseño (por su índice) y la forma de la diapositiva. */
export interface LayoutArt {
  aspect: number
  boxes: Record<number, LayoutBox[]>
}

/** Los tipos de diseño de OOXML (ST_SlideLayoutType), en el orden del editor (layout.getType()). */
const VERT_TYPES = new Set([33, 34, 35])
const KINDS: Record<string, LayoutBox['kind']> = {
  title: 'title',
  ctrTitle: 'ctrTitle',
  subTitle: 'subTitle',
  body: 'body',
  unknown: 'content',
  obj: 'content',
  object: 'content',
  pic: 'picture',
  picture: 'picture',
  clipArt: 'picture',
  chart: 'chart',
  table: 'table',
  tbl: 'table',
  media: 'media',
  dgm: 'diagram',
  diagram: 'diagram'
}
const MAX_BOXES = 12

const unit = (n: number): number => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0)

/**
 * Lee los huecos de los diseños que da el editor (asc_onUpdateLayout): los del
 * patrón de la diapositiva actual (o el patrón cuyos diseños se llamen igual).
 */
export function readLayoutArt(ctx: FeatureContext, list: { index: number; name: string; type: number }[]): LayoutArt | null {
  const { api } = ctx
  try {
    const W = Number(api.get_PresentationWidth())
    const H = Number(api.get_PresentationHeight())
    if (!(W > 0 && H > 0) || !list.length) return null
    const presentation = api.getJsApi().GetPresentation()
    const masters: Api[] = []
    const own = presentation.GetCurrentSlide?.()?.GetLayout?.()?.GetMaster?.()
    if (own) masters.push(own)
    const count = Math.min(50, Number(presentation.GetMastersCount?.()) || 0)
    for (let i = 0; i < count; i++) masters.push(presentation.GetMaster(i))
    const matches = (master: Api): boolean => {
      try {
        return list.every((l) => String(master.GetLayout(l.index)?.GetName?.() ?? '') === l.name)
      } catch {
        return false
      }
    }
    const master = masters.find((m) => m && matches(m))
    if (!master) return null
    const boxes: Record<number, LayoutBox[]> = {}
    for (const l of list.slice(0, 200)) {
      const layout = master.GetLayout(l.index)
      const drawings: Api[] = layout?.GetAllShapes?.() ?? []
      const found: LayoutBox[] = []
      for (const shape of drawings) {
        const type = String(shape.GetPlaceholder?.()?.GetType?.() ?? '')
        const kind = KINDS[type]
        if (!kind) continue
        const box: LayoutBox = {
          kind,
          x: unit(Number(shape.GetPosX()) / W),
          y: unit(Number(shape.GetPosY()) / H),
          w: unit(Number(shape.GetWidth()) / W),
          h: unit(Number(shape.GetHeight()) / H)
        }
        if (box.w <= 0.01 || box.h <= 0.01) continue
        const tall = (box.h * H) / (box.w * W) > 1.3
        if (VERT_TYPES.has(l.type) && (kind === 'body' || ((kind === 'title' || kind === 'ctrTitle') && tall))) box.vert = true
        found.push(box)
        if (found.length >= MAX_BOXES) break
      }
      boxes[l.index] = found
    }
    return { aspect: W / H, boxes }
  } catch (error) {
    console.error('diseños:', error)
    return null
  }
}

// ------------------------------------------------------------------- dibujo

const FAINT = 'color-mix(in srgb, currentColor 30%, transparent)'
const SOFT = 'color-mix(in srgb, currentColor 52%, transparent)'
const ACCENT = 'var(--accent)'
const ACCENT_BOX = 'color-mix(in srgb, var(--accent) 7%, var(--bg-surface))'
const ACCENT_LINE = 'color-mix(in srgb, var(--accent) 34%, transparent)'

/** Los huecos según el tipo del diseño, si no se han podido leer (los de la plantilla vacía de Office). */
function fallbackBoxes(type: number, name: string): LayoutBox[] {
  const title: LayoutBox = { kind: 'title', x: 0.07, y: 0.05, w: 0.86, h: 0.19 }
  const body = (x: number, w: number, kind: LayoutBox['kind'] = 'content'): LayoutBox => ({ kind, x, y: 0.27, w, h: 0.63 })
  const byName = name.toLowerCase()
  if (type === 18 || /t[ií]tulo de|title slide/.test(byName)) return [{ kind: 'ctrTitle', x: 0.125, y: 0.16, w: 0.75, h: 0.35 }, { kind: 'subTitle', x: 0.125, y: 0.53, w: 0.75, h: 0.24 }]
  if (type === 16) return [{ kind: 'title', x: 0.07, y: 0.25, w: 0.86, h: 0.42 }, { kind: 'body', x: 0.07, y: 0.67, w: 0.86, h: 0.22 }]
  if (type === 21 || type === 20) return [title, body(0.07, 0.42), body(0.51, 0.42)]
  if (type === 25) return [title, { kind: 'body', x: 0.07, y: 0.25, w: 0.42, h: 0.12 }, { kind: 'content', x: 0.07, y: 0.37, w: 0.42, h: 0.53 }, { kind: 'body', x: 0.51, y: 0.25, w: 0.42, h: 0.12 }, { kind: 'content', x: 0.51, y: 0.37, w: 0.42, h: 0.53 }]
  if (type === 19) return [title]
  if (type === 0) return []
  if (type === 14) return [{ kind: 'title', x: 0.07, y: 0.07, w: 0.32, h: 0.23 }, { kind: 'content', x: 0.43, y: 0.14, w: 0.5, h: 0.71 }, { kind: 'body', x: 0.07, y: 0.3, w: 0.32, h: 0.56 }]
  if (type === 15) return [{ kind: 'title', x: 0.07, y: 0.07, w: 0.32, h: 0.23 }, { kind: 'picture', x: 0.43, y: 0.14, w: 0.5, h: 0.71 }, { kind: 'body', x: 0.07, y: 0.3, w: 0.32, h: 0.56 }]
  if (type === 35) return [title, { ...body(0.07, 0.86, 'body'), vert: true }]
  if (type === 33) return [{ kind: 'title', x: 0.72, y: 0.05, w: 0.21, h: 0.85, vert: true }, { kind: 'body', x: 0.07, y: 0.05, w: 0.63, h: 0.85, vert: true }]
  if (type === 17) return [title, body(0.07, 0.86, 'table')]
  if (type === 1) return [title, body(0.07, 0.86, 'chart')]
  return [title, body(0.07, 0.86)]
}

/** Renglones de texto (rayas suaves), de arriba abajo dentro del hueco. */
function lines(key: string, x: number, y: number, w: number, h: number, gap: number, color = FAINT, center = false): ReactNode[] {
  const out: ReactNode[] = []
  for (let row = 0, top = y; top + 1.6 <= y + h && row < 8; row++, top += gap) {
    const width = row % 3 === 2 ? w * 0.62 : w
    out.push(<rect key={`${key}-${row}`} x={center ? x + (w - width) / 2 : x} y={top} width={Math.max(2, width)} height={1.6} rx={0.8} fill={color} />)
  }
  return out
}

/** Renglones de texto en vertical (de derecha a izquierda, como el texto vertical de Asia oriental). */
function vlines(key: string, x: number, y: number, w: number, h: number, gap: number, color = FAINT): ReactNode[] {
  const out: ReactNode[] = []
  for (let col = 0, left = x + w - 2; left >= x && col < 14; col++, left -= gap) {
    const height = col % 3 === 2 ? h * 0.55 : col % 3 === 1 ? h * 0.85 : h
    out.push(<rect key={`${key}-${col}`} x={left} y={y} width={1.6} height={Math.max(2, height)} rx={0.8} fill={color} />)
  }
  return out
}

/** Un hueco, en pequeño: el título en el color de la app, el texto en rayas, una imagen, un gráfico… */
function Box({ box, k, W, H }: { box: LayoutBox; k: string; W: number; H: number }) {
  const x = box.x * W
  const y = box.y * H
  const w = box.w * W
  const h = box.h * H
  const pad = Math.min(3, w / 6, h / 6)
  const frame = <rect x={x + 0.5} y={y + 0.5} width={Math.max(1, w - 1)} height={Math.max(1, h - 1)} rx={2.5} fill={ACCENT_BOX} stroke={ACCENT_LINE} strokeWidth={0.8} />
  const cx = x + w / 2
  const cy = y + h / 2
  switch (box.kind) {
    case 'ctrTitle':
    case 'title': {
      if (box.vert) {
        const bar = Math.min(4, w * 0.35)
        return <rect x={cx - bar / 2} y={y + h * 0.12} width={bar} height={h * 0.62} rx={bar / 2} fill={ACCENT} />
      }
      const bar = Math.min(4.2, h * 0.42)
      const width = Math.max(6, w * (box.kind === 'ctrTitle' ? 0.66 : 0.58))
      const left = box.kind === 'ctrTitle' ? cx - width / 2 : x + pad
      return <rect x={left} y={cy - bar / 2} width={width} height={bar} rx={bar / 2} fill={ACCENT} />
    }
    case 'subTitle':
      return <g>{lines(k, x + w * 0.22, cy - 2.2, w * 0.56, Math.min(h, 8), 4, SOFT, true)}</g>
    case 'body': {
      // Un texto corto (el pie del encabezado de sección, la cabecera de una comparación): una o dos rayas.
      if (box.vert) return <g>{vlines(k, x + pad, y + pad, w - 2 * pad, h - 2 * pad, 6)}</g>
      if (h < 0.2 * H) return <g>{lines(k, x + pad, cy - (h > 9 ? 3.4 : 0.8), Math.min(w - 2 * pad, 40), h > 9 ? 6 : 2, 4.4, SOFT)}</g>
      return <g>{lines(k, x + pad + 1, y + pad + 1, w - 2 * pad - 2, h - 2 * pad - 1, 4.2)}</g>
    }
    case 'content': {
      // Contenido: el marco y puntos con su texto (o cualquier objeto: imagen, tabla, gráfico).
      const rows: ReactNode[] = []
      const left = x + pad + 1.5
      for (let top = y + pad + 2, row = 0; top + 2 <= y + h - pad && row < 7; top += 5, row++) {
        rows.push(<circle key={`${k}-d${row}`} cx={left + 0.9} cy={top + 0.8} r={1.1} fill={ACCENT} />)
        rows.push(<rect key={`${k}-l${row}`} x={left + 3.6} y={top} width={Math.max(2, (w - 2 * pad - 6) * (row % 3 === 2 ? 0.55 : 0.85))} height={1.6} rx={0.8} fill={FAINT} />)
      }
      return (
        <g>
          {frame}
          {rows}
        </g>
      )
    }
    case 'picture': {
      const s = Math.min(w, h) * 0.5
      return (
        <g>
          {frame}
          <circle cx={cx + s * 0.32} cy={cy - s * 0.3} r={s * 0.12} fill={ACCENT} />
          <path d={`M${cx - s * 0.6} ${cy + s * 0.38} L${cx - s * 0.18} ${cy - s * 0.1} L${cx + s * 0.08} ${cy + s * 0.16} L${cx + s * 0.28} ${cy} L${cx + s * 0.6} ${cy + s * 0.38} Z`} fill={ACCENT} opacity={0.75} />
        </g>
      )
    }
    case 'chart': {
      const base = y + h - pad - 2
      const bw = Math.max(2, w / 9)
      return (
        <g>
          {frame}
          {[0.45, 0.8, 0.6, 0.95].map((t, i) => (
            <rect key={`${k}-b${i}`} x={cx - 2 * bw + i * bw * 1.1 - bw * 0.2} y={base - (h - 2 * pad - 4) * t} width={bw * 0.8} height={(h - 2 * pad - 4) * t} rx={0.6} fill={ACCENT} opacity={0.55 + i * 0.12} />
          ))}
        </g>
      )
    }
    case 'table': {
      const cells: ReactNode[] = []
      for (let r = 1; r < 4; r++) cells.push(<line key={`${k}-r${r}`} x1={x + 1} x2={x + w - 1} y1={y + (h * r) / 4} y2={y + (h * r) / 4} stroke={ACCENT_LINE} strokeWidth={0.8} />)
      for (let c = 1; c < 3; c++) cells.push(<line key={`${k}-c${c}`} y1={y + 1} y2={y + h - 1} x1={x + (w * c) / 3} x2={x + (w * c) / 3} stroke={ACCENT_LINE} strokeWidth={0.8} />)
      return (
        <g>
          {frame}
          <rect x={x + 0.5} y={y + 0.5} width={w - 1} height={h / 4} rx={2.5} fill={ACCENT} opacity={0.35} />
          {cells}
        </g>
      )
    }
    case 'media': {
      const s = Math.min(w, h) * 0.22
      return (
        <g>
          {frame}
          <path d={`M${cx - s * 0.6} ${cy - s} L${cx + s} ${cy} L${cx - s * 0.6} ${cy + s} Z`} fill={ACCENT} />
        </g>
      )
    }
    case 'diagram': {
      const s = Math.min(w / 5, h / 3)
      return (
        <g>
          {frame}
          {[-1, 0, 1].map((i) => (
            <rect key={`${k}-n${i}`} x={cx + i * s * 1.5 - s / 2} y={cy - s / 2} width={s} height={s} rx={1} fill={ACCENT} opacity={0.7} />
          ))}
        </g>
      )
    }
  }
  return null
}

/** La miniatura de un diseño: la diapositiva en pequeño con sus huecos. */
export function LayoutGlyph({ boxes, aspect = 16 / 9 }: { boxes: LayoutBox[]; aspect?: number }) {
  const W = 112
  const H = Math.round(Math.min(84, Math.max(48, W / (aspect > 0 ? aspect : 16 / 9))))
  return (
    <svg className="slide-layout-glyph" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <rect x={0.5} y={0.5} width={W - 1} height={H - 1} rx={5} fill="var(--bg-surface)" stroke="color-mix(in srgb, currentColor 18%, transparent)" />
      {boxes.length === 0 && <rect x={W / 2 - 9} y={H / 2 - 0.8} width={18} height={1.6} rx={0.8} fill={FAINT} />}
      {boxes.map((box, i) => (
        <Box key={i} box={box} k={String(i)} W={W} H={H} />
      ))}
    </svg>
  )
}

/** La miniatura de un diseño de la lista del editor: con sus huecos leídos o, si no, según su tipo. */
export function layoutGlyph(layout: { index: number; name: string; type?: number }, art: LayoutArt | undefined): ReactNode {
  const boxes = art?.boxes[layout.index] ?? fallbackBoxes(layout.type ?? -1, layout.name)
  return <LayoutGlyph boxes={boxes} aspect={art?.aspect} />
}

