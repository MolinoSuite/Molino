/** Lo que comparten el proceso principal (officewin.ts) y la interfaz de Documentos, Hojas y Presentaciones. */

export type OfficeKind = 'word' | 'cell' | 'slide'

export interface OfficeTab {
  doc: string
  name: string
  /** Extensión sin punto (docx, xlsx…). */
  ext: string
  modified: boolean
}

export interface OfficeTabs {
  kind: OfficeKind
  active: string | null
  tabs: OfficeTab[]
}

export interface OfficeUiApi {
  env: { lang: 'es' | 'en'; locale: string; dark: boolean; kind: OfficeKind; version: string }
  tabs(): Promise<OfficeTabs | null>
  activate(doc: string): Promise<boolean>
  closeTab(doc: string): Promise<boolean>
  openDialog(): Promise<boolean>
  newDoc(): Promise<boolean>
  onTabs(listener: (tabs: OfficeTabs) => void): () => void
}
