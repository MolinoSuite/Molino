import type { Api, Feature, FeatureContext } from './types'
import { BULLETS, customList, listFor, NUMBERS } from './lists'

/**
 * Lo que necesita la interfaz de Molino además de lo de siempre (engine.ts):
 * las listas de las galerías, la vista previa de los estilos, los estilos
 * propios del documento, los bordes y la alineación de Hojas y la tira de
 * diapositivas de Presentaciones.
 */

// ------------------------------------------------------------------ listas

/** Presentaciones: las listas son las del editor (tipo y subtipo de su galería). */
const SLIDE_BULLETS: Record<string, number> = { disc: 1, circle: 2, square: 3, star: 4, arrow: 5, check: 6, diamond: 7, dash: 8 }
const SLIDE_NUMBERS: Record<string, number> = { decimal: 1, decimalParen: 2, upperRoman: 3, upperLetter: 4, lowerLetter: 5, lowerRoman: 7 }

function listCommands(ctx: FeatureContext): Record<string, (value?: string) => void> {
  const { api } = ctx
  const apply = (spec: object | null): void => {
    if (spec) api.put_ListTypeCustom(ctx.local(spec))
  }
  if (ctx.kind === 'slide') {
    const slideList = (value: string): void => {
      const [kind, id = ''] = value.split(':')
      if (kind === 'none') api.put_ListType(0, -1)
      else if (kind === 'bullet' && id in SLIDE_BULLETS) api.put_ListType(0, SLIDE_BULLETS[id])
      else if (kind === 'number' && id in SLIDE_NUMBERS) api.put_ListType(1, SLIDE_NUMBERS[id])
    }
    return {
      list: (value) => slideList(value ?? ''),
      // Los botones de siempre: viñetas o números (o quitarlos, si ya los hay).
      bullets: () => slideList(ctx.state.list === 'bullets' ? 'none' : 'bullet:disc'),
      numbers: () => slideList(ctx.state.list === 'numbers' ? 'none' : 'number:decimal')
    }
  }
  return {
    list: (value) => apply(listFor(value ?? '')),
    bullets: () => apply(listFor(ctx.state.list === 'bullets' ? 'none' : 'bullet:disc')),
    numbers: () => apply(listFor(ctx.state.list === 'numbers' ? 'none' : 'number:decimal')),
    listCustom: (json) => {
      try {
        apply(customList(JSON.parse(json ?? '')))
      } catch {
        /* datos que no son una lista */
      }
    },
    // Reiniciar en 1 (o en el número que se diga) y continuar la de antes.
    listRestart: (value) => {
      const n = Number(value)
      api.asc_RestartNumbering(Number.isInteger(n) && n > 0 ? n : 1)
    },
    listContinue: () => api.asc_ContinueNumbering()
  }
}

// ----------------------------------------------------------------- estilos

/**
 * Estilos con vista previa, como en Word: al pasar el ratón el estilo se pone
 * en lo seleccionado; al salir se deshace (solo si ponerlo cambió algo); al
 * pulsar se queda.
 */
function styleCommands(ctx: FeatureContext): Record<string, (value?: string) => void> {
  const { api } = ctx
  let preview: string | null = null
  const end = (): void => {
    if (preview === null) return
    preview = null
    api.Undo()
  }
  const readStyles = (): void => {
    try {
      const all: Api[] = api.asc_GetStylesArray ? api.asc_GetStylesArray() : []
      const custom: string[] = []
      for (const style of all || []) {
        const name = typeof style?.get_Name === 'function' ? style.get_Name() : ''
        // Los de párrafo que salen en la galería (qFormat), como en Word; los de fábrica de Molino ya están.
        const paragraph = typeof style?.get_Type === 'function' ? style.get_Type() === 1 : false
        const gallery = typeof style?.get_QFormat === 'function' ? style.get_QFormat() === true : false
        if (name && paragraph && gallery) custom.push(name)
      }
      ctx.state.customStyles = custom.slice(0, 60)
      ctx.changed()
    } catch {
      /* sin lista de estilos */
    }
  }
  return {
    stylePreview: (name) => {
      if (!name || name === preview) return
      end()
      if (name === ctx.state.style) return
      api.put_Style(name)
      preview = name
    },
    stylePreviewEnd: () => end(),
    style: (name) => {
      if (!name) return
      if (preview === name) {
        // Ya está puesto por la vista previa: se queda.
        preview = null
        return
      }
      end()
      api.put_Style(name)
    },
    // Un estilo nuevo con el formato de lo seleccionado (como «Crear un estilo» de Word).
    newStyle: (name) => {
      const clean = (name ?? '').trim().slice(0, 60)
      if (!clean) return
      const style = api.asc_GetStyleFromFormatting()
      style.put_Name(clean)
      // Que salga en la galería de estilos (como los que se crean en Word).
      if (typeof style.put_QFormat === 'function') style.put_QFormat(true)
      api.asc_AddNewStyle(style)
      api.put_Style(clean)
      setTimeout(readStyles, 200)
    },
    readStyles: () => readStyles()
  }
}

// ------------------------------------------------------------------- Hojas

const CELL_BORDERS = ['all', 'outside', 'inside', 'top', 'bottom', 'left', 'right', 'thickBottom', 'none'] as const

function cellCommands(ctx: FeatureContext): Record<string, (value?: string) => void> {
  const { api, ew } = ctx
  const B = ew.Asc.c_oAscBorderOptions
  const S = ew.Asc.c_oAscBorderStyles
  const line = (style = S.Thin): Api => new ew.Asc.asc_CBorder(style, ctx.color('#000000'))
  const none = (): Api => new ew.Asc.asc_CBorder(S.None, ctx.color('#000000'))
  return {
    // Bordes de las celdas, como en el menú de Excel.
    cellBorders: (which) => {
      if (!CELL_BORDERS.includes(which as (typeof CELL_BORDERS)[number])) return
      const sides: Api[] = []
      const set = (keys: string[], value: () => Api): void => {
        for (const k of keys) sides[B[k]] = value()
      }
      if (which === 'all') set(['Left', 'Top', 'Right', 'Bottom', 'InnerV', 'InnerH'], line)
      else if (which === 'outside') set(['Left', 'Top', 'Right', 'Bottom'], line)
      else if (which === 'inside') set(['InnerV', 'InnerH'], line)
      else if (which === 'top') set(['Top'], line)
      else if (which === 'bottom') set(['Bottom'], line)
      else if (which === 'left') set(['Left'], line)
      else if (which === 'right') set(['Right'], line)
      else if (which === 'thickBottom') set(['Bottom'], () => line(S.Medium))
      else set(['Left', 'Top', 'Right', 'Bottom', 'InnerV', 'InnerH'], none)
      api.asc_setCellBorders(sides)
    },
    // Alineación vertical (arriba, en medio, abajo).
    valign: (where) => {
      const V = ew.Asc.c_oAscVAlign
      const value = { top: V.Top, center: V.Center, bottom: V.Bottom }[where as 'top' | 'center' | 'bottom']
      if (value !== undefined) api.asc_setCellVertAlign(value)
    },
    // Orientación del texto: girado o en vertical.
    textAngle: (degrees) => {
      const n = Number(degrees)
      if ([0, 45, -45, 90, -90, 255].includes(n)) api.asc_setCellAngle(n)
    },
    // Combinar: y centrar, en cada fila, sin centrar, o separar.
    mergeMode: (mode) => {
      const M = ew.Asc.c_oAscMergeOptions
      const value = { center: M.MergeCenter, across: M.MergeAcross, cells: M.Merge, unmerge: M.None }[mode as 'center' | 'across' | 'cells' | 'unmerge']
      if (value !== undefined) api.asc_mergeCells(value)
    },
    // Inmovilizar: paneles (en la celda), la fila de arriba o la primera columna; o quitarlo.
    freezePanes: (which) => {
      const F = ew.Asc.c_oAscFrozenPaneAddType
      if (which === 'row') api.asc_freezePane(F.firstRow)
      else if (which === 'col') api.asc_freezePane(F.firstCol)
      else if (which === 'none') {
        if (ctx.state.frozen) api.asc_freezePane()
      } else api.asc_freezePane()
    }
  }
}

// ---------------------------------------------------------- Presentaciones

/** Dónde va la tira de diapositivas (left, bottom, right) o si se oculta (hide). */
const THUMBS: Record<string, number> = { left: 0, right: 1, bottom: 2 }

function slideCommands(ctx: FeatureContext): Record<string, (value?: string) => void> {
  const { api } = ctx
  return {
    thumbs: (where) => {
      if (where === 'hide') {
        api.ShowThumbnails(false)
        ctx.state.extra.thumbs = 'hide'
      } else if (where && where in THUMBS) {
        api.ShowThumbnails(true)
        api.asc_SetThumbnailsPosition(THUMBS[where])
        ctx.state.extra.thumbs = where
        try {
          localStorage.setItem('molino.office.thumbs', where)
        } catch {
          /* no se recuerda */
        }
      }
      ctx.changed()
    },
    // Diapositiva nueva con un diseño (el de la galería).
    newSlideLayout: (index) => {
      const n = Number(index)
      if (Number.isInteger(n) && n >= 0) api.AddSlide(n)
      else api.AddSlide()
    }
  }
}

export const baseFeature: Feature = {
  commands: (ctx) => ({
    ...(ctx.kind !== 'cell' ? listCommands(ctx) : {}),
    ...(ctx.kind === 'word' ? styleCommands(ctx) : {}),
    ...(ctx.kind === 'cell' ? cellCommands(ctx) : {}),
    ...(ctx.kind === 'slide' ? slideCommands(ctx) : {})
  }),
  listen: (ctx, on) => {
    if (ctx.kind === 'word') {
      // Los estilos propios del documento, cuando el editor tiene su lista.
      on('asc_onInitEditorStyles', () => setTimeout(() => ctx.api && styleCommands(ctx).readStyles(), 0))
    }
    if (ctx.kind === 'cell') {
      on('asc_onSelectionChanged', (info: Api) => {
        try {
          const xfs = info.asc_getXfs()
          const V = ctx.ew.Asc.c_oAscVAlign
          const v = xfs.asc_getVertAlign()
          ctx.state.extra.valign = v === V.Top ? 'top' : v === V.Center ? 'center' : 'bottom'
          ctx.state.extra.angle = String(xfs.asc_getAngle?.() ?? 0)
        } catch {
          /* celda sin datos de formato */
        }
      })
    }
    if (ctx.kind === 'slide') {
      // La tira de diapositivas donde se dejó la última vez.
      let saved = 'left'
      try {
        saved = localStorage.getItem('molino.office.thumbs') ?? 'left'
      } catch {
        /* sin almacenamiento */
      }
      let placed = false
      const place = (): void => {
        if (placed || !ctx.api) return
        placed = true
        if (saved !== 'left') baseFeature.commands!(ctx).thumbs(saved)
        else ctx.state.extra.thumbs = 'left'
        ctx.changed()
      }
      on('asc_onDocumentContentReady', place)
      // Si el documento ya estaba listo al escuchar, un poco después.
      setTimeout(place, 1200)
    }
  }
}

/** Las viñetas y numeraciones que se ofrecen en la galería (Presentaciones no tiene multinivel). */
export const LIST_IDS = { bullets: Object.keys(BULLETS), numbers: Object.keys(NUMBERS) }
