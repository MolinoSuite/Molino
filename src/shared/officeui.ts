/** Lo que comparten el proceso principal (officewin.ts) y la interfaz de Documentos, Hojas y Presentaciones. */
import type { OfficeLegal } from './office'

export type OfficeKind = 'word' | 'cell' | 'slide'

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
/** Dónde se instala una fuente: en Windows (para todos los programas) o solo en Molino. */
export type OfficeFontTarget = 'windows' | 'molino'

export type OfficeFontInfo =
  | { name: string; status: 'free'; license: 'ofl' | 'apache' | 'ufl'; size: number; files: number }
  | { name: string; status: 'microsoft'; substitute: string | null }
  | { name: string; status: 'unknown' }

export interface OfficeTabs {
  kind: OfficeKind
  active: string | null
  /** Se está abriendo algún documento (sin pestañas aún, la interfaz muestra «Abriendo…»). */
  opening: boolean
  /** Mientras se abre: la pieza nueva que se está instalando sola, y cuánto lleva. */
  updating: { phase: 'download' | 'install'; percent: number } | null
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
  /** Imprimir, con el cuadro de imprimir de Molino PDF. */
  print(doc: string): Promise<boolean>
  /** Exportar una copia (pdf, txt, html, epub, ppsx): el documento sigue con sus cambios sin guardar. */
  exportDoc(doc: string, format: string): Promise<boolean>
  newDoc(): Promise<boolean>
  onTabs(listener: (tabs: OfficeTabs) => void): () => void
  recent(): Promise<OfficeRecent[]>
  openRecent(id: string): Promise<boolean>
  forgetRecent(id: string): Promise<OfficeRecent[]>
  /** Documentos de la app con cambios sin guardar de un cierre inesperado. */
  recoverable(): Promise<OfficeRecoverable[]>
  recover(id: string): Promise<boolean>
  discardRecovery(id: string): Promise<OfficeRecoverable[]>
  /** Las fuentes que faltan en un documento, qué se puede hacer con cada una y dónde se pueden instalar (la primera, la propuesta). */
  fontsInfo(doc: string): Promise<{ targets: OfficeFontTarget[]; fonts: OfficeFontInfo[] }>
  /** Instala esas (del catálogo) en Windows o solo en Molino; el documento se vuelve a abrir con ellas si no tiene cambios. */
  installFonts(doc: string, names: string[], into: OfficeFontTarget): Promise<{ installed: string[]; failed: string[] }>
  /** Abre un aviso legal del motor de oficina (cambios de Molino, licencia de ONLYOFFICE, terceros, código). */
  legal(what: OfficeLegal): Promise<boolean>
  /** «Ahora no» (y, con ``forever``, no volver a avisar de esas fuentes). */
  dismissFonts(doc: string, forever: boolean): Promise<boolean>
  /** Cortar, copiar o pegar en el editor (como con el teclado), desde el menú del botón derecho de Molino. */
  clipboard(action: 'cut' | 'copy' | 'paste'): Promise<boolean>
  /** Las plantillas para empezar de esta app (sus identificadores). */
  templates(): Promise<string[]>
  /** Un documento nuevo a partir de una plantilla. */
  fromTemplate(id: string): Promise<boolean>
  /** Abrir un vínculo del documento en el navegador (pregunta antes, con el destino). */
  openLink(url: string): Promise<boolean>
  /** La IA local de Molino (la de Ajustes → IA), sobre los documentos de esta ventana. */
  ai: {
    status(): Promise<{ on: boolean; ready: boolean }>
    /** Abre Molino PDF en Ajustes → IA (para activarla o descargar el modelo). */
    settings(): Promise<boolean>
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
