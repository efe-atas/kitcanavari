import { t } from '../../i18n'
import type { CoursesFile, Event, Lang } from '../../types'
import { ectsLabel, fmtSlot, typeClass } from '../format'

interface Props {
  lang: Lang
  data: CoursesFile
  ev: Event
  inSchedule: boolean
  conflict: boolean
  onOpen: () => void
  onToggle: () => void
}

export function EventCard({ lang, data, ev, inSchedule, conflict, onOpen, onToggle }: Props) {
  const ects = ectsLabel(data, ev)
  const weekly = ev.slots.filter((s) => s.day && s.rhythm !== 'single')
  return (
    <li class={`card type-${typeClass(ev.typeCode)}${inSchedule ? ' is-selected' : ''}`}>
      <button type="button" class="card-main" onClick={onOpen}>
        <span class="card-head">
          <span class="type-badge">{ev.typeCode || '?'}</span>
          <span class="card-number">{ev.number}</span>
          {conflict && <span class="conflict-mark" title={t(lang, 'event.conflict')} aria-label={t(lang, 'event.conflict')}>⚠</span>}
        </span>
        <span class="card-title">{ev.title}</span>
        <span class="card-meta">
          {[ev.language, ev.sws ? `${ev.sws} SWS` : null, ects].filter(Boolean).map((m) => <span key={m!}>{m}</span>)}
        </span>
        <span class="card-slots">
          {weekly.length ? weekly.map((s, i) => <span key={i}>{fmtSlot(lang, s)}</span>) : <span class="muted">{t(lang, 'event.noSlots')}</span>}
        </span>
      </button>
      <div class="card-actions">
        {inSchedule && <span class="in-schedule">{t(lang, 'event.inSchedule')}</span>}
        <button type="button" class={inSchedule ? 'button-quiet' : 'button'} onClick={onToggle}>
          {t(lang, inSchedule ? 'event.remove' : 'event.add')}
        </button>
      </div>
    </li>
  )
}
