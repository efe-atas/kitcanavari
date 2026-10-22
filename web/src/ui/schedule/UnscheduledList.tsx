import { t } from '../../i18n'
import type { CoursesFile, Lang, UserState } from '../../types'
import { fmtSlot } from '../format'

/** Selected events without any enabled regular weekly slot (block seminars, one-off dates, no times). */
export function unscheduledIds(data: CoursesFile, state: UserState): string[] {
  return Object.entries(state.selected)
    .filter(([id, entry]) => {
      const ev = data.events[id]
      return ev && !ev.slots.some((s, i) => entry.enabledSlots.includes(i) && s.day && s.start && s.rhythm !== 'single')
    })
    .map(([id]) => id)
}

export function UnscheduledList({ lang, data, state, onOpen }: { lang: Lang; data: CoursesFile; state: UserState; onOpen: (id: string) => void }) {
  const ids = unscheduledIds(data, state)
  if (!ids.length) return null
  return (
    <section class="panel">
      <h3>{t(lang, 'schedule.unscheduled')}</h3>
      <ul class="plain">
        {ids.map((id) => {
          const ev = data.events[id]
          const when = ev.slots.map((s) => fmtSlot(lang, s)).join('; ')
          return (
            <li key={id}>
              <button type="button" class="link-button" onClick={() => onOpen(id)}>{ev.title}</button>
              {when && <span class="muted">, {when}</span>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
