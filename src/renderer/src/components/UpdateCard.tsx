import { Gift, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { L, fmt } from '@/i18n'
import { useOffice } from '@/state/office'
import { dismissWhatsNew, followWhatsNew, openWhatsNew, postponeUpdate, useUpdates, useWhatsNew } from '@/state/updates'
import { NoticeCard } from './NoticeCard'

/**
 * Los avisos de la ventana de Molino PDF, abajo a la derecha y uno encima de
 * otro: Molino se ha actualizado (novedades) y hay versión nueva. Cada uno sale
 * en una sola ventana: si ya lo enseña el inicio de la suite, aquí no.
 */
export function UpdateCards() {
  return (
    <div className="update-cards">
      <WhatsNewCard />
      <UpdateCard />
    </div>
  )
}

/** Molino se ha actualizado: una vez, con «Ver novedades» (la página de esta versión) y «Cerrar». */
function WhatsNewCard() {
  const notice = useWhatsNew((s) => s.notice)
  useEffect(followWhatsNew, [])
  if (!notice) return null
  return (
    <NoticeCard
      className="whats-new"
      icon={Gift}
      title={fmt(L.shell.whatsNew.title, { app: notice.product === 'suite' ? 'Molino Suite' : 'Molino PDF' })}
      text={fmt(L.shell.whatsNew.text, { version: notice.version })}
      action={L.shell.whatsNew.open}
      onAction={openWhatsNew}
      dismiss={L.common.close}
      onDismiss={dismissWhatsNew}
    />
  )
}

/**
 * Aviso de versión nueva, con lo justo: título y botones. «Actualizar» abre
 * Molino en la Microsoft Store, que es quien la instala (Windows también lo
 * hace solo, al poco).
 */
function UpdateCard() {
  const status = useUpdates((s) => s.status)
  const postponed = useUpdates((s) => s.postponed)
  const suite = useOffice((s) => s.status?.available ?? false)
  const app = suite ? 'Molino Suite' : 'Molino PDF'
  const version = status.version && status.version !== '?' ? status.version : ''
  const available = status.state === 'available'
  // ¿Lo enseña esta ventana? (el proceso principal lo da a una sola: esta o el inicio)
  const [mine, setMine] = useState(false)
  useEffect(() => {
    if (!available || mine) return
    let alive = true
    void window.molino.notices.updateCard().then(
      (yes) => alive && setMine(yes === true),
      () => undefined
    )
    return () => {
      alive = false
    }
  }, [available, mine])

  if (!available || !mine || (postponed !== null && postponed === (status.version ?? null))) return null
  return (
    <NoticeCard
      icon={Sparkles}
      title={version ? fmt(L.shell.update.availableVersion, { app, version }) : fmt(L.shell.update.available, { app })}
      text={L.shell.update.hint}
      action={L.shell.update.update}
      onAction={() => void window.molino.updates.openStore()}
      dismiss={L.shell.update.notNow}
      onDismiss={postponeUpdate}
    />
  )
}
