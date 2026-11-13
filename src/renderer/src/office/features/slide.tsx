import {
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignStartHorizontal,
  AlignVerticalJustifyCenter,
  ArrowLeftRight,
  ArrowUpDown,
  Copy,
  Crop,
  Expand,
  Eye,
  FilePlus2,
  Grid2x2,
  Grid3x3,
  Heading,
  ImageUp,
  LayoutTemplate,
  ListIndentDecrease,
  ListIndentIncrease,
  Magnet,
  Maximize,
  Minimize2,
  Network,
  Palette,
  PanelBottom,
  PanelsTopLeft,
  PencilLine,
  Play,
  Presentation,
  RotateCcw,
  RotateCw,
  Rows3,
  Ruler,
  SeparatorHorizontal,
  SeparatorVertical,
  Shrink,
  Sparkle,
  Sparkles,
  Square,
  StickyNote,
  Timer,
  Trash2,
  TypeOutline,
  UnfoldVertical,
  WandSparkles,
  X
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { MenuEntry } from '@/components/ui'
import type { EditorState } from '../engine'
import type { MenuOption, Mode, Tool } from '../apps'
import { L } from '../i18n'
import { ParagraphGlyph, SpacingGlyph } from '../ui/glyphs'
import { AnimationPanel } from './slide/AnimationPanel'
import { EFFECT_BY_KEY, EFFECTS, EffectGlyph, GROUPS, TRIGGERS } from './slide/effects'
import { RehearsePanel } from './slide/RehearsePanel'
import { SmartArtDialog, smartArtPreviews } from './slide/SmartArtDialog'
import type { Api, Feature, FeatureContext } from './types'
import './slide/slide.css'

/**
 * Funciones de Presentaciones (además de las de siempre): sangría, interlineado
 * y alineación vertical del texto; recortar y cambiar imágenes; el panel de
 * animación y su galería; el ensayo con notas; guías, cuadrícula y patrón de
 * diapositivas (pestaña «Vista»); combinaciones de colores, WordArt y SmartArt.
 * Ver types.ts.
 */

/** La API de documentos del editor: solo existe dentro de las funciones de ctx.builder. */
declare const Api: Api

const S = L.officeSlide
const ST = S.tools
const O = L.office.options
const ICON = 16

// ------------------------------------------------------------ herramientas

type Button = Extract<Tool, { type: 'button' }>
type MenuTool = Extract<Tool, { type: 'menu' }>
const B = (key: string, command: string, extra: Partial<Button> = {}): Tool => ({ type: 'button', key, command, ...extra })
const MENU = (key: string, command: string, options: MenuTool['options'], icon: ReactNode, extra: Partial<MenuTool> = {}): Tool => ({ type: 'menu', key, command, options, icon, ...extra })
const flag = (key: string) => (s: EditorState) => Boolean(s.extra[key])

// Inicio: sangría, interlineado y espacio entre párrafos (los mismos dibujos que en Documentos).
const PARA_GAPS: Record<string, [number, number]> = { none: [0, 0], compact: [0, 2], normal: [0, 4], open: [2, 6], wide: [4, 8] }
const SPACING: Tool[] = [
  B('indentLess', 'indentLess', { icon: <ListIndentDecrease size={ICON} /> }),
  B('indentMore', 'indentMore', { icon: <ListIndentIncrease size={ICON} /> }),
  MENU(
    'lineSpacing',
    'lineSpacing',
    Object.entries(O.lineSpacing).map(([value, label]) => ({ value, label, icon: <SpacingGlyph gap={3 + Number(value) * 2.5} /> })),
    <ArrowUpDown size={ICON} />,
    { current: (s) => String(s.extra.lineSpacing ?? '') }
  ),
  MENU(
    'paraSpacing',
    'paraSpacing',
    Object.entries(O.paraSpacing).map(([value, label]) => ({ value, label, icon: <ParagraphGlyph before={PARA_GAPS[value]?.[0] ?? 0} after={PARA_GAPS[value]?.[1] ?? 0} /> })),
    <UnfoldVertical size={ICON} />
  )
]

// El texto dentro de su forma: arriba, en medio o abajo, y en horizontal o girado.
const TEXT_BOX: Tool[] = [
  MENU(
    'valignMenu',
    'textValign',
    [
      { value: 'top', label: O.valign.top, preview: <AlignStartHorizontal size={20} /> },
      { value: 'center', label: O.valign.center, preview: <AlignCenterVertical size={20} /> },
      { value: 'bottom', label: O.valign.bottom, preview: <AlignEndHorizontal size={20} /> }
    ],
    <AlignVerticalJustifyCenter size={ICON} />,
    { tiles: 3, current: (s) => String(s.extra.textValign ?? '') }
  ),
  MENU(
    'textDirection',
    'textDirection',
    [
      { value: 'normal', label: S.options.textDirection.normal, icon: <span className="glyph-text">ab</span> },
      { value: 'vert', label: S.options.textDirection.vert, icon: <span className="glyph-text vertical">ab</span> },
      { value: 'vert270', label: S.options.textDirection.vert270, icon: <span className="glyph-text vertical slide-vert270">ab</span> }
    ],
    <TypeOutline size={ICON} />,
    { label: ST.textDirection, current: (s) => String(s.extra.textVert ?? '') }
  )
]

// Imagen seleccionada: recortar, tamaño, cambiarla y girarla.
const IMAGE_CROP: Tool[] = [
  B('crop', 'crop', { icon: <Crop size={ICON} />, caption: true, active: flag('cropping') }),
  B('cropFill', 'cropFill', { label: ST.cropFill, icon: <Maximize size={ICON} /> }),
  B('cropFit', 'cropFit', { label: ST.cropFit, icon: <Minimize2 size={ICON} /> })
]
const IMAGE_SIZE: Tool[] = [
  B('originalSize', 'originalSize', { icon: <Expand size={ICON} />, caption: true }),
  B('fitSlide', 'fitSlide', { label: ST.fitSlide, icon: <Shrink size={ICON} /> })
]
const IMAGE_PICTURE: Tool[] = [
  B('replaceImage', 'replaceImage', { label: ST.replaceImage, icon: <ImageUp size={ICON} />, caption: true }),
  MENU(
    'rotate',
    'rotate',
    [
      { value: 'left', label: S.options.rotate.left, icon: <RotateCcw size={15} /> },
      { value: 'right', label: S.options.rotate.right, icon: <RotateCw size={15} /> },
      { value: 'flipH', label: S.options.rotate.flipH, icon: <ArrowLeftRight size={15} /> },
      { value: 'flipV', label: S.options.rotate.flipV, icon: <ArrowUpDown size={15} /> }
    ],
    <RotateCw size={ICON} />,
    { label: ST.rotate }
  )
]

// Insertar: WordArt (las vistas previas del editor, con los colores del tema) y SmartArt.
const WORDART = MENU(
  'wordArt',
  'wordArt',
  (s) => ((s.extra.textArt as string[] | undefined) ?? []).map((image, i) => ({ value: String(i), label: `${ST.wordArt} ${i + 1}`, preview: <img className="slide-wordart" src={image} alt="" /> })),
  <WandSparkles size={ICON} />,
  { label: ST.wordArt, caption: true, tiles: 4 }
)
const SMARTART = B('smartArt', 'dialog', { label: ST.smartArt, value: 'smartArt', icon: <Network size={ICON} />, caption: true })

// Diseño: las combinaciones de colores del tema.
interface Scheme {
  index: number
  name: string
  colors: string[]
}
const COLOR_SCHEMES = MENU(
  'colorScheme',
  'colorScheme',
  (s) =>
    ((s.extra.colorSchemes as Scheme[] | undefined) ?? []).map((scheme) => ({
      value: String(scheme.index),
      label: scheme.name,
      icon: (
        <span className="slide-scheme" aria-hidden="true">
          {scheme.colors.map((c, i) => (
            <i key={i} style={{ background: c }} />
          ))}
        </span>
      )
    })),
  <Palette size={ICON} />,
  { label: ST.colorScheme, caption: true, current: (s) => String(s.extra.colorScheme ?? '') }
)

// Efectos: la galería de animaciones (se añaden a lo seleccionado), el panel y verlas.
const ADD_ANIMATION = MENU(
  'addAnimation',
  'animAdd',
  GROUPS.flatMap((group): MenuOption[] => [
    { value: '', label: S.anim[group], heading: true },
    ...EFFECTS.filter((e) => e.group === group).map((e) => ({ value: e.key, label: S.anim.names[e.key], preview: <EffectGlyph effect={e} /> }))
  ]),
  <Sparkles size={ICON} />,
  { label: ST.addAnimation, caption: true, tiles: 6 }
)
const ANIMATIONS: Tool[] = [
  ADD_ANIMATION,
  B('animPanel', 'panel', { label: ST.animPanel, value: 'animations', icon: <PanelsTopLeft size={ICON} />, caption: true }),
  B('animPreview', 'animPreview', { label: ST.animPreview, icon: <Play size={ICON} />, active: flag('animPlaying') })
]

// Vista: guías, cuadrícula, notas y el patrón de las diapositivas.
const GRID_SPACING = MENU(
  'gridSpacing',
  'gridSpacing',
  [
    ...Object.entries(S.options.gridSpacing).map(([value, label]) => ({ value, label, icon: <Grid3x3 size={15} /> })),
    { value: '', label: S.options.gridSpacingCustom, command: 'gridSpacingAsk', action: true, icon: <Ruler size={15} /> }
  ],
  <Grid3x3 size={ICON} />,
  { label: ST.gridSpacing, current: (s) => String(s.extra.gridCm ?? '') }
)
/**
 * Editar el patrón: lo que se puede hacer en la vista del patrón (patrones y
 * diseños nuevos, duplicar, eliminar, el nombre, el título y los pies) y salir;
 * fuera de ella, solo entrar.
 */
const MASTER_MENU = MENU(
  'masterMenu',
  'master',
  (s): MenuOption[] =>
    s.extra.master
      ? [
          { value: '', label: ST.newMaster, command: 'newMaster', icon: <FilePlus2 size={15} /> },
          { value: '', label: ST.newLayout, command: 'newLayout', icon: <Presentation size={15} /> },
          { value: '', label: ST.duplicate, command: 'masterDuplicate', icon: <Copy size={15} /> },
          ...(s.extra.masterCanDelete ? [{ value: '', label: ST.remove, command: 'masterDelete', icon: <Trash2 size={15} /> }] : []),
          { value: '', label: ST.rename, command: 'masterRenameAsk', icon: <PencilLine size={15} /> },
          { value: '', label: s.extra.masterTitle ? ST.hideTitle : ST.showTitle, command: 'masterTitle', icon: <Heading size={15} /> },
          { value: '', label: s.extra.masterFooters ? ST.hideFooters : ST.showFooters, command: 'masterFooters', icon: <PanelBottom size={15} /> },
          { value: '', label: ST.closeMaster, command: 'closeMaster', action: true, icon: <X size={15} /> }
        ]
      : [{ value: '', label: ST.openMaster, command: 'master', icon: <LayoutTemplate size={15} /> }],
  <PencilLine size={ICON} />,
  { label: ST.masterEdit }
)
const VIEW_MODE: Mode = {
  id: 'view',
  label: S.modes.view,
  icon: <Eye size={19} />,
  names: [S.groups.guides, S.groups.grid, S.groups.show, S.groups.master],
  groups: [
    [
      B('guides', 'guides', { label: ST.guides, icon: <Rows3 size={ICON} />, caption: true, active: flag('guides') }),
      B('guideV', 'guideV', { label: ST.guideV, icon: <SeparatorVertical size={ICON} /> }),
      B('guideH', 'guideH', { label: ST.guideH, icon: <SeparatorHorizontal size={ICON} /> }),
      B('clearGuides', 'clearGuides', { label: ST.clearGuides, icon: <X size={ICON} /> }),
      B('smartGuides', 'smartGuides', { label: ST.smartGuides, icon: <Sparkle size={ICON} />, active: flag('smartGuides') })
    ],
    [
      B('gridlines', 'gridlines', { label: ST.gridlines, icon: <Grid2x2 size={ICON} />, caption: true, active: flag('gridlines') }),
      B('snap', 'snap', { label: ST.snap, icon: <Magnet size={ICON} />, active: flag('snap') }),
      GRID_SPACING
    ],
    [B('notes', 'notes', { label: ST.notes, icon: <StickyNote size={ICON} />, caption: true, active: (s) => s.notes }), B('fit', 'fit', { label: ST.fit, icon: <Square size={ICON} /> })],
    [B('master', 'master', { label: ST.master, icon: <LayoutTemplate size={ICON} />, caption: true, active: flag('master') }), MASTER_MENU]
  ]
}

// ------------------------------------------------------------------ órdenes

/** c_paragraphLinerule.LINERULE_AUTO: interlineado en veces la línea. */
const LINERULE_AUTO = 1
/** Espacio entre párrafos: puntos antes y después (los de Documentos). */
const PARA_SPACING: Record<string, [number, number]> = { none: [0, 0], compact: [0, 4], normal: [0, 8], open: [6, 12], wide: [12, 18] }
const LINE_SPACINGS = Object.keys(O.lineSpacing).map(Number)
/** Un centímetro en las unidades de la cuadrícula del editor (EMU). */
const EMU_CM = 360_000

/** Un número entero de un texto, entre sus límites; null si no lo es. */
function int(value: string | undefined, min: number, max: number): number | null {
  const n = Number(value)
  return Number.isInteger(n) && n >= min && n <= max ? n : null
}

/** Lo que la vista enseña ahora (guías, cuadrícula…): el editor no avisa al cambiarlo. */
function readView(ctx: FeatureContext): void {
  const { api, state } = ctx
  try {
    state.extra.guides = Boolean(api.asc_getShowGuides())
    state.extra.smartGuides = Boolean(api.asc_getShowSmartGuides())
    state.extra.gridlines = Boolean(api.asc_getShowGridlines())
    state.extra.snap = Boolean(api.asc_getSnapToGrid())
    const cm = Number(api.asc_getGridSpacing()) / EMU_CM
    state.extra.gridCm = Object.keys(S.options.gridSpacing).find((k) => Math.abs(Number(k) - cm) < 0.01) ?? ''
    state.extra.master = Boolean(api.asc_IsMasterSlideMode?.())
  } catch {
    /* el editor aún no está listo */
  }
  ctx.changed()
}

/** El patrón o el diseño seleccionado en la vista del patrón (sus propiedades de diapositiva). */
function masterSelection(api: Api, ew: Api): { master: boolean; name: string } | null {
  try {
    for (const el of api.getSelectedElements() || []) {
      if (el.get_ObjectType() !== ew.Asc.c_oAscTypeSelectElement.Slide) continue
      const value = el.get_ObjectValue()
      const master = Boolean(value.get_IsMasterSelected?.())
      return { master, name: String((master ? value.get_MasterName?.() : value.get_LayoutName?.()) ?? '') }
    }
  } catch {
    /* sin selección */
  }
  return null
}

/**
 * Cambiar un efecto de la diapositiva actual con la API de documentos (un solo
 * paso para deshacer): sus tiempos, su orden, quitarlo o cambiarlo por otro
 * (el nuevo, en su sitio, con el mismo inicio y retraso).
 */
function editEffect(ctx: FeatureContext, op: Record<string, unknown>): void {
  ctx.builder(function (scope) {
    const m = scope.molino
    const slide = Api.GetPresentation().GetCurrentSlide()
    if (!slide) return
    const sequence = slide.GetTimeLine().GetMainSequence()
    const count = sequence.GetCount()
    if (typeof m.i !== 'number' || m.i < 0 || m.i >= count) return
    const effect = sequence.GetEffect(m.i)
    if (!effect) return
    if (m.op === 'set') {
      if (typeof m.duration === 'number') effect.SetDuration(m.duration)
      if (typeof m.delay === 'number') effect.SetDelay(m.delay)
      if (typeof m.trigger === 'string') effect.SetTriggerType(m.trigger)
      if (typeof m.repeat === 'number') effect.SetRepeatCount(m.repeat)
    } else if (m.op === 'move') {
      const to = m.i + m.by
      if (to >= 0 && to < count) effect.MoveTo(to)
    } else if (m.op === 'remove') {
      effect.Delete()
    } else if (m.op === 'change') {
      const shape = effect.GetShape()
      if (!shape) return
      const trigger = effect.GetTriggerType()
      const delay = effect.GetDelay()
      const added = sequence.AddEffect(shape, m.type, trigger)
      if (!added) return
      added.SetDelay(delay)
      added.MoveTo(m.i)
      const old = sequence.GetEffect(m.i + 1)
      if (old) old.Delete()
    }
  }, ctx.local(op))
}

function slideCommands(ctx: FeatureContext): Record<string, (value?: string) => void> {
  const { api, ew } = ctx
  const extra = ctx.state.extra
  const shapeApply = (set: (props: Api) => void): void => {
    const props = new ew.Asc.asc_CShapeProperty()
    set(props)
    api.ShapeApply(props)
  }
  const viewToggle = (key: string, apply: (on: boolean) => void): (() => void) => () => {
    apply(!extra[key])
    readView(ctx)
  }
  return {
    // 1. Texto: sangría, interlineado, espacio entre párrafos y borrar el formato.
    indentLess: () => api.DecreaseIndent(),
    indentMore: () => api.IncreaseIndent(),
    lineSpacing: (v) => {
      const n = Number(v)
      if (LINE_SPACINGS.includes(n)) api.put_PrLineSpacing(LINERULE_AUTO, n)
    },
    paraSpacing: (v) => {
      const spacing = PARA_SPACING[v ?? '']
      if (!spacing) return
      api.put_LineSpacingBeforeAfter(0, (spacing[0] * 25.4) / 72)
      api.put_LineSpacingBeforeAfter(1, (spacing[1] * 25.4) / 72)
    },
    clearFormat: () => api.ClearFormating(),
    // 3. El texto en su forma: alineación vertical y dirección.
    textValign: (v) => {
      const V = ew.Asc.c_oAscVAlign
      const value = { top: V.Top, center: V.Center, bottom: V.Bottom }[v as 'top' | 'center' | 'bottom']
      if (value !== undefined) shapeApply((p) => p.put_VerticalTextAlign(value))
    },
    textDirection: (v) => {
      const D = ew.Asc.c_oAscVertDrawingText
      const value = { normal: D.normal, vert: D.vert, vert270: D.vert270 }[v as 'normal' | 'vert' | 'vert270']
      if (value !== undefined) shapeApply((p) => p.put_Vert(value))
    },
    // 2. Imagen: recortar (y rellenar o ajustar el recorte), tamaño original, cambiarla, girarla.
    // Recortar: el botón sigue pulsado mientras se recorta (el editor también avisa al acabar).
    crop: () => {
      if (extra.cropping) {
        api.asc_endEditCrop()
        extra.cropping = false
      } else if (api.asc_canEditCrop()) {
        api.asc_startEditCrop()
        extra.cropping = true
      }
      ctx.changed()
    },
    cropFill: () => api.asc_cropFill(),
    cropFit: () => api.asc_cropFit(),
    originalSize: () => {
      const size = api.asc_getCropOriginalImageSize()
      if (!size) return
      const props = new ew.Asc.asc_CImgProperty()
      props.put_Width(size.get_ImageWidth())
      props.put_Height(size.get_ImageHeight())
      props.put_Rot(0)
      api.ImgApply(props)
    },
    fitSlide: () => api.asc_FitImagesToSlide(),
    // El editor pide la imagen nueva con su cuadro de abrir (el de Molino, por bridge.js).
    replaceImage: () => api.ChangeImageFromFile(),
    rotate: (v) => {
      if (v === 'left' || v === 'right') shapeApply((p) => p.asc_putRotAdd(((v === 'right' ? 90 : 270) * Math.PI) / 180))
      else if (v === 'flipH') shapeApply((p) => p.asc_putFlipHInvert(true))
      else if (v === 'flipV') shapeApply((p) => p.asc_putFlipVInvert(true))
    },
    // 8. WordArt y SmartArt.
    wordArt: (v) => {
      const n = int(v, 0, ((extra.textArt as string[] | undefined)?.length ?? 0) - 1)
      if (n !== null) api.AddTextArt(n)
    },
    smartArt: (v) => {
      const n = int(v, 0, 9999)
      if (n !== null) api.asc_createSmartArt(n)
    },
    // 7. Combinación de colores del tema.
    colorScheme: (v) => {
      const schemes = (extra.colorSchemes as Scheme[] | undefined) ?? []
      const n = int(v, 0, 999)
      if (n === null || !schemes.some((s) => s.index === n)) return
      api.asc_ChangeColorSchemeByIdx(n)
      extra.colorScheme = n
      ctx.changed()
    },
    // 4. Animaciones: añadir a lo seleccionado, cambiarlas en el panel y verlas.
    animAdd: (key) => {
      const effect = EFFECT_BY_KEY.get(key ?? '')
      if (effect) api.asc_AddAnimation(effect.presetClass, effect.presetId, effect.subtype, null, false, true)
    },
    animSet: (json) => {
      let raw: Record<string, unknown>
      try {
        raw = JSON.parse(json ?? '')
      } catch {
        return
      }
      const i = int(String(raw.i), 0, 499)
      if (i === null) return
      const op: Record<string, unknown> = { op: 'set', i }
      if (typeof raw.duration === 'number' && raw.duration >= 10 && raw.duration <= 600_000) op.duration = Math.round(raw.duration)
      if (typeof raw.delay === 'number' && raw.delay >= 0 && raw.delay <= 600_000) op.delay = Math.round(raw.delay)
      if (typeof raw.repeat === 'number' && Number.isInteger(raw.repeat) && raw.repeat >= 1 && raw.repeat <= 999) op.repeat = raw.repeat
      if (typeof raw.trigger === 'string' && (TRIGGERS as readonly string[]).includes(raw.trigger)) op.trigger = raw.trigger
      if (Object.keys(op).length > 2) editEffect(ctx, op)
    },
    animMove: (v) => {
      const [i, by] = String(v ?? '').split(':').map(Number)
      if (int(String(i), 0, 499) !== null && (by === 1 || by === -1)) editEffect(ctx, { op: 'move', i, by })
    },
    animRemove: (v) => {
      const i = int(v, 0, 499)
      if (i !== null) editEffect(ctx, { op: 'remove', i })
    },
    animChange: (v) => {
      const [i, key] = String(v ?? '').split(':')
      if (int(i, 0, 499) !== null && EFFECT_BY_KEY.has(key)) editEffect(ctx, { op: 'change', i: Number(i), type: key })
    },
    animPreview: () => {
      if (extra.animPlaying) api.asc_StopAnimationPreview()
      else if (api.asc_canStartAnimationPreview()) api.asc_StartAnimationPreview()
    },
    // 6. Guías, cuadrícula y su espaciado.
    guides: viewToggle('guides', (on) => api.asc_setShowGuides(on)),
    guideV: () => {
      api.asc_addVerticalGuide()
      if (!extra.guides) api.asc_setShowGuides(true)
      readView(ctx)
    },
    guideH: () => {
      api.asc_addHorizontalGuide()
      if (!extra.guides) api.asc_setShowGuides(true)
      readView(ctx)
    },
    clearGuides: () => {
      if (api.asc_canClearGuides()) api.asc_clearGuides()
      readView(ctx)
    },
    smartGuides: viewToggle('smartGuides', (on) => api.asc_setShowSmartGuides(on)),
    gridlines: viewToggle('gridlines', (on) => api.asc_setShowGridlines(on)),
    snap: viewToggle('snap', (on) => api.asc_setSnapToGrid(on)),
    gridSpacing: (v) => {
      const cm = Number(v)
      if (!(Number.isFinite(cm) && cm >= 0.1 && cm <= 10)) return
      api.asc_setGridSpacing(Math.round(cm * EMU_CM))
      if (!extra.gridlines) api.asc_setShowGridlines(true)
      readView(ctx)
    },
    // 9. Patrón de diapositivas: entrar y salir, patrones y diseños nuevos, duplicar, eliminar, nombre, título y pies.
    master: () => {
      const M = ew.Asc.c_oAscPresentationViewMode
      api.asc_changePresentationViewMode(api.asc_IsMasterSlideMode() ? M.normal : M.masterSlide)
    },
    closeMaster: () => {
      if (api.asc_IsMasterSlideMode()) api.asc_changePresentationViewMode(ew.Asc.c_oAscPresentationViewMode.normal)
    },
    newMaster: () => api.asc_IsMasterSlideMode() && api.asc_AddMasterSlide(),
    newLayout: () => api.asc_IsMasterSlideMode() && api.asc_AddSlideLayout(),
    masterDuplicate: () => {
      if (!api.asc_IsMasterSlideMode()) return
      if (masterSelection(api, ew)?.master) api.asc_DuplicateMaster()
      else api.asc_DuplicateLayout()
    },
    masterDelete: () => {
      if (!api.asc_IsMasterSlideMode()) return
      if (masterSelection(api, ew)?.master) api.asc_CanDeleteMaster() && api.asc_DeleteMaster()
      else api.asc_CanDeleteLayout() && api.asc_DeleteLayout()
    },
    masterRename: (name) => {
      const clean = (name ?? '').trim().slice(0, 254)
      if (!clean || !api.asc_IsMasterSlideMode()) return
      if (masterSelection(api, ew)?.master) api.asc_SetMasterName(clean)
      else api.asc_SetLayoutName(clean)
    },
    masterTitle: () => api.asc_IsMasterSlideMode() && api.asc_setTitle(!extra.masterTitle),
    masterFooters: () => api.asc_IsMasterSlideMode() && api.asc_setFooter(!extra.masterFooters)
  }
}

// ------------------------------------------------------------------ avisos

const hexOf = (c: Api): string => `#${[c.get_r(), c.get_g(), c.get_b()].map((x: number) => Number(x).toString(16).padStart(2, '0')).join('')}`

function slideListen(ctx: FeatureContext, on: (name: string, fn: (...args: Api[]) => void) => void): void {
  const { api, ew } = ctx
  const extra = ctx.state.extra
  // El interlineado (si es uno de los del menú) y el texto en su forma.
  on('asc_onLineSpacing', (spacing: Api) => {
    const line = spacing?.get_Line?.()
    const auto = spacing?.get_LineRule?.() === LINERULE_AUTO
    extra.lineSpacing = auto ? (LINE_SPACINGS.find((n) => Math.abs(n - Number(line)) < 0.001)?.toString() ?? '') : ''
  })
  on('asc_onVerticalTextAlign', (v: Api) => {
    const V = ew.Asc.c_oAscVAlign
    extra.textValign = v === V.Top ? 'top' : v === V.Center ? 'center' : v === V.Bottom ? 'bottom' : ''
  })
  on('asc_onVert', (v: Api) => {
    const D = ew.Asc.c_oAscVertDrawingText
    extra.textVert = v === D.normal ? 'normal' : v === D.vert ? 'vert' : v === D.vert270 ? 'vert270' : ''
  })
  // Recortando una imagen (también se acaba al hacer clic fuera).
  on('asc_ChangeCropState', (state: Api) => (extra.cropping = Boolean(state)))
  on('asc_onFocusObject', (list: Api[]) => {
    const T = ew.Asc.c_oAscTypeSelectElement
    if (!(list || []).some((el) => el.get_ObjectType() === T.Image)) extra.cropping = false
    if (extra.master) extra.masterCanDelete = masterSelection(api, ew)?.master ? Boolean(api.asc_CanDeleteMaster()) : Boolean(api.asc_CanDeleteLayout())
  })
  // Las combinaciones de colores del tema (llegan al abrir y al cambiar de tema).
  on('asc_onSendThemeColorSchemes', (schemes: Api[]) => {
    const list: Scheme[] = []
    ;(schemes || []).forEach((scheme, index) => {
      try {
        const colors: Api[] = scheme.get_colors()
        list.push({ index, name: String(scheme.get_name() ?? '').slice(0, 80) || String(index + 1), colors: [2, 3, 4, 5, 6].map((j) => hexOf(colors[j])) })
      } catch {
        /* una combinación sin colores */
      }
    })
    extra.colorSchemes = list.slice(0, 200)
    extra.colorScheme = api.asc_GetCurrentColorSchemeIndex()
  })
  // WordArt: sus vistas previas usan los colores del tema.
  const readTextArt = (): void => {
    try {
      const previews: unknown[] = api.asc_getTextArtPreviews() || []
      extra.textArt = previews.filter((p): p is string => typeof p === 'string' && /^data:image\//.test(p)).slice(0, 60)
    } catch {
      /* sin vistas previas */
    }
  }
  on('asc_onSendThemeColors', () => {
    readTextArt()
    extra.colorScheme = api.asc_GetCurrentColorSchemeIndex?.()
  })
  // Animaciones: si se están viendo.
  on('asc_onAnimPreviewStarted', () => (extra.animPlaying = true))
  on('asc_onAnimPreviewFinished', () => (extra.animPlaying = false))
  // Patrón de diapositivas: si se está editando y si sus diseños llevan título y pies.
  on('asc_onChangeViewMode', (mode: Api) => {
    extra.master = mode === ew.Asc.c_oAscPresentationViewMode.masterSlide
    if (!extra.master) extra.masterCanDelete = false
  })
  on('asc_onTitle', (v: Api) => (extra.masterTitle = Boolean(v)))
  on('asc_onFooter', (v: Api) => (extra.masterFooters = Boolean(v)))
  // SmartArt: las vistas previas de un grupo (ver SmartArtDialog.tsx).
  on('asc_onAddSmartArtPreview', (previews: Api[]) => {
    const found = { ...((extra.smartArt as Record<string, string> | undefined) ?? {}) }
    for (const preview of previews || []) {
      try {
        const image = preview.asc_getImage()
        const type = String(image.asc_getName())
        const data = String(image.asc_getImage())
        if (/^\d{1,4}$/.test(type) && /^data:image\//.test(data)) found[type] = data
      } catch {
        /* una vista previa sin imagen */
      }
    }
    extra.smartArt = found
  })
  on('asc_onEndSmartArtPreview', () => {
    if (typeof extra.smartArtBusy === 'number') extra.smartArtDone = [...((extra.smartArtDone as number[] | undefined) ?? []), extra.smartArtBusy]
    extra.smartArtBusy = undefined
    const next = extra.smartArtNext
    extra.smartArtNext = undefined
    if (typeof next === 'number') smartArtPreviews(ctx, next)
  })
  // Al abrir: lo que enseña la vista y las vistas previas de WordArt.
  let ready = false
  const start = (): void => {
    if (ready || !ctx.api) return
    ready = true
    readView(ctx)
    readTextArt()
    try {
      extra.colorScheme = api.asc_GetCurrentColorSchemeIndex()
    } catch {
      /* sin tema */
    }
    ctx.changed()
  }
  on('asc_onDocumentContentReady', start)
  setTimeout(start, 1500)
}

// ------------------------------------------------------------------ la función

export const slideFeature: Feature = {
  commands: (ctx) => slideCommands(ctx),
  listen: (ctx, on) => slideListen(ctx, on),
  tools: {
    home: { at: 4, groups: [SPACING, TEXT_BOX], names: [S.groups.spacing, S.groups.textBox] },
    insert: { at: 1, groups: [[WORDART, SMARTART]], names: [S.groups.art] },
    design: { at: 1, groups: [[COLOR_SCHEMES]], names: [S.groups.colors] },
    // Las animaciones, antes de la galería de siempre (que cambia la de lo seleccionado).
    transitions: { at: 2, groups: [ANIMATIONS], names: [S.groups.animations] },
    present: { groups: [[B('rehearse', 'panel', { label: ST.rehearse, value: 'rehearse', icon: <Timer size={ICON} />, caption: true })]], names: [S.groups.rehearse] },
    shape: { groups: [TEXT_BOX], names: [S.groups.textBox] },
    image: { at: 0, groups: [IMAGE_CROP, IMAGE_SIZE, IMAGE_PICTURE], names: [S.groups.crop, S.groups.size, S.groups.picture] }
  },
  modes: [VIEW_MODE],
  ask: (command, _value, session, run) => {
    if (command === 'gridSpacingAsk') {
      return {
        title: S.asks.gridSpacing,
        fields: [{ key: 'cm', label: S.asks.gridSpacingField, value: '0.5', type: 'number', min: 0.1, max: 10, step: 0.05 }],
        onOk: (values) => void run('gridSpacing', values.cm)
      }
    }
    if (command === 'masterRenameAsk') {
      const { api, ew } = session.featureContext()
      if (!api?.asc_IsMasterSlideMode?.()) return null
      const current = masterSelection(api, ew)
      return {
        title: S.asks.rename,
        fields: [{ key: 'name', label: S.asks.renameField, value: current?.name ?? '', maxLength: 254 }],
        onOk: (values) => void run('masterRename', values.name)
      }
    }
    return null
  },
  context: (state, _session, run) => {
    const entries: MenuEntry[] = []
    if (state.objects.includes('image')) {
      entries.push(
        { label: S.context.replaceImage, icon: <ImageUp size={15} />, onSelect: () => void run('replaceImage') },
        { label: S.context.originalSize, icon: <Expand size={15} />, onSelect: () => void run('originalSize') },
        { label: S.context.crop, icon: <Crop size={15} />, onSelect: () => void run('crop') }
      )
    }
    if (state.objects.some((o) => o === 'image' || o === 'shape' || o === 'chart')) {
      entries.push({ label: S.context.animPanel, icon: <Sparkles size={15} />, onSelect: () => void run('panel', 'animations') })
    }
    return entries
  },
  panels: {
    animations: { title: S.groups.animations, render: (props) => <AnimationPanel {...props} /> },
    rehearse: { title: S.rehearse.title, render: (props) => <RehearsePanel {...props} /> }
  },
  dialogs: {
    smartArt: (props) => <SmartArtDialog {...props} />
  },
  palette: [
    { label: ST.animPanel, group: L.office.modes.transitions, keywords: S.keywords.animPanel, command: 'panel', value: 'animations' },
    { label: ST.rehearse, group: L.office.modes.present, keywords: S.keywords.rehearse, command: 'panel', value: 'rehearse' },
    { label: ST.smartArt, group: L.office.modes.insert, keywords: S.keywords.smartArt, command: 'dialog', value: 'smartArt' },
    { label: ST.guides, group: S.modes.view, keywords: S.keywords.guides, command: 'guides' },
    { label: ST.master, group: S.modes.view, keywords: S.keywords.master, command: 'master' }
  ]
}
