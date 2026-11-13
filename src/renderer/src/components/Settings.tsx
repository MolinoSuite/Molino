import { FileText, LayoutGrid, Palette, Settings2, Signature, Sparkles } from 'lucide-react'
import { type KeyboardEvent, type ReactNode, useState } from 'react'
import type { LangSetting } from '@shared/i18n'
import { type CloseMany, type DateStyle, DEFAULT_ACCENT, type SignLevel, type TimestampServer, type UpdateStatus } from '@shared/types'
import { fmt, L } from '@/i18n'
import { DATE_STYLES, formatDateStyle } from '@/lib/dates'
import { TIMESTAMP_SERVERS } from '@/lib/timestamp'
import { AiSettings } from '@/modes/ai/settings'
import { useApp } from '@/state/app'
import { chooseMolinoAsDefault, useDefaultApp } from '@/state/defaultApp'
import { useOffice } from '@/state/office'
import { takeSettingsTab, updateSettings } from '@/state/settings'
import { useUpdates } from '@/state/updates'
import { AppsSettings } from './AppsSettings'
import { Checkbox, Dialog, Field, Segmented } from './ui'

const ACCENTS = [DEFAULT_ACCENT, '#4f5bd5', '#2f7fe8', '#0f9d8a', '#2e9e55', '#d9822b', '#b0479a', '#5b6472']

type SettingsTab = 'general' | 'apps' | 'appearance' | 'documents' | 'signature' | 'ai'

const SETTINGS_TABS: { id: SettingsTab; label: string; icon: ReactNode }[] = [
  { id: 'general', label: L.dialogs.settings.tabs.general, icon: <Settings2 size={16} /> },
  { id: 'apps', label: L.dialogs.settings.tabs.apps, icon: <LayoutGrid size={16} /> },
  { id: 'appearance', label: L.dialogs.settings.tabs.appearance, icon: <Palette size={16} /> },
  { id: 'documents', label: L.dialogs.settings.tabs.pdf, icon: <FileText size={16} /> },
  { id: 'signature', label: L.dialogs.settings.tabs.signature, icon: <Signature size={16} /> },
  { id: 'ai', label: L.ai.settings.tab, icon: <Sparkles size={16} /> }
]

/** La pestaña de la última vez: se vuelve a ella mientras Molino PDF siga abierto. */
let lastSettingsTab: SettingsTab = 'general'

/**
 * Ajustes de Molino: los mismos en todas sus apps (Molino PDF, Documentos,
 * Hojas, Presentaciones y el inicio), con las mismas pestañas.
 */
export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const close = onClose
  // «Aplicaciones», solo si esta versión ofrece añadir Documentos, Hojas y Presentaciones.
  const appsOffered = useOffice((s) => s.status?.available ?? false)
  const tabs = SETTINGS_TABS.filter((item) => item.id !== 'apps' || appsOffered)
  // El panel de la IA puede pedir que se abra directamente en su pestaña.
  const [chosen, setTab] = useState<SettingsTab>(() => (takeSettingsTab() as SettingsTab | null) ?? lastSettingsTab)
  const tab = tabs.some((item) => item.id === chosen) ? chosen : 'general'
  const choose = (next: SettingsTab): void => {
    lastSettingsTab = next
    setTab(next)
  }
  // Pestañas en vertical: flechas arriba y abajo, Inicio y Fin.
  const onTabKey = (event: KeyboardEvent<HTMLDivElement>): void => {
    const index = tabs.findIndex((item) => item.id === tab)
    const last = tabs.length - 1
    const target =
      event.key === 'ArrowDown' ? (index + 1) % tabs.length
      : event.key === 'ArrowUp' ? (index + last) % tabs.length
      : event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : -1
    if (target < 0) return
    event.preventDefault()
    const next = tabs[target].id
    choose(next)
    event.currentTarget.querySelector<HTMLElement>(`#settings-tab-${next}`)?.focus()
  }
  return (
    <Dialog
      title={L.dialogs.settings.title}
      className="settings-dialog"
      onClose={close}
      footer={
        <button className="btn primary" onClick={close}>
          {L.dialogs.settings.done}
        </button>
      }
    >
      <div className="settings-tabs" role="tablist" aria-orientation="vertical" aria-label={L.dialogs.settings.sections} onKeyDown={onTabKey}>
        {tabs.map((item) => (
          <button
            key={item.id}
            id={`settings-tab-${item.id}`}
            className="settings-tab"
            role="tab"
            aria-selected={item.id === tab}
            aria-controls="settings-panel"
            tabIndex={item.id === tab ? 0 : -1}
            data-autofocus={item.id === tab ? '' : undefined}
            onClick={() => choose(item.id)}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>
      <div className="settings-panel" id="settings-panel" role="tabpanel" aria-labelledby={`settings-tab-${tab}`}>
        {tab === 'general' && (
          <>
            <LanguageSettings />
            <AuthorSettings />
            <DefaultAppSettings />
            <UpdatesSettings />
          </>
        )}
        {tab === 'apps' && <AppsSettings />}
        {tab === 'appearance' && <AppearanceSettings />}
        {tab === 'documents' && <DocumentSettings />}
        {tab === 'signature' && <SignatureSettings />}
        {tab === 'ai' && <AiSettings />}
      </div>
    </Dialog>
  )
}

/** El idioma de Molino PDF: se fija al abrirlo, así que el cambio vale para la próxima vez. */
function LanguageSettings() {
  const language = useApp((s) => s.settings.language)
  const T = L.dialogs.settings.language
  return (
    <Field label={T.label} hint={T.hint}>
      <Segmented<LangSetting>
        value={language}
        options={[
          { value: 'auto', label: T.auto },
          { value: 'es', label: T.es },
          { value: 'en', label: T.en }
        ]}
        onChange={(value) => void updateSettings({ language: value })}
      />
    </Field>
  )
}

function AppearanceSettings() {
  const settings = useApp((s) => s.settings)
  const T = L.dialogs.settings
  return (
    <>
      <Field label={T.theme.label}>
        <Segmented
          value={settings.theme}
          options={[
            { value: 'system', label: T.theme.system },
            { value: 'light', label: T.theme.light },
            { value: 'dark', label: T.theme.dark }
          ]}
          onChange={(theme) => void updateSettings({ theme })}
        />
      </Field>
      <Field label={T.accent.label}>
        <div className="row">
          {ACCENTS.map((color) => (
            <button
              key={color}
              aria-label={fmt(T.accent.color, { color })}
              onClick={() => void updateSettings({ accent: color })}
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: color,
                boxShadow: settings.accent === color ? `0 0 0 2px var(--bg-surface), 0 0 0 4px ${color}` : 'none'
              }}
            />
          ))}
        </div>
      </Field>
    </>
  )
}

function DocumentSettings() {
  const settings = useApp((s) => s.settings)
  const T = L.dialogs.settings
  return (
    <>
      <Field label={T.zoom.label}>
        <Segmented
          value={settings.defaultZoom}
          options={[
            { value: 'fit-width', label: T.zoom.fitWidth },
            { value: 'fit-page', label: T.zoom.fitPage },
            { value: 'actual', label: T.zoom.actual }
          ]}
          onChange={(defaultZoom) => void updateSettings({ defaultZoom })}
        />
      </Field>
      <Checkbox checked={settings.sidebarOpen} onChange={(sidebarOpen) => void updateSettings({ sidebarOpen })}>
        {T.sidebarOpen}
      </Checkbox>
      <Checkbox checked={settings.highlightFields} onChange={(highlightFields) => void updateSettings({ highlightFields })}>
        {T.highlightFields}
      </Checkbox>
      <CloseManySettings />
    </>
  )
}

/** Quién firma las notas de los PDF y los comentarios y cambios de los documentos. */
function AuthorSettings() {
  const author = useApp((s) => s.settings.author)
  const T = L.dialogs.settings.author
  return (
    <Field label={T.label} hint={T.hint}>
      <input className="input" defaultValue={author} maxLength={120} onBlur={(event) => void updateSettings({ author: event.target.value.trim() })} />
    </Field>
  )
}

/** Los tipos de firma con certificado, como se llaman al firmar (ver SignLevel). */
const SIGN_LEVEL_OPTIONS: { value: SignLevel; label: string }[] = [
  { value: 'basic', label: L.dialogs.settings.signLevel.basic },
  { value: 'timestamp', label: L.dialogs.settings.signLevel.timestamp },
  { value: 'longTerm', label: L.dialogs.settings.signLevel.longTerm }
]

function SignatureSettings() {
  const settings = useApp((s) => s.settings)
  const T = L.dialogs.settings
  return (
    <>
      <Field label={T.signLevel.label} hint={T.signLevel.hint}>
        <Segmented value={settings.signLevel} options={SIGN_LEVEL_OPTIONS} onChange={(signLevel) => void updateSettings({ signLevel })} />
      </Field>
      <Field label={T.timestamp.label} hint={T.timestamp.hint}>
        <div className="stack">
          <select
            className="select"
            aria-label={T.timestamp.label}
            value={settings.timestampServer}
            onChange={(event) => void updateSettings({ timestampServer: event.target.value as TimestampServer })}
          >
            {TIMESTAMP_SERVERS.map((server) => (
              <option key={server.value} value={server.value}>
                {server.label}
              </option>
            ))}
          </select>
          {settings.timestampServer === 'custom' && (
            <input
              className="input"
              defaultValue={settings.timestampUrl}
              placeholder={T.timestamp.urlPlaceholder}
              aria-label={T.timestamp.urlLabel}
              maxLength={300}
              spellCheck={false}
              onBlur={(event) => void updateSettings({ timestampUrl: event.target.value.trim() })}
            />
          )}
        </div>
      </Field>
      <Field label={T.dateStyle.label} hint={T.dateStyle.hint}>
        <select
          className="select"
          aria-label={T.dateStyle.label}
          value={settings.dateStyle}
          onChange={(event) => void updateSettings({ dateStyle: event.target.value as DateStyle })}
        >
          {DATE_STYLES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label} · {formatDateStyle(option.value)}
            </option>
          ))}
        </select>
      </Field>
    </>
  )
}

function DefaultAppSettings() {
  const status = useDefaultApp((s) => s.status)
  const ask = useApp((s) => s.settings.askDefaultPdf)
  if (status === 'unknown') return null
  const T = L.dialogs.settings.defaultApp
  return (
    <Field label={T.label}>
      <div className="row">
        {status === 'default' ? (
          <span className="hint">{T.isDefault}</span>
        ) : (
          <>
            <button className="btn sm" onClick={() => void chooseMolinoAsDefault()}>
              {T.use}
            </button>
            <span className="hint">{T.confirmHint}</span>
          </>
        )}
      </div>
      {status !== 'default' && (
        <Checkbox checked={ask} onChange={(askDefaultPdf) => void updateSettings({ askDefaultPdf })}>
          {T.ask}
        </Checkbox>
      )}
    </Field>
  )
}

/** Qué cerrar al cerrar la ventana con varios archivos (lo mismo que «Recordar mi elección» al cerrar). */
function CloseManySettings() {
  const closeMany = useApp((s) => s.settings.closeMany)
  const T = L.dialogs.settings.closeMany
  return (
    <Field label={T.label}>
      <Segmented<CloseMany>
        value={closeMany}
        options={[
          { value: 'ask', label: T.ask },
          { value: 'all', label: T.all },
          { value: 'current', label: T.current }
        ]}
        onChange={(value) => void updateSettings({ closeMany: value })}
      />
    </Field>
  )
}

const UPDATE_TEXT: Partial<Record<UpdateStatus['state'], string>> = {
  unavailable: L.dialogs.settings.updates.unavailable,
  checking: L.dialogs.settings.updates.checking,
  current: L.dialogs.settings.updates.current
}

function UpdatesSettings() {
  const settings = useApp((s) => s.settings)
  const status = useUpdates((s) => s.status)
  const T = L.dialogs.settings.updates
  const text =
    status.state === 'available'
      ? status.version && status.version !== '?'
        ? fmt(T.availableVersion, { version: status.version })
        : T.available
      : status.state === 'error'
        ? (status.message ?? '')
        : (UPDATE_TEXT[status.state] ?? '')
  const busy = ['unavailable', 'checking'].includes(status.state)
  return (
    <Field label={T.label} hint={T.store}>
      <Checkbox checked={settings.checkUpdates} onChange={(checkUpdates) => void updateSettings({ checkUpdates })}>
        {T.check}
      </Checkbox>
      <div className="row">
        <button className="btn sm" disabled={busy} onClick={() => window.molino.updates.check()}>
          {T.checkNow}
        </button>
        {status.state === 'available' && (
          <button className="btn sm primary" onClick={() => void window.molino.updates.openStore()}>
            {T.openStore}
          </button>
        )}
        {text && <span className="hint">{text}</span>}
      </div>
    </Field>
  )
}
