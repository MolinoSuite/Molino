import type { OfficeUiApi, PresenterApi } from '@shared/officeui'

declare global {
  interface Window {
    /** La interfaz de Documentos, Hojas y Presentaciones (preload/office.ts). */
    molinoOffice: OfficeUiApi
    /** Solo en la vista del moderador (presenter.html): lo que enseña y lo que pide. */
    molinoPresenter?: PresenterApi
    /** Atajos de la ventana que llegan desde el editor (office/bridge.js). */
    molinoShortcut?: (key: string) => void
    /** El editor entra o sale de presentar a pantalla completa. */
    molinoFullscreen?: (on: boolean) => void
    /** ¿La pestaña activa no tiene archivo propio? Entonces Ctrl+S en el documento pregunta dónde guardar. */
    molinoNeedsSaveAs?: () => boolean
    /** Presentando (Presentaciones): las teclas de Molino encima de la presentación (láser, bolígrafo, negro…); true si era suya. */
    molinoShowKey?: (event: KeyboardEvent) => boolean
  }
}

export {}
