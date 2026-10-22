import { useMemo, useState } from 'preact/hooks'
import { t } from '../../i18n'
import { findConflicts } from '../../logic/conflicts'
import { AREAS, moduleAreas } from '../../logic/degree'
import { computeEcts } from '../../logic/ects'
import { emptyFilters, eventModules, filterEvents, type Filters as F } from '../../logic/filter'
import { emptyModuleFilters, filterModules, moduleRows, type ModuleFilters as MF } from '../../logic/handbook'
import { roadmapEntries } from '../../logic/roadmap'
import { DEFAULT_TERMS } from '../../logic/terms'
import { addEvent, placeModule, removeEvent } from '../../store'
import type { CoursesFile, Event, HandbookFile, UserState } from '../../types'
import { fmtDate } from '../format'
import { TermLink } from '../glossary/GlossaryView'
import { Icon } from '../Icon'
import { EventCard } from './EventCard'
import { EventDetail } from './EventDetail'
import { Filters } from './Filters'
import { ModuleCard } from './ModuleCard'
import { ModuleDetail } from './ModuleDetail'
import { ModuleFilters } from './ModuleFilters'
import { Tree } from './Tree'

interface Props {
  data: CoursesFile
  handbook: HandbookFile | null
  /** Show every handbook module instead of this term's courses (route #/catalog/all). */
  allModules: boolean
  state: UserState
  update: (fn: (s: UserState) => UserState) => void
}

const uniq = <T,>(xs: (T | null | undefined)[]) => [...new Set(xs.filter((x): x is T => x !== null && x !== undefined))]

export function conflictingIds(data: CoursesFile, state: UserState): Set<string> {
  const out = new Set<string>()
  for (const c of findConflicts(state.selected, data.events)) out.add(c.a).add(c.b)
  for (const ev of Object.values(data.events)) {
    if (state.selected[ev.id]) continue
    const trial = { ...state.selected, [ev.id]: { enabledSlots: ev.slots.map((_, i) => i), moduleId: null, ackFingerprint: '' } }
    if (findConflicts(trial, data.events).some((c) => c.a === ev.id || c.b === ev.id)) out.add(ev.id)
  }
  return out
}

export function CatalogView({ data, handbook, allModules, state, update }: Props) {
  const { lang } = state
  const [filters, setFilters] = useState<F>(emptyFilters)
  const [openId, setOpenId] = useState<string | null>(null)
  const [treeOpen, setTreeOpen] = useState(false)
  const [moduleFilters, setModuleFilters] = useState<MF>(emptyModuleFilters)
  const [openModuleId, setOpenModuleId] = useState<string | null>(null)
  const rows = useMemo(() => (handbook ? moduleRows(data, handbook) : []), [data, handbook])
  const moduleList = useMemo(() => filterModules(data, rows, moduleFilters), [data, rows, moduleFilters])
  const moduleOptions = useMemo(() => ({
    ects: uniq(rows.map((r) => r.ects)).sort((a, b) => a - b),
    areas: AREAS.filter((a) => rows.some((r) => moduleAreas(r).includes(a))),
  }), [rows])
  const showModules = allModules && !!handbook
  const openModule = openModuleId ? rows.find((r) => r.id === openModuleId) ?? null : null

  const options = useMemo(() => {
    const evs = Object.values(data.events)
    const mods = evs.flatMap((e) => eventModules(data, e))
    return {
      types: uniq(evs.map((e) => e.typeCode)).sort(),
      languages: uniq(evs.map((e) => e.language)).sort(),
      ects: uniq(mods.map((m) => m.ects)).sort((a, b) => a - b),
      areas: AREAS.filter((a) => mods.some((m) => moduleAreas(m).includes(a))),
    }
  }, [data])

  const list = useMemo(() => filterEvents(data, filters, state), [data, filters, state])
  const conflicts = useMemo(() => conflictingIds(data, state), [data, state.selected])
  const toggle = (ev: Event) => update((s) => (s.selected[ev.id] ? removeEvent(s, ev.id) : addEvent(s, ev)))
  const open = openId ? data.events[openId] : null
  const picked = Object.keys(state.selected).length
  const ects = useMemo(() => computeEcts(state.selected, data.events, data.modules), [data, state.selected])

  return (
    <div class={`catalog${showModules ? ' is-modules' : ''}`}>
      {!showModules && <aside class={`sidebar${treeOpen ? ' open' : ''}`}>
        <h2 class="sidebar-title">{t(lang, 'filter.fields')}</h2>
        <button type="button" class="sidebar-toggle" aria-expanded={treeOpen} onClick={() => setTreeOpen(!treeOpen)}>
          <Icon name="filter" size={16} />
          {t(lang, 'filter.fields')}
        </button>
        <Tree nodes={data.tree} selected={filters.fieldId} allLabel={t(lang, 'filter.allFields')}
          total={Object.keys(data.events).length}
          onSelect={(fieldId) => { setFilters({ ...filters, fieldId }); setTreeOpen(false) }} />
      </aside>}
      <section class="results">
        <header class="page-head">
          <h2>{t(lang, 'tab.catalog')}</h2>
          {handbook && (
            <div class="mode-switch" role="group" aria-label={t(lang, 'tab.catalog')}>
              <button type="button" aria-pressed={!showModules} onClick={() => { location.hash = '#/catalog' }}>{t(lang, 'catalog.mode.term')}</button>
              <button type="button" aria-pressed={showModules} onClick={() => { location.hash = '#/catalog/all' }}>{t(lang, 'catalog.mode.all')}</button>
            </div>
          )}
          <p class="result-count">
            {showModules ? t(lang, 'catalog.moduleCount', { n: moduleList.length }) : t(lang, 'catalog.count', { n: list.length })}
          </p>
        </header>
        {showModules ? (
          <>
            <p class="scope-note">
              <Icon name="check" size={16} />
              <span>{t(lang, 'catalog.handbookNote', { date: fmtDate(lang, handbook!.meta.asOf) })}</span>
            </p>
            <ModuleFilters lang={lang} value={moduleFilters} onChange={setModuleFilters} options={moduleOptions} />
            {moduleList.length ? (
              <ul class="cards">
                {moduleList.map((r) => (
                  <ModuleCard key={r.id} lang={lang} data={data} row={r} myAreas={state.areas ?? []} onOpen={() => setOpenModuleId(r.id)} />
                ))}
              </ul>
            ) : <p class="empty">{t(lang, 'catalog.empty')}</p>}
          </>
        ) : (<>
        <p class="scope-note">
          <Icon name="check" size={16} />
          <span>{t(lang, 'catalog.masterOnly', { spo: data.meta.spo })}<TermLink id="level" lang={lang} /></span>
        </p>
        <Filters lang={lang} value={filters} onChange={setFilters} options={options} />
        {list.length ? (
          <ul class="cards">
            {list.map((ev) => (
              <EventCard key={ev.id} lang={lang} data={data} ev={ev} inSchedule={!!state.selected[ev.id]}
                conflict={conflicts.has(ev.id)} myAreas={state.areas ?? []} onOpen={() => setOpenId(ev.id)} onToggle={() => toggle(ev)} />
            ))}
          </ul>
        ) : <p class="empty">{t(lang, 'catalog.empty')}</p>}
        </>)}
        {picked > 0 && !showModules && (
          <div class="dock" role="status">
            <span class="dock-stat"><strong>{picked}</strong> {t(lang, 'dock.courses')}</span>
            <span class="dock-stat"><strong>{ects.total}</strong> ECTS</span>
            <a class="dock-link" href="#/schedule">{t(lang, 'dock.open')}<Icon name="arrow" size={16} /></a>
          </div>
        )}
      </section>
      {open && (
        <EventDetail lang={lang} data={data} ev={open} myAreas={state.areas ?? []} inSchedule={!!state.selected[open.id]}
          onToggle={() => toggle(open)} onClose={() => setOpenId(null)} />
      )}
      {showModules && openModule && (
        <ModuleDetail lang={lang} data={data} row={openModule} myAreas={state.areas ?? []} onClose={() => setOpenModuleId(null)}
          terms={state.roadmap?.terms ?? DEFAULT_TERMS} placedTerm={roadmapEntries(state)[openModule.id]?.term ?? null}
          onPlace={(term) => update((s) => placeModule(s, openModule.id, term))}
          onOpenEvent={(id) => { setOpenModuleId(null); setOpenId(id); location.hash = '#/catalog' }} />
      )}
    </div>
  )
}
