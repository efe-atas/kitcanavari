// A whole study plan for a career path: the remaining terms filled with modules that first meet every degree
// rule (Stammmodul, both areas, seminar, practical, elective, 90 ECTS) and, within each rule, add the most to the
// chosen role seen through the chosen employer lens. The last remaining term is left for the thesis.
// In rebuild mode, modules planned for future terms are open to change: kept when the path still wants them, else
// listed as dropped; passed modules and the current term stay as they are.
import type { CareerData, CoursesFile, HandbookFile, Lens, Role, SkillId, UserState } from '../types'
import { fit, lensWeights, skillPoints, skillTarget, type SkillPoints } from './career'
import {
  AREAS, bucketOptions, defaultBucket, ELECTIVE, IQ, MINOR, moduleKind, reportFromItems, RULES,
  type Bucket, type DegreeItem, type DegreeReport, type Kind,
} from './degree'
import type { ModuleRow } from './handbook'
import { roadmapEntries } from './roadmap'
import { CURRENT_TERM, DEFAULT_TERMS, offeringIssue, remainingTerms, termOrder } from './terms'

/** Why a module is in the plan: the rule it fills, or 'career' when it only adds fit. */
export type PickReason = 'stamm' | 'area' | 'seminar' | 'practical' | 'elective' | 'career'

export interface PlanPick {
  id: string
  term: string
  bucket: Bucket
  kind: Kind
  ects: number
  reason: PickReason
  /** The skills of the role this module adds most to, strongest first. */
  skills: SkillId[]
  /** Rebuild mode: the term the module is already planned in, if it is. */
  was: string | null
}

export interface StudyPlan {
  picks: PlanPick[]
  /** The terms courses go into, in order, and the ECTS each holds with the picks (existing entries included). */
  terms: { term: string; load: number }[]
  thesisTerm: string | null
  /** Fit with the roadmap as it is, and with the picks added. */
  before: number
  after: number
  report: DegreeReport
  /** Rules the catalog could not fill: 'stamm', 'area:<name>', 'seminar', 'practical', 'sp', 'elective', 'total'. */
  missing: string[]
  /** ECTS left for interdisciplinary courses (HoC, FORUM, language centre), which this catalog does not list. */
  iqLeft: number
  /** Areas are not chosen: the plan needs them first; these two fit the path best. */
  needsAreas: string[] | null
  /** Rebuild mode: future planned modules the new plan leaves out. */
  dropped: string[]
}

/** A typical full term. */
export const TERM_CAP = RULES.semesterTarget

interface Args {
  state: UserState
  courses: CoursesFile
  handbook: HandbookFile | null
  career: CareerData
  role: Role
  lens: Lens
  rows: ModuleRow[]
  /** Modules the user took out of the proposal. */
  exclude?: Set<string>
  /** Reconsider modules planned for future terms instead of building around them. */
  rebuild?: boolean
  /** Rebuild mode: future planned modules the user wants to keep whatever the plan says. */
  keep?: Set<string>
}

const isCs = (b: Bucket | null) => !!b && b !== MINOR && b !== IQ

export function proposeStudyPlan({ state, courses, handbook, career, role, lens, rows, exclude = new Set(), rebuild = false, keep = new Set() }: Args): StudyPlan {
  const all = roadmapEntries(state)
  const open = (id: string) => rebuild && !keep.has(id) && all[id]?.status === 'planned' && termOrder(all[id].term) > termOrder(CURRENT_TERM)
  /** What the plan builds around: everything, or (rebuild) all but the open future plans. */
  const entries = Object.fromEntries(Object.entries(all).filter(([id]) => !open(id)))
  const ectsOf = new Map(rows.map((r) => [r.id, r.ects]))
  const ects = (id: string) => ectsOf.get(id) ?? null
  const start = skillPoints(entries, career, ects, ['passed', 'planned'])
  const before = fit(skillPoints(all, career, ects, ['passed', 'planned']), role, lens)
  const weights = lensWeights(role, lens)

  /**
   * What a module adds to the path: the weighted growth of each skill toward the role's target, and past it at a
   * quarter of the rate up to twice the target, so a full plan still prefers what this employer type values.
   */
  const value = (x: number, target: number) => Math.min(x, target) + 0.25 * Math.max(0, Math.min(x, 2 * target) - target)
  const gain = (p: SkillPoints, r: ModuleRow) => {
    const scores = career.skills.modules[r.id]
    if (!scores || !r.ects) return 0
    let g = 0
    for (const [s, w] of Object.entries(weights) as [SkillId, number][]) {
      const target = skillTarget(role, s)
      const add = (scores[s]?.[0] ?? 0) * r.ects / 6
      if (target > 0 && add > 0) g += w * (value(p[s] + add, target) - value(p[s], target)) / target
    }
    return g
  }

  const areas = (state.areas ?? []).filter((a) => AREAS.includes(a)).slice(0, 2)
  const candidates = rows.filter((r) => r.ects && !entries[r.id] && !exclude.has(r.id) && bucketOptions(r).some(isCs))

  if (areas.length < 2) {
    // Areas decide where credits count; suggest the two the path likes best (sum of the best five gains in each).
    const score = (a: string) => candidates.filter((r) => bucketOptions(r).includes(a)).map((r) => gain(start, r))
      .sort((x, y) => y - x).slice(0, 5).reduce((n, x) => n + x, 0)
    const best = [...areas, ...AREAS.filter((a) => !areas.includes(a)).sort((a, b) => score(b) - score(a))].slice(0, 2)
    return { picks: [], terms: [], thesisTerm: null, before, after: before, report: reportFromItems([], areas), missing: [], iqLeft: 0, needsAreas: best, dropped: [] }
  }

  const remaining = remainingTerms(state.roadmap?.terms ?? DEFAULT_TERMS)
  const thesisTerm = remaining.length > 1 ? remaining[remaining.length - 1] : null
  const courseTerms = thesisTerm ? remaining.slice(0, -1) : remaining

  /** One pass: the rules in `order`, then filling up with what serves the path. */
  const run = (order: string[]): StudyPlan => {
    // The degree as it stands: passed and planned modules.
    const items: DegreeItem[] = []
    const load: Record<string, number> = Object.fromEntries(courseTerms.map((t) => [t, 0]))
    for (const [id, e] of Object.entries(entries)) {
      if (e.status !== 'passed' && e.status !== 'planned') continue
      const info = handbook?.modules[id] ?? courses.modules[id]
      const bucket = info ? defaultBucket(info.fields, areas, e.countAs) : null
      if (!info?.ects || !bucket) continue
      items.push({ id, title: info.title, ects: info.ects, fields: info.fields, kind: moduleKind(courses, info), bucket })
      if (e.term in load) load[e.term] += info.ects
    }

    const points = { ...start }
    const picks: PlanPick[] = []
    const taken = new Set<string>()
    const sum = (pred: (x: DegreeItem) => boolean) => items.filter(pred).reduce((n, x) => n + x.ects, 0)
    const total = () => sum((x) => isCs(x.bucket) || x.bucket === MINOR || x.bucket === IQ)
    const areaCp = (a: string, kind?: Kind) => sum((x) => x.bucket === a && (!kind || x.kind === kind))
    const areasCp = () => sum((x) => AREAS.includes(x.bucket))
    const kindCp = (k: Kind) => sum((x) => x.kind === k && isCs(x.bucket))
    const sp = () => kindCp('seminar') + kindCp('practical')
    const stamm = () => items.filter((x) => x.kind === 'stamm' && isCs(x.bucket)).length
    const kindOf = (r: ModuleRow) => moduleKind(courses, r)
    const termFor = (r: ModuleRow) => courseTerms.find((t) => offeringIssue(r, t) === null && load[t] + (r.ects ?? 0) <= TERM_CAP) ?? null
    /** A CS bucket for a module: an area with room (fewest credits first), else elective with room. */
    const roomIn = (r: ModuleRow, prefer?: Bucket): Bucket | null => {
      const opts = bucketOptions(r)
      const ects = r.ects ?? 0
      if (prefer && opts.includes(prefer)) {
        if (AREAS.includes(prefer) ? areasCp() + ects <= RULES.areasMax : sum((x) => x.bucket === ELECTIVE) + ects <= RULES.electiveMax) return prefer
      }
      const area = areas.filter((a) => opts.includes(a)).sort((a, b) => areaCp(a) - areaCp(b))[0]
      if (area && areasCp() + ects <= RULES.areasMax) return area
      if (opts.includes(ELECTIVE) && sum((x) => x.bucket === ELECTIVE) + ects <= RULES.electiveMax) return ELECTIVE
      return null
    }
    /** Seminars and practicals stay within 12–18 ECTS; a fifth Stammmodul would only raise a warning. */
    const spOk = (r: ModuleRow) => {
      const k = kindOf(r)
      if (k === 'stamm') return stamm() < RULES.stamm
      if (k !== 'seminar' && k !== 'practical') return true
      // Keep room within 18 ECTS for whichever of the seminar and practical minimums is still open.
      const ects = r.ects ?? 0
      const owed = Math.max(0, RULES.seminarMin - kindCp('seminar') - (k === 'seminar' ? ects : 0))
        + Math.max(0, RULES.practicalMin - kindCp('practical') - (k === 'practical' ? ects : 0))
      return sp() + ects + owed <= RULES.spMax
    }

    /** The best module passing `ok` that has a term and a bucket; added to the plan. False when none is left. */
    const take = (reason: PickReason, ok: (r: ModuleRow) => boolean, prefer?: (r: ModuleRow) => Bucket | undefined): boolean => {
      let best: { r: ModuleRow; term: string; bucket: Bucket; g: number } | null = null
      for (const r of candidates) {
        if (taken.has(r.id) || !ok(r) || !spOk(r)) continue
        const term = termFor(r)
        const bucket = term ? roomIn(r, prefer?.(r)) : null
        if (!term || !bucket) continue
        // A module already in the plan wins near-ties, so the plan changes only where the path really differs.
        const g = gain(points, r) * (open(r.id) ? 1.05 : 1)
        if (!best || g > best.g || (g === best.g && (r.ects ?? 0) > (best.r.ects ?? 0))) best = { r, term, bucket, g }
      }
      if (!best) return false
      const { r, term, bucket } = best
      const ects = r.ects!
      const kind = kindOf(r)
      taken.add(r.id)
      items.push({ id: r.id, title: r.title, ects, fields: r.fields, kind, bucket })
      load[term] += ects
      const scores = career.skills.modules[r.id] ?? {}
      for (const [s, v] of Object.entries(scores)) points[s as SkillId] += (v?.[0] ?? 0) * ects / 6
      const skills = (Object.entries(weights) as [SkillId, number][])
        .map(([s, w]) => [s, w * (scores[s]?.[0] ?? 0)] as const).filter(([, x]) => x > 0).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([s]) => s)
      picks.push({ id: r.id, term, bucket, kind, ects, reason, skills, was: open(r.id) ? all[r.id].term : null })
      return true
    }

    const missing: string[] = []
    const until = (cond: () => boolean, key: string, step: () => boolean) => {
      while (!cond()) if (!step()) { missing.push(key); return }
    }

    const rule = (key: string) => {
      if (key === 'stamm') return until(() => stamm() >= RULES.stamm, key, () => take('stamm', (r) => kindOf(r) === 'stamm'))
      if (key.startsWith('area:')) {
        const a = key.slice(5)
        const lectureMin = RULES.areaLectureMinReduced[a] ?? RULES.areaLectureMin
        until(() => areaCp(a, 'lecture') >= lectureMin, key,
          () => take('area', (r) => kindOf(r) === 'lecture' && bucketOptions(r).includes(a), () => a))
        if (!missing.includes(key)) until(() => areaCp(a) >= RULES.areaMin, key, () => take('area', (r) => bucketOptions(r).includes(a), () => a))
        return
      }
      if (key === 'seminar') return until(() => kindCp('seminar') >= RULES.seminarMin, key, () => take('seminar', (r) => kindOf(r) === 'seminar'))
      if (key === 'practical') return until(() => kindCp('practical') >= RULES.practicalMin, key, () => take('practical', (r) => kindOf(r) === 'practical'))
      if (key === 'sp') return until(() => sp() >= RULES.spMin, key, () => take('practical', (r) => kindOf(r) === 'seminar' || kindOf(r) === 'practical'))
      until(() => sum((x) => x.bucket === ELECTIVE) >= RULES.electiveMin, key,
        () => take('elective', (r) => bucketOptions(r).includes(ELECTIVE), () => ELECTIVE))
    }
    for (const key of order) rule(key)
    // Fill up to 90 ECTS, leaving 2–6 ECTS for the interdisciplinary courses this catalog does not list: aim at the
    // smallest share (2), and accept up to the largest (6) when the terms are full.
    const modules = RULES.total - RULES.thesis
    const iq = sum((x) => x.bucket === IQ)
    const goal = modules - Math.max(0, RULES.iqMin - iq)
    while (total() < goal && take('career', (r) => (r.ects ?? 0) <= goal - total())) { /* keep filling */ }
    if (total() < modules - Math.max(0, RULES.iqMax - iq)) missing.push('total')
    const iqLeft = Math.max(RULES.iqMin - iq, modules - total(), 0)

    const report = reportFromItems(items, areas)
    return {
      picks: [...picks].sort((a, b) => courseTerms.indexOf(a.term) - courseTerms.indexOf(b.term)),
      terms: courseTerms.map((t) => ({ term: t, load: load[t] })),
      thesisTerm,
      before,
      after: fit(points, role, lens),
      report,
      missing,
      iqLeft,
      needsAreas: null,
      dropped: Object.keys(all).filter((id) => open(id) && !taken.has(id)),
    }
  }

  // Greedy choices can use up the only term a scarce rule could go in; when a rule stays open, try again with the
  // open rules first and keep the plan that leaves the fewest open, then the best fit.
  const rules = ['stamm', ...areas.map((a) => `area:${a}`), 'seminar', 'practical', 'sp', 'elective']
  let best = run(rules)
  const front: string[] = []
  for (let i = 0; i < 4; i++) {
    const open = best.missing.filter((m) => rules.includes(m) && !front.includes(m))
    if (!open.length) break
    front.push(...open)
    const next = run([...front, ...rules.filter((k) => !front.includes(k))])
    if (next.missing.length < best.missing.length || (next.missing.length === best.missing.length && next.after > best.after)) best = next
  }
  return best
}
