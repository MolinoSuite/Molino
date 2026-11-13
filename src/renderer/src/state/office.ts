import { create } from 'zustand'
import type { OfficeStatus } from '@shared/office'

/** Documentos, Hojas y Presentaciones: si este Molino las trae (Molino Suite) y la versión del motor (office.ts). */
interface OfficeState {
  status: OfficeStatus | null
}

export const useOffice = create<OfficeState>(() => ({ status: null }))

let started = false

/** Mira el estado una vez, al montar la aplicación (no cambia mientras está abierta). */
export function followOffice(): void {
  if (started) return
  started = true
  void window.molino.office.status().then((reply) => {
    if (reply.ok) useOffice.setState({ status: reply.value })
  })
}
