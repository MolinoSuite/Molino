/**
 * Los cuadros de los temas: crear, editar o duplicar uno (con sus fuentes,
 * tamaño, colores con el selector de Molino, estilos y la vista previa en vivo),
 * guardar el del documento como tema, y administrarlos (aplicar, editar,
 * duplicar, borrar y elegir el de los documentos nuevos de esta app).
 */
import { Bold, Copy, Ellipsis, Italic, Pencil, Plus, Star, StarOff, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { fontAvailable } from '@shared/metricFonts'
import { ALWAYS_FONTS, type OfficeTheme, THEME_COLOR_KEYS, THEME_NAME_MAX, THEME_SIZE, THEME_SPACE, THEME_STYLE_KEYS, type ThemeColorKey, type ThemeStyleKey } from '@shared/officeThemes'
import { Dialog, Field, Menu, type MenuEntry } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useApp } from '@/state/app'
import { env, fmt, L } from '../../i18n'
import { ColorPicker } from '../../ui/ColorPicker'
import { Pop, usePopButton } from '../../ui/pop'
import type { DialogProps } from '../types'
import { readDocumentTheme, type SchemeInfo } from './apply'
import { faceOf, previewStyle, ThemeTile } from './menus'
import { blankTheme, freeName, molinoThemes, removeTheme, saveTheme, setDefaultTheme, themeById } from './model'

const TH = L.officeThemes
const E = TH.editor
const M = TH.manager

// ------------------------------------------------------------ vista previa

/** Una página de muestra con el tema: títulos, texto, un vínculo, una cita y sus colores. */
export function ThemePreview({ theme }: { theme: OfficeTheme }) {
  const c = theme.colors
  const body = { fontFamily: faceOf(theme.fonts.body), fontSize: `${theme.size * 0.92}px`, color: c.dk1 }
  return (
    <div className="theme-preview" style={{ background: c.lt1 }} aria-label={E.preview}>
      <div className="theme-preview-band" style={{ background: c.lt2 }}>
        <p style={previewStyle(theme, 'title', 0.72)}>{E.sampleTitle}</p>
        <p style={previewStyle(theme, 'subtitle', 0.8)}>{E.sampleSubtitle}</p>
      </div>
      <div className="theme-preview-page">
        <p style={previewStyle(theme, 'heading1')}>{E.sampleHeading}</p>
        <p style={body}>
          {E.sampleText}{' '}
          <span style={{ color: c.hlink, textDecoration: 'underline' }}>{E.sampleLink}</span>.
        </p>
        <p className="theme-preview-quote" style={{ ...previewStyle(theme, 'quote'), borderColor: c.accent1 }}>
          {E.sampleQuote}
        </p>
        <p style={previewStyle(theme, 'heading2')}>{E.sampleHeading2}</p>
        <p style={previewStyle(theme, 'heading3')}>{TH.styleNames.heading3}</p>
        <p style={body}>{E.sampleText2}</p>
        <table className="theme-preview-table" style={{ fontFamily: faceOf(theme.fonts.body), color: c.dk1 }} aria-hidden="true">
          <thead>
            <tr style={{ background: c.accent1, color: c.lt1 }}>
              {E.sampleTable.slice(0, 3).map((cell) => (
                <th key={cell}>{cell}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[0, 1].map((row) => (
              <tr key={row} style={{ background: row % 2 ? c.lt2 : c.lt1 }}>
                {E.sampleTable.slice(3 + row * 3, 6 + row * 3).map((cell, i) => (
                  <td key={i}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="theme-preview-bars" aria-hidden="true">
          {(['accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'] as const).map((k, i) => (
            <i key={k} style={{ background: c[k], height: `${38 + ((i * 37) % 52)}%` }} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------ campos

/**
 * Una fuente: las que hay en cualquier equipo delante y las de este equipo
 * después. Fuera de Windows, de las de Windows solo las que tienen aquí una
 * con sus mismas medidas (Arial con Liberation Sans...).
 */
function FontSelect({ value, fonts, label, onChange }: { value: string; fonts: string[]; label: string; onChange: (font: string) => void }) {
  const here = useMemo(() => new Set(fonts.map((f) => f.toLowerCase())), [fonts])
  const always = (ALWAYS_FONTS as readonly string[]).filter((f) => env.os === 'win32' || fontAvailable(f, here))
  const others = fonts.filter((f) => !always.includes(f))
  const known = always.includes(value) || others.includes(value)
  return (
    <select className="input" aria-label={label} value={value} style={{ fontFamily: faceOf(value) }} onChange={(e) => onChange(e.target.value)}>
      {!known && <option value={value}>{value}</option>}
      <optgroup label={E.alwaysFonts}>
        {always.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </optgroup>
      {others.length > 0 && (
        <optgroup label={E.otherFonts}>
          {others.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  )
}

/** Un número (pt) con sus límites: lo que no vale no se guarda. */
function NumberInput({ value, min, max, label, onChange, small }: { value: number; min: number; max: number; label: string; onChange: (n: number) => void; small?: boolean }) {
  const [draft, setDraft] = useState(String(value).replace('.', ','))
  return (
    <input
      className={cn('input', small && 'theme-num')}
      aria-label={label}
      inputMode="decimal"
      value={draft}
      onChange={(e) => {
        const text = e.target.value.replace(/[^0-9.,]/g, '').slice(0, 5)
        setDraft(text)
        const n = Number(text.replace(',', '.'))
        if (text !== '' && Number.isFinite(n) && n >= min && n <= max) onChange(Math.round(n * 2) / 2)
      }}
      onBlur={() => setDraft(String(value).replace('.', ','))}
    />
  )
}

/** Un color del tema: su muestra y su nombre; al pulsar, el selector de color de Molino. */
function ColorField({ name, value, onChange }: { name: string; value: string; onChange: (hex: string) => void }) {
  const pop = usePopButton()
  return (
    <>
      <button ref={pop.button} type="button" className={cn('theme-color', pop.anchor && 'on')} aria-label={fmt(E.pick, { name })} data-tip={value.toUpperCase()} onClick={pop.toggle}>
        <span className="office-swatch" style={{ background: value }} />
        <span className="theme-color-name">{name}</span>
      </button>
      {pop.anchor && (
        <Pop anchor={pop.anchor} trigger={pop.button} onClose={pop.close} label={name} className="office-colorpop theme-colorpop">
          <ColorPicker
            current={value}
            onPick={(hex) => {
              pop.close()
              if (/^#[0-9a-f]{6}$/i.test(hex)) onChange(hex.toLowerCase())
            }}
          />
        </Pop>
      )}
    </>
  )
}

// ------------------------------------------------------------ crear y editar

/**
 * Crear un tema (``new``), editarlo (``edit:id``), duplicarlo (``copy:id``) o
 * guardar el del documento (``doc``): con la vista previa en vivo.
 */
export function ThemeEditorDialog({ session, state, run, value, close }: DialogProps) {
  const [mode, id = ''] = (value ?? 'new').split(':')
  const own = useApp((s) => s.settings.officeThemes)
  const [draft, setDraft] = useState<OfficeTheme>(() => {
    if (mode === 'edit') {
      const found = own.find((t) => t.id === id)
      if (found) return structuredClone(found)
    }
    if (mode === 'copy') {
      const found = themeById(id)
      if (found) return { ...structuredClone(found), id: '', name: freeName(fmt(E.copyName, { name: found.name })) }
    }
    if (mode === 'doc') {
      const schemes = (state.extra.themeSchemes as SchemeInfo[] | undefined) ?? []
      return readDocumentTheme(session.featureContext(), schemes, molinoThemes()[0], freeName(E.defaultName))
    }
    return blankTheme()
  })
  const editing = mode === 'edit' && own.some((t) => t.id === id)
  const fonts = useMemo(() => [...new Set(state.fonts)].sort((a, b) => a.localeCompare(b)), [state.fonts])
  const name = draft.name.trim()
  // Ni el de otro tema propio ni el de uno de Molino (el nombre es el de sus colores en el documento).
  const taken = [...own.filter((t) => t.id !== draft.id), ...molinoThemes()].some((t) => t.name.toLowerCase() === name.toLowerCase())
  const valid = name.length > 0 && !taken
  const set = (patch: Partial<OfficeTheme>): void => setDraft((d) => ({ ...d, ...patch }))
  const setColor = (key: ThemeColorKey, hex: string): void => setDraft((d) => ({ ...d, colors: { ...d.colors, [key]: hex } }))
  const setStyle = (key: ThemeStyleKey, patch: Partial<OfficeTheme['styles'][ThemeStyleKey]>): void =>
    setDraft((d) => ({ ...d, styles: { ...d.styles, [key]: { ...d.styles[key], ...patch } } }))
  const save = async (apply: boolean): Promise<void> => {
    if (!valid) return
    const saved = await saveTheme({ ...draft, name })
    if (!saved) return
    close()
    if (apply) run('themeApply', saved)
  }
  const title = editing ? E.editTitle : mode === 'doc' ? E.fromDocumentTitle : E.newTitle
  return (
    <Dialog
      title={title}
      className="theme-editor"
      onClose={close}
      footer={
        <>
          <span className="grow" />
          <button className="btn" onClick={close}>
            {L.office.dialogs.cancel}
          </button>
          <button className="btn" disabled={!valid} onClick={() => void save(false)}>
            {E.save}
          </button>
          <button className="btn primary" disabled={!valid} onClick={() => void save(true)}>
            {E.saveApply}
          </button>
        </>
      }
    >
      <div className="theme-editor-form">
        <Field label={E.name} hint={!name ? E.nameRequired : taken ? E.nameTaken : undefined}>
          <input className="input" value={draft.name} maxLength={THEME_NAME_MAX} spellCheck={false} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <section>
          <h3>{E.fonts}</h3>
          <div className="theme-editor-row">
            <Field label={E.headingFont}>
              <FontSelect value={draft.fonts.heading} fonts={fonts} label={E.headingFont} onChange={(heading) => set({ fonts: { ...draft.fonts, heading } })} />
            </Field>
            <Field label={E.bodyFont}>
              <FontSelect value={draft.fonts.body} fonts={fonts} label={E.bodyFont} onChange={(body) => set({ fonts: { ...draft.fonts, body } })} />
            </Field>
            <Field label={E.size}>
              <NumberInput value={draft.size} min={THEME_SIZE.min} max={THEME_SIZE.max} label={E.size} onChange={(size) => set({ size })} />
            </Field>
          </div>
        </section>
        <section>
          <h3>{E.colors}</h3>
          <div className="theme-colors">
            {THEME_COLOR_KEYS.map((key) => (
              <ColorField key={key} name={TH.colorNames[key]} value={draft.colors[key]} onChange={(hex) => setColor(key, hex)} />
            ))}
          </div>
        </section>
        <section>
          <h3>{E.styles}</h3>
          <p className="hint">{E.stylesHint}</p>
          <div className="theme-styles" role="table" aria-label={E.styles}>
            <div className="theme-styles-head" role="row">
              <span role="columnheader">{E.style}</span>
              <span role="columnheader">{E.font}</span>
              <span role="columnheader">{E.styleSize}</span>
              <span role="columnheader">{E.color}</span>
              <span role="columnheader" />
              <span role="columnheader">{E.before}</span>
              <span role="columnheader">{E.after}</span>
            </div>
            {THEME_STYLE_KEYS.map((key) => {
              const s = draft.styles[key]
              const label = TH.styleNames[key]
              return (
                <div key={key} className="theme-styles-row" role="row">
                  <span role="cell" className="theme-styles-name">
                    {label}
                  </span>
                  <select className="input" role="cell" aria-label={`${label}: ${E.font}`} value={s.font} onChange={(e) => setStyle(key, { font: e.target.value === 'body' ? 'body' : 'heading' })}>
                    <option value="heading">{E.headingKind}</option>
                    <option value="body">{E.bodyKind}</option>
                  </select>
                  <NumberInput small value={s.size} min={THEME_SIZE.min} max={THEME_SIZE.max} label={`${label}: ${E.styleSize}`} onChange={(size) => setStyle(key, { size })} />
                  <span className="theme-styles-color" role="cell">
                    <span className="office-swatch" style={{ background: draft.colors[s.color] }} />
                    <select className="input" aria-label={`${label}: ${E.color}`} value={s.color} onChange={(e) => setStyle(key, { color: e.target.value as ThemeColorKey })}>
                      {THEME_COLOR_KEYS.map((k) => (
                        <option key={k} value={k}>
                          {TH.colorNames[k]}
                        </option>
                      ))}
                    </select>
                  </span>
                  <span className="theme-styles-toggles" role="cell">
                    <button type="button" className={cn('tool icon', s.bold && 'on')} aria-label={`${label}: ${E.bold}`} aria-pressed={s.bold} data-tip={E.bold} onClick={() => setStyle(key, { bold: !s.bold })}>
                      <Bold size={14} />
                    </button>
                    <button type="button" className={cn('tool icon', s.italic && 'on')} aria-label={`${label}: ${E.italic}`} aria-pressed={s.italic} data-tip={E.italic} onClick={() => setStyle(key, { italic: !s.italic })}>
                      <Italic size={14} />
                    </button>
                  </span>
                  <NumberInput small value={s.before} min={THEME_SPACE.min} max={THEME_SPACE.max} label={`${label}: ${E.before}`} onChange={(before) => setStyle(key, { before })} />
                  <NumberInput small value={s.after} min={THEME_SPACE.min} max={THEME_SPACE.max} label={`${label}: ${E.after}`} onChange={(after) => setStyle(key, { after })} />
                </div>
              )
            })}
          </div>
        </section>
      </div>
      <aside className="theme-editor-preview">
        <span className="label">{E.preview}</span>
        <ThemePreview theme={{ ...draft, name: name || E.defaultName }} />
      </aside>
    </Dialog>
  )
}

// ------------------------------------------------------------ administrar

/** Los temas de Molino y los propios: aplicar, editar, duplicar, borrar y el de los documentos nuevos de esta app. */
export function ThemesDialog({ session, run, close }: DialogProps) {
  const kind = session.kind
  const own = useApp((s) => s.settings.officeThemes)
  const chosen = useApp((s) => s.settings.officeDefaultTheme?.[kind])
  const [removing, setRemoving] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ anchor: DOMRect; theme: OfficeTheme; mine: boolean } | null>(null)
  const open = (value: string): void => void run('dialog', value)
  const row = (theme: OfficeTheme, mine: boolean) => {
    const isDefault = chosen === theme.id
    if (removing === theme.id) {
      return (
        <div key={theme.id} className="theme-row confirm" role="listitem">
          <span className="theme-row-text">{fmt(M.removeAsk, { name: theme.name })}</span>
          <button className="btn sm" onClick={() => setRemoving(null)}>
            {L.office.dialogs.cancel}
          </button>
          <button
            className="btn sm danger"
            onClick={() => {
              setRemoving(null)
              void removeTheme(theme.id)
            }}
          >
            {M.remove}
          </button>
        </div>
      )
    }
    return (
      <div key={theme.id} className="theme-row" role="listitem">
        <ThemeTile theme={theme} />
        <span className="theme-row-text">
          <b>{theme.name}</b>
          <span className="hint">
            {theme.fonts.heading} · {theme.fonts.body}
            {isDefault && <span className="theme-badge">{M.isDefault}</span>}
          </span>
        </span>
        <button
          className="btn sm"
          onClick={() => {
            close()
            run('themeApply', theme.id)
          }}
        >
          {M.apply}
        </button>
        {mine && (
          <button className="icon-btn sm" aria-label={`${M.edit}: ${theme.name}`} data-tip={M.edit} onClick={() => open(`themeEdit:edit:${theme.id}`)}>
            <Pencil size={15} />
          </button>
        )}
        <button className="icon-btn sm" aria-label={`${M.more}: ${theme.name}`} data-tip={M.more} onClick={(e) => setMenu({ anchor: e.currentTarget.getBoundingClientRect(), theme, mine })}>
          <Ellipsis size={15} />
        </button>
      </div>
    )
  }
  const entries = (theme: OfficeTheme, mine: boolean): MenuEntry[] => [
    chosen === theme.id
      ? { label: M.stopDefault, icon: <StarOff size={15} />, onSelect: () => void setDefaultTheme(kind, null) }
      : { label: M.useDefault, icon: <Star size={15} />, onSelect: () => void setDefaultTheme(kind, theme.id) },
    { label: M.duplicate, icon: <Copy size={15} />, onSelect: () => open(`themeEdit:copy:${theme.id}`) },
    ...(mine
      ? ([
          { label: M.edit, icon: <Pencil size={15} />, onSelect: () => open(`themeEdit:edit:${theme.id}`) },
          'sep',
          { label: M.remove, icon: <Trash2 size={15} />, danger: true, onSelect: () => setRemoving(theme.id) }
        ] as MenuEntry[])
      : [])
  ]
  return (
    <Dialog
      title={M.title}
      size="wide"
      className="theme-manager"
      onClose={close}
      footer={
        <>
          <button className="btn ghost" onClick={() => open('themeEdit:doc')}>
            {M.fromDocument}
          </button>
          <span className="grow" />
          <button className="btn" onClick={() => open('themeEdit:new')}>
            <Plus size={15} />
            {M.create}
          </button>
          <button className="btn primary" onClick={close}>
            {M.close}
          </button>
        </>
      }
    >
      <p>
        {M.intro} {TH.scope[kind]}
      </p>
      <h3 className="theme-list-title">{M.molino}</h3>
      <div className="theme-list" role="list" aria-label={M.molino}>
        {molinoThemes().map((t) => row(t, false))}
      </div>
      <h3 className="theme-list-title">{M.mine}</h3>
      <div className="theme-list" role="list" aria-label={M.mine}>
        {own.length === 0 && <p className="hint">{M.none}</p>}
        {own.map((t) => row(t, true))}
      </div>
      {menu && <Menu anchor={menu.anchor} align="end" entries={entries(menu.theme, menu.mine)} onClose={() => setMenu(null)} />}
    </Dialog>
  )
}
