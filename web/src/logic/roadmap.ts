// The roadmap's view of modules: entries the user set, on top of this term's weekly plan (spec §2.2).
import { CURRENT_TERM, DEFAULT_TERMS } from './terms'
import type { Roadmap, RoadmapEntry, UserState } from '../types'

export const emptyRoadmap = (): Roadmap => ({ terms: [...DEFAULT_TERMS], modules: {}, notes: {} })

/** Modules of this term's weekly plan, as planned entries of the current term. */
export function derivedEntries(s: UserState): Record<string, RoadmapEntry> {
  const out: Record<string, RoadmapEntry> = {}
  for (const e of Object.values(s.selected)) {
    if (e.moduleId && !out[e.moduleId]) out[e.moduleId] = { term: CURRENT_TERM, status: 'planned', countAs: e.countAs ?? null, grade: null }
  }
  return out
}

export const roadmapEntries = (s: UserState): Record<string, RoadmapEntry> => ({ ...derivedEntries(s), ...s.roadmap?.modules })
