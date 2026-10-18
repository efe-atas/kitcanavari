import type { Day, Event, Session } from '../types'

const DAYS: Day[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function weekdayOf(isoDate: string): Day {
  const [y, m, d] = isoDate.split('-').map(Number)
  return DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
}

/** Non-cancelled sessions of the enabled slots, plus sessions that belong to no slot (one-off dates). */
export function activeSessions(ev: Event, enabled: number[]): Session[] {
  return ev.sessions.filter((s) => {
    if (s.cancelled) return false
    if (typeof s.slot === 'number') return enabled.includes(s.slot)
    // Data without slot indices: match by weekday + start time.
    const owner = ev.slots.findIndex((sl) => sl.day === weekdayOf(s.date) && sl.start === s.start && sl.rhythm !== 'single')
    return owner === -1 || enabled.includes(owner)
  })
}
