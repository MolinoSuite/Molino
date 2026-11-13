import { Lock } from 'lucide-react'
import { useState } from 'react'
import type { ImagesOptions } from '@shared/api'
import { fmt, L } from '@/i18n'
import { type BlankPages, BlankPagesFields, blankSize } from '@/modes/common/BlankPages'
import { NumberField } from '@/modes/common/controls'
import { createBlank, createFromImages, retryMerge } from '@/state/actions'
import { useApp } from '@/state/app'
import { type CustomDialogProps, registerDialog } from './Dialogs'
import { Dialog, Field } from './ui'

/**
 * Diálogos de crear un PDF nuevo (barra de título, pantalla de inicio, Ctrl+N y
 * el buscador de órdenes): documento en blanco, imágenes a PDF y la contraseña
 * de un archivo al combinar.
 */

const T = L.dialogs.create

/** Documento en blanco: tamaño, orientación y número de páginas. Intro lo crea en A4 como siempre. */
function NewBlankDialog() {
  const close = useApp((s) => s.closeDialog)
  const [value, setValue] = useState<BlankPages>({ paper: 'A4', landscape: false, count: 1 })
  const run = (): void => {
    const size = blankSize(value)
    close()
    if (size) void createBlank({ ...size, count: value.count })
  }
  return (
    <Dialog
      title={T.blank.title}
      onClose={close}
      footer={
        <>
          <button className="btn" onClick={close}>
            {L.common.cancel}
          </button>
          <button className="btn primary" data-autofocus onClick={run}>
            {T.blank.run}
          </button>
        </>
      }
    >
      <BlankPagesFields value={value} onChange={setValue} />
    </Dialog>
  )
}

const MM_TO_PT = 72 / 25.4

/** Imágenes a PDF: tamaño de las páginas y margen; después se eligen las imágenes. */
function ImagesToPdfDialog() {
  const close = useApp((s) => s.closeDialog)
  const [mode, setMode] = useState<ImagesOptions['mode']>('auto')
  const [margin, setMargin] = useState(0)
  const run = (): void => {
    close()
    // El motor admite hasta 200 puntos (unos 70 mm).
    void createFromImages({ mode, margin: Math.min(200, Math.round(margin * MM_TO_PT * 100) / 100) })
  }
  return (
    <Dialog
      title={T.images.title}
      onClose={close}
      footer={
        <>
          <button className="btn" onClick={close}>
            {L.common.cancel}
          </button>
          <button className="btn primary" data-autofocus onClick={run}>
            {T.images.run}
          </button>
        </>
      }
    >
      <Field label={T.images.paper} hint={T.images.hints[mode]}>
        <select className="select" value={mode} onChange={(event) => setMode(event.target.value as ImagesOptions['mode'])}>
          {(['auto', 'image', 'a4', 'letter'] as const).map((value) => (
            <option key={value} value={value}>
              {T.images.modes[value]}
            </option>
          ))}
        </select>
      </Field>
      <div className="row">
        <span className="grow">{T.images.margin}</span>
        <NumberField value={margin} min={0} max={70} suffix="mm" width={72} onChange={(value) => setMargin(Math.round(value))} />
      </div>
    </Dialog>
  )
}

/** Uno de los archivos que se combinan pide contraseña (de apertura, o de propietario si tiene restricciones). */
function MergePasswordDialog({ data }: CustomDialogProps) {
  const close = useApp((s) => s.closeDialog)
  const [value, setValue] = useState('')
  const token = typeof data?.token === 'string' ? data.token : ''
  const name = typeof data?.name === 'string' ? data.name : ''
  const code = typeof data?.code === 'string' ? data.code : ''
  const message = typeof data?.message === 'string' ? data.message : ''
  const submit = (): void => {
    if (!value || !token) return
    close()
    void retryMerge(token, value)
  }
  return (
    <Dialog
      title={T.mergePassword.title}
      icon={<Lock size={18} color="var(--accent-fg)" />}
      onClose={close}
      footer={
        <>
          <button className="btn" onClick={close}>
            {L.common.cancel}
          </button>
          <button className="btn primary" disabled={!value} onClick={submit}>
            {T.mergePassword.run}
          </button>
        </>
      }
    >
      <p>{fmt(code === 'permission_denied' ? T.mergePassword.restricted : T.mergePassword.message, { name })}</p>
      <Field label={T.mergePassword.label}>
        <input
          className="input"
          type="password"
          autoComplete="off"
          maxLength={1024}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && submit()}
        />
      </Field>
      {code === 'wrong_password' && <span className="error-text">{message}</span>}
    </Dialog>
  )
}

registerDialog('newBlank', NewBlankDialog)
registerDialog('imagesToPdf', ImagesToPdfDialog)
// Cada intento es un diálogo nuevo (otro identificador): se vacía la contraseña escrita.
registerDialog('mergePassword', (props) => <MergePasswordDialog key={String(props.data?.token)} {...props} />)
