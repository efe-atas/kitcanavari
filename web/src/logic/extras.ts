// Validation and small helpers for the user's own data next to the plan: dates, saved scenarios, expected grades and
// reviews. All of them are optional fields of UserState and of the synced profile; older states and profiles lack them.
import type { Deadline, Review, Roadmap, Scenario } from '../types'

const KINDS = ['exam', 'registration', 'deadline', 'other']
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
const score = (x: unknown) => x === null || (typeof x === 'number' && Number.isInteger(x) && x >= 1 && x <= 5)

export const isDeadline = (x: unknown): x is Deadline => isObj(x) && typeof x.id === 'string' && typeof x.title === 'string'
  && (x.moduleId === null || typeof x.moduleId === 'string') && typeof x.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.date)
  && (x.time === null || (typeof x.time === 'string' && /^\d{2}:\d{2}$/.test(x.time))) && KINDS.includes(x.kind as string)

export const isReview = (x: unknown): x is Review => isObj(x) && score(x.difficulty) && score(x.workload)
  && (x.recommend === null || typeof x.recommend === 'boolean') && typeof x.text === 'string'

export const isGrade = (x: unknown) => typeof x === 'number' && x >= 1 && x <= 4

export function isScenario(x: unknown, isRoadmap: (r: unknown) => r is Roadmap): x is Scenario {
  return isObj(x) && typeof x.id === 'string' && typeof x.name === 'string'
    && Array.isArray(x.areas) && x.areas.every((a) => typeof a === 'string') && isRoadmap(x.roadmap)
}

export const validExtras = (s: Record<string, unknown>, isRoadmap: (r: unknown) => r is Roadmap): boolean =>
  (s.deadlines === undefined || (Array.isArray(s.deadlines) && s.deadlines.every(isDeadline)))
  && (s.scenarios === undefined || (Array.isArray(s.scenarios) && s.scenarios.every((x) => isScenario(x, isRoadmap))))
  && (s.expected === undefined || (isObj(s.expected) && Object.values(s.expected).every(isGrade)))
  && (s.reviews === undefined || (isObj(s.reviews) && Object.values(s.reviews).every(isReview)))

/** A short random id for dates and scenarios. */
export const newId = () => Math.random().toString(36).slice(2, 10)
