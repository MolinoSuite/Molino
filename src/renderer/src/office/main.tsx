import '@fontsource-variable/inter'
import '../styles/tokens.css'
import '../styles/base.css'
import '../styles/shell.css'
import './office.css'
import { createRoot } from 'react-dom/client'
import { env, L, lang } from './i18n'
import { OfficeApp } from './OfficeApp'

/**
 * La ventana de Documentos, Hojas o Presentaciones (officewin.ts la abre en
 * molino://office/__molino__/ui/office.html). data-molino="interfaz" le dice al
 * puente de cada editor que oculte la interfaz de ONLYOFFICE (bridge.js).
 */
const root = document.documentElement
root.lang = lang
root.dataset.molino = 'interfaz'
root.dataset.theme = env.dark ? 'dark' : 'light'
root.dataset.app = env.kind
document.title = L.office.apps[env.kind]

const mount = document.getElementById('root')
if (mount) createRoot(mount).render(<OfficeApp />)
