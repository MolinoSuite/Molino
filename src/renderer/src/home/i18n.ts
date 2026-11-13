import { fmt, messagesFor } from '@shared/i18n'

/** Idioma y tema de la ventana (los decide el proceso principal al abrirla). */
export const env = window.molinoHome.env
export const L = messagesFor(env.lang)
export { fmt }
