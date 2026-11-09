import { create } from 'zustand'
import type { OfficeFailure, OfficeProgress, OfficeStatus } from '@shared/office'

/** El motor de oficina (Documentos, Hojas y Presentaciones) tal como lo cuenta el proceso principal (office.ts). */
interface OfficeState {
  status: OfficeStatus | null
  progress: OfficeProgress | null
  error: OfficeFailure | null
}

export const useOffice = create<OfficeState>(() => ({ status: null, progress: null, error: null }))

export async function refreshOffice(): Promise<void> {
  const reply = await window.molino.office.status()
  if (reply.ok) useOffice.setState({ status: reply.value })
}

let started = false

/** Empieza a seguir el estado (una sola vez, al montar la aplicación). */
export function followOffice(): void {
  if (started) return
  started = true
  void refreshOffice()
  window.molino.office.onProgress((progress) => useOffice.setState({ progress, ...(progress ? { error: null } : {}) }))
  window.molino.office.onChanged(() => void refreshOffice())
  window.molino.office.onError((error) => useOffice.setState({ error }))
}

export function addOffice(): void {
  useOffice.setState({ error: null })
  void window.molino.office.install()
}
