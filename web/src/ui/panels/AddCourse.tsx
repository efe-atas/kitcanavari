import { useMemo, useState } from 'preact/hooks'
import { t } from '../../i18n'
import { lensWeights } from '../../logic/career'
import { findConflicts } from '../../logic/conflicts'
import { bucketOptions, moduleKind, type Kind } from '../../logic/degree'
import { EMPTY_HANDBOOK, moduleRows, type ModuleRow } from '../../logic/handbook'
import { rowBucket, type RowId } from '../../logic/matrix'
import { roadmapEntries } from '../../logic/roadmap'
import { CURRENT_TERM, offeringIssue } from '../../logic/terms'
import { addModuleToTerm } from '../../store'
import type { CareerData, CoursesFile, HandbookFile, SkillId, UserState } from '../../types'
import { fmtSlot } from '../format'
import { Icon } from '../Icon'
import { rowLabel } from '../plan/labels'
import { termName } from '../roadmap/format'
import { panelHref } from '../route'

interface Props {
  data: CoursesFile
  handbook: HandbookFile | null
  career: CareerData | null
  state: UserState
  update: (fn: (s: UserState) => UserState) => void
  term: string
  row: RowId
  filter: Kind | null
}

const KINDS: Kind[] = ['lecture', 'stamm', 'seminar', 'practical']
const PAGE = 30

export const addTitle = (lang: UserState['lang'], s: UserState, term: string, row: RowId) =>
  t(lang, 'add.title', { term: termName(lang, term), row: rowLabel(lang, s, row) })

/** Ranked list of modules for one cell of the plan table. */
export function AddCourse({ data, handbook, career, state, update, term, row, filter }: Props) {
  const { lang } = state
  const [query, setQuery] = useState('')
  const [kinds, setKinds] = useState<Kind[]>(filter ? [filter] : [])
  const [offeredOnly, setOfferedOnly] = useState(true)
  const [limit, setLimit] = useState(PAGE)
  const rows = useMemo(() => moduleRows(data, handbook ?? EMPTY_HANDBOOK), [data, handbook])
  const entries = roadmapEntries(state)
  const bucket = rowBucket(state, row)

  // Goal contribution: Σ weight × score of the first followed path, if any.
  const goal = career && state.followed?.[0]
  const role = goal ? career!.roles.roles.find((r) => r.id === goal.role) : undefined
  const lens = goal ? career!.lenses.lenses.find((l) => l.id === goal.lens) : undefined
  const weights = role && lens ? lensWeights(role, lens) : null
  const goalScore = (id: string) => {
    if (!weights || !career) return 0
    const s = career.skills.modules[id] ?? {}
    return Object.entries(weights).reduce((n, [k, w]) => n + (w ?? 0) * (s[k as SkillId]?.[0] ?? 0), 0)
  }

  const q = query.trim().toLowerCase()
  const ranked = useMemo(() => {
    const out = rows
      .filter((r) => !q || r.title.toLowerCase().includes(q) || r.id.toLowerCase().includes(q)
        || (r.hb?.coordinators ?? []).some((c) => c.toLowerCase().includes(q)))
      .filter((r) => !kinds.length || kinds.includes(moduleKind(data, r)))
      .map((r) => {
        const fits = bucket === null || bucketOptions(r).includes(bucket)
        const issue = offeringIssue(r, term)
        return { r, fits, issue, score: goalScore(r.id) }
      })
      .filter((x) => !offeredOnly || x.issue === null)
    out.sort((a, b) => Number(b.fits) - Number(a.fits) || b.score - a.score || a.r.title.localeCompare(b.r.title))
    return out
  }, [rows, q, kinds, offeredOnly, bucket, term, data, weights])
  const fitting = ranked.filter((x) => x.fits)
  const others = ranked.filter((x) => !x.fits)

  const conflictsWith = (r: ModuleRow) => {
    if (term !== CURRENT_TERM || !r.eventIds.length) return false
    const trial = { ...state.selected }
    for (const id of r.eventIds) if (!trial[id]) trial[id] = { enabledSlots: data.events[id].slots.map((_, i) => i), moduleId: r.id, ackFingerprint: '' }
    return findConflicts(trial, data.events).some((c) => r.eventIds.includes(c.a) || r.eventIds.includes(c.b))
  }

  const item = ({ r, issue, score }: (typeof ranked)[number]) => {
    const kind = moduleKind(data, r)
    const placed = entries[r.id]
    const slots = term === CURRENT_TERM
      ? r.eventIds.flatMap((id) => data.events[id]?.slots ?? []).filter((s) => s.day && s.rhythm !== 'single').slice(0, 2)
      : []
    return (
      <li key={r.id} class="result">
        <div class="result-main">
          <a class="result-title" href={panelHref({ kind: 'course', id: r.id })}>{r.title}</a>
          <span class="result-meta">
            {r.ects !== null && <span>{r.ects} ECTS</span>}
            {kind !== 'lecture' && <span class={`tag tag-${kind}`}>{t(lang, `kind.${kind}`)}</span>}
            {issue && <span class="tag tag-warn">{t(lang, `road.warn.${issue}`)}</span>}
            {slots.map((s, i) => <span key={i} class="muted">{fmtSlot(lang, s)}</span>)}
            {conflictsWith(r) && <span class="tag tag-warn"><Icon name="alert" size={12} />{t(lang, 'event.conflict')}</span>}
            {weights && score > 0 && <span class="goal-dots" aria-label={t(lang, 'add.goalFit', { n: Math.min(3, Math.round(score)) })}>
              {'●'.repeat(Math.min(3, Math.max(1, Math.round(score))))}</span>}
          </span>
        </div>
        {placed
          ? <a class="button-quiet" href={panelHref({ kind: 'course', id: r.id })}>{t(lang, 'add.inPlan', { term: termName(lang, placed.term) })}</a>
          : (
            <button type="button" class="button" aria-label={`${t(lang, 'add.add')}: ${r.title}`}
              onClick={() => update((s) => addModuleToTerm(s, data, handbook, r.id, term, row))}>
              <Icon name="plus" size={14} />{t(lang, 'add.add')}
            </button>
          )}
      </li>
    )
  }

  const toggle = (k: Kind) => setKinds(kinds.includes(k) ? kinds.filter((x) => x !== k) : [...kinds, k])
  return (
    <div class="add-course">
      <label class="search-wrap">
        <Icon name="search" />
        <input type="search" class="search" value={query} placeholder={t(lang, 'add.search')} aria-label={t(lang, 'add.search')}
          onInput={(e) => { setQuery((e.target as HTMLInputElement).value); setLimit(PAGE) }} />
      </label>
      <div class="add-filters">
        <fieldset class="chips">
          <legend class="sr-only">{t(lang, 'filter.kind')}</legend>
          {KINDS.map((k) => (
            <button key={k} type="button" class="chip" aria-pressed={kinds.includes(k)} onClick={() => toggle(k)}>{t(lang, `kind.${k}`)}</button>
          ))}
        </fieldset>
        <label class="check">
          <input type="checkbox" checked={offeredOnly} onChange={(e) => setOfferedOnly((e.target as HTMLInputElement).checked)} />
          {t(lang, 'add.offeredOnly', { term: termName(lang, term) })}
        </label>
      </div>
      {fitting.length ? <ul class="plain results">{fitting.slice(0, limit).map(item)}</ul>
        : <p class="empty">{t(lang, 'add.noneFit')}</p>}
      {fitting.length > limit && (
        <button type="button" class="link-button" onClick={() => setLimit(limit + PAGE)}>{t(lang, 'add.more', { n: fitting.length - limit })}</button>
      )}
      {others.length > 0 && (
        <details class="add-others">
          <summary>{t(lang, 'add.others', { n: others.length })}</summary>
          <ul class="plain results">{others.slice(0, PAGE).map(item)}</ul>
        </details>
      )}
    </div>
  )
}
