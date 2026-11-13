import { z } from 'zod'

/**
 * Lo que la interfaz puede pedir al imprimir, con cada valor acotado. Lo usan
 * Molino PDF (ipc.ts) y Documentos, Hojas y Presentaciones (officeprint.ts).
 */

export const DocId = z.string().regex(/^d[0-9a-f]{16}$/)
export const PageId = z.string().regex(/^p[0-9]{1,9}$/)
export const CallId = z.number().int().positive().max(2_000_000_000)

/** Composición de las hojas al imprimir (src/shared/printLayout.ts). */
export const PrintLayoutSchema = z.object({
  mode: z.enum(['size', 'multiple', 'booklet', 'poster']),
  paper: z.enum(['document', 'A4', 'A3', 'A5', 'Letter', 'Legal', 'Tabloid']),
  orientation: z.enum(['auto', 'portrait', 'landscape']),
  scale: z.enum(['fit', 'actual', 'shrink', 'custom']),
  customScale: z.number().min(10).max(400),
  perSheet: z.union([z.literal(2), z.literal(4), z.literal(6), z.literal(9), z.literal(16)]),
  order: z.enum(['horizontal', 'vertical']),
  borders: z.boolean(),
  fill: z.boolean(),
  bookletSides: z.enum(['both', 'front', 'back']),
  posterScale: z.number().min(110).max(400)
})

/** «Imprimir»: la impresora se comprueba además contra las instaladas (print.ts). */
export const PrintStartSchema = z.object({
  doc: DocId,
  pages: z.array(PageId).min(1).max(20000),
  request: z.discriminatedUnion('mode', [
    z.object({
      mode: z.literal('molino'),
      printer: z.string().min(1).max(260),
      copies: z.number().int().min(1).max(99),
      color: z.boolean(),
      duplex: z.enum(['simplex', 'longEdge', 'shortEdge']),
      layout: PrintLayoutSchema
    }),
    z.object({ mode: z.literal('system'), layout: PrintLayoutSchema })
  ]),
  callId: CallId.optional()
})
