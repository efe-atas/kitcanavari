import { useMemo, useState } from 'preact/hooks'
import { t } from '../../i18n'
import { findConflicts } from '../../logic/conflicts'
import { chosenModule, computeEcts } from '../../logic/ects'
import { buildIcs } from '../../logic/ics'
import { bucketOf, bucketOptions } from '../../logic/degree'
import { addEvent, exportState, importState, removeEvent, setCountAs, setModule, toggleSlot } from '../../store'
import type { CoursesFile, Lang, UserState } from '../../types'
import { EventDetail } from '../catalog/EventDetail'
import { download } from '../download'
import { fmtDate, fmtSlot, typeClass } from '../format'
import { Icon } from '../Icon'
import { DegreePanel } from './DegreePanel'
import { EctsPanel } from './EctsPanel'
import { PlanBoard } from './PlanBoard'
import { UnscheduledList } from './UnscheduledList'
import { WeekGrid } from './WeekGrid'

interface Props {
  data: CoursesFile
  state: UserState
  update: (fn: (s: UserState) => UserState) => void
}

/** "Counts towards" select; hidden when the module can only count in one place. */
function BucketSelect({ lang, data, state, id, onChange }: {
  lang: Lang; data: CoursesFile; state: UserState; id: string; onChange: (b: string | null) => void
}) {
  const ev = data.events[id]
  const mid = chosenModule(state.selected[id], ev)
  const options = mid && data.modules[mid] ? bucketOptions(data.modules[mid]) : []
  if (options.length < 2) return null
  return (
    <>
      <label class="field-label" for={`bucket-${id}`}>{t(lang, 'schedule.countsAs')}</label>
      <select id={`bucket-${id}`} value={bucketOf(state, data, id) ?? ''}
        onChange={(e) => onChange((e.target as HTMLSelectElement).value || null)}>
        {options.map((b) => (
          <option key={b} value={b}>{b === 'elective' || b === 'minor' || b === 'iq' ? t(lang, `bucket.${b}`) : b}</option>
        ))}
      </select>
    </>
  )
}

export function ScheduleView({ data, state, update }: Props) {
  const { lang } = state
  const [openId, setOpenId] = useState<string | null>(null)
  const [importError, setImportError] = useState(false)
  const conflicts = useMemo(() => findConflicts(state.selected, data.events), [data, state.selected])
  const ects = useMemo(() => computeEcts(state.selected, data.events, data.modules), [data, state.selected])
  const ids = Object.keys(state.selected).sort((a, b) =>
    (data.events[a]?.title ?? a).localeCompare(data.events[b]?.title ?? b))
  const title = (id: string) => data.events[id]?.title ?? state.selected[id]?.title ?? id
  const open = openId ? data.events[openId] : null

  const onImport = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const next = importState(await file.text())
    setImportError(!next)
    if (next) update(() => next)
    ;(e.target as HTMLInputElement).value = ''
  }

  const tools = (
    <header class="page-head">
      <h2>{t(lang, 'tab.schedule')}</h2>
      <div class="schedule-tools">
      {ids.length > 0 && (
        <button type="button" class="button" onClick={() => download('kit-schedule.ics', buildIcs(state.selected, data.events, data.meta.scrapedAt), 'text/calendar')}>
          <Icon name="download" size={16} />{t(lang, 'schedule.ics')}
        </button>
      )}
      {ids.length > 0 && (
        <button type="button" class="button-quiet" onClick={() => download('kit-schedule.json', exportState(state), 'application/json')}>
          {t(lang, 'schedule.export')}
        </button>
      )}
      <label class="button-quiet">
        <Icon name="upload" size={16} />{t(lang, 'schedule.import')}
        <input type="file" accept="application/json,.json" aria-label={t(lang, 'schedule.import')} hidden onChange={onImport} />
      </label>
      {importError && <span class="note note-warn" role="alert">{t(lang, 'schedule.importError')}</span>}
      </div>
    </header>
  )

  if (!ids.length) {
    return (
      <div>
        {tools}
        <div class="empty-state">
          <Icon name="calendar" size={28} />
          <p>{t(lang, 'schedule.empty')}</p>
          <a class="button" href="#/catalog"><Icon name="catalog" size={16} />{t(lang, 'tab.catalog')}</a>
        </div>
      </div>
    )
  }

  return (
    <div class="schedule">
      <div>
        {tools}
        {conflicts.length > 0 && (
          <section class="conflict-list" role="region" aria-label={t(lang, 'schedule.conflicts')}>
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
        <WeekGrid lang={lang} data={data} state={state} conflicts={conflicts} onOpen={setOpenId} />
        <PlanBoard lang={lang} data={data} state={state} onOpen={setOpenId} />
      </div>

      <aside class="side-panel">
        <EctsPanel lang={lang} ects={ects} />
        <DegreePanel lang={lang} data={data} state={state} update={update} />
        <UnscheduledList lang={lang} data={data} state={state} onOpen={setOpenId} />
        <section class="panel">
          <h3>{t(lang, 'tab.schedule')} <span class="panel-count">{ids.length}</span></h3>
          <ul class="selected-list">
            {ids.map((id) => {
              const ev = data.events[id]
              const entry = state.selected[id]
              if (!ev) {
                return (
                  <li key={id} class="selected-item is-removed">
                    <span class="title">{entry.title ?? id}</span>
                    <span class="removed-tag">{t(lang, 'schedule.removed')}</span>
                    <button type="button" class="link-button" onClick={() => update((s) => removeEvent(s, id))}>{t(lang, 'event.remove')}</button>
                  </li>
                )
              }
              const selectId = `module-${id}`
              return (
                <li key={id} class={`selected-item type-${typeClass(ev.typeCode)}`}>
                  <button type="button" class="link-button title" onClick={() => setOpenId(id)}>{ev.title}</button>
                  {ev.slots.length > 1 && (
                    <div class="slot-toggles">
                      {ev.slots.map((s, i) => (
                        <button key={i} type="button" class="chip" aria-pressed={entry.enabledSlots.includes(i)}
                          title={t(lang, 'schedule.slotToggle')} onClick={() => update((st) => toggleSlot(st, id, i))}>
                          {fmtSlot(lang, s)}
                        </button>
                      ))}
                    </div>
                  )}
                  {ev.moduleIds.length > 0 && (
                    <label class="field-label" for={selectId}>{t(lang, 'schedule.countsFor')}</label>
                  )}
                  {ev.moduleIds.length > 0 && (
                    <select id={selectId} value={chosenModule(entry, ev) ?? ''}
                      onChange={(e) => update((st) => setModule(st, id, (e.target as HTMLSelectElement).value || null))}>
                      {ev.moduleIds.map((mid) => {
                        const m = data.modules[mid]
                        return <option key={mid} value={mid}>{m ? `${m.title}${m.ects !== null ? ` (${m.ects} ECTS)` : ''}` : mid}</option>
                      })}
                    </select>
                  )}
                  <BucketSelect lang={lang} data={data} state={state} id={id}
                    onChange={(b) => update((st) => setCountAs(st, id, b))} />
                  <button type="button" class="link-button link-danger" onClick={() => update((s) => removeEvent(s, id))}>{t(lang, 'event.remove')}</button>
                </li>
              )
            })}
          </ul>
        </section>
      </aside>

      {open && (
        <EventDetail lang={lang} data={data} ev={open} myAreas={state.areas ?? []} inSchedule={!!state.selected[open.id]}
          onToggle={() => update((s) => (s.selected[open.id] ? removeEvent(s, open.id) : addEvent(s, open)))}
          onClose={() => setOpenId(null)} />
      )}
    </div>
  )
}
