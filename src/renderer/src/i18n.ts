import { fmt, messagesFor, pluralOf } from '@shared/i18n'

/**
 * Textos de la interfaz en el idioma de esta sesión (lo decide el proceso
 * principal al abrir Molino PDF). Uso: L.start.open, fmt(L.start.recent.filtered, {...}),
 * plural(L.common.pageCount, n).
 */
export const lang = window.molino.env.lang
export const locale = window.molino.env.locale
export const L = messagesFor(lang)
export const plural = pluralOf(lang)
export { fmt }
