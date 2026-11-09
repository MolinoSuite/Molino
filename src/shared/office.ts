/**
 * Tipos del motor de oficina (la pieza que necesitan Documentos, Hojas y
 * Presentaciones) que comparten el proceso principal y la interfaz.
 */

export interface OfficeStatus {
  /** Esta versión de Molino ofrece añadirla (no, mientras las apps no estén listas). */
  available: boolean
  /** Instalada, completa y en la versión de este Molino. */
  installed: boolean
  /** Hay una versión anterior instalada y este Molino trae otra. */
  update: boolean
  /** Bytes de la descarga. */
  size: number
  /** Bytes que ocupa instalada. */
  unpacked: number
  /** Espacio libre en el disco donde se instala, en bytes. */
  freeDisk: number
  /** Se está descargando o instalando. */
  busy: boolean
  /** Molino pone sus apps en Windows (menú Inicio, tipos de archivo): no en la portable ni en la de la Store. */
  shell: boolean
}

export type OfficeApp = 'word' | 'cell' | 'slide'

export interface OfficeProgress {
  /** Primero se descarga (bytes) y después se instala (archivos). */
  phase: 'download' | 'install'
  done: number
  total: number
}

/** Motivo de un fallo al añadir la pieza. */
export type OfficeFailure = 'disk' | 'integrity' | 'network' | 'cancelled' | 'restart' | 'install'
