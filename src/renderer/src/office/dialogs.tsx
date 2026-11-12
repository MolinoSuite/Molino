/**
 * Los cuadros de Documentos, Hojas y Presentaciones que piden algo antes de
 * hacerlo (un vínculo, un ancho, un valor…), con el aspecto de Molino. Lo que
 * hacen lo hace engine.ts; aquí solo se pregunta.
 */
import { CaseSensitive, ChevronDown, ChevronUp, Replace, WholeWord, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Dialog, Field } from '@/components/ui'
import { cn } from '@/lib/cn'
import { env, fmt, L } from './i18n'

const D = L.office.dialogs

export interface PromptField {
  key: string
  label: string
  value: string
  /** «number» con sus límites; «text» con su largo máximo. */
  type?: 'text' | 'number'
  min?: number
  max?: number
  step?: number
  maxLength?: number
  placeholder?: string
  hint?: string
  /** Lista de opciones (un desplegable en vez de un campo). */
  options?: { value: string; label: string }[]
}

export interface PromptSpec {
  title: string
  intro?: string
  fields: PromptField[]
  ok?: string
  /** Un botón más a la izquierda (p. ej. «Quitar el vínculo»). */
  extra?: { label: string; onSelect: () => void }
  onOk: (values: Record<string, string>) => void
}

/** Un cuadro con unos campos y «Aceptar»: lo usan casi todas las herramientas que preguntan algo. */
export function PromptDialog({ spec, onClose }: { spec: PromptSpec; onClose: () => void }) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(spec.fields.map((f) => [f.key, f.value])))
  const valid = spec.fields.every((f) => {
    const value = values[f.key] ?? ''
    if (f.type === 'number') {
      const n = Number(value.replace(',', '.'))
      return value.trim() !== '' && Number.isFinite(n) && (f.min === undefined || n >= f.min) && (f.max === undefined || n <= f.max)
    }
    return true
  })
  const accept = (): void => {
    if (!valid) return
    const clean = Object.fromEntries(spec.fields.map((f) => [f.key, f.type === 'number' ? String(Number((values[f.key] ?? '').replace(',', '.'))) : (values[f.key] ?? '')]))
    onClose()
    spec.onOk(clean)
  }
  return (
    <Dialog
      title={spec.title}
      onClose={onClose}
      footer={
        <>
          {spec.extra && (
            <button
              className="btn ghost"
              onClick={() => {
                onClose()
                spec.extra?.onSelect()
              }}
            >
              {spec.extra.label}
            </button>
          )}
          <span className="grow" />
          <button className="btn" onClick={onClose}>
            {D.cancel}
          </button>
          <button className="btn primary" disabled={!valid} onClick={accept}>
            {spec.ok ?? D.ok}
          </button>
        </>
      }
    >
      <form
        className="office-prompt"
        onSubmit={(e) => {
          e.preventDefault()
          accept()
        }}
      >
        {spec.intro && <p>{spec.intro}</p>}
        {spec.fields.map((f) => (
          <Field key={f.key} label={f.label} hint={f.hint}>
            {f.options ? (
              <select className="input" value={values[f.key]} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="input"
                type="text"
                inputMode={f.type === 'number' ? 'decimal' : undefined}
                value={values[f.key]}
                maxLength={f.maxLength ?? 2000}
                placeholder={f.placeholder}
                spellCheck={false}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              />
            )}
          </Field>
        ))}
        {/* Intro en un campo acepta. */}
        <button type="submit" hidden />
      </form>
    </Dialog>
  )
}

export interface FindOptions {
  matchCase: boolean
  wholeWords: boolean
}

/**
 * Buscar y reemplazar (Ctrl+F y Ctrl+H), encima del documento, arriba a la
 * derecha, como en Word. Intro busca el siguiente; Mayús+Intro, el anterior.
 */
export function FindBar({
  replace: startReplace,
  result,
  onFind,
  onReplace,
  onClose
}: {
  replace: boolean
  /** Lo que ha encontrado el editor (null: aún nada). */
  result: { current: number; total: number } | null
  onFind: (text: string, options: FindOptions, back: boolean) => void
  onReplace: (text: string, by: string, all: boolean, options: FindOptions) => void
  onClose: () => void
}) {
  const [text, setText] = useState('')
  const [by, setBy] = useState('')
  const [replacing, setReplacing] = useState(startReplace)
  const [options, setOptions] = useState<FindOptions>({ matchCase: false, wholeWords: false })
  const F = L.office.find
  useEffect(() => setReplacing((r) => r || startReplace), [startReplace])
  const find = (back = false): void => {
    if (text) onFind(text, options, back)
  }
  const toggle = (key: keyof FindOptions): void => {
    const next = { ...options, [key]: !options[key] }
    setOptions(next)
    if (text) onFind(text, next, false)
  }
  return (
    <div className="office-find" role="search" aria-label={F.title}>
      <div className="row">
        <input
          className="input sm"
          autoFocus
          value={text}
          placeholder={F.placeholder}
          aria-label={F.placeholder}
          spellCheck={false}
          maxLength={500}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              find(e.shiftKey)
            } else if (e.key === 'Escape') onClose()
          }}
        />
        <span className="hint office-find-count">{result && text ? (result.total ? fmt(F.count, { n: result.current, total: result.total }) : F.none) : ''}</span>
        <button className="icon-btn sm" aria-label={F.prev} data-tip={F.prev} disabled={!text} onClick={() => find(true)}>
          <ChevronUp size={15} />
        </button>
        <button className="icon-btn sm" aria-label={F.next} data-tip={F.next} disabled={!text} onClick={() => find(false)}>
          <ChevronDown size={15} />
        </button>
        <button className={cn('icon-btn sm', options.matchCase && 'on')} aria-label={F.matchCase} aria-pressed={options.matchCase} data-tip={F.matchCase} onClick={() => toggle('matchCase')}>
          <CaseSensitive size={15} />
        </button>
        <button className={cn('icon-btn sm', options.wholeWords && 'on')} aria-label={F.wholeWords} aria-pressed={options.wholeWords} data-tip={F.wholeWords} onClick={() => toggle('wholeWords')}>
          <WholeWord size={15} />
        </button>
        <button className={cn('icon-btn sm', replacing && 'on')} aria-label={F.showReplace} aria-pressed={replacing} data-tip={F.showReplace} onClick={() => setReplacing(!replacing)}>
          <Replace size={15} />
        </button>
        <button className="icon-btn sm" aria-label={F.close} data-tip={F.close} onClick={onClose}>
          <X size={15} />
        </button>
      </div>
      {replacing && (
        <div className="row">
          <input
            className="input sm"
            value={by}
            placeholder={F.replaceWith}
            aria-label={F.replaceWith}
            spellCheck={false}
            maxLength={500}
            onChange={(e) => setBy(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (text) onReplace(text, by, false, options)
              } else if (e.key === 'Escape') onClose()
            }}
          />
          <button className="btn sm" disabled={!text} onClick={() => onReplace(text, by, false, options)}>
            {F.replace}
          </button>
          <button className="btn sm" disabled={!text} onClick={() => onReplace(text, by, true, options)}>
            {F.replaceAll}
          </button>
        </div>
      )}
    </div>
  )
}

/** Insertar → Símbolo: una rejilla con los de cada grupo. */
export function SymbolsDialog({ onPick, onClose }: { onPick: (symbol: string) => void; onClose: () => void }) {
  return (
    <Dialog title={D.symbols} onClose={onClose}>
      <div className="office-symbols">
        {SYMBOLS.map((g) => (
          <section key={g.group}>
            <h4>{D.symbolGroups[g.group]}</h4>
            <div className="office-symbol-grid">
              {[...g.chars].map((c) => (
                <button
                  key={c}
                  className="office-symbol"
                  aria-label={c}
                  onClick={() => {
                    onClose()
                    onPick(c)
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Dialog>
  )
}

/** Contar palabras: lo que da el editor del documento entero. */
export function StatsDialog({ stats, onClose }: { stats: Record<string, number> | null; onClose: () => void }) {
  const S = D.stats
  const rows = Object.entries(S.rows) as [string, string][]
  return (
    <Dialog
      title={S.title}
      onClose={onClose}
      footer={
        <button className="btn primary" onClick={onClose}>
          {D.close}
        </button>
      }
    >
      {stats ? (
        <dl className="office-stats office-word-stats">
          {rows
            .filter(([key]) => typeof stats[key] === 'number')
            .map(([key, label]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>{new Intl.NumberFormat(env.locale).format(stats[key])}</dd>
              </div>
            ))}
        </dl>
      ) : (
        <p className="hint">{S.counting}</p>
      )}
    </Dialog>
  )
}

/** Los símbolos de «Insertar → Símbolo», por grupos. */
export const SYMBOLS: { group: keyof typeof D.symbolGroups; chars: string }[] = [
  { group: 'common', chars: '€$£¥¢©®™°±×÷≈≠≤≥½¼¾%‰§¶†•…' },
  { group: 'punctuation', chars: '«»“”‘’„‚—–¡¿·' },
  { group: 'arrows', chars: '←→↑↓↔⇐⇒⇔↵' },
  { group: 'math', chars: '∑∏√∞∫∂∆∇∈∉∩∪⊂⊃∀∃¬∧∨πµΩαβγδθλσφ' },
  { group: 'marks', chars: '✓✔✗✘★☆●○■□▲△♦◆♥☐☑☒' }
]

export interface FunctionInfo {
  /** Nombre en inglés (el que entiende el editor por dentro). */
  name: string
  /** Nombre en el idioma de la hoja (el que se escribe en la celda). */
  local: string
  group: string
  syntax: string
  description: string
}

/** Hojas → Fórmulas → Insertar función: buscar una, ver qué hace y ponerla en la celda. */
export function FunctionDialog({ functions, groups, onPick, onClose }: { functions: FunctionInfo[]; groups: { id: string; label: string }[]; onPick: (name: string) => void; onClose: () => void }) {
  const F = D.functions
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('')
  const [chosen, setChosen] = useState<string>(functions[0]?.name ?? '')
  const plain = (text: string): string => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  const words = plain(query).split(/\s+/).filter(Boolean)
  const found = functions.filter((f) => (!group || f.group === group) && words.every((w) => plain(`${f.local} ${f.name} ${f.description}`).includes(w)))
  const current = found.find((f) => f.name === chosen) ?? found[0]
  const pick = (f: FunctionInfo | undefined): void => {
    if (!f) return
    onClose()
    onPick(f.name)
  }
  return (
    <Dialog
      title={F.title}
      size="wide"
      onClose={onClose}
      footer={
        <>
          <span className="grow" />
          <button className="btn" onClick={onClose}>
            {D.cancel}
          </button>
          <button className="btn primary" disabled={!current} onClick={() => pick(current)}>
            {F.insert}
          </button>
        </>
      }
    >
      <div className="office-functions">
        <div className="row">
          <input
            className="input"
            autoFocus
            value={query}
            placeholder={F.search}
            aria-label={F.search}
            spellCheck={false}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                pick(current)
              }
            }}
          />
          <select className="input" aria-label={F.group} value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="">{F.all}</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
        <div className="office-functions-body">
          <ul role="listbox" aria-label={F.title}>
            {found.slice(0, 500).map((f) => (
              <li key={f.name} role="option" aria-selected={f === current} className={cn(f === current && 'on')} onClick={() => setChosen(f.name)} onDoubleClick={() => pick(f)}>
                {f.local}
              </li>
            ))}
            {found.length === 0 && <li className="hint">{F.none}</li>}
          </ul>
          {current && (
            <div className="office-function-help">
              <b>{current.local}</b>
              <code>{current.syntax}</code>
              <p>{current.description}</p>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  )
}
