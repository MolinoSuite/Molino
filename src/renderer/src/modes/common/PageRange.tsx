import { Field, Segmented } from '@/components/ui'
import { fmt, L } from '@/i18n'
import { parsePageList } from '@/lib/pageRange'
import type { DocView } from '@/state/app'

/** Qué páginas trata una herramienta: todas, la que se está viendo o una lista escrita («1-3, 5»). */
export interface PageRange {
  mode: 'all' | 'current' | 'some'
  text: string
}

export const ALL_PAGES: PageRange = { mode: 'all', text: '' }

/** Identificadores de las páginas elegidas, en el orden del documento; null si la lista no es válida. */
export function rangePages(doc: DocView, range: PageRange): string[] | null {
  if (range.mode === 'all') return doc.pages.map((page) => page.id)
  if (range.mode === 'current') return doc.pages.some((page) => page.id === doc.current) ? [doc.current] : null
  const picked = parsePageList(range.text, doc.pages.length)
  return picked ? [...picked].sort((a, b) => a - b).map((index) => doc.pages[index].id) : null
}

/** Elección de páginas para los diálogos de herramientas (marca de agua, numeración, OCR…). */
export function PageRangeField({ doc, value, onChange }: { doc: DocView; value: PageRange; onChange: (range: PageRange) => void }) {
  const T = L.modes.pageRange
  const current = doc.pages.findIndex((page) => page.id === doc.current) + 1
  const invalid = value.mode === 'some' && value.text.trim() !== '' && rangePages(doc, value) === null
  return (
    <Field label={L.common.pages}>
      <div className="row">
        <Segmented
          value={value.mode}
          options={[
            { value: 'all', label: fmt(T.all, { n: doc.pages.length }) },
            { value: 'current', label: fmt(T.current, { n: Math.max(current, 1) }) },
            { value: 'some', label: T.some }
          ]}
          onChange={(mode) => onChange({ ...value, mode })}
        />
        {/* Escribir aquí elige «Estas»; solo enfocarlo, no (el diálogo enfoca el primer campo al abrirse). */}
        <input
          className="input sm grow"
          aria-label={T.label}
          placeholder={T.placeholder}
          maxLength={200}
          value={value.text}
          onChange={(event) => onChange({ mode: 'some', text: event.target.value })}
        />
      </div>
      {invalid && <span className="error-text">{fmt(T.error, { count: doc.pages.length })}</span>}
    </Field>
  )
}
