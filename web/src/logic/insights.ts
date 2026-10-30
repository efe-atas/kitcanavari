// Planning insights for the overview: when the plan reaches the module credits, which term is left for the thesis,
// and the grade the remaining planned courses would need for a target average.
import type { CoursesFile, HandbookFile, UserState } from '../types'
import { RULES } from './degree'
import { matrixCells } from './matrix'
import { roadmapEntries } from './roadmap'
import { CURRENT_TERM, nextTerm, PRIOR, termOrder } from './terms'

export interface TermLoad {
  term: string
  /** Credits passed and planned in the term. */
  cp: number
  passed: number
}

export interface Forecast {
  /** Prior credits first, then each term of the plan in order. */
  terms: TermLoad[]
  /** Credits towards the 90 module credits (passed + planned). */
  moduleCp: number
  /** The term in which the module credits reach 90, or null when the plan does not get there yet. */
  doneTerm: string | null
  /** The term after it, for the thesis. */
  thesisTerm: string | null
  /** True when doneTerm assumes a full term (30 ECTS) for every term after the last planned one. */
  assumed: boolean
  /** Terms beyond the plan that the assumption needs. */
  extraTerms: number
}

const MODULES = RULES.total - RULES.thesis

export function forecast(state: UserState, courses: CoursesFile, handbook: HandbookFile | null): Forecast {
  const m = matrixCells(state, courses, handbook)
  const passed: Record<string, number> = {}
  for (const row of Object.values(m.cells)) {
    for (const [term, items] of Object.entries(row)) {
      for (const it of items) if (it.status === 'passed' && it.ects) passed[term] = (passed[term] ?? 0) + it.ects
    }
  }
  const ordered = m.columns.filter((t) => t !== PRIOR).sort((a, b) => termOrder(a) - termOrder(b))
  const terms: TermLoad[] = [PRIOR, ...ordered].map((term) => ({ term, cp: m.colTotals[term] ?? 0, passed: passed[term] ?? 0 }))
  const moduleCp = terms.reduce((n, t) => n + t.cp, 0)

  let cum = 0
  for (const t of terms) {
    cum += t.cp
    if (cum >= MODULES) {
      const done = t.term === PRIOR ? CURRENT_TERM : t.term
      return { terms, moduleCp, doneTerm: done, thesisTerm: nextTerm(done), assumed: false, extraTerms: 0 }
    }
  }
  // Not there yet: assume full terms after the last term that has anything planned (or after the current term).
  const used = terms.filter((t) => t.term !== PRIOR && t.cp > 0).map((t) => t.term)
  let term = used.length ? used[used.length - 1] : CURRENT_TERM
  if (termOrder(term) < termOrder(CURRENT_TERM)) term = CURRENT_TERM
  let extraTerms = 0
  while (cum < MODULES && extraTerms < 12) {
    term = nextTerm(term)
    cum += RULES.semesterTarget
    extraTerms++
  }
  return { terms, moduleCp, doneTerm: term, thesisTerm: nextTerm(term), assumed: true, extraTerms }
}

export interface GradeOutlook {
  /** ECTS-weighted average of graded passed modules, without truncation; null without grades. */
  average: number | null
  gradedCp: number
  /** Planned module credits still to be graded. */
  remainingCp: number
  /** Sum of grade × ECTS over graded modules. */
  weighted: number
}

export function gradeOutlook(state: UserState, courses: CoursesFile, handbook: HandbookFile | null): GradeOutlook {
  let weighted = 0
  let gradedCp = 0
  let remainingCp = 0
  for (const [id, e] of Object.entries(roadmapEntries(state))) {
    const ects = (handbook?.modules[id] ?? courses.modules[id])?.ects
    if (!ects) continue
    if (e.status === 'passed' && e.grade !== null) {
      weighted += e.grade * ects
      gradedCp += ects
    } else if (e.status === 'planned') remainingCp += ects
  }
  return { average: gradedCp ? weighted / gradedCp : null, gradedCp, remainingCp, weighted }
}

export type Needed = { kind: 'need'; grade: number } | { kind: 'safe' } | { kind: 'out-of-reach' } | { kind: 'nothing-left' }

/**
 * The average the remaining planned credits need for the whole to reach `target` (lower is better; 1.0–4.0).
 * Rounded towards the safe side to one decimal, as KIT grades are given in steps.
 */
export function neededAverage(o: GradeOutlook, target: number): Needed {
  if (!o.remainingCp) return { kind: 'nothing-left' }
  const need = (target * (o.gradedCp + o.remainingCp) - o.weighted) / o.remainingCp
  if (need >= 4) return { kind: 'safe' }
  if (need < 1) return { kind: 'out-of-reach' }
  return { kind: 'need', grade: Math.floor(need * 10 + 1e-9) / 10 }
}
