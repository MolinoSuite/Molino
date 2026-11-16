import { FileText, FileUp } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { OfficeOtherDocument } from '@shared/officeui'
import { Checkbox, Dialog, Field } from '@/components/ui'
import { cn } from '@/lib/cn'
import { L } from '../../i18n'
import type { Api, DialogProps } from '../types'

const C = L.officeWord.compare

interface OtherDocument {
  name: string
  api: Api
}

/**
 * Los otros documentos abiertos en esta ventana de Documentos (cada pestaña es
 * un marco con su editor, del mismo origen). Así se compara sin pedir nada al
 * proceso principal: el editor del otro da su documento en su formato interno.
 */
export function otherDocuments(self: Api): OtherDocument[] {
  const out: OtherDocument[] = []
  for (const frame of document.querySelectorAll<HTMLIFrameElement>('iframe.office-frame')) {
    try {
      const inner = frame.contentDocument?.querySelector<HTMLIFrameElement>('iframe[name="frameEditor"]')
      const w = inner?.contentWindow as Api
      const api = w && ((w.Asc && w.Asc.editor) || w.editor)
      if (api && api !== self && typeof api.asc_nativeGetFile === 'function' && w.molinoReady === true) out.push({ name: frame.title || '—', api })
    } catch {
      /* un marco que aún no ha cargado */
    }
  }
  return out
}

/**
 * Comparar (o combinar) este documento con otro: uno abierto en otra pestaña o
 * un archivo (Word, OpenDocument o RTF) que no hace falta abrir; el proceso
 * principal lo elige y el motor lo convierte. Las diferencias entran aquí como
 * cambios controlados, que se aceptan o rechazan en Revisar.
 *
 * ``value``: «compare» o «combine» y, con «File» detrás, empieza eligiendo el archivo.
 */
export function CompareDialog({ session, doc, value, close }: DialogProps) {
  const ctx = session.featureContext()
  const combine = (value ?? '').startsWith('combine')
  const [others] = useState(() => otherDocuments(ctx.api))
  // La elección: un documento abierto (su posición) o el archivo elegido.
  const [picked, setPicked] = useState<number | 'file'>(0)
  const [file, setFile] = useState<OfficeOtherDocument | null>(null)
  const [reading, setReading] = useState(false)
  const [words, setWords] = useState(true)
  const [error, setError] = useState('')
  const other = picked === 'file' ? null : others[Math.min(picked, others.length - 1)]
  const ready = picked === 'file' ? Boolean(file) : Boolean(other)

  const pickFile = async (): Promise<void> => {
    if (reading) return
    setReading(true)
    setError('')
    try {
      const got = await window.molinoOffice.compareFile(doc)
      if (got) {
        setFile(got)
        setPicked('file')
      }
    } finally {
      setReading(false)
    }
  }
  // «Comparar con un archivo…»: se abre ya el cuadro para elegirlo.
  const started = useRef(false)
  useEffect(() => {
    if (started.current || !(value ?? '').endsWith('File')) return
    started.current = true
    void pickFile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** El otro documento, como lo espera el editor (como el «onDocumentCompare» de la app de escritorio). */
  const source = (): Api | null => {
    if (picked === 'file') {
      if (!file) return null
      // Los bytes y el mapa de imágenes, hechos en la ventana del editor (otro «realm»).
      const bytes = new ctx.ew.Uint8Array(file.data.length)
      bytes.set(file.data)
      const images = ctx.local(file.images)
      return { IsValid: () => true, GetBinary: () => bytes, GetImageMap: () => images }
    }
    if (!other) return null
    let binary: unknown = null
    try {
      binary = other.api.asc_nativeGetFile()
    } catch {
      binary = null
    }
    if (typeof binary !== 'string' || !binary.startsWith('DOCY')) return null
    // Las imágenes del otro se piden con su nombre (media/…): las que también están en este se ven igual.
    return { IsValid: () => true, GetBinary: () => binary, GetImageMap: () => ({}) }
  }

  const go = (): void => {
    const src = source()
    if (!src) return setError(C.failed)
    const W = ctx.ew.AscCommonWord
    const options = new W.ComparisonOptions()
    if (typeof options.putWords === 'function') options.putWords(words)
    close()
    try {
      if (combine) W.mergeDocuments(src, options)
      else W.CompareDocuments(src, options)
    } catch (error) {
      console.error('comparar:', error)
    }
    session.focus()
  }

  return (
    <Dialog
      title={combine ? C.combineTitle : C.compareTitle}
      onClose={close}
      footer={
        <>
          <span className="grow" />
          <button className="btn" onClick={close}>
            {L.office.dialogs.cancel}
          </button>
          <button className="btn primary" disabled={!ready || reading} onClick={go}>
            {combine ? C.goCombine : C.go}
          </button>
        </>
      }
    >
      <div className="office-prompt">
        <p>{combine ? C.combineIntro : C.compareIntro}</p>
        <Field label={C.other} hint={C.otherHint}>
          <div className="office-word-list" role="listbox" aria-label={C.other}>
            {others.length === 0 && !file && <p className="hint">{C.none}</p>}
            {others.map((d, i) => (
              <button
                key={i}
                type="button"
                role="option"
                aria-selected={picked === i}
                className={cn('office-word-list-item', picked === i && 'on')}
                onClick={() => setPicked(i)}
                onDoubleClick={() => {
                  setPicked(i)
                  go()
                }}
              >
                {d.name}
              </button>
            ))}
            {file && (
              <button type="button" role="option" aria-selected={picked === 'file'} className={cn('office-word-list-item office-word-list-file', picked === 'file' && 'on')} onClick={() => setPicked('file')}>
                <FileText size={14} />
                {file.name}
              </button>
            )}
          </div>
        </Field>
        <button className="btn sm office-word-compare-file" disabled={reading} onClick={() => void pickFile()}>
          <FileUp size={14} />
          {reading ? C.reading : C.file}
        </button>
        {!combine && (
          <Checkbox checked={words} onChange={setWords}>
            {C.words}
          </Checkbox>
        )}
        {error && <p className="office-word-error">{error}</p>}
      </div>
    </Dialog>
  )
}
