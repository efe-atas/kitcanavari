import { useEffect, useRef, useState } from 'preact/hooks'
import { t } from '../../i18n'
import { topRoles } from '../../logic/career'
import { bucketOptions, moduleKind } from '../../logic/degree'
import { EMPTY_HANDBOOK, moduleRows } from '../../logic/handbook'
import { roadmapEntries } from '../../logic/roadmap'
import { DEFAULT_TERMS, offeringIssue, PRIOR } from '../../logic/terms'
import {
  addModuleToTerm, placeModule, removeFromRoadmap, setEntryCountAs, setGrade, setNote, setStatus, toggleSlot,
} from '../../store'
import type { CareerData, CoursesFile, HandbookFile, ModuleStatus, SkillId, UserState } from '../../types'
import { roleTitle } from '../career/model'
import { fmtSlot } from '../format'
import { Icon } from '../Icon'
import { termName } from '../roadmap/format'
import { closePanel } from '../route'

interface Props {
  data: CoursesFile
  handbook: HandbookFile | null
  career: CareerData | null
  state: UserState
  update: (fn: (s: UserState) => UserState) => void
  id: string
}

const STATUSES: ModuleStatus[] = ['planned', 'passed', 'failed', 'dropped']

export function courseTitle(data: CoursesFile, handbook: HandbookFile | null, id: string): string {
  return handbook?.modules[id]?.title ?? data.modules[id]?.title ?? id
}

/** Everything about one course in the plan, and every control for it, in one place. */
export function CourseDetail({ data, handbook, career, state, update, id }: Props) {
  const { lang } = state
  const row = moduleRows(data, handbook ?? EMPTY_HANDBOOK).find((r) => r.id === id) ?? null
  const entry = roadmapEntries(state)[id]
  const terms = state.roadmap?.terms ?? DEFAULT_TERMS
  const kind = row ? moduleKind(data, row) : 'lecture'
  const places = row ? bucketOptions(row) : []
  const note = state.roadmap?.notes[id] ?? ''
  const [draft, setDraft] = useState(note)
  useEffect(() => setDraft(note), [note])
  const pending = useRef<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveNote = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    const text = pending.current
    pending.current = null
    if (text !== null) update((s) => setNote(s, id, text))
  }
  useEffect(() => saveNote, [])
  const [gradeBad, setGradeBad] = useState(false)
  const commitGrade = (raw: string) => {
    const text = raw.trim().replace(',', '.')
    const value = text === '' ? null : Number(text)
    if (value !== null && !(value >= 1 && value <= 4)) return setGradeBad(true)
    setGradeBad(false)
    if (entry && value !== entry.grade) update((s) => setGrade(s, id, value))
  }
  const weekly = Object.entries(state.selected).filter(([, e]) => e.moduleId === id)
    .map(([eid, e]) => ({ eid, e, ev: data.events[eid] })).filter((x) => x.ev)
  const scores = career?.skills.modules[id]
  const best = career ? topRoles(id, career).map((r) => roleTitle(career, r.role, lang)) : []
  const issue = row && entry ? offeringIssue(row, entry.term) : null
  const hb = row?.hb

  return (
    <div class="course-detail">
      <p class="detail-kicker">
        <span>{id}</span>
        {row?.ects != null && <span>{row.ects} ECTS</span>}
        {kind !== 'lecture' && <span class={`tag tag-${kind}`}>{t(lang, `kind.${kind}`)}</span>}
        {row && <span>{t(lang, `rec.${row.recurrence}`)}</span>}
      </p>
      {issue && <p class="note note-warn"><Icon name="alert" size={14} />{t(lang, `road.warn.${issue}`)}</p>}

      {entry ? (
        <section class="detail-controls" aria-label={t(lang, 'detail.inPlan')}>
          <div class="segmented" role="group" aria-label={t(lang, 'road.status')}>
            {STATUSES.map((st) => (
              <button key={st} type="button" aria-pressed={entry.status === st} onClick={() => update((s) => setStatus(s, id, st))}>
                {t(lang, `road.status.${st}`)}
              </button>
            ))}
          </div>
          <div class="field-grid">
            {entry.status === 'passed' && (
              <label>
                {t(lang, 'road.grade')}
                <input key={String(entry.grade)} type="text" inputMode="decimal" defaultValue={entry.grade === null ? '' : String(entry.grade)}
                  aria-invalid={gradeBad} onBlur={(e) => commitGrade((e.target as HTMLInputElement).value)}
                  onKeyDown={(e) => e.key === 'Enter' && commitGrade((e.target as HTMLInputElement).value)} />
                {gradeBad && <span class="field-error">{t(lang, 'road.gradeInvalid')}</span>}
              </label>
            )}
            <label>
              {t(lang, 'road.move')}
              <select value={entry.term} onChange={(e) => update((s) => placeModule(s, id, (e.target as HTMLSelectElement).value))}>
                {[PRIOR, ...terms].map((term) => <option key={term} value={term}>{termName(lang, term)}</option>)}
              </select>
            </label>
            {places.length > 1 && (
              <label>
                {t(lang, 'road.countAs')}
                <select value={entry.countAs ?? ''} onChange={(e) => update((s) => setEntryCountAs(s, id, (e.target as HTMLSelectElement).value || null))}>
                  <option value="">{t(lang, 'road.countAuto')}</option>
                  {places.map((p) => <option key={p} value={p}>{p === 'elective' || p === 'minor' || p === 'iq' ? t(lang, `bucket.${p}`) : p}</option>)}
                </select>
              </label>
            )}
          </div>
          <label class="note-field">
            {t(lang, 'road.note')}
            <textarea rows={2} value={draft} onInput={(e) => {
              const text = (e.target as HTMLTextAreaElement).value
              setDraft(text)
              pending.current = text
              if (timer.current) clearTimeout(timer.current)
              timer.current = setTimeout(saveNote, 600)
            }} onBlur={saveNote} />
          </label>
        </section>
      ) : (
        <section class="detail-controls">
          <label>
            {t(lang, 'road.placeIn')}
            <select value="" onChange={(e) => {
              const term = (e.target as HTMLSelectElement).value
              if (term) update((s) => addModuleToTerm(s, data, handbook, id, term))
            }}>
              <option value="">—</option>
              {[PRIOR, ...terms].map((term) => <option key={term} value={term}>{termName(lang, term)}</option>)}
            </select>
          </label>
        </section>
      )}

      {weekly.length > 0 && (
        <section>
          <h3>{t(lang, 'detail.thisWeek')}</h3>
          {weekly.map(({ eid, e, ev }) => (
            <div key={eid} class="weekly-event">
              <p><strong>{ev.title}</strong> <span class="muted">{ev.typeCode} · {ev.number}</span></p>
              <ul class="plain">
                {ev.slots.map((s, i) => (
                  <li key={i}>
                    <label class="check">
                      <input type="checkbox" checked={e.enabledSlots.includes(i)} onChange={() => update((st) => toggleSlot(st, eid, i))} />
                      {fmtSlot(lang, s)}{s.room && <span class="muted"> · {s.room}</span>}
                    </label>
                  </li>
                ))}
              </ul>
              <p class="links">
                {ev.iliasUrl && <a class="ext-link" href={ev.iliasUrl} target="_blank" rel="noopener">{t(lang, 'event.ilias')}<Icon name="external" size={14} /></a>}
                <a class="ext-link" href={ev.kitUrl} target="_blank" rel="noopener">{t(lang, 'event.kit')}<Icon name="external" size={14} /></a>
              </p>
            </div>
          ))}
        </section>
      )}

      {career && (
        <section>
          <h3>{t(lang, 'detail.career')}</h3>
          {scores ? (
            <>
              {best.length > 0 && <p>{t(lang, 'module.bestFor', { roles: best.join(', ') })}</p>}
              <details>
                <summary>{t(lang, 'module.skills')}</summary>
                <ul class="plain module-skills">
                  {(Object.entries(scores) as [SkillId, [number, string]][]).sort((a, b) => b[1][0] - a[1][0]).map(([s, [score, reason]]) => (
                    <li key={s}><span class="tag tag-skill">{t(lang, `skill.${s}`)} {score}/3</span> {reason}</li>
                  ))}
                </ul>
              </details>
            </>
          ) : <p class="muted">{t(lang, 'module.unscored')}</p>}
        </section>
      )}

      {(hb?.competenceGoals || hb?.content || hb?.prerequisites) && (
        <details class="handbook-text">
          <summary>{t(lang, 'detail.handbook')}</summary>
          {([['module.objectives', hb!.competenceGoals], ['module.content', hb!.content], ['module.prerequisites', hb!.prerequisites]] as const)
            .filter(([, v]) => v).map(([k, v]) => (
              <div key={k}><h4>{t(lang, k)}</h4><div class="prose prose-lines">{v!.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}</div></div>
            ))}
        </details>
      )}

      {entry && (
        <button type="button" class="button-danger-quiet" onClick={() => { update((s) => removeFromRoadmap(s, id)); closePanel() }}>
          {t(lang, 'detail.remove')}
        </button>
      )}
    </div>
  )
}
