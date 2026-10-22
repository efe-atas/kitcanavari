import { useState } from 'preact/hooks'
import { t } from '../../i18n'
import { AREAS } from '../../logic/degree'
import type { Matrix, RowId } from '../../logic/matrix'
import { CURRENT_TERM } from '../../logic/terms'
import { addTerm, setArea } from '../../store'
import type { Lang, UserState } from '../../types'
import { TermLink } from '../glossary/GlossaryView'
import { Icon } from '../Icon'
import { termName } from '../roadmap/format'
import { panelHref } from '../route'
import { CoursePill } from './CoursePill'
import { rowLabel } from './labels'

interface Props {
  lang: Lang
  state: UserState
  matrix: Matrix
  rows: RowId[]
  update: (fn: (s: UserState) => UserState) => void
  active: { term: string; row: RowId } | { id: string } | null
}

const ROW_TERM: Partial<Record<RowId, string>> = { area0: 'area', elective: 'elective', minor: 'minor' }

/** Row header for an area: the full name, with a small control to change it (a select cannot wrap long names). */
export function AreaHeader({ lang, state, slot, update, id }: { lang: Lang; state: UserState; slot: 0 | 1; update: Props['update']; id?: string }) {
  const name = (state.areas ?? [])[slot]
  const [editing, setEditing] = useState(false)
  if (!name || editing) return <AreaSelect lang={lang} state={state} slot={slot} update={(fn) => { update(fn); setEditing(false) }} id={id} />
  return (
    <span class="area-header">
      <span class="area-name">{name}</span>
      <button type="button" class="link-button area-change" id={id} onClick={() => setEditing(true)}
        aria-label={t(lang, 'plan.changeArea', { area: name })}>{t(lang, 'plan.change')}</button>
    </span>
  )
}

export function AreaSelect({ lang, state, slot, update, id }: { lang: Lang; state: UserState; slot: 0 | 1; update: Props['update']; id?: string }) {
  const chosen = state.areas ?? []
  return (
    <select id={id} class="area-select" aria-label={t(lang, slot === 0 ? 'plan.area1' : 'plan.area2')} value={chosen[slot] ?? ''}
      disabled={slot === 1 && !chosen[0]} onChange={(e) => update((s) => setArea(s, slot, (e.target as HTMLSelectElement).value || null))}>
      <option value="">{t(lang, slot === 0 ? 'plan.area1' : 'plan.area2')}</option>
      {AREAS.filter((a) => a === chosen[slot] || !chosen.includes(a)).map((a) => <option key={a} value={a}>{a}</option>)}
    </select>
  )
}

export function RowTotalCell({ lang, matrix, row }: { lang: Lang; matrix: Matrix; row: RowId }) {
  const total = matrix.rowTotals[row]
  if (row === 'other') return <span class="row-total muted">{total.cp} ECTS</span>
  const ok = total.cp >= total.min && (total.max === null || total.cp <= total.max)
  const lectureOk = total.lectureCp === undefined || total.lectureCp >= (total.lectureMin ?? 0)
  return (
    <span class={`row-total${ok && lectureOk ? ' is-done' : ' is-missing'}`}>
      <span><strong>{total.cp}</strong> / {total.max !== null ? `${total.min}–${total.max}` : total.min}</span>
      {total.lectureCp !== undefined && !lectureOk && (
        <span class="row-sub">{t(lang, 'plan.lectures', { n: total.lectureCp, min: total.lectureMin ?? 0 })}</span>
      )}
    </span>
  )
}

/** Desktop: requirement rows × term columns. */
export function PlanMatrix({ lang, state, matrix, rows, update, active }: Props) {
  const isTarget = (row: RowId, term: string) => !!active && 'row' in active && active.row === row && active.term === term
  return (
    <div class="plan-scroll">
      <table class="plan-table">
        <caption class="sr-only">{t(lang, 'plan.caption')}</caption>
        <thead>
          <tr>
            <th scope="col" class="corner">{t(lang, 'plan.countsIn')}</th>
            {matrix.columns.map((c) => (
              <th key={c} scope="col" class={c === CURRENT_TERM ? 'is-now' : undefined}>
                <span class="term-name">{termName(lang, c)}</span>
                {c === CURRENT_TERM && (
                  <a class="term-link-week" href={panelHref({ kind: 'week' })}><Icon name="calendar" size={14} />{t(lang, 'plan.week')}</a>
                )}
              </th>
            ))}
            <th scope="col" class="col-total">
              <button type="button" class="link-button" onClick={() => update(addTerm)}><Icon name="plus" size={14} />{t(lang, 'road.addTerm')}</button>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row}>
              <th scope="row">
                {row === 'area0' || row === 'area1'
                  ? <AreaHeader lang={lang} state={state} slot={row === 'area0' ? 0 : 1} update={update} id={row === 'area0' ? 'area-select-0' : undefined} />
                  : <span>{rowLabel(lang, state, row)}{ROW_TERM[row] && <TermLink id={ROW_TERM[row]!} lang={lang} />}</span>}
              </th>
              {matrix.columns.map((c) => {
                const items = matrix.cells[row][c]
                return (
                  <td key={c} class={`${c === CURRENT_TERM ? 'is-now' : ''}${isTarget(row, c) ? ' is-target' : ''}`}>
                    {items.map((it) => <CoursePill key={it.id} lang={lang} item={it} active={!!active && 'id' in active && active.id === it.id} />)}
                    {row !== 'other' && (
                      <a class={`cell-add${items.length ? ' is-small' : ''}`} href={panelHref({ kind: 'add', term: c, row, filter: null })}
                        aria-label={t(lang, 'plan.addHere', { row: rowLabel(lang, state, row), term: termName(lang, c) })}>
                        <Icon name="plus" size={14} />
                      </a>
                    )}
                  </td>
                )
              })}
              <td class="col-total"><RowTotalCell lang={lang} matrix={matrix} row={row} /></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">{t(lang, 'plan.termEcts')}</th>
            {matrix.columns.map((c) => (
              <td key={c} class={`${c === CURRENT_TERM ? 'is-now ' : ''}${matrix.colTotals[c] > 36 ? 'is-heavy' : ''}`}>
                <strong>{matrix.colTotals[c]}</strong>
                {matrix.colTotals[c] > 36 && <span class="row-sub">{t(lang, 'plan.heavy')}</span>}
              </td>
            ))}
            <td class="col-total" />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
