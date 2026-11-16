/**
 * «Comprobar para un trámite»: si el PDF abierto está listo para presentarlo
 * en una sede electrónica (el motor lo revisa: engine/molino_engine/ops/tramite.py).
 *
 * Dice qué falta y lleva a la herramienta que lo arregla cuando la hay
 * (guardar, firmar, comprimir, limpiar, quitar la protección, otro nombre). Con
 * el documento firmado no se ofrece nada que rompa la firma. Sirve también
 * para ver las firmas de un PDF que te llega.
 *
 * Nada de lo que dice promete una conformidad que no se ha comprobado: lo de
 * PDF/A es lo que el documento dice ser y lo básico que se puede mirar.
 */
import { CircleCheck, CircleX, ClipboardCheck, Info, TriangleAlert } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { type CustomDialogProps, registerDialog } from '@/components/Dialogs'
import { Dialog } from '@/components/ui'
import { fmt, L, locale, plural } from '@/i18n'
import { errorMessage, query } from '@/lib/api'
import { cn, formatBytes, formatDate } from '@/lib/util'
import { mutate, saveDoc, saveDocAs, setMode, setTool } from '@/state/actions'
import { type DocView, useApp } from '@/state/app'
import { type SignatureStatus, signerText, STATUS_ICON, statusText } from './status'

const T = L.sign.tramite

type Level = 'ok' | 'info' | 'warning' | 'error'

/** Una comprobación del motor: su nombre, su nivel y sus datos. */
interface Check {
  id: 'saved' | 'signatures' | 'protection' | 'pdfa' | 'fonts' | 'javascript' | 'attachments' | 'size' | 'name'
  level: Level
  [key: string]: unknown
}

interface Report {
  verdict: 'ready' | 'review' | 'notReady'
  checks: Check[]
  signatures: SignatureStatus[]
  pdfa: string | null
  pages: number
  online: boolean
}

/** Abre la comprobación de un documento de Molino PDF. */
export function openTramite(doc: string): void {
  useApp.getState().openDialog({ type: 'custom', id: 'tramite', doc })
}

const LEVEL_ICON: Record<Level, ReactNode> = {
  ok: <CircleCheck size={17} />,
  info: <Info size={17} />,
  warning: <TriangleAlert size={17} />,
  error: <CircleX size={17} />
}

const VERDICT_ICON: Record<Report['verdict'], ReactNode> = {
  ready: <CircleCheck size={22} />,
  review: <TriangleAlert size={22} />,
  notReady: <CircleX size={22} />
}

const list = (items: string[]): string => new Intl.ListFormat(locale, { type: 'conjunction' }).format(items)

/** «2B» → «PDF/A-2b», como se escribe la versión de la norma. */
const pdfaName = (claim: string): string => `PDF/A-${claim.slice(0, 1)}${claim.slice(1).toLowerCase()}`

const day = (iso: string): string => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(locale, { dateStyle: 'long' })
}

const num = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0)
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [])

interface Fix {
  label: string
  run: () => void
}

/**
 * Lo que se dice de cada comprobación y, si la hay, la herramienta que lo
 * arregla. ``recheck``: volver a comprobar cuando el arreglo se hace sin salir
 * de aquí (guardar, quitar la protección).
 */
function describe(check: Check, doc: DocView, recheck: () => void): { text: string; fix?: Fix } {
  const id = doc.id
  const signed = doc.state.signed
  const dialog = (which: string) => (): void => useApp.getState().openDialog({ type: 'custom', id: which, doc: id })
  // Arreglar algo de un documento firmado anularía su firma: se explica en vez de ofrecerlo.
  const unlessSigned = (text: string, fix: Fix): { text: string; fix?: Fix } => (signed ? { text: `${text} ${T.signedHint}` } : { text, fix })
  switch (check.id) {
    case 'saved': {
      const state = check.state as keyof typeof T.saved
      if (state === 'changes') return { text: T.saved.changes, fix: { label: T.fix.save, run: () => void saveDoc(id).then((ok) => ok && recheck()) } }
      if (state === 'new') return { text: T.saved.new, fix: { label: T.fix.saveAs, run: () => void saveDocAs(id).then((ok) => ok && recheck()) } }
      return { text: T.saved.saved }
    }
    case 'signatures': {
      const S = T.signatures
      const count = num(check.count)
      if (count === 0) {
        const sign = (): void => {
          useApp.getState().closeDialog()
          setMode(id, 'sign')
          setTool(id, 'cert-rect')
        }
        return { text: S.none, fix: { label: T.fix.sign, run: sign } }
      }
      if (check.level === 'error') return { text: S.invalid }
      if (check.level === 'warning') {
        if (num(check.modified)) return { text: S.modified }
        if (num(check.expired)) return { text: S.expired }
        if (num(check.untrusted)) return { text: S.untrusted }
        return { text: S.warning }
      }
      return { text: `${plural(S.valid, count)} ${num(check.timestamped) >= count ? S.stamped : S.notStamped}` }
    }
    case 'protection': {
      const P = T.protection
      if (check.state === 'none') return { text: P.none }
      const text = check.state === 'password' ? P.password : P.restricted
      return unlessSigned(text, { label: T.fix.unprotect, run: () => void mutate(id, 'tools.unprotect').then((result) => result && recheck()) })
    }
    case 'pdfa': {
      const version = typeof check.version === 'string' ? pdfaName(check.version) : null
      if (!version) return { text: T.pdfa.none }
      const problems = strings(check.problems).map((p) => (T.pdfa.problem as Record<string, string>)[p] ?? p)
      return { text: problems.length ? fmt(T.pdfa.problems, { version, list: list(problems) }) : fmt(T.pdfa.ok, { version }) }
    }
    case 'fonts':
      return { text: check.level === 'ok' ? T.fonts.ok : plural(T.fonts.missing, num(check.count), { names: strings(check.names).slice(0, 6).join(', ') }) }
    case 'javascript':
      return check.level === 'ok' ? { text: T.javascript.ok } : unlessSigned(T.javascript.found, { label: T.fix.clean, run: dialog('sanitize') })
    case 'attachments':
      return check.level === 'ok' ? { text: T.attachments.ok } : unlessSigned(plural(T.attachments.found, num(check.count)), { label: T.fix.clean, run: dialog('sanitize') })
    case 'size': {
      const size = formatBytes(num(check.bytes))
      if (check.level === 'ok') return { text: fmt(check.exact ? T.size.ok : T.size.unsaved, { size }) }
      if (signed) return { text: fmt(T.size.largeSigned, { size }) }
      return { text: fmt(T.size.large, { size }), fix: { label: T.fix.compress, run: dialog('optimize') } }
    }
    case 'name': {
      if (check.level === 'ok') return { text: T.name.ok }
      const issues = strings(check.issues).map((i) => (T.name.issue as Record<string, string>)[i] ?? i)
      const suggestion = typeof check.suggestion === 'string' ? check.suggestion : ''
      // Guardar con otro nombre no toca el contenido: tampoco las firmas.
      return {
        text: fmt(T.name.issues, { list: list(issues), suggestion }),
        fix: suggestion ? { label: T.fix.rename, run: () => void saveDocAs(id, suggestion).then((ok) => ok && recheck()) } : undefined
      }
    }
    default:
      return { text: '' }
  }
}

function CheckRow({ check, doc, recheck }: { check: Check; doc: DocView; recheck: () => void }) {
  const { text, fix } = describe(check, doc, recheck)
  if (!text) return null
  return (
    <div className={cn('tramite-item', check.level)} data-check={check.id}>
      {LEVEL_ICON[check.level]}
      <span className="grow">{text}</span>
      {fix && (
        <button className="btn sm" onClick={fix.run}>
          {fix.label}
        </button>
      )}
    </div>
  )
}

/** Una firma: quién, cómo está y los datos que importan para presentarla. */
function SignatureCard({ item }: { item: SignatureStatus }) {
  const S = T.signature
  const stamp = item.timestamp?.valid ? item.timestamp.time : null
  const facts = [
    item.modification === 'none' || (!item.modification && !item.modifiedAfter)
      ? S.unchanged
      : item.modification === 'formfill'
        ? S.allowed
        : S.changed,
    ...(item.type === 'timestamp' ? [] : [stamp ? fmt(S.stamp, { date: formatDate(stamp) }) : S.noStamp]),
    ...(item.certValidUntil ? [fmt(item.certExpired ? S.expiredOn : S.validUntil, { date: day(item.certValidUntil) })] : [])
  ]
  return (
    <div className={cn('sig-status', item.summary)}>
      {STATUS_ICON[item.summary] ?? STATUS_ICON.unknown}
      <div className="grow">
        <div className="cert-name">{signerText(item)}</div>
        <div className="cert-meta">
          {statusText(item)}
          {item.signedAt ? ` · ${formatDate(item.signedAt)}` : ''}
          {item.issuer.cn ? ` · ${fmt(L.sign.check.issuedBy, { issuer: item.issuer.cn })}` : ''}
        </div>
        <ul className="tramite-facts">
          {facts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
        {item.messages.length > 0 && (
          <details className="tramite-details">
            <summary>{T.details}</summary>
            <ul>
              {item.messages.map((message, i) => (
                <li key={i}>{message}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  )
}

function TramiteDialog({ doc: docId }: CustomDialogProps) {
  const close = useApp((s) => s.closeDialog)
  const doc = useApp((s) => (docId ? s.docs[docId] : undefined))
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState('')
  const check = useCallback(
    (online: boolean): void => {
      if (!docId) return
      setReport(null)
      setError('')
      // Sin salir a internet salvo que se pida (la revocación de los certificados).
      query<Report>('tramite.check', { doc: docId, online }, { priority: 9 })
        .then(setReport)
        .catch((err) => setError(errorMessage(err)))
    },
    [docId]
  )
  useEffect(() => check(false), [check])
  if (!doc) return null
  const recheck = (): void => check(report?.online ?? false)
  const problems = report ? [...report.checks.filter((c) => c.level === 'error'), ...report.checks.filter((c) => c.level === 'warning')] : []
  const passed = report ? report.checks.filter((c) => c.level === 'ok' || c.level === 'info') : []
  const V = T.verdict
  return (
    <Dialog
      title={T.title}
      size="wide"
      icon={<ClipboardCheck size={18} color="var(--accent-fg)" />}
      className="tramite"
      onClose={close}
      footer={
        <>
          {report && report.signatures.length > 0 && !report.online && (
            <button className="btn ghost" title={L.sign.check.revocationTip} onClick={() => check(true)}>
              {L.sign.check.revocation}
            </button>
          )}
          <div className="spacer" />
          <button className="btn primary" onClick={close}>
            {L.common.close}
          </button>
        </>
      }
    >
      {error ? (
        <span className="error-text">{error}</span>
      ) : !report ? (
        <div className="row">
          <div className="spinner" />
          <span>{T.checking}</span>
        </div>
      ) : (
        <>
          <div className={cn('tramite-verdict', report.verdict)} role="status">
            {VERDICT_ICON[report.verdict]}
            <div>
              <strong>{report.verdict === 'ready' ? V.ready : report.verdict === 'review' ? V.review : V.notReady}</strong>
              <p>{report.verdict === 'ready' ? V.readyText : report.verdict === 'review' ? V.reviewText : V.notReadyText}</p>
            </div>
          </div>
          {problems.length > 0 && (
            <section className="tramite-group">
              <h4>{T.toReview}</h4>
              {problems.map((item) => (
                <CheckRow key={item.id} check={item} doc={doc} recheck={recheck} />
              ))}
            </section>
          )}
          {report.signatures.length > 0 && (
            <section className="tramite-group">
              <h4>{T.signaturesTitle}</h4>
              {report.signatures.map((item, index) => (
                <SignatureCard key={index} item={item} />
              ))}
            </section>
          )}
          {passed.length > 0 && (
            <section className="tramite-group">
              <h4>{T.passed}</h4>
              {passed.map((item) => (
                <CheckRow key={item.id} check={item} doc={doc} recheck={recheck} />
              ))}
            </section>
          )}
          <p className="hint">{T.note}</p>
        </>
      )}
    </Dialog>
  )
}

registerDialog('tramite', TramiteDialog)
