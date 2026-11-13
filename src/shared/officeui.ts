/** Lo que comparten el proceso principal (officewin.ts) y la interfaz de Documentos, Hojas y Presentaciones. */
import type { DocDescriptor } from './types'
import type { OfficeLegal } from './office'

export type OfficeKind = 'word' | 'cell' | 'slide'

/** Un script del usuario: su nombre y su código (la API de documentos de ONLYOFFICE). */
export interface OfficeScript {
  id: string
  name: string
  code: string
}

/** Un aviso o una pregunta del proceso principal, que la app muestra con su aspecto (no el cuadro de Windows). */
export interface OfficeAsk {
  id: number
  type: 'info' | 'error' | 'warning' | 'question'
  title: string
  message: string
  detail?: string
  buttons: string[]
  /** El botón principal y el de cancelar (Esc o cerrar el cuadro). */
  defaultId: number
  cancelId: number
}

export interface OfficeTab {
  doc: string
  name: string
  /** Extensión sin punto (docx, xlsx…). */
  ext: string
  modified: boolean
  /** Tiene archivo propio (no es nuevo ni recuperado): «Guardar» guarda ahí; si no, pregunta dónde. */
  hasFile: boolean
  /** Fuentes que nombra el documento y no están en el equipo (vacío si no falta ninguna o ya se dijo «Ahora no»). */
  missingFonts: string[]
}

/** Qué se puede hacer con una fuente que falta (src/main/fontcatalog.ts). */
export type OfficeFontInfo =
  | { name: string; status: 'free'; license: 'ofl' | 'apache' | 'ufl'; size: number; files: number }
  | { name: string; status: 'microsoft'; substitute: string | null }
  | { name: string; status: 'unknown' }

export interface OfficeTabs {
  kind: OfficeKind
  active: string | null
  /** Se está abriendo algún documento (sin pestañas aún, la interfaz muestra «Abriendo…»). */
  opening: boolean
  /** Las pestañas, en orden. */
  tabs: OfficeTab[]
}

/** Un reciente de la app, como lo ve la interfaz: el nombre y la carpeta que lo contiene, nunca la ruta. */
export interface OfficeRecent {
  id: string
  name: string
  folder: string
  openedAt: number
}

/** Un documento que se puede recuperar: su nombre y cuándo se tocó por última vez (ISO). */
export interface OfficeRecoverable {
  id: string
  name: string
  time: string
}

export interface OfficeUiApi {
  /** ``piece``: la versión del motor de oficina (para «Acerca de»). */
  env: { lang: 'es' | 'en'; locale: string; dark: boolean; kind: OfficeKind; version: string; piece: string; author: string }
  tabs(): Promise<OfficeTabs | null>
  activate(doc: string): Promise<boolean>
  closeTab(doc: string): Promise<boolean>
  openDialog(): Promise<boolean>
  /** «Guardar como»: pregunta dónde y con qué nombre. */
  saveAs(doc: string): Promise<boolean>
  /** Imprimir: el motor hace un PDF temporal y llega por ``onPrint`` para el cuadro de imprimir de esta app. */
  print(doc: string): Promise<boolean>
  /** Mis scripts de esta app (pestaña Programador). */
  scripts(): Promise<OfficeScript[]>
  /** Guarda uno (sin id, uno nuevo): su id, o null si no se pudo. */
  saveScript(script: { id?: string; name: string; code: string }): Promise<string | null>
  removeScript(id: string): Promise<boolean>
  /** Muestra el archivo en el Explorador (solo si tiene archivo propio). */
  showInFolder(doc: string): Promise<boolean>
  onPrint(listener: (pdf: DocDescriptor) => void): () => void
  /** Avisos y preguntas (al suscribirse, el proceso principal sabe que ya se pueden mostrar). */
  onAsk(listener: (ask: OfficeAsk) => void): () => void
  answer(id: number, response: number): void
  /** Cerrado el cuadro de imprimir: fuera el PDF temporal. */
  printClose(doc: string): Promise<boolean>
  /** Exportar una copia (pdf, txt, html, epub, ppsx): el documento sigue con sus cambios sin guardar. */
  exportDoc(doc: string, format: string): Promise<boolean>
  newDoc(): Promise<boolean>
  onTabs(listener: (tabs: OfficeTabs) => void): () => void
  /** Ha cambiado el tema (en cualquier ventana de Molino o en Windows): oscuro o no. */
  onTheme(listener: (dark: boolean) => void): () => void
  recent(): Promise<OfficeRecent[]>
  openRecent(id: string): Promise<boolean>
  forgetRecent(id: string): Promise<OfficeRecent[]>
  /** Documentos de la app con cambios sin guardar de un cierre inesperado. */
  recoverable(): Promise<OfficeRecoverable[]>
  recover(id: string): Promise<boolean>
  discardRecovery(id: string): Promise<OfficeRecoverable[]>
  /** Las fuentes que faltan en un documento y qué se puede hacer con cada una. */
  fontsInfo(doc: string): Promise<{ fonts: OfficeFontInfo[] }>
  /** Instala esas (del catálogo) solo en Molino; el documento se vuelve a abrir con ellas si no tiene cambios. */
  installFonts(doc: string, names: string[]): Promise<{ installed: string[]; failed: string[] }>
  /** Abre un aviso legal del motor de oficina (cambios de Molino, licencia de ONLYOFFICE, terceros, código). */
  legal(what: OfficeLegal): Promise<boolean>
  /** «Ahora no» (y, con ``forever``, no volver a avisar de esas fuentes). */
  dismissFonts(doc: string, forever: boolean): Promise<boolean>
  /** Cortar, copiar o pegar en el editor (como con el teclado), desde el menú del botón derecho de Molino. */
  clipboard(action: 'cut' | 'copy' | 'paste'): Promise<boolean>
  /** Copiar un texto de la interfaz (la página no tiene permiso de portapapeles). */
  copyText(text: string): Promise<boolean>
  /** Las plantillas para empezar de esta app (sus identificadores). */
  templates(): Promise<string[]>
  /** Un documento nuevo a partir de una plantilla. */
  fromTemplate(id: string): Promise<boolean>
  /** Abrir un vínculo del documento en el navegador (pregunta antes, con el destino). */
  openLink(url: string): Promise<boolean>
  /** La IA local de Molino (la de Ajustes → IA), sobre los documentos de esta ventana. */
  ai: {
    status(): Promise<{ on: boolean; ready: boolean }>
    /** Una operación de ops/officeai.py; ``call`` (positivo, distinto en cada una) sirve para cancelarla y para su avance. */
    run(call: number, doc: string, method: OfficeAiMethod, params: Record<string, unknown>): Promise<{ result?: Record<string, unknown>; error?: { code: string; message: string } }>
    cancel(call: number): void
    onProgress(listener: (progress: { call: number; done: number; total: number; message: string; text?: string }) => void): () => void
  }
}

export type OfficeAiMethod =
  | 'ai.officeTransform'
  | 'ai.officeWrite'
  | 'ai.officeSummarize'
  | 'ai.officeAsk'
  | 'ai.formula'
  | 'ai.explainFormula'
  | 'ai.dataSummary'
  | 'ai.slides'
  | 'ai.notes'
