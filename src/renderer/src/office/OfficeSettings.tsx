/**
 * Ajustes de Documentos, Hojas y Presentaciones (menú del icono de la app): lo
 * que les toca de los ajustes de Molino, que son los mismos en todas las apps.
 * El tema cambia al momento en todas las ventanas; el idioma, al volver a
 * abrir Molino. La IA tiene sus ajustes en Molino PDF (modelos y descarga).
 */
import { Settings2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { OfficeSettingsInfo } from '@shared/officeui'
import { Dialog, Field, Segmented } from '@/components/ui'
import { env, fmt, L } from './i18n'

const S = L.office.settings

export function OfficeSettings({ onClose }: { onClose: () => void }) {
  const [info, setInfo] = useState<OfficeSettingsInfo | null>(null)
  const [author, setAuthor] = useState('')
  const [words, setWords] = useState<string[]>([])

  useEffect(() => {
    void window.molinoOffice.settings().then((value) => {
      setInfo(value)
      setAuthor(value.author)
    })
    void window.molinoOffice.dictionary().then(setWords)
  }, [])

  const change = async (patch: Partial<Pick<OfficeSettingsInfo, 'theme' | 'language' | 'author'>>): Promise<void> => {
    setInfo(await window.molinoOffice.setSettings(patch))
  }
  const remove = async (word: string): Promise<void> => setWords(await window.molinoOffice.removeFromDictionary([word]))
  const sorted = [...words].sort((a, b) => a.localeCompare(b, env.locale))

  return (
    <Dialog
      title={S.title}
      onClose={onClose}
      footer={
        <button className="btn primary" onClick={onClose}>
          {S.done}
        </button>
      }
    >
      {info && (
        <div className="office-settings">
          <Field label={S.theme}>
            <Segmented
              value={info.theme}
              onChange={(theme) => void change({ theme })}
              options={[
                { value: 'system', label: S.themes.system },
                { value: 'light', label: S.themes.light },
                { value: 'dark', label: S.themes.dark }
              ]}
            />
          </Field>
          <Field label={S.language} hint={S.languageHint}>
            <select className="input" aria-label={S.language} value={info.language} onChange={(e) => void change({ language: e.target.value as OfficeSettingsInfo['language'] })}>
              <option value="auto">{S.languages.auto}</option>
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </Field>
          <Field label={S.author} hint={S.authorHint}>
            <input
              className="input"
              aria-label={S.author}
              value={author}
              maxLength={100}
              placeholder={info.authorDefault}
              onChange={(e) => setAuthor(e.target.value)}
              onBlur={() => author.trim() !== info.author && void change({ author: author.trim() })}
            />
          </Field>
          <Field label={S.ai} hint={info.ai.ready ? S.aiReady : info.ai.on ? S.aiNotReady : S.aiOff}>
            <div className="row">
              <button className="btn sm" onClick={() => void window.molinoOffice.ai.settings()}>
                <Settings2 size={14} />
                {S.aiSettings}
              </button>
            </div>
          </Field>
          <Field label={S.dictionary} hint={words.length === 0 ? S.dictionaryEmpty : fmt(S.dictionaryCount, { n: words.length })}>
            {sorted.length > 0 && (
              <ul className="user-words" aria-label={S.dictionary}>
                {sorted.map((word) => (
                  <li key={word}>
                    <span>{word}</span>
                    <button className="icon-btn sm" aria-label={fmt(S.dictionaryRemove, { word })} onClick={() => void remove(word)}>
                      <X size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Field>
        </div>
      )}
    </Dialog>
  )
}
