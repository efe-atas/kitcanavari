import { useMemo, useState } from 'preact/hooks'
import { t } from '../../i18n'
import { planFigures, scenarioState } from '../../logic/advisor'
import { EMPTY_HANDBOOK, moduleRows } from '../../logic/handbook'
import { adoptPlan, removeScenario, saveScenario } from '../../store'
import type { CareerData, CoursesFile, HandbookFile, Scenario, UserState } from '../../types'
import { Icon } from '../Icon'
import { termName } from '../roadmap/format'
import { useToast } from '../toast'

interface Props {
  data: CoursesFile
  handbook: HandbookFile | null
  career: CareerData | null
  state: UserState
  update: (fn: (s: UserState) => UserState) => void
}

/** Saved alternative plans next to the current one: credits, open rules, thesis term and career fit. */
export function Scenarios({ data, handbook, career, state, update }: Props) {
  const { lang } = state
  const toast = useToast()
  const [name, setName] = useState('')
  const rows = useMemo(() => moduleRows(data, handbook ?? EMPTY_HANDBOOK), [data, handbook])
  const list = state.scenarios ?? []
  const figures = useMemo(() => [
    { id: null as string | null, name: t(lang, 'sc.current'), f: planFigures(state, data, handbook, career, rows), sc: null as Scenario | null },
    ...list.map((sc) => ({ id: sc.id, name: sc.name, f: planFigures(scenarioState(state, sc), data, handbook, career, rows), sc })),
  ], [state, data, handbook, career, rows, lang])
  const load = (sc: Scenario) => {
    const before = state
    update((s) => adoptPlan(s, data, { areas: sc.areas, terms: sc.roadmap.terms, modules: sc.roadmap.modules }))
    toast({ message: t(lang, 'sc.loaded', { name: sc.name }), action: { label: t(lang, 'toast.undo'), run: () => update(() => before) } })
  }
  const best = (pick: (f: (typeof figures)[number]['f']) => number | null, low = false) => {
    const vals = figures.map((x) => pick(x.f)).filter((v): v is number => v !== null)
    return vals.length > 1 ? (low ? Math.min(...vals) : Math.max(...vals)) : null
  }
  const bestEcts = best((f) => f.ects)
  const bestOpen = best((f) => f.open, true)
  const bestFit = best((f) => f.fit)

  return (
    <section class="card scenarios" aria-labelledby="sc-title">
      <header class="card-head">
        <div><h2 id="sc-title">{t(lang, 'sc.title')}</h2><p>{t(lang, 'sc.lead')}</p></div>
        <Icon name="swap" size={22} />
      </header>
      <form class="sc-save" onSubmit={(e) => { e.preventDefault(); update((s) => saveScenario(s, name || t(lang, 'sc.defaultName', { n: list.length + 1 }))); setName('') }}>
        <label class="field">{t(lang, 'sc.name')}<input type="text" value={name} placeholder={t(lang, 'sc.defaultName', { n: list.length + 1 })} onInput={(e) => setName((e.target as HTMLInputElement).value)} /></label>
        <button type="submit" class="button-quiet"><Icon name="plus" size={15} />{t(lang, 'sc.save')}</button>
      </form>
      {list.length > 0 ? (
        <div class="table-scroll">
          <table class="sc-table">
            <thead><tr><th scope="col">{t(lang, 'sc.plan')}</th><th scope="col">ECTS</th><th scope="col">{t(lang, 'sc.open')}</th><th scope="col">{t(lang, 'sc.thesis')}</th>{figures[0].f.fit !== null && <th scope="col">{t(lang, 'sc.fit')}</th>}<th scope="col"><span class="sr-only">{t(lang, 'sc.actions')}</span></th></tr></thead>
            <tbody>
              {figures.map((x) => (
                <tr key={x.id ?? 'current'} class={x.id ? '' : 'is-current'}>
                  <th scope="row">{x.name}</th>
                  <td class={x.f.ects === bestEcts ? 'is-best' : ''}>{x.f.ects}</td>
                  <td class={x.f.open === bestOpen ? 'is-best' : ''}>{x.f.open}</td>
                  <td>{x.f.thesisTerm ? termName(lang, x.f.thesisTerm) : '—'}</td>
                  {figures[0].f.fit !== null && <td class={x.f.fit === bestFit ? 'is-best' : ''}>{x.f.fit ?? '—'}%</td>}
                  <td class="sc-actions">
                    {x.sc && <>
                      <button type="button" class="button-ghost is-small" onClick={() => load(x.sc!)} aria-label={t(lang, 'sc.loadLabel', { name: x.name })}>{t(lang, 'sc.load')}</button>
                      <button type="button" class="icon-button" onClick={() => update((s) => removeScenario(s, x.id!))} aria-label={t(lang, 'sc.remove', { name: x.name })}><Icon name="trash" size={15} /></button>
                    </>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p class="card-empty">{t(lang, 'sc.empty')}</p>}
    </section>
  )
}
