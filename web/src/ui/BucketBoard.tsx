import type { Lang } from '../types'
import { Icon } from './Icon'

export type ChipKind = 'stamm' | 'lecture' | 'seminar' | 'practical' | 'minor' | 'iq' | 'thesis'

export interface BoardColumn {
  id: string
  title: string
  sub: string
  min: number
  max?: number
  /** Shown inside the bucket while it is empty. */
  empty?: string
}

export interface BoardChip {
  key: string
  title: string
  ects: number
  kind: ChipKind
  col: string
  /** Highlighted as just added. */
  fresh?: boolean
}

export const KIND_LABELS: Record<Lang, Record<ChipKind, string>> = {
  tr: { stamm: 'Stammmodul', lecture: 'Normal ders', seminar: 'Seminer', practical: 'Praktikum', minor: 'Yan dal', iq: 'Disiplinlerarası', thesis: 'Tez' },
  en: { stamm: 'Advanced mandatory', lecture: 'Lecture', seminar: 'Seminar', practical: 'Practical', minor: 'Minor', iq: 'Interdisciplinary', thesis: 'Thesis' },
}

/** Degree parts as buckets; each chip is a module whose height is its ECTS. */
export function BucketBoard({ lang, columns, chips, onChip }: {
  lang: Lang
  columns: BoardColumn[]
  chips: BoardChip[]
  onChip?: (key: string) => void
}) {
  const totals = columns.map((col) => chips.filter((x) => x.col === col.id).reduce((n, x) => n + x.ects, 0))
  // Buckets are at least 32 ECTS tall and grow when a plan overfills one.
  const scale = Math.max(32, ...totals.map((n) => n + 2))
  const minWord = lang === 'tr' ? 'en az' : 'min'

  return (
    <div class="board-wrap">
      <div class="board" style={{ '--scale': scale }} role="img"
        aria-label={columns.map((col, i) => `${col.title}: ${totals[i]} ECTS`).join(', ')}>
        {columns.map((col, i) => {
          const met = totals[i] >= col.min && (col.max === undefined || totals[i] <= col.max)
          const over = col.max !== undefined && totals[i] > col.max
          return (
            <div key={col.id} class={`bucket${totals[i] > 0 && met ? ' is-met' : ''}${over ? ' is-over' : ''}`}>
              <div class="bucket-head">
                <strong>{col.title}</strong>
                <span>{col.sub}</span>
              </div>
              <div class="bucket-body">
                <span class="floor" style={{ bottom: `calc(var(--unit) * ${col.min})` }} />
                {col.empty && totals[i] === 0 && <span class="bucket-empty">{col.empty}</span>}
                <div class="stack">
                  {chips.filter((x) => x.col === col.id).map((x) => {
                    const body = (
                      <>
                        <span class="chip-title">{x.title}</span>
                        <span class="chip-ects">{x.ects}</span>
                      </>
                    )
                    const cls = `chip-block kind-${x.kind}${x.fresh ? ' is-new' : ''}`
                    const style = { height: `calc(var(--unit) * ${x.ects} - 3px)` }
                    const title = `${x.title} · ${x.ects} ECTS · ${KIND_LABELS[lang][x.kind]}`
                    return onChip
                      ? <button key={x.key} type="button" class={cls} style={style} title={title} onClick={() => onChip(x.key)}>{body}</button>
                      : <div key={x.key} class={cls} style={style} title={title}>{body}</div>
                  })}
                </div>
              </div>
              <div class="bucket-foot">
                {totals[i] > 0 && met && <Icon name="check" size={13} />}
                {over && <Icon name="alert" size={13} />}
                <strong>{totals[i]}</strong>
                <span>/ {col.max !== undefined ? `${col.min}–${col.max}` : `${minWord} ${col.min}`}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function BoardLegend({ lang, kinds }: { lang: Lang; kinds: ChipKind[] }) {
  return (
    <ul class="legend" aria-label={lang === 'tr' ? 'Renkler' : 'Legend'}>
      {kinds.map((k) => <li key={k}><span class={`legend-swatch kind-${k}`} />{KIND_LABELS[lang][k]}</li>)}
    </ul>
  )
}
