import type { Event, SelectedEntry } from '../types'
import { activeSessions } from './time'

/** The catalog says 'fortnightly'; older data and tests say 'biweekly'. */
export const FORTNIGHTLY = /^(biweekly|fortnightly)$/i

const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\n/g, '\\n')
const stamp = (date: string, time: string) => `${date.replace(/-/g, '')}T${time.replace(':', '')}00`

/** RFC 5545 line folding: at most 75 octets per line, continuation lines start with a space. */
function fold(line: string): string[] {
  const enc = new TextEncoder()
  const out: string[] = []
  let cur = ''
  for (const ch of line) {
    const limit = out.length === 0 ? 75 : 74
    if (enc.encode(cur + ch).length > limit) {
      out.push(cur)
      cur = ''
    }
    cur += ch
  }
  out.push(cur)
  return out.map((l, i) => (i === 0 ? l : ' ' + l))
}

// RFC 5545 needs the zone definition next to TZID references (Outlook and others rely on it).
const BERLIN = [
  'BEGIN:VTIMEZONE', 'TZID:Europe/Berlin',
  'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST',
  'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
  'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET',
  'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
  'END:VTIMEZONE',
]

export function buildIcs(selected: Record<string, SelectedEntry>, events: Record<string, Event>, scrapedAt: string): string {
  const dtstamp = scrapedAt.replace(/[-:]/g, '').replace(/\.\d+/, '')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//kitcanavari//schedule//EN', 'CALSCALE:GREGORIAN', ...BERLIN]
  for (const [id, entry] of Object.entries(selected)) {
    const ev = events[id]
    if (!ev) continue
    if (!ev.sessions.length) {
      // No individual dates published: fall back to the weekly series.
      ev.slots.forEach((s, i) => {
        if (!entry.enabledSlots.includes(i) || !s.day || !s.start || !s.end || !s.firstDate || s.rhythm === 'single') return
        const rule = ['FREQ=WEEKLY', ...(FORTNIGHTLY.test(s.rhythm) ? ['INTERVAL=2'] : []), ...(s.count ? [`COUNT=${s.count}`] : [])]
        lines.push(
          'BEGIN:VEVENT',
          `UID:${id}-slot${i}@kitcanavari`,
          `DTSTAMP:${dtstamp}`,
          `DTSTART;TZID=Europe/Berlin:${stamp(s.firstDate, s.start)}`,
          `DTEND;TZID=Europe/Berlin:${stamp(s.firstDate, s.end)}`,
          `RRULE:${rule.join(';')}`,
          `SUMMARY:${escape(`${ev.number} ${ev.title}`)}`,
          ...(s.room ? [`LOCATION:${escape(s.room)}`] : []),
          `URL:${ev.kitUrl}`,
          'END:VEVENT',
        )
      })
      continue
    }
    for (const s of activeSessions(ev, entry.enabledSlots)) {
      lines.push(
        'BEGIN:VEVENT',
        `UID:${id}-${s.date}-${s.start}@kitcanavari`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART;TZID=Europe/Berlin:${stamp(s.date, s.start)}`,
        `DTEND;TZID=Europe/Berlin:${stamp(s.date, s.end)}`,
        `SUMMARY:${escape(`${ev.number} ${ev.title}`)}`,
        ...(s.room ? [`LOCATION:${escape(s.room)}`] : []),
        `URL:${ev.kitUrl}`,
        'END:VEVENT',
      )
    }
  }
  lines.push('END:VCALENDAR')
  return lines.flatMap(fold).join('\r\n') + '\r\n'
}
