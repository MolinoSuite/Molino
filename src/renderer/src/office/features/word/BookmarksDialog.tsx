import { useState } from 'react'
import { Dialog, Field } from '@/components/ui'
import { cn } from '@/lib/cn'
import { L } from '../../i18n'
import type { Api, DialogProps } from '../types'
import { extraOf } from './data'

const B = L.officeWord.bookmarks

/** Los marcadores que ve el usuario (sin los internos del editor ni los ocultos, como «_Toc…»). */
export function bookmarkNames(api: Api): string[] {
  const out: string[] = []
  try {
    const manager = api.asc_GetBookmarksManager()
    const count = Math.min(manager.asc_GetCount(), 2000)
    for (let i = 0; i < count; i++) {
      const name = String(manager.asc_GetName(i))
      if (!manager.asc_IsInternalUseBookmark(name) && !manager.asc_IsHiddenBookmark(name)) out.push(name)
    }
  } catch {
    /* sin marcadores */
  }
  return out.sort((a, b) => a.localeCompare(b))
}

/**
 * Marcadores, como el cuadro de Word: escribir un nombre y «Añadir» lo pone
 * donde está el cursor (o en lo seleccionado); de la lista, «Ir a» o «Eliminar».
 */
export function BookmarksDialog({ session, state, close }: DialogProps) {
  const api = session.featureContext().api
  const [name, setName] = useState('')
  const [picked, setPicked] = useState<string | null>(null)
  // Se vuelven a leer cuando el editor avisa de un cambio (extra.bookmarks sube).
  void extraOf(state).bookmarks
  const names = bookmarkNames(api)
  const manager = api.asc_GetBookmarksManager()
  const clean = name.trim()
  const exists = clean !== '' && Boolean(manager.asc_HaveBookmark(clean))
  const valid = clean !== '' && (exists || Boolean(manager.asc_CheckNewBookmarkName(clean)))
  const chosen = picked ?? (exists ? clean : null)

  const add = (): void => {
    if (!valid) return
    manager.asc_AddBookmark(clean)
    setPicked(clean)
  }
  return (
    <Dialog
      title={B.title}
      onClose={close}
      footer={
        <>
          <button
            className="btn ghost"
            disabled={!chosen}
            onClick={() => {
              if (!chosen) return
              manager.asc_RemoveBookmark(chosen)
              setPicked(null)
              setName('')
            }}
          >
            {B.remove}
          </button>
          <span className="grow" />
          <button
            className="btn"
            disabled={!chosen}
            onClick={() => {
              if (!chosen) return
              manager.asc_SelectBookmark(chosen)
              close()
              session.focus()
            }}
          >
            {B.go}
          </button>
          <button className="btn primary" disabled={!valid} onClick={add}>
            {B.add}
          </button>
        </>
      }
    >
      <form
        className="office-prompt office-word-bookmarks"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <Field label={B.name} hint={clean && !valid ? B.invalid : exists ? B.exists : B.nameHint}>
          <input
            className="input"
            value={name}
            maxLength={40}
            spellCheck={false}
            onChange={(e) => {
              setName(e.target.value)
              setPicked(null)
            }}
          />
        </Field>
        <Field label={B.list}>
          <div className="office-word-list" role="listbox" aria-label={B.list}>
            {names.length === 0 && <p className="hint">{B.empty}</p>}
            {names.map((n) => (
              <button
                key={n}
                type="button"
                role="option"
                aria-selected={n === chosen}
                className={cn('office-word-list-item', n === chosen && 'on')}
                onClick={() => {
                  setPicked(n)
                  setName(n)
                }}
                onDoubleClick={() => {
                  manager.asc_SelectBookmark(n)
                  close()
                  session.focus()
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  )
}
