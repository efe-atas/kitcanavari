// Finding modules by what people type (accents and case ignored, every word must match somewhere), and modules
// similar to one another (shared skills from the career data, shared areas).
import type { CareerData, SkillId } from '../types'
import { moduleAreas } from './degree'
import type { ModuleRow } from './handbook'

/** "Maschinelles Lernen" → "maschinelles lernen"; "Müller" → "muller". */
export const fold = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const words = (q: string) => fold(q).split(/\s+/).filter(Boolean)

/** How well a module matches a query: 0 when a word matches nowhere; higher for title starts and whole ids. */
export function matchScore(r: ModuleRow, query: string): number {
  const qs = words(query)
  if (!qs.length) return 1
  const title = fold(r.title)
  const id = fold(r.id)
  const people = (r.hb?.coordinators ?? []).map(fold)
  let score = 0
  for (const q of qs) {
    if (title.startsWith(q)) score += 6
    else if (title.split(/[^a-z0-9]+/).some((w) => w.startsWith(q))) score += 4
    else if (title.includes(q)) score += 2
    else if (id === q || id.endsWith(q)) score += 5
    else if (id.includes(q)) score += 2
    else if (people.some((p) => p.includes(q))) score += 1
    else return 0
  }
  return score
}

/** Modules matching the query, best first (then by title). */
export function searchModules(rows: ModuleRow[], query: string, limit = Infinity): ModuleRow[] {
  return rows.map((r) => ({ r, s: matchScore(r, query) })).filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.r.title.localeCompare(b.r.title)).slice(0, limit).map((x) => x.r)
}

/** Where a query matches inside a text, for highlighting: [before, match, after] pieces, or null. */
export function highlight(text: string, query: string): [string, string, string] | null {
  const q = words(query).sort((a, b) => b.length - a.length)[0]
  if (!q) return null
  const i = fold(text).indexOf(q)
  // fold() keeps one character per character for Latin text, so positions carry over.
  return i < 0 ? null : [text.slice(0, i), text.slice(i, i + q.length), text.slice(i + q.length)]
}

const vector = (career: CareerData | null, id: string): Partial<Record<SkillId, number>> => {
  const s = career?.skills.modules[id] ?? {}
  return Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v?.[0] ?? 0]))
}

function cosine(a: Partial<Record<SkillId, number>>, b: Partial<Record<SkillId, number>>): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)]) as Set<SkillId>) {
    const x = a[k] ?? 0
    const y = b[k] ?? 0
    dot += x * y
    na += x * x
    nb += y * y
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0
}

/**
 * Modules like this one: mostly the same skills (when the career data scores both), partly the same areas of
 * specialization. Only modules with a real resemblance are returned.
 */
export function similarModules(id: string, rows: ModuleRow[], career: CareerData | null, limit = 4): { id: string; score: number }[] {
  const me = rows.find((r) => r.id === id)
  if (!me) return []
  const mine = vector(career, id)
  const areas = new Set(moduleAreas(me))
  const scored = Object.keys(mine).length > 0
  return rows.filter((r) => r.id !== id).map((r) => {
    const theirs = moduleAreas(r)
    const shared = theirs.filter((a) => areas.has(a)).length
    const union = new Set([...areas, ...theirs]).size
    const areaSim = union ? shared / union : 0
    const skillSim = scored ? cosine(mine, vector(career, r.id)) : 0
    return { id: r.id, score: scored ? 0.75 * skillSim + 0.25 * areaSim : areaSim }
  }).filter((x) => x.score >= (scored ? 0.55 : 0.5))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, limit)
}
