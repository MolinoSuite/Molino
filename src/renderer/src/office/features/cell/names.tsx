import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Field } from '@/components/ui'
import { L } from '../../i18n'
import type { Api, PanelProps } from '../types'
import { nameProblem, validRef } from './commands'

const N = L.officeCell.names

interface DefinedName {
  name: string
  ref: string
  /** La hoja (su índice) o null: todo el libro. */
  scope: number | null
  type: number | null
}

/** Los nombres definidos del libro (sin los ocultos ni los de las tablas, como Excel). */
function readNames(api: Api, A: Api): DefinedName[] {
  try {
    const list: Api[] = api.asc_getDefinedNames(A.c_oAscGetDefinedNamesList.All) || []
    return list
      .filter((n) => !n.asc_getIsHidden?.() && n.asc_getType?.() !== A.c_oAscDefNameType.table && n.asc_getType?.() !== A.c_oAscDefNameType.slicer)
      .map((n) => ({ name: String(n.asc_getName(true)), ref: String(n.asc_getRef() ?? ''), scope: n.asc_getScope() ?? null, type: n.asc_getType() ?? null }))
      .sort((a, b) => a.name.localeCompare(b.name))
  } catch {
    return []
  }
}

/**
 * El administrador de nombres, en el panel lateral: los nombres del libro, y
 * añadir, cambiar o eliminar uno. Se vuelve a leer cuando el editor avisa de
 * que la lista ha cambiado (state.extra.names sube).
 */
export function NamesPanel({ session, state, run }: PanelProps) {
  const ctx = useMemo(() => session.featureContext(), [session])
  const version = Number(state.extra.names ?? 0)
  const names = useMemo(() => readNames(ctx.api, ctx.ew.Asc), [ctx, version, state.activeSheet])
  const sheets = state.sheets
  /** Lo que se está escribiendo: uno nuevo (old null) o uno que se cambia. */
  const [form, setForm] = useState<{ old: DefinedName | null; name: string; ref: string; scope: number | null } | null>(null)

  const selection = (): string => {
    try {
      const def = ctx.api.asc_getDefaultDefinedName()
      return String(def?.asc_getRef() ?? '')
    } catch {
      return ''
    }
  }
  const startNew = (): void => setForm({ old: null, name: '', ref: selection(), scope: null })
  const problem = form ? nameProblem(ctx, form.name.trim(), form.scope, form.old ? form.old.name : null) : ''
  const refOk = form ? Boolean(form.ref.trim()) && validRef(ctx, form.ref.trim().replace(/^=/, '')) : false
  const save = (): void => {
    if (!form || problem || !refOk || !form.name.trim()) return
    if (form.old) run('nameEdit', JSON.stringify({ old: form.old, name: form.name.trim(), ref: form.ref.trim() }))
    else run('nameAdd', JSON.stringify({ name: form.name.trim(), ref: form.ref.trim(), scope: form.scope }))
    setForm(null)
  }
  const scopeName = (scope: number | null): string => (scope === null ? N.workbook : (sheets.find((s) => s.index === scope)?.name ?? state.hiddenSheets.find((s) => s.index === scope)?.name ?? String(scope + 1)))

  return (
    <div className="cell-names">
      <p className="hint">{N.intro}</p>
      {form ? (
        <form
          className="cell-names-form"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <Field label={N.name} hint={form.name.trim() && problem ? (problem === 'used' ? N.usedName : N.badName) : undefined}>
            <input className="input sm" autoFocus value={form.name} maxLength={255} spellCheck={false} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label={N.ref} hint={form.ref.trim() && !refOk ? N.badRef : N.refHint}>
            <input className="input sm" value={form.ref} maxLength={2000} spellCheck={false} onChange={(e) => setForm({ ...form, ref: e.target.value })} />
          </Field>
          <button type="button" className="btn sm ghost" onClick={() => setForm({ ...form, ref: selection() })}>
            {N.selection}
          </button>
          {!form.old && (
            <Field label={N.scope}>
              <select className="input sm" value={form.scope === null ? '' : String(form.scope)} onChange={(e) => setForm({ ...form, scope: e.target.value === '' ? null : Number(e.target.value) })}>
                <option value="">{N.workbook}</option>
                {sheets.map((s) => (
                  <option key={s.index} value={s.index}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <div className="row">
            <span className="grow" />
            <button type="button" className="btn sm" onClick={() => setForm(null)}>
              {N.cancel}
            </button>
            <button type="submit" className="btn sm primary" disabled={!form.name.trim() || Boolean(problem) || !refOk}>
              {N.save}
            </button>
          </div>
        </form>
      ) : (
        <button className="btn sm" onClick={startNew}>
          <Plus size={14} />
          {N.add}
        </button>
      )}
      {names.length === 0 ? (
        <p className="hint">{N.empty}</p>
      ) : (
        <ul className="cell-names-list" aria-label={N.title}>
          {names.map((n) => (
            <li key={`${n.scope ?? 'wb'}:${n.name}`}>
              <div className="cell-names-text">
                <b>{n.name}</b>
                <span className="hint">{n.ref}</span>
                <span className="hint">{scopeName(n.scope)}</span>
              </div>
              <button className="icon-btn sm" aria-label={`${N.edit}: ${n.name}`} data-tip={N.edit} onClick={() => setForm({ old: n, name: n.name, ref: n.ref, scope: n.scope })}>
                <Pencil size={14} />
              </button>
              <button className="icon-btn sm" aria-label={`${N.delete}: ${n.name}`} data-tip={N.delete} onClick={() => run('nameDelete', JSON.stringify(n))}>
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
