import { useMemo, useState } from 'preact/hooks'
import { t } from '../../i18n'
import { EMPTY_HANDBOOK, moduleRows } from '../../logic/handbook'
import { DEFAULT_TERMS } from '../../logic/terms'
import type { CareerData, CoursesFile, HandbookFile, UserState } from '../../types'
import { FitGrid } from './FitGrid'
import { pointsOf } from './model'
import { PathDetail } from './PathDetail'

interface Props {
  data: CoursesFile
  handbook: HandbookFile | null
  career: CareerData | null
  state: UserState
  update: (fn: (s: UserState) => UserState) => void
}

export function CareerView({ data, handbook, career, state, update }: Props) {
  const { lang } = state
  const rows = useMemo(() => moduleRows(data, handbook ?? EMPTY_HANDBOOK), [data, handbook])
  const [selected, setSelected] = useState<{ role: string; lens: string } | null>(null)
  const points = useMemo(() => (career ? pointsOf(state, career, rows) : null), [state, career, rows])
  if (!career || !points) return <p class="empty">{t(lang, 'career.none')}</p>
  const unscored = rows.filter((r) => !career.skills.modules[r.id]).length

  return (
    <div class="career">
      <header class="page-head">
        <h2>{t(lang, 'tab.career')}</h2>
      </header>
      <p class="scope-note">{t(lang, 'career.sub')}</p>
      {unscored > 0 && <p class="banner banner-warn">{t(lang, 'career.unscored', { n: unscored })}</p>}
      <FitGrid lang={lang} career={career} points={points} followed={state.followed ?? []} selected={selected}
        onSelect={(role, lens) => setSelected({ role, lens })} />
      {selected && (
        <PathDetail lang={lang} career={career} role={selected.role} lens={selected.lens} points={points} rows={rows}
          terms={state.roadmap?.terms ?? DEFAULT_TERMS} state={state} update={update} />
      )}
    </div>
  )
}
