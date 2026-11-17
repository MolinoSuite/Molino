import { INK_COLORS, type InkColor, type InkOp, type InkStroke, type InkTool } from '@shared/officeui'

/**
 * La tinta de la presentación (bolígrafo y rotulador), el puntero láser y la
 * pantalla en negro: lo que comparten la vista del moderador (PresenterApp.tsx)
 * y la ventana de la presentación (features/slide/ShowLayer.tsx). Los trazos van
 * en proporción de la diapositiva (de 0 a 1), así se ven igual en las dos, sea
 * cual sea su tamaño. No se guardan en el archivo: duran lo que la presentación.
 */

/** Lo que se tiene en la mano: el láser, una tinta o el borrador (null: nada, el ratón de siempre). */
export type HandTool = 'laser' | InkTool | 'eraser' | null
export type Screen = 'black' | 'white' | null
export type Point = { x: number; y: number }

/** Un cambio en la tinta de la diapositiva que se ve (quien lo recibe le pone la diapositiva). */
export type LocalInkOp = { op: 'begin'; stroke: InkStroke } | { op: 'add'; id: string; points: number[] } | { op: 'erase'; ids: string[] } | { op: 'clear' }

export const COLORS = INK_COLORS
export const INK_HEX: Record<InkColor, string> = {
  red: '#e5383b',
  yellow: '#ffd43b',
  green: '#2fb344',
  blue: '#2f7cf6',
  black: '#16181d',
  white: '#ffffff'
}
/** El grosor de cada herramienta, en proporción del ancho de la diapositiva (fino, medio, grueso). */
const PEN_WIDTH = [0.0024, 0.0038, 0.0062]
const MARKER_WIDTH = [0.012, 0.019, 0.03]
/** Lo mismo que comprueba officepresenter.ts. */
export const MAX_OP_NUMBERS = 4_000
const MAX_STROKE_NUMBERS = 40_000
const MAX_STROKES = 1_000

export const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n)
export const round4 = (n: number): number => Math.round(clamp01(n) * 10_000) / 10_000

let counter = 0
/** Un nombre para un trazo nuevo, distinto en cada ventana (``side``: «p», la vista del moderador; «s», la presentación). */
export function strokeId(side: 'p' | 's'): string {
  counter = (counter + 1) % 1_000_000
  return `${side}${Date.now().toString(36)}${counter.toString(36)}`.slice(0, 24)
}

/** El grosor de un trazo, en proporción del ancho de la diapositiva. */
function strokeShare(stroke: Pick<InkStroke, 'tool' | 'width'>): number {
  const table = stroke.tool === 'highlighter' ? MARKER_WIDTH : PEN_WIDTH
  return table[(stroke.width ?? 2) - 1] ?? table[1]
}
/** El grosor de un trazo en píxeles, para un dibujo de ``width`` píxeles de ancho. */
export function strokePixels(stroke: Pick<InkStroke, 'tool' | 'width'>, width: number): number {
  return Math.max(1, strokeShare(stroke) * width)
}

/**
 * Aplica un cambio a la tinta de una diapositiva; devuelve la lista nueva (o la
 * misma si no ha cambiado nada).
 */
export function applyInk(strokes: InkStroke[], op: LocalInkOp | InkOp): InkStroke[] {
  if (op.op === 'clear') return strokes.length ? [] : strokes
  if (op.op === 'erase') {
    const gone = new Set(op.ids)
    const left = strokes.filter((s) => !gone.has(s.id))
    return left.length === strokes.length ? strokes : left
  }
  if (op.op === 'begin') {
    const others = strokes.filter((s) => s.id !== op.stroke.id)
    const list = [...others, { ...op.stroke, points: op.stroke.points.slice(0, MAX_STROKE_NUMBERS) }]
    return list.length > MAX_STROKES ? list.slice(list.length - MAX_STROKES) : list
  }
  const at = strokes.findIndex((s) => s.id === op.id)
  if (at < 0) return strokes
  const stroke = strokes[at]
  if (stroke.points.length >= MAX_STROKE_NUMBERS) return strokes
  const next = strokes.slice()
  next[at] = { ...stroke, points: stroke.points.concat(op.points).slice(0, MAX_STROKE_NUMBERS) }
  return next
}

/** Toda la tinta de cada diapositiva de la presentación (diapositiva → sus trazos). */
export class InkBook {
  private readonly slides = new Map<number, InkStroke[]>()
  get(slide: number): InkStroke[] {
    return this.slides.get(slide) ?? []
  }
  set(slide: number, strokes: InkStroke[]): void {
    if (strokes.length) this.slides.set(slide, strokes)
    else this.slides.delete(slide)
  }
  apply(slide: number, op: LocalInkOp | InkOp): boolean {
    const before = this.get(slide)
    const after = applyInk(before, op)
    if (after === before) return false
    this.set(slide, after)
    return true
  }
  clearAll(): void {
    this.slides.clear()
  }
}

/** Dibuja los trazos en un lienzo de ``w`` × ``h`` píxeles (la diapositiva entera). */
export function drawInk(context: CanvasRenderingContext2D, strokes: InkStroke[], w: number, h: number): void {
  context.clearRect(0, 0, w, h)
  context.lineCap = 'round'
  context.lineJoin = 'round'
  for (const stroke of strokes) {
    const p = stroke.points
    if (p.length < 2) continue
    const highlighter = stroke.tool === 'highlighter'
    context.globalAlpha = highlighter ? 0.42 : 1
    context.strokeStyle = INK_HEX[stroke.color]
    context.fillStyle = INK_HEX[stroke.color]
    const width = strokePixels(stroke, w)
    context.lineWidth = width
    if (p.length === 2) {
      context.beginPath()
      context.arc(p[0] * w, p[1] * h, width / 2, 0, Math.PI * 2)
      context.fill()
      continue
    }
    // Curvas por los puntos medios: el trazo sale suave aunque lleguen pocos puntos.
    context.beginPath()
    context.moveTo(p[0] * w, p[1] * h)
    for (let i = 2; i < p.length - 2; i += 2) {
      const mx = ((p[i] + p[i + 2]) / 2) * w
      const my = ((p[i + 1] + p[i + 3]) / 2) * h
      context.quadraticCurveTo(p[i] * w, p[i + 1] * h, mx, my)
    }
    context.lineTo(p[p.length - 2] * w, p[p.length - 1] * h)
    context.stroke()
  }
  context.globalAlpha = 1
}

/**
 * Los trazos que toca el borrador en (x, y), con un radio en proporción del
 * ancho; ``aspect``: ancho / alto de la diapositiva (para medir igual en los dos ejes).
 */
export function touched(strokes: InkStroke[], x: number, y: number, radius: number, aspect: number): string[] {
  const hit: string[] = []
  for (const stroke of strokes) {
    const p = stroke.points
    const reach = radius + strokeShare(stroke) / 2
    const near = (ax: number, ay: number, bx: number, by: number): boolean => {
      // La distancia al tramo de un punto al siguiente (en unidades del ancho de la diapositiva).
      const ex = bx - ax
      const ey = (by - ay) / aspect
      const rx = x - ax
      const ry = (y - ay) / aspect
      const len = ex * ex + ey * ey
      const t = len > 0 ? Math.max(0, Math.min(1, (rx * ex + ry * ey) / len)) : 0
      const dx = rx - t * ex
      const dy = ry - t * ey
      return dx * dx + dy * dy <= reach * reach
    }
    for (let i = 0; i < p.length; i += 2) {
      const last = i + 3 >= p.length
      if (last ? near(p[i], p[i + 1], p[i], p[i + 1]) : near(p[i], p[i + 1], p[i + 2], p[i + 3])) {
        hit.push(stroke.id)
        break
      }
    }
  }
  return hit
}

/** Lo que se ve de una diapositiva de ``aspect`` (ancho / alto) dentro de un hueco, centrada y entera. */
export function fitBox(width: number, height: number, aspect: number): { left: number; top: number; width: number; height: number } {
  if (!(width > 0 && height > 0 && aspect > 0)) return { left: 0, top: 0, width: 0, height: 0 }
  const w = width / height > aspect ? height * aspect : width
  const h = w / aspect
  return { left: (width - w) / 2, top: (height - h) / 2, width: w, height: h }
}
