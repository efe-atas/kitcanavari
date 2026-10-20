import { useEffect, useRef } from 'preact/hooks'
import { t } from '../../i18n'
import { AREAS, ELECTIVE, IQ, MINOR, moduleKind, placed, RULES } from '../../logic/degree'
import type { CoursesFile, Lang, UserState } from '../../types'
import { BoardLegend, BucketBoard, type BoardChip, type BoardColumn, type ChipKind } from '../BucketBoard'

interface Props {
  lang: Lang
  data: CoursesFile
  state: UserState
  onOpen: (eventId: string) => void
}

/** The guide's bucket infographic, filled live with this term's selection. */
export function PlanBoard({ lang, data, state, onOpen }: Props) {
  const items = placed(state, data)
  const chosen = (state.areas ?? []).slice(0, 2)
  const otherAreas = [...new Set(items.map((x) => x.bucket).filter((b) => AREAS.includes(b) && !chosen.includes(b)))]

  const areaCols: BoardColumn[] = [0, 1].map((i) => ({
    id: chosen[i] ?? `area-${i}`,
    title: t(lang, 'deg.area', { n: i + 1 }),
    sub: chosen[i] ?? t(lang, 'deg.noArea'),
    min: RULES.areaMin,
    empty: chosen[i] ? undefined : t(lang, 'board.pickArea'),
  }))
  const columns: BoardColumn[] = [
    ...areaCols,
    ...otherAreas.map((a) => ({ id: a, title: a, sub: t(lang, 'board.notChosen'), min: RULES.areaMin })),
    { id: ELECTIVE, title: t(lang, 'bucket.elective'), sub: 'Elective Studies', min: RULES.electiveMin, max: RULES.electiveMax },
    { id: MINOR, title: t(lang, 'bucket.minor'), sub: 'Minor Studies', min: RULES.minorMin, max: RULES.minorMax },
    { id: IQ, title: t(lang, 'bucket.iq'), sub: 'HoC, FORUM, SpZ', min: RULES.iqMin, max: RULES.iqMax },
    { id: 'thesis', title: t(lang, 'board.thesis'), sub: t(lang, 'board.later'), min: RULES.thesis },
  ]

  // Chips that were not on the board in the previous render get the "just added" highlight.
  const seen = useRef<Set<string> | null>(null)
  const chips: BoardChip[] = items.map(({ eventId, m, bucket }) => {
    const kind: ChipKind = bucket === MINOR ? 'minor' : bucket === IQ ? 'iq' : moduleKind(data, m)
    return {
      key: eventId,
      title: data.events[eventId]?.title ?? m.title,
      ects: m.ects ?? 0,
      kind,
      col: bucket,
      fresh: seen.current !== null && !seen.current.has(eventId),
    }
  })
  useEffect(() => { seen.current = new Set(chips.map((c) => c.key)) })

  return (
    <section class="plan-board" aria-labelledby="plan-board-title">
      <div class="plan-board-head">
        <h3 id="plan-board-title">{t(lang, 'board.title')}</h3>
        <p>{t(lang, 'board.lead')}</p>
      </div>
      <BucketBoard lang={lang} columns={columns} chips={chips} onChip={onOpen} />
      <BoardLegend lang={lang} kinds={['stamm', 'lecture', 'seminar', 'practical', 'minor', 'iq']} />
    </section>
  )
}
