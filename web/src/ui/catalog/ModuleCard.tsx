import { t } from '../../i18n'
import { moduleAreas, moduleKind } from '../../logic/degree'
import type { ModuleRow } from '../../logic/handbook'
import type { CoursesFile, Lang } from '../../types'
import { Icon } from '../Icon'

interface Props {
  lang: Lang
  data: CoursesFile
  row: ModuleRow
  /** The user's chosen areas of specialization. */
  myAreas: string[]
  onOpen: () => void
}

export function ModuleCard({ lang, data, row, myAreas, onOpen }: Props) {
  const kind = moduleKind(data, row)
  const mine = moduleAreas(row).filter((a) => myAreas.includes(a))
  return (
    <li class={`card module-card${row.eventIds.length ? ' is-offered' : ''}`}>
      <button type="button" class="card-main" onClick={onOpen}>
        <span class="card-head">
          <span class="card-number">{row.id}</span>
          {row.eventIds.length > 0 && <span class="offered-mark"><Icon name="check" size={12} />{t(lang, 'module.offeredNow')}</span>}
        </span>
        <span class="card-title">{row.title}</span>
        <span class="card-tags">
          {kind !== 'lecture' && <span class={`tag tag-${kind}`}>{t(lang, `kind.${kind}`)}</span>}
          <span class="tag tag-quiet">{t(lang, `rec.${row.recurrence}`)}</span>
          {mine.map((a) => <span key={a} class="tag tag-area"><Icon name="check" size={12} />{a}</span>)}
        </span>
        <span class="card-meta">
          {row.ects !== null && <span class="card-ects">{t(lang, 'module.ects', { n: row.ects })}</span>}
          {row.hb?.coordinators.length ? <span class="muted">{row.hb.coordinators.join(', ')}</span> : null}
        </span>
      </button>
    </li>
  )
}
