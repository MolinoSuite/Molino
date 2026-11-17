import { Gift } from 'lucide-react'
import { useEffect } from 'react'
import { L, fmt } from '@/i18n'
import { dismissWhatsNew, followWhatsNew, openWhatsNew, useWhatsNew } from '@/state/whatsNew'
import { NoticeCard } from './NoticeCard'

/**
 * El aviso de la ventana de Molino PDF tras actualizar Molino, abajo a la
 * derecha: una vez, con «Ver novedades» (la página de esta versión) y
 * «Cerrar». Sale en una sola ventana: si ya lo enseña el inicio de la suite,
 * aquí no.
 */
export function WhatsNewCard() {
  const notice = useWhatsNew((s) => s.notice)
  useEffect(followWhatsNew, [])
  if (!notice) return null
  return (
    <div className="notice-cards">
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
    </div>
  )
}
