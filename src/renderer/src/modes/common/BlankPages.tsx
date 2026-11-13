import { Segmented } from '@/components/ui'
import { L } from '@/i18n'
import { NumberField } from './controls'

/** Tamaños de papel para páginas en blanco, en puntos y en vertical. */
const PAPERS = {
  A4: [595.276, 841.89],
  A3: [841.89, 1190.551],
  A5: [419.528, 595.276],
  letter: [612, 792],
  legal: [612, 1008]
} as const

export type Paper = keyof typeof PAPERS | 'same'

/** Páginas en blanco: papel (o «como la página anterior»), orientación y cuántas. */
export interface BlankPages {
  paper: Paper
  landscape: boolean
  count: number
}

/** Tamaño en puntos; null con «como la página anterior» (lo decide el motor). */
export function blankSize(value: BlankPages): { width: number; height: number } | null {
  if (value.paper === 'same') return null
  const [width, height] = PAPERS[value.paper]
  return value.landscape ? { width: height, height: width } : { width, height }
}

/** Campos de un documento en blanco nuevo o de las páginas en blanco que se insertan. */
export function BlankPagesFields({ value, onChange, allowSame }: { value: BlankPages; onChange: (value: BlankPages) => void; allowSame?: boolean }) {
  const T = L.modes.blankPages
  return (
    <>
      <div className="row">
        <span className="grow">{T.paper}</span>
        <select
          className="select sm"
          style={{ width: 220 }}
          aria-label={T.paper}
          value={value.paper}
          onChange={(event) => onChange({ ...value, paper: event.target.value as Paper })}
        >
          {allowSame && <option value="same">{T.papers.same}</option>}
          {(Object.keys(PAPERS) as (keyof typeof PAPERS)[]).map((paper) => (
            <option key={paper} value={paper}>
              {T.papers[paper]}
            </option>
          ))}
        </select>
      </div>
      {value.paper !== 'same' && (
        <div className="row">
          <span className="grow">{T.orientation}</span>
          <Segmented
            value={value.landscape ? 'landscape' : 'portrait'}
            options={[
              { value: 'portrait', label: T.portrait },
              { value: 'landscape', label: T.landscape }
            ]}
            onChange={(orientation) => onChange({ ...value, landscape: orientation === 'landscape' })}
          />
        </div>
      )}
      <div className="row">
        <span className="grow">{T.count}</span>
        <NumberField value={value.count} min={1} max={500} width={72} onChange={(count) => onChange({ ...value, count: Math.round(count) })} />
      </div>
    </>
  )
}
