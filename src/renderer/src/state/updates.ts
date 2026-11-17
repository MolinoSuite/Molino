import { create } from 'zustand'
import type { UpdateStatus, WhatsNewNotice } from '@shared/types'

/** Estado de las versiones nuevas, tal como lo cuenta el proceso principal (updates.ts). */
interface UpdatesState {
  status: UpdateStatus
  /** La versión que el usuario ha dejado para más tarde en esta sesión («Ahora no»). */
  postponed: string | null
}

export const useUpdates = create<UpdatesState>(() => ({ status: { state: 'unavailable' }, postponed: null }))

let started = false

/** Empieza a seguir el estado (una sola vez, al montar la aplicación). */
export function followUpdates(): void {
  if (started) return
  started = true
  void window.molino.updates.status().then((status) => useUpdates.setState({ status }))
  window.molino.updates.onStatus((status) => useUpdates.setState({ status }))
}

export function postponeUpdate(): void {
  useUpdates.setState((state) => ({ postponed: state.status.version ?? null }))
}

/** El aviso de novedades tras actualizar (main/whatsnew.ts): lo que cuenta en esta ventana, si algo. */
export const useWhatsNew = create<{ notice: WhatsNewNotice | null }>(() => ({ notice: null }))

/** Pregunta si esta ventana avisa de las novedades (solo la de Molino PDF; una vez, al montarla). */
export function followWhatsNew(): void {
  void window.molino.notices.whatsNew().then(
    (notice) => useWhatsNew.setState({ notice }),
    () => undefined
  )
}

/** «Ver novedades» (en el aviso o en Acerca de): la página de esta versión; el aviso ya no vuelve a salir. */
export function openWhatsNew(): void {
  useWhatsNew.setState({ notice: null })
  void window.molino.about.open('whatsNew')
}

/** «Cerrar» el aviso de novedades: no vuelve a salir hasta la próxima versión. */
export function dismissWhatsNew(): void {
  useWhatsNew.setState({ notice: null })
  window.molino.notices.dismissWhatsNew()
}
