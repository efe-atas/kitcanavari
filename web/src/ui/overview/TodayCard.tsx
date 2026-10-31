import { locale } from '../../locale'
import { useEffect, useMemo, useState } from 'preact/hooks'
import { t } from '../../i18n'
import { addDays, berlinNow, occurrences, phaseOf, type Occurrence } from '../../logic/calendar'
import { toMinutes } from '../../logic/time'
import { CURRENT_TERM } from '../../logic/terms'
import type { CoursesFile, Lang, UserState } from '../../types'
import { typeClass } from '../format'
import { Icon } from '../Icon'
import { courseHref, pageHref } from '../route'

/** "Cuma, 30 Ekim" / "Friday, 30 October". */
export function longDate(lang: Lang, iso: string, withYear = false): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(locale(lang), {
    weekday: 'long', day: 'numeric', month: 'long', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC',
  })
}

/** "Pzt 2 Kas" / "Mon 2 Nov". */
export function shortDay(lang: Lang, iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(locale(lang), { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}

/** "in 25 min", "in 2 h 10 min". */
export function inTime(lang: Lang, minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h ? t(lang, m ? 'today.inHm' : 'today.inH', { h, m }) : t(lang, 'today.inM', { m })
}

/** Ticks every minute so "now" stays current. */
export function useNow(): { date: string; minutes: number } {
  const [now, setNow] = useState(() => berlinNow())
  useEffect(() => {
    const id = setInterval(() => setNow(berlinNow()), 60_000)
    return () => clearInterval(id)
  }, [])
  return now
}

interface Props {
  lang: Lang
  data: CoursesFile
  state: UserState
}

/** Today's sessions of the weekly timetable in real dates: what is on now, what is next, what was cancelled. */
export function TodayCard({ lang, data, state }: Props) {
  const now = useNow()
  const today = useMemo(() => occurrences(state.selected, data.events, now.date, now.date), [state.selected, data, now.date])
  const soon = useMemo(() => occurrences(state.selected, data.events, addDays(now.date, 1), addDays(now.date, 14)).filter((o) => !o.cancelled).slice(0, 3),
    [state.selected, data, now.date])
  const hasCourses = Object.keys(state.selected).length > 0
  const moduleOf = (o: Occurrence) => state.selected[o.eventId]?.moduleId ?? data.events[o.eventId]?.moduleIds[0] ?? null
  const upcoming = today.find((o) => !o.cancelled && phaseOf(o, now.minutes) === 'next')
  const live = today.find((o) => !o.cancelled && phaseOf(o, now.minutes) === 'live')

  return (
    <section class="card today-card" aria-labelledby="today-title">
      <header class="card-head">
        <div>
          <p class="eyebrow">{t(lang, 'today.eyebrow')}</p>
          <h2 id="today-title">{longDate(lang, now.date)}</h2>
        </div>
        <a class="text-action" href={pageHref({ kind: 'week' })}>{t(lang, 'today.week')}<Icon name="arrow" size={15} /></a>
      </header>

      {!hasCourses ? (
        <div class="today-empty">
          <p>{t(lang, 'today.noCourses')}</p>
          <a class="button" href={pageHref({ kind: 'courses', term: CURRENT_TERM, row: null, filter: null })}><Icon name="plus" size={16} />{t(lang, 'v2.exploreCourses')}</a>
        </div>
      ) : (
        <>
          {live && <p class="today-status is-live"><span class="pulse" aria-hidden="true" />{t(lang, 'today.liveNow', { title: data.events[live.eventId]?.title ?? '' })}</p>}
          {!live && upcoming && <p class="today-status">{t(lang, 'today.nextIn', { time: inTime(lang, toMinutes(upcoming.start) - now.minutes) })}</p>}
          {today.length > 0 ? (
            <ol class="plain today-list">
              {today.map((o) => {
                const ev = data.events[o.eventId]
                const phase = o.cancelled ? 'cancelled' : phaseOf(o, now.minutes)
                const mid = moduleOf(o)
                return (
                  <li key={`${o.eventId}-${o.start}-${o.slotIdx}`} class={`today-item is-${phase} type-${typeClass(ev?.typeCode ?? '')}`}>
                    <span class="today-time"><strong>{o.start}</strong><small>{o.end}</small></span>
                    <span class="today-bar" aria-hidden="true" />
                    <span class="today-what">
                      {mid ? <a href={courseHref(mid)}>{ev?.title ?? o.eventId}</a> : <span>{ev?.title ?? o.eventId}</span>}
                      <span class="today-where"><Icon name="pin" size={13} />{o.room ?? t(lang, 'v2.roomUnknown')}</span>
                    </span>
                    <span class={`today-phase is-${phase}`}>{t(lang, `today.phase.${phase}`)}</span>
                  </li>
                )
              })}
            </ol>
          ) : (
            <p class="today-free">{t(lang, 'today.free')}</p>
          )}
          {soon.length > 0 && (
            <div class="today-soon">
              <h3>{t(lang, 'today.soon')}</h3>
              <ul class="plain">
                {soon.map((o) => {
                  const ev = data.events[o.eventId]
                  const mid = moduleOf(o)
                  return (
                    <li key={`${o.eventId}-${o.date}-${o.start}`} class={`type-${typeClass(ev?.typeCode ?? '')}`}>
                      <span class="soon-when"><strong>{shortDay(lang, o.date)}</strong><span>{o.start}</span></span>
                      <span class="today-bar" aria-hidden="true" />
                      <span class="soon-what">
                        {mid ? <a href={courseHref(mid)}>{ev?.title ?? o.eventId}</a> : <span>{ev?.title ?? o.eventId}</span>}
                        {o.room && <small>{o.room}</small>}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
          {!soon.length && today.every((o) => o.cancelled || phaseOf(o, now.minutes) === 'done') && <p class="today-next muted">{t(lang, 'today.noneSoon')}</p>}
        </>
      )}
    </section>
  )
}
