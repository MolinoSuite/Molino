import { create } from 'zustand'
import type { WhatsNewNotice } from '@shared/types'

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
