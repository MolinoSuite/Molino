import { getDoc, useApp } from './app'

/** Abre el cuadro de imprimir de Molino PDF, con todas las páginas o con las indicadas ya elegidas. */
export function printDoc(docId: string, pages?: string[]): void {
  if (!getDoc(docId)) return
  useApp.getState().openDialog({ type: 'custom', id: 'print', doc: docId, data: pages ? { pages } : undefined })
}
