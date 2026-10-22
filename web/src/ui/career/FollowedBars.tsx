import { t } from '../../i18n'
import { fit } from '../../logic/career'
import type { ModuleRow } from '../../logic/handbook'
import type { CareerData, Lang, UserState } from '../../types'
import { pathTitle, pointsOf } from './model'

/** Fit of the followed career paths, for the roadmap. */
export function FollowedBars({ lang, career, rows, state }: { lang: Lang; career: CareerData; rows: ModuleRow[]; state: UserState }) {
  const followed = (state.followed ?? []).filter((f) =>
    career.roles.roles.some((r) => r.id === f.role) && career.lenses.lenses.some((l) => l.id === f.lens))
  if (!followed.length) return null
  const points = pointsOf(state, career, rows)
  return (
    <section class="panel followed" aria-label={t(lang, 'career.followed')}>
      <h3>{t(lang, 'career.followed')}</h3>
      <ul class="plain skill-bars">
        {followed.map((f) => {
          const role = career.roles.roles.find((r) => r.id === f.role)!
          const lens = career.lenses.lenses.find((l) => l.id === f.lens)!
          const all = fit(points.all, role, lens)
          const now = fit(points.now, role, lens)
          return (
            <li key={`${f.role}-${f.lens}`}>
              <a class="skill-name" href="#/career">{pathTitle(career, f.role, f.lens, lang)}</a>
              <span class="muted">{t(lang, 'career.cell', { n: all, now })}</span>
              <span class="req-bar" aria-hidden="true"><span style={{ width: `${all}%` }} /></span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
