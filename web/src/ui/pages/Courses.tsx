import { useMemo, useState } from 'preact/hooks'
import { t } from '../../i18n'
import { lensWeights } from '../../logic/career'
import { findConflicts } from '../../logic/conflicts'
import { bucketOptions, moduleKind, type Kind } from '../../logic/degree'
import { EMPTY_HANDBOOK, moduleRows, type ModuleRow } from '../../logic/handbook'
import { rowBucket, type RowId } from '../../logic/matrix'
import { roadmapEntries } from '../../logic/roadmap'
import { CURRENT_TERM, DEFAULT_TERMS, offeringIssue, PRIOR } from '../../logic/terms'
import { addModuleToTerm } from '../../store'
import type { CareerData, CoursesFile, HandbookFile, SkillId, UserState } from '../../types'
import { fmtSlot } from '../format'
import { Icon } from '../Icon'
import { rowLabel } from '../plan/labels'
import { termName } from '../roadmap/format'
import { courseHref, pageHref } from '../route'
import { PageHead } from './PageHead'

interface Props {
  data: CoursesFile
  handbook: HandbookFile | null
  career: CareerData | null
  state: UserState
  update: (fn: (s: UserState) => UserState) => void
  /** Preset by the link that led here ("add a seminar to SS 27"). */
  term: string | null
  row: RowId | null
  filter: Kind | null
}

const KINDS: Kind[] = ['lecture', 'stamm', 'seminar', 'practical']
const PAGE = 30

/** Every module, searchable, each one a click away from a term of the plan. */
export function Courses({ data, handbook, career, state, update, term: presetTerm, row: presetRow, filter }: Props) {
  const { lang } = state
  const terms = state.roadmap?.terms ?? DEFAULT_TERMS
  const [term, setTerm] = useState(presetTerm ?? CURRENT_TERM)
  const [row, setRow] = useState<RowId | null>(presetRow)
  const [query, setQuery] = useState('')
  const [kinds, setKinds] = useState<Kind[]>(filter ? [filter] : [])
  const [offeredOnly, setOfferedOnly] = useState(true)
  const [added, setAdded] = useState<string | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sort, setSort] = useState('recommended')
  const [limit, setLimit] = useState(PAGE)
  const rows = useMemo(() => moduleRows(data, handbook ?? EMPTY_HANDBOOK), [data, handbook])
  const entries = roadmapEntries(state)
  const bucket = row ? rowBucket(state, row) : null
  const rowChoices: RowId[] = (['area0', 'area1', 'elective', 'minor', 'iq'] as RowId[]).filter((r) => r.startsWith('area') ? !!rowBucket(state, r) : true)

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
    out.sort((a, b) => Number(b.fits) - Number(a.fits) || (sort === 'credits' ? (b.r.ects ?? 0) - (a.r.ects ?? 0) : sort === 'name' ? 0 : b.score - a.score) || a.r.title.localeCompare(b.r.title))
    return out
  }, [rows, q, kinds, offeredOnly, bucket, term, data, weights, sort])
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
    const dots = weights && score > 0 ? Math.min(3, Math.max(1, Math.round(score))) : 0
    return (
      <li key={r.id} class="result"><span class="result-symbol" aria-hidden="true"><Icon name={kind === 'seminar' ? 'briefcase' : kind === 'practical' ? 'compass' : 'book'} size={22} /></span>
        <div class="result-main">
          <a class="result-title" href={courseHref(r.id)}>{r.title}</a>
          <span class="result-meta">

            {kind !== 'lecture' && <span class={`tag tag-${kind}`}>{t(lang, `kind.${kind}`)}</span>}
            {issue && <span class="tag tag-warn">{t(lang, `road.warn.${issue}`)}</span>}
            {conflictsWith(r) && <span class="tag tag-danger"><Icon name="alert" size={12} />{t(lang, 'event.conflict')}</span>}
            {dots > 0 && <span class="goal-dots" aria-label={t(lang, 'add.goalFit', { n: dots })}>
              {[1, 2, 3].map((i) => <i key={i} class={i <= dots ? 'is-on' : ''} />)}</span>}
          </span>
          {slots.length > 0 && <span class="result-times">{slots.map((s) => fmtSlot(lang, s)).join('; ')}</span>}
        </div>
        <span class="result-credit"><strong>{r.ects ?? '—'}</strong><small>ECTS</small></span>
        {placed
          ? <a class="result-placed" href={courseHref(r.id)}><Icon name="check" size={14} />{t(lang, 'add.inPlan', { term: termName(lang, placed.term) })}</a>
          : (
            <button type="button" class="button-quiet add-button" aria-label={`${t(lang, 'add.add')}: ${r.title}`}
              onClick={() => { update((s) => addModuleToTerm(s, data, handbook, r.id, term, row ?? undefined)); setAdded(r.title) }}>
              <Icon name="plus" size={14} />{t(lang, 'add.add')}
            </button>
          )}
      </li>
    )
  }

  const toggle = (k: Kind) => { setKinds(kinds.includes(k) ? kinds.filter((x) => x !== k) : [...kinds, k]); setLimit(PAGE) }
  const resetFilters = () => { setQuery(''); setKinds([]); setRow(null); setOfferedOnly(true); setLimit(PAGE) }
  return (
    <div class="courses">
      <PageHead title={t(lang, 'nav.courses')} lead={t(lang, 'page.courses.lead', { n: rows.length })}>
        <a class="button-quiet" href={pageHref({ kind: 'plan' })}><Icon name="plan" size={16} />{t(lang, 'journey.viewPlan')}</a>
      </PageHead>

      <div class="catalog-workspace">
        <label class="search-wrap">
          <Icon name="search" />
          <input type="search" class="search" value={query} placeholder={t(lang, 'add.search')} aria-label={t(lang, 'add.search')}
            onInput={(e) => { setQuery((e.target as HTMLInputElement).value); setLimit(PAGE) }} />
        </label>
      <button type="button" class="mobile-filter-toggle button-quiet" aria-expanded={filtersOpen} aria-controls="catalog-filters" onClick={() => setFiltersOpen(!filtersOpen)}><Icon name="filter" size={16} />{t(lang, 'v2.filters')}<span>{termName(lang, term)}</span></button>
      <aside id="catalog-filters" class={`catalog-sidebar${filtersOpen ? ' is-open' : ''}`}>
      <section class="finder" aria-label={t(lang, 'cs.filters')}>
        <h2><Icon name="filter" size={18} />{t(lang, 'v2.filters')}</h2>
        <div class="finder-target">
          <label class="field">
            <span>{t(lang, 'cs.term')}</span>
            <select value={term} onChange={(e) => { setTerm((e.target as HTMLSelectElement).value); setLimit(PAGE) }}>
              {[PRIOR, ...terms].map((x) => <option key={x} value={x}>{termName(lang, x)}</option>)}
            </select>
          </label>
          <label class="field">
            <span>{t(lang, 'cs.row')}</span>
            <select value={row ?? ''} onChange={(e) => { setRow(((e.target as HTMLSelectElement).value || null) as RowId | null); setLimit(PAGE) }}>
              <option value="">{t(lang, 'cs.anyRow')}</option>
              {rowChoices.map((x) => <option key={x} value={x}>{rowLabel(lang, state, x)}</option>)}
            </select>
          </label>
        </div>

        <div class="finder-filters">
          <fieldset class="chips">
            <legend class="sr-only">{t(lang, 'filter.kind')}</legend>
            {KINDS.map((k) => (
              <button key={k} type="button" class="chip" aria-pressed={kinds.includes(k)} onClick={() => toggle(k)}>{t(lang, `kind.${k}`)}</button>
            ))}
          </fieldset>
          {term !== PRIOR && (
            <label class="check">
              <input type="checkbox" checked={offeredOnly} onChange={(e) => setOfferedOnly((e.target as HTMLInputElement).checked)} />
              {t(lang, 'cs.offeredOnly', { term: termName(lang, term) })}
            </label>
          )}
        </div>
      </section>
      <div class="catalog-destination"><Icon name="plan" size={22} /><span>{t(lang, 'v2.destination')}</span><strong>{termName(lang, term)}</strong><a href={pageHref({ kind: 'plan' })}>{t(lang, 'journey.viewPlan')}<Icon name="arrow" size={16} /></a></div>
      </aside>
      <section class="catalog-results" aria-label={t(lang, 'nav.courses')}>
      <div class="results-heading"><label class="sort-control"><span>{t(lang, 'v2.sort')}</span><select value={sort} onChange={(e) => setSort((e.target as HTMLSelectElement).value)}><option value="recommended">{t(lang, 'v2.recommended')}</option><option value="name">{t(lang, 'v2.byName')}</option><option value="credits">{t(lang, 'v2.byCredits')}</option></select></label><p class="result-count" aria-live="polite">{t(lang, 'cs.count', { n: fitting.length })}</p>
        {(query || kinds.length > 0 || row || !offeredOnly) && <button class="button-quiet" type="button" onClick={resetFilters}>{t(lang, 'filter.reset')}</button>}
      </div>
      {added && <div class="selection-feedback" role="status"><Icon name="check" size={18} /><span>{t(lang, 'journey.added', { title: added })}</span><a href={pageHref({ kind: 'plan' })}>{t(lang, 'journey.viewPlan')}<Icon name="chevron" size={14} /></a></div>}
      {fitting.length ? <ul class="plain results">{fitting.slice(0, limit).map(item)}</ul>
        : <div class="empty-results"><Icon name="search" size={24} /><h2>{t(lang, 'add.noneFit')}</h2><p>{t(lang, 'journey.noResults')}</p><button type="button" class="button-quiet" onClick={resetFilters}>{t(lang, 'filter.reset')}</button></div>}
      {fitting.length > limit && (
        <button type="button" class="button-quiet more-button" onClick={() => setLimit(limit + PAGE)}>{t(lang, 'add.more', { n: fitting.length - limit })}</button>
      )}
      {others.length > 0 && (
        <details class="others">
          <summary>{t(lang, 'add.others', { n: others.length })}</summary>
          <ul class="plain results">{others.slice(0, PAGE).map(item)}</ul>
        </details>
      )}
      </section>
      </div>
    </div>
  )
}
