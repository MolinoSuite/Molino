/** «Molino», el inicio común de la suite (src/main/home.ts y renderer/src/home): lo que comparten. */
import type { Os } from './i18n'
import type { OfficeKind } from './officeui'
import type { WhatsNewNotice } from './types'

export type HomeApp = OfficeKind | 'pdf'

/** Un reciente de cualquier app: nombre, carpeta y cuándo; la ruta se queda en el proceso principal. */
export interface HomeRecent {
  id: string
  app: HomeApp
  name: string
  folder: string
  openedAt: number
}

export interface HomeApi {
  env: { lang: 'es' | 'en'; locale: string; dark: boolean; os: Os }
  /** Las apps que se pueden usar (Molino PDF siempre; las demás, con el motor de oficina añadido). */
  apps(): Promise<Record<HomeApp, boolean>>
  recent(): Promise<HomeRecent[]>
  openRecent(id: string): Promise<boolean>
  forgetRecent(id: string): Promise<HomeRecent[]>
  /** Abre una app (su ventana, con su pantalla de inicio). */
  launch(app: HomeApp): Promise<boolean>
  /** Documento nuevo en Documentos, Hojas o Presentaciones. */
  create(app: OfficeKind): Promise<boolean>
  /** Elegir un archivo y abrirlo en su app (``pdf``: solo PDF e imágenes). */
  openDialog(only?: 'pdf'): Promise<boolean>
  /** Cambió algo que muestra el inicio (apps añadidas, recientes). */
  onChanged(listener: () => void): () => void
  /** Ha cambiado el tema: oscuro o no. */
  onTheme(listener: (dark: boolean) => void): () => void
  /** ¿Está Molino PDF instalado aparte? (Molino Suite ya lo incluye). «imported»: la suite trajo sus datos. */
  pdfApart(): Promise<'imported' | 'separate' | 'retired' | null>
  /** Desinstalarlo: «removed», o «settings» si se ha abierto Configuración para hacerlo allí. */
  removePdfApart(): Promise<'removed' | 'running' | 'settings' | null>
  /** Un aviso (p. ej. un reciente que ya no está), que el inicio muestra a su manera. */
  onNotice(listener: (text: string) => void): () => void
  /** Molino se ha actualizado: a qué versión, o null si no hay que avisar aquí (main/whatsnew.ts). */
  whatsNew(): Promise<WhatsNewNotice | null>
  /** «Ver novedades»: la página de esta versión (la dirección la arma el proceso principal). */
  openWhatsNew(): Promise<boolean>
  /** «Cerrar» el aviso de novedades: no vuelve a salir hasta la próxima versión. */
  dismissWhatsNew(): void
}
