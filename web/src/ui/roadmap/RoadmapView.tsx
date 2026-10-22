import { useMemo } from 'preact/hooks'
import { t } from '../../i18n'
import { roadmapReport } from '../../logic/degree'
import { moduleRows, type ModuleRow } from '../../logic/handbook'
import { derivedEntries, roadmapEntries } from '../../logic/roadmap'
import { DEFAULT_TERMS, PRIOR } from '../../logic/terms'
import { addTerm, placeModule } from '../../store'
import type { CoursesFile, HandbookFile, UserState } from '../../types'
import { Icon } from '../Icon'
import { AddModule } from './AddModule'
import { termName } from './format'
import { RoadmapDegreePanel } from './RoadmapDegreePanel'
import { RoadmapEntryCard } from './RoadmapEntryCard'

interface Props {
  data: CoursesFile
  handbook: HandbookFile | null
  state: UserState
  update: (fn: (s: UserState) => UserState) => void
}

const NO_HANDBOOK: HandbookFile = { meta: { source: '', asOf: '', parsedAt: '' }, modules: {} }

export function RoadmapView({ data, handbook, state, update }: Props) {
  const { lang } = state
  const rows = useMemo(() => moduleRows(data, handbook ?? NO_HANDBOOK), [data, handbook])
  const byId = useMemo(() => new Map<string, ModuleRow>(rows.map((r) => [r.id, r])), [rows])
  const entries = roadmapEntries(state)
  const inSchedule = new Set(Object.keys(derivedEntries(state)))
  const taken = new Set(Object.keys(entries))
  const terms = state.roadmap?.terms ?? DEFAULT_TERMS
  const report = useMemo(() => roadmapReport(state, data, handbook), [state, data, handbook])

  return (
    <div class="roadmap">
      <header class="page-head">
        <h2>{t(lang, 'tab.roadmap')}</h2>
        <p class="result-count">{t(lang, 'road.summary', { n: report.all.total, done: report.done.total })}</p>
      </header>
      <div class="road-columns">
        {[PRIOR, ...terms].map((term) => {
          const label = termName(lang, term)
          const here = Object.entries(entries).filter(([, e]) => e.term === term)
          const cp = here.reduce((n, [id, e]) => n + (e.status === 'passed' || e.status === 'planned' ? byId.get(id)?.ects ?? 0 : 0), 0)
          return (
            <section key={term} class="road-column" aria-label={label}>
              <header class="road-column-head">
                <h3>{label}</h3>
                <span class="muted">{t(lang, 'module.ects', { n: cp })}</span>
              </header>
              <ul class="plain road-list">
                {here.map(([id, e]) => (
                  <RoadmapEntryCard key={id} lang={lang} data={data} id={id} entry={e} row={byId.get(id) ?? null}
                    note={state.roadmap?.notes[id] ?? ''} inSchedule={inSchedule.has(id)} terms={terms} update={update} />
                ))}
              </ul>
              <AddModule lang={lang} term={term} termLabel={label} rows={rows} taken={taken}
                onAdd={(id) => update((s) => placeModule(s, id, term))} />
            </section>
          )
        })}
        <button type="button" class="button-quiet road-add-term" onClick={() => update(addTerm)}>
          <Icon name="plus" size={16} />{t(lang, 'road.addTerm')}
        </button>
      </div>
      <RoadmapDegreePanel lang={lang} report={report} state={state} update={update} />
    </div>
  )
}
