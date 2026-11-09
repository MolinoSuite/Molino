import { Download, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { Field } from '@/components/ui'
import { fmt, L, locale } from '@/i18n'
import { sizeText } from '@/state/ai'
import { addOffice, useOffice } from '@/state/office'

/**
 * Ajustes → Aplicaciones: Molino PDF siempre está; Documentos, Hojas y
 * Presentaciones se añaden (una sola descarga, el motor de oficina) y se
 * pueden quitar. Nada se descarga hasta que el usuario lo pide.
 */
export function AppsSettings() {
  const status = useOffice((s) => s.status)
  const progress = useOffice((s) => s.progress)
  const error = useOffice((s) => s.error)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const T = L.dialogs.settings.apps
  const size = (bytes: number): string => sizeText(bytes, locale)
  if (!status) return null

  const busy = status.busy || progress !== null
  // Hace falta sitio para la descarga y para descomprimirla.
  const needed = status.size + status.unpacked
  const noDisk = !status.installed && status.freeDisk < needed
  const percent = progress ? (progress.done / Math.max(progress.total, 1)) * 100 : 0

  return (
    <>
      <Field label={T.title}>
        <span className="hint">{T.intro}</span>
      </Field>
      <Field label={T.pdf}>
        <div className="row">
          <span className="hint grow">{T.pdfHint}</span>
          <span className="ok">{T.installed}</span>
        </div>
      </Field>
      <Field label={T.office}>
        <div className="row">
          <span className="hint grow">{fmt(T.officeHint, { size: size(status.size), unpacked: size(status.unpacked) })}</span>
          {status.installed && <span className="ok">{T.added}</span>}
        </div>
        {busy ? (
          <div className="ai-download">
            <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}>
              <div style={{ width: `${percent}%` }} />
            </div>
            <div className="row">
              <span className="hint grow">
                {progress?.phase === 'download'
                  ? fmt(T.downloading, { done: size(progress.done), total: size(progress.total) })
                  : progress?.phase === 'install'
                    ? fmt(T.installing, { done: progress.done.toLocaleString(locale), total: progress.total.toLocaleString(locale) })
                    : ''}
              </span>
              <button className="btn sm" onClick={() => void window.molino.office.cancel()}>
                <X size={13} />
                {T.cancel}
              </button>
            </div>
          </div>
        ) : !status.installed ? (
          <>
            {status.update && <span className="hint">{T.updateHint}</span>}
            <div className="row">
              <button className="btn sm primary" disabled={noDisk} onClick={addOffice}>
                <Download size={14} />
                {fmt(status.update ? T.update : T.add, { size: size(status.size) })}
              </button>
              {noDisk && <span className="error-text">{fmt(T.noDisk, { size: size(needed) })}</span>}
            </div>
          </>
        ) : confirmRemove ? (
          <div className="ai-confirm">
            <span>{fmt(T.removeConfirm, { size: size(status.unpacked) })}</span>
            <div className="row">
              <button
                className="btn sm danger"
                onClick={() => {
                  setConfirmRemove(false)
                  void window.molino.office.remove()
                }}
              >
                {T.remove}
              </button>
              <button className="btn sm ghost" onClick={() => setConfirmRemove(false)}>
                {L.common.cancel}
              </button>
            </div>
          </div>
        ) : (
          <div className="row">
            <button className="btn sm ghost" onClick={() => setConfirmRemove(true)}>
              <Trash2 size={14} />
              {T.remove}
            </button>
          </div>
        )}
        {error && !busy && <span className="error-text">{T.errors[error]}</span>}
        <span className="hint">{T.basedOn}</span>
      </Field>
    </>
  )
}
