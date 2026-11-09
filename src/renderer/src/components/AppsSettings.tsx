import { Download, ExternalLink, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import type { OfficeApp } from '@shared/office'
import { Checkbox, Field } from '@/components/ui'
import { fmt, L, locale } from '@/i18n'
import { updateSettings } from '@/state/actions'
import { sizeText } from '@/state/ai'
import { useApp } from '@/state/app'
import { addOffice, useOffice } from '@/state/office'

const OFFICE_APPS: OfficeApp[] = ['word', 'cell', 'slide']

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
  const shown = useApp((s) => s.settings.officeApps)
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
          <>
            {/* Cada app: si sale en Windows (menú Inicio, «Abrir con»), abrirla y elegirla para sus archivos. */}
            <div className="office-apps">
              {OFFICE_APPS.map((app) => (
                <div key={app} className="row">
                  <span className="grow">
                    <Checkbox checked={shown[app]} onChange={(checked) => void updateSettings({ officeApps: { ...shown, [app]: checked } })}>
                      {T.names[app]}
                    </Checkbox>
                  </span>
                  {status.shell && shown[app] && (
                    <button className="btn sm ghost" aria-label={fmt(T.defaultAppsTip, { name: T.names[app] })} onClick={() => void window.molino.office.defaultApps(app)}>
                      <ExternalLink size={13} />
                      {T.defaultApps}
                    </button>
                  )}
                  <button className="btn sm" aria-label={`${T.open} ${T.names[app]}`} onClick={() => void window.molino.office.launch(app)}>
                    {T.open}
                  </button>
                </div>
              ))}
            </div>
            <span className="hint">{status.shell ? T.shown : T.shownPortable}</span>
            <div className="row">
              <span className="hint grow">{T.home}</span>
              <button className="btn sm" aria-label={`${T.open} Molino`} onClick={() => void window.molino.office.launch('home')}>
                {T.open}
              </button>
            </div>
            <div className="row">
              <button className="btn sm ghost" onClick={() => setConfirmRemove(true)}>
                <Trash2 size={14} />
                {T.remove}
              </button>
            </div>
          </>
        )}
        {error && !busy && <span className="error-text">{T.errors[error]}</span>}
        <span className="hint">{T.basedOn}</span>
      </Field>
    </>
  )
}
