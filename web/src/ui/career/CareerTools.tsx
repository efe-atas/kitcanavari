import { Fragment } from 'preact'
import { useMemo, useState } from 'preact/hooks'
import { dictionaries, t } from '../../i18n'
import { skillCoverage } from '../../logic/career'
import { courseworkLines, expertsFor, matchJobAd, type SkillBar } from '../../logic/careerPlus'
import type { ModuleRow } from '../../logic/handbook'
import { roadmapEntries } from '../../logic/roadmap'
import { offeringIssue, PRIOR } from '../../logic/terms'
import type { CareerData, Lang, Lens, Role, SkillId, UserState } from '../../types'
import { Icon } from '../Icon'
import { termName } from '../roadmap/format'
import { courseHref } from '../route'
import type { SkillPoints } from '../../logic/career'

const pts = (n: number) => (Math.round(n * 10) / 10).toString()

/** Each skill of the path as a bar: passed points, what the plan adds, and the target as a mark. */
export function SkillProfile({ lang, bars }: { lang: Lang; bars: SkillBar[] }) {
  const max = Math.max(...bars.map((b) => Math.max(b.all, b.target * 1.25)), 1)
  const pct = (n: number) => `${Math.min(100, (n / max) * 100)}%`
  return (
    <figure class="skill-profile">
      <ul class="plain chart-legend" aria-hidden="true">
        <li><i class="is-passed" />{t(lang, 'cp.passedPts')}</li>
        <li><i class="is-planned" />{t(lang, 'cp.plannedPts')}</li>
        <li><i class="is-target" />{t(lang, 'cp.target')}</li>
      </ul>
      <ul class="plain profile-rows">
        {bars.map((b) => (
          <li key={b.skill} class={b.all >= b.target ? 'is-met' : ''}>
            <span class="profile-name">{t(lang, `skill.${b.skill}`)}</span>
            <span class="profile-track" role="img"
              aria-label={t(lang, 'cp.barLabel', { skill: t(lang, `skill.${b.skill}`), now: pts(b.now), all: pts(b.all), target: pts(b.target) })}>
              <span class="profile-all" style={{ width: pct(b.all) }} />
              <span class="profile-now" style={{ width: pct(b.now) }} />
              <span class="profile-target" style={{ left: pct(b.target) }} />
            </span>
            <span class="profile-value">{pts(b.all)} / {pts(b.target)}</span>
          </li>
        ))}
      </ul>
      <details class="chart-table">
        <summary>{t(lang, 'chart.table')}</summary>
        <table>
          <thead><tr><th scope="col">{t(lang, 'cp.skill')}</th><th scope="col">{t(lang, 'cp.passedPts')}</th><th scope="col">{t(lang, 'cp.plannedPts')}</th><th scope="col">{t(lang, 'cp.target')}</th></tr></thead>
          <tbody>{bars.map((b) => <tr key={b.skill}><th scope="row">{t(lang, `skill.${b.skill}`)}</th><td>{pts(b.now)}</td><td>{pts(b.all)}</td><td>{pts(b.target)}</td></tr>)}</tbody>
        </table>
      </details>
    </figure>
  )
}

/** Fit after each term, as a short row of columns. */
export function FitSteps({ lang, steps }: { lang: Lang; steps: { term: string; fit: number }[] }) {
  return (
    <div class="fit-steps" role="list" aria-label={t(lang, 'cp.byTerm')}>
      {steps.map((s) => (
        <div key={s.term} class="fit-step" role="listitem" aria-label={`${termName(lang, s.term)}: ${s.fit}%`}>
          <span class="fit-step-value">{s.fit}%</span>
          <span class="fit-step-bar"><span style={{ height: `${Math.max(2, s.fit)}%` }} /></span>
          <span class="fit-step-term">{s.term === PRIOR ? t(lang, 'chart.prior') : termName(lang, s.term)}</span>
        </div>
      ))}
    </div>
  )
}

/** Lecturers who teach what the path needs, with their modules. */
export function Experts({ lang, role, lens, career, rows }: { lang: Lang; role: Role; lens: Lens; career: CareerData; rows: ModuleRow[] }) {
  const experts = useMemo(() => expertsFor(role, lens, career, rows), [role, lens, career, rows])
  if (!experts.length) return <p class="career-section-lead">{t(lang, 'cp.noExperts')}</p>
  return (
    <ul class="plain expert-list">
      {experts.map((e) => (
        <li key={e.name} class="expert">
          <span class="expert-avatar" aria-hidden="true">{e.name.replace(/^(Prof\.|Dr\.|-Ing\.|Jun\.-|apl\.|PD|\s)+/g, '').split(' ').filter(Boolean).slice(0, 2).map((x) => x[0]).join('')}</span>
          <div class="expert-text">
            <strong>{e.name}</strong>
            <span>{e.modules.slice(0, 4).map((m, i) => <Fragment key={m.id}>{i > 0 && ' · '}<a href={courseHref(m.id)}>{m.title}</a></Fragment>)}{e.modules.length > 4 && ` +${e.modules.length - 4}`}</span>
          </div>
        </li>
      ))}
    </ul>
  )
}

interface AdProps {
  lang: Lang
  role: Role
  points: SkillPoints
  career: CareerData
  rows: ModuleRow[]
  state: UserState
  terms: string[]
  onAdd: (id: string, term: string, title: string) => void
}

/** Paste a job ad: the skills it asks for, how far the plan covers each, and courses for the weak ones. */
export function JobAdMatch({ lang, role, points, career, rows, state, terms, onAdd }: AdProps) {
  const [text, setText] = useState('')
  const matches = useMemo(() => matchJobAd(text), [text])
  const entries = roadmapEntries(state)
  const suggest = (skill: SkillId) => rows
    .filter((r) => !entries[r.id] && (career.skills.modules[r.id]?.[skill]?.[0] ?? 0) >= 2)
    .map((r) => ({ r, score: career.skills.modules[r.id]![skill]![0], term: terms.find((x) => offeringIssue(r, x) === null) ?? null }))
    .filter((x) => x.term).sort((a, b) => b.score - a.score || a.r.title.localeCompare(b.r.title)).slice(0, 2)
  return (
    <div class="job-ad">
      <label class="field">
        {t(lang, 'cp.adLabel')}
        <textarea rows={5} value={text} placeholder={t(lang, 'cp.adPlaceholder')} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} />
      </label>
      <p class="field-hint">{t(lang, 'cp.adPrivate')}</p>
      {text.trim() && !matches.length && <p class="career-section-lead">{t(lang, 'cp.adNone')}</p>}
      {matches.length > 0 && (
        <ul class="plain ad-results" aria-live="polite">
          {matches.map(({ skill, hits }) => {
            const cov = Math.round(skillCoverage(points, role, skill) * 100)
            return (
              <li key={skill} class={cov >= 100 ? 'is-met' : ''}>
                <div class="ad-head">
                  <strong>{t(lang, `skill.${skill}`)}</strong>
                  <span class="ad-hits">{hits.map((h) => <span key={h} class="tag tag-neutral">{h}</span>)}</span>
                  <span class="ad-cov">{t(lang, 'cr.covered', { n: Math.min(100, cov) })}</span>
                </div>
                <span class="meter"><span style={{ width: `${Math.min(100, cov)}%` }} /></span>
                {cov < 100 && suggest(skill).map(({ r, term }) => (
                  <div key={r.id} class="ad-suggest">
                    <a href={courseHref(r.id)}>{r.title}</a>
                    <span class="muted">{r.ects ?? '?'} ECTS · {termName(lang, term!)}</span>
                    <button type="button" class="button-ghost is-small" onClick={() => onAdd(r.id, term!, r.title)}
                      aria-label={`${t(lang, 'add.add')}: ${r.title}`}><Icon name="plus" size={14} />{t(lang, 'add.add')}</button>
                  </div>
                ))}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/** Coursework lines for a CV or LinkedIn, in English, ready to copy. */
export function Coursework({ lang, state, career, rows, role, lens }: { lang: Lang; state: UserState; career: CareerData; rows: ModuleRow[]; role: Role; lens: Lens }) {
  const [planned, setPlanned] = useState(false)
  const [grades, setGrades] = useState(false)
  const [copied, setCopied] = useState(false)
  const groups = courseworkLines(state, career, rows, role, lens, (s) => dictionaries.en[`skill.${s}`] ?? s, { planned, grades })
  const text = groups.length
    ? ['Relevant coursework (M.Sc. Computer Science, Karlsruhe Institute of Technology)', ...groups.map((g) => `${g.heading}: ${g.items.join(', ')}`)].join('\n')
    : ''
  return (
    <div class="coursework">
      <div class="coursework-options">
        <label class="switch"><input type="checkbox" checked={planned} onChange={(e) => { setPlanned((e.target as HTMLInputElement).checked); setCopied(false) }} />{t(lang, 'cp.cvPlanned')}</label>
        <label class="switch"><input type="checkbox" checked={grades} onChange={(e) => { setGrades((e.target as HTMLInputElement).checked); setCopied(false) }} />{t(lang, 'cp.cvGrades')}</label>
      </div>
      {text ? (
        <>
          <pre class="coursework-text" tabIndex={0} aria-label={t(lang, 'cp.cvTitle')}>{text}</pre>
          <button type="button" class="button-quiet" onClick={() => void navigator.clipboard?.writeText(text).then(() => setCopied(true), () => undefined)}>
            <Icon name={copied ? 'check' : 'copy'} size={16} />{t(lang, copied ? 'share.copied' : 'cp.cvCopy')}
          </button>
        </>
      ) : <p class="career-section-lead">{t(lang, planned ? 'cp.cvEmptyPlanned' : 'cp.cvEmpty')}</p>}
    </div>
  )
}
