import { useMemo } from 'preact/hooks'
import { t } from '../../i18n'
import { fit } from '../../logic/career'
import { AREAS, RULES, roadmapReport, type Kind, type RoadmapReport } from '../../logic/degree'
import { EMPTY_HANDBOOK, moduleRows } from '../../logic/handbook'
import { matrixCells, type CellItem, type Matrix, type RowId } from '../../logic/matrix'
import { nextTerm } from '../../logic/nextSteps'
import { CURRENT_TERM } from '../../logic/terms'
import { setArea } from '../../store'
import type { CareerData, CoursesFile, HandbookFile, Lang, UserState } from '../../types'
import { pathTitle, pointsOf } from '../career/model'
import { TermLink } from '../glossary/GlossaryView'
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
}

const fmtNum = (lang: Lang, n: number) => String(n).replace('.', lang === 'tr' ? ',' : '.')

/** 120 marks, one per ECTS: passed, planned, still open, and the thesis at the end. */
function CreditRuler({ lang, passed, planned }: { lang: Lang; passed: number; planned: number }) {
  const modules = RULES.total - RULES.thesis
  const p = Math.min(passed, modules)
  const q = Math.min(passed + planned, modules)
  const marks = Array.from({ length: RULES.total }, (_, i) => (i < p ? 'passed' : i < q ? 'planned' : i < modules ? 'open' : 'thesis'))
  return (
    <div class="ruler-wrap">
      <div class="ruler" role="img" aria-label={t(lang, 'ov.rulerLabel', { passed: p, planned: q - p, open: modules - q, thesis: RULES.thesis })}>
        {marks.map((m, i) => <i key={i} class={`mark is-${m}${i % 10 === 9 ? ' is-tenth' : ''}`} />)}
      </div>
      <div class="ruler-scale" aria-hidden="true">
        <span style={{ left: '0%' }}>0</span>
        <span style={{ left: '25%' }}>30</span>
        <span style={{ left: '50%' }}>60</span>
        <span class="ruler-thesis" style={{ left: '75%' }}>{t(lang, 'ov.thesisMark')}</span>
        <span style={{ left: '100%' }}>120</span>
      </div>
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
  const report = useMemo(() => roadmapReport(state, data, handbook), [state, data, handbook])
  const matrix = useMemo(() => matrixCells(state, data, handbook), [state, data, handbook])
  const reqs = requirements(lang, state, report, matrix)
  const target = nextTerm(state)
  const passed = report.done.total
  const planned = report.all.total - passed
  const open = Math.max(0, RULES.total - RULES.thesis - report.all.total)
  const missing = reqs.filter((r) => !r.done).length

  const now: (CellItem & { row: RowId })[] = (Object.keys(matrix.cells) as RowId[])
    .flatMap((row) => (matrix.cells[row][CURRENT_TERM] ?? []).map((it) => ({ ...it, row })))

  const goal = useMemo(() => {
    if (!career) return null
    const f = (state.followed ?? []).find((x) => career.roles.roles.some((r) => r.id === x.role) && career.lenses.lenses.some((l) => l.id === x.lens))
    if (!f) return { title: null, n: 0, href: pageHref({ kind: 'career', focus: null }) }
    const rows = moduleRows(data, handbook ?? EMPTY_HANDBOOK)
    const n = fit(pointsOf(state, career, rows).all, career.roles.roles.find((r) => r.id === f.role)!, career.lenses.lenses.find((l) => l.id === f.lens)!)
    return { title: pathTitle(career, f.role, f.lens, lang), n, href: pageHref({ kind: 'career', focus: `${f.role}:${f.lens}` }) }
  }, [career, state, data, handbook, lang])

  return (
    <div class="overview">
      <PageHead title={t(lang, 'nav.overview')} lead={t(lang, 'page.overview.lead')} />

      <section class="ledger" aria-labelledby="ledger-title">
        <h2 id="ledger-title" class="sr-only">{t(lang, 'ov.credits')}</h2>
        <div class="ledger-top">
          <p class="ledger-total"><strong>{report.all.total}</strong><span>{t(lang, 'ov.of', { n: RULES.total })}</span></p>
          {report.gpa !== null && (
            <p class="ledger-gpa"><strong>{fmtNum(lang, report.gpa)}</strong><span>{t(lang, 'plan.gpa', { cp: report.gradedCp })}</span></p>
          )}
        </div>
        <CreditRuler lang={lang} passed={passed} planned={planned} />
        <ul class="plain ledger-legend">
          <li><i class="mark is-passed" aria-hidden="true" />{t(lang, 'ov.legend.passed', { n: passed })}</li>
          <li><i class="mark is-planned" aria-hidden="true" />{t(lang, 'ov.legend.planned', { n: planned })}</li>
          <li><i class="mark is-open" aria-hidden="true" />{t(lang, 'ov.legend.open', { n: open })}</li>
          <li><i class="mark is-thesis" aria-hidden="true" />{t(lang, 'ov.legend.thesis', { n: RULES.thesis })}</li>
        </ul>
      </section>

      <div class="overview-grid">
        <section class="reqs-card" aria-labelledby="reqs-title">
          <header class="section-head">
            <h2 id="reqs-title">{t(lang, 'ov.reqs')}</h2>
            <p class={missing ? 'reqs-count is-missing' : 'reqs-count'}>
              {missing ? t(lang, 'ov.missing', { n: missing, total: reqs.length }) : t(lang, 'step.done')}
            </p>
          </header>
          <ul class="plain req-list">
            {reqs.map((r) => (
              <li key={r.id} class={`req-row${r.done ? ' is-done' : ' is-missing'}`}>
                <span class="req-mark" aria-hidden="true">{r.done ? <Icon name="check" size={14} /> : null}</span>
                <span class="req-label">{r.label}{r.term && <TermLink id={r.term} lang={lang} />}</span>
                <span class="req-value"><strong>{r.have}</strong> / {r.need}
                  <span class="sr-only">{r.done ? t(lang, 'ov.met') : t(lang, 'ov.notMet')}</span></span>
                {!r.done && r.add && (
                  <span class="req-action">
                    <a class="button-quiet" href={pageHref({ kind: 'courses', term: target, row: r.add.row, filter: r.add.kind ?? null })}
                      aria-label={`${r.add.label}: ${r.label}`}>
                      <Icon name="plus" size={14} />{r.add.label}
                    </a>
                  </span>
                )}
                <div class="req-body">
                  {r.area !== undefined && <AreaSelect lang={lang} state={state} slot={r.area} update={update} label={r.label} />}
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

        <div class="overview-side">
          <section class="side-card" aria-labelledby="now-title">
            <header class="section-head">
              <h2 id="now-title">{t(lang, 'ov.thisTerm', { term: termName(lang, CURRENT_TERM) })}</h2>
              <p class="side-total"><strong>{matrix.colTotals[CURRENT_TERM] ?? 0}</strong> ECTS</p>
            </header>
            {now.length ? (
              <ul class="plain now-list">
                {now.map((it) => (
                  <li key={it.id}>
                    <a href={courseHref(it.id)} class="now-item">
                      <span class="now-title">{it.title ?? it.id}</span>
                      <span class="now-meta">{rowLabel(lang, state, it.row)}</span>
                    </a>
                    <span class="now-ects">{it.ects ?? '?'}</span>
                  </li>
                ))}
              </ul>
            ) : <p class="empty-inline">{t(lang, 'ov.nowEmpty')}</p>}
            <div class="side-actions">
              {now.length
                ? <a class="button-quiet" href={pageHref({ kind: 'week' })}><Icon name="calendar" size={16} />{t(lang, 'ov.openWeek')}</a>
                : (
                  <a class="button-quiet" href={pageHref({ kind: 'courses', term: CURRENT_TERM, row: null, filter: null })}>
                    <Icon name="plus" size={16} />{t(lang, 'ov.addNow')}
                  </a>
                )}
            </div>
          </section>

          {goal && (
            <section class="side-card goal-card" aria-labelledby="goal-title">
              <h2 id="goal-title">{t(lang, 'ov.goal')}</h2>
              {goal.title ? (
                <a class="goal-link" href={goal.href}>
                  <span class="goal-name">{goal.title}</span>
                  <span class="goal-fit"><strong>{goal.n}%</strong> {t(lang, 'ov.goalFit')}</span>
                  <span class="goal-bar" aria-hidden="true"><span style={{ width: `${goal.n}%` }} /></span>
                </a>
              ) : (
                <>
                  <p class="side-text">{t(lang, 'ov.goalNone')}</p>
                  <a class="button-quiet" href={goal.href}><Icon name="briefcase" size={16} />{t(lang, 'top.goalPick')}</a>
                </>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
