import { useEffect, useMemo, useState } from 'preact/hooks'
import { loadData } from '../data'
import { t } from '../i18n'
import { defaultState, setLang, useAppState } from '../store'
import type { ChangesFile, CoursesFile, Lang } from '../types'
import { pendingAlerts } from '../logic/alerts'
import { CatalogView } from './catalog/CatalogView'
import { ChangesView } from './changes/ChangesView'
import { ScheduleView } from './schedule/ScheduleView'
import { ErrorBoundary } from './ErrorBoundary'
import { fmtDate } from './format'

type Tab = 'catalog' | 'schedule' | 'changes'
const TABS: Tab[] = ['catalog', 'schedule', 'changes']
const STALE_DAYS = 3

const tabFromHash = (): Tab => {
  const h = location.hash.replace(/^#\/?/, '') as Tab
  return TABS.includes(h) ? h : 'catalog'
}

type Load = { status: 'loading' } | { status: 'error'; error: string } | { status: 'ready'; courses: CoursesFile; changes: ChangesFile }

export function App() {
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [state, update, persistent] = useAppState()
  const [tab, setTab] = useState<Tab>(tabFromHash)
  const lang = state.lang

  useEffect(() => {
    loadData()
      .then(({ courses, changes }) => setLoad({ status: 'ready', courses, changes }))
      .catch((e: unknown) => setLoad({ status: 'error', error: e instanceof Error ? e.message : String(e) }))
  }, [])
  useEffect(() => {
    const onHash = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  useEffect(() => { document.documentElement.lang = lang }, [lang])

  const alerts = useMemo(
    () => (load.status === 'ready' ? pendingAlerts(state, load.courses, load.changes) : []),
    [load, state],
  )
  const ageDays = load.status === 'ready' ? Math.floor((Date.now() - Date.parse(load.courses.meta.scrapedAt)) / 86400_000) : 0

  return (
    <div class="app">
      <header class="topbar">
        <h1 class="brand">{t(lang, 'app.title')}</h1>
        <nav class="tabs" aria-label="Sections">
          {TABS.map((id) => (
            <a key={id} href={`#/${id}`} class="tab" aria-current={tab === id ? 'page' : undefined}>
              {t(lang, `tab.${id}`)}
              {id === 'changes' && alerts.length > 0 && <span class="tab-badge" data-testid="changes-badge">{alerts.length}</span>}
            </a>
          ))}
        </nav>
        <div class="lang-switch" role="group" aria-label="Language">
          {(['tr', 'en'] as Lang[]).map((l) => (
            <button key={l} type="button" aria-pressed={lang === l} onClick={() => update((s) => setLang(s, l))}>{l.toUpperCase()}</button>
          ))}
        </div>
      </header>

      {!persistent && <p class="banner banner-warn">{t(lang, 'storage.off')}</p>}
      {load.status === 'ready' && ageDays > STALE_DAYS && <p class="banner banner-warn">{t(lang, 'data.stale', { days: ageDays })}</p>}

      <main class="content">
        <ErrorBoundary onReset={() => update(() => defaultState())}>
        {load.status === 'loading' && <p class="empty">{t(lang, 'data.loading')}</p>}
        {load.status === 'error' && <p class="banner banner-error">{t(lang, 'data.error', { error: load.error })}</p>}
        {load.status === 'ready' && tab === 'catalog' && <CatalogView data={load.courses} state={state} update={update} />}
        {load.status === 'ready' && tab === 'schedule' && <ScheduleView data={load.courses} state={state} update={update} />}
        {load.status === 'ready' && tab === 'changes' && (
          <ChangesView data={load.courses} changes={load.changes} state={state} alerts={alerts} update={update} />
        )}
        </ErrorBoundary>
      </main>

      {load.status === 'ready' && (
        <footer class="footer">
          <span>{t(lang, 'data.age', { date: fmtDate(lang, load.courses.meta.scrapedAt) })}</span>
          <span>{load.courses.meta.term} · SPO {load.courses.meta.spo}</span>
        </footer>
      )}
    </div>
  )
}
