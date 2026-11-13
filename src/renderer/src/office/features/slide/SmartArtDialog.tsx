import { useEffect, useMemo, useState } from 'react'
import { Dialog } from '@/components/ui'
import { cn } from '@/lib/cn'
import { L } from '../../i18n'
import type { Api, DialogProps, FeatureContext } from '../types'

const S = L.officeSlide.smartArt

export interface SmartArtSection {
  id: number
  items: { type: string; tip: string }[]
}

/** Los SmartArt que conoce el editor, por grupos (la lista es la de su interfaz, oculta pero cargada). */
export function smartArtSections(ew: Api): SmartArtSection[] {
  try {
    const data: Api[] = ew.Common?.define?.smartArt?.getSmartArtData?.() ?? []
    return data
      .map((section) => ({
        id: Number(section.sectionId),
        items: (Array.isArray(section.items) ? section.items : [])
          .map((item: Api) => ({ type: String(item.type), tip: String(item.tip ?? '').slice(0, 120) }))
          .filter((item: { type: string }) => /^\d{1,4}$/.test(item.type))
      }))
      .filter((s) => Number.isInteger(s.id) && s.id >= 0 && s.id < 32 && s.items.length > 0)
  } catch {
    return []
  }
}

/**
 * Las vistas previas de los SmartArt: el editor las dibuja por grupos y las
 * avisa (asc_onBeginSmartArtPreview, asc_onAddSmartArtPreview,
 * asc_onEndSmartArtPreview). Se piden de una en una; las que ya están se guardan.
 */
export function smartArtPreviews(ctx: FeatureContext, section: number): void {
  const extra = ctx.state.extra
  const done = (extra.smartArtDone as number[] | undefined) ?? []
  if (done.includes(section)) return
  if (extra.smartArtBusy !== undefined) {
    extra.smartArtNext = section
    return
  }
  quietHiddenToolbar(ctx.ew)
  extra.smartArtBusy = section
  try {
    ctx.api.asc_generateSmartArtPreviews(section)
  } catch {
    extra.smartArtBusy = undefined
  }
}

/**
 * La interfaz de ONLYOFFICE (oculta) también escucha las vistas previas y falla
 * si su menú de SmartArt no se ha abierto nunca; al fallar, el editor deja de
 * avisar a los demás (a Molino). Se le da un menú vacío para que no falle.
 */
function quietHiddenToolbar(ew: Api): void {
  try {
    const toolbar = ew.PE?.getController?.('Toolbar')
    if (!toolbar || toolbar.molinoQuiet) return
    const items = Array.from({ length: 32 }, (_, id) => ({
      value: id,
      menuPicker: { loaded: false, store: { findWhere: () => undefined } },
      menu: { alignPosition: () => undefined }
    }))
    toolbar.docHolderMenu = { items }
    toolbar.molinoQuiet = true
  } catch {
    /* sin la interfaz del editor */
  }
}

/** Insertar un SmartArt: sus grupos y, de cada uno, sus diagramas con la vista previa del editor. */
export function SmartArtDialog({ session, state, run, close }: DialogProps) {
  const ctx = session.featureContext()
  const sections = useMemo(() => smartArtSections(ctx.ew), [ctx.ew])
  const [section, setSection] = useState(() => sections[0]?.id ?? 0)
  useEffect(() => {
    if (sections.length) smartArtPreviews(session.featureContext(), section)
  }, [section, sections.length, session])
  const previews = (state.extra.smartArt as Record<string, string> | undefined) ?? {}
  const current = sections.find((s) => s.id === section)
  const loading = state.extra.smartArtBusy === section
  return (
    <Dialog title={S.title} size="wide" onClose={close} footer={<button className="btn" onClick={close}>{L.office.dialogs.cancel}</button>}>
      {sections.length === 0 ? (
        <p className="hint">{S.unavailable}</p>
      ) : (
        <div className="slide-smartart">
          <nav className="slide-smartart-sections" aria-label={S.title}>
            {sections.map((s) => (
              <button key={s.id} className={cn('chip', s.id === section && 'on')} aria-pressed={s.id === section} onClick={() => setSection(s.id)}>
                {S.sections[s.id] ?? String(s.id + 1)}
              </button>
            ))}
          </nav>
          <div className="slide-smartart-grid" aria-busy={loading}>
            {current?.items.map((item) => (
              <button
                key={`${section}-${item.type}`}
                className="slide-smartart-item"
                title={item.tip}
                aria-label={item.tip || item.type}
                onClick={() => {
                  close()
                  run('smartArt', item.type)
                }}
              >
                {previews[item.type] ? <img src={previews[item.type]} alt="" /> : <span className="slide-smartart-wait" />}
                <span>{item.tip}</span>
              </button>
            ))}
          </div>
          {loading && <p className="hint">{S.loading}</p>}
        </div>
      )}
    </Dialog>
  )
}
