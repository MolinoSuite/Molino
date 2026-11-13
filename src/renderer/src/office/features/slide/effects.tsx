import {
  Activity,
  AlignJustify,
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpFromLine,
  ArrowUpToLine,
  Blend,
  Circle,
  Columns2,
  Contrast,
  Diamond,
  Disc3,
  Droplet,
  Eye,
  EyeOff,
  FoldVertical,
  Heart,
  HeartPulse,
  Hexagon,
  Maximize2,
  Moon,
  MoveDown,
  MoveLeft,
  MoveRight,
  MoveUp,
  Octagon,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Rotate3d,
  RotateCcw,
  RotateCw,
  Sparkles,
  Square,
  Star,
  Sun,
  Waves,
  ZoomIn,
  ZoomOut
} from 'lucide-react'
import type { ReactNode } from 'react'
import { L } from '../../i18n'

/**
 * Las animaciones que ofrece Molino: las de PowerPoint más usadas, con el nombre
 * que les da la API de documentos del editor (el que devuelve GetEffectType y
 * entiende AddEffect) y lo que pide asc_AddAnimation (clase, efecto y variante;
 * la variante es la que el editor pone por defecto). Las clases son las del
 * editor (AscFormat.PRESET_CLASS_*) y los efectos y variantes, los de OOXML.
 */

export type EffectGroup = 'entrance' | 'emphasis' | 'exit' | 'path'
export type EffectKey = keyof typeof L.officeSlide.anim.names

export interface EffectSpec {
  key: EffectKey
  group: EffectGroup
  /** AscFormat.PRESET_CLASS_*: énfasis 0, entrada 1, salida 2, trayectoria 4. */
  presetClass: number
  presetId: number
  subtype: number
  icon: ReactNode
}

const CLASS: Record<EffectGroup, number> = { emphasis: 0, entrance: 1, exit: 2, path: 4 }
const I = 18

function fx(key: EffectKey, group: EffectGroup, presetId: number, subtype: number, icon: ReactNode): EffectSpec {
  return { key, group, presetClass: CLASS[group], presetId, subtype, icon }
}

export const EFFECTS: EffectSpec[] = [
  fx('entranceAppear', 'entrance', 1, 0, <Eye size={I} />),
  fx('entranceFade', 'entrance', 10, 0, <Blend size={I} />),
  fx('entranceFlyIn', 'entrance', 2, 4, <ArrowUp size={I} />),
  fx('entranceFloatIn', 'entrance', 42, 0, <ArrowUpFromLine size={I} />),
  fx('entranceSplit', 'entrance', 16, 21, <Columns2 size={I} />),
  fx('entranceWipe', 'entrance', 22, 4, <PanelLeftOpen size={I} />),
  fx('entranceZoom', 'entrance', 53, 16, <ZoomIn size={I} />),
  fx('entranceBounce', 'entrance', 26, 0, <ArrowDownToLine size={I} />),
  fx('entranceWheel', 'entrance', 21, 1, <Disc3 size={I} />),
  fx('entranceSwivel', 'entrance', 45, 0, <Rotate3d size={I} />),
  fx('entranceGrowAndTurn', 'entrance', 31, 0, <RotateCw size={I} />),
  fx('entranceRandomBars', 'entrance', 14, 10, <AlignJustify size={I} />),
  fx('emphasisPulse', 'emphasis', 26, 0, <HeartPulse size={I} />),
  fx('emphasisTeeter', 'emphasis', 32, 0, <Activity size={I} />),
  fx('emphasisSpin', 'emphasis', 8, 0, <RefreshCw size={I} />),
  fx('emphasisGrowShrink', 'emphasis', 6, 0, <Maximize2 size={I} />),
  fx('emphasisTransparency', 'emphasis', 9, 0, <Contrast size={I} />),
  fx('emphasisDesaturate', 'emphasis', 25, 0, <Droplet size={I} />),
  fx('emphasisDarken', 'emphasis', 24, 0, <Moon size={I} />),
  fx('emphasisLighten', 'emphasis', 30, 0, <Sun size={I} />),
  fx('emphasisBlink', 'emphasis', 35, 0, <EyeOff size={I} />),
  fx('emphasisWave', 'emphasis', 34, 0, <Waves size={I} />),
  fx('emphasisShimmer', 'emphasis', 36, 0, <Sparkles size={I} />),
  fx('exitDisappear', 'exit', 1, 0, <EyeOff size={I} />),
  fx('exitFadeOut', 'exit', 10, 0, <Blend size={I} />),
  fx('exitFlyOut', 'exit', 2, 4, <ArrowDown size={I} />),
  fx('exitFloatOut', 'exit', 42, 0, <MoveDown size={I} />),
  fx('exitSplitOut', 'exit', 16, 21, <Columns2 size={I} />),
  fx('exitWipeOut', 'exit', 22, 4, <PanelLeftClose size={I} />),
  fx('exitZoomOut', 'exit', 53, 32, <ZoomOut size={I} />),
  fx('exitBounceOut', 'exit', 26, 0, <ArrowUpToLine size={I} />),
  fx('exitWheelOut', 'exit', 21, 1, <Disc3 size={I} />),
  fx('exitSwivelOut', 'exit', 45, 0, <Rotate3d size={I} />),
  fx('exitShrinkAndTurn', 'exit', 31, 0, <RotateCcw size={I} />),
  fx('exitCollapse', 'exit', 17, 10, <FoldVertical size={I} />),
  fx('pathDown', 'path', 42, 0, <MoveDown size={I} />),
  fx('pathUp', 'path', 64, 0, <MoveUp size={I} />),
  fx('pathLeft', 'path', 35, 0, <MoveLeft size={I} />),
  fx('pathRight', 'path', 63, 0, <MoveRight size={I} />),
  fx('pathCircle', 'path', 1, 0, <Circle size={I} />),
  fx('pathSquare', 'path', 7, 0, <Square size={I} />),
  fx('pathDiamond', 'path', 3, 0, <Diamond size={I} />),
  fx('pathHeart', 'path', 9, 0, <Heart size={I} />),
  fx('pathStar', 'path', 5, 0, <Star size={I} />),
  fx('pathHexagon', 'path', 4, 0, <Hexagon size={I} />),
  fx('pathOctagon', 'path', 10, 0, <Octagon size={I} />)
]

export const EFFECT_BY_KEY = new Map<string, EffectSpec>(EFFECTS.map((e) => [e.key, e]))
export const GROUPS: EffectGroup[] = ['entrance', 'emphasis', 'exit', 'path']
export const TRIGGERS = ['onclick', 'withprevious', 'afterprevious'] as const
export type Trigger = (typeof TRIGGERS)[number]

/** El grupo de un efecto por su nombre de la API (entranceFade → entrance). */
export function groupOf(type: string): EffectGroup | null {
  const found = GROUPS.find((g) => type.startsWith(g))
  return found ?? null
}

/** El nombre de un efecto para la interfaz (o «Otro efecto»). */
export function effectName(type: string): string {
  const names = L.officeSlide.anim.names as Record<string, string>
  return names[type] ?? L.officeSlide.anim.other
}

/** La miniatura de un efecto en la galería: su dibujo, del color de su grupo (como las estrellas de PowerPoint). */
export function EffectGlyph({ effect }: { effect: EffectSpec }) {
  return <span className={`slide-fx slide-fx-${effect.group}`}>{effect.icon}</span>
}
