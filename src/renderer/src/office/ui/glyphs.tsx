import type { ReactNode } from 'react'

/**
 * Las miniaturas de los menús visuales (márgenes, columnas, bordes, ajuste del
 * texto, listas, interlineado…): dibujos pequeños en SVG con los colores de la
 * interfaz (currentColor y el acento), que se ven igual en claro y en oscuro.
 */

const PAPER = 'var(--bg-surface)'
const INK = 'currentColor'
const FAINT = 'color-mix(in srgb, currentColor 35%, transparent)'
const ACCENT = 'var(--accent)'

function Svg({ w, h, children }: { w: number; h: number; children: ReactNode }) {
  return (
    <svg className="glyph-svg" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      {children}
    </svg>
  )
}

/** Líneas de texto dentro de un hueco (x, y, ancho, alto), separadas ``gap``. */
function textLines(x: number, y: number, width: number, height: number, gap = 4, color = FAINT): ReactNode[] {
  const out: ReactNode[] = []
  for (let line = y + 1, i = 0; line < y + height - 0.5; line += gap, i++) {
    out.push(<rect key={`${x}-${line}`} x={x} y={line} width={i % 4 === 3 ? width * 0.6 : width} height={1.4} rx={0.7} fill={color} />)
  }
  return out
}

/** Una página: márgenes (en proporción del ancho) y columnas. */
export function PageGlyph({ margin = 0.16, columns = 1, landscape = false, top }: { margin?: number; columns?: number; landscape?: boolean; top?: number }) {
  const w = landscape ? 44 : 32
  const h = landscape ? 32 : 42
  const m = Math.max(2, Math.round(w * margin))
  const mt = Math.max(2, Math.round(h * (top ?? margin * 0.75)))
  const inner = w - 2 * m
  const gap = 3
  const colW = (inner - gap * (columns - 1)) / columns
  return (
    <Svg w={w + 2} h={h + 2}>
      <rect x={1} y={1} width={w} height={h} rx={2.5} fill={PAPER} stroke={FAINT} />
      <rect x={1 + m} y={1 + mt} width={inner} height={h - 2 * mt} fill="none" stroke={ACCENT} strokeDasharray="2 1.5" strokeWidth={0.8} />
      {Array.from({ length: columns }, (_, c) => textLines(1 + m + c * (colW + gap) + 1, 2 + mt, colW - 2, h - 2 * mt - 2))}
    </Svg>
  )
}

/** Un tamaño de papel o de diapositiva: el rectángulo en proporción. */
export function SizeGlyph({ width, height }: { width: number; height: number }) {
  const scale = 38 / Math.max(width, height)
  const w = Math.round(width * scale)
  const h = Math.round(height * scale)
  return (
    <Svg w={42} h={42}>
      <rect x={(42 - w) / 2} y={(42 - h) / 2} width={w} height={h} rx={2} fill={PAPER} stroke={INK} strokeWidth={1.2} />
    </Svg>
  )
}

/** Interlineado: cuatro líneas más o menos separadas. */
export function SpacingGlyph({ gap }: { gap: number }) {
  return (
    <Svg w={30} h={30}>
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={4} y={4 + i * gap} width={i === 3 ? 14 : 22} height={2} rx={1} fill={INK} />
      ))}
    </Svg>
  )
}

/** Espacio entre párrafos: dos bloques con más o menos aire. */
export function ParagraphGlyph({ before, after }: { before: number; after: number }) {
  const y1 = 3 + before
  const y2 = y1 + 9 + after
  return (
    <Svg w={30} h={34}>
      {textLines(4, y1, 22, 8, 3.5, INK)}
      {textLines(4, y2, 22, 8, 3.5, INK)}
    </Svg>
  )
}

/** Una lista: tres filas con su viñeta o su número. */
export function ListGlyph({ marks, font }: { marks: string[]; font?: string }) {
  return (
    <span className="glyph-list" style={font ? { fontFamily: font } : undefined}>
      {marks.map((mark, i) => (
        <span key={i}>
          <b>{mark}</b>
          <i style={{ width: i === 2 ? '55%' : '78%' }} />
        </span>
      ))}
    </span>
  )
}

/** Una lista multinivel: cada fila más adentro. */
export function OutlineGlyph({ marks }: { marks: string[] }) {
  return (
    <span className="glyph-list outline">
      {marks.map((mark, i) => (
        <span key={i} style={{ paddingLeft: i * 7 }}>
          <b>{mark}</b>
          <i style={{ width: `${70 - i * 12}%` }} />
        </span>
      ))}
    </span>
  )
}

/** Bordes de tabla o de celda: qué líneas se dibujan. */
export function BorderGlyph({ outside = false, inside = false, bottom = false, top = false, left = false, right = false }: { outside?: boolean; inside?: boolean; bottom?: boolean; top?: boolean; left?: boolean; right?: boolean }) {
  const line = (key: string, x1: number, y1: number, x2: number, y2: number, on: boolean) => (
    <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} stroke={on ? INK : FAINT} strokeWidth={on ? 1.6 : 0.8} strokeDasharray={on ? undefined : '1.5 1.5'} />
  )
  return (
    <Svg w={28} h={28}>
      {line('t', 3, 3, 25, 3, outside || top)}
      {line('b', 3, 25, 25, 25, outside || bottom)}
      {line('l', 3, 3, 3, 25, outside || left)}
      {line('r', 25, 3, 25, 25, outside || right)}
      {line('h', 3, 14, 25, 14, inside)}
      {line('v', 14, 3, 14, 25, inside)}
    </Svg>
  )
}

/** Cómo se ajusta el texto alrededor de una imagen o una forma. */
export function WrapGlyph({ mode }: { mode: 'inline' | 'square' | 'tight' | 'topBottom' | 'behind' | 'front' }) {
  const box = { x: 12, y: 10, w: 12, h: 11 }
  const lines: ReactNode[] = []
  for (let y = 4; y < 30; y += 4) {
    const crossing = y >= box.y - 1 && y <= box.y + box.h + 1
    if (mode === 'square' || mode === 'tight') {
      if (crossing) {
        lines.push(<rect key={`a${y}`} x={3} y={y} width={box.x - 5} height={1.4} rx={0.7} fill={FAINT} />)
        lines.push(<rect key={`b${y}`} x={box.x + box.w + 2} y={y} width={31 - box.x - box.w} height={1.4} rx={0.7} fill={FAINT} />)
        continue
      }
    } else if (mode === 'topBottom' && crossing) continue
    else if (mode === 'inline' && crossing) {
      if (y === 12) lines.push(<rect key={`i${y}`} x={box.x + box.w + 2} y={box.y + box.h - 2} width={31 - box.x - box.w} height={1.4} rx={0.7} fill={FAINT} />)
      continue
    }
    lines.push(<rect key={y} x={3} y={y} width={30} height={1.4} rx={0.7} fill={FAINT} />)
  }
  const image = <rect key="img" x={box.x} y={box.y} width={box.w} height={box.h} rx={mode === 'tight' ? 5 : 1.5} fill={ACCENT} opacity={mode === 'behind' ? 0.35 : 0.9} />
  return (
    <Svg w={36} h={32}>
      {mode === 'front' ? [...lines, image] : [image, ...lines]}
    </Svg>
  )
}

/** Una forma. */
export function ShapeGlyph({ shape }: { shape: string }) {
  const s = { fill: 'color-mix(in srgb, var(--accent) 22%, transparent)', stroke: ACCENT, strokeWidth: 1.4, strokeLinejoin: 'round' as const }
  const body: Record<string, ReactNode> = {
    rect: <rect x={4} y={7} width={22} height={16} {...s} />,
    roundRect: <rect x={4} y={7} width={22} height={16} rx={5} {...s} />,
    ellipse: <ellipse cx={15} cy={15} rx={11} ry={8} {...s} />,
    triangle: <path d="M15 5 L26 25 L4 25 Z" {...s} />,
    rtTriangle: <path d="M5 5 L5 25 L25 25 Z" {...s} />,
    diamond: <path d="M15 4 L26 15 L15 26 L4 15 Z" {...s} />,
    hexagon: <path d="M9 6 L21 6 L27 15 L21 24 L9 24 L3 15 Z" {...s} />,
    star5: <path d="M15 3 L18.5 11 L27 11.5 L20.5 17 L22.5 26 L15 21 L7.5 26 L9.5 17 L3 11.5 L11.5 11 Z" {...s} />,
    rightArrow: <path d="M3 11 L17 11 L17 6 L27 15 L17 24 L17 19 L3 19 Z" {...s} />,
    leftArrow: <path d="M27 11 L13 11 L13 6 L3 15 L13 24 L13 19 L27 19 Z" {...s} />,
    upArrow: <path d="M11 27 L11 13 L6 13 L15 3 L24 13 L19 13 L19 27 Z" {...s} />,
    downArrow: <path d="M11 3 L11 17 L6 17 L15 27 L24 17 L19 17 L19 3 Z" {...s} />,
    line: <line x1={4} y1={24} x2={26} y2={6} stroke={ACCENT} strokeWidth={1.8} strokeLinecap="round" />,
    lineWithArrow: (
      <>
        <line x1={4} y1={24} x2={24} y2={8} stroke={ACCENT} strokeWidth={1.8} strokeLinecap="round" />
        <path d="M26 6 L17 8.5 L23.5 14 Z" fill={ACCENT} />
      </>
    ),
    wedgeRectCallout: <path d="M4 5 L26 5 L26 19 L14 19 L8 26 L9 19 L4 19 Z" {...s} />,
    cloud: <path d="M9 23 C4 23 3 17 7.5 16 C6.5 10 13 8 15.5 11.5 C17 7 24 8 23.5 13 C28 13.5 28 23 22.5 23 Z" {...s} />,
    heart: <path d="M15 25 C7 19 4 15 4 11 C4 7.5 7 5.5 9.8 5.5 C12.5 5.5 14 7.5 15 9 C16 7.5 17.5 5.5 20.2 5.5 C23 5.5 26 7.5 26 11 C26 15 23 19 15 25 Z" {...s} />
  }
  return <Svg w={30} h={30}>{body[shape] ?? body.rect}</Svg>
}

/** Una escala de color (formato condicional). */
export function ScaleGlyph({ colors }: { colors: string[] }) {
  return <span className="glyph-scale" style={{ background: `linear-gradient(90deg, ${colors.join(', ')})` }} />
}

/** Barras de datos. */
export function BarsGlyph({ color }: { color: string }) {
  return (
    <span className="glyph-bars">
      {[90, 55, 75, 30].map((w, i) => (
        <i key={i} style={{ width: `${w}%`, background: `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 25%, transparent))` }} />
      ))}
    </span>
  )
}

/** Conjuntos de iconos. */
export function IconSetGlyph({ set }: { set: 'traffic' | 'arrows' }) {
  return set === 'traffic' ? (
    <span className="glyph-icons">
      <i style={{ background: '#2a9358' }} />
      <i style={{ background: '#d4a72c' }} />
      <i style={{ background: '#c4505a' }} />
    </span>
  ) : (
    <span className="glyph-icons arrows">
      <b style={{ color: '#2a9358' }}>↑</b>
      <b style={{ color: '#d4a72c' }}>→</b>
      <b style={{ color: '#c4505a' }}>↓</b>
    </span>
  )
}

/** Un estilo de tabla: la cabecera y las filas alternas con su color. */
export function TableStyleGlyph({ color, light = false }: { color: string; light?: boolean }) {
  return (
    <Svg w={36} h={28}>
      {[0, 1, 2, 3].map((row) => (
        <rect
          key={row}
          x={2}
          y={2 + row * 6}
          width={32}
          height={6}
          fill={row === 0 ? (light ? 'none' : color) : row % 2 ? `color-mix(in srgb, ${color} ${light ? 14 : 22}%, transparent)` : 'none'}
          stroke={light ? color : 'none'}
          strokeWidth={row === 0 ? 1.2 : 0}
        />
      ))}
      <rect x={2} y={2} width={32} height={24} fill="none" stroke={`color-mix(in srgb, ${color} 55%, transparent)`} strokeWidth={0.8} />
    </Svg>
  )
}

/** Grosor de línea. */
export function LineWidthGlyph({ width }: { width: number }) {
  return (
    <Svg w={44} h={14}>
      <line x1={3} y1={7} x2={41} y2={7} stroke={INK} strokeWidth={Math.max(0.6, Math.min(7, width * 1.1))} strokeLinecap="round" />
    </Svg>
  )
}

/** Dónde va el número de página. */
export function PageNumberGlyph({ where }: { where: 'top' | 'bottom' }) {
  return (
    <Svg w={34} h={44}>
      <rect x={1} y={1} width={32} height={42} rx={2.5} fill={PAPER} stroke={FAINT} />
      {textLines(6, 10, 22, 24)}
      <rect x={14} y={where === 'top' ? 4 : 37} width={6} height={3} rx={1} fill={ACCENT} />
    </Svg>
  )
}

/** Marca de agua: la página con el texto en diagonal. */
export function WatermarkGlyph({ text }: { text?: string }) {
  return (
    <Svg w={34} h={44}>
      <rect x={1} y={1} width={32} height={42} rx={2.5} fill={PAPER} stroke={FAINT} />
      {textLines(6, 6, 22, 32)}
      {text && (
        <text x={17} y={24} textAnchor="middle" fontSize={5.5} fontWeight={700} fill={ACCENT} opacity={0.75} transform="rotate(-38 17 22)">
          {text.slice(0, 11)}
        </text>
      )}
    </Svg>
  )
}

/** Un salto (de página, de columna o de sección). */
export function BreakGlyph({ kind }: { kind: 'page' | 'column' | 'nextPage' | 'continuous' }) {
  return (
    <Svg w={34} h={36}>
      {kind === 'column' ? (
        <>
          {textLines(3, 4, 12, 28)}
          {textLines(19, 4, 12, 12)}
          <line x1={17} y1={2} x2={17} y2={34} stroke={ACCENT} strokeDasharray="2 2" />
        </>
      ) : (
        <>
          {textLines(4, 3, 26, 10)}
          <line x1={2} y1={17} x2={32} y2={17} stroke={ACCENT} strokeWidth={kind === 'continuous' ? 1 : 1.6} strokeDasharray={kind === 'page' ? undefined : '3 2'} />
          {textLines(4, 21, 26, kind === 'continuous' ? 12 : 8)}
        </>
      )}
    </Svg>
  )
}
