import { KeyRound, Lock } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { fmt, L } from '@/i18n'
import { formatBytes, formatDate } from '@/lib/util'
import { mutate, submitPassword, unlockDoc } from '@/state/actions'
import { type ConfirmDialog, type DialogState, useApp } from '@/state/app'
import { AboutDialog } from './About'
import { FeedbackDialog } from './FeedbackDialog'
import { SettingsDialog } from './Settings'
import { Checkbox, Dialog, Field } from './ui'

function Confirm({ dialog }: { dialog: ConfirmDialog }) {
  const close = useApp((s) => s.closeDialog)
  const [working, setWorking] = useState(false)
  const [option, setOption] = useState(dialog.option?.value ?? false)
  const run = async (fn: () => void | Promise<void>): Promise<void> => {
    setWorking(true)
    // Se cierra antes de la acción, que puede abrir otro diálogo (y solo si sigue siendo este).
    if (useApp.getState().dialog === dialog) close()
    await fn()
  }
  const cancel = (): void => {
    close()
    dialog.onCancel?.()
  }
  return (
    <Dialog
      title={dialog.title}
      onClose={cancel}
      footer={
        <>
          {dialog.alt && (
            <button className="btn ghost" disabled={working} onClick={() => void run(() => dialog.alt!.run(option))}>
              {dialog.alt.label}
            </button>
          )}
          <div className="spacer" />
          <button className="btn" disabled={working} onClick={cancel}>
            {dialog.cancelLabel ?? L.common.cancel}
          </button>
          <button
            className={dialog.danger ? 'btn danger' : 'btn primary'}
            disabled={working}
            onClick={() => void run(() => dialog.onConfirm(option))}
          >
            {dialog.confirmLabel}
          </button>
        </>
      }
    >
      <p>{dialog.message}</p>
      {dialog.option && (
        <div className="confirm-option">
          <Checkbox checked={option} onChange={setOption}>
            {dialog.option.label}
          </Checkbox>
          {dialog.option.hint && <p className="hint">{dialog.option.hint}</p>}
        </div>
      )}
    </Dialog>
  )
}

function Password({ token, name, wrong }: { token: string; name: string; wrong: boolean }) {
  const close = useApp((s) => s.closeDialog)
  const [value, setValue] = useState('')
  const [working, setWorking] = useState(false)
  const submit = async (): Promise<void> => {
    if (!value || working) return
    setWorking(true)
    await submitPassword(token, value)
    setWorking(false)
    setValue('')
  }
  return (
    <Dialog
      title={L.dialogs.password.title}
      icon={<Lock size={18} color="var(--accent-fg)" />}
      onClose={close}
      footer={
        <>
          <button className="btn" onClick={close}>
            {L.common.cancel}
          </button>
          <button className="btn primary" disabled={!value || working} onClick={() => void submit()}>
            {L.common.open}
          </button>
        </>
      }
    >
      <p>{fmt(L.dialogs.password.message, { name })}</p>
      <Field label={L.dialogs.password.label}>
        <input
          className="input"
          type="password"
          autoComplete="off"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && void submit()}
        />
      </Field>
      {wrong && <span className="error-text">{L.dialogs.password.wrong}</span>}
    </Dialog>
  )
}

function Unlock({ doc, retry }: { doc: string; retry?: () => void }) {
  const close = useApp((s) => s.closeDialog)
  const [value, setValue] = useState('')
  const [wrong, setWrong] = useState(false)
  const [working, setWorking] = useState(false)
  const submit = async (): Promise<void> => {
    if (!value || working) return
    setWorking(true)
    const ok = await unlockDoc(doc, value)
    setWorking(false)
    if (ok) {
      close()
      retry?.()
    } else {
      setWrong(true)
      setValue('')
    }
  }
  return (
    <Dialog
      title={L.dialogs.unlock.title}
      icon={<KeyRound size={18} color="var(--accent-fg)" />}
      onClose={close}
      footer={
        <>
          <button className="btn" onClick={close}>
            {L.common.cancel}
          </button>
          <button className="btn primary" disabled={!value || working} onClick={() => void submit()}>
            {L.dialogs.unlock.action}
          </button>
        </>
      }
    >
      <p>{L.dialogs.unlock.message}</p>
      <Field label={L.dialogs.unlock.label}>
        <input
          className="input"
          type="password"
          autoComplete="off"
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            setWrong(false)
          }}
          onKeyDown={(event) => event.key === 'Enter' && void submit()}
        />
      </Field>
      {wrong && <span className="error-text">{L.dialogs.unlock.wrong}</span>}
    </Dialog>
  )
}

function PropertiesDialog({ doc: docId }: { doc: string }) {
  const close = useApp((s) => s.closeDialog)
  const doc = useApp((s) => s.docs[docId])
  const [meta, setMeta] = useState(() => ({
    title: doc?.meta.title ?? '',
    author: doc?.meta.author ?? '',
    subject: doc?.meta.subject ?? '',
    keywords: doc?.meta.keywords ?? ''
  }))
  if (!doc) return null
  const changed =
    meta.title !== doc.meta.title ||
    meta.author !== doc.meta.author ||
    meta.subject !== doc.meta.subject ||
    meta.keywords !== doc.meta.keywords
  const save = async (): Promise<void> => {
    const result = await mutate<{ state: typeof doc.state; changed: []; meta: typeof doc.meta }>(docId, 'doc.setMetadata', meta)
    if (result) {
      useApp.getState().patchDoc(docId, { meta: result.meta })
      close()
    }
  }
  const T = L.dialogs.properties
  const rows: [string, string][] = [
    [T.rows.file, doc.state.path ?? T.notSaved],
    [L.common.pages, String(doc.pages.length)],
    [T.rows.size, formatBytes(doc.info.fileSize)],
    [T.rows.format, doc.info.format],
    [T.rows.created, formatDate(doc.meta.created)],
    [T.rows.modified, formatDate(doc.meta.modified)],
    [T.rows.creator, doc.meta.creator || '—'],
    [T.rows.producer, doc.meta.producer || '—'],
    [T.rows.protection, doc.info.encrypted ? T.encrypted : T.notEncrypted],
    [T.rows.signatures, doc.state.signed ? L.common.yes : L.common.no]
  ]
  return (
    <Dialog
      title={T.title}
      size="wide"
      onClose={close}
      footer={
        <>
          <button className="btn" onClick={close}>
            {L.common.close}
          </button>
          <button className="btn primary" disabled={!changed} onClick={() => void save()}>
            {T.saveChanges}
          </button>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label={T.fields.title}>
          <input className="input" value={meta.title} maxLength={500} onChange={(e) => setMeta({ ...meta, title: e.target.value })} />
        </Field>
        <Field label={T.fields.author}>
          <input className="input" value={meta.author} maxLength={500} onChange={(e) => setMeta({ ...meta, author: e.target.value })} />
        </Field>
        <Field label={T.fields.subject}>
          <input className="input" value={meta.subject} maxLength={500} onChange={(e) => setMeta({ ...meta, subject: e.target.value })} />
        </Field>
        <Field label={T.fields.keywords}>
          <input className="input" value={meta.keywords} maxLength={500} onChange={(e) => setMeta({ ...meta, keywords: e.target.value })} />
        </Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '7px 12px', fontSize: 12.5 }}>
        {rows.map(([label, value]) => (
          <div key={label} style={{ display: 'contents' }}>
            <span style={{ color: 'var(--text-3)' }}>{label}</span>
            <span style={{ color: 'var(--text)', overflowWrap: 'anywhere' }}>{value}</span>
          </div>
        ))}
      </div>
    </Dialog>
  )
}

const SC = L.dialogs.shortcuts
const SHORTCUTS: [string, string][] = [
  ['Ctrl + O', L.common.open],
  ['Ctrl + S', L.common.save],
  [SC.keys.saveAs, SC.saveAs],
  ['Ctrl + P', SC.print],
  ['Ctrl + W', SC.closeDoc],
  ['Ctrl + Tab', SC.nextDoc],
  ['Ctrl + Z / Ctrl + Y', SC.undoRedo],
  ['Ctrl + F', SC.find],
  [SC.keys.wheel, SC.zoom],
  ['Ctrl + 0 / Ctrl + 1', SC.fit],
  [SC.keys.delete, SC.deleteSelection],
  [SC.keys.arrows, SC.moveSelection],
  [SC.keys.escape, SC.escape]
]

function ShortcutsDialog() {
  const close = useApp((s) => s.closeDialog)
  return (
    <Dialog
      title={SC.title}
      onClose={close}
      footer={
        <button className="btn primary" onClick={close}>
          {L.common.close}
        </button>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '9px 18px', alignItems: 'center' }}>
        {SHORTCUTS.map(([keys, label]) => (
          <div key={keys} style={{ display: 'contents' }}>
            <span className="kbd" style={{ justifySelf: 'start', padding: '2px 7px' }}>
              {keys}
            </span>
            <span style={{ color: 'var(--text)' }}>{label}</span>
          </div>
        ))}
      </div>
    </Dialog>
  )
}

/** Diálogos propios de cada función; se registran desde sus módulos. */
export interface CustomDialogProps {
  doc?: string
  data?: Record<string, unknown>
}

const customDialogs = new Map<string, (props: CustomDialogProps) => ReactNode>()

export function registerDialog(id: string, component: (props: CustomDialogProps) => ReactNode): void {
  customDialogs.set(id, component)
}

registerDialog('feedback', () => (
  <FeedbackDialog onClose={() => useApp.getState().closeDialog()} onSent={() => useApp.getState().toast('success', L.feedback.thanks)} />
))

function render(dialog: DialogState): ReactNode {
  switch (dialog.type) {
    case 'confirm':
      return <Confirm dialog={dialog} />
    case 'password':
      return <Password key={dialog.token} token={dialog.token} name={dialog.name} wrong={dialog.wrong} />
    case 'unlock':
      return <Unlock doc={dialog.doc} retry={dialog.retry} />
    case 'settings':
      return <SettingsDialog onClose={() => useApp.getState().closeDialog()} />
    case 'properties':
      return <PropertiesDialog doc={dialog.doc} />
    case 'shortcuts':
      return <ShortcutsDialog />
    case 'about':
      return <AboutDialog onClose={() => useApp.getState().closeDialog()} />
    case 'custom': {
      const Custom = customDialogs.get(dialog.id)
      return Custom ? <Custom doc={dialog.doc} data={dialog.data} /> : null
    }
  }
}

export function DialogHost() {
  const dialog = useApp((s) => s.dialog)
  return dialog ? <>{render(dialog)}</> : null
}
