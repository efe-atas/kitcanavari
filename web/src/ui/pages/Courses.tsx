import { useMemo, useState } from 'preact/hooks'
import { t } from '../../i18n'
import { lensWeights } from '../../logic/career'
import { addConflicts } from '../../logic/conflicts'
import { AREAS, bucketOptions, moduleAreas, moduleKind, type Kind } from '../../logic/degree'
import { EMPTY_HANDBOOK, moduleRows, type ModuleRow } from '../../logic/handbook'
import { rowBucket, type RowId } from '../../logic/matrix'
import { roadmapEntries } from '../../logic/roadmap'
import { highlight, matchScore } from '../../logic/search'
import { CURRENT_TERM, DEFAULT_TERMS, offeringIssue, PRIOR } from '../../logic/terms'
import { addModuleToTerm, restoreModule, setStar, snapshotModule } from '../../store'
import type { CareerData, CoursesFile, Day, HandbookFile, SkillId, UserState } from '../../types'
import { fmtSlot } from '../format'
import { Icon } from '../Icon'
import { rowLabel } from '../plan/labels'
import { termName } from '../roadmap/format'
import { courseHref, pageHref } from '../route'
import { useToast } from '../toast'
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
  starred?: boolean
}

const KINDS: Kind[] = ['lecture', 'stamm', 'seminar', 'practical']
const DAYS: Day[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const PAGE = 30

function Title({ text, query }: { text: string; query: string }) {
  const h = query.trim() ? highlight(text, query) : null
  return h ? <>{h[0]}<mark>{h[1]}</mark>{h[2]}</> : <>{text}</>
}

/** Weekdays a module's courses meet on this term (regular weekly slots only). */
function meetingDays(data: CoursesFile, r: ModuleRow): Set<Day> {
  const out = new Set<Day>()
  for (const id of r.eventIds) for (const s of data.events[id]?.slots ?? []) if (s.day && s.rhythm !== 'single') out.add(s.day)
  return out
}

/** Every module, searchable and filterable, each one a click away from a term of the plan. */
export function Courses({ data, handbook, career, state, update, term: presetTerm, row: presetRow, filter, starred: presetStarred }: Props) {
  const { lang } = state
  const toast = useToast()
  const terms = state.roadmap?.terms ?? DEFAULT_TERMS
  const [term, setTerm] = useState(presetTerm ?? CURRENT_TERM)
  const [row, setRow] = useState<RowId | null>(presetRow)
  const [query, setQuery] = useState('')
  const [kinds, setKinds] = useState<Kind[]>(filter ? [filter] : [])
  const [area, setArea] = useState('')
  const [offeredOnly, setOfferedOnly] = useState(true)
  const [freeDays, setFreeDays] = useState<Day[]>([])
  const [fitsWeek, setFitsWeek] = useState(false)
  const [starredOnly, setStarredOnly] = useState(!!presetStarred)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sort, setSort] = useState('recommended')
  const [limit, setLimit] = useState(PAGE)
  const rows = useMemo(() => moduleRows(data, handbook ?? EMPTY_HANDBOOK), [data, handbook])
  const entries = roadmapEntries(state)
  const stars = state.starred ?? []
  const bucket = row ? rowBucket(state, row) : null
  const rowChoices: RowId[] = (['area0', 'area1', 'elective', 'minor', 'iq'] as RowId[]).filter((r) => r.startsWith('area') ? !!rowBucket(state, r) : true)
  const now = term === CURRENT_TERM

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
  const conflictsWith = (r: ModuleRow) => now && addConflicts(state.selected, data.events, r.id, r.eventIds).length > 0

  const ranked = useMemo(() => {
    const out = rows
      .map((r) => ({ r, match: matchScore(r, query) }))
      .filter(({ r, match }) => match > 0
        && (!kinds.length || kinds.includes(moduleKind(data, r)))
        && (!area || moduleAreas(r).includes(area))
        && (!starredOnly || stars.includes(r.id)))
      .map(({ r, match }) => {
        const fits = bucket === null || bucketOptions(r).includes(bucket)
        const issue = offeringIssue(r, term)
        return { r, fits, issue, match, score: goalScore(r.id) }
      })
      .filter((x) => (!offeredOnly || term === PRIOR || x.issue === null)
        && (!now || !freeDays.length || ![...meetingDays(data, x.r)].some((d) => freeDays.includes(d)))
        && (!now || !fitsWeek || !conflictsWith(x.r)))
    out.sort((a, b) => Number(b.fits) - Number(a.fits)
      || (sort === 'credits' ? (b.r.ects ?? 0) - (a.r.ects ?? 0) : sort === 'name' ? 0 : (query.trim() ? b.match - a.match : 0) || b.score - a.score)
      || a.r.title.localeCompare(b.r.title))
    return out
  }, [rows, query, kinds, area, offeredOnly, bucket, term, data, weights, sort, freeDays, fitsWeek, starredOnly, state])
  const fitting = ranked.filter((x) => x.fits)
  const others = ranked.filter((x) => !x.fits)

  const add = (r: ModuleRow) => {
    const snap = snapshotModule(state, r.id)
    update((s) => addModuleToTerm(s, data, handbook, r.id, term, row ?? undefined))
    toast({
      message: t(lang, 'journey.added', { title: r.title }), tone: 'success',
      link: { label: t(lang, 'journey.viewPlan'), href: pageHref({ kind: 'plan' }) },
      action: { label: t(lang, 'toast.undo'), run: () => update((s) => restoreModule(s, r.id, snap)) },
    })
  }

  const item = ({ r, issue, score }: (typeof ranked)[number]) => {
    const kind = moduleKind(data, r)
    const placed = entries[r.id]
    const isStar = stars.includes(r.id)
    const slots = now
      ? r.eventIds.flatMap((id) => data.events[id]?.slots ?? []).filter((s) => s.day && s.rhythm !== 'single').slice(0, 3)
      : []
    const dots = weights && score > 0 ? Math.min(3, Math.max(1, Math.round(score))) : 0
    return (
      <li key={r.id} class="result">
        <span class={`result-symbol kind-${kind}`} aria-hidden="true"><Icon name={kind === 'seminar' ? 'users' : kind === 'practical' ? 'compass' : kind === 'stamm' ? 'cap' : 'book'} size={20} /></span>
        <div class="result-main">
          <a class="result-title" href={courseHref(r.id)}><Title text={r.title} query={query} /></a>
          <span class="result-meta">
            <span class="result-id">{r.id}</span>
            {kind !== 'lecture' && <span class={`tag tag-${kind}`}>{t(lang, `kind.${kind}`)}</span>}
            {issue && <span class="tag tag-warn">{t(lang, `road.warn.${issue}`)}</span>}
            {conflictsWith(r) && <span class="tag tag-danger"><Icon name="alert" size={12} />{t(lang, 'event.conflict')}</span>}
            {dots > 0 && <span class="goal-dots" role="img" aria-label={t(lang, 'add.goalFit', { n: dots })}>
              {[1, 2, 3].map((i) => <i key={i} class={i <= dots ? 'is-on' : ''} />)}</span>}
          </span>
          {slots.length > 0 && <span class="result-times"><Icon name="clock" size={13} />{slots.map((s) => fmtSlot(lang, s)).join(' · ')}</span>}
        </div>
        <span class="result-credit"><strong>{r.ects ?? '—'}</strong><small>ECTS</small></span>
        <div class="result-actions">
          <button type="button" class={`icon-button star-toggle${isStar ? ' is-on' : ''}`} aria-pressed={isStar}
            aria-label={t(lang, isStar ? 'star.remove' : 'star.add', { title: r.title })} onClick={() => update((s) => setStar(s, r.id, !isStar))}>
            <Icon name="star" size={18} filled={isStar} />
          </button>
          {placed
            ? <a class="result-placed" href={courseHref(r.id)}><Icon name="check" size={14} />{t(lang, 'add.inPlan', { term: termName(lang, placed.term) })}</a>
            : (
              <button type="button" class="button-quiet add-button" aria-label={`${t(lang, 'add.add')}: ${r.title}`} onClick={() => add(r)}>
                <Icon name="plus" size={14} />{t(lang, 'add.add')}
              </button>
            )}
        </div>
      </li>
    )
  }

  const toggle = <T,>(list: T[], x: T) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x])
  const resetFilters = () => {
    setQuery(''); setKinds([]); setRow(null); setOfferedOnly(true); setArea(''); setFreeDays([]); setFitsWeek(false); setStarredOnly(false); setLimit(PAGE)
  }
  const active: { key: string; label: string; clear: () => void }[] = [
    ...(query.trim() ? [{ key: 'q', label: `“${query.trim()}”`, clear: () => setQuery('') }] : []),
    ...(row ? [{ key: 'row', label: rowLabel(lang, state, row), clear: () => setRow(null) }] : []),
    ...kinds.map((k) => ({ key: `k-${k}`, label: t(lang, `kind.${k}`), clear: () => setKinds(kinds.filter((x) => x !== k)) })),
    ...(area ? [{ key: 'area', label: area, clear: () => setArea('') }] : []),
    ...(now ? freeDays.map((d) => ({ key: `d-${d}`, label: t(lang, 'cs.freeDay', { day: t(lang, `day.${d}`) }), clear: () => setFreeDays(freeDays.filter((x) => x !== d)) })) : []),
    ...(now && fitsWeek ? [{ key: 'fits', label: t(lang, 'cs.fitsWeek'), clear: () => setFitsWeek(false) }] : []),
    ...(starredOnly ? [{ key: 'star', label: t(lang, 'cs.starred'), clear: () => setStarredOnly(false) }] : []),
    ...(!offeredOnly && term !== PRIOR ? [{ key: 'offered', label: t(lang, 'cs.allTerms'), clear: () => setOfferedOnly(true) }] : []),
  ]
  const activeCount = active.length

  return (
    <div class="courses">
      <PageHead title={t(lang, 'nav.courses')} lead={t(lang, 'page.courses.lead', { n: rows.length })}>
        <a class="button-quiet" href={pageHref({ kind: 'plan' })}><Icon name="plan" size={16} />{t(lang, 'journey.viewPlan')}</a>
      </PageHead>

      <div class="catalog-workspace">
        <label class="search-wrap">
          <Icon name="search" />
          <input type="search" class="search" value={query} placeholder={t(lang, 'add.search')} aria-label={t(lang, 'add.search')} data-page-search
            onInput={(e) => { setQuery((e.target as HTMLInputElement).value); setLimit(PAGE) }} />
          {!query && <kbd aria-hidden="true">/</kbd>}
        </label>
        <button type="button" class="mobile-filter-toggle button-quiet" aria-expanded={filtersOpen} aria-controls="catalog-filters" onClick={() => setFiltersOpen(!filtersOpen)}>
          <Icon name="filter" size={16} />{t(lang, 'v2.filters')}{activeCount > 0 && <span class="count-badge is-accent">{activeCount}</span>}<span>{termName(lang, term)}</span>
        </button>
        <aside id="catalog-filters" class={`catalog-sidebar${filtersOpen ? ' is-open' : ''}`}>
          <section class="finder" aria-label={t(lang, 'cs.filters')}>
            <h2><Icon name="filter" size={17} />{t(lang, 'v2.filters')}</h2>
            <div class="finder-group">
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
            <fieldset class="finder-group">
              <legend>{t(lang, 'filter.kind')}</legend>
              <div class="chips">
                {KINDS.map((k) => (
                  <button key={k} type="button" class="chip" aria-pressed={kinds.includes(k)} onClick={() => { setKinds(toggle(kinds, k)); setLimit(PAGE) }}>{t(lang, `kind.${k}`)}</button>
                ))}
              </div>
            </fieldset>
            <label class="field finder-group">
              <span>{t(lang, 'cs.area')}</span>
              <select value={area} onChange={(e) => { setArea((e.target as HTMLSelectElement).value); setLimit(PAGE) }}>
                <option value="">{t(lang, 'cs.anyArea')}</option>
                {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
            {now && (
              <fieldset class="finder-group">
                <legend>{t(lang, 'cs.freeDays')}</legend>
                <div class="chips day-chips">
                  {DAYS.map((d) => (
                    <button key={d} type="button" class="chip" aria-pressed={freeDays.includes(d)} aria-label={t(lang, 'cs.freeDay', { day: t(lang, `day.full.${d}`) })}
                      onClick={() => { setFreeDays(toggle(freeDays, d)); setLimit(PAGE) }}>{t(lang, `day.${d}`)}</button>
                  ))}
                </div>
              </fieldset>
            )}
            <div class="finder-group finder-switches">
              {term !== PRIOR && (
                <label class="switch"><input type="checkbox" checked={offeredOnly} onChange={(e) => setOfferedOnly((e.target as HTMLInputElement).checked)} />
                  {t(lang, 'cs.offeredOnly', { term: termName(lang, term) })}</label>
              )}
              {now && (
                <label class="switch"><input type="checkbox" checked={fitsWeek} onChange={(e) => setFitsWeek((e.target as HTMLInputElement).checked)} />
                  {t(lang, 'cs.fitsWeek')}</label>
              )}
              <label class="switch"><input type="checkbox" checked={starredOnly} onChange={(e) => setStarredOnly((e.target as HTMLInputElement).checked)} />
                {t(lang, 'cs.starred')}{stars.length > 0 && <span class="muted"> ({stars.length})</span>}</label>
            </div>
          </section>
          <div class="catalog-destination"><Icon name="plan" size={20} /><span>{t(lang, 'v2.destination')}</span><strong>{termName(lang, term)}</strong>
            <a href={pageHref({ kind: 'plan' })}>{t(lang, 'journey.viewPlan')}<Icon name="arrow" size={15} /></a></div>
        </aside>
        <section class="catalog-results" aria-label={t(lang, 'nav.courses')}>
          <div class="results-heading">
            <p class="result-count" aria-live="polite">{t(lang, 'cs.count', { n: fitting.length })}</p>
            <label class="sort-control"><span>{t(lang, 'v2.sort')}</span>
              <select value={sort} aria-label={t(lang, 'v2.sort')} onChange={(e) => setSort((e.target as HTMLSelectElement).value)}>
                <option value="recommended">{t(lang, 'v2.recommended')}</option><option value="name">{t(lang, 'v2.byName')}</option><option value="credits">{t(lang, 'v2.byCredits')}</option>
              </select>
            </label>
          </div>
          {activeCount > 0 && (
            <div class="active-filters">
              {active.map((f) => (
                <button key={f.key} type="button" class="chip is-removable" onClick={() => { f.clear(); setLimit(PAGE) }} aria-label={t(lang, 'cs.removeFilter', { f: f.label })}>
                  {f.label}<Icon name="close" size={13} />
                </button>
              ))}
              <button class="button-ghost is-small" type="button" onClick={resetFilters}>{t(lang, 'filter.reset')}</button>
            </div>
          )}
          {fitting.length ? <ul class="plain results">{fitting.slice(0, limit).map(item)}</ul>
            : <div class="empty-results"><Icon name="search" size={24} /><h2>{t(lang, 'add.noneFit')}</h2><p>{t(lang, 'journey.noResults')}</p>
              <button type="button" class="button-quiet" onClick={resetFilters}>{t(lang, 'filter.reset')}</button></div>}
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
