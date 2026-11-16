import { viewerOf } from '@/lib/viewerControl'
import { useApp } from './app'

/**
 * Pantalla completa para presentar un PDF (en un proyector, por ejemplo): la
 * ventana sin bordes y el documento página a página (components/FullScreen.tsx).
 * Se abre con el botón del indicador de zoom, con F5 o desde «¿Qué quieres hacer?».
 */
export function startFullScreen(): void {
  const state = useApp.getState()
  if (state.fullScreen || !state.active || !state.docs[state.active]?.pages.length) return
  state.setFullScreen(true)
  window.molino.window.setFullScreen(true)
}

/** Sale de la pantalla completa; el visor queda en la página que se estaba mostrando. */
export function stopFullScreen(page?: string): void {
  const state = useApp.getState()
  if (!state.fullScreen) return
  state.setFullScreen(false)
  window.molino.window.setFullScreen(false)
  const doc = state.active
  if (!doc || !page) return
  state.patchDoc(doc, { current: page })
  // Cuando la ventana ya ha vuelto a su tamaño (y otra vez por si tarda).
  for (const ms of [120, 450]) window.setTimeout(() => viewerOf(doc)?.scrollToPage(page), ms)
}
