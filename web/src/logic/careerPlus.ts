// More from the career data: a path with an optional role, every environment ranked by fit, the fit term by term,
// the skill profile against the path's targets, the lecturers who teach what the path needs, a job ad read as skills,
// and the coursework lines for a CV.
import type { CareerData, Lens, Role, SkillId, UserState } from '../types'
import { environmentRole, fit, lensWeights, skillPoints, skillTarget, type SkillPoints } from './career'
import { SKILLS } from './careerSchema'
import type { ModuleRow } from './handbook'
import { roadmapEntries } from './roadmap'
import { DEFAULT_TERMS, PRIOR, termOrder } from './terms'

/** The role a path is measured against: the chosen role, or the environment's own skills when none is chosen. */
export function pathRole(career: CareerData, roleId: string | null | undefined, lens: Lens): Role {
  return career.roles.roles.find((r) => r.id === roleId) ?? environmentRole(lens)
}

/** Every environment with the plan's fit, best first (same role for all when one is chosen). */
export function rankEnvironments(points: SkillPoints, career: CareerData, roleId: string | null): { lens: Lens; fit: number }[] {
  return career.lenses.lenses.map((lens) => ({ lens, fit: fit(points, pathRole(career, roleId, lens), lens) }))
    .sort((a, b) => b.fit - a.fit || a.lens.id.localeCompare(b.lens.id))
}

/** Fit after each term of the plan (passed and planned modules up to and including it). */
export function fitByTerm(state: UserState, career: CareerData, rows: ModuleRow[], role: Role, lens: Lens): { term: string; fit: number }[] {
  const entries = roadmapEntries(state)
  const ects = new Map(rows.map((r) => [r.id, r.ects]))
  const terms = [...new Set([...(state.roadmap?.terms ?? DEFAULT_TERMS), ...Object.values(entries).map((e) => e.term)])]
    .filter((t) => t !== PRIOR).sort((a, b) => termOrder(a) - termOrder(b))
  const out: { term: string; fit: number }[] = []
  const hasPrior = Object.values(entries).some((e) => e.term === PRIOR)
  for (const term of hasPrior ? [PRIOR, ...terms] : terms) {
    const upto = Object.fromEntries(Object.entries(entries).filter(([, e]) => e.term === PRIOR || (term !== PRIOR && termOrder(e.term) <= termOrder(term))))
    out.push({ term, fit: fit(skillPoints(upto, career, (id) => ects.get(id) ?? null, ['passed', 'planned']), role, lens) })
  }
  return out
}

export interface SkillBar {
  skill: SkillId
  weight: number
  target: number
  now: number
  all: number
}

/** The path's skills, most important first: points from passed modules, from the whole plan, and the target. */
export function skillProfile(points: { now: SkillPoints; all: SkillPoints }, role: Role, lens: Lens): SkillBar[] {
  return (Object.entries(lensWeights(role, lens)) as [SkillId, number][]).filter(([, w]) => w > 0)
    .map(([skill, weight]) => ({ skill, weight, target: skillTarget(role, skill), now: points.now[skill], all: points.all[skill] }))
    .sort((a, b) => b.weight - a.weight || a.skill.localeCompare(b.skill))
}

export interface Expert {
  name: string
  score: number
  modules: { id: string; title: string }[]
}

/**
 * Lecturers (module coordinators in the handbook) whose modules teach what the path weighs most: a first list for
 * HiWi jobs and thesis supervisors.
 */
export function expertsFor(role: Role, lens: Lens, career: CareerData, rows: ModuleRow[], limit = 6): Expert[] {
  const w = lensWeights(role, lens)
  const people = new Map<string, Expert>()
  for (const r of rows) {
    const scores = career.skills.modules[r.id]
    if (!scores || !r.hb?.coordinators.length) continue
    const relevance = (Object.entries(w) as [SkillId, number][]).reduce((n, [s, x]) => n + x * (scores[s]?.[0] ?? 0), 0)
    if (relevance < 0.5) continue
    for (const name of r.hb.coordinators) {
      const e = people.get(name) ?? { name, score: 0, modules: [] }
      e.score += relevance
      e.modules.push({ id: r.id, title: r.title })
      people.set(name, e)
    }
  }
  return [...people.values()].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, limit)
    .map((e) => ({ ...e, score: Math.round(e.score * 10) / 10 }))
}

/** Words of job ads (English and German) that point to a skill. Matched case-insensitively at word starts. */
export const AD_KEYWORDS: Record<SkillId, string[]> = {
  algo: ['algorithm', 'data structure', 'leetcode', 'competitive programming', 'graph', 'optimization', 'complexity', 'algorithmen'],
  distsys: ['distributed', 'microservice', 'kubernetes', 'kafka', 'cloud', 'scalab', 'consensus', 'backend', 'aws', 'gcp', 'azure', 'verteilte'],
  sysperf: ['performance', 'low latency', 'latency', 'c++', 'rust', 'linux', 'operating system', 'compiler', 'gpu', 'cuda', 'high-performance', 'hpc', 'profiling'],
  mltheory: ['machine learning', 'statistic', 'probabilistic', 'bayesian', 'reinforcement learning', 'optimization theory', 'maschinelles lernen', 'ml '],
  dl: ['deep learning', 'neural network', 'pytorch', 'tensorflow', 'jax', 'transformer', 'llm', 'large language model', 'generative', 'diffusion'],
  nlp: ['nlp', 'natural language', 'language model', 'llm', 'text mining', 'speech', 'translation', 'retrieval'],
  cv: ['computer vision', 'image', 'video', 'perception', 'object detection', 'segmentation', 'opencv', 'bildverarbeitung'],
  robotics: ['robot', 'ros', 'autonomous', 'motion planning', 'slam', 'manipulation', 'control', 'automation', 'robotik'],
  security: ['security', 'penetration', 'pentest', 'vulnerability', 'threat', 'malware', 'iso 27001', 'siem', 'appsec', 'sicherheit'],
  crypto: ['cryptograph', 'encryption', 'pki', 'tls', 'zero-knowledge', 'post-quantum', 'blockchain', 'kryptograph'],
  embedded: ['embedded', 'firmware', 'microcontroller', 'fpga', 'vhdl', 'verilog', 'rtos', 'autosar', 'hardware', 'eingebettete'],
  swe: ['software engineer', 'clean code', 'design pattern', 'testing', 'ci/cd', 'git', 'agile', 'scrum', 'java', 'typescript', 'python', 'architecture', 'softwareentwicklung'],
  data: ['data engineer', 'sql', 'database', 'etl', 'spark', 'data pipeline', 'data warehouse', 'analytics', 'pandas', 'datenbank', 'big data'],
  formal: ['formal method', 'verification', 'model checking', 'theorem prov', 'type system', 'logic', 'coq', 'isabelle', 'safety-critical'],
  research: ['research', 'phd', 'publication', 'paper', 'scientific', 'conference', 'forschung', 'promotion'],
}

/** Skills a job ad asks for, with the words that gave each one away; most mentioned first. */
export function matchJobAd(text: string): { skill: SkillId; hits: string[] }[] {
  const t = ` ${text.toLowerCase().replace(/\s+/g, ' ')} `
  const found = (k: string) => new RegExp(`(^|[^a-z0-9äöüß+])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(t)
  return SKILLS.map((skill) => ({ skill, hits: AD_KEYWORDS[skill].filter(found).map((k) => k.trim()) }))
    .filter((x) => x.hits.length).sort((a, b) => b.hits.length - a.hits.length || a.skill.localeCompare(b.skill))
}

/**
 * "Relevant coursework" lines for a CV: modules grouped under the skill they score highest in, the path's skills
 * first. Passed modules, and planned ones when asked; grades when asked.
 */
export function courseworkLines(state: UserState, career: CareerData, rows: ModuleRow[], role: Role, lens: Lens,
  skillName: (s: SkillId) => string, opts: { planned: boolean; grades: boolean }): { heading: string; items: string[] }[] {
  const w = lensWeights(role, lens)
  const byId = new Map(rows.map((r) => [r.id, r]))
  const groups = new Map<string, string[]>()
  const order = new Map<string, number>()
  for (const [id, e] of Object.entries(roadmapEntries(state)).sort(([a], [b]) => (byId.get(a)?.title ?? a).localeCompare(byId.get(b)?.title ?? b))) {
    if (!(e.status === 'passed' || (opts.planned && e.status === 'planned'))) continue
    const r = byId.get(id)
    if (!r) continue
    const scores = career.skills.modules[id] ?? {}
    const best = (Object.entries(scores) as [SkillId, [number, string]][])
      .sort((a, b) => b[1][0] - a[1][0] || (w[b[0]] ?? 0) - (w[a[0]] ?? 0))[0]?.[0]
    const heading = best ? skillName(best) : 'Other'
    const label = `${r.title}${opts.grades && e.status === 'passed' && e.grade !== null ? ` (${e.grade.toFixed(1)})` : ''}${e.status === 'planned' ? ' (ongoing)' : ''}`
    groups.set(heading, [...(groups.get(heading) ?? []), label])
    order.set(heading, best ? -(w[best] ?? 0) : 1)
  }
  return [...groups].sort(([a], [b]) => (order.get(a)! - order.get(b)!) || a.localeCompare(b)).map(([heading, items]) => ({ heading, items }))
}

/** True when a salary band ("2026-04") is older than `months` months on `today` ("2026-10-31"). */
export function isStale(asOf: string, today: string, months = 6): boolean {
  const [y, m] = asOf.split('-').map(Number)
  const [ty, tm] = today.split('-').map(Number)
  return !y || !m ? true : (ty * 12 + tm) - (y * 12 + m) > months
}
