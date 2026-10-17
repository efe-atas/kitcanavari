import type { Event, Module, SelectedEntry } from '../types'

export interface EctsSummary {
  total: number
  byPart: Record<string, number>
  duplicateModules: string[]
  unknown: string[]
}

export const chosenModule = (entry: SelectedEntry, ev: Event): string | null => entry.moduleId ?? ev.moduleIds[0] ?? null

export function computeEcts(
  selected: Record<string, SelectedEntry>,
  events: Record<string, Event>,
  modules: Record<string, Module>,
): EctsSummary {
  const uses = new Map<string, number>()
  for (const [id, entry] of Object.entries(selected)) {
    const ev = events[id]
    const mid = ev && chosenModule(entry, ev)
    if (mid) uses.set(mid, (uses.get(mid) ?? 0) + 1)
  }
  const out: EctsSummary = { total: 0, byPart: {}, duplicateModules: [], unknown: [] }
  for (const [mid, count] of [...uses].sort(([x], [y]) => x.localeCompare(y))) {
    if (count > 1) out.duplicateModules.push(mid)
    const m = modules[mid]
    if (!m || m.ects === null) {
      out.unknown.push(mid)
      continue
    }
    out.total += m.ects
    const part = m.part ?? '—'
    out.byPart[part] = (out.byPart[part] ?? 0) + m.ects
  }
  return out
}
