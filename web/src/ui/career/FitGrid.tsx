import { t } from '../../i18n'
import { fit, type SkillPoints } from '../../logic/career'
import type { CareerData, Lang } from '../../types'
import { Icon } from '../Icon'

interface Props {
  lang: Lang
  career: CareerData
  points: { all: SkillPoints; now: SkillPoints }
  followed: { role: string; lens: string }[]
  selected: { role: string; lens: string } | null
  onSelect: (role: string, lens: string) => void
}

export function FitGrid({ lang, career, points, followed, selected, onSelect }: Props) {
  const { roles } = career.roles
  const { lenses } = career.lenses
  return (
    <div class="fit-scroll">
      <table class="fit-grid" aria-label={t(lang, 'career.gridCaption')}>
        <thead>
          <tr>
            <th scope="col" />
            {lenses.map((l) => <th key={l.id} scope="col">{l.title[lang]}</th>)}
          </tr>
        </thead>
        <tbody>
          {roles.map((r) => (
            <tr key={r.id}>
              <th scope="row">{r.title[lang]}</th>
              {lenses.map((l) => {
                const all = fit(points.all, r, l)
                const now = fit(points.now, r, l)
                const on = followed.some((f) => f.role === r.id && f.lens === l.id)
                const picked = selected?.role === r.id && selected.lens === l.id
                return (
                  <td key={l.id}>
                    <button type="button" class={`fit-cell${picked ? ' is-picked' : ''}`} style={{ '--fit': all / 100 }}
                      aria-pressed={picked}
                      aria-label={`${r.title[lang]} · ${l.title[lang]}: ${t(lang, 'career.cell', { n: all, now })}`}
                      onClick={() => onSelect(r.id, l.id)}>
                      <strong>{all}%</strong>
                      <span class="fit-now">{now}%</span>
                      {on && <span class="fit-star"><Icon name="check" size={12} /></span>}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
