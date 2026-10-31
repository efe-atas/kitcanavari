// Advice across the plan: order warnings from the handbook's prerequisite texts, courses suggested for a term
// (what the degree still needs, what fits the week, what serves the goal), and figures for comparing saved scenarios.
import type { CareerData, CoursesFile, HandbookFile, Scenario, SkillId, UserState } from '../types'
import { lensWeights } from './career'
import { pathRole } from './careerPlus'
import { addConflicts } from './conflicts'
import { bucketOptions, moduleAreas, moduleKind, RULES, roadmapReport } from './degree'
import type { ModuleRow } from './handbook'
import { forecast } from './insights'
import { nextSteps } from './nextSteps'
import { roadmapEntries } from './roadmap'
import { CURRENT_TERM, offeringIssue, termOrder } from './terms'
import { fit } from './career'
import { pointsOf } from '../ui/career/model'

export interface PrereqLinks {
  /** Modules the handbook names as prerequisites or recommendations: best taken earlier. */
  before: string[]
  /** Modules the handbook says must not be combined with this one. */
  excludes: string[]
}

const EXCLUDE = /must not|may not|cannot be|can not be|not be taken|not have (?:been )?(?:started|completed|passed)|darf nicht|dürfen nicht|nicht geprüft|nicht belegt/i

/** Links between modules found by title in each module's prerequisite and recommendation texts. */
export function prereqLinks(rows: ModuleRow[]): Map<string, PrereqLinks> {
  const named = rows.filter((r) => r.title.length >= 8)
  const out = new Map<string, PrereqLinks>()
  for (const r of rows) {
    const text = [r.hb?.prerequisites, r.hb?.recommendations].filter(Boolean).join('\n')
    if (!text) continue
    const sentences = text.split(/(?<=[.;])\s+|\n+/)
    const links: PrereqLinks = { before: [], excludes: [] }
    for (const o of named) {
      if (o.id === r.id) continue
      const re = new RegExp(`(?<![A-Za-z])${o.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z])`)
      const hit = sentences.find((s) => re.test(s))
      // A longer title that contains this one ("Robotics III" in "Robotics III - Sensors…") already claimed it.
      if (!hit || named.some((x) => x !== o && x.id !== r.id && x.title.includes(o.title) && hit.includes(x.title))) continue
      ;(EXCLUDE.test(hit) ? links.excludes : links.before).push(o.id)
    }
    if (links.before.length || links.excludes.length) out.set(r.id, links)
  }
  return out
}

export type PrereqIssue = { id: string; other: string; kind: 'order' | 'missing' | 'excluded' }

/** Order problems in the plan: a recommended module later than (or with) the one needing it, missing, or excluded. */
export function prereqIssues(state: UserState, links: Map<string, PrereqLinks>): PrereqIssue[] {
  const entries = roadmapEntries(state)
  const live = (id: string) => entries[id] && (entries[id].status === 'planned' || entries[id].status === 'passed')
  const out: PrereqIssue[] = []
  for (const [id, l] of links) {
    if (!live(id) || entries[id].status === 'passed') continue
    for (const b of l.before) {
      if (!live(b)) out.push({ id, other: b, kind: 'missing' })
      else if (entries[b].status !== 'passed' && termOrder(entries[b].term) >= termOrder(entries[id].term)) out.push({ id, other: b, kind: 'order' })
    }
    for (const x of l.excludes) if (live(x)) out.push({ id, other: x, kind: 'excluded' })
  }
  return out
}

export type SuggestReason = 'stamm' | 'seminar' | 'practical' | 'area' | 'areaLecture' | 'elective' | 'goal' | 'starred' | 'fitsWeek'

export interface Suggestion {
  row: ModuleRow
  score: number
  reasons: SuggestReason[]
}

/**
 * Courses for one term, best first: offered then, not in the plan, adding to what the degree still lacks, clashing
 * with nothing in this term's week, serving the career goal, starred by the user.
 */
export function suggestModules(args: {
  state: UserState; courses: CoursesFile; handbook: HandbookFile | null; career: CareerData | null; rows: ModuleRow[]; term: string; limit?: number
}): Suggestion[] {
  const { state, courses, handbook, career, rows, term, limit = 5 } = args
  const entries = roadmapEntries(state)
  const r = roadmapReport(state, courses, handbook).all
  const areas = (state.areas ?? []).slice(0, 2)
  const goal = career && (state.followed ?? []).find((f) => career.lenses.lenses.some((l) => l.id === f.lens))
  const lens = goal ? career!.lenses.lenses.find((l) => l.id === goal.lens)! : null
  const weights = lens ? lensWeights(pathRole(career!, goal!.role, lens), lens) : null
  const out: Suggestion[] = []
  for (const row of rows) {
    if (entries[row.id] || !row.ects || offeringIssue(row, term) !== null) continue
    const kind = moduleKind(courses, row)
    const opts = bucketOptions(row)
    const reasons: SuggestReason[] = []
    let score = 0
    if (kind === 'stamm' && r.stamm.count < RULES.stamm) { score += 3; reasons.push('stamm') }
    if (kind === 'seminar' && r.seminarCp < RULES.seminarMin) { score += 3; reasons.push('seminar') }
    if (kind === 'practical' && r.practicalCp < RULES.practicalMin) { score += 3; reasons.push('practical') }
    for (const a of r.areas) {
      if (!moduleAreas(row).includes(a.area)) continue
      if (kind === 'lecture' && a.lectureCp < a.lectureMin) { score += 2.5; reasons.push('areaLecture'); break }
      if (a.cp < RULES.areaMin) { score += 2; reasons.push('area'); break }
    }
    if (!reasons.length && opts.includes('elective') && r.electiveCp < RULES.electiveMin) { score += 1; reasons.push('elective') }
    if (!areas.length && !reasons.length) score += 0.5
    if (weights && career) {
      const s = career.skills.modules[row.id] ?? {}
      const g = Object.entries(weights).reduce((n, [k, w]) => n + (w ?? 0) * (s[k as SkillId]?.[0] ?? 0), 0)
      if (g >= 0.9) { score += g; reasons.push('goal') }
    }
    if ((state.starred ?? []).includes(row.id)) { score += 1; reasons.push('starred') }
    if (term === CURRENT_TERM && row.eventIds.length) {
      if (addConflicts(state.selected, courses.events, row.id, row.eventIds).length) score -= 3
      else if (Object.keys(state.selected).length) { score += 0.5; reasons.push('fitsWeek') }
    }
    if (score > 0.4 && reasons.length) out.push({ row, score, reasons })
  }
  return out.sort((a, b) => b.score - a.score || (b.row.ects ?? 0) - (a.row.ects ?? 0) || a.row.title.localeCompare(b.row.title)).slice(0, limit)
}

export interface ScenarioFigures {
  ects: number
  /** Degree rules still open (nextSteps' to-dos). */
  open: number
  thesisTerm: string | null
  /** Fit with the followed goal, if any. */
  fit: number | null
}

/** The figures a plan is compared by: credits, open rules, thesis term, career fit. */
export function planFigures(state: UserState, courses: CoursesFile, handbook: HandbookFile | null, career: CareerData | null, rows: ModuleRow[]): ScenarioFigures {
  const goal = career && (state.followed ?? []).find((f) => career.lenses.lenses.some((l) => l.id === f.lens))
  const lens = goal ? career!.lenses.lenses.find((l) => l.id === goal.lens)! : null
  return {
    ects: roadmapReport(state, courses, handbook).all.total,
    open: nextSteps(state, courses, handbook).filter((s) => s.severity === 'todo').length,
    thesisTerm: forecast(state, courses, handbook).thesisTerm,
    fit: lens ? fit(pointsOf(state, career!, rows).all, pathRole(career!, goal!.role, lens), lens) : null,
  }
}

/** A scenario seen as a state: its plan, the user's goal and shortlist (nothing in the weekly timetable). */
export const scenarioState = (s: UserState, sc: Scenario): UserState =>
  ({ ...s, selected: {}, areas: [...sc.areas], roadmap: { ...sc.roadmap, notes: s.roadmap?.notes ?? {} } })
