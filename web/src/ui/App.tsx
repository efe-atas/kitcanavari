import { useEffect, useMemo, useState } from 'preact/hooks'
import { loadData } from '../data'
import { t } from '../i18n'
import { defaultState, setLang, toggleTheme, useAppState } from '../store'
import type { ChangesFile, CoursesFile, Lang, StatusFile } from '../types'
import { pendingAlerts } from '../logic/alerts'
import { CatalogView } from './catalog/CatalogView'
import { ChangesView } from './changes/ChangesView'
import { GlossaryView } from './glossary/GlossaryView'
import { GuideView } from './guide/GuideView'
import { ScheduleView } from './schedule/ScheduleView'
import { ErrorBoundary } from './ErrorBoundary'
import { fmtDate } from './format'
import { Icon, type IconName } from './Icon'

type Tab = 'catalog' | 'schedule' | 'changes' | 'guide' | 'glossary'
const TABS: Tab[] = ['catalog', 'schedule', 'changes', 'guide', 'glossary']
const TAB_ICONS: Record<Tab, IconName> = { catalog: 'catalog', schedule: 'calendar', changes: 'bell', guide: 'guide', glossary: 'glossary' }
const STALE_DAYS = 3

/** "#/glossary/stamm" → tab "glossary", sub "stamm". */
const routeFromHash = (): { tab: Tab; sub: string | null } => {
  const [h, sub] = location.hash.replace(/^#\/?/, '').split('/')
  return { tab: TABS.includes(h as Tab) ? (h as Tab) : 'catalog', sub: sub || null }
}

type Load =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; courses: CoursesFile; changes: ChangesFile; checkedAt: string }

export function App() {
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [state, update, persistent] = useAppState()
  const [route, setRoute] = useState(routeFromHash)
  const { tab } = route
  const lang = state.lang

  useEffect(() => {
    loadData()
      .then(({ courses, changes, status }: { courses: CoursesFile; changes: ChangesFile; status?: StatusFile | null }) =>
        setLoad({ status: 'ready', courses, changes, checkedAt: status?.checkedAt ?? courses.meta.scrapedAt }))
      .catch((e: unknown) => setLoad({ status: 'error', error: e instanceof Error ? e.message : String(e) }))
  }, [])
  useEffect(() => {
    const onHash = () => setRoute(routeFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  useEffect(() => { document.documentElement.lang = lang }, [lang])
  const theme = state.theme ?? 'light'
  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])

  const alerts = useMemo(
    () => (load.status === 'ready' ? pendingAlerts(state, load.courses, load.changes) : []),
    [load, state],
  )
  const ageDays = load.status === 'ready' ? Math.floor((Date.now() - Date.parse(load.checkedAt)) / 86400_000) : 0

  return (
    <div class="app">
      <header class="topbar">
        <a class="brand" href="#/catalog">
          <svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="8" fill="currentColor" />
            <rect x="7" y="8" width="5" height="10" rx="2" fill="#fff" />
            <rect x="13.5" y="12" width="5" height="12" rx="2" fill="#fff" opacity=".75" />
            <rect x="20" y="7" width="5" height="8" rx="2" fill="#fff" opacity=".5" />
          </svg>
          <h1>{t(lang, 'app.title')}</h1>
        </a>
        <nav class="tabs" aria-label="Sections">
          {TABS.map((id) => (
            <a key={id} href={`#/${id}`} class="tab" aria-current={tab === id ? 'page' : undefined}>
              <Icon name={TAB_ICONS[id]} />
              <span>{t(lang, `tab.${id}`)}</span>
              {id === 'schedule' && Object.keys(state.selected).length > 0 && (
                <span class="tab-count">{Object.keys(state.selected).length}</span>
              )}
              {id === 'changes' && alerts.length > 0 && <span class="tab-badge" data-testid="changes-badge">{alerts.length}</span>}
            </a>
          ))}
        </nav>
        <div class="top-actions">
          <button type="button" class="icon-button theme-toggle" onClick={() => update(toggleTheme)}
            aria-label={t(lang, theme === 'dark' ? 'theme.light' : 'theme.dark')} title={t(lang, theme === 'dark' ? 'theme.light' : 'theme.dark')}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
          </button>
          <div class="lang-switch" role="group" aria-label="Language">
            {(['tr', 'en'] as Lang[]).map((l) => (
              <button key={l} type="button" aria-pressed={lang === l} onClick={() => update((s) => setLang(s, l))}>{l.toUpperCase()}</button>
            ))}
          </div>
        </div>
      </header>

      {!persistent && <p class="banner banner-warn">{t(lang, 'storage.off')}</p>}
      {load.status === 'ready' && ageDays > STALE_DAYS && <p class="banner banner-warn">{t(lang, 'data.stale', { days: ageDays })}</p>}

      <main class="content">
        <ErrorBoundary onReset={() => update(() => defaultState())}>
        {load.status === 'loading' && <p class="empty loading">{t(lang, 'data.loading')}</p>}
        {load.status === 'error' && <p class="banner banner-error">{t(lang, 'data.error', { error: load.error })}</p>}
        {load.status === 'ready' && tab === 'catalog' && <CatalogView data={load.courses} state={state} update={update} />}
        {load.status === 'ready' && tab === 'schedule' && <ScheduleView data={load.courses} state={state} update={update} />}
        {load.status === 'ready' && tab === 'guide' && <GuideView lang={lang} data={load.courses} />}
        {load.status === 'ready' && tab === 'glossary' && <GlossaryView lang={lang} data={load.courses} focus={route.sub} />}
        {load.status === 'ready' && tab === 'changes' && (
          <ChangesView data={load.courses} changes={load.changes} state={state} alerts={alerts} update={update} />
        )}
        </ErrorBoundary>
      </main>

      {load.status === 'ready' && (
        <footer class="footer">
          <span class="footer-status"><span class="status-dot" aria-hidden="true" />{t(lang, 'data.age', { date: fmtDate(lang, load.checkedAt) })}</span>
          <span>{load.courses.meta.term} · SPO {load.courses.meta.spo}</span>
        </footer>
      )}
    </div>
  )
}
