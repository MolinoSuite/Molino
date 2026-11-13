import { Send } from 'lucide-react'
import { useEffect, useState } from 'react'
import { L } from '@/i18n'
import { errorMessage, unwrap } from '@/lib/api'
import { withApp } from '@/lib/currentApp'
import { Dialog, Segmented } from './ui'

/**
 * Enviar un comentario al autor: tipo (fallo, mejora u otra cosa) y mensaje.
 * Llega por correo mediante su servicio de comentarios (src/main/feedback.ts);
 * si esta copia no lo tiene, se ofrece GitHub.
 */

type Kind = 'Fallo' | 'Mejora' | 'Otra cosa'

/** Lo que se sugiere escribir (con el nombre de la app de esta ventana). */
const placeholder = (kind: Kind): string =>
  kind === 'Fallo' ? L.feedback.placeholder.bug : kind === 'Mejora' ? withApp(L.feedback.placeholder.idea) : L.feedback.placeholder.other

/** ``onSent``: después de enviarlo (cada app da las gracias a su manera). Lo usan todas las apps. */
export function FeedbackDialog({ onClose, onSent }: { onClose: () => void; onSent: () => void }) {
  const close = onClose
  const [available, setAvailable] = useState<boolean | null>(null)
  const [kind, setKind] = useState<Kind>('Fallo')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void window.molino.feedback
      .available()
      .then(setAvailable)
      .catch(() => setAvailable(false))
  }, [])

  const send = async (): Promise<void> => {
    setSending(true)
    setError('')
    try {
      unwrap(await window.molino.feedback.send(kind, message.trim()))
      onSent()
      close()
    } catch (failure) {
      setError(errorMessage(failure))
      setSending(false)
    }
  }

  // La página de Molino en GitHub (la general, no la de avisos de fallos).
  const github = (
    <button className="btn ghost" onClick={() => void window.molino.about.open('source')}>
      {L.feedback.viewOnGitHub}
    </button>
  )

  if (available === false) {
    return (
      <Dialog
        title={L.feedback.title}
        onClose={close}
        footer={
          <>
            <button className="btn" onClick={close}>
              {L.common.close}
            </button>
            <button className="btn primary" onClick={() => void window.molino.about.open('issues').then(close)}>
              {L.feedback.openGitHub}
            </button>
          </>
        }
      >
        <p>{L.feedback.githubText}</p>
      </Dialog>
    )
  }

  return (
    <Dialog
      title={L.feedback.title}
      onClose={close}
      footer={
        <>
          {github}
          <span className="spacer" />
          <button className="btn" onClick={close}>
            {L.common.cancel}
          </button>
          <button className="btn primary" disabled={message.trim().length < 3 || sending || !available} onClick={() => void send()}>
            <Send size={15} />
            {sending ? L.feedback.sending : L.feedback.send}
          </button>
        </>
      }
    >
      <Segmented
        value={kind}
        full
        options={[
          { value: 'Fallo', label: L.feedback.kind.bug },
          { value: 'Mejora', label: L.feedback.kind.idea },
          { value: 'Otra cosa', label: L.feedback.kind.other }
        ]}
        onChange={setKind}
      />
      <textarea
        className="textarea feedback-text"
        aria-label={L.feedback.message}
        placeholder={placeholder(kind)}
        value={message}
        maxLength={4000}
        data-autofocus
        disabled={sending}
        onChange={(event) => setMessage(event.target.value)}
      />
      <span className="hint">{L.feedback.hint}</span>
      {error && <span className="error-text">{error}</span>}
    </Dialog>
  )
}

