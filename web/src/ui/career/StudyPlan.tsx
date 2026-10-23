import { useMemo, useState } from 'preact/hooks'
import { t } from '../../i18n'
import { AREAS, defaultBucket } from '../../logic/degree'
import type { ModuleRow } from '../../logic/handbook'
import { roadmapEntries } from '../../logic/roadmap'
import { proposeStudyPlan, TERM_CAP } from '../../logic/studyPlan'
import { addModuleToTerm, removeFromRoadmap, setArea, setEntryCountAs } from '../../store'
import type { CareerData, CoursesFile, HandbookFile, Lang, Lens, Role, UserState } from '../../types'
import { Icon } from '../Icon'
import { termName } from '../roadmap/format'
import { courseHref, pageHref } from '../route'

export type PlanMode = 'rebuild' | 'fill'

interface Props {
  data: CoursesFile
  handbook: HandbookFile | null
  career: CareerData
  role: Role
  lens: Lens
  rows: ModuleRow[]
  state: UserState
  update: (fn: (s: UserState) => UserState) => void
  mode: PlanMode
  onMode: (m: PlanMode) => void
}

const bucketLabel = (lang: Lang, b: string) => (AREAS.includes(b) ? b : t(lang, `bucket.${b}`))

/** Browsing a career does not generate or change a study program. */
export function StudyPlan(props: Omit<Props, 'mode' | 'onMode'>) {
  const [started, setStarted] = useState(false)
  const [mode, setMode] = useState<PlanMode>('fill')
  if (started) return <GeneratedStudyPlan {...props} mode={mode} onMode={setMode} />
  return <section class="study-plan career-start" aria-labelledby="sp-title">
    <h3 id="sp-title">{t(props.state.lang, 'sp.title')}</h3>
    <p>{t(props.state.lang, 'cx.prepareLead')}</p>
    <button type="button" class="button" onClick={() => setStarted(true)}>{t(props.state.lang, 'cx.prepare')}</button>
  </section>
}

/**
 * The remaining terms as a full program for this job: built around passed courses, either rebuilding the
 * plan (what stays, what is added, what goes) or only filling its gaps; applied in one step.
 */
function GeneratedStudyPlan({ data, handbook, career, role, lens, rows, state, update, mode, onMode }: Props) {
  const { lang } = state
  const [exclude, setExclude] = useState<Set<string>>(new Set())
  const [keep, setKeep] = useState<Set<string>>(new Set())
  const [applied, setApplied] = useState(false)
  const rebuild = mode === 'rebuild'
  const plan = useMemo(() => proposeStudyPlan({ state, courses: data, handbook, career, role, lens, rows, exclude, rebuild, keep }),
    [state, data, handbook, career, role, lens, rows, exclude, rebuild, keep])
  const titleOf = new Map(rows.map((r) => [r.id, r.title]))
  const ectsOf = new Map(rows.map((r) => [r.id, r.ects]))
  const entries = roadmapEntries(state)

  if (plan.needsAreas) {
    const [a, b] = plan.needsAreas
    return (
      <section class="study-plan" aria-labelledby="sp-title">
        <h3 id="sp-title">{t(lang, 'sp.title')}</h3>
        <div class="sp-areas">
          <p>{t(lang, 'sp.needAreas')}</p>
          <p class="sp-areas-pick">{t(lang, 'sp.areaHint', { a, b })}</p>
          <button type="button" class="button" onClick={() => update((s) => setArea(setArea(s, 0, a), 1, b))}>{t(lang, 'sp.useAreas')}</button>
        </div>
      </section>
    )
  }

  const added = plan.picks.filter((p) => !p.was)
  const moved = plan.picks.filter((p) => p.was && p.was !== p.term)
  const changes = added.length + moved.length + plan.dropped.length
  const apply = () => {
    const areas = state.areas ?? []
    update((s) => {
      let next = plan.dropped.reduce((acc, id) => removeFromRoadmap(acc, id), s)
      for (const p of plan.picks) {
        if (p.was && p.was !== p.term) {
          // A course moved to another term must leave this term's weekly timetable.
          next = { ...next, selected: Object.fromEntries(Object.entries(next.selected).filter(([, e]) => e.moduleId !== p.id)) }
        }
        next = addModuleToTerm(next, data, handbook, p.id, p.term)
        const fields = (handbook?.modules[p.id] ?? data.modules[p.id])?.fields ?? []
        if (defaultBucket(fields, areas, roadmapEntries(next)[p.id]?.countAs ?? null) !== p.bucket) next = setEntryCountAs(next, p.id, p.bucket)
      }
      return next
    })
    setApplied(true)
    setExclude(new Set())
    setKeep(new Set())
  }
  if (applied) return <section class="study-plan career-complete" aria-labelledby="sp-title">
    <h3 id="sp-title">{t(lang, 'sp.title')}</h3>
    <p class="sp-done" role="status"><Icon name="check" size={20} />{t(lang, 'sp.applied')}</p>
    <p>{t(lang, 'cx.appliedLead')}</p>
    <div class="career-complete-actions">
      <a class="button" href={pageHref({ kind: 'plan' })}>{t(lang, 'sp.openPlan')}</a>
      <button type="button" class="button-quiet" onClick={() => { onMode('fill'); setApplied(false) }}>{t(lang, 'cx.again')}</button>
    </div>
  </section>
  // Courses the plan builds around in each term: passed ones, and (fill mode or kept) planned ones.
  const fixed = (term: string) => Object.entries(entries)
    .filter(([id, e]) => e.term === term && (e.status === 'planned' || e.status === 'passed') && !plan.picks.some((p) => p.id === id) && !plan.dropped.includes(id))

  return (
    <section class="study-plan" aria-labelledby="sp-title">
      <header class="sp-head">
        <h3 id="sp-title">{t(lang, 'sp.title')}</h3>
        <p class="sp-lead">{t(lang, rebuild ? 'sp.leadRebuild' : 'sp.leadFill')}</p>
        <div class="segmented sp-mode" role="group" aria-label={t(lang, 'sp.mode')}>
          <button type="button" aria-pressed={!rebuild} onClick={() => { onMode('fill'); setApplied(false) }}>{t(lang, 'sp.mode.fill')}</button>
          <button type="button" aria-pressed={rebuild} onClick={() => { onMode('rebuild'); setApplied(false) }}>{t(lang, 'sp.mode.rebuild')}</button>
        </div>
      </header>

      {!changes && <p class="sp-done">{t(lang, rebuild ? 'sp.nothingRebuild' : 'sp.nothing')}</p>}
      <p class="career-preview-note">{t(lang, 'cx.preview')}</p>

      <dl class="sp-summary">
        <div><dt>{t(lang, 'sp.addedCount')}</dt><dd><strong>{added.length}</strong> · {added.reduce((n, p) => n + p.ects, 0)} ECTS</dd></div>
        {moved.length > 0 && <div><dt>{t(lang, 'cx.moved')}</dt><dd><strong>{moved.length}</strong></dd></div>}
        {rebuild && <div><dt>{t(lang, 'sp.droppedCount')}</dt><dd><strong>{plan.dropped.length}</strong></dd></div>}
        <div><dt>{t(lang, 'sp.fit')}</dt><dd><strong>{plan.before}% → {plan.after}%</strong></dd></div>
        <div><dt>{t(lang, 'sp.rules')}</dt><dd>{plan.missing.length ? <strong class="sp-warn">{t(lang, 'sp.rulesOpen', { n: plan.missing.length })}</strong> : <strong class="sp-ok">{t(lang, 'sp.rulesOk')}</strong>}</dd></div>
      </dl>

      <div class="sp-terms">
        {plan.terms.map(({ term, load }) => {
          const picks = plan.picks.filter((p) => p.term === term)
          const have = fixed(term)
          return (
            <section key={term} class="sp-term" aria-label={termName(lang, term)}>
              <header class="sp-term-head">
                <h4>{termName(lang, term)}</h4>
                <span class={load > TERM_CAP ? 'sp-load is-heavy' : 'sp-load'}>{load} / {TERM_CAP} ECTS</span>
              </header>
              <ul class="plain sp-list">
                {have.map(([id]) => (
                  <li key={id} class="sp-item is-existing">
                    <a class="sp-item-title" href={courseHref(id)}>{titleOf.get(id) ?? id}</a>
                    <span class="sp-item-meta">{t(lang, keep.has(id) ? 'sp.kept' : 'sp.inPlan')}</span>
                  </li>
                ))}
                {picks.map((p) => {
                  const title = titleOf.get(p.id) ?? p.id
                  return (
                    <li key={p.id} class={`sp-item${p.was ? ' is-staying' : ' is-new'}`}>
                      <a class="sp-item-title" href={courseHref(p.id)}>{title}</a>
                      <span class="sp-item-meta">
                        <span>{p.ects} ECTS</span>
                        <span class={`sp-status${p.was ? '' : ' is-new'}`}>
                          {!p.was ? t(lang, 'sp.new') : p.was !== p.term ? t(lang, 'sp.movedFrom', { term: termName(lang, p.was) }) : t(lang, 'sp.stays')}
                        </span>
                        <span class={`sp-reason reason-${p.reason}`}>{t(lang, `sp.reason.${p.reason}`)}</span>
                      </span>
                      {p.skills.length > 0 && <span class="sp-item-why">{p.skills.map((s) => t(lang, `skill.${s}`)).join(', ')}</span>}
                      <span class="sp-item-why">{t(lang, 'sp.countsAs', { b: bucketLabel(lang, p.bucket) })}</span>
                      <button type="button" class="icon-button sp-remove" aria-label={t(lang, 'sp.remove', { title })}
                        onClick={() => { setExclude(new Set([...exclude, p.id])); setApplied(false) }}>
                        <Icon name="close" size={16} />
                      </button>
                    </li>
                  )
                })}
                {!have.length && !picks.length && <li class="sp-empty">{t(lang, 'pl.empty')}</li>}
              </ul>
            </section>
          )
        })}
        {plan.thesisTerm && (
          <section class="sp-term is-thesis" aria-label={termName(lang, plan.thesisTerm)}>
            <header class="sp-term-head">
              <h4>{termName(lang, plan.thesisTerm)}</h4>
              <span class="sp-load">30 ECTS</span>
            </header>
            <p class="sp-thesis">{t(lang, 'ov.thesis')}</p>
          </section>
        )}
      </div>

      {plan.dropped.length > 0 && (
        <section class="sp-dropped" aria-labelledby="sp-dropped-title">
          <h4 id="sp-dropped-title">{t(lang, 'sp.droppedTitle')}</h4>
          <p class="sp-item-why">{t(lang, 'sp.droppedLead')}</p>
          <ul class="plain sp-dropped-list">
            {plan.dropped.map((id) => (
              <li key={id}>
                <a href={courseHref(id)}>{titleOf.get(id) ?? id}</a>
                <span class="muted">{ectsOf.get(id) ?? '?'} ECTS, {termName(lang, entries[id].term)}</span>
                <button type="button" class="button-quiet" onClick={() => { setKeep(new Set([...keep, id])); setApplied(false) }}>{t(lang, 'sp.keep')}</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ul class="plain sp-notes">
        {plan.iqLeft > 0 && <li><Icon name="alert" size={16} />{t(lang, 'sp.iq', { n: plan.iqLeft })}</li>}
        {plan.missing.map((m) => (
          <li key={m}><Icon name="alert" size={16} />{m.startsWith('area:') ? t(lang, 'sp.missing.area', { area: m.slice(5) }) : t(lang, `sp.missing.${m}`)}</li>
        ))}
      </ul>

      {changes > 0 && (
        <div class="sp-actions">
          <button type="button" class="button" onClick={apply}>
            <Icon name="check" size={16} />{rebuild ? t(lang, 'sp.applyRebuild', { a: added.length, d: plan.dropped.length }) : t(lang, 'sp.apply', { n: added.length })}
          </button>
          {(exclude.size > 0 || keep.size > 0) && (
            <button type="button" class="button-quiet" onClick={() => { setExclude(new Set()); setKeep(new Set()) }}>{t(lang, 'sp.reset')}</button>
          )}
        </div>
      )}
    </section>
  )
}
