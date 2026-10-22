import { useMemo, useState } from 'preact/hooks'
import { t } from '../../i18n'
import { findConflicts } from '../../logic/conflicts'
import { buildIcs } from '../../logic/ics'
import { exportState, importState } from '../../store'
import type { CoursesFile, UserState } from '../../types'
import { download } from '../download'
import { fmtDate } from '../format'
import { Icon } from '../Icon'
import { panelHref } from '../route'
import { UnscheduledList } from '../schedule/UnscheduledList'
import { WeekGrid } from '../schedule/WeekGrid'

interface Props {
  data: CoursesFile
  state: UserState
  update: (fn: (s: UserState) => UserState) => void
}

/** This term's week: the timetable, clashes, and calendar/backup files. */
export function WeekPanel({ data, state, update }: Props) {
  const { lang } = state
  const [importError, setImportError] = useState(false)
  const conflicts = useMemo(() => findConflicts(state.selected, data.events), [data, state.selected])
  const ids = Object.keys(state.selected)
  const title = (id: string) => data.events[id]?.title ?? state.selected[id]?.title ?? id
  const open = (eventId: string) => {
    const mid = state.selected[eventId]?.moduleId ?? data.events[eventId]?.moduleIds[0]
    if (mid) location.hash = panelHref({ kind: 'course', id: mid })
  }
  const onImport = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const next = importState(await file.text())
    setImportError(!next)
    if (next) update(() => next)
    ;(e.target as HTMLInputElement).value = ''
  }

  return (
    <div class="week-panel">
      {ids.length === 0 && <p class="empty">{t(lang, 'week.empty')}</p>}
      {conflicts.length > 0 && (
        <section class="conflict-list" aria-label={t(lang, 'schedule.conflicts')}>
          <h3><Icon name="alert" size={16} />{t(lang, 'schedule.conflicts')}</h3>
          <ul>
            {conflicts.map((c) => (
              <li key={`${c.a}-${c.b}-${c.day}-${c.start}`}>
                {title(c.a)} ↔ {title(c.b)}: {t(lang, `day.${c.day}`)} {c.start}–{c.end}
                {c.date && ` (${t(lang, 'schedule.firstOn', { date: fmtDate(lang, c.date) })})`}
              </li>
            ))}
          </ul>
        </section>
      )}
      {ids.length > 0 && <WeekGrid lang={lang} data={data} state={state} conflicts={conflicts} onOpen={open} />}
      <UnscheduledList lang={lang} data={data} state={state} onOpen={open} />
      <div class="week-tools">
        {ids.length > 0 && (
          <button type="button" class="button" onClick={() => download('kit-schedule.ics', buildIcs(state.selected, data.events, data.meta.scrapedAt), 'text/calendar')}>
            <Icon name="download" size={16} />{t(lang, 'schedule.ics')}
          </button>
        )}
        <button type="button" class="button-quiet" onClick={() => download('kit-schedule.json', exportState(state), 'application/json')}>
          {t(lang, 'schedule.export')}
        </button>
        <label class="button-quiet">
          <Icon name="upload" size={16} />{t(lang, 'schedule.import')}
          <input type="file" accept="application/json,.json" aria-label={t(lang, 'schedule.import')} hidden onChange={onImport} />
        </label>
        {importError && <span class="note note-warn" role="alert">{t(lang, 'schedule.importError')}</span>}
      </div>
    </div>
  )
}
