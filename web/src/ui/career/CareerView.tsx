import { cl } from '../../locale'
import { useMemo } from 'preact/hooks'
import { t } from '../../i18n'
import { berlinNow } from '../../logic/calendar'
import { fit, gaps, lensWeights } from '../../logic/career'
import { fitByTerm, isStale, pathRole, rankEnvironments, skillProfile } from '../../logic/careerPlus'
import { EMPTY_HANDBOOK, moduleRows } from '../../logic/handbook'
import { roadmapEntries } from '../../logic/roadmap'
import { DEFAULT_TERMS, remainingTerms } from '../../logic/terms'
import { addModuleToTerm, MAX_FOLLOWED, restoreModule, setFollow, snapshotModule } from '../../store'
import type { CareerData, CoursesFile, HandbookFile, Lang, Lens, SkillId, UserState } from '../../types'
import { Icon } from '../Icon'
import { termName } from '../roadmap/format'
import { courseHref, pageHref } from '../route'
import { useToast } from '../toast'
import { Coursework, Experts, FitSteps, JobAdMatch, SkillProfile } from './CareerTools'
import { pathTitle, pointsOf, roleTitle } from './model'
import { StudyPlan } from './StudyPlan'

interface Props {
  data: CoursesFile
  handbook: HandbookFile | null
  career: CareerData | null
  /** "role:lens" from the route (#/career/role:lens) to open that path. */
  focus: string | null
  state: UserState
  update: (fn: (s: UserState) => UserState) => void
}

const importance = (w: number) => (w >= 0.2 ? 'high' : w >= 0.1 ? 'mid' : 'low')

/** One bar, two parts: the passed share (solid) and what the plan adds (light). */
function FitBar({ now, all }: { now: number; all: number }) {
  return (
    <span class="fit-bar" aria-hidden="true">
      <span class="fit-bar-all" style={{ width: `${all}%` }} />
      <span class="fit-bar-now" style={{ width: `${now}%` }} />
    </span>
  )
}

function LensInfo({ lang, career, lens, role }: { lang: Lang; career: CareerData; lens: Lens; role: string }) {
  const bands = [...lens.salary].sort((a, b) => Number(b.role === role) - Number(a.role === role))
  return (
    <div class="lens-card">
      <h3 id="lens-title">{lens.title[cl(lang)]}</h3>
      <dl class="lens-facts">
        <div><dt>{t(lang, 'career.cities')}</dt><dd>{lens.cities.join(', ')}</dd></div>
        <div>
          <dt>{t(lang, 'career.salary')}</dt>
          <dd>
            {bands.length ? (
              <ul class="plain salary-list">
                {bands.map((b, i) => (
                  <li key={i} class={b.role === role ? 'is-role' : ''}>
                    <span class="muted">{roleTitle(career, b.role, lang)}:</span> {b.band}{' '}
                    <a class="ext-link" href={b.source} target="_blank" rel="noopener">{t(lang, 'career.source')} {b.asOf}<Icon name="external" size={12} /></a>
                    {isStale(b.asOf, berlinNow().date) && <span class="tag tag-warn salary-stale">{t(lang, 'cp.stale')}</span>}
                  </li>
                ))}
              </ul>
            ) : <span class="muted">{t(lang, 'career.noSalary')}</span>}
          </dd>
        </div>
        <div><dt>{t(lang, 'career.interview')}</dt><dd>{lens.interview[cl(lang)]}</dd></div>
      </dl>
      <details class="lens-more">
        <summary>{t(lang, 'cr.lensMore')}</summary>
        <h4>{t(lang, 'career.offCourse')}</h4>
        <ul>{lens.offCourse[cl(lang)].map((x) => <li key={x}>{x}</li>)}</ul>
        <h4>{t(lang, 'career.downsides')}</h4>
        <ul>{lens.downsides[cl(lang)].map((x) => <li key={x}>{x}</li>)}</ul>
      </details>
    </div>
  )
}

/**
 * Career: where you want to work (every environment ranked by your plan's fit), optionally which role, then that
 * path in depth: fit term by term, the skill profile, the gaps with courses that close them, lecturers to ask for
 * HiWi jobs or a thesis, a job ad read as skills, CV lines, and a proposed program.
 */
export function CareerView({ data, handbook, career, focus, state, update }: Props) {
  const { lang } = state
  const toast = useToast()
  const rows = useMemo(() => moduleRows(data, handbook ?? EMPTY_HANDBOOK), [data, handbook])
  const points = useMemo(() => (career ? pointsOf(state, career, rows) : null), [state, career, rows])
  if (!career || !points) return <p class="empty">{t(lang, 'career.none')}</p>

  const { lenses } = career.lenses
  const known = (f: { role: string; lens: string }) => lenses.some((l) => l.id === f.lens)
  const followed = state.followed ?? []
  const stale = followed.filter((f) => !known(f))
  const unscored = rows.filter((r) => !career.skills.modules[r.id]).length

  // "#/career/<lens>" or "#/career/<role>:<lens>"; without one, the first followed path.
  const parts = (focus ?? '').split(':')
  const requestedLens = parts.pop()
  const requestedRole = parts.pop() ?? null
  const first = followed.find(known)
  const lensId = lenses.some((l) => l.id === requestedLens) ? requestedLens! : first?.lens ?? lenses[0].id
  const roleCandidate = focus ? requestedRole : first?.role ?? null
  const roleId = career.roles.roles.some((r) => r.id === roleCandidate) ? roleCandidate : null
  const lens = lenses.find((l) => l.id === lensId)!
  const role = pathRole(career, roleId, lens)
  const followId = roleId ?? 'environment'
  const href = (l: string, r: string | null = roleId) => pageHref({ kind: 'career', focus: r ? `${r}:${l}` : l })

  const all = fit(points.all, role, lens)
  const now = fit(points.now, role, lens)
  const ranked = rankEnvironments(points.all, career, roleId)
  const terms = remainingTerms(state.roadmap?.terms ?? DEFAULT_TERMS)
  const entries = roadmapEntries(state)
  const gapList = gaps(points.all, role, lens, rows, entries, career, terms)
  const weights = (Object.entries(lensWeights(role, lens)) as [SkillId, number][]).filter(([, w]) => w > 0)
  const bars = skillProfile(points, role, lens)
  const steps = fitByTerm(state, career, rows, role, lens)
  const titleOf = new Map(rows.map((r) => [r.id, r]))
  const mult = Object.entries(lens.multipliers) as [SkillId, number][]
  const more = mult.filter(([, m]) => m > 1).sort((a, b) => b[1] - a[1]).map(([sk]) => t(lang, `skill.${sk}`))
  const less = mult.filter(([, m]) => m < 1).sort((a, b) => a[1] - b[1]).map(([sk]) => t(lang, `skill.${sk}`))
  const isFollowed = followed.some((f) => f.lens === lensId && f.role === followId)
  const full = !isFollowed && followed.length >= MAX_FOLLOWED
  const add = (id: string, term: string, title: string) => {
    const snap = snapshotModule(state, id)
    update((s) => addModuleToTerm(s, data, handbook, id, term))
    toast({ message: t(lang, 'cp.added', { title, term: termName(lang, term) }), tone: 'success',
      action: { label: t(lang, 'toast.undo'), run: () => update((s) => restoreModule(s, id, snap)) } })
  }
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  const sections: [string, string][] = [['career-skills', 'cx.skills'], ['career-people', 'cp.people'], ['career-ad', 'cp.ad'], ['career-cv', 'cp.cv'], ['career-program', 'cx.program']]

  return (
    <div class="career">
      {stale.length > 0 && (
        <div class="banner banner-warn">
          <p>{t(lang, 'career.stale')}</p>
          <ul class="plain">
            {stale.map((f) => {
              const title = pathTitle(career, f.role, f.lens, lang)
              return (
                <li key={`${f.role}:${f.lens}`}>
                  {title}{' '}
                  <button type="button" class="link-button" aria-label={`${t(lang, 'career.remove')} ${title}`}
                    onClick={() => update((s) => setFollow(s, f.role, f.lens, false))}>{t(lang, 'career.remove')}</button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div class="career-grid">
        <section class="environment-picker" aria-labelledby="lens-pick-label">
          <div class="picker-head">
            <div>
              <h2 id="lens-pick-label">{t(lang, 'cr.employer')}</h2>
              <p>{t(lang, 'cp.compareLead')}</p>
            </div>
            <label class="field role-pick">
              {t(lang, 'cp.role')}
              <select value={roleId ?? ''} onChange={(e) => { location.hash = href(lensId, (e.target as HTMLSelectElement).value || null) }}>
                <option value="">{t(lang, 'cp.noRole')}</option>
                {career.roles.roles.map((r) => <option key={r.id} value={r.id}>{r.title[cl(lang)]}</option>)}
              </select>
            </label>
          </div>
          <nav class="env-grid" aria-labelledby="lens-pick-label">
            {lenses.map((l) => {
              const f = ranked.find((x) => x.lens.id === l.id)!.fit
              const best = ranked[0].lens.id === l.id && f > 0
              return (
                <a key={l.id} class="env-card" href={href(l.id)} aria-current={l.id === lensId ? 'true' : undefined} aria-label={l.title[cl(lang)]}>
                  <span class="env-title">{l.title[cl(lang)]}</span>
                  <span class="env-fit"><strong>{f}%</strong>{best && <span class="tag tag-accent">{t(lang, 'cp.best')}</span>}</span>
                  <span class="meter" aria-hidden="true"><span style={{ width: `${f}%` }} /></span>
                </a>
              )
            })}
          </nav>
        </section>

        <section class="job-detail" aria-labelledby="job-title">
          <div class="career-brief">
            <header class="job-head">
              <div class="job-head-text">
                <p class="career-eyebrow">{t(lang, isFollowed ? 'cr.isGoal' : roleId ? 'cp.pathLabel' : 'cx.environmentLabel')}</p>
                <h2 id="job-title">{roleId ? `${role.title[cl(lang)]} · ${lens.title[cl(lang)]}` : lens.title[cl(lang)]}</h2>
                <p class="job-summary">{role.summary[cl(lang)]}</p>
                <p class="career-browse-note">{t(lang, 'cx.browsing')}</p>
              </div>
              <button type="button" class={isFollowed ? 'button-quiet' : 'button'} disabled={full} aria-pressed={isFollowed}
                onClick={() => update((s) => setFollow(s, followId, lensId, !isFollowed))}>
                {isFollowed ? <><Icon name="check" size={16} />{t(lang, 'cr.isGoal')}</> : t(lang, 'cr.makeGoal')}
              </button>
            </header>
            {full && <p class="note">{t(lang, 'career.followLimit')}</p>}
          </div>
          <div class="career-environment">
            <div class="career-fit-row">
              <div class="career-fit" aria-label={t(lang, 'cr.fit')}>
                <div class="career-fit-values">
                  <p><span>{t(lang, 'cr.keyNow')}</span><strong>{now}<small>%</small></strong></p>
                  <span class="career-fit-arrow" aria-hidden="true">→</span>
                  <p><span>{t(lang, 'cx.withPlan')}</span><strong>{all}<small>%</small></strong></p>
                </div>
                <FitBar now={now} all={all} />
                <p class="career-fit-note">{t(lang, 'cx.fitNote')}</p>
              </div>
              <div class="career-steps">
                <p class="career-eyebrow">{t(lang, 'cp.byTerm')}</p>
                <FitSteps lang={lang} steps={steps} />
              </div>
            </div>
          </div>
          <nav class="career-jumps" aria-label={t(lang, 'cx.sections')}>
            {sections.map(([id, key], i) => (
              <button key={id} type="button" onClick={() => jump(id)}><span>{String(i + 1).padStart(2, '0')}</span>{t(lang, key)}<span aria-hidden="true">↓</span></button>
            ))}
          </nav>

          <div class="detail-cols" id="career-skills">
            <div class="detail-main">
              <section aria-labelledby="needs-title">
                <p class="career-eyebrow">01 / {t(lang, 'cx.skills')}</p>
                <h3 id="needs-title">{t(lang, 'cr.needs')}</h3>
                <p class="career-section-lead">{t(lang, 'cp.profileLead')}</p>
                <SkillProfile lang={lang} bars={bars} />
              </section>
              <section aria-labelledby="gaps-title" class="gap-section">
                <h3 id="gaps-title">{t(lang, 'cp.gapsTitle')}</h3>
                <p class="career-section-lead">{t(lang, 'cx.skillsLead')}</p>
                {gapList.length ? (
                  <ul class="plain gap-list">
                    {gapList.map((g) => {
                      const imp = importance(weights.find(([s]) => s === g.skill)?.[1] ?? 0)
                      return (
                        <li key={g.skill} class="gap">
                          <div class="need">
                            <span class="need-name">{t(lang, `skill.${g.skill}`)}</span>
                            <span class={`need-imp imp-${imp}`}>{t(lang, `cr.imp.${imp}`)}</span>
                            <span class="need-cov">{t(lang, 'cr.covered', { n: Math.round(g.coverage * 100) })}</span>
                            <span class="need-bar" aria-hidden="true"><span style={{ width: `${Math.round(g.coverage * 100)}%` }} /></span>
                          </div>
                          {g.modules.length > 0 ? (
                            <ul class="plain gap-courses" aria-label={t(lang, 'cp.closes', { skill: t(lang, `skill.${g.skill}`) })}>
                              {g.modules.map((m) => {
                                const r = titleOf.get(m.id)
                                return (
                                  <li key={m.id}>
                                    <a href={courseHref(m.id)}>{r?.title ?? m.id}</a>
                                    <span class="muted">{r?.ects ?? '?'} ECTS · {termName(lang, m.term!)} · {t(lang, 'cp.scoreOf', { n: m.score })}</span>
                                    <button type="button" class="button-ghost is-small" aria-label={`${t(lang, 'add.add')}: ${r?.title ?? m.id}`}
                                      onClick={() => add(m.id, m.term!, r?.title ?? m.id)}><Icon name="plus" size={14} />{t(lang, 'add.add')}</button>
                                  </li>
                                )
                              })}
                            </ul>
                          ) : <p class="muted gap-none">{t(lang, 'cp.noCourses')}</p>}
                        </li>
                      )
                    })}
                  </ul>
                ) : <p class="career-section-lead">{t(lang, 'cx.covered')}</p>}
              </section>
            </div>
            <div class="career-context">
              <p class="career-eyebrow">{t(lang, 'cr.employer')}</p>
              <h3>{lens.title[cl(lang)]}</h3>
              <p class="lens-effect">
                {more.length > 0 && <span>{t(lang, 'cr.lensMore2', { lens: lens.title[cl(lang)], skills: more.join(', ') })}</span>}
                {less.length > 0 && <span>{t(lang, 'cr.lensLess', { skills: less.join(', ') })}</span>}
              </p>
              <details class="career-market" open>
                <summary>{t(lang, 'cx.market')}</summary>
                <LensInfo lang={lang} career={career} lens={lens} role={role.id} />
              </details>
            </div>
          </div>

          <section id="career-people" class="career-block" aria-labelledby="people-title">
            <p class="career-eyebrow">02 / {t(lang, 'cp.people')}</p>
            <h3 id="people-title">{t(lang, 'cp.peopleTitle')}</h3>
            <p class="career-section-lead">{t(lang, 'cp.peopleLead')}</p>
            <Experts lang={lang} role={role} lens={lens} career={career} rows={rows} />
          </section>

          <section id="career-ad" class="career-block" aria-labelledby="ad-title">
            <p class="career-eyebrow">03 / {t(lang, 'cp.ad')}</p>
            <h3 id="ad-title">{t(lang, 'cp.adTitle')}</h3>
            <p class="career-section-lead">{t(lang, 'cp.adLead')}</p>
            <JobAdMatch lang={lang} role={role} points={points.all} career={career} rows={rows} state={state} terms={terms} onAdd={add} />
          </section>

          <section id="career-cv" class="career-block" aria-labelledby="cv-title">
            <p class="career-eyebrow">04 / {t(lang, 'cp.cv')}</p>
            <h3 id="cv-title">{t(lang, 'cp.cvTitle')}</h3>
            <p class="career-section-lead">{t(lang, 'cp.cvLead')}</p>
            <Coursework lang={lang} state={state} career={career} rows={rows} role={role} lens={lens} />
          </section>

          <div id="career-program" class="career-program">
            <p class="career-eyebrow">05 / {t(lang, 'cx.program')}</p>
            <StudyPlan key={`${role.id}:${lensId}`} data={data} handbook={handbook} career={career} role={role} lens={lens} rows={rows}
              state={state} update={update} />
          </div>
        </section>
      </div>
      <details class="career-method">
        <summary>{t(lang, 'cx.method')}</summary>
        <p>{t(lang, roleId ? 'cp.roleMethod' : 'cx.environmentMethod')}</p>
        {unscored > 0 && <p>{t(lang, 'career.unscored', { n: unscored })}</p>}
      </details>
    </div>
  )
}
