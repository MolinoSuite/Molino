/**
 * Tipos del motor de oficina (la pieza que necesitan Documentos, Hojas y
 * Presentaciones) que comparten el proceso principal y la interfaz.
 */

export interface OfficeStatus {
  /** Este Molino trae Documentos, Hojas y Presentaciones (Molino Suite; Molino PDF no). */
  available: boolean
  /** Versión del motor de oficina, si lo trae. */
  version: string | null
}

export type OfficeApp = 'word' | 'cell' | 'slide'

/**
 * Los avisos legales del motor de oficina (AGPL y términos del §7 de
 * ONLYOFFICE): los cambios de Molino, la licencia de ONLYOFFICE, los componentes
 * de terceros, el código de cómo se arma y el de ONLYOFFICE de esa versión.
 */
export type OfficeLegal = 'notice' | 'license' | 'thirdParty' | 'source' | 'original'
