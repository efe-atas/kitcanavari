import { useMemo, useState } from 'preact/hooks'
import { t } from '../../i18n'
import { findConflicts } from '../../logic/conflicts'
import { emptyFilters, eventModules, filterEvents, type Filters as F } from '../../logic/filter'
import { addEvent, removeEvent } from '../../store'
import type { CoursesFile, Event, UserState } from '../../types'
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
      parts: uniq(mods.map((m) => m.part)).sort(),
    }
  }, [data])

  const list = useMemo(() => filterEvents(data, filters, state), [data, filters, state])
  const conflicts = useMemo(() => conflictingIds(data, state), [data, state.selected])
  const toggle = (ev: Event) => update((s) => (s.selected[ev.id] ? removeEvent(s, ev.id) : addEvent(s, ev)))
  const open = openId ? data.events[openId] : null

  return (
    <div class="catalog">
      <aside class={`sidebar${treeOpen ? ' open' : ''}`}>
        <button type="button" class="sidebar-toggle" aria-expanded={treeOpen} onClick={() => setTreeOpen(!treeOpen)}>
          {t(lang, 'filter.fields')}
        </button>
        <Tree nodes={data.tree} selected={filters.fieldId} allLabel={t(lang, 'filter.allFields')}
          total={Object.keys(data.events).length}
          onSelect={(fieldId) => { setFilters({ ...filters, fieldId }); setTreeOpen(false) }} />
      </aside>
      <section class="results">
        <Filters lang={lang} value={filters} onChange={setFilters} options={options} />
        <p class="result-count">{t(lang, 'catalog.count', { n: list.length })}</p>
        {list.length ? (
          <ul class="cards">
            {list.map((ev) => (
              <EventCard key={ev.id} lang={lang} data={data} ev={ev} inSchedule={!!state.selected[ev.id]}
                conflict={conflicts.has(ev.id)} onOpen={() => setOpenId(ev.id)} onToggle={() => toggle(ev)} />
            ))}
          </ul>
        ) : <p class="empty">{t(lang, 'catalog.empty')}</p>}
      </section>
      {open && (
        <EventDetail lang={lang} data={data} ev={open} inSchedule={!!state.selected[open.id]}
          onToggle={() => toggle(open)} onClose={() => setOpenId(null)} />
      )}
    </div>
  )
}
