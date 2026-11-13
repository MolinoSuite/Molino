/**
 * «Fuentes que faltan»: el aviso sobre el documento cuando nombra fuentes que
 * no están en el equipo, y el cuadro que dice qué se puede hacer con cada una
 * (instalar solo en Molino las libres del catálogo; las de Microsoft no se
 * pueden descargar). Lo hace el proceso principal (fontcatalog.ts).
 */
import { Type } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { OfficeFontInfo, OfficeTab } from '@shared/officeui'
import { Checkbox, Dialog } from '@/components/ui'
import { env, fmt, L } from './i18n'

const F = L.office.fonts

const size = (bytes: number): string =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toLocaleString(env.locale, { maximumFractionDigits: 1 })} MB`
    : `${Math.max(1, Math.round(bytes / 1024)).toLocaleString(env.locale)} KB`

/** «Montserrat, Lora y 2 más». */
function names(list: string[]): string {
  const shown = list.slice(0, 3).join(', ')
  return list.length > 3 ? fmt(F.more, { fonts: shown, n: list.length - 3 }) : shown
}

export function FontsNotice({ tab, onFind }: { tab: OfficeTab; onFind: () => void }) {
  if (tab.missingFonts.length === 0) return null
  return (
    <div className="notice office-fonts-notice" role="status">
      <Type size={16} />
      <span className="grow">{fmt(F.notice, { fonts: names(tab.missingFonts) })}</span>
      <button className="btn sm primary" onClick={onFind}>
        {F.find}
      </button>
      <button className="btn sm ghost" onClick={() => void window.molinoOffice.dismissFonts(tab.doc, false)}>
        {F.notNow}
      </button>
    </div>
  )
}

export function FontsDialog({ doc, onClose }: { doc: string; onClose: () => void }) {
  const [info, setInfo] = useState<{ fonts: OfficeFontInfo[] } | null>(null)
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [dontAsk, setDontAsk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ installed: string[]; failed: string[] } | null>(null)

  useEffect(() => {
    void window.molinoOffice.fontsInfo(doc).then((value) => {
      setInfo(value)
      setChosen(new Set(value.fonts.filter((f) => f.status === 'free').map((f) => f.name)))
    })
  }, [doc])

  const close = (): void => {
    if (!result && dontAsk) void window.molinoOffice.dismissFonts(doc, true)
    onClose()
  }
  const install = async (): Promise<void> => {
    setBusy(true)
    try {
      setResult(await window.molinoOffice.installFonts(doc, [...chosen]))
    } finally {
      setBusy(false)
    }
  }
  const free = info?.fonts.filter((f) => f.status === 'free') ?? []

  return (
    <Dialog
      title={F.title}
      onClose={close}
      footer={
        result ? (
          <button className="btn primary" onClick={onClose}>
            {F.close}
          </button>
        ) : (
          <>
            <button className="btn ghost" onClick={close} disabled={busy}>
              {F.cancel}
            </button>
            {free.length > 0 && (
              <button className="btn primary" disabled={busy || chosen.size === 0} onClick={() => void install()}>
                {busy ? F.installing : fmt(F.install, { n: chosen.size })}
              </button>
            )}
          </>
        )
      }
    >
      <div className="office-fonts">
        {result ? (
          <>
            {result.installed.length > 0 && <p>{fmt(F.done, { fonts: names(result.installed) })}</p>}
            {result.failed.length > 0 && <p className="error-text">{fmt(F.failed, { fonts: names(result.failed) })}</p>}
          </>
        ) : !info ? (
          <p className="hint">…</p>
        ) : (
          <>
            <ul className="office-fonts-list">
              {info.fonts.map((font) => (
                <li key={font.name}>
                  {font.status === 'free' ? (
                    <Checkbox
                      checked={chosen.has(font.name)}
                      disabled={busy}
                      onChange={(on) => {
                        const next = new Set(chosen)
                        if (on) next.add(font.name)
                        else next.delete(font.name)
                        setChosen(next)
                      }}
                    >
                      <b>{font.name}</b>
                    </Checkbox>
                  ) : (
                    <b>{font.name}</b>
                  )}
                  <span className="hint">
                    {font.status === 'free'
                      ? fmt(F.free, { license: F.licenses[font.license], size: size(font.size) })
                      : font.status === 'microsoft'
                        ? `${F.microsoft}${font.substitute ? ` ${fmt(F.substitute, { font: font.substitute })}` : ''}`
                        : F.unknown}
                  </span>
                </li>
              ))}
            </ul>
            <Checkbox checked={dontAsk} onChange={setDontAsk} disabled={busy}>
              {F.dontAsk}
            </Checkbox>
          </>
        )}
      </div>
    </Dialog>
  )
}
