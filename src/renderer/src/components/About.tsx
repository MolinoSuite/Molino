import { fmt, L, locale } from '@/i18n'
import { currentApp, withApp } from '@/lib/currentApp'
import { useOffice } from '@/state/office'
import documentsIcon from '@/home/icons/documentos.svg'
import sheetsIcon from '@/home/icons/hojas.svg'
import slidesIcon from '@/home/icons/presentaciones.svg'
import { Dialog, Logo } from './ui'

const OFFICE_ICONS = { word: documentsIcon, cell: sheetsIcon, slide: slidesIcon }

/**
 * Acerca de la app de esta ventana (Molino PDF, Documentos, Hojas o
 * Presentaciones), igual en todas, con los avisos legales que la AGPL pide
 * mostrar en una aplicación con interfaz: titular, software libre sin
 * garantía, y cómo ver la licencia y obtener el código. Las apps de oficina
 * dicen además que usan los editores de ONLYOFFICE modificados (§7).
 */
export function AboutDialog({ onClose }: { onClose: () => void }) {
  const app = currentApp()
  const { version, built } = window.molino.env
  const date = built ? new Date(`${built}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) : ''
  const T = L.dialogs.about
  const officeAvailable = useOffice((s) => s.status?.available ?? false)
  const isOffice = app !== 'pdf'
  // La versión del motor de oficina (la ventana de oficina la sabe).
  const piece = (window as unknown as { molinoOffice?: { env?: { piece?: string } } }).molinoOffice?.env?.piece ?? ''
  return (
    <Dialog
      title={withApp(T.title)}
      onClose={onClose}
      footer={
        <button className="btn primary" onClick={onClose}>
          {L.common.close}
        </button>
      }
    >
      <div className="about">
        <div className="about-head">
          <div className={isOffice ? 'about-mark office' : 'start-mark about-mark'}>
            {isOffice ? <img src={OFFICE_ICONS[app]} width={48} height={48} alt="" /> : <Logo size={48} />}
          </div>
          <div>
            <b>
              {L.common.appNames[app]} {version}
            </b>
            <span>{T.taglines[app]}</span>
            {date && <span>{fmt(T.built, { date })}</span>}
            {isOffice && piece && <span>{fmt(T.officeVersion, { version: piece })}</span>}
          </div>
        </div>
        <p>Copyright © 2026 CuevasTech.</p>
        <p>{withApp(T.license)}</p>
        <div className="row">
          <button className="btn sm" onClick={() => void window.molino.about.open('license')}>
            {T.licenseButton}
          </button>
          <button className="btn sm" onClick={() => void window.molino.about.open('source')}>
            {T.source}
          </button>
          <button className="btn sm" onClick={() => void window.molino.about.open('notices')}>
            {T.notices}
          </button>
        </div>
        {(isOffice || officeAvailable) && (
          <div className="about-office">
            <p>
              {!isOffice && (
                <>
                  <b>{T.officeTitle}</b>
                  <br />
                </>
              )}
              {isOffice ? T.officeTextOne : T.officeText} <i lang="en">Based on ONLYOFFICE software developed by Ascensio System SIA.</i>
            </p>
            <div className="row wrap">
              <button className="btn sm" onClick={() => void window.molino.about.office('notice')}>
                {T.officeNotice}
              </button>
              <button className="btn sm" onClick={() => void window.molino.about.office('license')}>
                {T.officeLicense}
              </button>
              <button className="btn sm" onClick={() => void window.molino.about.office('thirdParty')}>
                {T.notices}
              </button>
              <button className="btn sm" onClick={() => void window.molino.about.office('source')}>
                {T.officeSource}
              </button>
            </div>
            <p className="hint">{T.officeTrademark}</p>
          </div>
        )}
        <div className="about-support">
          <p>{T.support}</p>
          <div className="row">
            <button className="btn sm" onClick={() => void window.molino.about.open('sponsors')}>
              {T.coffee}
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
