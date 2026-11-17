import type { InkColor, PresenterAction, PresenterMark, PresenterScreen, PresenterState } from '@shared/officeui'
import { type HandTool, InkBook, type LocalInkOp, type Point, type Screen } from '../../presenter/ink'
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
 *
 * Encima de la presentación, Molino pone su capa (ShowLayer.tsx): la tinta de
 * cada diapositiva (bolígrafo y rotulador, que no se guardan en el archivo), el
 * puntero láser y la pantalla en negro o en blanco. Se puede usar desde la vista
 * del moderador o desde la propia presentación (con su barrita, su menú y las
 * teclas de PowerPoint); lo de una llega a la otra. Lo que hay dibujado está aquí.
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
  /** La tinta de cada diapositiva (la del final: el número de diapositivas). */
  ink: InkBook
  /** La pantalla en negro o en blanco (null: se ve la presentación). */
  screen: Screen
  /** Dónde está el puntero láser (null: no se ve). */
  laser: Point | null
  /** Lo que se tiene en la mano en esta ventana, y el color y grosor de la tinta. */
  tool: HandTool
  color: InkColor
  width: 1 | 2 | 3
  /** El número que se va escribiendo para ir a una diapositiva (como en PowerPoint). */
  typed: string
}

let show: Show | null = null
let commandsWatched = false
/** Quién pinta lo de encima de la presentación (ShowLayer.tsx): se le avisa en cada cambio. */
const showListeners = new Set<() => void>()
let showVersion = 0
function changed(): void {
  showVersion++
  for (const listener of showListeners) listener()
}

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
  const current: Show = {
    ctx,
    doc: tab.doc,
    name: tab.name,
    presenter: false,
    index: first,
    current: null,
    drawn: new Map(),
    box: null,
    timers: [],
    watch: 0,
    ink: new InkBook(),
    screen: null,
    laser: null,
    tool: null,
    color: 'red',
    width: 2,
    typed: ''
  }
  show = current
  // Las teclas de la presentación que añade Molino, también con el teclado en el editor (bridge.js).
  window.molinoShowKey = (event) => showKey(event)
  changed()
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
  // La tinta de la que se ve ahora, también en la vista del moderador.
  sync(show)
  changed()
}

/** La presentación ha terminado (asc_onEndDemonstration). */
export function showEnded(ctx: FeatureContext): void {
  if (show && show.ctx.api === ctx.api) finish()
}

function finish(): void {
  const ended = show
  show = null
  if (!ended) return
  // La tinta no se guarda: se va con la presentación.
  ended.ink.clearAll()
  if (window.molinoShowKey) window.molinoShowKey = undefined
  changed()
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
  // Tinta, láser y pantalla en negro desde la vista del moderador (ya comprobado en officepresenter.ts).
  window.molinoOffice.presenter.onMark(({ doc, mark }) => {
    const current = show
    if (current && current.doc === doc) receive(current, mark)
  })
  // La vista del moderador se ha abierto (o se ha vuelto a cargar): lo que hay dibujado y si está en negro.
  window.molinoOffice.presenter.onReady((doc) => {
    const current = show
    if (!current || current.doc !== doc) return
    sync(current)
    send(current, { kind: 'screen', screen: current.screen })
  })
}

function run(current: Show, action: PresenterAction, slide?: number): void {
  const api = current.ctx.api
  // Pasar de diapositiva (o terminar) destapa la presentación.
  if (current.screen) setScreen(current, null)
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

// -------------------------------------------- tinta, láser y pantalla en negro

/** La diapositiva cuya tinta se ve: la actual o, en la pantalla del final, el número de diapositivas. */
function slideKey(current: Show): number {
  try {
    const count = Math.max(1, Number(current.ctx.api.getCountPages()) || 1)
    return current.index >= count ? count : Math.max(0, current.index)
  } catch {
    return Math.max(0, current.index)
  }
}

/** A la vista del moderador (si la hay). */
function send(current: Show, mark: PresenterMark): void {
  if (current.presenter && show === current) window.molinoOffice.presenter.mark(current.doc, mark)
}

/** Toda la tinta de la diapositiva que se ve, a la vista del moderador. */
function sync(current: Show): void {
  const slide = slideKey(current)
  send(current, { kind: 'sync', slide, strokes: current.ink.get(slide) })
}

function setScreen(current: Show, screen: Screen): void {
  if (current.screen === screen) return
  current.screen = screen
  send(current, { kind: 'screen', screen })
  changed()
}

/** Lo que llega de la vista del moderador. */
function receive(current: Show, mark: PresenterMark): void {
  if (mark.kind === 'ink') {
    if (current.ink.apply(mark.op.slide, mark.op)) changed()
  } else if (mark.kind === 'laser') {
    current.laser = mark.at
    changed()
  } else if (mark.kind === 'screen') {
    // Se devuelve siempre: así las dos ventanas dicen lo mismo aunque se pulse a la vez en las dos.
    current.screen = mark.screen
    send(current, { kind: 'screen', screen: mark.screen })
    changed()
  }
}

/** Lo que se ve encima de la presentación (para ShowLayer.tsx); null si no se presenta. */
export interface ShowView {
  /** La ventana del editor (sus teclas, su ratón, dónde está la presentación). */
  ew: Api
  slide: number
  strokes: ReturnType<InkBook['get']>
  screen: Screen
  laser: Point | null
  tool: HandTool
  color: InkColor
  width: 1 | 2 | 3
  /** Ancho / alto de la diapositiva. */
  aspect: number
  /** La diapositiva que se ve (desde 0), cuántas hay y si se está en la pantalla del final. */
  index: number
  count: number
  finished: boolean
}

export function subscribeShow(listener: () => void): () => void {
  showListeners.add(listener)
  return () => showListeners.delete(listener)
}
export function showRevision(): number {
  return showVersion
}
export function showView(): ShowView | null {
  const current = show
  if (!current) return null
  const { api, ew } = current.ctx
  let aspect = 16 / 9
  let count = 1
  try {
    aspect = Number(api.get_PresentationWidth()) / Number(api.get_PresentationHeight()) || aspect
    count = Math.max(1, Number(api.getCountPages()) || 1)
  } catch {
    /* el editor se está cerrando */
  }
  const slide = slideKey(current)
  return {
    ew,
    slide,
    strokes: current.ink.get(slide),
    screen: current.screen,
    laser: current.laser,
    tool: current.tool,
    color: current.color,
    width: current.width,
    aspect,
    index: Math.min(current.index, count - 1),
    count,
    finished: current.index >= count
  }
}

/** Lo dibujado en la propia presentación: aquí y en la vista del moderador. */
export function showInk(op: LocalInkOp): void {
  const current = show
  if (!current) return
  const slide = slideKey(current)
  if (current.ink.apply(slide, op)) changed()
  send(current, { kind: 'ink', op: { ...op, slide } })
}
export function showLaser(at: Point | null): void {
  const current = show
  if (!current) return
  current.laser = at
  send(current, { kind: 'laser', at })
  changed()
}
export function showScreen(screen: Screen): void {
  if (show) setScreen(show, screen)
}
export function showTool(tool: HandTool): void {
  const current = show
  if (!current || current.tool === tool) return
  if (current.tool === 'laser' && current.laser) showLaser(null)
  current.tool = tool
  changed()
}
export function showColor(color: InkColor): void {
  if (!show) return
  show.color = color
  changed()
}
export function showWidth(width: 1 | 2 | 3): void {
  if (!show) return
  show.width = width
  changed()
}
/** Pasar, volver, ir a una o terminar, desde la propia presentación. */
export function showGo(action: PresenterAction, slide?: number): void {
  if (show) run(show, action, slide)
}

/**
 * Las teclas que Molino añade a la presentación, como en PowerPoint: Ctrl+L el
 * láser, Ctrl+P el bolígrafo, Ctrl+I el rotulador, Ctrl+E el borrador, Ctrl+A
 * soltarlo; E borra la tinta de la diapositiva; B o el punto, pantalla en negro;
 * W o la coma, en blanco; con la pantalla tapada, cualquier tecla la destapa; Esc
 * suelta lo que se tenga en la mano; un número y Enter va a esa diapositiva. Lo
 * demás (pasar, volver, terminar) lo hace el editor. true: era suya.
 */
export function showKey(event: KeyboardEvent): boolean {
  const current = show
  if (!current || event.type !== 'keydown') return false
  const key = event.key
  if (['Control', 'Shift', 'Alt', 'Meta', 'AltGraph', 'CapsLock', 'NumLock'].includes(key)) return false
  if (current.screen) {
    setScreen(current, null)
    return true
  }
  const ctrl = event.ctrlKey || event.metaKey
  const lower = key.toLowerCase()
  if (ctrl && !event.altKey && !event.shiftKey) {
    const tools: Record<string, HandTool> = { l: 'laser', p: 'pen', i: 'highlighter', e: 'eraser' }
    if (lower in tools) {
      showTool(current.tool === tools[lower] ? null : tools[lower])
      return true
    }
    if (lower === 'a') {
      showTool(null)
      return true
    }
    return false
  }
  if (ctrl || event.altKey) return false
  if (/^[0-9]$/.test(key)) {
    current.typed = (current.typed + key).slice(-4)
    return true
  }
  const typed = current.typed
  current.typed = ''
  if (key === 'Enter' && typed) {
    const n = Number(typed)
    const count = Number(current.ctx.api.getCountPages()) || 0
    if (n >= 1 && n <= count) run(current, 'goto', n - 1)
    return true
  }
  if (lower === 'b' || key === '.') setScreen(current, 'black')
  else if (lower === 'w' || key === ',') setScreen(current, 'white')
  else if (lower === 'e') showInk({ op: 'clear' })
  else if (key === 'Escape' && current.tool) showTool(null)
  else return false
  return true
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
