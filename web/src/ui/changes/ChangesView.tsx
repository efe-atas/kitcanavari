import { useState } from 'preact/hooks'
import { t } from '../../i18n'
import type { Alert } from '../../logic/alerts'
import { acknowledge } from '../../store'
import type { ChangesFile, CoursesFile, UserState } from '../../types'
import { fmtDate } from '../format'

interface Props {
  data: CoursesFile
  changes: ChangesFile
  state: UserState
  alerts: Alert[]
  update: (fn: (s: UserState) => UserState) => void
}

export function ChangesView({ data, changes, state, alerts, update }: Props) {
  const { lang } = state
  const [onlyMine, setOnlyMine] = useState(false)
  const seen = (ids: string[]) => update((s) => acknowledge(s, ids, data))
  const feed = changes.entries.filter((c) => !onlyMine || state.selected[c.eventId])

  return (
    <div class="changes">
      <section>
        <h2>{t(lang, 'changes.mine')}</h2>
        {alerts.length === 0 ? <p class="muted">{t(lang, 'changes.none')}</p> : (
          <>
            {alerts.length > 1 && (
              <button type="button" class="button-quiet" style={{ marginBottom: '10px' }} onClick={() => seen(alerts.map((a) => a.eventId))}>
                {t(lang, 'changes.seenAll')}
              </button>
            )}
            <ul class="alert-list">
              {alerts.map((a) => (
                <li key={a.eventId} class="alert">
                  <div class="alert-head">
                    <strong>{a.title}</strong>
                    <button type="button" class="button-quiet" onClick={() => seen([a.eventId])}>{t(lang, 'changes.seen')}</button>
                  </div>
                  {a.removed && <p class="note note-warn">{t(lang, 'changes.removed')}</p>}
                  {a.changes.length > 0 && <ul>{a.changes.map((c, i) => <li key={i}>{c.summary}</li>)}</ul>}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section>
        <h2>{t(lang, 'changes.feed')}</h2>
        <div class="feed-filter" role="group">
          <button type="button" class="chip" aria-pressed={!onlyMine} onClick={() => setOnlyMine(false)}>{t(lang, 'changes.all')}</button>
          <button type="button" class="chip" aria-pressed={onlyMine} onClick={() => setOnlyMine(true)}>{t(lang, 'changes.onlyMine')}</button>
        </div>
        {feed.length === 0 ? <p class="muted">{t(lang, 'changes.feedEmpty')}</p> : (
          <ul class="feed">
            {feed.slice(0, 500).map((c, i) => (
              <li key={i}>
                <time dateTime={c.at}>{fmtDate(lang, c.at)}</time>
                <span><strong>{c.eventTitle}</strong> <span class="feed-summary">{c.summary}</span></span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
