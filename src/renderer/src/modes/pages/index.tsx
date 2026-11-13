import { Check, CircleAlert, Copy, FileOutput, FilePlus, FileUp, Plus, RotateCcw, RotateCw, Split, Trash } from 'lucide-react'
import { type DragEvent, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { EngineErrorInfo, MutationResult, PageInfo } from '@shared/types'
import { type CustomDialogProps, registerDialog } from '@/components/Dialogs'
import { useThumb } from '@/lib/thumb'
import { Dialog, Field, MenuButton, Segmented } from '@/components/ui'
import { L, fmt, plural } from '@/i18n'
import { errorMessage, trackProgress, unwrap } from '@/lib/api'
import { parsePageList } from '@/lib/pageRange'
import { cn } from '@/lib/util'
import { viewerOf } from '@/lib/viewerControl'
import { mutate, setMode, toastError } from '@/state/actions'
import { type DocView, useApp } from '@/state/app'
import { type BlankPages, BlankPagesFields, blankSize } from '../common/BlankPages'
import { NumberField } from '../common/controls'

const CELL_WIDTH = 132
const CELL_MAX_HEIGHT = 190

const Cell = memo(function Cell({
  doc,
  page,
  index,
  selected,
  marker,
  onPick,
  onOpen,
  onRotate,
  onDelete,
  dragHandlers
}: {
  doc: string
  page: PageInfo
  index: number
  selected: boolean
  marker: 'before' | 'after' | null
  onPick: (id: string, event: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) => void
  onOpen: (id: string) => void
  onRotate: (id: string, angle: number) => void
  onDelete: (id: string) => void
  dragHandlers: {
    start: (id: string, event: DragEvent) => void
    over: (id: string, event: DragEvent) => void
    drop: (event: DragEvent) => void
    end: () => void
  }
}) {
  let width = CELL_WIDTH
  let height = (CELL_WIDTH * page.h) / page.w
  if (height > CELL_MAX_HEIGHT) {
    width = (CELL_MAX_HEIGHT * page.w) / page.h
    height = CELL_MAX_HEIGHT
  }
  const { holder, canvas } = useThumb(doc, page, width)
  return (
    <div
      className={cn('org-cell', selected && 'selected')}
      draggable
      onClick={(event) => onPick(page.id, event)}
      onDoubleClick={() => onOpen(page.id)}
      onDragStart={(event) => dragHandlers.start(page.id, event)}
      onDragOver={(event) => dragHandlers.over(page.id, event)}
      onDrop={dragHandlers.drop}
      onDragEnd={dragHandlers.end}
    >
      {marker && <span className={cn('org-insert', marker === 'after' && 'after')} />}
      <div ref={holder} className="org-frame" style={{ width, height }}>
        <canvas ref={canvas} />
      </div>
      <span className="org-num">{index + 1}</span>
      {selected && (
        <span className="org-check">
          <Check size={12} strokeWidth={3} />
        </span>
      )}
      <div className="org-actions" onClick={(event) => event.stopPropagation()}>
        <button title={L.pages.rotateLeft} onClick={() => onRotate(page.id, -90)}>
          <RotateCcw size={13} />
        </button>
        <button title={L.pages.rotateRight} onClick={() => onRotate(page.id, 90)}>
          <RotateCw size={13} />
        </button>
        <button title={L.common.delete} onClick={() => onDelete(page.id)}>
          <Trash size={13} />
        </button>
      </div>
    </div>
  )
})

/** Los archivos que salen de extraer o dividir no heredan la contraseña del original: se avisa. */
function warnUnprotected(detail: Record<string, unknown> | undefined): void {
  if (detail?.protectionDropped === true) {
    useApp.getState().toast('warning', L.pages.unprotected)
  }
}
export function PagesStage({ doc }: { doc: DocView }) {
  const [selected, setSelected] = useState<string[]>([doc.current])
  const [drop, setDrop] = useState<{ id: string; side: 'before' | 'after' } | null>(null)
  const anchor = useRef<string>(doc.current)
  const dragging = useRef<string[]>([])
  const ids = useMemo(() => doc.pages.map((p) => p.id), [doc.pages])

  // Las páginas que dejen de existir salen de la selección.
  useEffect(() => setSelected((current) => current.filter((id) => ids.includes(id))), [ids])

  const ordered = useCallback((list: string[]) => ids.filter((id) => list.includes(id)), [ids])

  const pick = useCallback(
    (id: string, event: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) => {
      if (event.shiftKey) {
        const a = ids.indexOf(anchor.current)
        const b = ids.indexOf(id)
        if (a >= 0 && b >= 0) setSelected(ids.slice(Math.min(a, b), Math.max(a, b) + 1))
        return
      }
      anchor.current = id
      if (event.ctrlKey || event.metaKey) setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]))
      else setSelected([id])
    },
    [ids]
  )

  const rotate = useCallback((list: string[], angle: number) => void mutate(doc.id, 'pages.rotate', { pages: list, angle }), [doc.id])

  const remove = useCallback(
    (list: string[]) => {
      if (list.length === 0) return
      if (list.length >= ids.length) {
        useApp.getState().toast('warning', L.pages.keepOne)
        return
      }
      void mutate<MutationResult & { structureRemoved?: boolean }>(doc.id, 'pages.delete', { pages: list }).then((result) => {
        // Para que no quede rastro de lo borrado en las etiquetas de accesibilidad,
        // el motor las quita enteras: se avisa porque afecta a todo el documento.
        if (result?.structureRemoved) {
          useApp.getState().toast('info', L.pages.tagsRemoved)
        }
      })
    },
    [doc.id, ids.length]
  )

  const open = useCallback(
    (id: string) => {
      setMode(doc.id, 'view')
      window.setTimeout(() => viewerOf(doc.id)?.scrollToPage(id), 60)
    },
    [doc.id]
  )

  // Insertar (páginas en blanco o de otro archivo) tras la selección: el diálogo
  // recibe dónde y avisa de las páginas creadas para seleccionarlas.
  const insert = (dialog: 'insertBlank' | 'insertFile'): void => {
    const last = ordered(selected).at(-1)
    const position = last ? ids.indexOf(last) + 1 : ids.length
    const data: InsertData = { before: ids[position] ?? null, onCreated: (created) => created.length > 0 && setSelected(created) }
    useApp.getState().openDialog({ type: 'custom', id: dialog, doc: doc.id, data: { ...data } })
  }

  const duplicate = async (): Promise<void> => {
    const result = await mutate<MutationResult & { created?: string[] }>(doc.id, 'pages.duplicate', { pages: ordered(selected) })
    if (result?.created?.length) setSelected(result.created)
  }

  const extract = async (): Promise<void> => {
    try {
      const outcome = unwrap(await window.molino.files.extractPages(doc.id, ordered(selected)))
      if (outcome.done) {
        useApp.getState().toast('success', plural(L.pages.extracted, selected.length))
        warnUnprotected(outcome.detail)
      }
    } catch (error) {
      toastError(error)
    }
  }

  const dragHandlers = useMemo(
    () => ({
      start: (id: string, event: DragEvent) => {
        const moving = selected.includes(id) ? ordered(selected) : [id]
        if (!selected.includes(id)) setSelected([id])
        dragging.current = moving
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('application/x-molino-pages', moving.join(','))
      },
      over: (id: string, event: DragEvent) => {
        if (dragging.current.length === 0) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect()
        const side = event.clientX < bounds.left + bounds.width / 2 ? 'before' : 'after'
        setDrop((current) => (current?.id === id && current.side === side ? current : { id, side }))
      },
      drop: (event: DragEvent) => {
        event.preventDefault()
        const moving = dragging.current
        dragging.current = []
        setDrop((target) => {
          if (target && moving.length > 0) {
            const index = ids.indexOf(target.id) + (target.side === 'after' ? 1 : 0)
            // La referencia es la primera página, a partir de ese punto, que no se está moviendo.
            const before = ids.slice(index).find((id) => !moving.includes(id)) ?? null
            void mutate(doc.id, 'pages.move', { pages: moving, before })
          }
          return null
        })
      },
      end: () => {
        dragging.current = []
        setDrop(null)
      }
    }),
    [doc.id, ids, ordered, selected]
  )

  const count = selected.length
  const some = count > 0
  return (
    <>
      <div className="toolbar" role="toolbar" aria-label={L.common.pages}>
        <button className="tool icon" data-tip={L.pages.rotateLeft} disabled={!some} onClick={() => rotate(ordered(selected), -90)}>
          <RotateCcw size={16} />
        </button>
        <button className="tool icon" data-tip={L.pages.rotateRight} disabled={!some} onClick={() => rotate(ordered(selected), 90)}>
          <RotateCw size={16} />
        </button>
        <button className="tool" data-tip={L.pages.duplicateTip} disabled={!some} onClick={() => void duplicate()}>
          <Copy size={16} />
          <span>{L.pages.duplicate}</span>
        </button>
        <button className="tool" data-tip={L.pages.extractTip} disabled={!some} onClick={() => void extract()}>
          <FileOutput size={16} />
          <span>{L.pages.extract}</span>
        </button>
        <button className="tool" data-tip={L.pages.deleteTip} disabled={!some} onClick={() => remove(ordered(selected))}>
          <Trash size={16} />
          <span>{L.common.delete}</span>
        </button>
        <div className="sep" />
        <MenuButton
          className="tool"
          tip={L.pages.insertTip}
          entries={[
            { label: L.pages.insertBlank, icon: <FilePlus size={16} />, onSelect: () => insert('insertBlank') },
            { label: L.pages.insertFile, icon: <FileUp size={16} />, onSelect: () => insert('insertFile') }
          ]}
        >
          <Plus size={16} />
          <span>{L.pages.insert}</span>
        </MenuButton>
        <button
          className="tool"
          data-tip={L.pages.splitTip}
          onClick={() => useApp.getState().openDialog({ type: 'custom', id: 'split', doc: doc.id })}
        >
          <Split size={16} />
          <span>{L.pages.split}</span>
        </button>
        <div className="sep" />
        <button className="tool" onClick={() => setSelected(count === ids.length ? [] : ids)}>
          <span>{count === ids.length ? L.pages.selectNone : L.pages.selectAll}</span>
        </button>
      </div>
      <div
        className="organizer"
        tabIndex={0}
        onClick={(event) => event.target === event.currentTarget && setSelected([])}
        onKeyDown={(event) => {
          if (event.key === 'Delete') remove(ordered(selected))
          else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
            event.preventDefault()
            setSelected(ids)
          }
        }}
      >
        <div className="organizer-grid">
          {doc.pages.map((page, index) => (
            <Cell
              key={page.id}
              doc={doc.id}
              page={page}
              index={index}
              selected={selected.includes(page.id)}
              marker={drop?.id === page.id ? drop.side : null}
              onPick={pick}
              onOpen={open}
              onRotate={(id, angle) => rotate([id], angle)}
              onDelete={(id) => remove([id])}
              dragHandlers={dragHandlers}
            />
          ))}
        </div>
      </div>
    </>
  )
}

function SplitDialog({ doc: docId }: CustomDialogProps) {
  const close = useApp((s) => s.closeDialog)
  const doc = useApp((s) => (docId ? s.docs[docId] : undefined))
  const [mode, setModeValue] = useState<'each' | 'every' | 'ranges'>('each')
  const [every, setEvery] = useState(2)
  const [ranges, setRanges] = useState('')
  const [error, setError] = useState('')
  if (!doc) return null
  const total = doc.pages.length

  const run = async (): Promise<void> => {
    const options: Record<string, unknown> = { mode, prefix: doc.state.name.replace(/\.pdf$/i, '') }
    if (mode === 'every') options.every = every
    if (mode === 'ranges') {
      const parsed: [number, number][] = []
      for (const part of ranges.split(',').map((p) => p.trim()).filter(Boolean)) {
        const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part)
        const from = match ? parseInt(match[1], 10) : 0
        const to = match ? parseInt(match[2] ?? match[1], 10) : 0
        if (!match || from < 1 || to < from || to > total) {
          setError(fmt(L.pages.splitDialog.badRange, { part, total }))
          return
        }
        parsed.push([from - 1, to - 1])
      }
      if (parsed.length === 0) {
        setError(L.pages.splitDialog.noRanges)
        return
      }
      options.ranges = parsed
    }
    close()
    const tracker = trackProgress((info) =>
      useApp.getState().setBusy({ title: L.pages.splitDialog.busy, message: info.message, progress: info.total ? info.done / info.total : null })
    )
    useApp.getState().setBusy({ title: L.pages.splitDialog.busy, message: '', progress: null })
    try {
      const outcome = unwrap(await window.molino.files.splitPages(doc.id, options, tracker.callId))
      if (outcome.done) {
        useApp.getState().toast('success', plural(L.pages.splitDialog.created, outcome.files?.length ?? 0))
        warnUnprotected(outcome.detail)
      }
    } catch (err) {
      toastError(err)
    } finally {
      tracker.done()
      useApp.getState().setBusy(null)
    }
  }

  return (
    <Dialog
      title={L.pages.splitDialog.title}
      onClose={close}
      footer={
        <>
          <button className="btn" onClick={close}>
            {L.common.cancel}
          </button>
          <button className="btn primary" onClick={() => void run()}>
            {L.pages.splitDialog.run}
          </button>
        </>
      }
    >
      <Segmented
        full
        value={mode}
        options={[
          { value: 'each', label: L.pages.splitDialog.each },
          { value: 'every', label: L.pages.splitDialog.every },
          { value: 'ranges', label: L.pages.splitDialog.ranges }
        ]}
        onChange={(value) => {
          setModeValue(value)
          setError('')
        }}
      />
      {mode === 'every' && (
        <div className="row">
          <span className="grow">{L.pages.splitDialog.perFile}</span>
          <NumberField value={every} min={1} max={Math.max(1, total)} onChange={(value) => setEvery(Math.round(value))} width={72} />
        </div>
      )}
      {mode === 'ranges' && (
        <Field label={L.pages.splitDialog.rangesLabel} hint={plural(L.pages.splitDialog.rangesHint, total)}>
          <input className="input" value={ranges} placeholder={`1-3, 4-${total}`} onChange={(event) => setRanges(event.target.value)} />
        </Field>
      )}
      {error && <span className="error-text">{error}</span>}
      <p>{L.pages.splitDialog.note}</p>
    </Dialog>
  )
}

/** Lo que reciben los diálogos de insertar: antes de qué página (null: al final) y qué hacer con las nuevas. */
interface InsertData {
  before: string | null
  onCreated: (created: string[]) => void
}

function insertData(data: Record<string, unknown> | undefined): InsertData {
  return {
    before: typeof data?.before === 'string' ? data.before : null,
    onCreated: typeof data?.onCreated === 'function' ? (data.onCreated as InsertData['onCreated']) : () => undefined
  }
}

function InsertBlankDialog({ doc: docId, data }: CustomDialogProps) {
  const close = useApp((s) => s.closeDialog)
  const doc = useApp((s) => (docId ? s.docs[docId] : undefined))
  const [value, setValue] = useState<BlankPages>({ paper: 'same', landscape: false, count: 1 })
  if (!doc) return null
  const T = L.pages.insertBlankDialog
  const run = async (): Promise<void> => {
    close()
    const { before, onCreated } = insertData(data)
    const result = await mutate<MutationResult & { created?: string[] }>(doc.id, 'pages.insertBlank', { before, count: value.count, ...blankSize(value) })
    if (result?.created) onCreated(result.created)
  }
  return (
    <Dialog
      title={T.title}
      onClose={close}
      footer={
        <>
          <button className="btn" onClick={close}>
            {L.common.cancel}
          </button>
          <button className="btn primary" data-autofocus onClick={() => void run()}>
            {T.run}
          </button>
        </>
      }
    >
      <BlankPagesFields value={value} onChange={setValue} allowSame />
    </Dialog>
  )
}

/**
 * Insertar páginas de otro archivo: todas o algunas, y con su contraseña si la
 * pide. El archivo se elige al pulsar el botón; si falta la contraseña o no
 * tiene esas páginas, el diálogo sigue abierto y se reintenta con el mismo.
 */
function InsertFileDialog({ doc: docId, data }: CustomDialogProps) {
  const close = useApp((s) => s.closeDialog)
  const doc = useApp((s) => (docId ? s.docs[docId] : undefined))
  const [mode, setModeValue] = useState<'all' | 'some'>('all')
  const [text, setText] = useState('')
  const [file, setFile] = useState<{ token: string; name: string; error: EngineErrorInfo } | null>(null)
  // El archivo elegido ha pedido contraseña (se sigue enviando aunque el error siguiente sea otro).
  const [locked, setLocked] = useState(false)
  const [password, setPassword] = useState('')
  const [failure, setFailure] = useState('')
  const [working, setWorking] = useState(false)
  if (!doc) return null
  const T = L.pages.insertFileDialog
  const pick = mode === 'some' ? parsePageList(text, null) : undefined
  const count = typeof file?.error.detail?.pages === 'number' ? file.error.detail.pages : null
  const ready = pick !== null && (!locked || password.length > 0)

  const run = async (again: boolean): Promise<void> => {
    if (pick === null || working) return
    const retry = again && file ? { token: file.token, ...(password ? { password } : {}) } : {}
    setWorking(true)
    setFailure('')
    try {
      const { before, onCreated } = insertData(data)
      const outcome = unwrap(await window.molino.files.insertPages(doc.id, before, { ...(pick ? { pick } : {}), ...retry }))
      if (!outcome) return
      if (outcome.ok) {
        close()
        useApp.getState().applyResult(doc.id, outcome.result)
        const created = (outcome.result as MutationResult & { created?: string[] }).created
        if (created) onCreated(created)
        return
      }
      const asks = outcome.error.code !== 'invalid_params'
      if (!again) setPassword('')
      setLocked((current) => (again ? current || asks : asks))
      if (outcome.error.code === 'wrong_password') setPassword('')
      setFile({ token: outcome.token, name: outcome.name, error: outcome.error })
    } catch (error) {
      // Ese archivo no sirve (no es un PDF, está dañado…): se puede elegir otro.
      setFile(null)
      setLocked(false)
      setPassword('')
      setFailure(errorMessage(error))
    } finally {
      setWorking(false)
    }
  }

  return (
    <Dialog
      title={T.title}
      onClose={close}
      footer={
        <>
          {file && (
            <button className="btn ghost" disabled={working} onClick={() => void run(false)}>
              {T.other}
            </button>
          )}
          <div className="spacer" />
          <button className="btn" onClick={close}>
            {L.common.cancel}
          </button>
          <button className="btn primary" disabled={!ready || working} onClick={() => void run(file !== null)}>
            {file ? T.retry : T.run}
          </button>
        </>
      }
    >
      <Field label={T.pagesLabel}>
        <div className="row">
          <Segmented
            value={mode}
            options={[
              { value: 'all', label: T.all },
              { value: 'some', label: T.some }
            ]}
            onChange={setModeValue}
          />
          <input
            className="input sm grow"
            aria-label={T.pagesLabel}
            placeholder={T.placeholder}
            maxLength={200}
            value={text}
            onChange={(event) => {
              setText(event.target.value)
              setModeValue('some')
            }}
          />
        </div>
        {mode === 'some' && text.trim() !== '' && pick === null && <span className="error-text">{T.badList}</span>}
      </Field>
      {file && (
        <div className="notice warn">
          <CircleAlert size={15} />
          <span>
            <b>{file.name}</b>: {file.error.message}
            {count !== null && ` ${plural(T.hasPages, count)}`}
          </span>
        </div>
      )}
      {locked && (
        <Field label={T.password}>
          <input
            className="input"
            type="password"
            autoComplete="off"
            maxLength={1024}
            value={password}
            autoFocus
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && ready && void run(true)}
          />
        </Field>
      )}
      {failure && <span className="error-text">{failure}</span>}
    </Dialog>
  )
}

registerDialog('split', SplitDialog)
registerDialog('insertBlank', InsertBlankDialog)
registerDialog('insertFile', InsertFileDialog)
