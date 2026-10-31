import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { t } from '../../i18n'
import { attendanceOf, type Hint } from '../../logic/attendance'
import { berlinNow } from '../../logic/calendar'
import { topRoles } from '../../logic/career'
import { addConflicts } from '../../logic/conflicts'
import { AREAS, bucketOptions, defaultBucket, moduleKind } from '../../logic/degree'
import { EMPTY_HANDBOOK, moduleRows } from '../../logic/handbook'
import { roadmapEntries } from '../../logic/roadmap'
import { similarModules } from '../../logic/search'
import { CURRENT_TERM, DEFAULT_TERMS, offeringIssue, PRIOR } from '../../logic/terms'
import {
  addModuleToTerm, moveModule, removeFromRoadmap, restoreModule, setEntryCountAs, setExpected, setGrade, setNote, setReview, setStar, setStatus,
  snapshotModule, toggleSlot,
} from '../../store'
import type { CareerData, CoursesFile, Event, HandbookFile, ModuleStatus, Review, SkillId, UserState } from '../../types'
import { roleTitle } from '../career/model'
import { fmtDate, fmtSlot } from '../format'
import { Icon } from '../Icon'
import { termName } from '../roadmap/format'
import { closeCourse, courseHref } from '../route'
import { useToast } from '../toast'
import { DeadlineForm, DeadlineList } from '../deadlines/Deadlines'

interface Props {
  data: CoursesFile
  handbook: HandbookFile | null
  career: CareerData | null
  state: UserState
  update: (fn: (s: UserState) => UserState) => void
  id: string
}

const STATUSES: ModuleStatus[] = ['planned', 'passed', 'failed', 'dropped']
/** KIT grade steps. */
const GRADES = [1.0, 1.3, 1.7, 2.0, 2.3, 2.7, 3.0, 3.3, 3.7, 4.0]
const EMPTY_REVIEW: Review = { difficulty: null, workload: null, recommend: null, text: '' }
const HINT_ICON: Record<Hint['kind'], 'alert' | 'calendar' | 'users'> = { required: 'alert', kickoff: 'calendar', registration: 'users' }

export function courseTitle(data: CoursesFile, handbook: HandbookFile | null, id: string): string {
  return handbook?.modules[id]?.title ?? data.modules[id]?.title ?? id
}

/** The next dated session of a course that is not cancelled, from today on. */
function nextSession(ev: Event, today: string) {
  return ev.sessions.find((s) => !s.cancelled && s.date >= today) ?? null
}

/** Everything about one course, and every control for it, in one place. */
export function CourseDetail({ data, handbook, career, state, update, id }: Props) {
  const { lang } = state
  const toast = useToast()
  const rows = useMemo(() => moduleRows(data, handbook ?? EMPTY_HANDBOOK), [data, handbook])
  const row = rows.find((r) => r.id === id) ?? null
  const entry = roadmapEntries(state)[id]
  const terms = state.roadmap?.terms ?? DEFAULT_TERMS
  const kind = row ? moduleKind(data, row) : 'lecture'
  const places = row ? bucketOptions(row) : []
  const counted = row && entry ? defaultBucket(row.fields, state.areas ?? [], entry.countAs) : row ? defaultBucket(row.fields, state.areas ?? [], null) : null
  const note = state.roadmap?.notes[id] ?? ''
  const isStar = (state.starred ?? []).includes(id)
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
  const events = (row?.eventIds ?? []).map((eid) => data.events[eid]).filter((ev): ev is Event => !!ev)
  const scores = career?.skills.modules[id]
  const best = career ? topRoles(id, career).map((r) => roleTitle(career, r.role, lang)) : []
  const issue = row && entry ? offeringIssue(row, entry.term) : null
  const hb = row?.hb
  const desc = row?.current?.description
  const today = berlinNow().date
  const hints = useMemo(() => {
    const seen = new Set<string>()
    return events.flatMap((ev) => attendanceOf(data, ev).hints).filter((h) => !seen.has(h.text) && seen.add(h.text)).slice(0, 4)
  }, [id, data])
  const similar = useMemo(() => similarModules(id, rows, career), [id, rows, career])
  const clash = !entry && addConflicts(state.selected, data.events, id, row?.eventIds ?? []).length > 0
  const label = (p: string) => (AREAS.includes(p) ? p : t(lang, `bucket.${p}`))

  const add = (term: string) => {
    const snap = snapshotModule(state, id)
    update((s) => addModuleToTerm(s, data, handbook, id, term))
    toast({ message: t(lang, 'toast.addedTo', { term: termName(lang, term) }), tone: 'success', action: { label: t(lang, 'toast.undo'), run: () => update((s) => restoreModule(s, id, snap)) } })
  }
  const remove = () => {
    const snap = snapshotModule(state, id)
    const title = row?.title ?? id
    update((s) => removeFromRoadmap(s, id))
    closeCourse()
    toast({ message: t(lang, 'toast.removed', { title }), action: { label: t(lang, 'toast.undo'), run: () => update((s) => restoreModule(s, id, snap)) } })
  }

  return (
    <div class="course-detail">
      <div class="detail-top">
        <p class="detail-kicker">
          <span class="detail-id">{id}</span>
          {row?.ects != null && <span class="detail-ects"><strong>{row.ects}</strong> ECTS</span>}
          {kind !== 'lecture' && <span class={`tag tag-${kind}`}>{t(lang, `kind.${kind}`)}</span>}
          {row && <span>{t(lang, `rec.${row.recurrence}`)}</span>}
          {hb?.language && <span>{hb.language}</span>}
        </p>
        <button type="button" class={`button-quiet is-small star-button${isStar ? ' is-on' : ''}`} aria-pressed={isStar}
          onClick={() => update((s) => setStar(s, id, !isStar))}>
          <Icon name="star" size={15} filled={isStar} />{t(lang, isStar ? 'star.on' : 'star.off')}
        </button>
      </div>
      {issue && <p class="note note-warn"><Icon name="alert" size={14} />{t(lang, `road.warn.${issue}`)}</p>}
      {hb?.coordinators.length ? <p class="detail-people"><Icon name="user" size={14} />{hb.coordinators.join(', ')}</p> : null}

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
              <label class="field">
                {t(lang, 'road.grade')}
                <input key={String(entry.grade)} type="text" inputMode="decimal" defaultValue={entry.grade === null ? '' : String(entry.grade)}
                  aria-invalid={gradeBad} placeholder="1,0 – 4,0" onBlur={(e) => commitGrade((e.target as HTMLInputElement).value)}
                  onKeyDown={(e) => e.key === 'Enter' && commitGrade((e.target as HTMLInputElement).value)} />
                {gradeBad && <span class="field-error">{t(lang, 'road.gradeInvalid')}</span>}
              </label>
            )}
            <label class="field">
              {t(lang, 'road.move')}
              <select value={entry.term} onChange={(e) => update((s) => moveModule(s, data, id, (e.target as HTMLSelectElement).value))}>
                {[PRIOR, ...terms].map((term) => <option key={term} value={term}>{termName(lang, term)}</option>)}
              </select>
            </label>
            {entry.status === 'planned' && (
              <label class="field">
                {t(lang, 'detail.expected')}
                <select value={state.expected?.[id] != null ? String(state.expected[id]) : ''}
                  onChange={(e) => { const v = (e.target as HTMLSelectElement).value; update((s) => setExpected(s, id, v ? Number(v) : null)) }}>
                  <option value="">—</option>
                  {GRADES.map((g) => <option key={g} value={String(g)}>{g.toFixed(1).replace('.', lang === 'en' ? '.' : ',')}</option>)}
                </select>
              </label>
            )}
            {places.length > 1 && (
              <label class="field">
                {t(lang, 'road.countAs')}
                <select value={entry.countAs ?? ''} onChange={(e) => update((s) => setEntryCountAs(s, id, (e.target as HTMLSelectElement).value || null))}>
                  <option value="">{t(lang, 'road.countAuto')}</option>
                  {places.map((p) => <option key={p} value={p}>{label(p)}</option>)}
                </select>
              </label>
            )}
          </div>
          <label class="field note-field">
            {t(lang, 'road.note')}
            <textarea rows={2} value={draft} placeholder={t(lang, 'detail.notePlaceholder')} onInput={(e) => {
              const text = (e.target as HTMLTextAreaElement).value
              setDraft(text)
              pending.current = text
              if (timer.current) clearTimeout(timer.current)
              timer.current = setTimeout(saveNote, 600)
            }} onBlur={saveNote} />
          </label>
        </section>
      ) : (
        <section class="detail-controls detail-add" aria-labelledby="detail-add-title">
          <h3 id="detail-add-title">{t(lang, 'detail.addTo')}</h3>
          <div class="term-chips">
            {[...terms, PRIOR].map((term) => {
              const warn = row ? offeringIssue(row, term) : null
              return (
                <button key={term} type="button" class={`term-chip${warn ? ' has-warn' : ''}`} onClick={() => add(term)}
                  aria-label={`${t(lang, 'road.placeIn')}: ${termName(lang, term)}${warn ? ` (${t(lang, `road.warn.${warn}`)})` : ''}`}>
                  <Icon name="plus" size={14} /><span>{termName(lang, term)}</span>
                  {warn && <small>{t(lang, `road.warn.${warn}`)}</small>}
                </button>
              )
            })}
          </div>
          {clash && <p class="note note-warn"><Icon name="alert" size={14} />{t(lang, 'detail.clash')}</p>}
        </section>
      )}

      <section class="detail-section">
        <h3>{t(lang, 'dl.cardTitle')}</h3>
        {(state.deadlines ?? []).some((d) => d.moduleId === id) && (
          <DeadlineList lang={lang} list={(state.deadlines ?? []).filter((d) => d.moduleId === id)} update={update} today={today} linkCourses={false} />
        )}
        <details class="detail-add-date"><summary>{t(lang, 'dl.addFor')}</summary><DeadlineForm lang={lang} update={update} moduleId={id} /></details>
      </section>

      {places.length > 0 && (
        <section class="detail-section">
          <h3>{t(lang, 'detail.counts')}</h3>
          <ul class="plain count-chips">
            {places.map((p) => (
              <li key={p} class={p === counted ? 'is-counted' : (state.areas ?? []).includes(p) ? 'is-mine' : ''}>
                {p === counted && <Icon name="check" size={13} />}{label(p)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {events.length > 0 && (
        <section class="detail-section">
          <h3>{t(lang, 'detail.thisTerm', { term: termName(lang, CURRENT_TERM) })}</h3>
          <div class="event-list">
            {events.map((ev) => {
              const sel = state.selected[ev.id]
              const next = nextSession(ev, today)
              const cancelled = ev.sessions.filter((s) => s.cancelled && s.date >= today).length
              return (
                <article key={ev.id} class="event-card">
                  <header>
                    <strong>{ev.title}</strong>
                    <span class="muted">{ev.type} · {ev.number}{ev.language ? ` · ${ev.language}` : ''}</span>
                  </header>
                  {ev.lecturers.length > 0 && <p class="event-people"><Icon name="user" size={13} />{ev.lecturers.map((l) => l.name).join(', ')}</p>}
                  {ev.slots.length > 0 && (
                    <ul class="plain event-slots">
                      {ev.slots.map((s, i) => (
                        <li key={i}>
                          {sel ? (
                            <label class="check">
                              <input type="checkbox" checked={sel.enabledSlots.includes(i)} onChange={() => update((st) => toggleSlot(st, ev.id, i))} />
                              <span>{fmtSlot(lang, s)}</span>
                            </label>
                          ) : <span class="event-slot"><Icon name="clock" size={13} />{fmtSlot(lang, s)}</span>}
                          {s.room && <span class="muted event-room">{s.room}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                  {(next || cancelled > 0) && (
                    <p class="event-next">
                      {next && <span>{t(lang, 'detail.next', { date: fmtDate(lang, next.date), time: next.start })}</span>}
                      {cancelled > 0 && <span class="is-warn">{t(lang, 'detail.cancelled', { n: cancelled })}</span>}
                    </p>
                  )}
                  <p class="links">
                    {ev.iliasUrl && <a class="ext-link" href={ev.iliasUrl} target="_blank" rel="noopener">{t(lang, 'event.ilias')}<Icon name="external" size={13} /></a>}
                    <a class="ext-link" href={ev.kitUrl} target="_blank" rel="noopener">{t(lang, 'event.kit')}<Icon name="external" size={13} /></a>
                  </p>
                </article>
              )
            })}
          </div>
          {entry && entry.term === CURRENT_TERM && !events.some((ev) => state.selected[ev.id]) && <p class="note">{t(lang, 'detail.notInWeek')}</p>}
        </section>
      )}

      {hints.length > 0 && (
        <section class="detail-section">
          <h3>{t(lang, 'detail.attendance')}</h3>
          <ul class="plain hint-list">
            {hints.map((h) => (
              <li key={h.text} class={`hint is-${h.kind}`}>
                <Icon name={HINT_ICON[h.kind]} size={15} />
                <span><strong>{t(lang, `attend.${h.kind}`)}</strong> <q>{h.text}</q></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {career && (
        <section class="detail-section">
          <h3>{t(lang, 'detail.career')}</h3>
          {scores ? (
            <>
              {best.length > 0 && <p class="detail-text">{t(lang, 'module.bestFor', { roles: best.join(', ') })}</p>}
              <ul class="plain skill-bars">
                {(Object.entries(scores) as [SkillId, [number, string]][]).sort((a, b) => b[1][0] - a[1][0]).slice(0, 4).map(([s, [score]]) => (
                  <li key={s}><span>{t(lang, `skill.${s}`)}</span><span class="skill-dots" role="img" aria-label={`${score}/3`}>{[1, 2, 3].map((i) => <i key={i} class={i <= score ? 'is-on' : ''} />)}</span></li>
                ))}
              </ul>
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

      {similar.length > 0 && (
        <section class="detail-section">
          <h3>{t(lang, 'detail.similar')}</h3>
          <ul class="plain similar-list">
            {similar.map(({ id: sid }) => {
              const r = rows.find((x) => x.id === sid)!
              const e = roadmapEntries(state)[sid]
              return (
                <li key={sid}>
                  <a href={courseHref(sid)}><strong>{r.title}</strong><span>{r.ects ?? '?'} ECTS · {t(lang, `rec.${r.recurrence}`)}{e ? ` · ${t(lang, 'add.inPlan', { term: termName(lang, e.term) })}` : ''}</span></a>
                  <Icon name="chevron" size={16} />
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <ReviewEditor lang={lang} review={state.reviews?.[id] ?? EMPTY_REVIEW} onChange={(r) => update((s) => setReview(s, id, r))} />

      {(hb?.competenceGoals || hb?.content || hb?.prerequisites || hb?.recommendations || desc?.exam || desc?.workload) && (
        <details class="handbook-text">
          <summary>{t(lang, 'detail.handbook')}</summary>
          {([['module.objectives', hb?.competenceGoals], ['module.content', hb?.content], ['module.prerequisites', hb?.prerequisites],
            ['module.recommendations', hb?.recommendations], ['module.exam', desc?.exam], ['module.workload', desc?.workload]] as const)
            .filter(([, v]) => v).map(([k, v]) => (
              <div key={k}><h4>{t(lang, k)}</h4><div class="prose prose-lines">{v!.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}</div></div>
            ))}
        </details>
      )}

      {entry && (
        <button type="button" class="button-danger-quiet detail-remove" onClick={remove}>
          <Icon name="trash" size={15} />{t(lang, 'detail.remove')}
        </button>
      )}
    </div>
  )
}

/** The user's own take on a course: difficulty, workload, would they recommend it, a few words. */
function ReviewEditor({ lang, review, onChange }: { lang: UserState['lang']; review: Review; onChange: (r: Review) => void }) {
  const [text, setText] = useState(review.text)
  useEffect(() => setText(review.text), [review.text])
  const scale = (key: 'difficulty' | 'workload') => (
    <div class="review-scale" role="group" aria-label={t(lang, `rv.${key}`)}>
      <span>{t(lang, `rv.${key}`)}</span>
      <div class="segmented">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" aria-pressed={review[key] === n} aria-label={`${t(lang, `rv.${key}`)} ${n}/5`}
            onClick={() => onChange({ ...review, [key]: review[key] === n ? null : n })}>{n}</button>
        ))}
      </div>
    </div>
  )
  return (
    <section class="detail-section review">
      <h3>{t(lang, 'rv.title')}</h3>
      {scale('difficulty')}
      {scale('workload')}
      <div class="review-scale" role="group" aria-label={t(lang, 'rv.recommend')}>
        <span>{t(lang, 'rv.recommend')}</span>
        <div class="segmented">
          {([true, false] as const).map((v) => (
            <button key={String(v)} type="button" aria-pressed={review.recommend === v}
              onClick={() => onChange({ ...review, recommend: review.recommend === v ? null : v })}>{t(lang, v ? 'rv.yes' : 'rv.no')}</button>
          ))}
        </div>
      </div>
      <label class="field">{t(lang, 'rv.text')}
        <textarea rows={2} value={text} placeholder={t(lang, 'rv.textHint')} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
          onBlur={() => text !== review.text && onChange({ ...review, text })} />
      </label>
    </section>
  )
}
