import { useState } from 'preact/hooks'
import { t } from '../../i18n'
import type { Alert } from '../../logic/alerts'
import { acknowledge } from '../../store'
import type { ChangeKind, ChangesFile, CoursesFile, Lang, UserState } from '../../types'
import { fmtDate } from '../format'
import { Icon } from '../Icon'
import { courseHref } from '../route'

interface Props {
  data: CoursesFile
  changes: ChangesFile
  state: UserState
  alerts: Alert[]
  update: (fn: (s: UserState) => UserState) => void
}

/** Kinds that change when and where a course meets: the ones that matter for the timetable. */
const SCHEDULE: ChangeKind[] = ['slot_changed', 'room_changed', 'session_cancelled', 'session_added', 'session_removed']
const TONE: Partial<Record<ChangeKind, string>> = {
  session_cancelled: 'danger', removed: 'danger', slot_changed: 'warn', room_changed: 'warn', session_removed: 'warn', added: 'ok', session_added: 'ok',
}

function KindTag({ lang, kind }: { lang: Lang; kind: ChangeKind }) {
  return <span class={`tag tag-${TONE[kind] ?? 'neutral'} feed-kind`}>{t(lang, `change.${kind}`)}</span>
}

export function ChangesView({ data, changes, state, alerts, update }: Props) {
  const { lang } = state
  const [onlyMine, setOnlyMine] = useState(false)
  const [onlySchedule, setOnlySchedule] = useState(false)
  const seen = (ids: string[]) => update((s) => acknowledge(s, ids, data))
  const feed = changes.entries.filter((c) => (!onlyMine || state.selected[c.eventId]) && (!onlySchedule || SCHEDULE.includes(c.kind)))
  const days = [...new Set(feed.slice(0, 500).map((c) => c.at.slice(0, 10)))]
  const moduleOf = (eventId: string) => state.selected[eventId]?.moduleId ?? data.events[eventId]?.moduleIds[0] ?? null

  return (
    <div class="changes">
      <section aria-labelledby="changes-mine">
        <h3 id="changes-mine">{t(lang, 'changes.mine')}</h3>
        {alerts.length === 0 ? <p class="changes-calm"><Icon name="check" size={16} />{t(lang, 'changes.none')}</p> : (
          <>
            {alerts.length > 1 && (
              <div class="changes-actions">
                <button type="button" class="button-quiet" onClick={() => seen(alerts.map((a) => a.eventId))}>
                  <Icon name="check" size={16} />{t(lang, 'changes.seenAll')}
                </button>
              </div>
            )}
            <ul class="alert-list">
              {alerts.map((a) => {
                const mid = moduleOf(a.eventId)
                return (
                  <li key={a.eventId} class="alert">
                    <div class="alert-head">
                      {mid ? <a class="alert-title" href={courseHref(mid)}>{a.title}</a> : <strong>{a.title}</strong>}
                      <button type="button" class="button-quiet is-small" onClick={() => seen([a.eventId])}>{t(lang, 'changes.seen')}</button>
                    </div>
                    {a.removed && <p class="note note-warn"><Icon name="alert" size={14} />{t(lang, 'changes.removed')}</p>}
                    {a.changes.length > 0 && (
                      <ul class="alert-changes">
                        {a.changes.map((c, i) => <li key={i}><KindTag lang={lang} kind={c.kind} /><span>{c.summary}</span></li>)}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </section>

      <section aria-labelledby="changes-feed">
        <h3 id="changes-feed">{t(lang, 'changes.feed')}</h3>
        <div class="feed-filter" role="group" aria-label={t(lang, 'changes.filter')}>
          <button type="button" class="chip" aria-pressed={!onlyMine} onClick={() => setOnlyMine(false)}>{t(lang, 'changes.all')}</button>
          <button type="button" class="chip" aria-pressed={onlyMine} onClick={() => setOnlyMine(true)}>{t(lang, 'changes.onlyMine')}</button>
          <label class="switch feed-switch"><input type="checkbox" checked={onlySchedule} onChange={(e) => setOnlySchedule((e.target as HTMLInputElement).checked)} />{t(lang, 'changes.onlySchedule')}</label>
        </div>
        {feed.length === 0 ? <p class="muted">{t(lang, 'changes.feedEmpty')}</p> : days.map((day) => (
          <div key={day} class="feed-day">
            <h4><time dateTime={day}>{fmtDate(lang, day)}</time></h4>
            <ul class="feed">
              {feed.filter((c) => c.at.startsWith(day)).map((c, i) => {
                const mid = moduleOf(c.eventId)
                return (
                  <li key={i}>
                    <KindTag lang={lang} kind={c.kind} />
                    <span class="feed-body">
                      {mid ? <a href={courseHref(mid)}>{c.eventTitle}</a> : <strong>{c.eventTitle}</strong>}
                      <span class="feed-summary">{c.summary}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </section>
    </div>
  )
}
