import type { Event, SelectedEntry } from '../types'
import { activeSessions, toMinutes, weekdayOf } from './time'

export interface Conflict {
  a: string
  b: string
  day: string
  start: string
  end: string
  date?: string
}

interface Interval {
  day: string
  start: string
  end: string
  date?: string
}

const overlap = (x: Interval, y: Interval): Interval | null => {
  const start = toMinutes(x.start) > toMinutes(y.start) ? x.start : y.start
  const end = toMinutes(x.end) < toMinutes(y.end) ? x.end : y.end
  return toMinutes(start) < toMinutes(end) ? { day: x.day, start, end, date: x.date } : null
}

function intervals(ev: Event, entry: SelectedEntry, useSessions: boolean): Interval[] {
  if (useSessions) {
    return activeSessions(ev, entry.enabledSlots)
      .map((s) => ({ day: weekdayOf(s.date), start: s.start, end: s.end, date: s.date }))
      .sort((x, y) => (x.date! < y.date! ? -1 : 1))
  }
  return ev.slots
    .filter((s, i) => entry.enabledSlots.includes(i) && s.day && s.start && s.end && s.rhythm !== 'single')
    .map((s) => ({ day: s.day!, start: s.start!, end: s.end! }))
}

export function findConflicts(selected: Record<string, SelectedEntry>, events: Record<string, Event>): Conflict[] {
  const ids = Object.keys(selected).filter((id) => events[id]).sort()
  const out: Conflict[] = []
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const [a, b] = [events[ids[i]], events[ids[j]]]
      const useSessions = a.sessions.length > 0 && b.sessions.length > 0
      const xs = intervals(a, selected[a.id], useSessions)
      const ys = intervals(b, selected[b.id], useSessions)
      const seen = new Set<string>()
      for (const x of xs) {
        for (const y of ys) {
          if (x.day !== y.day || x.date !== y.date) continue
          const o = overlap(x, y)
          if (!o) continue
          const key = `${o.day}|${o.start}|${o.end}`
          if (seen.has(key)) continue
          seen.add(key)
          out.push({ a: a.id, b: b.id, day: o.day, start: o.start, end: o.end, ...(o.date ? { date: o.date } : {}) })
        }
      }
    }
  }
  return out
}

/**
 * Would adding these courses (a module's events this term) clash with the weekly timetable? Clashes among the courses
 * themselves (a lecture and its alternative exercise groups) do not count: they are the module's own choice.
 */
export function addConflicts(selected: Record<string, SelectedEntry>, events: Record<string, Event>, moduleId: string,
  eventIds: string[]): Conflict[] {
  const fresh = eventIds.filter((id) => events[id] && !selected[id])
  if (!fresh.length) return []
  const trial = { ...selected }
  for (const id of fresh) trial[id] = { enabledSlots: events[id].slots.map((_, i) => i), moduleId, ackFingerprint: '' }
  const mine = new Set(eventIds)
  return findConflicts(trial, events).filter((c) => mine.has(c.a) !== mine.has(c.b) && (fresh.includes(c.a) || fresh.includes(c.b)))
}
