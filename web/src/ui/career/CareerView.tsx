import { useMemo } from 'preact/hooks'
import { t } from '../../i18n'
import { environmentRole, fit, lensWeights, skillCoverage } from '../../logic/career'
import { EMPTY_HANDBOOK, moduleRows } from '../../logic/handbook'
import { MAX_FOLLOWED, setFollow } from '../../store'
import type { CareerData, CoursesFile, HandbookFile, Lang, Lens, SkillId, UserState } from '../../types'
import { Icon } from '../Icon'
import { pageHref } from '../route'
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
  if (!career || !points) return <p class="empty">{t(lang, 'career.none')}</p>

  const { lenses } = career.lenses
  const known = (f: { role: string; lens: string }) => lenses.some((l) => l.id === f.lens)
  const followed = state.followed ?? []
  const stale = followed.filter((f) => !known(f))
  const unscored = rows.filter((r) => !career.skills.modules[r.id]).length

  // New links select an environment directly; old role:lens links retain their environment.
  const requested = (focus ?? '').split(':').pop()
  const lensId = lenses.some((l) => l.id === requested) ? requested! : followed.find(known)?.lens ?? lenses[0].id
  const lens = lenses.find((l) => l.id === lensId)!
  const role = environmentRole(lens)
  const roleId = role.id
  const href = (l: string) => pageHref({ kind: 'career', focus: l })

  const all = fit(points.all, role, lens)
  const now = fit(points.now, role, lens)
  const weights = (Object.entries(lensWeights(role, lens)) as [SkillId, number][]).filter(([, w]) => w > 0).sort((a, b) => b[1] - a[1])
  const priorities = weights.filter(([sk]) => skillCoverage(points.all, role, sk) < 1)
    .sort(([a, wa], [b, wb]) => wb * (1 - skillCoverage(points.all, role, b)) - wa * (1 - skillCoverage(points.all, role, a))).slice(0, 3)
  const needRow = ([s, w]: [SkillId, number]) => {
    const c = Math.round(skillCoverage(points.all, role, s) * 100)
    return <li key={s} class="need">
      <span class="need-name">{t(lang, `skill.${s}`)}</span>
      <span class={`need-imp imp-${importance(w)}`}>{t(lang, `cr.imp.${importance(w)}`)}</span>
      <span class="need-cov">{t(lang, 'cr.covered', { n: c })}</span>
      <span class="need-bar" aria-hidden="true"><span class={c >= 100 ? 'is-full' : ''} style={{ width: `${c}%` }} /></span>
    </li>
  }
  const mult = Object.entries(lens.multipliers) as [SkillId, number][]
  const more = mult.filter(([, m]) => m > 1).sort((a, b) => b[1] - a[1]).map(([sk]) => t(lang, `skill.${sk}`))
  const less = mult.filter(([, m]) => m < 1).sort((a, b) => a[1] - b[1]).map(([sk]) => t(lang, `skill.${sk}`))
  const isFollowed = followed.some((f) => f.lens === lensId)
  const full = !isFollowed && followed.length >= MAX_FOLLOWED

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
          <h2 id="lens-pick-label">{t(lang, 'cr.employer')}</h2>
          <p>{t(lang, 'cx.environmentOnly')}</p>
          <nav class="lens-options" aria-labelledby="lens-pick-label">
            {lenses.map((l) => <a key={l.id} class="chip" href={href(l.id)} aria-current={l.id === lensId ? 'true' : undefined}>{l.title[lang]}</a>)}
          </nav>
        </section>

        <section class="job-detail" aria-labelledby="job-title">
          <div class="career-brief">
          <header class="job-head">
            <div class="job-head-text">
              <p class="career-eyebrow">{t(lang, isFollowed ? 'cr.isGoal' : 'cx.environmentLabel')}</p>
              <h2 id="job-title">{role.title[lang]}</h2>
              <p class="job-summary">{role.summary[lang]}</p>
              <p class="career-browse-note">{t(lang, 'cx.browsing')}</p>
            </div>
            <button type="button" class={isFollowed ? 'button-quiet' : 'button'} disabled={full} aria-pressed={isFollowed}
              onClick={() => update((s) => isFollowed ? { ...s, followed: (s.followed ?? []).filter((f) => f.lens !== lensId) } : setFollow(s, roleId, lensId, true))}>
              {isFollowed ? <><Icon name="check" size={16} />{t(lang, 'cr.isGoal')}</> : t(lang, 'cr.makeGoal')}
            </button>
          </header>
          {full && <p class="note">{t(lang, 'career.followLimit')}</p>}


          </div>
          <div class="career-environment">
            <div class="career-fit" aria-label={t(lang, 'cr.fit')}>
              <div class="career-fit-values">
                <p><span>{t(lang, 'cr.keyNow')}</span><strong>{now}<small>%</small></strong></p>
                <span class="career-fit-arrow" aria-hidden="true">→</span>
                <p><span>{t(lang, 'cx.withPlan')}</span><strong>{all}<small>%</small></strong></p>
              </div>
              <FitBar now={now} all={all} />
              <p class="career-fit-note">{t(lang, 'cx.fitNote')}</p>
            </div>
          </div>
          <nav class="career-jumps" aria-label={t(lang, 'cx.sections')}>
            <button type="button" onClick={() => document.getElementById('career-skills')?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })}><span>01</span>{t(lang, 'cx.skills')}<span aria-hidden="true">↓</span></button>
            <button type="button" onClick={() => document.getElementById('career-program')?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })}><span>02</span>{t(lang, 'cx.program')}<span aria-hidden="true">↓</span></button>
          </nav>
          <div class="detail-cols" id="career-skills">
            <div class="detail-main">
              <section aria-labelledby="needs-title">
                <p class="career-eyebrow">01 / {t(lang, 'cx.skills')}</p>
                <h3 id="needs-title">{t(lang, 'cr.needs')}</h3>
                <p class="career-section-lead">{t(lang, 'cx.skillsLead')}</p>
                {priorities.length ? <ul class="plain need-list">{priorities.map(needRow)}</ul> : <p class="career-section-lead">{t(lang, 'cx.covered')}</p>}
                <details class="career-all-skills">
                  <summary>{t(lang, 'cx.allSkills', { n: weights.length })}</summary>
                  <ul class="plain need-list">{weights.map(needRow)}</ul>
                </details>
              </section>
            </div>
            <div class="career-context">
              <p class="career-eyebrow">{t(lang, 'cr.employer')}</p>
              <h3>{lens.title[lang]}</h3>
              <p class="lens-effect">
                {more.length > 0 && <span>{t(lang, 'cr.lensMore2', { lens: lens.title[lang], skills: more.join(', ') })}</span>}
                {less.length > 0 && <span>{t(lang, 'cr.lensLess', { skills: less.join(', ') })}</span>}
              </p>
              <details class="career-market">
                <summary>{t(lang, 'cx.market')}</summary>
                <LensInfo lang={lang} career={career} lens={lens} role={roleId} />
              </details>
            </div>
          </div>
          <div id="career-program" class="career-program">
            <p class="career-eyebrow">02 / {t(lang, 'cx.program')}</p>
            <StudyPlan key={`${roleId}:${lensId}`} data={data} handbook={handbook} career={career} role={role} lens={lens} rows={rows}
              state={state} update={update} />
          </div>
        </section>
      </div>
      <details class="career-method">
        <summary>{t(lang, 'cx.method')}</summary>
        <p>{t(lang, 'cx.environmentMethod')}</p>
        {unscored > 0 && <p>{t(lang, 'career.unscored', { n: unscored })}</p>}
      </details>
    </div>
  )
}
