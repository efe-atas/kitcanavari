import { locale } from '../../locale'
import { useMemo, useState } from 'preact/hooks'
import { t } from '../../i18n'
import { addDays, berlinNow, clashes, defaultWeek, mondayOf, occKey, occurrences, weekDates } from '../../logic/calendar'
import { findConflicts } from '../../logic/conflicts'
import { buildIcs } from '../../logic/ics'
import { CURRENT_TERM } from '../../logic/terms'
import { weeklyHours } from '../../logic/insights'
import type { CoursesFile, Lang, UserState } from '../../types'
import { download } from '../download'
import { fmtDate } from '../format'
import { Icon } from '../Icon'
import { useNow } from '../overview/TodayCard'
import { termName } from '../roadmap/format'
import { courseHref, pageHref } from '../route'
import { CalendarAgenda, CalendarGrid } from '../schedule/Calendar'
import { UnscheduledList } from '../schedule/UnscheduledList'
import { PageHead } from './PageHead'

interface Props {
  data: CoursesFile
  state: UserState
  update: (fn: (s: UserState) => UserState) => void
}

function weekLabel(lang: Lang, monday: string): string {
  const sunday = addDays(monday, 6)
  const f = (iso: string, opts: Intl.DateTimeFormatOptions) => {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(locale(lang), { ...opts, timeZone: 'UTC' })
  }
  return `${f(monday, { day: 'numeric', month: 'short' })} – ${f(sunday, { day: 'numeric', month: 'short', year: 'numeric' })}`
}

/** This term's week in real dates: sessions, cancellations and clashes, week by week, and the calendar file. */
export function Week({ data, state }: Props) {
  const { lang } = state
  const now = useNow()
  const [view, setView] = useState<'grid' | 'agenda'>(() => typeof matchMedia === 'function' && matchMedia('(max-width: 640px)').matches ? 'agenda' : 'grid')
  const [week, setWeek] = useState(() => defaultWeek(data.events, berlinNow().date))
  const dates = weekDates(week)
  const occ = useMemo(() => occurrences(state.selected, data.events, dates[0], dates[6]), [state.selected, data, week])
  const weekClashes = useMemo(() => clashes(occ), [occ])
  const clashing = useMemo(() => new Set(weekClashes.flatMap((c) => [occKey(c.a), occKey(c.b)])), [weekClashes])
  const termConflicts = useMemo(() => findConflicts(state.selected, data.events), [data, state.selected])
  const ids = Object.keys(state.selected)
  const title = (id: string) => data.events[id]?.title ?? state.selected[id]?.title ?? id
  const open = (eventId: string) => {
    const mid = state.selected[eventId]?.moduleId ?? data.events[eventId]?.moduleIds[0]
    if (mid) location.hash = courseHref(mid)
  }
  const thisWeek = mondayOf(now.date) === week
  // Workload of this term's modules in the timetable, each module once.
  const termEcts = [...new Set(Object.values(state.selected).map((e) => e.moduleId).filter((m): m is string => !!m))]
    .reduce((n, id) => n + (data.modules[id]?.ects ?? 0), 0)
  const cancelled = occ.filter((o) => o.cancelled)
  const hours = occ.filter((o) => !o.cancelled).reduce((n, o) => {
    const [h1, m1] = o.start.split(':').map(Number)
    const [h2, m2] = o.end.split(':').map(Number)
    return n + (h2 * 60 + m2 - h1 * 60 - m1)
  }, 0)

  return (
    <div class="week-page">
      <PageHead title={t(lang, 'nav.week')} lead={t(lang, 'page.week.lead', { term: termName(lang, CURRENT_TERM) })}>
        <a class="button-quiet" href={pageHref({ kind: 'plan' })}><Icon name="plan" size={16} />{t(lang, 'journey.viewPlan')}</a>
        {ids.length > 0 && (
          <button type="button" class="button-quiet" onClick={() => download('kit-schedule.ics', buildIcs(state.selected, data.events, data.meta.scrapedAt, state.deadlines), 'text/calendar')}>
            <Icon name="download" size={16} />{t(lang, 'schedule.ics')}
          </button>
        )}
      </PageHead>
      {ids.length === 0 ? (
        <div class="empty-state">
          <Icon name="calendar" size={28} />
          <p>{t(lang, 'week.empty')}</p>
          <a class="button" href={pageHref({ kind: 'courses', term: CURRENT_TERM, row: null, filter: null })}><Icon name="plus" size={16} />{t(lang, 'ov.addNow')}</a>
        </div>
      ) : (
        <>
          <div class="schedule-toolbar">
            <div class="week-nav" role="group" aria-label={t(lang, 'wk.nav')}>
              <button type="button" class="icon-button" onClick={() => setWeek(addDays(week, -7))} aria-label={t(lang, 'wk.prev')}><Icon name="chevronLeft" size={18} /></button>
              <h2 class="week-label" aria-live="polite">{weekLabel(lang, week)}</h2>
              <button type="button" class="icon-button" onClick={() => setWeek(addDays(week, 7))} aria-label={t(lang, 'wk.next')}><Icon name="chevron" size={18} /></button>
              <button type="button" class="button-quiet is-small" disabled={thisWeek} onClick={() => setWeek(mondayOf(now.date))}>{t(lang, 'wk.thisWeek')}</button>
            </div>
            <p class="week-stats">
              <span>{t(lang, 'wk.sessions', { n: occ.filter((o) => !o.cancelled).length })}</span>
              <span>{t(lang, 'wk.hours', { h: Math.round(hours / 6) / 10 })}</span>
              {termEcts > 0 && <span class="week-load" title={t(lang, 'wk.loadHint', { ects: termEcts })}>{t(lang, 'wk.load', { h: weeklyHours(termEcts) })}</span>}
              {weekClashes.length > 0 && <span class="is-bad"><Icon name="alert" size={14} />{t(lang, 'wk.clashes', { n: weekClashes.length })}</span>}
              {cancelled.length > 0 && <span class="is-warn">{t(lang, 'wk.cancelled', { n: cancelled.length })}</span>}
            </p>
            <div class="segmented" role="group" aria-label={t(lang, 'v2.scheduleView')}>
              <button type="button" aria-pressed={view === 'grid'} onClick={() => setView('grid')}><Icon name="calendar" size={16} />{t(lang, 'v2.weekGrid')}</button>
              <button type="button" aria-pressed={view === 'agenda'} onClick={() => setView('agenda')}><Icon name="list" size={16} />{t(lang, 'v2.agenda')}</button>
            </div>
          </div>
          {view === 'grid'
            ? <div class="schedule-scroll"><CalendarGrid lang={lang} data={data} dates={dates} occ={occ} clashing={clashing} today={now} onOpen={open} /></div>
            : <CalendarAgenda lang={lang} data={data} dates={dates} occ={occ} clashing={clashing} today={now} onOpen={open} />}
          <ul class="plain type-legend" aria-label={t(lang, 'wk.legend')}>
            {(['v', 'u', 'p', 's'] as const).map((k) => <li key={k} class={`type-${k}`}><i />{t(lang, `wk.type.${k}`)}</li>)}
          </ul>
        </>
      )}
      {termConflicts.length > 0 && (
        <section class="conflict-list" aria-label={t(lang, 'schedule.conflicts')}>
          <h2><Icon name="alert" size={16} />{t(lang, 'wk.termConflicts', { n: termConflicts.length })}</h2>
          <ul>
            {termConflicts.map((c) => (
              <li key={`${c.a}-${c.b}-${c.day}-${c.start}`}>
                {title(c.a)} {t(lang, 'wk.and')} {title(c.b)}: {t(lang, `day.${c.day}`)} {c.start}–{c.end}
                {c.date && ` (${t(lang, 'schedule.firstOn', { date: fmtDate(lang, c.date) })})`}
              </li>
            ))}
          </ul>
        </section>
      )}
      <UnscheduledList lang={lang} data={data} state={state} onOpen={open} />
    </div>
  )
}
