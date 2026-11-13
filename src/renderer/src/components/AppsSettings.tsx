import { ExternalLink, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { OfficeApp } from '@shared/office'
import { Field } from '@/components/ui'
import { fmt, L, locale } from '@/i18n'
import { useOffice } from '@/state/office'

const OFFICE_APPS: OfficeApp[] = ['word', 'cell', 'slide']

/**
 * Ajustes → Aplicaciones (solo en Molino Suite, que trae Documentos, Hojas y
 * Presentaciones): abrir cada una, elegirla en Windows para sus archivos,
 * «Molino» (el inicio común) y el diccionario personal del corrector.
 */
export function AppsSettings() {
  const status = useOffice((s) => s.status)
  const T = L.dialogs.settings.apps
  if (!status?.available) return null

  return (
    <>
      <Field label={T.title}>
        <span className="hint">{T.intro}</span>
        <div className="office-apps">
          {OFFICE_APPS.map((app) => (
            <div key={app} className="row">
              <span className="grow">{T.names[app]}</span>
              <button className="btn sm ghost" aria-label={fmt(T.defaultAppsTip, { name: T.names[app] })} onClick={() => void window.molino.office.defaultApps(app)}>
                <ExternalLink size={13} />
                {T.defaultApps}
              </button>
              <button className="btn sm" aria-label={`${T.open} ${T.names[app]}`} onClick={() => void window.molino.office.launch(app)}>
                {T.open}
              </button>
            </div>
          ))}
          <div className="row">
            <span className="grow">{T.home}</span>
            <button className="btn sm" aria-label={`${T.open} Molino`} onClick={() => void window.molino.office.launch('home')}>
              {T.open}
            </button>
          </div>
        </div>
        <span className="hint">{T.basedOn}</span>
      </Field>
      <PersonalDictionary />
    </>
  )
}

/** El diccionario personal del corrector: las palabras añadidas desde los editores, para verlas y quitarlas. */
function PersonalDictionary() {
  const T = L.dialogs.settings.apps
  const [words, setWords] = useState<string[] | null>(null)
  useEffect(() => {
    void window.molino.office.userWords().then((reply) => setWords(reply.ok ? reply.value : []))
  }, [])
  const remove = async (word: string): Promise<void> => {
    const reply = await window.molino.office.removeUserWords([word])
    if (reply.ok) setWords(reply.value)
  }
  if (words === null) return null
  const sorted = [...words].sort((a, b) => a.localeCompare(b, locale))
  return (
    <Field label={T.dictionary} hint={words.length === 0 ? T.dictionaryEmpty : words.length === 1 ? T.dictionaryOne : fmt(T.dictionaryCount, { n: words.length.toLocaleString(locale) })}>
      <span className="hint">{T.dictionaryHint}</span>
      {sorted.length > 0 && (
        <ul className="user-words" aria-label={T.dictionary}>
          {sorted.map((word) => (
            <li key={word}>
              <span>{word}</span>
              <button className="icon-btn sm" aria-label={fmt(T.dictionaryRemove, { word })} onClick={() => void remove(word)}>
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Field>
  )
}
