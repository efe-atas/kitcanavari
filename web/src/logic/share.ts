// A plan as a short, URL-safe code (#/shared/<code>) so it can be sent to a friend or an advisor and opened read-only.
// Only the plan travels: areas, terms, and each module's term, status, place and (if chosen) grade. Notes, the weekly
// timetable, the shortlist and career goals stay on the device.
import type { ModuleStatus, Review, RoadmapEntry, UserState } from '../types'
import { AREAS, ELECTIVE, IQ, MINOR } from './degree'
import { roadmapEntries } from './roadmap'
import { DEFAULT_TERMS, PRIOR } from './terms'

export interface SharedPlan {
  areas: string[]
  terms: string[]
  modules: Record<string, RoadmapEntry>
  /** Ratings the sender chose to share (no free text). */
  reviews?: Record<string, Review>
}

const VERSION = '1'
const PREFIXES: [string, string][] = [['M-INFO-', 'i'], ['M-ETIT-', 'e'], ['M-MACH-', 'm'], ['M-MATH-', 'a'], ['M-WIWI-', 'w']]
const STATUS: Record<ModuleStatus, string> = { planned: 'p', passed: 's', failed: 'f', dropped: 'd' }
const SAFE = /^[A-Za-z0-9-]+$/

const packId = (id: string) => {
  const hit = PREFIXES.find(([p]) => id.startsWith(p) && /^\d+$/.test(id.slice(p.length)))
  return hit ? hit[1] + id.slice(hit[0].length) : `x${id}`
}
const unpackId = (s: string) => {
  if (s.startsWith('x')) return s.slice(1)
  const hit = PREFIXES.find(([, c]) => c === s[0])
  return hit && /^\d+$/.test(s.slice(1)) ? hit[0] + s.slice(1) : null
}
const packBucket = (b: string | null) => {
  if (!b) return ''
  if (b === ELECTIVE) return 'e'
  if (b === MINOR) return 'n'
  if (b === IQ) return 'q'
  const i = AREAS.indexOf(b)
  return i >= 0 ? String(i) : ''
}
const unpackBucket = (s: string): string | null =>
  s === 'e' ? ELECTIVE : s === 'n' ? MINOR : s === 'q' ? IQ : /^\d$/.test(s) ? AREAS[Number(s)] ?? null : null

export function encodePlan(state: UserState, withGrades: boolean, withReviews = false): string {
  const terms = state.roadmap?.terms ?? DEFAULT_TERMS
  const areas = (state.areas ?? []).map((a) => AREAS.indexOf(a)).filter((i) => i >= 0).join('.')
  const modules = Object.entries(roadmapEntries(state))
    .filter(([id, e]) => SAFE.test(id) && (e.term === PRIOR || terms.includes(e.term)))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, e]) => [packId(id), e.term === PRIOR ? 'p' : String(terms.indexOf(e.term)), STATUS[e.status],
      withGrades && e.grade !== null ? String(Math.round(e.grade * 10)) : '', packBucket(e.countAs)].join(',').replace(/,+$/, ''))
  const parts = [VERSION, areas, terms.filter((x) => /^(WS|SS)\d{2}$/.test(x)).join('.'), modules.join('.')]
  const reviews = Object.entries(state.reviews ?? {}).filter(([id, r]) => SAFE.test(id) && (r.difficulty || r.workload || r.recommend !== null))
  if (withReviews && reviews.length) {
    parts.push(reviews.map(([id, r]) => [packId(id), r.difficulty ?? '', r.workload ?? '', r.recommend === null ? '' : r.recommend ? 'y' : 'n'].join(',')).join('.'))
  }
  return parts.join('~')
}

/** The plan in a code, or null when the code is not one (a typo, a truncated link, a newer version). */
export function decodePlan(code: string): SharedPlan | null {
  const parts = code.split('~')
  if ((parts.length !== 4 && parts.length !== 5) || parts[0] !== VERSION) return null
  const [, a, t, m, rv] = parts
  const areas = a ? a.split('.').map((i) => AREAS[Number(i)]) : []
  const terms = t ? t.split('.') : []
  if (areas.some((x) => !x) || terms.some((x) => !/^(WS|SS)\d{2}$/.test(x))) return null
  const modules: Record<string, RoadmapEntry> = {}
  for (const item of m ? m.split('.') : []) {
    const [rawId, rawTerm, rawStatus, rawGrade = '', rawBucket = ''] = item.split(',')
    const id = unpackId(rawId ?? '')
    const term = rawTerm === 'p' ? PRIOR : terms[Number(rawTerm)]
    const status = (Object.keys(STATUS) as ModuleStatus[]).find((k) => STATUS[k] === rawStatus)
    const grade = rawGrade ? Number(rawGrade) / 10 : null
    if (!id || !term || !status || (grade !== null && !(grade >= 1 && grade <= 4))) return null
    modules[id] = { term, status, grade, countAs: unpackBucket(rawBucket) }
  }
  if (rv === undefined) return { areas, terms, modules }
  const reviews: Record<string, Review> = {}
  for (const item of rv ? rv.split('.') : []) {
    const [rawId, d = '', w = '', rec = ''] = item.split(',')
    const id = unpackId(rawId ?? '')
    const num = (x: string) => (x === '' ? null : Number(x))
    const r: Review = { difficulty: num(d), workload: num(w), recommend: rec === 'y' ? true : rec === 'n' ? false : null, text: '' }
    const ok = (x: number | null) => x === null || (Number.isInteger(x) && x >= 1 && x <= 5)
    if (!id || !ok(r.difficulty) || !ok(r.workload)) return null
    reviews[id] = r
  }
  return { areas, terms, modules, reviews }
}

/** A state that shows a shared plan with the app's own views (nothing in the weekly timetable). */
export const planState = (plan: SharedPlan, device: Pick<UserState, 'lang' | 'theme'>): UserState => ({
  version: 1, selected: {}, lang: device.lang, ...(device.theme ? { theme: device.theme } : {}), lastSeenScrapedAt: '',
  areas: [...plan.areas], roadmap: { terms: [...plan.terms], modules: { ...plan.modules }, notes: {} },
})
