import { Sparkles } from 'lucide-react'
import { L, fmt } from '@/i18n'
import { useOffice } from '@/state/office'
import { postponeUpdate, useUpdates } from '@/state/updates'

/**
 * Aviso de versión nueva, con lo justo: título y botones. «Actualizar» abre
 * Molino en la Microsoft Store, que es quien la instala (Windows también lo
 * hace solo, al poco).
 */
export function UpdateCard() {
  const status = useUpdates((s) => s.status)
  const postponed = useUpdates((s) => s.postponed)
  const suite = useOffice((s) => s.status?.available ?? false)
  const app = suite ? 'Molino Suite' : 'Molino PDF'
  const version = status.version && status.version !== '?' ? status.version : ''

  if (status.state !== 'available' || (postponed !== null && postponed === (status.version ?? null))) return null
  return (
    <div className="update-card" role="status">
      <Sparkles size={18} className="update-icon" />
      <div className="grow">
        <b>{version ? fmt(L.shell.update.availableVersion, { app, version }) : fmt(L.shell.update.available, { app })}</b>
        <span>{L.shell.update.hint}</span>
        <div className="update-actions">
          <button className="btn sm primary" onClick={() => void window.molino.updates.openStore()}>
            {L.shell.update.update}
          </button>
          <button className="btn sm ghost" onClick={postponeUpdate}>
            {L.shell.update.notNow}
          </button>
        </div>
      </div>
    </div>
  )
}
