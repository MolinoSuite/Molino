import '@fontsource-variable/inter'
import '../styles/tokens.css'
import '../styles/base.css'
import '../styles/shell.css'
import './home.css'
import { createRoot } from 'react-dom/client'
import { Home } from './Home'
import { env } from './i18n'

/** «Molino», el inicio común (main/home.ts lo abre en molino://app/home.html). */
const root = document.documentElement
root.lang = env.lang
root.dataset.theme = env.dark ? 'dark' : 'light'
window.molinoHome.onTheme((dark) => {
  root.dataset.theme = dark ? 'dark' : 'light'
})
document.title = 'Molino'

const mount = document.getElementById('root')
if (mount) createRoot(mount).render(<Home />)
