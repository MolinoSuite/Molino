import { CircleAlert, CircleCheck, CircleX, TriangleAlert } from 'lucide-react'
import { L } from '@/i18n'

/**
 * El estado de una firma tal como lo da el motor (sign.validate y
 * tramite.check, engine/molino_engine/sign/validation.py). Lo usan «Firmas
 * digitales del documento» y «Comprobar para un trámite».
 */
export interface SignatureStatus {
  field: string
  type?: 'signature' | 'timestamp'
  signer: { cn?: string; serialNumber?: string; organization?: string }
  issuer: { cn?: string }
  signedAt: string | null
  timestamp: { time: string; valid: boolean; trusted?: boolean } | null
  intact: boolean
  trusted: boolean
  coverage: string
  modifiedAfter: boolean
  modification?: 'none' | 'formfill' | 'annotations' | 'other'
  /** Hasta cuándo vale el certificado de quien firma y si ya ha caducado (hoy). */
  certValidUntil?: string | null
  certExpired?: boolean | null
  summary: 'valid' | 'warning' | 'invalid' | 'unknown'
  messages: string[]
}

export const STATUS_ICON = {
  valid: <CircleCheck size={18} />,
  warning: <TriangleAlert size={18} />,
  invalid: <CircleX size={18} />,
  unknown: <CircleAlert size={18} />
}

/** Titular de cada firma. No se llama «válida» a una firma cuyo firmante no se ha podido identificar. */
export function statusText(item: SignatureStatus): string {
  const stamp = item.type === 'timestamp'
  switch (item.summary) {
    case 'valid':
      return stamp ? L.sign.check.status.timestampValid : L.sign.check.status.valid
    case 'warning':
      if (stamp) return L.sign.check.status.timestampWarning
      return item.trusted ? L.sign.check.status.warning : L.sign.check.status.unverified
    case 'invalid':
      return stamp ? L.sign.check.status.timestampInvalid : L.sign.check.status.invalid
    default:
      return L.sign.check.status.unknown
  }
}

/** Quién firma: su nombre y su documento (sin el prefijo de tipo y país: IDCES-, PNOES-…). */
export function signerText(item: SignatureStatus): string {
  const name = item.signer.cn ?? (item.type === 'timestamp' ? L.sign.check.timestampAuthority : L.sign.check.unknownSigner)
  return item.signer.serialNumber ? `${name} · ${item.signer.serialNumber.replace(/^(IDC|PNO|PAS|TIN|VAT|NTR)[A-Z]{2}-/, '')}` : name
}
