import type { CoursesFile, Event, FieldNode, UserState } from '../types'
import { findConflicts } from './conflicts'
import { toMinutes } from './time'

export interface Filters {
  query: string
  fieldId: string | null
  types: string[]
  languages: string[]
  days: string[]
  from: string | null
  to: string | null
  ects: number[]
  parts: string[]
  noConflict: boolean
}

export const emptyFilters = (): Filters => ({
  query: '', fieldId: null, types: [], languages: [], days: [], from: null, to: null, ects: [], parts: [], noConflict: false,
})

export function findNode(nodes: FieldNode[], id: string): FieldNode | null {
  for (const n of nodes) {
    if (n.id === id) return n
    const hit = findNode(n.children, id)
    if (hit) return hit
  }
  return null
}

export function subtreeEventIds(node: FieldNode, acc = new Set<string>()): Set<string> {
  node.eventIds.forEach((e) => acc.add(e))
  node.children.forEach((c) => subtreeEventIds(c, acc))
  return acc
}

export const eventModules = (data: CoursesFile, ev: Event) => ev.moduleIds.map((m) => data.modules[m]).filter(Boolean)

function matchesTime(ev: Event, f: Filters): boolean {
  if (!f.days.length && !f.from && !f.to) return true
  return ev.slots.some((s) => s.day && s.start && s.end
    && (!f.days.length || f.days.includes(s.day))
    && (!f.from || toMinutes(s.start) >= toMinutes(f.from))
    && (!f.to || toMinutes(s.end) <= toMinutes(f.to)))
}

export function filterEvents(data: CoursesFile, f: Filters, state: UserState): Event[] {
  const q = f.query.trim().toLowerCase()
  const inField = f.fieldId ? (() => {
    const node = findNode(data.tree, f.fieldId!)
    return node ? subtreeEventIds(node) : new Set<string>()
  })() : null

  return Object.values(data.events)
    .filter((ev) => !inField || inField.has(ev.id))
    .filter((ev) => !q || ev.number.toLowerCase().includes(q) || ev.title.toLowerCase().includes(q)
      || ev.lecturers.some((l) => l.name.toLowerCase().includes(q)))
    .filter((ev) => !f.types.length || f.types.includes(ev.typeCode))
    .filter((ev) => !f.languages.length || (ev.language !== null && f.languages.includes(ev.language)))
    .filter((ev) => matchesTime(ev, f))
    .filter((ev) => !f.ects.length || eventModules(data, ev).some((m) => m.ects !== null && f.ects.includes(m.ects)))
    .filter((ev) => !f.parts.length || eventModules(data, ev).some((m) => m.part !== null && f.parts.includes(m.part)))
    .filter((ev) => {
      if (!f.noConflict || state.selected[ev.id]) return true
      const trial = { ...state.selected, [ev.id]: { enabledSlots: ev.slots.map((_, i) => i), moduleId: null, ackFingerprint: '' } }
      return !findConflicts(trial, data.events).some((c) => c.a === ev.id || c.b === ev.id)
    })
    .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
}
