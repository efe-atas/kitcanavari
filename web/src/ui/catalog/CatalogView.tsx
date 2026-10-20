import { useMemo, useState } from 'preact/hooks'
import { t } from '../../i18n'
import { findConflicts } from '../../logic/conflicts'
import { AREAS, moduleAreas } from '../../logic/degree'
import { computeEcts } from '../../logic/ects'
import { emptyFilters, eventModules, filterEvents, type Filters as F } from '../../logic/filter'
import { addEvent, removeEvent } from '../../store'
import type { CoursesFile, Event, UserState } from '../../types'
import { TermLink } from '../glossary/GlossaryView'
import { Icon } from '../Icon'
import { EventCard } from './EventCard'
import { EventDetail } from './EventDetail'
import { Filters } from './Filters'
import { Tree } from './Tree'

interface Props {
  data: CoursesFile
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

export function CatalogView({ data, state, update }: Props) {
  const { lang } = state
  const [filters, setFilters] = useState<F>(emptyFilters)
  const [openId, setOpenId] = useState<string | null>(null)
  const [treeOpen, setTreeOpen] = useState(false)

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
    <div class="catalog">
      <aside class={`sidebar${treeOpen ? ' open' : ''}`}>
        <h2 class="sidebar-title">{t(lang, 'filter.fields')}</h2>
        <button type="button" class="sidebar-toggle" aria-expanded={treeOpen} onClick={() => setTreeOpen(!treeOpen)}>
          <Icon name="filter" size={16} />
          {t(lang, 'filter.fields')}
        </button>
        <Tree nodes={data.tree} selected={filters.fieldId} allLabel={t(lang, 'filter.allFields')}
          total={Object.keys(data.events).length}
          onSelect={(fieldId) => { setFilters({ ...filters, fieldId }); setTreeOpen(false) }} />
      </aside>
      <section class="results">
        <header class="page-head">
          <h2>{t(lang, 'tab.catalog')}</h2>
          <p class="result-count">{t(lang, 'catalog.count', { n: list.length })}</p>
        </header>
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
        {picked > 0 && (
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
    </div>
  )
}
