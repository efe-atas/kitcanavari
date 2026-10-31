import { useMemo, useState } from 'preact/hooks'
import { t } from '../../i18n'
import { fit } from '../../logic/career'
import { pathRole } from '../../logic/careerPlus'
import { AREAS, moduleKind, RULES, roadmapReport, type Kind, type RoadmapReport } from '../../logic/degree'
import { EMPTY_HANDBOOK, moduleRows } from '../../logic/handbook'
import { forecast, gradeOutlook, projectedAverage } from '../../logic/insights'
import { matrixCells, type CellItem, type Matrix, type RowId } from '../../logic/matrix'
import { nextTerm } from '../../logic/nextSteps'
import { roadmapEntries } from '../../logic/roadmap'
import { CURRENT_TERM } from '../../logic/terms'
import { setArea, setStar } from '../../store'
import type { CareerData, CoursesFile, HandbookFile, Lang, UserState } from '../../types'
import { pathTitle, pointsOf } from '../career/model'
import { TermLink } from '../glossary/GlossaryView'
import { Icon } from '../Icon'
import { DeadlineForm, DeadlineList, upcoming } from '../deadlines/Deadlines'
import { Outlook } from '../overview/Outlook'
import { TermChart } from '../overview/TermChart'
import { longDate, TodayCard, useNow } from '../overview/TodayCard'
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
}

const fmtNum = (lang: Lang, n: number) => String(n).replace('.', lang === 'en' ? '.' : ',')

/** 120 marks, one per ECTS: passed, planned, still open, and the thesis at the end. */
function CreditRuler({ lang, passed, planned }: { lang: Lang; passed: number; planned: number }) {
  const modules = RULES.total - RULES.thesis
  const p = Math.min(passed, modules)
  const q = Math.min(passed + planned, modules)
  const marks = Array.from({ length: RULES.total }, (_, i) => (i < p ? 'passed' : i < q ? 'planned' : i < modules ? 'open' : 'thesis'))
  return (
    <div class="credit-map" role="img" aria-label={t(lang, 'ov.rulerLabel', { passed: p, planned: q - p, open: modules - q, thesis: RULES.thesis })}>
      {marks.map((m, i) => <i key={i} class={`credit-unit is-${m}`} />)}
    </div>
  )
}

interface Req {
  id: string
  label: string
  term?: string
  rule: string
  have: number
  need: number
  done: boolean
  /** Shown under the rule when the row is missing something specific. */
  gap?: string
  add?: { row: RowId; kind?: Kind; label: string }
  area?: 0 | 1
}

function requirements(lang: Lang, s: UserState, report: RoadmapReport, matrix: Matrix): Req[] {
  const r = report.all
  const areas = s.areas ?? []
  const out: Req[] = []
  ;([0, 1] as const).forEach((slot) => {
    const row: RowId = slot === 0 ? 'area0' : 'area1'
    const a = r.areas.find((x) => x.area === areas[slot])
    const tot = matrix.rowTotals[row]
    const cp = a?.cp ?? 0
    const lectureCp = a?.lectureCp ?? 0
    const lectureMin = a?.lectureMin ?? RULES.areaLectureMin
    const lectureShort = lectureCp < lectureMin
    out.push({
      id: row, area: slot, label: t(lang, slot === 0 ? 'plan.area1' : 'plan.area2'), term: slot === 0 ? 'area' : undefined,
      rule: t(lang, 'ov.rule.area', { min: RULES.areaMin, lec: lectureMin }),
      have: cp, need: tot.min, done: !!areas[slot] && cp >= RULES.areaMin && !lectureShort,
      gap: areas[slot] && lectureShort && cp >= RULES.areaMin ? t(lang, 'plan.lectures', { n: lectureCp, min: lectureMin }) : undefined,
      add: areas[slot] ? { row, kind: lectureShort && cp >= RULES.areaMin ? 'lecture' : undefined, label: t(lang, 'ov.add') } : undefined,
    })
  })
  out.push({
    id: 'stamm', label: t(lang, 'deg.stamm'), term: 'stamm', rule: t(lang, 'ov.rule.stamm', { n: RULES.stamm }),
    have: r.stamm.count, need: RULES.stamm, done: r.stamm.count >= RULES.stamm,
    add: { row: 'elective', kind: 'stamm', label: t(lang, 'ov.add') },
  })
  const sp = r.seminarCp + r.practicalCp
  const semShort = r.seminarCp < RULES.seminarMin
  const pracShort = r.practicalCp < RULES.practicalMin
  out.push({
    id: 'sp', label: t(lang, 'plan.spLabel'), term: 'seminar',
    rule: t(lang, 'ov.rule.sp', { min: RULES.spMin, max: RULES.spMax, sem: RULES.seminarMin, prac: RULES.practicalMin }),
    have: sp, need: RULES.spMin, done: sp >= RULES.spMin && !semShort && !pracShort,
    gap: semShort || pracShort ? t(lang, 'ov.spGap', { sem: r.seminarCp, semMin: RULES.seminarMin, prac: r.practicalCp, pracMin: RULES.practicalMin }) : undefined,
    add: semShort ? { row: 'elective', kind: 'seminar', label: t(lang, 'step.add.seminar') }
      : pracShort ? { row: 'elective', kind: 'practical', label: t(lang, 'step.add.practical') }
      : { row: 'elective', label: t(lang, 'ov.add') },
  })
  out.push({
    id: 'elective', label: t(lang, 'plan.row.elective'), term: 'elective', rule: t(lang, 'ov.rule.range', { min: RULES.electiveMin, max: RULES.electiveMax }),
    have: r.electiveCp, need: RULES.electiveMin, done: r.electiveCp >= RULES.electiveMin, add: { row: 'elective', label: t(lang, 'ov.add') },
  })
  out.push({
    id: 'iq', label: t(lang, 'plan.row.iq'), rule: t(lang, 'ov.rule.iq', { min: RULES.iqMin, max: RULES.iqMax }),
    have: r.iqCp, need: RULES.iqMin, done: r.iqCp >= RULES.iqMin, add: { row: 'iq', label: t(lang, 'ov.add') },
  })
  if (r.minorCp > 0) {
    out.push({
      id: 'minor', label: t(lang, 'plan.row.minor'), term: 'minor', rule: t(lang, 'ov.rule.range', { min: RULES.minorMin, max: RULES.minorMax }),
      have: r.minorCp, need: RULES.minorMin, done: r.minorCp >= RULES.minorMin, add: { row: 'minor', label: t(lang, 'ov.add') },
    })
  }
  return out
}

function AreaSelect({ lang, state, slot, update, label }: { lang: Lang; state: UserState; slot: 0 | 1; update: Props['update']; label: string }) {
  const chosen = state.areas ?? []
  return (
    <select class="area-select" id={`area-select-${slot}`} aria-label={label} value={chosen[slot] ?? ''} disabled={slot === 1 && !chosen[0]}
      onChange={(e) => update((s) => setArea(s, slot, (e.target as HTMLSelectElement).value || null))}>
      <option value="">{t(lang, 'ov.pickArea')}</option>
      {AREAS.filter((a) => a === chosen[slot] || !chosen.includes(a)).map((a) => <option key={a} value={a}>{a}</option>)}
    </select>
  )
}

export function Overview({ data, handbook, career, state, update }: Props) {
  const { lang } = state
  const now = useNow()
  const report = useMemo(() => roadmapReport(state, data, handbook), [state, data, handbook])
  const matrix = useMemo(() => matrixCells(state, data, handbook), [state, data, handbook])
  const outlook = useMemo(() => ({ forecast: forecast(state, data, handbook), grades: gradeOutlook(state, data, handbook), projected: projectedAverage(state, data, handbook) }), [state, data, handbook])
  const [adding, setAdding] = useState(false)
  const rows = useMemo(() => moduleRows(data, handbook ?? EMPTY_HANDBOOK), [data, handbook])
  const reqs = requirements(lang, state, report, matrix)
  const target = nextTerm(state)
  const passed = report.done.total
  const planned = report.all.total - passed
  const open = Math.max(0, RULES.total - RULES.thesis - report.all.total)
  const missing = reqs.filter((r) => !r.done).length
  const areasMissing = (state.areas ?? []).length < 2
  const entries = roadmapEntries(state)

  const nowItems: (CellItem & { row: RowId })[] = (Object.keys(matrix.cells) as RowId[])
    .flatMap((row) => (matrix.cells[row][CURRENT_TERM] ?? []).map((it) => ({ ...it, row })))
  const termCp = nowItems.filter((it) => it.status === 'passed' || it.status === 'planned').reduce((n, it) => n + (it.ects ?? 0), 0)

  const goal = useMemo(() => {
    if (!career) return null
    const f = (state.followed ?? []).find((x) => career.lenses.lenses.some((l) => l.id === x.lens))
    if (!f) return { title: null, n: 0, href: pageHref({ kind: 'career', focus: null }) }
    const lens = career.lenses.lenses.find((l) => l.id === f.lens)!
    const n = fit(pointsOf(state, career, rows).all, pathRole(career, f.role, lens), lens)
    const hasRole = career.roles.roles.some((r) => r.id === f.role)
    return { title: pathTitle(career, hasRole ? f.role : 'environment', f.lens, lang), n, href: pageHref({ kind: 'career', focus: hasRole ? `${f.role}:${f.lens}` : f.lens }) }
  }, [career, state, rows, lang])
  const starred = (state.starred ?? []).map((id) => rows.find((r) => r.id === id)).filter((r): r is (typeof rows)[number] => !!r)

  const areasCard = (
    <section class={`card areas-card${areasMissing ? ' is-setup' : ''}`} aria-labelledby="foundation-title">
      <header class="card-head">
        <div>
          {areasMissing && <p class="eyebrow">{t(lang, 'ov.setupEyebrow')}</p>}
          <h2 id="foundation-title">{t(lang, 'journey.areas')}</h2>
          <p>{t(lang, 'v2.areaLead')}</p>
        </div>
        <Icon name="compass" size={22} />
      </header>
      <div class="specialization-fields">{([0, 1] as const).map((slot) => (
        <label class="field" key={slot}><span>{t(lang, slot === 0 ? 'plan.area1' : 'plan.area2')}</span>
          <AreaSelect lang={lang} state={state} slot={slot} update={update} label={t(lang, slot === 0 ? 'plan.area1' : 'plan.area2')} /></label>
      ))}</div>
      <a class="text-action" href={pageHref({ kind: 'help', id: 'guide' })}>{t(lang, 'journey.rules')}<Icon name="arrow" size={15} /></a>
    </section>
  )

  return (
    <div class="overview">
      <PageHead title={t(lang, now.minutes < 11 * 60 ? 'ov.hello.morning' : now.minutes < 18 * 60 ? 'ov.hello.day' : 'ov.hello.evening')} lead={t(lang, 'ov.lead', { date: longDate(lang, now.date), term: termName(lang, CURRENT_TERM) })}>
        <a class="button-quiet" href={pageHref({ kind: 'week' })}><Icon name="calendar" size={16} />{t(lang, 'nav.week')}</a>
        <a class="button" href={pageHref({ kind: 'courses', term: CURRENT_TERM, row: null, filter: null })}><Icon name="plus" size={16} />{t(lang, 'pl.add')}</a>
      </PageHead>

      {areasMissing && areasCard}

      <div class="dashboard">
        <div class="dash-today"><TodayCard lang={lang} data={data} state={state} /></div>

        <section class="degree-surface dash-credits" aria-labelledby="ledger-title">
          <div class="surface-heading"><h2 id="ledger-title">{t(lang, 'ov.credits')}</h2><Icon name="overview" size={20} /></div>
          <div class="degree-total"><strong>{report.all.total}</strong><span>/ {RULES.total}<small>ECTS</small></span></div>
          <CreditRuler lang={lang} passed={passed} planned={planned} />
          <ul class="plain credit-key"><li><i class="is-passed" />{t(lang, 'ov.legend.passed', { n: passed })}</li><li><i class="is-planned" />{t(lang, 'ov.legend.planned', { n: planned })}</li><li><i class="is-open" />{t(lang, 'ov.legend.open', { n: open })}</li><li><i class="is-thesis" />{t(lang, 'ov.legend.thesis', { n: RULES.thesis })}</li></ul>
          {report.gpa !== null && <p class="degree-gpa"><span>{t(lang, 'plan.gpa', { cp: report.gradedCp })}</span><strong>{fmtNum(lang, report.gpa)}</strong></p>}
          <a class="degree-link" href={pageHref({ kind: 'plan' })}>{t(lang, 'journey.viewPlan')}<Icon name="arrow" size={16} /></a>
        </section>

        <section class="card reqs-card dash-reqs" aria-labelledby="reqs-title">
          <header class="card-head">
            <div>
              <h2 id="reqs-title">{t(lang, 'ov.reqs')}</h2>
              <p>{t(lang, 'v2.auditLead')}</p>
            </div>
            <span class={`reqs-score${missing ? ' is-missing' : ''}`}><strong>{reqs.length - missing}</strong> / {reqs.length}</span>
          </header>
          <p class={missing ? 'reqs-count is-missing' : 'reqs-count'}>
            {missing ? t(lang, 'ov.missing', { n: missing, total: reqs.length }) : t(lang, 'step.done')}
          </p>
          <ul class="plain req-list">
            {reqs.map((r) => (
              <li key={r.id} class={`req-row${r.done ? ' is-done' : ' is-missing'}`}>
                <span class="req-mark" aria-hidden="true">{r.done ? <Icon name="check" size={12} /> : null}</span>
                <span class="req-label">{r.label}{r.term && <TermLink id={r.term} lang={lang} />}</span>
                <span class="req-value"><strong>{r.have}</strong> / {r.need}
                  <span class="sr-only">{r.done ? t(lang, 'ov.met') : t(lang, 'ov.notMet')}</span></span>
                <span class={`meter req-meter${r.done ? ' is-done' : ''}`} aria-hidden="true"><span style={{ width: `${Math.min(100, r.need ? (r.have / r.need) * 100 : 100)}%` }} /></span>
                {!r.done && r.add && (
                  <span class="req-action">
                    <a class="button-ghost is-small" href={pageHref({ kind: 'courses', term: target, row: r.add.row, filter: r.add.kind ?? null })}
                      aria-label={`${r.add.label}: ${r.label}`}>
                      <Icon name="plus" size={14} />{r.add.label}
                    </a>
                  </span>
                )}
                <div class="req-body">
                  {r.area !== undefined && <span class="req-area">{state.areas?.[r.area] ?? t(lang, 'ov.pickArea')}</span>}
                  {!r.done && <span class="req-rule">{r.rule}</span>}
                  {r.gap && <span class="req-gap">{r.gap}</span>}
                </div>
              </li>
            ))}
            <li class="req-row is-info">
              <span class="req-mark" aria-hidden="true" />
              <span class="req-label">{t(lang, 'ov.thesis')}</span>
              <span class="req-value"><strong>{RULES.thesis}</strong> ECTS</span>
              <div class="req-body"><span class="req-rule">{t(lang, 'ov.rule.thesis')}</span></div>
            </li>
          </ul>
          {(report.all.issues.length > 0 || report.unknown.length > 0) && (
            <ul class="plain issue-list">
              {report.all.issues.map((x, i) => <li key={i}><Icon name="alert" size={16} />{t(lang, x.key, x.params)}</li>)}
              {report.unknown.length > 0 && <li><Icon name="alert" size={16} />{t(lang, 'road.unknownList', { ids: report.unknown.join(', ') })}</li>}
            </ul>
          )}
        </section>

        <div class="dash-outlook"><Outlook lang={lang} forecast={outlook.forecast} grades={outlook.grades} projected={outlook.projected} /></div>

        <section class="card term-card dash-term" aria-labelledby="now-title">
          <header class="card-head">
            <div><h2 id="now-title">{t(lang, 'ov.thisTerm', { term: termName(lang, CURRENT_TERM) })}</h2><p>{t(lang, 'ov.termSummary', { n: nowItems.length, cp: termCp })}</p></div>
            <Icon name="calendar" size={22} />
          </header>
          {nowItems.length ? (
            <ul class="plain semester-course-list">
              {nowItems.map((it) => (
                <li key={it.id}>
                  <a href={courseHref(it.id)}><strong>{it.title ?? it.id}</strong><span>{rowLabel(lang, state, it.row)}</span></a>
                  <span class="semester-credit">{it.ects ?? '?'}<small> ECTS</small></span>
                </li>
              ))}
            </ul>
          ) : <p class="card-empty">{t(lang, 'v2.emptyLead')}</p>}
          <div class="card-foot">
            <a class="text-action" href={pageHref({ kind: 'courses', term: CURRENT_TERM, row: null, filter: null })}><Icon name="plus" size={15} />{t(lang, 'pl.add')}</a>
            <a class="text-action" href={pageHref({ kind: 'plan' })}>{t(lang, 'journey.viewPlan')}<Icon name="arrow" size={15} /></a>
          </div>
        </section>

        <section class="card chart-card dash-chart" aria-labelledby="chart-title">
          <header class="card-head">
            <div><h2 id="chart-title">{t(lang, 'chart.title')}</h2><p>{t(lang, 'chart.lead')}</p></div>
            <Icon name="trend" size={22} />
          </header>
          <TermChart lang={lang} terms={outlook.forecast.terms} />
        </section>

        {!areasMissing && <div class="dash-areas">{areasCard}</div>}

        <div class="dash-side">
          <section class="card deadlines-card" aria-labelledby="dl-title">
            <header class="card-head">
              <div><h2 id="dl-title">{t(lang, 'dl.cardTitle')}</h2><p>{t(lang, 'dl.cardLead')}</p></div>
              <button type="button" class="icon-button" aria-expanded={adding} aria-label={t(lang, 'dl.add')} onClick={() => setAdding(!adding)}><Icon name={adding ? 'close' : 'plus'} size={18} /></button>
            </header>
            {adding && <DeadlineForm lang={lang} update={update} onDone={() => setAdding(false)}
              modules={Object.keys(entries).map((id) => ({ id, title: rows.find((r) => r.id === id)?.title ?? id })).sort((a, b) => a.title.localeCompare(b.title))} />}
            {upcoming(state.deadlines ?? [], now.date).length
              ? <DeadlineList lang={lang} list={upcoming(state.deadlines ?? [], now.date).slice(0, 5)} update={update} today={now.date} />
              : !adding && <p class="card-empty">{t(lang, 'dl.empty')}</p>}
          </section>
          {goal && (
            <section class="card career-entry" aria-labelledby="goal-title">
              <header class="card-head"><h2 id="goal-title">{t(lang, 'ov.goal')}</h2><Icon name="briefcase" size={22} /></header>
              {goal.title ? <a class="goal-link" href={goal.href}><span class="goal-name">{goal.title}</span><span class="goal-fit"><strong>{goal.n}%</strong> {t(lang, 'ov.goalFit')}</span>
                <span class="meter" aria-hidden="true"><span style={{ width: `${goal.n}%` }} /></span></a> : <p>{t(lang, 'v2.careerLead')}</p>}
              <a class="text-action" href={goal.href}>{t(lang, 'v2.explorePaths')}<Icon name="arrow" size={15} /></a>
            </section>
          )}
          <section class="card shortlist-card" aria-labelledby="star-title">
            <header class="card-head"><div><h2 id="star-title">{t(lang, 'star.title')}</h2><p>{t(lang, starred.length ? 'star.lead' : 'star.empty')}</p></div><Icon name="star" size={22} /></header>
            {starred.length > 0 && (
              <ul class="plain shortlist">
                {starred.slice(0, 6).map((r) => {
                  const kind = moduleKind(data, r)
                  const e = entries[r.id]
                  return (
                    <li key={r.id}>
                      <a href={courseHref(r.id)}><strong>{r.title}</strong>
                        <span>{r.ects ?? '?'} ECTS{kind !== 'lecture' ? ` · ${t(lang, `kind.${kind}`)}` : ''}{e ? ` · ${t(lang, 'add.inPlan', { term: termName(lang, e.term) })}` : ''}</span></a>
                      <button type="button" class="icon-button star-toggle is-on" aria-pressed="true" aria-label={t(lang, 'star.remove', { title: r.title })}
                        onClick={() => update((s) => setStar(s, r.id, false))}><Icon name="star" size={17} filled /></button>
                    </li>
                  )
                })}
              </ul>
            )}
            <a class="text-action" href={`${pageHref({ kind: 'courses', term: null, row: null, filter: null })}?starred=1`}>{t(lang, starred.length ? 'star.all' : 'star.browse')}<Icon name="arrow" size={15} /></a>
          </section>
        </div>
      </div>
    </div>
  )
}
