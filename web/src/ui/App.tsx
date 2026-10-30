import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { loadData } from '../data'
import { t } from '../i18n'
import { pendingAlerts } from '../logic/alerts'
import { buildIcs } from '../logic/ics'
import { addTerm, defaultState, exportState, setLang, setTheme, useAppState } from '../store'
import type { CareerData, ChangesFile, CoursesFile, HandbookFile, Lang, StatusFile, UserState } from '../types'
import { CareerView } from './career/CareerView'
import { ChangesView } from './changes/ChangesView'
import { download } from './download'
import { ErrorBoundary } from './ErrorBoundary'
import { fmtDate } from './format'
import { Icon, type IconName } from './Icon'
import { CommandPalette, ShortcutsDialog, type PaletteCommand, type Shortcut } from './palette/CommandPalette'
import { CourseDetail, courseTitle } from './panels/CourseDetail'
import { Courses } from './pages/Courses'
import { Help } from './pages/Help'
import { More } from './pages/More'
import { Overview } from './pages/Overview'
import { PageHead } from './pages/PageHead'
import { PlanBoard } from './pages/PlanBoard'
import { Settings } from './pages/Settings'
import { Shared } from './pages/Shared'
import { Week } from './pages/Week'
import { closeCourse, pageHref, parseHash, type Page, type Route } from './route'
import { ShareDialog } from './ShareDialog'
import { Sheet } from './Sheet'
import { SyncStatus } from './sync/SyncStatus'
import { applyUpdate, UPDATE_EVENT } from '../pwa'
import { ToastProvider, useToast } from './toast'

const STALE_DAYS = 3

type Load =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; courses: CoursesFile; changes: ChangesFile; handbook: HandbookFile | null; career: CareerData | null; checkedAt: string }

type NavKind = 'overview' | 'plan' | 'courses' | 'week' | 'career' | 'changes' | 'help' | 'settings'

const NAV: Record<NavKind, { icon: IconName; page: Page; key: string }> = {
  overview: { icon: 'overview', page: { kind: 'overview' }, key: 'o' },
  courses: { icon: 'book', page: { kind: 'courses', term: null, row: null, filter: null }, key: 'c' },
  plan: { icon: 'plan', page: { kind: 'plan' }, key: 'p' },
  week: { icon: 'calendar', page: { kind: 'week' }, key: 'w' },
  career: { icon: 'briefcase', page: { kind: 'career', focus: null }, key: 'k' },
  changes: { icon: 'bell', page: { kind: 'changes' }, key: 'n' },
  help: { icon: 'help', page: { kind: 'help', id: null }, key: 'h' },
  settings: { icon: 'settings', page: { kind: 'settings' }, key: 's' },
}
const MAIN: NavKind[] = ['overview', 'courses', 'plan', 'week']
const SECONDARY: NavKind[] = ['career', 'changes', 'help']
const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
export const MOD_KEY = MAC ? '⌘' : 'Ctrl'

function currentRoute(): Route {
  const r = parseHash(location.hash)
  if (r.redirect !== undefined) history.replaceState(null, '', r.redirect)
  return r.route
}

/** The theme to show: the user's choice, else the system's, kept up to date when the system switches. */
function useResolvedTheme(choice: UserState['theme']): 'light' | 'dark' {
  const query = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null
  const [systemDark, setSystemDark] = useState(() => !!query?.matches)
  useEffect(() => {
    if (!query) return
    const on = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    query.addEventListener?.('change', on)
    return () => query.removeEventListener?.('change', on)
  }, [])
  const theme = choice ?? (systemDark ? 'dark' : 'light')
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0d1218' : '#f4f5f3')
  }, [theme])
  return theme
}

const typing = (el: EventTarget | null) => el instanceof HTMLElement
  && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))

function NavItem({ lang, kind, current }: { lang: Lang; kind: NavKind; current: boolean }) {
  const { icon, page } = NAV[kind]
  return (
    <li>
      <a class="nav-item" href={pageHref(page)} aria-current={current ? 'page' : undefined} title={t(lang, `nav.${kind}`)}>
        <Icon name={icon} size={17} />
        <span class="nav-label">{t(lang, `nav.${kind}.short`)}</span>
      </a>
    </li>
  )
}

export function App() {
  const app = useAppState()
  return (
    <ToastProvider closeLabel={t(app[0].lang, 'event.close')}>
      <Shell app={app} />
    </ToastProvider>
  )
}

function Shell({ app: [state, update, persistent, sync] }: { app: ReturnType<typeof useAppState> }) {
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [route, setRoute] = useState<Route>(currentRoute)
  const [palette, setPalette] = useState(false)
  const [shortcuts, setShortcuts] = useState(false)
  const [sharing, setSharing] = useState(false)
  const toast = useToast()
  const lang = state.lang
  const theme = useResolvedTheme(state.theme)
  const chord = useRef<number>(0)

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
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  useEffect(() => {
    const onUpdate = (e: Event) => {
      const worker = (e as CustomEvent<ServiceWorker>).detail
      toast({ message: t(lang, 'pwa.update'), persistent: true, action: { label: t(lang, 'pwa.reload'), run: () => applyUpdate(worker) } })
    }
    window.addEventListener(UPDATE_EVENT, onUpdate)
    return () => window.removeEventListener(UPDATE_EVENT, onUpdate)
  }, [lang])
  // A new page starts at the top, like any other site.
  useEffect(() => { if (typeof window.scrollTo === 'function') window.scrollTo(0, 0) }, [route.page.kind])

  const go = useCallback((kind: NavKind) => { location.hash = pageHref(NAV[kind].page) }, [])
  const open = palette || shortcuts || sharing
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setShortcuts(false)
        setPalette((x) => !x)
        return
      }
      if (open || e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || document.body.classList.contains('has-sheet')) return
      if (e.key === '/') {
        e.preventDefault()
        const search = document.querySelector<HTMLInputElement>('[data-page-search]')
        if (search) search.focus()
        else setPalette(true)
      } else if (e.key === '?') {
        e.preventDefault()
        setShortcuts(true)
      } else if (e.key === 'g') {
        chord.current = Date.now()
      } else if (Date.now() - chord.current < 1200) {
        const kind = (Object.keys(NAV) as NavKind[]).find((k) => NAV[k].key === e.key.toLowerCase())
        chord.current = 0
        if (kind) { e.preventDefault(); go(kind) }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const alerts = useMemo(() => (load.status === 'ready' ? pendingAlerts(state, load.courses, load.changes) : []), [load, state])
  const ageDays = load.status === 'ready' ? Math.floor((Date.now() - Date.parse(load.checkedAt)) / 86400_000) : 0
  const { page } = route
  const navKind: NavKind | 'more' = page.kind === 'more' ? 'more' : page.kind === 'shared' ? 'plan' : page.kind
  const openSettings = () => go('settings')
  const switchTheme = () => update((s) => setTheme(s, theme === 'dark' ? 'light' : 'dark'))
  const switchLang = () => update((s) => setLang(s, lang === 'tr' ? 'en' : 'tr'))

  const pages: PaletteCommand[] = (Object.keys(NAV) as NavKind[]).map((k) => ({
    id: k, label: t(lang, `nav.${k}`), icon: NAV[k].icon, hint: `G ${NAV[k].key.toUpperCase()}`, keywords: t(lang, `page.${k}.lead`), run: () => go(k),
  }))
  const actions: PaletteCommand[] = load.status !== 'ready' ? [] : [
    { id: 'theme', label: t(lang, theme === 'dark' ? 'theme.toLight' : 'theme.toDark'), icon: theme === 'dark' ? 'sun' : 'moon', keywords: 'theme tema dark light', run: switchTheme },
    { id: 'lang', label: lang === 'tr' ? 'Switch to English' : 'Türkçeye geç', icon: 'globe', keywords: 'language dil', run: switchLang },
    { id: 'term', label: t(lang, 'road.addTerm'), icon: 'plus', keywords: 'semester dönem term', run: () => { update(addTerm); toast({ message: t(lang, 'toast.termAdded'), link: { label: t(lang, 'journey.viewPlan'), href: pageHref({ kind: 'plan' }) } }) } },
    ...(Object.keys(state.selected).length ? [{
      id: 'ics', label: t(lang, 'schedule.ics'), icon: 'download' as IconName, keywords: 'ics calendar takvim',
      run: () => download('kit-schedule.ics', buildIcs(state.selected, load.courses.events, load.courses.meta.scrapedAt), 'text/calendar'),
    }] : []),
    { id: 'backup', label: t(lang, 'schedule.export'), icon: 'download', keywords: 'backup yedek json export', run: () => download('kit-plan.json', exportState(state), 'application/json') },
    { id: 'share', label: t(lang, 'share.title'), icon: 'share', keywords: 'share paylaş link bağlantı', run: () => setSharing(true) },
    { id: 'print', label: t(lang, 'cmd.print'), icon: 'print', keywords: 'pdf print yazdır', run: () => { location.hash = pageHref({ kind: 'plan' }); setTimeout(() => window.print(), 400) } },
    { id: 'shortcuts', label: t(lang, 'cmd.shortcuts'), icon: 'keyboard', keywords: 'keyboard klavye', run: () => setShortcuts(true) },
  ]
  const shortcutList: Shortcut[] = [
    { keys: [MOD_KEY, 'K'], label: t(lang, 'cmd.title') },
    { keys: ['/'], label: t(lang, 'cmd.slash') },
    { keys: ['?'], label: t(lang, 'cmd.shortcuts') },
    ...(Object.keys(NAV) as NavKind[]).map((k) => ({ keys: ['G', NAV[k].key.toUpperCase()], label: t(lang, `nav.${k}`) })),
    { keys: ['Esc'], label: t(lang, 'cmd.escape') },
  ]

  const body = (() => {
    if (load.status !== 'ready') return null
    const { courses: data, handbook, career, changes } = load
    switch (page.kind) {
      case 'overview': return <Overview data={data} handbook={handbook} career={career} state={state} update={update} />
      case 'plan': return <PlanBoard data={data} handbook={handbook} state={state} update={update} />
      case 'courses': return <Courses key={`${page.term}/${page.row}/${page.filter}`} data={data} handbook={handbook} career={career} state={state}
        update={update} term={page.term} row={page.row} filter={page.filter} starred={page.starred} />
      case 'week': return <Week data={data} state={state} update={update} />
      case 'career': return <><PageHead title={t(lang, 'nav.career')} lead={t(lang, 'page.career.lead')} /><CareerView data={data} handbook={handbook} career={career} focus={page.focus} state={state} update={update} /></>
      case 'changes': return <><PageHead title={t(lang, 'nav.changes')} lead={t(lang, 'page.changes.lead')} /><ChangesView data={data} changes={changes} state={state} alerts={alerts} update={update} /></>
      case 'help': return <Help lang={lang} data={data} id={page.id} />
      case 'settings': return <Settings lang={lang} state={state} update={update} sync={sync} checkedAt={load.checkedAt} data={data} shortcuts={shortcutList} />
      case 'more': return <More lang={lang} alerts={alerts.length} />
      case 'shared': return <Shared key={page.code} code={page.code} data={data} handbook={handbook} state={state} update={update} />
    }
  })()

  return (
    <div class="shell">
      <a class="skip-link" href="#main">{t(lang, 'nav.skip')}</a>
      <header class="app-header">
        <div class="app-header-inner">
          <a class="brand" href="#/"><BrandMark /><span class="brand-name">{t(lang, 'app.short')}<small>Computer Science M.Sc.</small></span></a>
          <nav class="desktop-nav" aria-label={t(lang, 'nav.label')}>
            <ul class="nav-list">{[...MAIN, 'career' as const].map((k) => <NavItem key={k} lang={lang} kind={k} current={navKind === k} />)}</ul>
          </nav>
          <div class="header-tools">
            <button type="button" class="search-trigger" onClick={() => setPalette(true)} aria-label={t(lang, 'cmd.title')} aria-keyshortcuts={MAC ? 'Meta+K' : 'Control+K'}>
              <Icon name="search" size={17} /><span>{t(lang, 'cmd.trigger')}</span><kbd>{MOD_KEY} K</kbd>
            </button>
            <a class="icon-button" href={pageHref(NAV.changes.page)} aria-label={alerts.length ? t(lang, 'top.changes', { n: alerts.length }) : t(lang, 'nav.changes')}
              aria-current={navKind === 'changes' ? 'page' : undefined}>
              <Icon name="bell" size={19} />{alerts.length > 0 && <span class="count-badge" data-testid="changes-badge" aria-hidden="true">{alerts.length}</span>}
            </a>
            <a class="icon-button header-help" href={pageHref(NAV.help.page)} aria-label={t(lang, 'nav.help')} aria-current={navKind === 'help' ? 'page' : undefined}><Icon name="help" size={19} /></a>
            <button class="locale-control" type="button" onClick={switchLang} aria-label={lang === 'tr' ? 'Switch to English' : 'Türkçeye geç'}>{lang === 'tr' ? 'EN' : 'TR'}</button>
            <button class="icon-button" type="button" onClick={switchTheme} aria-label={t(lang, theme === 'light' ? 'theme.toDark' : 'theme.toLight')}><Icon name={theme === 'light' ? 'moon' : 'sun'} size={19} /></button>
            <SyncStatus lang={lang} sync={sync} onOpen={openSettings} />
            <a class="icon-button profile-link" href={pageHref(NAV.settings.page)} aria-label={t(lang, 'nav.settings')} aria-current={navKind === 'settings' ? 'page' : undefined}><Icon name="settings" size={19} /></a>
          </div>
        </div>
      </header>

      <main id="main" class="main" tabIndex={-1}>
        {!persistent && <p class="banner banner-warn">{t(lang, 'storage.off')}</p>}
        {!online && <p class="banner banner-offline" role="status"><Icon name="cloud" size={16} />{t(lang, 'pwa.offline')}</p>}
        {load.status === 'ready' && ageDays > STALE_DAYS && <p class="banner banner-warn">{t(lang, 'data.stale', { days: ageDays })}</p>}
        <ErrorBoundary onReset={() => update(() => defaultState())}>
          {load.status === 'loading' && <PageSkeleton label={t(lang, 'data.loading')} />}
          {load.status === 'error' && <p class="banner banner-error">{t(lang, 'data.error', { error: load.error })}</p>}
          {body}
        </ErrorBoundary>
      </main>
      <footer class="app-footer">
        <span>KIT · Computer Science M.Sc. · SPO 2025 · {t(lang, 'footer.unofficial')}</span>
        {load.status === 'ready' && <span>{t(lang, 'data.age', { date: fmtDate(lang, load.checkedAt) })}</span>}
      </footer>

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
      {palette && load.status === 'ready' && (
        <CommandPalette lang={lang} data={load.courses} handbook={load.handbook} state={state} pages={pages} actions={actions} onClose={() => setPalette(false)} />
      )}
      {shortcuts && <ShortcutsDialog lang={lang} shortcuts={shortcutList} onClose={() => setShortcuts(false)} />}
      {sharing && <ShareDialog lang={lang} state={state} onClose={() => setSharing(false)} />}
    </div>
  )
}

/** Grey shapes where the page will be, while the catalog loads. */
function PageSkeleton({ label }: { label: string }) {
  return (
    <div class="skeleton" role="status" aria-label={label}>
      <span class="sk sk-title" /><span class="sk sk-line" />
      <div class="sk-grid"><span class="sk sk-card" /><span class="sk sk-card" /><span class="sk sk-card is-wide" /></div>
    </div>
  )
}

function BrandMark() {
  // A credit ruler: three bars of growing length, the last one still open.
  return (
    <svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="currentColor" />
      <rect x="8" y="9" width="10" height="3" rx="1.5" fill="var(--accent-ink)" />
      <rect x="8" y="14.5" width="16" height="3" rx="1.5" fill="var(--accent-ink)" />
      <rect x="8" y="20" width="16" height="3" rx="1.5" fill="none" stroke="var(--accent-ink)" stroke-width="1.2" />
    </svg>
  )
}
