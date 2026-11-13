/**
 * «Molino», el inicio común de la suite (main/home.ts): las apps, «Crea algo
 * nuevo» y los recientes de todas las apps, con buscador. Sigue la maqueta
 * «Inicio» de la suite; las plantillas llegarán cuando las haya.
 */
import { FolderOpen, Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { HomeApp, HomeRecent } from '@shared/home'
import documentsIcon from './icons/documentos.svg'
import sheetsIcon from './icons/hojas.svg'
import molinoIcon from './icons/molino.svg'
import pdfIcon from './icons/pdf.svg'
import slidesIcon from './icons/presentaciones.svg'
import { env, fmt, L } from './i18n'

const H = L.home
const ICONS: Record<HomeApp, string> = { word: documentsIcon, cell: sheetsIcon, slide: slidesIcon, pdf: pdfIcon }
const APPS: HomeApp[] = ['word', 'cell', 'slide', 'pdf']
const OFFICE = ['word', 'cell', 'slide'] as const
const relative = new Intl.RelativeTimeFormat(env.locale, { numeric: 'auto' })

/** Sin tildes ni mayúsculas, para buscar («camion» encuentra «camión»). */
const plain = (text: string): string => text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase(env.locale)

/** Hace cuánto (como en Molino PDF: «hace 5 minutos», «ayer»…). */
function formatWhen(timestamp: number): string {
  const minutes = Math.round((timestamp - Date.now()) / 60000)
  if (Math.abs(minutes) < 1) return L.state.when.now
  if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return relative.format(hours, 'hour')
  const days = Math.round(hours / 24)
  if (Math.abs(days) < 30) return relative.format(days, 'day')
  return new Date(timestamp).toLocaleDateString(env.locale, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function Home() {
  const [apps, setApps] = useState<Record<HomeApp, boolean> | null>(null)
  const [recent, setRecent] = useState<HomeRecent[] | null>(null)
  const [query, setQuery] = useState('')

  const refresh = useCallback(() => {
    void window.molinoHome.apps().then(setApps)
    void window.molinoHome.recent().then(setRecent)
  }, [])
  // Al volver a la ventana, por si se abrió algo en otra app.
  useEffect(() => {
    refresh()
    const off = window.molinoHome.onChanged(refresh)
    window.addEventListener('focus', refresh)
    return () => {
      off()
      window.removeEventListener('focus', refresh)
    }
  }, [refresh])

  const shown = useMemo(() => {
    const words = plain(query).split(/\s+/).filter(Boolean)
    return (recent ?? []).filter((file) => words.every((w) => plain(`${file.name} ${file.folder}`).includes(w)))
  }, [recent, query])
  const office = OFFICE.filter((kind) => apps?.[kind])

  return (
    <div className="home">
      <header className="titlebar home-titlebar">
        <div className="home-brand">
          <img src={molinoIcon} width={26} height={26} alt="" />
          <span>Molino</span>
        </div>
        <div className="titlebar-fill" />
        <label className="home-search">
          <Search size={15} />
          <input
            type="text"
            value={query}
            placeholder={H.search}
            aria-label={H.search}
            spellCheck={false}
            maxLength={200}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setQuery('')
              else if (event.key === 'Enter' && shown[0]) void window.molinoHome.openRecent(shown[0].id)
            }}
          />
          {query && (
            <button className="icon-btn sm" aria-label={H.clearSearch} onClick={() => setQuery('')}>
              <X size={13} />
            </button>
          )}
        </label>
        <div className="titlebar-fill" />
      </header>

      <div className="home-body">
        <nav className="home-nav" aria-label={H.sections}>
          <button className="home-link" onClick={() => void window.molinoHome.openDialog()}>
            <FolderOpen size={17} />
            {H.open}
          </button>
          <p className="home-label">{H.apps}</p>
          {APPS.filter((app) => apps?.[app]).map((app) => (
            <button key={app} className="home-link" onClick={() => void window.molinoHome.launch(app)}>
              <img src={ICONS[app]} width={20} height={20} alt="" />
              {H.names[app]}
            </button>
          ))}
        </nav>

        <main className="home-main">
          <div className="home-inner">
            <h1>{H.title}</h1>

            <section className="home-section" aria-labelledby="home-create">
              <h2 id="home-create">{H.create}</h2>
              <div className="home-cards">
                {office.map((kind) => (
                  <button key={kind} className="home-card" onClick={() => void window.molinoHome.create(kind)}>
                    <img src={ICONS[kind]} width={52} height={52} alt="" />
                    <span>
                      <strong>{H.cards[kind].title}</strong>
                      <span>{H.cards[kind].sub}</span>
                    </span>
                  </button>
                ))}
                <button className="home-card" onClick={() => void window.molinoHome.openDialog('pdf')}>
                  <img src={ICONS.pdf} width={52} height={52} alt="" />
                  <span>
                    <strong>{H.cards.pdf.title}</strong>
                    <span>{H.cards.pdf.sub}</span>
                  </span>
                </button>
              </div>
            </section>

            <section className="home-section" aria-labelledby="home-recent">
              <h2 id="home-recent">{H.recent}</h2>
              <ul className="home-recent">
                {shown.map((file) => (
                  <li key={file.id} className="home-recent-row">
                    <button className="home-recent-item" onClick={() => void window.molinoHome.openRecent(file.id).then((ok) => !ok && refresh())}>
                      <img src={ICONS[file.app]} width={24} height={24} alt="" />
                      <strong>{file.name}</strong>
                      <span className="home-where">{file.folder}</span>
                      <span className="home-when">{formatWhen(file.openedAt)}</span>
                    </button>
                    <button
                      className="icon-btn sm home-forget"
                      aria-label={fmt(H.remove, { name: file.name })}
                      onClick={() => void window.molinoHome.forgetRecent(file.id).then(setRecent)}
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
                {recent && recent.length === 0 && <li className="home-empty">{H.noRecent}</li>}
                {recent && recent.length > 0 && shown.length === 0 && <li className="home-empty">{fmt(H.noMatch, { query: query.trim() })}</li>}
              </ul>
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}
