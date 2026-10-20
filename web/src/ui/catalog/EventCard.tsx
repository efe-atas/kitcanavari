import { t } from '../../i18n'
import { attendanceOf } from '../../logic/attendance'
import { toMinutes } from '../../logic/time'
import type { CoursesFile, Day, Event, Lang, Slot } from '../../types'
import { ectsLabel, eventAreas, eventKind, eventMinors, fmtSlot, typeClass } from '../format'
import { Icon } from '../Icon'

interface Props {
  lang: Lang
  data: CoursesFile
  ev: Event
  inSchedule: boolean
  conflict: boolean
  /** The user's chosen areas of specialization. */
  myAreas: string[]
  onOpen: () => void
  onToggle: () => void
}

const STRIP_DAYS: Day[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const STRIP_FROM = 8 * 60
const STRIP_SPAN = 12 * 60

/** Mon–Fri at a glance: one track per day spanning 8:00–20:00, filled where the course meets. */
function WeekStrip({ lang, slots }: { lang: Lang; slots: Slot[] }) {
  const pct = (m: number) => `${Math.min(100, Math.max(0, ((m - STRIP_FROM) / STRIP_SPAN) * 100))}%`
  return (
    <span class="strip" aria-hidden="true">
      {STRIP_DAYS.map((d) => {
        const hits = slots.filter((s) => s.day === d && s.start && s.end)
        return (
          <span key={d} class={`strip-day${hits.length ? ' is-on' : ''}`}>
            <span class="strip-label">{t(lang, `day.${d}`)}</span>
            <span class="strip-track">
              {hits.map((s, i) => (
                <span key={i} class="strip-bar"
                  style={{ left: pct(toMinutes(s.start!)), right: `calc(100% - ${pct(toMinutes(s.end!))})` }} />
              ))}
            </span>
          </span>
        )
      })}
    </span>
  )
}

export function EventCard({ lang, data, ev, inSchedule, conflict, myAreas, onOpen, onToggle }: Props) {
  const ects = ectsLabel(data, ev)
  const weekly = ev.slots.filter((s) => s.day && s.rhythm !== 'single')
  const kind = eventKind(data, ev)
  const mine = eventAreas(data, ev).filter((a) => myAreas.includes(a))
  const att = attendanceOf(data, ev).level
  const minors = eventMinors(data, ev)
  const irregular = ev.moduleIds.some((id) => /irregular/i.test(data.modules[id]?.recurrence ?? ''))
  return (
    <li class={`card type-${typeClass(ev.typeCode)}${inSchedule ? ' is-selected' : ''}${conflict ? ' has-conflict' : ''}`}>
      <button type="button" class="card-main" onClick={onOpen}>
        <span class="card-head">
          <span class="type-badge">{ev.typeCode || '?'}</span>
          <span class="card-number">{ev.number}</span>
          {conflict && (
            <span class="conflict-mark" title={t(lang, 'event.conflict')} aria-label={t(lang, 'event.conflict')}>
              <Icon name="alert" size={16} />
            </span>
          )}
        </span>
        <span class="card-title">{ev.title}</span>
        {(kind && kind !== 'lecture') || mine.length || minors.length || irregular || att !== 'unknown' ? (
          <span class="card-tags">
            {kind && kind !== 'lecture' && <span class={`tag tag-${kind}`}>{t(lang, `kind.${kind}`)}</span>}
            {minors.map((m) => <span key={m} class="tag tag-minor">{t(lang, 'bucket.minor')}: {m}</span>)}
            {mine.map((a) => <span key={a} class="tag tag-area"><Icon name="check" size={12} />{a}</span>)}
            {att === 'required' && <span class="tag tag-required">{t(lang, 'att.tagRequired')}</span>}
            {att === 'kickoff' && <span class="tag tag-kickoff">{t(lang, 'att.tagKickoff')}</span>}
            {irregular && <span class="tag tag-quiet">{t(lang, 'rec.irregular')}</span>}
          </span>
        ) : null}
        <span class="card-meta">
          {ev.language && (ev.language === 'English' ? <span>{ev.language}</span>
            : <span class="lang-mixed" title={t(lang, 'event.mixedLang')}>{ev.language}</span>)}
          {ev.sws ? <span>{ev.sws} SWS</span> : null}
          {ects && <span class="card-ects">{ects}</span>}
        </span>
        {weekly.length > 0 && <WeekStrip lang={lang} slots={weekly} />}
        <span class="card-slots">
          {weekly.length ? weekly.map((s, i) => <span key={i}>{fmtSlot(lang, s)}</span>) : <span class="muted">{t(lang, 'event.noSlots')}</span>}
        </span>
      </button>
      <div class="card-actions">
        {inSchedule && <span class="in-schedule"><Icon name="check" size={14} />{t(lang, 'event.inSchedule')}</span>}
        <button type="button" class={inSchedule ? 'button-quiet' : 'button'} onClick={onToggle}>
          {!inSchedule && <Icon name="plus" size={16} />}
          {t(lang, inSchedule ? 'event.remove' : 'event.add')}
        </button>
      </div>
    </li>
  )
}
