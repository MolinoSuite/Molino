import '@fontsource-variable/inter'
import '../../styles/tokens.css'
import '../../styles/base.css'
import '../../styles/shell.css'
import './presenter.css'
import { createRoot } from 'react-dom/client'
import { env, L, lang } from '../i18n'
import { PresenterApp } from './PresenterApp'

/**
 * La vista del moderador de Presentaciones: su propia ventana
 * (officepresenter.ts la abre en molino://office/__molino__/ui/presenter.html).
 * Con el tema y el color de Presentaciones.
 */
const root = document.documentElement
root.lang = lang
root.dataset.theme = env.dark ? 'dark' : 'light'
root.dataset.app = 'slide'
document.title = L.officeSlide.presenter.title
const accent = new URLSearchParams(location.search).get('accent') ?? ''
if (/^#[0-9a-f]{6}$/i.test(accent)) root.style.setProperty('--accent', accent)
window.molinoOffice.onTheme((dark) => {
  root.dataset.theme = dark ? 'dark' : 'light'
})

const mount = document.getElementById('root')
if (mount) createRoot(mount).render(<PresenterApp />)
