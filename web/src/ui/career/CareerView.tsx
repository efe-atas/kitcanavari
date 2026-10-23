import { useEffect, useMemo, useState } from 'preact/hooks'
import { t } from '../../i18n'
import { fit, lensWeights, skillCoverage } from '../../logic/career'
import { EMPTY_HANDBOOK, moduleRows } from '../../logic/handbook'
import { MAX_FOLLOWED, setFollow } from '../../store'
import type { CareerData, CoursesFile, HandbookFile, Lang, Lens, SkillId, UserState } from '../../types'
import { Icon } from '../Icon'
import { pageHref } from '../route'
import { pathTitle, pointsOf, roleTitle } from './model'
import { StudyPlan, type PlanMode } from './StudyPlan'

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
    <aside class="lens-card" aria-labelledby="lens-title">
      <h3 id="lens-title">{lens.title[lang]}</h3>
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
                  </li>
                ))}
              </ul>
            ) : <span class="muted">{t(lang, 'career.noSalary')}</span>}
          </dd>
        </div>
        <div><dt>{t(lang, 'career.interview')}</dt><dd>{lens.interview[lang]}</dd></div>
      </dl>
      <details class="lens-more">
        <summary>{t(lang, 'cr.lensMore')}</summary>
        <h4>{t(lang, 'career.offCourse')}</h4>
        <ul>{lens.offCourse[lang].map((x) => <li key={x}>{x}</li>)}</ul>
        <h4>{t(lang, 'career.downsides')}</h4>
        <ul>{lens.downsides[lang].map((x) => <li key={x}>{x}</li>)}</ul>
      </details>
    </aside>
  )
}

/**
 * Which jobs the plan prepares for (a ranked list), then one job in depth: the employer type, what the job needs,
 * and the courses that would close the biggest gaps.
 */
export function CareerView({ data, handbook, career, focus, state, update }: Props) {
  const { lang } = state
  const rows = useMemo(() => moduleRows(data, handbook ?? EMPTY_HANDBOOK), [data, handbook])
  const points = useMemo(() => (career ? pointsOf(state, career, rows) : null), [state, career, rows])
  const [planMode, setPlanMode] = useState<PlanMode>('rebuild')
  // On narrow screens the detail sits below the list; bring it into view when a job is picked.
  useEffect(() => {
    if (!focus || typeof matchMedia !== 'function' || !matchMedia('(max-width: 960px)').matches) return
    document.getElementById('job-title')?.scrollIntoView?.({ block: 'start' })
  }, [focus])
  if (!career || !points) return <p class="empty">{t(lang, 'career.none')}</p>

  const { roles } = career.roles
  const { lenses } = career.lenses
  const known = (f: { role: string; lens: string }) => roles.some((r) => r.id === f.role) && lenses.some((l) => l.id === f.lens)
  const followed = state.followed ?? []
  const stale = followed.filter((f) => !known(f))
  const unscored = rows.filter((r) => !career.skills.modules[r.id]).length

  // Selected path: the route, else the first followed one; the employer type first, since the ranking depends on it.
  const [fr, fl] = (focus ?? '').split(':')
  const firstFollowed = followed.find(known)
  const lensId = lenses.some((l) => l.id === fl) ? fl
    : followed.find((f) => f.role === fr && known(f))?.lens ?? firstFollowed?.lens ?? lenses[0].id
  const lens = lenses.find((l) => l.id === lensId)!
  const ranked = roles
    .map((r) => ({ r, all: fit(points.all, r, lens), now: fit(points.now, r, lens) }))
    .sort((a, b) => b.all - a.all || b.now - a.now)
  const roleId = roles.some((r) => r.id === fr) ? fr : firstFollowed?.role ?? ranked[0].r.id
  const role = roles.find((r) => r.id === roleId)!
  const href = (r: string, l: string) => pageHref({ kind: 'career', focus: `${r}:${l}` })

  const { all, now } = ranked.find((x) => x.r.id === roleId)!
  const weights = (Object.entries(lensWeights(role, lens)) as [SkillId, number][]).filter(([, w]) => w > 0).sort((a, b) => b[1] - a[1])
  const mult = Object.entries(lens.multipliers) as [SkillId, number][]
  const more = mult.filter(([, m]) => m > 1).sort((a, b) => b[1] - a[1]).map(([sk]) => t(lang, `skill.${sk}`))
  const less = mult.filter(([, m]) => m < 1).sort((a, b) => a[1] - b[1]).map(([sk]) => t(lang, `skill.${sk}`))
  const isFollowed = followed.some((f) => f.role === roleId && f.lens === lensId)
  const full = !isFollowed && followed.length >= MAX_FOLLOWED

  return (
    <div class="career">
      {unscored > 0 && <p class="banner banner-warn">{t(lang, 'career.unscored', { n: unscored })}</p>}
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
        <section class="jobs-card" aria-labelledby="jobs-title">
          <header class="jobs-head">
            <h2 id="jobs-title">{t(lang, 'cr.jobs')}</h2>
            <p class="jobs-for">{t(lang, 'cr.jobsFor', { lens: lens.title[lang] })}</p>
          </header>
          <p class="jobs-legend">
            <span><i class="key key-now" aria-hidden="true" />{t(lang, 'cr.keyNow')}</span>
            <span><i class="key key-all" aria-hidden="true" />{t(lang, 'cr.keyAll')}</span>
          </p>
          {ranked.every((x) => x.all === 0) && <p class="jobs-empty">{t(lang, 'cr.emptyPlan')}</p>}
          <ol class="plain job-list">
            {ranked.map(({ r, all: a, now: n }) => {
              const goal = followed.some((f) => f.role === r.id && known(f))
              return (
                <li key={r.id}>
                  <a class="job" href={href(r.id, lensId)}
                    aria-current={r.id === roleId ? 'true' : undefined}
                    aria-label={`${r.title[lang]}: ${t(lang, 'cr.fitLabel', { all: a, now: n })}${goal ? `, ${t(lang, 'cr.goal')}` : ''}`}>
                    <span class="job-name">{r.title[lang]}{goal && <span class="goal-badge">{t(lang, 'cr.goal')}</span>}</span>
                    <span class="job-fit"><strong>{a}%</strong></span>
                    <FitBar now={n} all={a} />
                  </a>
                </li>
              )
            })}
          </ol>
        </section>

        <section class="job-detail" aria-labelledby="job-title">
          <header class="job-head">
            <div class="job-head-text">
              <h2 id="job-title">{role.title[lang]}</h2>
              <p class="job-summary">{role.summary[lang]}</p>
            </div>
            <button type="button" class={isFollowed ? 'button-quiet' : 'button'} disabled={full} aria-pressed={isFollowed}
              onClick={() => update((s) => setFollow(s, roleId, lensId, !isFollowed))}>
              {isFollowed ? <><Icon name="check" size={16} />{t(lang, 'cr.isGoal')}</> : t(lang, 'cr.makeGoal')}
            </button>
          </header>
          {full && <p class="note">{t(lang, 'career.followLimit')}</p>}

          <div class="lens-pick">
            <span class="lens-label" id="lens-pick-label">{t(lang, 'cr.employer')}</span>
            <nav class="lens-options" aria-labelledby="lens-pick-label">
              {lenses.map((l) => (
                <a key={l.id} class="chip" href={href(roleId, l.id)} aria-current={l.id === lensId ? 'true' : undefined}>{l.title[lang]}</a>
              ))}
            </nav>
            {(more.length > 0 || less.length > 0) && (
              <p class="lens-effect">
                {more.length > 0 && <span>{t(lang, 'cr.lensMore2', { lens: lens.title[lang], skills: more.join(', ') })}</span>}
                {less.length > 0 && <span>{t(lang, 'cr.lensLess', { skills: less.join(', ') })}</span>}
              </p>
            )}
          </div>

          <div class="fit-summary">
            <p class="fit-number"><strong>{all}%</strong><span>{t(lang, 'cr.fit')}</span></p>
            <FitBar now={now} all={all} />
            <p class="fit-sentence">{t(lang, 'cr.fitSentence', { now, all, lens: lens.title[lang] })}</p>
          </div>

          <StudyPlan key={`${roleId}:${lensId}`} data={data} handbook={handbook} career={career} role={role} lens={lens} rows={rows}
            state={state} update={update} mode={planMode} onMode={setPlanMode} />

          <div class="detail-cols">
            <div class="detail-main">
              <section aria-labelledby="needs-title">
                <h3 id="needs-title">{t(lang, 'cr.needs')}</h3>
                <ul class="plain need-list">
                  {weights.map(([s, w]) => {
                    const c = Math.round(skillCoverage(points.all, role, s) * 100)
                    const imp = importance(w)
                    return (
                      <li key={s} class="need">
                        <span class="need-name">{t(lang, `skill.${s}`)}</span>
                        <span class={`need-imp imp-${imp}`}>{t(lang, `cr.imp.${imp}`)}</span>
                        <span class="need-cov">{t(lang, 'cr.covered', { n: c })}</span>
                        <span class="need-bar" aria-hidden="true"><span class={c >= 100 ? 'is-full' : ''} style={{ width: `${c}%` }} /></span>
                      </li>
                    )
                  })}
                </ul>
              </section>
            </div>
            <LensInfo lang={lang} career={career} lens={lens} role={roleId} />
          </div>
        </section>
      </div>
      <p class="plan-note">{t(lang, 'cr.method')}</p>
    </div>
  )
}
