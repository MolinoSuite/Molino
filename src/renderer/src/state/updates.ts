import { create } from 'zustand'
import type { UpdateStatus } from '@shared/types'

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
