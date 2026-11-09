/** Lo que comparten el proceso principal (officewin.ts) y la interfaz de Documentos, Hojas y Presentaciones. */

export type OfficeKind = 'word' | 'cell' | 'slide'

export interface OfficeTab {
  doc: string
  name: string
  /** Extensión sin punto (docx, xlsx…). */
  ext: string
  modified: boolean
  /** Tiene archivo propio (no es nuevo ni recuperado): «Guardar» guarda ahí; si no, pregunta dónde. */
  hasFile: boolean
}

export interface OfficeTabs {
  kind: OfficeKind
  active: string | null
  /** Se está abriendo algún documento (sin pestañas aún, la interfaz muestra «Abriendo…»). */
  opening: boolean
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
  env: { lang: 'es' | 'en'; locale: string; dark: boolean; kind: OfficeKind; version: string }
  tabs(): Promise<OfficeTabs | null>
  activate(doc: string): Promise<boolean>
  closeTab(doc: string): Promise<boolean>
  openDialog(): Promise<boolean>
  /** «Guardar como»: pregunta dónde y con qué nombre. */
  saveAs(doc: string): Promise<boolean>
  /** Imprimir, con el cuadro de imprimir de Molino PDF. */
  print(doc: string): Promise<boolean>
  newDoc(): Promise<boolean>
  onTabs(listener: (tabs: OfficeTabs) => void): () => void
  recent(): Promise<OfficeRecent[]>
  openRecent(id: string): Promise<boolean>
  forgetRecent(id: string): Promise<OfficeRecent[]>
  /** Documentos de la app con cambios sin guardar de un cierre inesperado. */
  recoverable(): Promise<OfficeRecoverable[]>
  recover(id: string): Promise<boolean>
  discardRecovery(id: string): Promise<OfficeRecoverable[]>
}
