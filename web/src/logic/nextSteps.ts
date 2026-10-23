// "What should I do next" (spec 2026-10-23 §3.4): the missing degree requirements, most important first, each
// with the table cell where a course would fix it.
import type { CoursesFile, HandbookFile, UserState } from '../types'
import { RULES, roadmapReport, type Kind } from './degree'
import type { RowId } from './matrix'
import { CURRENT_TERM, DEFAULT_TERMS, remainingTerms } from './terms'

export type StepAction = { term: string; row: RowId; kind?: Kind } | { focus: 'areas' }

export interface Step {
  key: string
  params?: Record<string, string | number>
  action: StepAction | null
  severity: 'todo' | 'warn'
}

/** Where to add next: the first term after the current one, else the current one. */
export function nextTerm(s: UserState): string {
  const rest = remainingTerms(s.roadmap?.terms ?? DEFAULT_TERMS)
  return rest.find((t) => t !== CURRENT_TERM) ?? rest[0] ?? CURRENT_TERM
}

export function nextSteps(s: UserState, courses: CoursesFile, handbook: HandbookFile | null): Step[] {
  const areas = s.areas ?? []
  if (areas.length < 2) return [{ key: 'step.areas', action: { focus: 'areas' }, severity: 'todo' }]
  const r = roadmapReport(s, courses, handbook).all
  const term = nextTerm(s)
  const out: Step[] = []
  r.areas.forEach((a, i) => {
    const row: RowId = i === 0 ? 'area0' : 'area1'
    // One step per area: the larger of the two gaps, as lectures when lectures are what is short.
    const cpGap = RULES.areaMin - a.cp
    const lectureGap = a.lectureMin - a.lectureCp
    if (lectureGap > 0 && lectureGap >= cpGap) {
      out.push({ key: 'step.areaLecture', params: { area: a.area, n: lectureGap }, action: { term, row, kind: 'lecture' }, severity: 'todo' })
    } else if (cpGap > 0) {
      out.push({ key: 'step.areaCp', params: { area: a.area, n: cpGap }, action: { term, row }, severity: 'todo' })
    }
  })
  if (r.stamm.count < RULES.stamm) out.push({ key: 'step.stamm', params: { n: RULES.stamm - r.stamm.count }, action: { term, row: 'elective', kind: 'stamm' }, severity: 'todo' })
  if (r.seminarCp < RULES.seminarMin) out.push({ key: 'step.seminar', params: { n: RULES.seminarMin - r.seminarCp }, action: { term, row: 'elective', kind: 'seminar' }, severity: 'todo' })
  if (r.practicalCp < RULES.practicalMin) {
    out.push({ key: 'step.practical', params: { n: RULES.practicalMin - r.practicalCp }, action: { term, row: 'elective', kind: 'practical' }, severity: 'todo' })
  }
  if (r.electiveCp < RULES.electiveMin) out.push({ key: 'step.elective', params: { n: RULES.electiveMin - r.electiveCp }, action: { term, row: 'elective' }, severity: 'todo' })
  for (const issue of r.issues) out.push({ key: issue.key, params: issue.params, action: null, severity: 'warn' })
  return out
}
