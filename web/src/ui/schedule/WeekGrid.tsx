import { t } from '../../i18n'
import type { Conflict } from '../../logic/conflicts'
import { toMinutes } from '../../logic/time'
import type { CoursesFile, Day, Event, Lang, UserState } from '../../types'
import { typeClass } from '../format'

const START_H = 8
const END_H = 20
const WEEKDAYS: Day[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

export interface Block {
  eventId: string
  slotIdx: number
  day: Day
  start: string
  end: string
  room: string | null
}

export function weeklyBlocks(data: CoursesFile, state: UserState): Block[] {
  const out: Block[] = []
  for (const [id, entry] of Object.entries(state.selected)) {
    const ev = data.events[id]
    if (!ev) continue
    ev.slots.forEach((s, i) => {
      if (entry.enabledSlots.includes(i) && s.day && s.start && s.end && s.rhythm !== 'single') {
        out.push({ eventId: id, slotIdx: i, day: s.day, start: s.start, end: s.end, room: s.room })
      }
    })
  }
  return out
}

/** True when conflict `c` actually hits this weekly block (a clash on a one-off date does not). */
export function blockHasConflict(b: Block, c: Conflict, ev: Event): boolean {
  const hits = (c.a === b.eventId || c.b === b.eventId) && c.day === b.day
    && toMinutes(c.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(c.end)
  if (!hits || !c.date) return hits
  return ev.sessions.some((s) => s.date === c.date && !s.cancelled
    && (typeof s.slot === 'number' ? s.slot === b.slotIdx : s.start === b.start))
}

interface Props {
  lang: Lang
  data: CoursesFile
  state: UserState
  conflicts: Conflict[]
  onOpen: (id: string) => void
}

export function WeekGrid({ lang, data, state, conflicts, onOpen }: Props) {
  const blocks = weeklyBlocks(data, state)
  const days = [...WEEKDAYS, ...(['Sat', 'Sun'] as Day[]).filter((d) => blocks.some((b) => b.day === d))]
  const startMin = Math.min(START_H * 60, ...blocks.map((b) => Math.floor(toMinutes(b.start) / 60) * 60))
  const endMin = Math.max(END_H * 60, ...blocks.map((b) => Math.ceil(toMinutes(b.end) / 60) * 60))
  const hours = Array.from({ length: (endMin - startMin) / 60 + 1 }, (_, i) => startMin / 60 + i)
  const pos = (m: number) => `calc(var(--hour) * ${(m - startMin) / 60})`
  const height = `calc(var(--hour) * ${(endMin - startMin) / 60})`

  return (
    <div class="week" style={{ '--days': days.length }}>
      <div class="week-head" style={{ gridColumn: 1 }} />
      {days.map((d, i) => <div key={d} class="week-head" style={{ gridColumn: i + 2 }}>{t(lang, `day.${d}`)}</div>)}
      <div class="week-hours" style={{ height }}>
        {hours.map((h) => <span key={h} class="week-hour" style={{ top: pos(h * 60) }}>{`${h}:00`}</span>)}
      </div>
      {days.map((d, i) => (
        <div key={d} class="week-day" style={{ gridColumn: i + 2, height }}>
          {blocks.filter((b) => b.day === d).map((b) => {
            const ev = data.events[b.eventId]
            const bad = conflicts.some((c) => blockHasConflict(b, c, ev))
            return (
              <button
                key={`${b.eventId}-${b.slotIdx}`}
                type="button"
                class={`block type-${typeClass(ev.typeCode)}${bad ? ' is-conflict' : ''}`}
                style={{ top: pos(toMinutes(b.start)), height: `calc(var(--hour) * ${(toMinutes(b.end) - toMinutes(b.start)) / 60})` }}
                title={`${ev.number} ${ev.title} · ${b.start}–${b.end}${b.room ? ` · ${b.room}` : ''}`}
                onClick={() => onOpen(b.eventId)}
              >
                <strong>{ev.title}</strong>
                {b.start}–{b.end}{b.room ? ` · ${b.room}` : ''}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
