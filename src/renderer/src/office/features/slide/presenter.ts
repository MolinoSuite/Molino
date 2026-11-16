import type { PresenterAction, PresenterScreen, PresenterState } from '@shared/officeui'
import type { Api, FeatureContext } from '../types'
import { readNotes } from './RehearsePanel'

/**
 * Presentar con la vista del moderador: lo que hace la ventana de
 * Presentaciones (la presentación es la del editor de ONLYOFFICE).
 *
 * Al empezar, el proceso principal lleva la ventana a la pantalla de la
 * presentación y abre la vista del moderador (officepresenter.ts). Mientras se
 * presenta, se le manda en qué diapositiva se va, sus notas y dos imágenes: la
 * que ve el público (copiada del lienzo de la presentación, tal cual, con las
 * animaciones como estén) y la siguiente (dibujada por el editor con su vista
 * previa de impresión, en un lienzo fuera de la vista). Lo que pide la vista
 * del moderador (pasar, volver, ir a una, terminar) llega aquí y se hace con
 * la API de la presentación del editor.
 */

const USE_KEY = 'molino.slide.presenter'
const SCREEN_KEY = 'molino.slide.screen'
/** Cada cuánto se mira si ha cambiado lo que ve el público (animaciones, clics en la otra pantalla). */
const WATCH_MS = 1500
/** Ancho máximo de las imágenes que se mandan. */
const CURRENT_WIDTH = 1280
const NEXT_WIDTH = 960

// ------------------------------------------------------------------ ajustes

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function writeLocal(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* sin almacenamiento: no se recuerda */
  }
}

/** ¿Vista del moderador con dos pantallas? (sí, salvo que se haya quitado). */
export function presenterOn(): boolean {
  return readLocal(USE_KEY) !== '0'
}
export function setPresenterOn(on: boolean): void {
  writeLocal(USE_KEY, on ? null : '0')
}
/** La pantalla elegida para la presentación (null: la automática). */
export function chosenScreen(): number | null {
  const n = Number(readLocal(SCREEN_KEY))
  return readLocal(SCREEN_KEY) !== null && Number.isSafeInteger(n) ? n : null
}
export function setChosenScreen(id: number | null): void {
  writeLocal(SCREEN_KEY, id === null ? null : String(id))
}

// ---------------------------------------------------------------- pantallas

let screens: PresenterScreen[] = []
/** Quién quiere saberlo: el editor de cada pestaña (se olvida cuando se cierra). */
const screenWatchers = new Map<(list: PresenterScreen[]) => void, FeatureContext>()
let screensWatched = false

function closed(ctx: FeatureContext): boolean {
  try {
    return !ctx.ew || ctx.ew.closed === true
  } catch {
    return true
  }
}

/** Las pantallas del equipo, ahora y cada vez que cambien (se conecta el proyector…). */
export function watchScreens(ctx: FeatureContext, listener: (list: PresenterScreen[]) => void): void {
  for (const [fn, owner] of screenWatchers) if (closed(owner)) screenWatchers.delete(fn)
  screenWatchers.set(listener, ctx)
  const publish = (list: PresenterScreen[]): void => {
    screens = Array.isArray(list) ? list.slice(0, 8) : []
    for (const [fn, owner] of screenWatchers) {
      if (closed(owner)) screenWatchers.delete(fn)
      else fn(screens)
    }
  }
  if (!screensWatched) {
    screensWatched = true
    window.molinoOffice.presenter.onScreens(publish)
  }
  void window.molinoOffice.presenter
    .screens()
    .then(publish)
    .catch(() => undefined)
}

// --------------------------------------------------------------- presentar

interface Show {
  ctx: FeatureContext
  doc: string
  name: string
  /** Hay vista del moderador a la que mandar lo que se ve. */
  presenter: boolean
  /** La diapositiva que se ve (desde 0); igual al número de diapositivas: la pantalla del final. */
  index: number
  /** La última imagen de lo que ve el público que se mandó. */
  current: string | null
  /** Las siguientes ya dibujadas (no cambian mientras se presenta). */
  drawn: Map<number, string>
  /** El lienzo de la vista previa de impresión (en el editor, fuera de la vista). */
  box: HTMLElement | null
  timers: number[]
  watch: number
}

let show: Show | null = null
let commandsWatched = false

/** El documento de la pestaña de este editor (frame.html lo lleva en su dirección) y su nombre. */
function tabOf(ew: Api): { doc: string; name: string } | null {
  try {
    const query = new URLSearchParams(ew.parent.location.search)
    const doc = query.get('doc') ?? ''
    return /^o[0-9a-f]{16}$/.test(doc) ? { doc, name: (query.get('name') ?? '').slice(0, 300) } : null
  } catch {
    return null
  }
}

/** ¿Se está presentando este documento? */
export function presenting(ctx: FeatureContext): boolean {
  return show !== null && show.ctx.api === ctx.api
}

/**
 * Empieza a presentar desde el principio o desde la diapositiva actual. Con
 * ``rehearse``, también con una sola pantalla: la vista del moderador encima.
 */
export async function startShow(ctx: FeatureContext, from: 'start' | 'here', rehearse: boolean): Promise<void> {
  const { api, ew } = ctx
  const tab = tabOf(ew)
  if (!tab) return
  if (show) {
    // Ya se está presentando (o quedó algo de una que terminó sin avisar): solo se sigue si es de verdad.
    if (show.ctx.api === api && showCanvas(ew)) return
    finish()
  }
  const first = from === 'here' ? Number(api.getCurrentPage()) || 0 : 0
  const current: Show = { ctx, doc: tab.doc, name: tab.name, presenter: false, index: first, current: null, drawn: new Map(), box: null, timers: [], watch: 0 }
  show = current
  try {
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
    const answer = await window.molinoOffice.presenter.start(tab.doc, { presenter: presenterOn(), screen: chosenScreen(), rehearse, accent })
    current.presenter = Boolean(answer?.presenter)
  } catch {
    current.presenter = false
  }
  if (show !== current) return
  watchCommands()
  try {
    // La presentación del editor (la misma que hacía «Presentar»): pide la pantalla completa (bridge.js).
    ew.Common.NotificationCenter.trigger('preview:start', first, false, false, from === 'here')
  } catch (error) {
    console.error('presentar:', error)
    finish()
    return
  }
  if (current.presenter) {
    current.watch = window.setInterval(() => capture(current), WATCH_MS)
    update(current)
  }
}

/** La presentación ha pasado a otra diapositiva (asc_onDemonstrationSlideChanged). */
export function slideChanged(ctx: FeatureContext, index: unknown): void {
  if (!show || show.ctx.api !== ctx.api || typeof index !== 'number') return
  show.index = index
  update(show)
}

/** La presentación ha terminado (asc_onEndDemonstration). */
export function showEnded(ctx: FeatureContext): void {
  if (show && show.ctx.api === ctx.api) finish()
}

function finish(): void {
  const ended = show
  show = null
  if (!ended) return
  window.clearInterval(ended.watch)
  for (const timer of ended.timers) window.clearTimeout(timer)
  try {
    if (ended.box) {
      ended.ctx.api.asc_closePrintPreview?.()
      ended.box.remove()
    }
  } catch {
    /* el editor ya no está */
  }
  window.molinoOffice.presenter.end(ended.doc)
}

/** Lo que pide la vista del moderador (llega por el proceso principal). */
function watchCommands(): void {
  if (commandsWatched) return
  commandsWatched = true
  window.molinoOffice.presenter.onCommand(({ doc, action, slide }) => {
    const current = show
    if (!current || current.doc !== doc) return
    run(current, action, slide)
  })
}

function run(current: Show, action: PresenterAction, slide?: number): void {
  const api = current.ctx.api
  try {
    const count = Number(api.getCountPages()) || 0
    if (action === 'next') api.DemonstrationNextSlide()
    else if (action === 'prev') api.DemonstrationPrevSlide()
    else if (action === 'first') api.DemonstrationGoToSlide(0)
    else if (action === 'last') api.DemonstrationGoToSlide(Math.max(0, count - 1))
    else if (action === 'goto' && typeof slide === 'number' && slide >= 0 && slide < count) api.DemonstrationGoToSlide(slide)
    else if (action === 'end') api.EndDemonstration()
  } catch (error) {
    console.error('vista del moderador:', error)
  }
  // Una animación dentro de la diapositiva no avisa: se mira enseguida lo que ve el público.
  later(current, 150)
  later(current, 900)
}

function later(current: Show, ms: number): void {
  // Las de hace rato ya han saltado: solo se guardan las últimas (para pararlas al terminar).
  current.timers = [...current.timers.slice(-15), window.setTimeout(() => capture(current), ms)]
}

// ---------------------------------------------------- lo que ve el moderador

/** La siguiente diapositiva que se verá (las ocultas no salen), o null si no hay más. */
function nextVisible(api: Api, index: number, count: number): number | null {
  try {
    const presentation = api.getJsApi().GetPresentation()
    for (let i = index + 1; i < count; i++) {
      const slide = presentation.GetSlideByIndex(i)
      if (!slide || slide.GetVisible?.() !== false) return i
    }
  } catch {
    return index + 1 < count ? index + 1 : null
  }
  return null
}

/**
 * Manda a la vista del moderador en cuál se va, sus notas, la siguiente y lo que
 * ve el público. Al cambiar de diapositiva (``settle``), se vuelve a mirar
 * después, cuando haya terminado la transición.
 */
function update(current: Show, settle = true): void {
  if (!current.presenter || show !== current) return
  const api = current.ctx.api
  let state: PresenterState
  try {
    const count = Math.max(1, Number(api.getCountPages()) || 1)
    const finished = current.index >= count
    const index = Math.min(Math.max(0, current.index), count - 1)
    const next = finished ? null : nextVisible(api, index, count)
    let image = next === null ? null : (current.drawn.get(next) ?? null)
    if (next !== null && !image) {
      image = drawSlide(current, next)
      if (image) current.drawn.set(next, image)
    }
    current.current = grab(current) ?? current.current
    state = {
      title: current.name,
      index,
      count,
      finished,
      notes: finished ? '' : readNotes(api, index),
      current: current.current,
      next: next === null ? null : { index: next, image }
    }
  } catch (error) {
    console.error('vista del moderador:', error)
    return
  }
  window.molinoOffice.presenter.state(current.doc, state)
  if (settle) {
    later(current, 700)
    later(current, 1600)
  }
}

/** Si ha cambiado lo que ve el público, se manda otra vez todo. */
function capture(current: Show): void {
  if (!current.presenter || show !== current) return
  const image = grab(current)
  if (!image || image === current.current) return
  current.current = image
  update(current, false)
}

/** El lienzo de la presentación del editor (el mayor de los suyos). */
function showCanvas(ew: Api): HTMLCanvasElement | null {
  const host = ew.document.getElementById('presentation-preview') ?? ew.document.getElementById('pe-preview')
  let best: HTMLCanvasElement | null = null
  for (const canvas of host ? (Array.from(host.querySelectorAll('canvas')) as HTMLCanvasElement[]) : []) {
    if (canvas.width > 0 && canvas.height > 0 && (!best || canvas.width * canvas.height > best.width * best.height)) best = canvas
  }
  return best
}

/** La diapositiva tal como la ve el público: del lienzo de la presentación, sin las bandas de los lados. */
function grab(current: Show): string | null {
  const { api, ew } = current.ctx
  try {
    const canvas = showCanvas(ew)
    if (!canvas) return null
    const aspect = Number(api.get_PresentationWidth()) / Number(api.get_PresentationHeight()) || 16 / 9
    const { width, height } = canvas
    const w = width / height > aspect ? height * aspect : width
    const h = width / height > aspect ? height : width / aspect
    const scale = Math.min(1, CURRENT_WIDTH / w)
    const out = ew.document.createElement('canvas') as HTMLCanvasElement
    out.width = Math.max(1, Math.round(w * scale))
    out.height = Math.max(1, Math.round(h * scale))
    out.getContext('2d')?.drawImage(canvas, (width - w) / 2, (height - h) / 2, w, h, 0, 0, out.width, out.height)
    return out.toDataURL('image/jpeg', 0.86)
  } catch {
    return null
  }
}

/**
 * Una diapositiva dibujada por el editor con su vista previa de impresión (una
 * página del tamaño de la diapositiva, en un lienzo fuera de la vista). La
 * página sale con un borde y un margen blanco alrededor: se recorta.
 */
function drawSlide(current: Show, index: number): string | null {
  const { api, ew } = current.ctx
  try {
    const W = Number(api.get_PresentationWidth())
    const H = Number(api.get_PresentationHeight())
    if (!(W > 0 && H > 0)) return null
    if (!current.box) {
      const box = ew.document.createElement('div') as HTMLElement
      box.id = 'molino-presenter-next'
      box.setAttribute('aria-hidden', 'true')
      const height = Math.round((NEXT_WIDTH * H) / W) + 20
      box.style.cssText = `position:fixed;left:-30000px;top:0;width:${NEXT_WIDTH + 20}px;height:${height}px;pointer-events:none;visibility:hidden`
      ew.document.body.appendChild(box)
      const options = new ew.Asc.asc_CDownloadOptions(null, true)
      const print = new ew.Asc.CAscPresentationPrintOptions()
      // Milímetros: la página, del tamaño de la diapositiva; las ocultas también (así cada página es su diapositiva).
      print.asc_getPageOptions().asc_setWidth(W / 36_000)
      print.asc_getPageOptions().asc_setHeight(H / 36_000)
      print.asc_getSlidePrintOptions?.()?.asc_setIsPrintHiddenSlides?.(true)
      options.asc_setAdvancedOptions(print)
      api.asc_initPrintPreview(box.id, options)
      current.box = box
    }
    api.asc_drawPrintPreview(index)
    const canvas = current.box.querySelector('canvas') as HTMLCanvasElement | null
    const page = canvas ? pageArea(canvas) : null
    if (!canvas || !page) return null
    const out = ew.document.createElement('canvas') as HTMLCanvasElement
    out.width = page.w
    out.height = page.h
    out.getContext('2d')?.drawImage(canvas, page.x, page.y, page.w, page.h, 0, 0, page.w, page.h)
    return out.toDataURL('image/jpeg', 0.86)
  } catch (error) {
    console.error('siguiente diapositiva:', error)
    return null
  }
}

/** Dónde está la página en el lienzo de la vista previa: fuera es blanco del todo; el borde, oscuro. */
function pageArea(canvas: HTMLCanvasElement): { x: number; y: number; w: number; h: number } | null {
  const { width, height } = canvas
  const context = canvas.getContext('2d')
  if (!context || width < 40 || height < 40) return null
  const data = context.getImageData(0, 0, width, height).data
  const inked = (x: number, y: number): boolean => {
    const i = (y * width + x) * 4
    return data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250
  }
  const midY = height >> 1
  const midX = width >> 1
  let left = 0
  while (left < width - 1 && !inked(left, midY)) left++
  let right = width - 1
  while (right > left && !inked(right, midY)) right--
  let top = 0
  while (top < height - 1 && !inked(midX, top)) top++
  let bottom = height - 1
  while (bottom > top && !inked(midX, bottom)) bottom--
  // Dentro del borde (que puede ocupar dos píxeles).
  const x = left + 2
  const y = top + 2
  const w = right - left - 3
  const h = bottom - top - 3
  return w > 20 && h > 20 ? { x, y, w, h } : null
}
