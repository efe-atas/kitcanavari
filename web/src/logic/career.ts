// Career fit (spec §4): skill points from the roadmap, fit of a role seen through an employer lens, the biggest
// skill gaps and modules that would close them. Scores come from the hand-curated data/career files.
import type { CareerData, Lens, ModuleStatus, RoadmapEntry, Role, SkillId } from '../types'
import { SKILLS } from './careerSchema'
import type { ModuleRow } from './handbook'
import { offeringIssue } from './terms'

export type SkillPoints = Record<SkillId, number>

const zero = (): SkillPoints => Object.fromEntries(SKILLS.map((s) => [s, 0])) as SkillPoints

/** P_s = Σ score(m,s) × ects(m) / 6 over roadmap entries with one of `statuses`. Unscored modules add nothing. */
export function skillPoints(entries: Record<string, RoadmapEntry>, career: CareerData, ects: (id: string) => number | null,
  statuses: ModuleStatus[]): SkillPoints {
  const p = zero()
  for (const [id, e] of Object.entries(entries)) {
    if (!statuses.includes(e.status)) continue
    const scores = career.skills.modules[id]
    const cp = ects(id)
    if (!scores || !cp) continue
    for (const [s, v] of Object.entries(scores)) p[s as SkillId] += (v?.[0] ?? 0) * cp / 6
  }
  return p
}

/** w'_s = weight(r,s) × mult(l,s), normalised to sum 1. */
export function lensWeights(role: Role, lens: Lens): Partial<Record<SkillId, number>> {
  const raw = Object.entries(role.weights).map(([s, w]) => [s, (w ?? 0) * (lens.multipliers[s as SkillId] ?? 1)] as const)
  const total = raw.reduce((n, [, w]) => n + w, 0)
  return Object.fromEntries(raw.map(([s, w]) => [s, total ? w / total : 0]))
}

const coverage = (p: SkillPoints, role: Role, s: SkillId) => {
  const target = role.targets[s] ?? 0
  return target > 0 ? Math.min(1, p[s] / target) : 1
}

/** 0–100. */
export function fit(p: SkillPoints, role: Role, lens: Lens): number {
  const w = lensWeights(role, lens)
  const sum = Object.entries(w).reduce((n, [s, x]) => n + (x ?? 0) * coverage(p, role, s as SkillId), 0)
  return Math.round(sum * 100)
}

export interface Gap {
  skill: SkillId
  coverage: number
  modules: { id: string; score: number; term: string | null }[]
}

const SUGGESTIONS = 3

/** The three skills with the largest weighted gap, each with up to three modules not yet in the roadmap. */
export function gaps(p: SkillPoints, role: Role, lens: Lens, rows: ModuleRow[], entries: Record<string, RoadmapEntry>,
  career: CareerData, terms: string[]): Gap[] {
  const w = lensWeights(role, lens)
  return (Object.entries(w) as [SkillId, number][])
    .map(([s, x]) => ({ skill: s, coverage: coverage(p, role, s), weight: x * (1 - coverage(p, role, s)) }))
    .filter((g) => g.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map(({ skill, coverage: cov }) => ({
      skill,
      coverage: cov,
      modules: rows
        .filter((r) => !entries[r.id])
        .map((r) => ({ r, score: career.skills.modules[r.id]?.[skill]?.[0] ?? 0, term: terms.find((t) => offeringIssue(r, t) === null) ?? null }))
        .filter((x) => x.score > 0 && x.term !== null)
        .sort((a, b) => b.score - a.score || (b.r.ects ?? 0) - (a.r.ects ?? 0) || a.r.title.localeCompare(b.r.title))
        .slice(0, SUGGESTIONS)
        .map(({ r, score, term }) => ({ id: r.id, score, term })),
    }))
}

/** Roles a module serves best: Σ weight × score, top three above zero. */
export function topRoles(moduleId: string, career: CareerData): { role: string; score: number }[] {
  const scores = career.skills.modules[moduleId]
  if (!scores) return []
  return career.roles.roles
    .map((r) => ({ role: r.id, score: Object.entries(r.weights).reduce((n, [s, w]) => n + (w ?? 0) * (scores[s as SkillId]?.[0] ?? 0), 0) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
}
