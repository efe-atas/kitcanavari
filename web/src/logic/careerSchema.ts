// The fixed shape of the hand-curated career files (data/career/*.json). Curation happens in a Claude Code session
// only (spec §1); this check keeps the files honest.
import type { CareerData, SkillId } from '../types'

export const SKILLS: SkillId[] = [
  'algo', 'distsys', 'sysperf', 'mltheory', 'dl', 'nlp', 'cv', 'robotics',
  'security', 'crypto', 'embedded', 'swe', 'data', 'formal', 'research',
]
export const ROLE_IDS = ['ml-eng', 'research-sci', 'data-sci', 'backend', 'quant', 'security', 'robotics', 'embedded', 'architect', 'academia']
export const LENS_IDS = ['bigtech', 'quant', 'ailab', 'industry', 'startup', 'academia']

const isSkill = (k: string): k is SkillId => (SKILLS as string[]).includes(k)
const filled = (s: unknown) => typeof s === 'string' && s.trim().length > 0

/** Returns one message per problem; empty = valid. */
export function validateCareer(c: CareerData): string[] {
  const errors: string[] = []
  for (const [id, scores] of Object.entries(c.skills.modules)) {
    for (const [skill, value] of Object.entries(scores ?? {})) {
      const where = `skills ${id}.${skill}`
      if (!isSkill(skill)) errors.push(`${where}: unknown skill`)
      const [score, reason] = Array.isArray(value) ? value : [NaN, '']
      if (!Number.isInteger(score) || score < 0 || score > 3) errors.push(`${where}: score must be 0–3`)
      if (!filled(reason)) errors.push(`${where}: reason is empty`)
    }
  }
  const roleIds = c.roles.roles.map((r) => r.id)
  for (const id of ROLE_IDS) if (!roleIds.includes(id)) errors.push(`roles: missing ${id}`)
  for (const r of c.roles.roles) {
    if (!ROLE_IDS.includes(r.id)) errors.push(`roles: unknown role ${r.id}`)
    if (!filled(r.title?.tr) || !filled(r.title?.en) || !filled(r.summary?.tr) || !filled(r.summary?.en)) errors.push(`role ${r.id}: title/summary missing`)
    const sum = Object.values(r.weights).reduce((n, w) => n + (w ?? 0), 0)
    if (Math.abs(sum - 1) > 0.001) errors.push(`role ${r.id} weights sum to ${sum.toFixed(3)}, not 1`)
    for (const [k, w] of Object.entries(r.weights)) {
      if (!isSkill(k)) errors.push(`role ${r.id}: unknown skill ${k}`)
      else if ((w ?? 0) > 0 && !((r.targets[k] ?? 0) > 0)) errors.push(`role ${r.id}: no target for ${k}`)
    }
    for (const k of Object.keys(r.targets)) if (!isSkill(k)) errors.push(`role ${r.id}: unknown target skill ${k}`)
  }
  const lensIds = c.lenses.lenses.map((l) => l.id)
  for (const id of LENS_IDS) if (!lensIds.includes(id)) errors.push(`lenses: missing ${id}`)
  for (const l of c.lenses.lenses) {
    if (!LENS_IDS.includes(l.id)) errors.push(`lenses: unknown lens ${l.id}`)
    for (const [k, m] of Object.entries(l.multipliers)) {
      if (!isSkill(k)) errors.push(`lens ${l.id}: unknown skill ${k}`)
      if (!((m ?? 0) > 0)) errors.push(`lens ${l.id}: multiplier for ${k} must be > 0`)
    }
    for (const b of l.salary) {
      if (!ROLE_IDS.includes(b.role)) errors.push(`lens ${l.id}: salary for unknown role ${b.role}`)
      if (!/^https?:\/\//.test(b.source ?? '')) errors.push(`lens ${l.id}: salary source missing for ${b.role}`)
      if (!/^\d{4}-\d{2}$/.test(b.asOf ?? '')) errors.push(`lens ${l.id}: salary asOf must be YYYY-MM for ${b.role}`)
      if (!filled(b.band)) errors.push(`lens ${l.id}: salary band empty for ${b.role}`)
    }
    if (!filled(l.interview?.tr) || !filled(l.interview?.en)) errors.push(`lens ${l.id}: interview missing`)
  }
  return errors
}
