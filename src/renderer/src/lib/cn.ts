/**
 * Une nombres de clases, saltando los vacíos. Va aparte de util.ts (que carga
 * los textos de Molino PDF) para que lo puedan usar también las ventanas de
 * Documentos, Hojas y Presentaciones, que tienen su propio preload.
 */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}
