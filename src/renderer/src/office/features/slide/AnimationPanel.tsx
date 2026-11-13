import { ArrowDown, ArrowUp, Clock, Link2, MousePointerClick, Play, Square, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Field } from '@/components/ui'
import { cn } from '@/lib/cn'
import { fmt, L, lang } from '../../i18n'
import type { Api, PanelProps } from '../types'
import { EFFECTS, effectName, GROUPS, groupOf, TRIGGERS, type Trigger } from './effects'

const A = L.officeSlide.anim

/** Un efecto de la diapositiva, como lo cuenta la API de documentos del editor. */
export interface EffectRow {
  type: string
  trigger: Trigger
  /** En milisegundos. */
  duration: number
  delay: number
  repeat: number
  shape: string
}

/**
 * Los efectos de la secuencia principal de la diapositiva actual, en orden. Si la
 * diapositiva no tiene ninguno no se pregunta: GetTimeLine y GetMainSequence los
 * crean vacíos, y crear algo fuera de un paso para deshacer es un error del editor.
 */
export function readEffects(api: Api): EffectRow[] {
  try {
    if (!api.asc_canStartAnimationPreview?.() || api.asc_IsMasterSlideMode?.()) return []
    const slide = api.getJsApi().GetPresentation().GetCurrentSlide()
    const sequence = slide?.GetTimeLine?.()?.GetMainSequence?.()
    if (!sequence) return []
    const rows: EffectRow[] = []
    const count = Math.min(Number(sequence.GetCount()) || 0, 500)
    for (let i = 0; i < count; i++) {
      const effect = sequence.GetEffect(i)
      if (!effect) continue
      const trigger = String(effect.GetTriggerType() ?? 'onclick')
      const shape = effect.GetShape?.()
      rows.push({
        type: String(effect.GetEffectType() ?? ''),
        trigger: (TRIGGERS as readonly string[]).includes(trigger) ? (trigger as Trigger) : 'onclick',
        duration: Number(effect.GetDuration()) || 0,
        delay: Number(effect.GetDelay()) || 0,
        repeat: Number(effect.GetRepeatCount()) || 1,
        shape: String(shape?.GetName?.() ?? '')
      })
    }
    return rows
  } catch {
    return []
  }
}

const TRIGGER_ICONS: Record<Trigger, typeof Clock> = { onclick: MousePointerClick, withprevious: Link2, afterprevious: Clock }

/** Segundos con coma o punto, dentro de sus límites; null si no vale. */
function seconds(text: string, min: number, max: number): number | null {
  const n = Number(text.trim().replace(',', '.'))
  return text.trim() !== '' && Number.isFinite(n) && n >= min && n <= max ? n : null
}
/** Milisegundos en segundos, como se escriben en el idioma de la interfaz (0,5). */
const SECONDS = new Intl.NumberFormat(lang, { maximumFractionDigits: 2, useGrouping: false })
const shown = (ms: number): string => SECONDS.format(ms / 1000)

/**
 * El panel de animación: los efectos de la diapositiva (efecto, cuándo empieza
 * y cuánto dura), para cambiarlos de orden, de efecto o de tiempos, quitarlos y
 * verlos. Todo lo cambia la API de documentos del editor (features/slide.tsx).
 */
export function AnimationPanel({ session, state, run }: PanelProps) {
  const api = session.featureContext().api
  const rows = readEffects(api)
  const [selected, setSelected] = useState(0)
  const index = Math.min(selected, rows.length - 1)
  const row = index >= 0 ? rows[index] : null
  const playing = Boolean(state.extra.animPlaying)
  return (
    <div className="slide-anim">
      <div className="slide-anim-head">
        <span className="hint">{rows.length === 1 ? A.one : fmt(A.count, { n: rows.length })}</span>
        <button className="btn sm" disabled={!rows.length && !playing} onClick={() => run('animPreview')}>
          {playing ? <Square size={13} /> : <Play size={13} />}
          {playing ? A.stop : A.play}
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="hint">{A.empty}</p>
      ) : (
        <ol className="slide-anim-list" aria-label={L.officeSlide.groups.animations}>
          {rows.map((r, i) => {
            const TriggerIcon = TRIGGER_ICONS[r.trigger]
            return (
              <li key={i}>
                <button className={cn('slide-anim-row', i === index && 'on')} aria-pressed={i === index} onClick={() => setSelected(i)}>
                  <span className="slide-anim-n">{i + 1}</span>
                  <span className={cn('slide-anim-dot', `slide-fx-${groupOf(r.type) ?? 'other'}`)} />
                  <span className="slide-anim-text">
                    <b>{effectName(r.type)}</b>
                    <small>{r.shape || A.noShape}</small>
                  </span>
                  <span className="slide-anim-time" title={A.triggers[r.trigger]}>
                    <TriggerIcon size={12} />
                    {fmt(A.seconds, { n: shown(r.duration) })}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      )}
      {row && <EffectEditor key={`${index}:${row.type}`} index={index} row={row} count={rows.length} run={run} onMoved={setSelected} />}
    </div>
  )
}

/** Lo que se puede cambiar del efecto elegido. */
function EffectEditor({ index, row, count, run, onMoved }: { index: number; row: EffectRow; count: number; run: PanelProps['run']; onMoved: (i: number) => void }) {
  const [duration, setDuration] = useState(shown(row.duration))
  const [delay, setDelay] = useState(shown(row.delay))
  const [repeat, setRepeat] = useState(String(row.repeat))
  useEffect(() => {
    setDuration(shown(row.duration))
    setDelay(shown(row.delay))
    setRepeat(String(row.repeat))
  }, [row.duration, row.delay, row.repeat])
  const set = (change: Record<string, unknown>): void => void run('animSet', JSON.stringify({ i: index, ...change }))
  const commitDuration = (): void => {
    const s = seconds(duration, 0.01, 600)
    if (s === null) return setDuration(shown(row.duration))
    if (Math.round(s * 1000) !== row.duration) set({ duration: Math.round(s * 1000) })
  }
  const commitDelay = (): void => {
    const s = seconds(delay, 0, 600)
    if (s === null) return setDelay(shown(row.delay))
    if (Math.round(s * 1000) !== row.delay) set({ delay: Math.round(s * 1000) })
  }
  const commitRepeat = (): void => {
    const n = Number(repeat.trim())
    if (!Number.isInteger(n) || n < 1 || n > 999) return setRepeat(String(row.repeat))
    if (n !== row.repeat) set({ repeat: n })
  }
  const enter = (commit: () => void) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit()
    }
  }
  const known = EFFECTS.some((e) => e.key === row.type)
  return (
    <section className="slide-anim-edit" aria-label={A.effect}>
      <Field label={A.effect}>
        <select className="input sm" value={known ? row.type : ''} onChange={(e) => e.target.value && run('animChange', `${index}:${e.target.value}`)}>
          {!known && <option value="">{effectName(row.type)}</option>}
          {GROUPS.map((group) => (
            <optgroup key={group} label={A[group]}>
              {EFFECTS.filter((e) => e.group === group).map((e) => (
                <option key={e.key} value={e.key}>
                  {A.names[e.key]}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>
      <Field label={A.start}>
        <select className="input sm" value={row.trigger} onChange={(e) => set({ trigger: e.target.value })}>
          {TRIGGERS.map((t) => (
            <option key={t} value={t}>
              {A.triggers[t]}
            </option>
          ))}
        </select>
      </Field>
      <div className="slide-anim-times">
        <Field label={A.duration}>
          <input className="input sm" inputMode="decimal" maxLength={8} value={duration} onChange={(e) => setDuration(e.target.value)} onBlur={commitDuration} onKeyDown={enter(commitDuration)} />
        </Field>
        <Field label={A.delay}>
          <input className="input sm" inputMode="decimal" maxLength={8} value={delay} onChange={(e) => setDelay(e.target.value)} onBlur={commitDelay} onKeyDown={enter(commitDelay)} />
        </Field>
        <Field label={A.repeat}>
          <input className="input sm" inputMode="numeric" maxLength={3} value={repeat} onChange={(e) => setRepeat(e.target.value)} onBlur={commitRepeat} onKeyDown={enter(commitRepeat)} />
        </Field>
      </div>
      <div className="slide-anim-actions">
        <button
          className="btn sm"
          disabled={index <= 0}
          onClick={() => {
            run('animMove', `${index}:-1`)
            onMoved(index - 1)
          }}
        >
          <ArrowUp size={13} />
          {A.earlier}
        </button>
        <button
          className="btn sm"
          disabled={index >= count - 1}
          onClick={() => {
            run('animMove', `${index}:1`)
            onMoved(index + 1)
          }}
        >
          <ArrowDown size={13} />
          {A.later}
        </button>
        <button className="btn ghost sm" onClick={() => run('animRemove', String(index))}>
          <Trash2 size={13} />
          {A.remove}
        </button>
      </div>
    </section>
  )
}
