import { locale } from '../../locale'
import { t } from '../../i18n'
import { occKey, type Occurrence } from '../../logic/calendar'
import { toMinutes } from '../../logic/time'
import type { CoursesFile, Day, Lang } from '../../types'
import { typeClass } from '../format'
import { longDate } from '../overview/TodayCard'

const START_H = 8
const END_H = 19
const DAY_KEYS: Day[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface Props {
  lang: Lang
  data: CoursesFile
  /** The dates of the week shown, Monday first. */
  dates: string[]
  occ: Occurrence[]
  /** Keys (occKey) of sessions that clash with another one. */
  clashing: Set<string>
  today: { date: string; minutes: number }
  onOpen: (eventId: string) => void
}

const dayNum = (lang: Lang, iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(locale(lang), { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

/**
 * Side-by-side columns for sessions that overlap on one day: each gets the first free column of its cluster, and
 * every session in a cluster shares the cluster's column count.
 */
export function layoutDay(items: Occurrence[]): Map<string, { col: number; cols: number }> {
  const out = new Map<string, { col: number; cols: number }>()
  const sorted = [...items].sort((a, b) => toMinutes(a.start) - toMinutes(b.start) || toMinutes(b.end) - toMinutes(a.end))
  let cluster: { key: string; col: number }[] = []
  let ends: number[] = []
  let clusterEnd = -1
  const flush = () => {
    for (const c of cluster) out.set(c.key, { col: c.col, cols: ends.length })
    cluster = []
    ends = []
  }
  for (const o of sorted) {
    const start = toMinutes(o.start)
    if (start >= clusterEnd) flush()
    let col = ends.findIndex((end) => end <= start)
    if (col < 0) { col = ends.length; ends.push(0) }
    ends[col] = toMinutes(o.end)
    clusterEnd = Math.max(start >= clusterEnd ? 0 : clusterEnd, toMinutes(o.end))
    cluster.push({ key: occKey(o), col })
  }
  flush()
  return out
}

/** Dates of the week with a session, plus Monday to Friday. */
export const shownDates = (dates: string[], occ: Occurrence[]) => dates.filter((d, i) => i < 5 || occ.some((o) => o.date === d))

/** The week as a time grid with real dates: today and the current time marked, cancelled sessions struck through. */
export function CalendarGrid({ lang, data, dates, occ, clashing, today, onOpen }: Props) {
  const days = shownDates(dates, occ)
  const startMin = Math.min(START_H * 60, ...occ.map((o) => Math.floor(toMinutes(o.start) / 60) * 60))
  const endMin = Math.max(END_H * 60, ...occ.map((o) => Math.ceil(toMinutes(o.end) / 60) * 60))
  const hours = Array.from({ length: (endMin - startMin) / 60 + 1 }, (_, i) => startMin / 60 + i)
  const pos = (m: number) => `calc(var(--hour) * ${(m - startMin) / 60})`
  const height = `calc(var(--hour) * ${(endMin - startMin) / 60})`
  const showNow = days.includes(today.date) && today.minutes >= startMin && today.minutes <= endMin

  return (
    <div class="cal" style={{ '--days': days.length }}>
      <div class="cal-corner" />
      {days.map((d, i) => (
        <div key={d} class={`cal-head${d === today.date ? ' is-today' : ''}`} style={{ gridColumn: i + 2 }}>
          <span>{t(lang, `day.${DAY_KEYS[dates.indexOf(d)]}`)}</span><strong>{dayNum(lang, d)}</strong>
        </div>
      ))}
      <div class="cal-hours" style={{ height }}>
        {hours.map((h) => <span key={h} class="cal-hour" style={{ top: pos(h * 60) }}>{`${String(h).padStart(2, '0')}:00`}</span>)}
      </div>
      {days.map((d, i) => (
        <div key={d} class={`cal-day${d === today.date ? ' is-today' : ''}`} style={{ gridColumn: i + 2, height }}>
          {(() => {
            const items = occ.filter((o) => o.date === d)
            const lanes = layoutDay(items)
            return items.map((o) => {
            const ev = data.events[o.eventId]
            const bad = clashing.has(occKey(o))
            const dur = toMinutes(o.end) - toMinutes(o.start)
            const { col, cols } = lanes.get(occKey(o)) ?? { col: 0, cols: 1 }
            return (
              <button key={occKey(o)} type="button"
                class={`cal-block type-${typeClass(ev?.typeCode ?? '')}${bad ? ' is-conflict' : ''}${o.cancelled ? ' is-cancelled' : ''}${dur < 60 ? ' is-short' : ''}${cols > 1 ? ' is-split' : ''}`}
                style={{
                  top: pos(toMinutes(o.start)), height: `calc(var(--hour) * ${dur / 60})`,
                  left: `calc(4px + (100% - 8px) * ${col / cols})`, width: `calc((100% - 8px) / ${cols} - ${cols > 1 ? 2 : 0}px)`,
                }}
                aria-label={`${ev?.title ?? o.eventId}, ${longDate(lang, o.date)} ${o.start}–${o.end}${o.room ? `, ${o.room}` : ''}${o.cancelled ? `, ${t(lang, 'today.phase.cancelled')}` : ''}${bad ? `, ${t(lang, 'event.conflict')}` : ''}`}
                onClick={() => onOpen(o.eventId)}>
                <strong>{ev?.title ?? o.eventId}</strong>
                <span class="cal-time">{o.start}–{o.end}</span>
                {o.room && <span class="cal-room">{o.room}</span>}
                {o.cancelled && <span class="cal-flag">{t(lang, 'today.phase.cancelled')}</span>}
              </button>
            )
            })
          })()}
          {showNow && d === today.date && <span class="cal-now" style={{ top: pos(today.minutes) }} aria-hidden="true" />}
        </div>
      ))}
    </div>
  )
}

/** The same week as a list, day by day: easier to read on a phone. */
export function CalendarAgenda({ lang, data, dates, occ, clashing, today, onOpen }: Props) {
  const days = dates.filter((d) => occ.some((o) => o.date === d))
  if (!days.length) return <p class="cal-empty">{t(lang, 'wk.emptyWeek')}</p>
  return (
    <div class="agenda">
      {days.map((d) => (
        <section key={d} class={`agenda-day${d === today.date ? ' is-today' : ''}`} aria-labelledby={`agenda-${d}`}>
          <h2 id={`agenda-${d}`}>{longDate(lang, d)}{d === today.date && <span class="now-badge">{t(lang, 'wk.today')}</span>}</h2>
          <ul class="plain">
            {occ.filter((o) => o.date === d).map((o) => {
              const ev = data.events[o.eventId]
              const bad = clashing.has(occKey(o))
              return (
                <li key={occKey(o)}>
                  <button type="button" class={`agenda-event type-${typeClass(ev?.typeCode ?? '')}${bad ? ' is-conflict' : ''}${o.cancelled ? ' is-cancelled' : ''}`} onClick={() => onOpen(o.eventId)}>
                    <span class="agenda-time">{o.start}<small>{o.end}</small></span>
                    <span class="agenda-bar" aria-hidden="true" />
                    <span class="agenda-description">
                      <strong>{ev?.title ?? o.eventId}</strong>
                      <span>{o.room ?? t(lang, 'v2.roomUnknown')}</span>
                      {o.cancelled && <span class="agenda-flag is-cancelled">{t(lang, 'today.phase.cancelled')}</span>}
                      {bad && <span class="agenda-flag is-conflict">{t(lang, 'event.conflict')}</span>}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
