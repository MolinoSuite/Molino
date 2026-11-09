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

export interface OfficeUiApi {
  env: { lang: 'es' | 'en'; locale: string; dark: boolean; kind: OfficeKind; version: string }
  tabs(): Promise<OfficeTabs | null>
  activate(doc: string): Promise<boolean>
  closeTab(doc: string): Promise<boolean>
  openDialog(): Promise<boolean>
  newDoc(): Promise<boolean>
  onTabs(listener: (tabs: OfficeTabs) => void): () => void
  recent(): Promise<OfficeRecent[]>
  openRecent(id: string): Promise<boolean>
  forgetRecent(id: string): Promise<OfficeRecent[]>
}
