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
  /** Pide además una contraseña (la de un documento cifrado): su etiqueta. */
  password?: string
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
  /** Se guarda cifrado, con contraseña. */
  locked: boolean
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

/**
 * Combinar correspondencia: cómo se crean las copias. «single»: todas en un
 * documento; «files»: una por fila, cada una en su archivo; «print»: todas, a
 * la impresora (con el cuadro de imprimir de la app).
 */
export type OfficeMergeMode = 'single' | 'files' | 'print'

/** Otro documento (que no está abierto) para comparar o combinar: su nombre, su contenido y sus imágenes. */
export interface OfficeOtherDocument {
  name: string
  /** En el formato de trabajo del editor (Editor.bin). */
  data: Uint8Array
  /** «media/image1.png» → el nombre que tiene ahora entre las imágenes de este documento. */
  images: Record<string, string>
}

/** Una pantalla del equipo, para elegir dónde se ve la presentación (Presentaciones). */
export interface PresenterScreen {
  id: number
  /** Su nombre y su tamaño («Pantalla 2 · 1920 × 1080»). */
  label: string
  primary: boolean
}

/** Cómo empezar a presentar (Presentaciones). */
export interface PresenterStart {
  /** Con dos pantallas o más, la vista del moderador en la de Molino (si no, solo la presentación en la otra). */
  presenter: boolean
  /** La pantalla de la presentación (null: la automática, la que no es la principal). */
  screen: number | null
  /** Con una sola pantalla, la vista del moderador también (para ensayar, como Alt+F5 en PowerPoint). */
  rehearse: boolean
  /** El color de la app (#rrggbb), para la vista del moderador. */
  accent: string
}

/** Lo que enseña la vista del moderador (lo manda la ventana de Presentaciones). */
export interface PresenterState {
  /** El nombre del documento. */
  title: string
  /** La diapositiva que se ve (desde 0) y cuántas hay. */
  index: number
  count: number
  /** Se ha pasado de la última: la pantalla del final. */
  finished: boolean
  /** Las notas del orador de la que se ve. */
  notes: string
  /** Su imagen (data:image/jpeg o png). */
  current: string | null
  /** La siguiente que se verá (null: no hay más) y su imagen. */
  next: { index: number; image: string | null } | null
}

/** Lo que pide la vista del moderador a la presentación. */
export type PresenterAction = 'next' | 'prev' | 'first' | 'last' | 'goto' | 'end'

/** Los colores de la tinta (bolígrafo y rotulador): solo estos (officepresenter.ts lo comprueba). */
export const INK_COLORS = ['red', 'yellow', 'green', 'blue', 'black', 'white'] as const
export type InkColor = (typeof INK_COLORS)[number]
/** Las herramientas que dibujan: el bolígrafo y el rotulador de resaltar. */
export type InkTool = 'pen' | 'highlighter'
/** Un trazo: sus puntos en proporción de la diapositiva (x0, y0, x1, y1…, de 0 a 1) y su grosor (1 a 3). */
export interface InkStroke {
  id: string
  tool: InkTool
  color: InkColor
  width: 1 | 2 | 3
  points: number[]
}
/** Un cambio en la tinta de una diapositiva (desde 0; la del final: el número de diapositivas). */
export type InkOp =
  | { op: 'begin'; slide: number; stroke: InkStroke }
  | { op: 'add'; slide: number; id: string; points: number[] }
  | { op: 'erase'; slide: number; ids: string[] }
  | { op: 'clear'; slide: number }

/**
 * Lo que se dibuja encima de la presentación (no se guarda en el archivo): la
 * tinta, el puntero láser (null: no está) y la pantalla en negro o en blanco
 * (null: se ve la presentación). Va de la vista del moderador a la ventana de la
 * presentación y al revés; ``sync``, toda la tinta de la diapositiva que se ve,
 * solo de la ventana de la presentación a la vista del moderador.
 */
export type PresenterMark =
  | { kind: 'ink'; op: InkOp }
  | { kind: 'laser'; at: { x: number; y: number } | null }
  | { kind: 'screen'; screen: 'black' | 'white' | null }
  | { kind: 'sync'; slide: number; strokes: InkStroke[] }

/** La vista del moderador (su página, presenter.html; preload/office.ts). */
export interface PresenterApi {
  /** La página ya escucha: que le llegue lo último. */
  ready(): void
  command(action: PresenterAction, slide?: number): void
  onState(listener: (state: PresenterState) => void): () => void
  /** Tinta, láser o pantalla en negro, hacia la presentación. */
  mark(mark: PresenterMark): void
  /** Lo que llega de la presentación (también lo hecho allí). */
  onMark(listener: (mark: PresenterMark) => void): () => void
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
  answer(id: number, response: number, password?: string): void
  /**
   * Pone, cambia o quita (null) la contraseña del documento y, si tiene archivo,
   * lo guarda ya cifrado. «saved»: guardado; si no, se cifrará al guardarlo.
   */
  setPassword(doc: string, password: string | null): Promise<{ ok: boolean; saved: boolean }>
  /** Cerrado el cuadro de imprimir: fuera el PDF temporal. */
  printClose(doc: string): Promise<boolean>
  /** Exportar una copia (pdf, pdfa, txt, html, epub, ppsx): el documento sigue con sus cambios sin guardar. */
  exportDoc(doc: string, format: string): Promise<boolean>
  /**
   * «Firmar…»: guarda una copia en PDF/A (``pdfa``) o PDF, junto al documento
   * (``here``) o donde diga el usuario, y la abre en Molino PDF para firmarla.
   */
  signDoc(doc: string, options: { pdfa: boolean; here: boolean }): Promise<boolean>
  /** Comparar o combinar con un documento que no está abierto: se elige (cuadro de Windows) y llega convertido; null si no. */
  compareFile(doc: string): Promise<OfficeOtherDocument | null>
  /**
   * Combinar correspondencia: las copias que hace el editor, guardadas por el
   * motor sin tocar el documento. ``begin`` pregunta dónde (las rutas se quedan
   * en el proceso principal; la interfaz recibe un número y el nombre de la
   * carpeta o del archivo); ``write``, cada copia (``names[index]`` en «files»);
   * ``end`` termina y, con ``show``, enseña lo creado en el Explorador.
   */
  merge: {
    begin(doc: string, mode: OfficeMergeMode, format: 'docx' | 'pdf', names: string[]): Promise<{ job: number; where: string } | null>
    write(job: number, index: number, data: string): Promise<{ ok: boolean; error?: string }>
    cancel(job: number): void
    end(job: number, show: boolean): Promise<boolean>
  }
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
  /**
   * Presentar con la vista del moderador (Presentaciones): la presentación, a
   * pantalla completa en la otra pantalla, y la vista del moderador en esta.
   */
  presenter: {
    /** Las pantallas del equipo (en orden). */
    screens(): Promise<PresenterScreen[]>
    /** Avisa cuando se conecta o se quita una pantalla. */
    onScreens(listener: (screens: PresenterScreen[]) => void): () => void
    /** Antes de empezar: mueve la ventana a su pantalla y abre la vista del moderador (``presenter``: si se ha abierto). */
    start(doc: string, options: PresenterStart): Promise<{ presenter: boolean }>
    /** Lo que enseña la vista del moderador. */
    state(doc: string, state: PresenterState): void
    /** Se ha terminado: se cierra la vista del moderador y la ventana vuelve a su sitio. */
    end(doc: string): void
    /** Lo que pide la vista del moderador. */
    onCommand(listener: (command: { doc: string; action: PresenterAction; slide?: number }) => void): () => void
    /** Tinta, láser o pantalla en negro, hacia la vista del moderador. */
    mark(doc: string, mark: PresenterMark): void
    /** Lo que llega de la vista del moderador. */
    onMark(listener: (event: { doc: string; mark: PresenterMark }) => void): () => void
    /** La vista del moderador se ha abierto (o se ha vuelto a cargar): que le llegue lo que hay dibujado. */
    onReady(listener: (doc: string) => void): () => void
  }
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
