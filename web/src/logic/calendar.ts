// Real dates of the weekly timetable: which sessions fall on which day, today in Karlsruhe, and clashes per date.
// The catalog lists dated sessions for most courses; a course with weekly slots only repeats them inside its term.
import type { Day, Event, SelectedEntry } from '../types'
import { FORTNIGHTLY } from './ics'
import { CURRENT_TERM } from './terms'
import { toMinutes, weekdayOf } from './time'

export interface Occurrence {
  eventId: string
  /** Index into Event.slots of the series this date belongs to; null for a date outside any series. */
  slotIdx: number | null
  date: string
  start: string
  end: string
  room: string | null
  cancelled: boolean
  /** True when the catalog lists this date; false when it is repeated from a weekly slot. */
  dated: boolean
}

const pad = (n: number) => String(n).padStart(2, '0')
const utc = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}
export const isoOf = (ms: number): string => {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}
export const addDays = (iso: string, n: number): string => isoOf(utc(iso) + n * 86400_000)
export const daysBetween = (from: string, to: string): number => Math.round((utc(to) - utc(from)) / 86400_000)
/** Monday of the week a date is in. */
export const mondayOf = (iso: string): string => addDays(iso, -((new Date(utc(iso)).getUTCDay() + 6) % 7))
export const weekDates = (monday: string, n = 7): string[] => Array.from({ length: n }, (_, i) => addDays(monday, i))

/** The date and minute of the day in Karlsruhe (the catalog's times are local times there). */
export function berlinNow(now: Date = new Date()): { date: string; minutes: number; day: Day } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  const date = `${get('year')}-${get('month')}-${get('day')}`
  return { date, minutes: Number(get('hour')) * 60 + Number(get('minute')), day: weekdayOf(date) }
}

/** The semester a term id stands for: WS = October to March, SS = April to September. */
export function semesterBounds(term: string = CURRENT_TERM): { from: string; to: string } | null {
  const m = /^(WS|SS)(\d{2})$/.exec(term)
  if (!m) return null
  const y = 2000 + Number(m[2])
  return m[1] === 'WS' ? { from: `${y}-10-01`, to: `${y + 1}-03-31` } : { from: `${y}-04-01`, to: `${y}-09-30` }
}

/** First and last dated session of the catalog, for choosing a sensible week. */
export function sessionRange(events: Record<string, Event>): { from: string; to: string } | null {
  let from: string | null = null
  let to: string | null = null
  for (const ev of Object.values(events)) {
    for (const s of ev.sessions) {
      if (!from || s.date < from) from = s.date
      if (!to || s.date > to) to = s.date
    }
  }
  return from && to ? { from, to } : null
}

/** Which slot a session belongs to: its index when the data has one, else the weekly slot on that weekday and time. */
function ownerOf(ev: Event, date: string, start: string, slot: number | null | undefined): number {
  if (typeof slot === 'number') return slot
  return ev.slots.findIndex((sl) => sl.day === weekdayOf(date) && sl.start === start && sl.rhythm !== 'single')
}

/** Sessions of the selected courses from `from` to `to` (inclusive), cancelled ones included and marked. */
export function occurrences(selected: Record<string, SelectedEntry>, events: Record<string, Event>, from: string, to: string,
  term: string = CURRENT_TERM): Occurrence[] {
  const out: Occurrence[] = []
  const bounds = semesterBounds(term)
  for (const [id, entry] of Object.entries(selected)) {
    const ev = events[id]
    if (!ev) continue
    if (ev.sessions.length) {
      for (const s of ev.sessions) {
        if (s.date < from || s.date > to) continue
        const owner = ownerOf(ev, s.date, s.start, s.slot)
        if (owner >= 0 && !entry.enabledSlots.includes(owner)) continue
        out.push({ eventId: id, slotIdx: owner >= 0 ? owner : null, date: s.date, start: s.start, end: s.end, room: s.room, cancelled: s.cancelled, dated: true })
      }
      continue
    }
    ev.slots.forEach((sl, i) => {
      if (!entry.enabledSlots.includes(i) || !sl.start || !sl.end) return
      const base = { eventId: id, slotIdx: i, start: sl.start, end: sl.end, room: sl.room, cancelled: false, dated: false }
      if (sl.rhythm === 'single') {
        if (sl.firstDate && sl.firstDate >= from && sl.firstDate <= to) out.push({ ...base, date: sl.firstDate })
        return
      }
      if (!sl.day) return
      const step = FORTNIGHTLY.test(sl.rhythm) ? 2 : 1
      for (let d = from; d <= to; d = addDays(d, 1)) {
        if (weekdayOf(d) !== sl.day) continue
        if (bounds && (d < bounds.from || d > bounds.to)) continue
        if (sl.firstDate) {
          const weeks = daysBetween(sl.firstDate, d) / 7
          if (weeks < 0 || weeks % step || (sl.count && weeks / step >= sl.count)) continue
        }
        out.push({ ...base, date: d })
      }
    })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || toMinutes(a.start) - toMinutes(b.start) || a.eventId.localeCompare(b.eventId))
}

export interface Clash {
  a: Occurrence
  b: Occurrence
  start: string
  end: string
}

/** Pairs of sessions of different courses that overlap on the same date (cancelled ones never clash). */
export function clashes(occ: Occurrence[]): Clash[] {
  const live = occ.filter((o) => !o.cancelled)
  const out: Clash[] = []
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const [a, b] = [live[i], live[j]]
      if (a.date !== b.date || a.eventId === b.eventId) continue
      const start = Math.max(toMinutes(a.start), toMinutes(b.start))
      const end = Math.min(toMinutes(a.end), toMinutes(b.end))
      if (start < end) out.push({ a, b, start: a.start > b.start ? a.start : b.start, end: a.end < b.end ? a.end : b.end })
    }
  }
  return out
}

export const occKey = (o: Pick<Occurrence, 'eventId' | 'date' | 'start' | 'slotIdx'>) => `${o.eventId}|${o.date}|${o.start}|${o.slotIdx}`

/** The week to open the calendar on: this week, kept inside the weeks the catalog has dates for. */
export function defaultWeek(events: Record<string, Event>, today: string, term: string = CURRENT_TERM): string {
  const range = sessionRange(events) ?? semesterBounds(term)
  const week = mondayOf(today)
  if (!range) return week
  if (today < range.from) return mondayOf(range.from)
  if (today > range.to) return mondayOf(range.to)
  return week
}

export type Phase = 'done' | 'live' | 'next'

/** Where a session of today stands at minute `now`. */
export const phaseOf = (o: Pick<Occurrence, 'start' | 'end'>, now: number): Phase =>
  toMinutes(o.end) <= now ? 'done' : toMinutes(o.start) <= now ? 'live' : 'next'
