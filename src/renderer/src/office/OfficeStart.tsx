/**
 * La pantalla de inicio de Documentos, Hojas o Presentaciones: la que se ve al
 * abrir la app desde el menú Inicio (sin documento) o al cerrar la última
 * pestaña, como la de Molino PDF. Nuevo, abrir y los recientes de la app.
 */
import { FilePlus2, FileText, FolderOpen, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { OfficeKind, OfficeRecent } from '@shared/officeui'
import { ICONS } from './icons'
import { env, fmt, L } from './i18n'

const S = L.office.start
const relative = new Intl.RelativeTimeFormat(env.locale, { numeric: 'auto' })

/** Hace cuánto (como en Molino PDF: «hace 5 minutos», «ayer»…). */
function formatWhen(timestamp: number): string {
  const minutes = Math.round((timestamp - Date.now()) / 60000)
  if (Math.abs(minutes) < 1) return L.state.when.now
  if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return relative.format(hours, 'hour')
  const days = Math.round(hours / 24)
  if (Math.abs(days) < 30) return relative.format(days, 'day')
  return new Date(timestamp).toLocaleDateString(env.locale, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function OfficeStart({ kind }: { kind: OfficeKind }) {
  const [recent, setRecent] = useState<OfficeRecent[] | null>(null)
  const refresh = useCallback(() => void window.molinoOffice.recent().then(setRecent), [])
  useEffect(refresh, [refresh])

  return (
    <div className="start office-start">
      <div className="start-inner">
        <div className="start-mark">
          <img src={ICONS[kind]} width={64} height={64} alt="" />
        </div>
        <h1>{L.office.apps[kind]}</h1>
        <p className="start-sub">{S.subtitle[kind]}</p>

        <div className="office-start-actions">
          <button className="btn primary lg" onClick={() => void window.molinoOffice.newDoc()}>
            <FilePlus2 size={17} />
            {S.new[kind]}
          </button>
          <button className="btn lg" onClick={() => void window.molinoOffice.openDialog()}>
            <FolderOpen size={17} />
            {S.open}
          </button>
        </div>

        <div className="recent">
          <div className="recent-head">
            <span className="recent-title">{S.recent}</span>
          </div>
          <div className="recent-list">
            {recent?.map((file) => (
              <div key={file.id} className="recent-row">
                <button className="recent-item" onClick={() => void window.molinoOffice.openRecent(file.id).then((ok) => !ok && refresh())}>
                  <FileText size={18} />
                  <div className="grow">
                    <div className="recent-name">{file.name}</div>
                    <div className="recent-path">{file.folder}</div>
                  </div>
                  <span className="recent-when">{formatWhen(file.openedAt)}</span>
                </button>
                <button
                  className="icon-btn sm recent-remove"
                  aria-label={fmt(S.remove, { name: file.name })}
                  data-tip={S.removeTip}
                  onClick={() => void window.molinoOffice.forgetRecent(file.id).then(setRecent)}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {recent?.length === 0 && <p className="recent-empty">{S.noRecent}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
