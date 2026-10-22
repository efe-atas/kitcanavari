import { t } from '../../i18n'
import { gaps, lensWeights, type SkillPoints } from '../../logic/career'
import type { ModuleRow } from '../../logic/handbook'
import { roadmapEntries } from '../../logic/roadmap'
import { MAX_FOLLOWED, placeModule, toggleFollow } from '../../store'
import type { CareerData, Lang, SkillId, UserState } from '../../types'
import { Icon } from '../Icon'
import { termName } from '../roadmap/format'
import { pathTitle, roleTitle } from './model'

interface Props {
  lang: Lang
  career: CareerData
  role: string
  lens: string
  points: { all: SkillPoints; now: SkillPoints }
  rows: ModuleRow[]
  terms: string[]
  state: UserState
  update: (fn: (s: UserState) => UserState) => void
}

export function PathDetail({ lang, career, role: roleId, lens: lensId, points, rows, terms, state, update }: Props) {
  const role = career.roles.roles.find((r) => r.id === roleId)!
  const lens = career.lenses.lenses.find((l) => l.id === lensId)!
  const title = pathTitle(career, roleId, lensId, lang)
  const byId = new Map(rows.map((r) => [r.id, r]))
  const w = lensWeights(role, lens)
  const skills = (Object.entries(w) as [SkillId, number][]).filter(([, x]) => x > 0).sort((a, b) => b[1] - a[1])
  const g = gaps(points.all, role, lens, rows, roadmapEntries(state), career, terms)
  const followed = state.followed ?? []
  const on = followed.some((f) => f.role === roleId && f.lens === lensId)
  const full = !on && followed.length >= MAX_FOLLOWED
  const bands = [...lens.salary].sort((a, b) => Number(b.role === roleId) - Number(a.role === roleId))

  return (
    <section class="panel path-detail" aria-label={title}>
      <header class="path-head">
        <div>
          <h3>{title}</h3>
          <p class="panel-sub">{role.summary[lang]}</p>
        </div>
        <button type="button" class={on ? 'button-quiet' : 'button'} disabled={full} title={full ? t(lang, 'career.followLimit') : undefined}
          onClick={() => update((s) => toggleFollow(s, roleId, lensId))}>
          {t(lang, on ? 'career.unfollow' : 'career.follow')}
        </button>
      </header>

      <div class="path-grid">
        <div>
          <h4>{t(lang, 'career.skills')}</h4>
          <ul class="plain skill-bars">
            {skills.map(([s, x]) => {
              const target = role.targets[s] ?? 0
              const have = Math.round(points.all[s] * 10) / 10
              return (
                <li key={s}>
                  <span class="skill-name">{t(lang, `skill.${s}`)} <span class="muted">{Math.round(x * 100)}%</span></span>
                  <span class="muted">{have} / {target}</span>
                  <span class="req-bar" aria-hidden="true"><span style={{ width: `${Math.min(100, (points.all[s] / (target || 1)) * 100)}%` }} /></span>
                </li>
              )
            })}
          </ul>

          <h4>{t(lang, 'career.gaps')}</h4>
          {g.length ? (
            <ol class="gap-list">
              {g.map((gap) => (
                <li key={gap.skill}>
                  <strong>{t(lang, `skill.${gap.skill}`)}</strong> <span class="muted">{Math.round(gap.coverage * 100)}%</span>
                  {gap.modules.length ? (
                    <ul class="plain">
                      {gap.modules.map((m) => {
                        const row = byId.get(m.id)
                        return (
                          <li key={m.id} class="gap-module">
                            <span>{row?.title ?? m.id} <span class="muted">· {row?.ects ?? '?'} ECTS · {m.term ? termName(lang, m.term) : ''}</span></span>
                            <button type="button" class="link-button" aria-label={`${t(lang, 'career.addToRoadmap')}: ${row?.title ?? m.id}`}
                              onClick={() => m.term && update((s) => placeModule(s, m.id, m.term!))}>
                              <Icon name="plus" size={14} />{t(lang, 'career.addToRoadmap')}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  ) : <p class="muted">{t(lang, 'career.noSuggestion')}</p>}
                </li>
              ))}
            </ol>
          ) : <p class="muted">{t(lang, 'career.noGaps')}</p>}
        </div>

        <div class="lens-info">
          <h4>{lens.title[lang]}</h4>
          <p><strong>{t(lang, 'career.cities')}:</strong> {lens.cities.join(', ')}</p>
          <h5>{t(lang, 'career.salary')}</h5>
          {bands.length ? (
            <ul class="plain salary-list">
              {bands.map((b, i) => (
                <li key={i} class={b.role === roleId ? 'is-role' : ''}>
                  <span class="muted">{roleTitle(career, b.role, lang)}:</span> {b.band}{' '}
                  <a class="ext-link" href={b.source} target="_blank" rel="noopener">{t(lang, 'career.source')} {b.asOf}<Icon name="external" size={12} /></a>
                </li>
              ))}
            </ul>
          ) : <p class="muted">{t(lang, 'career.noSalary')}</p>}
          <h5>{t(lang, 'career.interview')}</h5>
          <p>{lens.interview[lang]}</p>
          <h5>{t(lang, 'career.offCourse')}</h5>
          <ul>{lens.offCourse[lang].map((x) => <li key={x}>{x}</li>)}</ul>
          <h5>{t(lang, 'career.downsides')}</h5>
          <ul>{lens.downsides[lang].map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      </div>
    </section>
  )
}
