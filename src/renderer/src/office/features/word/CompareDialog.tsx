import { useState } from 'react'
import { Checkbox, Dialog, Field } from '@/components/ui'
import { cn } from '@/lib/cn'
import { L } from '../../i18n'
import type { Api, DialogProps } from '../types'

const C = L.officeWord.compare

interface OtherDocument {
  name: string
  api: Api
}

/**
 * Los otros documentos abiertos en esta ventana de Documentos (cada pestaña es
 * un marco con su editor, del mismo origen). Así se compara sin pedir nada al
 * proceso principal: el editor del otro da su documento en su formato interno.
 */
export function otherDocuments(self: Api): OtherDocument[] {
  const out: OtherDocument[] = []
  for (const frame of document.querySelectorAll<HTMLIFrameElement>('iframe.office-frame')) {
    try {
      const inner = frame.contentDocument?.querySelector<HTMLIFrameElement>('iframe[name="frameEditor"]')
      const w = inner?.contentWindow as Api
      const api = w && ((w.Asc && w.Asc.editor) || w.editor)
      if (api && api !== self && typeof api.asc_nativeGetFile === 'function' && w.molinoReady === true) out.push({ name: frame.title || '—', api })
    } catch {
      /* un marco que aún no ha cargado */
    }
  }
  return out
}

/**
 * Comparar (o combinar) este documento con otro abierto: las diferencias
 * entran aquí como cambios controlados, que se aceptan o rechazan en Revisar.
 */
export function CompareDialog({ session, value, close }: DialogProps) {
  const ctx = session.featureContext()
  const combine = value === 'combine'
  const [others] = useState(() => otherDocuments(ctx.api))
  const [picked, setPicked] = useState(0)
  const [words, setWords] = useState(true)
  const [error, setError] = useState('')
  const other = others[Math.min(picked, others.length - 1)]

  const go = (): void => {
    if (!other) return
    let binary: unknown = null
    try {
      binary = other.api.asc_nativeGetFile()
    } catch {
      binary = null
    }
    if (typeof binary !== 'string' || !binary.startsWith('DOCY')) return setError(C.failed)
    const W = ctx.ew.AscCommonWord
    const options = new W.ComparisonOptions()
    if (typeof options.putWords === 'function') options.putWords(words)
    // Las imágenes del otro se piden con su nombre (media/…): las que también están en este se ven igual.
    const source = { IsValid: () => true, GetBinary: () => binary, GetImageMap: () => ({}) }
    close()
    try {
      if (combine) W.mergeDocuments(source, options)
      else W.CompareDocuments(source, options)
    } catch (error) {
      console.error('comparar:', error)
    }
    session.focus()
  }

  return (
    <Dialog
      title={combine ? C.combineTitle : C.compareTitle}
      onClose={close}
      footer={
        <>
          <span className="grow" />
          <button className="btn" onClick={close}>
            {L.office.dialogs.cancel}
          </button>
          <button className="btn primary" disabled={!other} onClick={go}>
            {combine ? C.goCombine : C.go}
          </button>
        </>
      }
    >
      <div className="office-prompt">
        <p>{combine ? C.combineIntro : C.compareIntro}</p>
        {others.length === 0 ? (
          <p className="hint">{C.none}</p>
        ) : (
          <Field label={C.other} hint={C.otherHint}>
            <div className="office-word-list" role="listbox" aria-label={C.other}>
              {others.map((doc, i) => (
                <button
                  key={i}
                  type="button"
                  role="option"
                  aria-selected={doc === other}
                  className={cn('office-word-list-item', doc === other && 'on')}
                  onClick={() => setPicked(i)}
                  onDoubleClick={() => {
                    setPicked(i)
                    go()
                  }}
                >
                  {doc.name}
                </button>
              ))}
            </div>
          </Field>
        )}
        {!combine && others.length > 0 && (
          <Checkbox checked={words} onChange={setWords}>
            {C.words}
          </Checkbox>
        )}
        {error && <p className="office-word-error">{error}</p>}
      </div>
    </Dialog>
  )
}
