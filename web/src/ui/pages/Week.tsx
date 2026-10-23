import { useMemo, useState } from 'preact/hooks'
import { t } from '../../i18n'
import { findConflicts } from '../../logic/conflicts'
import { buildIcs } from '../../logic/ics'
import { CURRENT_TERM } from '../../logic/terms'
import type { CoursesFile, UserState } from '../../types'
import { download } from '../download'
import { fmtDate } from '../format'
import { Icon } from '../Icon'
import { termName } from '../roadmap/format'
import { courseHref, pageHref } from '../route'
import { UnscheduledList } from '../schedule/UnscheduledList'
import { WeekAgenda, WeekGrid } from '../schedule/WeekGrid'
import { PageHead } from './PageHead'

interface Props {
  data: CoursesFile
  state: UserState
  update: (fn: (s: UserState) => UserState) => void
}

/** This term's week: the timetable, clashes, and the calendar file. */
export function Week({ data, state }: Props) {
  const { lang } = state
  const [view, setView] = useState<'grid' | 'agenda'>(() => typeof matchMedia === 'function' && matchMedia('(max-width: 640px)').matches ? 'agenda' : 'grid')
  const conflicts = useMemo(() => findConflicts(state.selected, data.events), [data, state.selected])
  const ids = Object.keys(state.selected)
  const title = (id: string) => data.events[id]?.title ?? state.selected[id]?.title ?? id
  const open = (eventId: string) => {
    const mid = state.selected[eventId]?.moduleId ?? data.events[eventId]?.moduleIds[0]
    if (mid) location.hash = courseHref(mid)
  }

  return (
    <div class="week-page">
      <PageHead title={t(lang, 'nav.week')} lead={t(lang, 'page.week.lead', { term: termName(lang, CURRENT_TERM) })}>
        <a class="button-quiet" href={pageHref({ kind: 'plan' })}><Icon name="plan" size={16} />{t(lang, 'journey.viewPlan')}</a>
        {ids.length > 0 && (
          <button type="button" class="button-quiet" onClick={() => download('kit-schedule.ics', buildIcs(state.selected, data.events, data.meta.scrapedAt), 'text/calendar')}>
            <Icon name="download" size={16} />{t(lang, 'schedule.ics')}
          </button>
        )}
      </PageHead>
      {ids.length === 0 && (
        <div class="empty-state">
          <Icon name="calendar" size={28} />
          <p>{t(lang, 'week.empty')}</p>
          <a class="button" href={pageHref({ kind: 'courses', term: CURRENT_TERM, row: null, filter: null })}><Icon name="plus" size={16} />{t(lang, 'ov.addNow')}</a>
        </div>
      )}
      {conflicts.length > 0 && (
        <section class="conflict-list" aria-label={t(lang, 'schedule.conflicts')}>
          <h2><Icon name="alert" size={16} />{t(lang, 'schedule.conflicts')}</h2>
          <ul>
            {conflicts.map((c) => (
              <li key={`${c.a}-${c.b}-${c.day}-${c.start}`}>
                {title(c.a)} {t(lang, 'wk.and')} {title(c.b)}: {t(lang, `day.${c.day}`)} {c.start}–{c.end}
                {c.date && ` (${t(lang, 'schedule.firstOn', { date: fmtDate(lang, c.date) })})`}
              </li>
            ))}
          </ul>
        </section>
      )}
      {ids.length > 0 && <>
        <div class="schedule-toolbar"><div class="segmented" role="group" aria-label={t(lang, 'v2.scheduleView')}><button type="button" aria-pressed={view === 'grid'} onClick={() => setView('grid')}><Icon name="calendar" size={16} />{t(lang, 'v2.weekGrid')}</button><button type="button" aria-pressed={view === 'agenda'} onClick={() => setView('agenda')}><Icon name="catalog" size={16} />{t(lang, 'v2.agenda')}</button></div><span>{termName(lang, CURRENT_TERM)}</span></div>
        {view === 'grid' ? <div class="schedule-scroll"><WeekGrid lang={lang} data={data} state={state} conflicts={conflicts} onOpen={open} /></div> : <WeekAgenda lang={lang} data={data} state={state} conflicts={conflicts} onOpen={open} />}
      </>}
      <UnscheduledList lang={lang} data={data} state={state} onOpen={open} />
    </div>
  )
}
