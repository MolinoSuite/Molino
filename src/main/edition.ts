import { bundledPieceDir } from './office'

/**
 * Qué Molino es este: Molino Suite (trae Documentos, Hojas y Presentaciones, con
 * el motor de oficina dentro) o Molino PDF (solo el PDF). Los dos son el mismo
 * programa; lo distingue que el paquete traiga la pieza de oficina (office.ts).
 */
export const edition: 'suite' | 'pdf' = bundledPieceDir() ? 'suite' : 'pdf'

/** El nombre del producto, como en la Store. */
export const productName = edition === 'suite' ? 'Molino Suite' : 'Molino PDF'
