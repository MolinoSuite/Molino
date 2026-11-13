import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Field } from '@/components/ui'
import { fmt, L, locale } from '@/i18n'
import { currentApp } from '@/lib/currentApp'
import { useOffice } from '@/state/office'
import documentsIcon from '@/home/icons/documentos.svg'
import sheetsIcon from '@/home/icons/hojas.svg'
import homeIcon from '@/home/icons/molino.svg'
import pdfIcon from '@/home/icons/pdf.svg'
import slidesIcon from '@/home/icons/presentaciones.svg'

type Launchable = 'pdf' | 'word' | 'cell' | 'slide' | 'home'

const APPS: { id: Launchable; icon: string }[] = [
  { id: 'pdf', icon: pdfIcon },
  { id: 'word', icon: documentsIcon },
  { id: 'cell', icon: sheetsIcon },
  { id: 'slide', icon: slidesIcon },
  { id: 'home', icon: homeIcon }
]

/**
 * Ajustes → Aplicaciones (solo en Molino Suite): cada app con su icono, para
 * abrirla o elegirla en Windows para sus archivos («Predeterminada…»).
 */
export function AppsSettings() {
  const status = useOffice((s) => s.status)
  const T = L.dialogs.settings.apps
  const here = currentApp()
  if (!status?.available) return null
  return (
    <div className="office-apps" role="list" aria-label={T.title}>
      {APPS.map(({ id, icon }) => {
        const name = L.common.appNames[id]
        return (
          <div key={id} className="office-app" role="listitem">
            <img src={icon} width={28} height={28} alt="" />
            <span className="grow">{name}</span>
            {id !== 'home' && (
              <button className="btn sm ghost" data-tip={fmt(T.defaultAppsTip, { name })} onClick={() => void window.molino.office.defaultApps(id)}>
                {T.defaultApps}
              </button>
            )}
            {id === here ? (
              <span className="hint office-app-here">{T.current}</span>
            ) : (
              <button className="btn sm" aria-label={`${T.open} ${name}`} onClick={() => void window.molino.office.launch(id)}>
                {T.open}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** Ajustes → Diccionario: las palabras añadidas al corregir en Documentos, Hojas y Presentaciones, para verlas y quitarlas. */
export function DictionarySettings() {
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
