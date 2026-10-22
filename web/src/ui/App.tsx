import { useEffect, useMemo, useState } from 'preact/hooks'
import { loadData } from '../data'
import { t } from '../i18n'
import { fit } from '../logic/career'
import { EMPTY_HANDBOOK, moduleRows } from '../logic/handbook'
import { pendingAlerts } from '../logic/alerts'
import { defaultState, setLang, toggleTheme, useAppState } from '../store'
import type { CareerData, ChangesFile, CoursesFile, HandbookFile, Lang, StatusFile } from '../types'
import { pathTitle, pointsOf } from './career/model'
import { CareerView } from './career/CareerView'
import { ChangesView } from './changes/ChangesView'
import { Drawer } from './Drawer'
import { ErrorBoundary } from './ErrorBoundary'
import { fmtDate } from './format'
import { GlossaryView } from './glossary/GlossaryView'
import { GuideView } from './guide/GuideView'
import { Icon } from './Icon'
import { AddCourse, addTitle } from './panels/AddCourse'
import { CourseDetail, courseTitle } from './panels/CourseDetail'
import { WeekPanel } from './panels/WeekPanel'
import { PlanPage } from './plan/PlanPage'
import { closePanel, parseHash, panelHref, type Panel } from './route'
import { SyncForm } from './sync/SyncForm'
import { SyncStatus } from './sync/SyncStatus'

const STALE_DAYS = 3

type Load =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; courses: CoursesFile; changes: ChangesFile; handbook: HandbookFile | null; career: CareerData | null; checkedAt: string }

function currentPanel(): Panel | null {
  const r = parseHash(location.hash)
  if (r.redirect !== undefined) {
    history.replaceState(null, '', r.redirect)
    return parseHash(r.redirect).panel
  }
  return r.panel
}

export function App() {
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [state, update, persistent, sync] = useAppState()
  const [panel, setPanel] = useState<Panel | null>(currentPanel)
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
    const onHash = () => setPanel(currentPanel())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  useEffect(() => { document.documentElement.lang = lang }, [lang])
  const theme = state.theme ?? 'light'
  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])

  const alerts = useMemo(() => (load.status === 'ready' ? pendingAlerts(state, load.courses, load.changes) : []), [load, state])
  const ageDays = load.status === 'ready' ? Math.floor((Date.now() - Date.parse(load.checkedAt)) / 86400_000) : 0

  // The goal button: the first followed path that still exists, with its planned fit.
  const goal = useMemo(() => {
    if (load.status !== 'ready' || !load.career) return null
    const c = load.career
    const f = (state.followed ?? []).find((x) => c.roles.roles.some((r) => r.id === x.role) && c.lenses.lenses.some((l) => l.id === x.lens))
    if (!f) return { label: t(lang, 'top.goalPick'), href: panelHref({ kind: 'goal', focus: null }) }
    const rows = moduleRows(load.courses, load.handbook ?? EMPTY_HANDBOOK)
    const n = fit(pointsOf(state, c, rows).all, c.roles.roles.find((r) => r.id === f.role)!, c.lenses.lenses.find((l) => l.id === f.lens)!)
    return { label: t(lang, 'top.goal', { path: pathTitle(c, f.role, f.lens, lang), n }), href: panelHref({ kind: 'goal', focus: `${f.role}:${f.lens}` }) }
  }, [load, state, lang])

  const panelView = (() => {
    if (!panel || load.status !== 'ready') return null
    const { courses: data, handbook, career, changes } = load
    switch (panel.kind) {
      case 'add': return {
        title: addTitle(lang, state, panel.term, panel.row),
        body: <AddCourse key={`${panel.term}/${panel.row}/${panel.filter}`} data={data} handbook={handbook} career={career} state={state} update={update}
          term={panel.term} row={panel.row} filter={panel.filter} />,
      }
      case 'course': return {
        title: courseTitle(data, handbook, panel.id),
        body: <CourseDetail key={panel.id} data={data} handbook={handbook} career={career} state={state} update={update} id={panel.id} />,
      }
      case 'week': return { title: t(lang, 'week.title', { term: data.meta.term }), body: <WeekPanel data={data} state={state} update={update} /> }
      case 'goal': return {
        title: t(lang, 'goal.title'),
        body: <CareerView data={data} handbook={handbook} career={career} focus={panel.focus} state={state} update={update} />,
      }
      case 'changes': return {
        title: t(lang, 'tab.changes'),
        body: <ChangesView data={data} changes={changes} state={state} alerts={alerts} update={update} />,
      }
      case 'info': return panel.id === 'guide'
        ? { title: t(lang, 'info.guide'), body: <GuideView lang={lang} data={data} /> }
        : { title: t(lang, 'info.title'), body: <GlossaryView lang={lang} data={data} focus={panel.id} embedded /> }
      case 'sync': return { title: t(lang, 'sync.title'), body: <SyncForm lang={lang} sync={sync} /> }
    }
  })()

  return (
    <div class={`app${panelView ? ' has-drawer' : ''}`}>
      <header class="topbar">
        <a class="brand" href="#/" aria-label={t(lang, 'app.title')}>
          <svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="8" fill="currentColor" />
            <rect x="7" y="8" width="5" height="10" rx="2" fill="#fff" />
            <rect x="13.5" y="12" width="5" height="12" rx="2" fill="#fff" opacity=".75" />
            <rect x="20" y="7" width="5" height="8" rx="2" fill="#fff" opacity=".5" />
          </svg>
          <span class="brand-name">{t(lang, 'app.title')}</span>
        </a>
        <div class="top-actions">
          {goal && <a class="top-button" href={goal.href}><Icon name="compass" size={16} /><span class="top-label">{goal.label}</span></a>}
          <a class="top-button" href={panelHref({ kind: 'changes' })} aria-label={t(lang, 'top.changes', { n: alerts.length })}>
            <Icon name="bell" size={16} />
            <span class="top-label">{t(lang, 'tab.changes')}</span>
            {alerts.length > 0 && <span class="tab-badge" data-testid="changes-badge">{alerts.length}</span>}
          </a>
          <a class="top-button" href={panelHref({ kind: 'info', id: null })} aria-label={t(lang, 'info.title')}><Icon name="glossary" size={16} /></a>
          <SyncStatus lang={lang} sync={sync} onOpen={() => { location.hash = panelHref({ kind: 'sync' }) }} />
          <button type="button" class="icon-button theme-toggle" onClick={() => update(toggleTheme)}
            aria-label={t(lang, theme === 'dark' ? 'theme.light' : 'theme.dark')}>
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

      <div class="layout">
        <main class="content">
          <ErrorBoundary onReset={() => update(() => defaultState())}>
            {load.status === 'loading' && <p class="empty loading">{t(lang, 'data.loading')}</p>}
            {load.status === 'error' && <p class="banner banner-error">{t(lang, 'data.error', { error: load.error })}</p>}
            {load.status === 'ready' && <PlanPage data={load.courses} handbook={load.handbook} state={state} update={update}
              active={panel?.kind === 'add' ? { term: panel.term, row: panel.row } : panel?.kind === 'course' ? { id: panel.id } : null} />}
          </ErrorBoundary>
        </main>
        {panelView && (
          <Drawer key={panel!.kind} title={panelView.title} closeLabel={t(lang, 'event.close')} onClose={closePanel}>
            <ErrorBoundary onReset={closePanel}>{panelView.body}</ErrorBoundary>
          </Drawer>
        )}
      </div>

      {load.status === 'ready' && (
        <footer class="footer">
          <span class="footer-status"><span class="status-dot" aria-hidden="true" />{t(lang, 'data.age', { date: fmtDate(lang, load.checkedAt) })}</span>
          <span>{load.courses.meta.term} · SPO {load.courses.meta.spo}</span>
        </footer>
      )}
    </div>
  )
}
