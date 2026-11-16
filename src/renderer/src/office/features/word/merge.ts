/**
 * Combinar correspondencia: crear las copias (MailMergePanel.tsx).
 *
 * El editor hace cada copia como al combinar en ONLYOFFICE: un documento aparte
 * con los campos cambiados por los datos de la fila (y, con varias filas, cada
 * una en su página). Aquí se pide en su formato de trabajo; el proceso principal
 * pregunta dónde va y el motor la escribe con x2t (office.saveCopy). El
 * documento abierto no cambia: ni su contenido, ni sus cambios sin guardar, ni
 * su archivo. Lo que se está creando vive aquí, por documento: el panel lo
 * enseña aunque se cambie de pestaña y se vuelva.
 */
import { useSyncExternalStore } from 'react'
import type { OfficeMergeMode } from '@shared/officeui'
import { fmt, L } from '../../i18n'
import type { Api } from '../types'

const M = L.officeWord.mailMerge

// --------------------------------------------------------- la copia del editor

/**
 * Los nombres (internos) de lo que usa el editor para combinar: su documento,
 * cómo hace el documento combinado y cómo lo escribe. La API pública solo manda
 * el documento combinado a un servidor de documentos (asc_DownloadAsMailMerge,
 * que Molino no tiene); estas piezas no tienen nombre público, así que se leen
 * de esa función y de asc_nativeGetFile: no dependen de cómo se compiló el editor.
 */
function internals(api: Api): { control: string; logic: string; merged: string } | null {
  try {
    const download = String(api.asc_DownloadAsMailMerge ?? '')
    const getFile = String(api.asc_nativeGetFile ?? '')
    // «… = this.WordControl.m_oLogicDocument.Get_MailMergedDocument(StartIndex, EndIndex)»
    const merged = /=\s*this\.([\w$]+)\.([\w$]+)\.([\w$]+)\(/.exec(download)
    // «return (new AscCommonWord.BinaryFileWriter(this.WordControl.m_oLogicDocument)).Write()»
    const written = /new\s+AscCommonWord\.[\w$]+\(\s*this\.([\w$]+)\.([\w$]+)\s*\)/.exec(getFile)
    if (!merged || !written || merged[1] !== written[1] || merged[2] !== written[2]) return null
    return { control: merged[1], logic: merged[2], merged: merged[3] }
  } catch {
    return null
  }
}

/** ¿Puede este editor hacer las copias? */
export function canMerge(api: Api): boolean {
  return internals(api) !== null
}

/**
 * Una copia con las filas ``from``…``to`` (desde 0) en el formato de trabajo
 * del editor («DOCY;v5;<bytes>;<base64>»), o null. El editor hace un documento
 * nuevo (no toca el abierto) y lo escribe como su propio documento al guardar.
 */
export function mergedCopy(api: Api, from: number, to: number): string | null {
  const names = internals(api)
  if (!names) return null
  const logic = api[names.control]?.[names.logic]
  if (!logic || typeof logic[names.merged] !== 'function') return null
  const merged = logic[names.merged](from, to)
  if (!merged) return null
  const data: unknown = api.asc_nativeGetFile.call({ [names.control]: { [names.logic]: merged } })
  return typeof data === 'string' && /^DOCY;v\d{1,3};\d{1,10};/.test(data) ? data : null
}

// ------------------------------------------------------------------ nombres

/** Un nombre de archivo (sin extensión): sin lo que Windows no admite ni nombres reservados (CON, PRN…). */
export function cleanName(raw: string): string {
  const text = raw
    .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/^[ .]+/, '')
    .slice(0, 120)
    .replace(/[ .]+$/, '')
  return !text || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(text.split('.')[0]) ? '' : text
}

/**
 * El nombre de cada copia de las filas ``from``…``to`` (desde 0): el valor de la
 * columna ``column`` en su fila, limpio; si está vacío, «Destinatario 3»; si se
 * repite, «Ana (2)», «Ana (3)»… Se cuenta desde la primera fila de la lista: la
 * misma fila se llama igual aunque se cree solo un tramo.
 */
export function copyNames(list: string[][], column: number, from: number, to: number): string[] {
  const used = new Set<string>()
  const out: string[] = []
  for (let i = 0; i <= to; i++) {
    const base = cleanName(String(list[i + 1]?.[column] ?? '')) || fmt(M.fallbackName, { n: i + 1 })
    let name = base
    for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base} (${n})`
    used.add(name.toLowerCase())
    if (i >= from) out.push(name)
  }
  return out
}

// ------------------------------------------------------------ lo que se crea

export interface MergeRun {
  mode: OfficeMergeMode
  phase: 'asking' | 'preparing' | 'writing' | 'done' | 'cancelled' | 'error'
  done: number
  total: number
  /** Dónde (la carpeta o el archivo), para decirlo al terminar. */
  where: string
  error: string
  /** En el proceso principal, mientras se puede «Mostrar en la carpeta». */
  job: number | null
  cancel: boolean
}

const runs = new Map<string, MergeRun>()
const listeners = new Set<() => void>()
const changed = (doc: string, patch: Partial<MergeRun>): void => {
  const run = runs.get(doc)
  if (!run) return
  runs.set(doc, { ...run, ...patch })
  for (const listener of listeners) listener()
}
/** Para que el panel pinte la barra antes de que el editor se ponga a trabajar. */
const paint = (): Promise<void> => new Promise((done) => requestAnimationFrame(() => setTimeout(done, 0)))

/** Lo que se está creando (o se acaba de crear) para ese documento. */
export function useMergeRun(doc: string): MergeRun | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => runs.get(doc) ?? null
  )
}

/**
 * Crea las copias de las filas ``from``…``to`` (desde 0): pregunta dónde (el
 * proceso principal) y, una a una (o todas juntas), las pide al editor y se las
 * da al motor. Se puede cancelar entre una y otra (y la que se está guardando).
 */
export async function startMerge(api: Api, doc: string, mode: OfficeMergeMode, format: 'docx' | 'pdf', from: number, to: number, names: string[]): Promise<void> {
  const current = runs.get(doc)
  if (current && ['asking', 'preparing', 'writing'].includes(current.phase)) return
  const total = to - from + 1
  runs.set(doc, { mode, phase: 'asking', done: 0, total, where: '', error: '', job: null, cancel: false })
  changed(doc, {})
  const merge = window.molinoOffice.merge
  const begun = await merge.begin(doc, mode, format, mode === 'files' ? names : [])
  if (!begun) {
    runs.delete(doc)
    for (const listener of listeners) listener()
    return
  }
  changed(doc, { job: begun.job, where: begun.where, phase: 'preparing' })
  const fail = async (error: string): Promise<void> => {
    await merge.end(begun.job, false)
    changed(doc, { phase: 'error', error, job: null })
  }
  try {
    if (mode === 'files') {
      for (let i = 0; i < total; i++) {
        if (runs.get(doc)?.cancel) break
        await paint()
        const data = mergedCopy(api, from + i, from + i)
        if (!data) return await fail(M.failed)
        changed(doc, { phase: 'writing' })
        const written = await merge.write(begun.job, i, data)
        if (!written.ok) {
          if (runs.get(doc)?.cancel) break
          return await fail(written.error || M.failed)
        }
        changed(doc, { done: i + 1 })
      }
    } else {
      await paint()
      const data = mergedCopy(api, from, to)
      if (!data) return await fail(M.failed)
      changed(doc, { phase: 'writing' })
      const written = await merge.write(begun.job, 0, data)
      if (!written.ok) {
        if (!runs.get(doc)?.cancel) return await fail(written.error || M.failed)
      } else changed(doc, { done: total })
    }
  } catch (error) {
    console.error('combinar correspondencia:', error)
    return await fail(M.failed)
  }
  const run = runs.get(doc)
  const cancelled = Boolean(run?.cancel) && (run?.done ?? 0) < total
  // Lo creado (aunque se haya cancelado a medias) se puede enseñar en el Explorador. Al
  // imprimir, el cuadro de imprimir ya está abierto: no hay nada más que enseñar.
  const keep = mode !== 'print' && (run?.done ?? 0) > 0
  if (!keep) await merge.end(begun.job, false)
  changed(doc, { phase: cancelled ? 'cancelled' : 'done', job: keep ? begun.job : null })
}

/** Cancela lo que se está creando (la copia que se está guardando, también). */
export function cancelMerge(doc: string): void {
  const run = runs.get(doc)
  if (!run || run.cancel) return
  changed(doc, { cancel: true })
  if (run.job !== null) window.molinoOffice.merge.cancel(run.job)
}

/** Fuera el aviso de lo creado; con ``show``, antes lo enseña en el Explorador. */
export async function closeMerge(doc: string, show: boolean): Promise<void> {
  const run = runs.get(doc)
  if (!run || ['asking', 'preparing', 'writing'].includes(run.phase)) return
  runs.delete(doc)
  for (const listener of listeners) listener()
  if (run.job !== null) await window.molinoOffice.merge.end(run.job, show)
}
