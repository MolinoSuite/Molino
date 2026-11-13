import '@fontsource-variable/inter'
import '../styles/tokens.css'
import '../styles/base.css'
import '../styles/shell.css'
import '../styles/settings.css'
import './office.css'
import { createRoot } from 'react-dom/client'
import { lookOf } from '@shared/appearance'
import type { Settings } from '@shared/types'
import { setCurrentApp } from '@/lib/currentApp'
import { followAi } from '@/state/ai'
import { useApp } from '@/state/app'
import { followOffice } from '@/state/office'
import { followUpdates } from '@/state/updates'
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
// Lo común a todas las apps (Ajustes, Acerca de…) dice el nombre de esta y enseña lo suyo.
setCurrentApp(env.kind)

/** El color de esta app (Ajustes → Apariencia; si no se ha cambiado, el de su icono). */
function applyAccent(settings: Settings): void {
  root.style.setProperty('--accent', lookOf(settings, env.kind).accent)
}

// Los ajustes de Molino (los mismos en todas sus apps), la IA y las versiones nuevas, como en Molino PDF.
void window.molino.settings.get().then((settings) => settings && useApp.getState().setSettings(settings))
window.molino.settings.onChanged((settings) => useApp.getState().setSettings(settings))
useApp.subscribe((state, before) => {
  if (state.settings !== before.settings) applyAccent(state.settings)
})
followAi()
followUpdates()
followOffice()

const mount = document.getElementById('root')
if (mount) createRoot(mount).render(<OfficeApp />)
