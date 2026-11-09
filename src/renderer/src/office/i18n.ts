import { fmt, messagesFor } from '@shared/i18n'

/** Idioma, tema y app de esta ventana (los decide el proceso principal al abrirla). */
export const env = window.molinoOffice.env
export const lang = env.lang
export const L = messagesFor(lang)
export { fmt }
