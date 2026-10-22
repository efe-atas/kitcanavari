import type { CoursesFile, HandbookFile, HandbookModule, Module, Recurrence } from '../types'
import { moduleAreas, moduleKind, type Kind } from './degree'

/** A module from the handbook, the catalog, or both (same id). */
export interface ModuleRow {
  id: string
  title: string
  ects: number | null
  recurrence: Recurrence
  fields: string[]
  hb: HandbookModule | null
  /** The catalog's view of the module when it has events this term. */
  current: Module | null
  eventIds: string[]
}

export interface ModuleFilters {
  query: string
  areas: string[]
  kinds: Kind[]
  ects: number[]
  recurrence: Recurrence[]
  offeredNow: boolean
}

export const emptyModuleFilters = (): ModuleFilters => ({ query: '', areas: [], kinds: [], ects: [], recurrence: [], offeredNow: false })

/** Catalog recurrence text ("Each winter term", "Irregular", …) → Recurrence, by the handbook parser's rules. */
export function recurrenceOf(text: string | null): Recurrence {
  const t = (text ?? '').trim().toLowerCase()
  if (t === 'each winter term') return 'winter'
  if (t === 'each summer term') return 'summer'
  if (t === 'each term') return 'each'
  return 'irregular'
}

export function moduleRows(courses: CoursesFile, handbook: HandbookFile): ModuleRow[] {
  const events = new Map<string, string[]>()
  for (const ev of Object.values(courses.events)) {
    for (const mid of ev.moduleIds) events.set(mid, [...(events.get(mid) ?? []), ev.id])
  }
  const ids = new Set([...Object.keys(handbook.modules), ...Object.keys(courses.modules)])
  return [...ids].map((id): ModuleRow => {
    const hb = handbook.modules[id] ?? null
    const current = courses.modules[id] ?? null
    return {
      id,
      title: hb?.title ?? current!.title,
      ects: hb?.ects ?? current?.ects ?? null,
      recurrence: hb?.recurrence ?? recurrenceOf(current!.recurrence),
      fields: hb?.fields ?? current!.fields,
      hb,
      current,
      eventIds: events.get(id) ?? [],
    }
  }).sort((a, b) => a.title.localeCompare(b.title))
}

export function filterModules(courses: CoursesFile, rows: ModuleRow[], f: ModuleFilters): ModuleRow[] {
  const q = f.query.trim().toLowerCase()
  return rows
    .filter((r) => !q || r.title.toLowerCase().includes(q) || r.id.toLowerCase().includes(q)
      || (r.hb?.coordinators ?? []).some((c) => c.toLowerCase().includes(q)))
    .filter((r) => !f.areas.length || moduleAreas(r).some((a) => f.areas.includes(a)))
    .filter((r) => !f.kinds.length || f.kinds.includes(moduleKind(courses, r)))
    .filter((r) => !f.ects.length || (r.ects !== null && f.ects.includes(r.ects)))
    .filter((r) => !f.recurrence.length || f.recurrence.includes(r.recurrence))
    .filter((r) => !f.offeredNow || r.eventIds.length > 0)
}
