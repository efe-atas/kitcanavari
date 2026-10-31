// The synced profile (spec §2.2): what lives in the private repo's profile.json. Device-only settings (lang, theme)
// stay out of it; the in-memory shape is still UserState, converted both ways here.
import { roadmapEntries } from '../logic/roadmap'
import { CURRENT_TERM, DEFAULT_TERMS } from '../logic/terms'
import { validExtras } from '../logic/extras'
import type { Deadline, ModuleStatus, Review, Roadmap, RoadmapEntry, Scenario, SelectedEntry, UserState } from '../types'

/** 'WS26', 'SS27', … or 'prior' (passed or recognised before the first term). */
export type TermId = string
export type { ModuleStatus }
export type ProfileModule = RoadmapEntry

export type WeeklyEntry = Omit<SelectedEntry, 'countAs'>

export interface Profile {
  version: 1
  areas: string[]
  terms: string[]
  modules: Record<string, ProfileModule>
  weekly: Record<string, WeeklyEntry>
  lastSeenScrapedAt: string
  followed: { role: string; lens: string }[]
  notes: Record<string, string>
  /** Shortlisted modules; profiles written before 2026-10-30 have none. */
  starred?: string[]
  /** Added 2026-10-31; older profiles have none. */
  deadlines?: Deadline[]
  scenarios?: Scenario[]
  expected?: Record<string, number>
  reviews?: Record<string, Review>
}

export { CURRENT_TERM, DEFAULT_TERMS }
const STATUSES: ModuleStatus[] = ['planned', 'passed', 'failed', 'dropped']

export const emptyProfile = (): Profile => ({
  version: 1, areas: [], terms: [...DEFAULT_TERMS], modules: {}, weekly: {}, lastSeenScrapedAt: '', followed: [], notes: {},
})

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
const isStrings = (x: unknown): x is string[] => Array.isArray(x) && x.every((v) => typeof v === 'string')

export function isProfile(x: unknown): x is Profile {
  if (!isObj(x)) return false
  const p = x as Partial<Profile>
  return p.version === 1 && isStrings(p.areas) && isStrings(p.terms) && typeof p.lastSeenScrapedAt === 'string'
    && isObj(p.modules) && Object.values(p.modules).every((m) => isObj(m)
      && typeof m.term === 'string' && STATUSES.includes(m.status as ModuleStatus)
      && (m.countAs === null || typeof m.countAs === 'string')
      && (m.grade === null || (typeof m.grade === 'number' && m.grade >= 1 && m.grade <= 4)))
    && isObj(p.weekly) && Object.values(p.weekly).every((e) => isObj(e)
      && Array.isArray(e.enabledSlots) && e.enabledSlots.every((i) => Number.isInteger(i))
      && typeof e.ackFingerprint === 'string'
      && (e.moduleId === null || typeof e.moduleId === 'string')
      && (e.title === undefined || typeof e.title === 'string'))
    && Array.isArray(p.followed) && p.followed.every((f) => isObj(f) && typeof f.role === 'string' && typeof f.lens === 'string')
    && isObj(p.notes) && Object.values(p.notes).every((n) => typeof n === 'string')
    && (p.starred === undefined || isStrings(p.starred))
    && validExtras(p as Record<string, unknown>, isProfileRoadmap)
}

/** A scenario's roadmap inside a profile, checked like the state's. */
function isProfileRoadmap(r: unknown): r is Roadmap {
  if (!isObj(r)) return false
  const m = r as Partial<Roadmap>
  return isStrings(m.terms) && isObj(m.modules) && Object.values(m.modules).every((e) => isObj(e) && typeof e.term === 'string'
    && STATUSES.includes(e.status as ModuleStatus)) && isObj(m.notes)
}

export function profileFromState(s: UserState, prev: Profile | null): Profile {
  const base = prev ?? emptyProfile()
  const weekly: Record<string, WeeklyEntry> = {}
  for (const [id, { countAs: _countAs, ...entry }] of Object.entries(s.selected)) weekly[id] = entry
  return {
    ...base,
    areas: [...(s.areas ?? [])],
    terms: [...(s.roadmap?.terms ?? base.terms)],
    modules: roadmapEntries(s),
    notes: { ...(s.roadmap?.notes ?? base.notes) },
    weekly,
    lastSeenScrapedAt: s.lastSeenScrapedAt,
    // Older code never set followed in the state; keep what the profile already had then.
    followed: s.followed ? s.followed.map((f) => ({ ...f })) : base.followed,
    ...(s.starred ? { starred: [...s.starred] } : base.starred ? { starred: [...base.starred] } : {}),
    ...extras(s, base),
  }
}

export function stateFromProfile(p: Profile, device: Pick<UserState, 'lang' | 'theme'>): UserState {
  const weeklyModules = new Set(Object.values(p.weekly).map((e) => e.moduleId).filter(Boolean))
  // An entry is the weekly plan's own (not stored in the roadmap) when it is exactly what the plan implies.
  const derived = (id: string, m: ProfileModule) =>
    m.term === CURRENT_TERM && m.status === 'planned' && m.grade === null && weeklyModules.has(id)
  const selected: Record<string, SelectedEntry> = {}
  for (const [id, entry] of Object.entries(p.weekly)) {
    const countAs = entry.moduleId ? p.modules[entry.moduleId]?.countAs : null
    selected[id] = countAs ? { ...entry, countAs } : { ...entry }
  }
  const modules = Object.fromEntries(Object.entries(p.modules).filter(([id, m]) => !derived(id, m)))
  const isDefault = !Object.keys(modules).length && !Object.keys(p.notes).length
    && JSON.stringify(p.terms) === JSON.stringify(DEFAULT_TERMS)
  return {
    version: 1, selected, lang: device.lang, lastSeenScrapedAt: p.lastSeenScrapedAt, areas: [...p.areas], theme: device.theme,
    ...(isDefault ? {} : { roadmap: { terms: [...p.terms], modules, notes: { ...p.notes } } }),
    ...(p.followed.length ? { followed: p.followed.map((f) => ({ ...f })) } : {}),
    ...(p.starred?.length ? { starred: [...p.starred] } : {}),
    ...(p.deadlines?.length ? { deadlines: p.deadlines.map((d) => ({ ...d })) } : {}),
    ...(p.scenarios?.length ? { scenarios: structuredClone(p.scenarios) } : {}),
    ...(p.expected && Object.keys(p.expected).length ? { expected: { ...p.expected } } : {}),
    ...(p.reviews && Object.keys(p.reviews).length ? { reviews: structuredClone(p.reviews) } : {}),
  }
}

/** The extra fields: the state's when it has them, else what the profile already had (older code never set them). */
function extras(s: UserState, base: Profile): Pick<Profile, 'deadlines' | 'scenarios' | 'expected' | 'reviews'> {
  const out: Pick<Profile, 'deadlines' | 'scenarios' | 'expected' | 'reviews'> = {}
  const deadlines = s.deadlines ?? base.deadlines
  const scenarios = s.scenarios ?? base.scenarios
  const expected = s.expected ?? base.expected
  const reviews = s.reviews ?? base.reviews
  if (deadlines) out.deadlines = deadlines.map((d) => ({ ...d }))
  if (scenarios) out.scenarios = structuredClone(scenarios)
  if (expected) out.expected = { ...expected }
  if (reviews) out.reviews = structuredClone(reviews)
  return out
}
