import { t } from '../../i18n'
import type { Matrix, RowId } from '../../logic/matrix'
import { CURRENT_TERM } from '../../logic/terms'
import { addTerm } from '../../store'
import type { Lang, UserState } from '../../types'
import { Icon } from '../Icon'
import { termName } from '../roadmap/format'
import { panelHref } from '../route'
import { CoursePill } from './CoursePill'
import { rowLabel } from './labels'
import { AreaSelect, RowTotalCell } from './PlanMatrix'

interface Props {
  lang: Lang
  state: UserState
  matrix: Matrix
  rows: RowId[]
  update: (fn: (s: UserState) => UserState) => void
  active: { term: string; row: RowId } | { id: string } | null
}

/** Phones: one card per term, top to bottom. */
export function TermCards({ lang, state, matrix, rows, update, active }: Props) {
  return (
    <div class="term-cards">
      <section class="term-card areas-card" aria-label={t(lang, 'plan.areas')}>
        <h3>{t(lang, 'plan.areas')}</h3>
        <AreaSelect lang={lang} state={state} slot={0} update={update} id="area-select-0" />
        <AreaSelect lang={lang} state={state} slot={1} update={update} />
        <ul class="plain card-totals">
          {rows.map((row) => <li key={row}><span>{rowLabel(lang, state, row)}</span><RowTotalCell lang={lang} matrix={matrix} row={row} /></li>)}
        </ul>
      </section>
      {matrix.columns.map((c) => (
        <section key={c} class={`term-card${c === CURRENT_TERM ? ' is-now' : ''}`} aria-label={termName(lang, c)}>
          <header>
            <h3>{termName(lang, c)}</h3>
            <span class="muted">{matrix.colTotals[c]} ECTS</span>
            {c === CURRENT_TERM && <a class="term-link-week" href={panelHref({ kind: 'week' })}><Icon name="calendar" size={14} />{t(lang, 'plan.week')}</a>}
          </header>
          <ul class="plain">
            {rows.filter((r) => r !== 'other' || matrix.cells[r][c].length).map((row) => (
              <li key={row} class="card-row">
                <span class="card-row-label">{rowLabel(lang, state, row)}</span>
                <span class="card-row-items">
                  {matrix.cells[row][c].map((it) => <CoursePill key={it.id} lang={lang} item={it} active={!!active && 'id' in active && active.id === it.id} />)}
                  {row !== 'other' && (
                    <a class="cell-add is-small" href={panelHref({ kind: 'add', term: c, row, filter: null })}
                      aria-label={t(lang, 'plan.addHere', { row: rowLabel(lang, state, row), term: termName(lang, c) })}>
                      <Icon name="plus" size={14} />
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <button type="button" class="button-quiet" onClick={() => update(addTerm)}><Icon name="plus" size={14} />{t(lang, 'road.addTerm')}</button>
    </div>
  )
}
