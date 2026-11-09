import type { OfficeUiApi } from '@shared/officeui'

declare global {
  interface Window {
    /** La interfaz de Documentos, Hojas y Presentaciones (preload/office.ts). */
    molinoOffice: OfficeUiApi
    /** Atajos de la ventana que llegan desde el editor (office/bridge.js). */
    molinoShortcut?: (key: string) => void
    /** El editor entra o sale de presentar a pantalla completa. */
    molinoFullscreen?: (on: boolean) => void
  }
}

export {}
