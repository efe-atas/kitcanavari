import { useEffect, useMemo, useState } from 'preact/hooks'
import { t } from '../../i18n'
import { EMPTY_HANDBOOK, moduleRows } from '../../logic/handbook'
import { DEFAULT_TERMS, remainingTerms } from '../../logic/terms'
import { setFollow } from '../../store'
import type { CareerData, CoursesFile, HandbookFile, UserState } from '../../types'
import { FitGrid } from './FitGrid'
import { pathTitle, pointsOf } from './model'
import { PathDetail } from './PathDetail'

interface Props {
  data: CoursesFile
  handbook: HandbookFile | null
  career: CareerData | null
  /** "role:lens" from the route (#/career/role:lens) to open that path. */
  focus: string | null
  state: UserState
  update: (fn: (s: UserState) => UserState) => void
}

export function CareerView({ data, handbook, career, focus, state, update }: Props) {
  const { lang } = state
  const rows = useMemo(() => moduleRows(data, handbook ?? EMPTY_HANDBOOK), [data, handbook])
  const fromRoute = () => {
    const [role, lens] = (focus ?? '').split(':')
    return role && lens ? { role, lens } : null
  }
  const [selected, setSelected] = useState<{ role: string; lens: string } | null>(fromRoute)
  useEffect(() => { const f = fromRoute(); if (f) setSelected(f) }, [focus])
  const points = useMemo(() => (career ? pointsOf(state, career, rows) : null), [state, career, rows])
  if (!career || !points) return <p class="empty">{t(lang, 'career.none')}</p>
  const unscored = rows.filter((r) => !career.skills.modules[r.id]).length
  const known = (f: { role: string; lens: string }) =>
    career.roles.roles.some((r) => r.id === f.role) && career.lenses.lenses.some((l) => l.id === f.lens)
  const stale = (state.followed ?? []).filter((f) => !known(f))
  const valid = selected && known(selected) ? selected : null

  return (
    <div class="career">
      <header class="page-head">
        <h2>{t(lang, 'tab.career')}</h2>
      </header>
      <p class="scope-note">{t(lang, 'career.sub')}</p>
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
      <FitGrid lang={lang} career={career} points={points} followed={state.followed ?? []} selected={selected}
        onSelect={(role, lens) => setSelected({ role, lens })} />
      {valid && (
        <PathDetail lang={lang} career={career} role={valid.role} lens={valid.lens} points={points} rows={rows}
          terms={remainingTerms(state.roadmap?.terms ?? DEFAULT_TERMS)} state={state} update={update} />
      )}
    </div>
  )
}
