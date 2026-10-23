import type { ComponentChildren } from 'preact'
import { useEffect, useMemo, useState } from 'preact/hooks'
import { loadData } from '../data'
import { t } from '../i18n'
import { pendingAlerts } from '../logic/alerts'
import { defaultState, useAppState } from '../store'
import type { CareerData, ChangesFile, CoursesFile, HandbookFile, Lang, StatusFile } from '../types'
import { CareerView } from './career/CareerView'
import { ChangesView } from './changes/ChangesView'
import { ErrorBoundary } from './ErrorBoundary'
import { fmtDate } from './format'
import { Icon, type IconName } from './Icon'
import { CourseDetail, courseTitle } from './panels/CourseDetail'
import { Courses } from './pages/Courses'
import { Help } from './pages/Help'
import { More } from './pages/More'
import { Overview } from './pages/Overview'
import { PageHead } from './pages/PageHead'
import { PlanBoard } from './pages/PlanBoard'
import { Settings } from './pages/Settings'
import { Week } from './pages/Week'
import { closeCourse, pageHref, parseHash, type Page, type Route } from './route'
import { Sheet } from './Sheet'
import { SyncStatus } from './sync/SyncStatus'

const STALE_DAYS = 3

type Load =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; courses: CoursesFile; changes: ChangesFile; handbook: HandbookFile | null; career: CareerData | null; checkedAt: string }

type NavKind = 'overview' | 'plan' | 'courses' | 'week' | 'career' | 'changes' | 'help' | 'settings'

const NAV: Record<NavKind, { icon: IconName; page: Page }> = {
  overview: { icon: 'overview', page: { kind: 'overview' } },
  plan: { icon: 'plan', page: { kind: 'plan' } },
  courses: { icon: 'book', page: { kind: 'courses', term: null, row: null, filter: null } },
  week: { icon: 'calendar', page: { kind: 'week' } },
  career: { icon: 'briefcase', page: { kind: 'career', focus: null } },
  changes: { icon: 'bell', page: { kind: 'changes' } },
  help: { icon: 'help', page: { kind: 'help', id: null } },
  settings: { icon: 'settings', page: { kind: 'settings' } },
}
const MAIN: NavKind[] = ['overview', 'plan', 'courses', 'week']
const SECONDARY: NavKind[] = ['career', 'changes', 'help']

function currentRoute(): Route {
  const r = parseHash(location.hash)
  if (r.redirect !== undefined) history.replaceState(null, '', r.redirect)
  return r.route
}

function NavItem({ lang, kind, current, badge }: { lang: Lang; kind: NavKind; current: boolean; badge?: number }) {
  const { icon, page } = NAV[kind]
  return (
    <li>
      <a class="nav-item" href={pageHref(page)} aria-current={current ? 'page' : undefined}>
        <Icon name={icon} size={18} />
        <span class="nav-label">{t(lang, `nav.${kind}`)}</span>
        {!!badge && <span class="nav-badge" data-testid="changes-badge" aria-label={t(lang, 'top.changes', { n: badge })}>{badge}</span>}
      </a>
    </li>
  )
}

export function App() {
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [state, update, persistent, sync] = useAppState()
  const [route, setRoute] = useState<Route>(currentRoute)
  const lang = state.lang

  useEffect(() => {
    loadData()
      .then(({ courses, changes, status, handbook, career }: {
        courses: CoursesFile; changes: ChangesFile; status?: StatusFile | null; handbook?: HandbookFile | null; career?: CareerData | null
      }) => setLoad({
        status: 'ready', courses, changes, handbook: handbook ?? null, career: career ?? null,
        checkedAt: status?.checkedAt ?? courses.meta.scrapedAt,
      }))
      .catch((e: unknown) => setLoad({ status: 'error', error: e instanceof Error ? e.message : String(e) }))
  }, [])
  useEffect(() => {
    const onHash = () => setRoute(currentRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  useEffect(() => { document.documentElement.lang = lang }, [lang])
  const theme = state.theme ?? 'light'
  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])
  // A new page starts at the top, like any other site.
  useEffect(() => { if (typeof window.scrollTo === 'function') window.scrollTo(0, 0) }, [route.page.kind])

  const alerts = useMemo(() => (load.status === 'ready' ? pendingAlerts(state, load.courses, load.changes) : []), [load, state])
  const ageDays = load.status === 'ready' ? Math.floor((Date.now() - Date.parse(load.checkedAt)) / 86400_000) : 0
  const { page } = route
  const navKind: NavKind | 'more' = page.kind === 'more' ? 'more' : page.kind
  const openSettings = () => { location.hash = pageHref({ kind: 'settings' }) }

  const body = (() => {
    if (load.status !== 'ready') return null
    const { courses: data, handbook, career, changes } = load
    const head = (kind: NavKind, extra?: ComponentChildren) => <PageHead title={t(lang, `nav.${kind}`)} lead={t(lang, `page.${kind}.lead`)}>{extra}</PageHead>
    switch (page.kind) {
      case 'overview': return <Overview data={data} handbook={handbook} career={career} state={state} update={update} />
      case 'plan': return <PlanBoard data={data} handbook={handbook} state={state} update={update} />
      case 'courses': return <Courses key={`${page.term}/${page.row}/${page.filter}`} data={data} handbook={handbook} career={career} state={state}
        update={update} term={page.term} row={page.row} filter={page.filter} />
      case 'week': return <Week data={data} state={state} update={update} />
      case 'career': return <>{head('career')}<CareerView data={data} handbook={handbook} career={career} focus={page.focus} state={state} update={update} /></>
      case 'changes': return <>{head('changes')}<ChangesView data={data} changes={changes} state={state} alerts={alerts} update={update} /></>
      case 'help': return <Help lang={lang} data={data} id={page.id} />
      case 'settings': return <Settings lang={lang} state={state} update={update} sync={sync} checkedAt={load.checkedAt} data={data} />
      case 'more': return <More lang={lang} alerts={alerts.length} />
    }
  })()

  return (
    <div class="shell">
      <a class="skip-link" href="#main">{t(lang, 'nav.skip')}</a>
      <aside class="sidebar">
        <a class="brand" href="#/">
          <BrandMark />
          <span class="brand-name">{t(lang, 'app.short')}</span>
        </a>
        <nav class="nav" aria-label={t(lang, 'nav.label')}>
          <ul class="nav-list">{MAIN.map((k) => <NavItem key={k} lang={lang} kind={k} current={navKind === k} />)}</ul>
          <ul class="nav-list">
            {SECONDARY.map((k) => <NavItem key={k} lang={lang} kind={k} current={navKind === k} badge={k === 'changes' ? alerts.length : 0} />)}
          </ul>
        </nav>
        <div class="sidebar-foot">
          <ul class="nav-list"><NavItem lang={lang} kind="settings" current={navKind === 'settings'} /></ul>
          <div class="sidebar-status">
            <SyncStatus lang={lang} sync={sync} onOpen={openSettings} />
            {load.status === 'ready' && <span class="data-age">{t(lang, 'data.age', { date: fmtDate(lang, load.checkedAt) })}</span>}
          </div>
        </div>
      </aside>

      <header class="mobile-top">
        <a class="brand" href="#/"><BrandMark /><span class="brand-name">{t(lang, 'app.short')}</span></a>
        <SyncStatus lang={lang} sync={sync} onOpen={openSettings} />
      </header>

      <main id="main" class="main" tabIndex={-1}>
        {!persistent && <p class="banner banner-warn">{t(lang, 'storage.off')}</p>}
        {load.status === 'ready' && ageDays > STALE_DAYS && <p class="banner banner-warn">{t(lang, 'data.stale', { days: ageDays })}</p>}
        <ErrorBoundary onReset={() => update(() => defaultState())}>
          {load.status === 'loading' && <p class="empty loading">{t(lang, 'data.loading')}</p>}
          {load.status === 'error' && <p class="banner banner-error">{t(lang, 'data.error', { error: load.error })}</p>}
          {body}
        </ErrorBoundary>
      </main>

      <nav class="tabbar" aria-label={t(lang, 'nav.label')}>
        {MAIN.map((k) => (
          <a key={k} class="tab" href={pageHref(NAV[k].page)} aria-current={navKind === k ? 'page' : undefined}>
            <Icon name={NAV[k].icon} size={20} /><span>{t(lang, `nav.${k}.short`)}</span>
          </a>
        ))}
        <a class="tab" href={pageHref({ kind: 'more' })}
          aria-current={['more', ...SECONDARY, 'settings'].includes(navKind) ? 'page' : undefined}>
          <Icon name="more" size={20} /><span>{t(lang, 'nav.more')}</span>
          {alerts.length > 0 && <span class="tab-dot" aria-label={t(lang, 'top.changes', { n: alerts.length })} />}
        </a>
      </nav>

      {route.course && load.status === 'ready' && (
        <Sheet key={route.course} title={courseTitle(load.courses, load.handbook, route.course)} closeLabel={t(lang, 'event.close')} onClose={closeCourse}>
          <ErrorBoundary onReset={closeCourse}>
            <CourseDetail data={load.courses} handbook={load.handbook} career={load.career} state={state} update={update} id={route.course} />
          </ErrorBoundary>
        </Sheet>
      )}
    </div>
  )
}

function BrandMark() {
  // A credit ruler: three bars of growing length, the last one still open.
  return (
    <svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="currentColor" />
      <rect x="8" y="9" width="10" height="3" rx="1.5" fill="var(--brand-ink)" />
      <rect x="8" y="14.5" width="16" height="3" rx="1.5" fill="var(--brand-ink)" />
      <rect x="8" y="20" width="16" height="3" rx="1.5" fill="none" stroke="var(--brand-ink)" stroke-width="1.2" />
    </svg>
  )
}
