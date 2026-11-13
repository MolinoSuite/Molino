import { rmSync } from 'node:fs'
import { ipcMain, type BrowserWindow, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import { z } from 'zod'
import type { DocDescriptor, EngineErrorInfo, Envelope } from '@shared/types'
import { EngineError, type EngineClient } from './engine'
import { L } from './i18n'
import { log } from './log'
import type { PrintService } from './print'
import { DocId, PageId, PrintStartSchema } from './printschema'

/**
 * Imprimir en Documentos, Hojas y Presentaciones, dentro de cada app: el motor
 * hace un PDF temporal del documento (officewin.ts) y la propia ventana muestra
 * el mismo cuadro de imprimir que Molino PDF, con su vista previa. No se abre
 * ninguna otra app.
 *
 * La interfaz de esa ventana (nunca los editores que lleva dentro) solo puede
 * dibujar páginas e imprimir los PDF temporales que se abrieron para ella.
 */

interface PrintDoc {
  window: BrowserWindow
  /** Carpeta temporal del PDF (se borra al cerrar el cuadro). */
  folder: string
}

const RenderRequest = z.object({
  method: z.literal('page.render'),
  params: z.object({
    doc: DocId,
    page: PageId,
    scale: z.number().positive().max(20),
    annots: z.boolean().optional()
  }),
  priority: z.number().min(0).max(10).optional()
})

function fail(error: unknown): { ok: false; error: EngineErrorInfo } {
  if (error instanceof EngineError) return { ok: false, error: error.toInfo() }
  log.warn(`imprimir (oficina): ${error instanceof Error ? error.name : 'error'}`)
  return { ok: false, error: { code: 'internal', message: L.main.errors.unexpected } }
}

export class OfficePrint {
  private readonly docs = new Map<string, PrintDoc>()
  /** Cancelar lo que se está preparando, por ventana y llamada. */
  private readonly cancels = new Map<string, () => void>()

  constructor(
    private readonly engine: EngineClient,
    private readonly printer: PrintService,
    /** La ventana de una app si lo pide la página de su interfaz (officewin.ts). */
    private readonly windowOf: (event: IpcMainEvent | IpcMainInvokeEvent) => BrowserWindow | null
  ) {
    this.register()
  }

  /** Abre el PDF temporal y lo manda a la interfaz de la ventana, que muestra el cuadro de imprimir. */
  async show(window: BrowserWindow, path: string, folder: string): Promise<boolean> {
    try {
      const { result } = await this.engine.request<DocDescriptor>('doc.open', { path }, { priority: 9 })
      if (window.isDestroyed()) {
        await this.close(result.doc)
        return false
      }
      this.docs.set(result.doc, { window, folder })
      window.webContents.send('office:printOpen', result)
      return true
    } catch (error) {
      log.warn(`imprimir (oficina): no se pudo abrir el PDF (${error instanceof EngineError ? error.code : '?'})`)
      rmSync(folder, { recursive: true, force: true, maxRetries: 2 })
      return false
    }
  }

  /** Cierra lo que quedara de una ventana (al cerrarla). */
  closeWindow(window: BrowserWindow): void {
    for (const [doc, entry] of this.docs) if (entry.window === window) void this.close(doc)
  }

  private async close(doc: string): Promise<void> {
    const entry = this.docs.get(doc)
    this.docs.delete(doc)
    await this.engine.request('doc.close', { doc }, { priority: 9 }).catch(() => undefined)
    if (entry) rmSync(entry.folder, { recursive: true, force: true, maxRetries: 2 })
  }

  /** El documento, si es uno de los que se abrieron para imprimir en la ventana que lo pide. */
  private owned(event: IpcMainEvent | IpcMainInvokeEvent, doc: string): BrowserWindow | null {
    const window = this.windowOf(event)
    return window && this.docs.get(doc)?.window === window ? window : null
  }

  private register(): void {
    // Las miniaturas de la vista previa.
    ipcMain.handle('office:printRender', async (event, raw: unknown): Promise<Envelope<{ result: unknown; binary?: Uint8Array }>> => {
      const parsed = RenderRequest.safeParse(raw)
      if (!parsed.success || !this.owned(event, parsed.data.params.doc)) {
        return { ok: false, error: { code: 'forbidden', message: L.main.errors.forbiddenOperation } }
      }
      try {
        const reply = await this.engine.request('page.render', parsed.data.params, { priority: Math.min(parsed.data.priority ?? 2, 4) })
        return { ok: true, value: { result: reply.result, binary: reply.binary } }
      } catch (error) {
        return fail(error)
      }
    })

    ipcMain.handle('office:printers', async (event) => {
      const window = this.windowOf(event)
      if (!window) return { ok: false, error: { code: 'forbidden', message: L.main.errors.forbiddenOperation } }
      try {
        return { ok: true, value: await this.printer.printers(window) }
      } catch (error) {
        return fail(error)
      }
    })

    ipcMain.handle('office:printStart', async (event, raw: unknown): Promise<Envelope<null>> => {
      const parsed = PrintStartSchema.safeParse(raw)
      const window = parsed.success ? this.owned(event, parsed.data.doc) : null
      if (!parsed.success || !window) return { ok: false, error: { code: 'forbidden', message: L.main.errors.forbiddenOperation } }
      const { doc, pages, request, callId } = parsed.data
      const key = `${event.sender.id}:${callId ?? 0}`
      const controller = new AbortController()
      if (callId !== undefined) this.cancels.set(key, () => controller.abort())
      try {
        await this.printer.print(window, doc, pages, request, {
          signal: controller.signal,
          onProgress:
            callId === undefined
              ? undefined
              : (done, total) => {
                  if (!window.isDestroyed()) window.webContents.send('engine:progress', { callId, done, total, message: '' })
                }
        })
        return { ok: true, value: null }
      } catch (error) {
        return fail(error)
      } finally {
        if (callId !== undefined) this.cancels.delete(key)
      }
    })

    ipcMain.on('office:printCancel', (event, raw: unknown) => {
      if (!this.windowOf(event) || typeof raw !== 'number') return
      this.cancels.get(`${event.sender.id}:${raw}`)?.()
    })

    ipcMain.handle('office:printClose', async (event, raw: unknown) => {
      if (typeof raw !== 'string' || !this.owned(event, raw)) return false
      await this.close(raw)
      return true
    })
  }
}
