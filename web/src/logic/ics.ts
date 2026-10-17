import type { Event, SelectedEntry } from '../types'
import { activeSessions } from './time'

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

export function buildIcs(selected: Record<string, SelectedEntry>, events: Record<string, Event>, scrapedAt: string): string {
  const dtstamp = scrapedAt.replace(/[-:]/g, '').replace(/\.\d+/, '')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//kitcanavari//schedule//EN', 'CALSCALE:GREGORIAN']
  for (const [id, entry] of Object.entries(selected)) {
    const ev = events[id]
    if (!ev) continue
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
