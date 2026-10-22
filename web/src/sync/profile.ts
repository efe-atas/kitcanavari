// The synced profile (spec §2.2): what lives in the private repo's profile.json. Device-only settings (lang, theme)
// stay out of it; the in-memory shape is still UserState, converted both ways here.
import type { SelectedEntry, UserState } from '../types'

/** 'WS26', 'SS27', … or 'prior' (passed or recognised before the first term). */
export type TermId = string
export type ModuleStatus = 'planned' | 'passed' | 'failed' | 'dropped'

export interface ProfileModule {
  term: TermId
  status: ModuleStatus
  countAs: string | null
  grade: number | null
}

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
}

export const CURRENT_TERM = 'WS26'
export const DEFAULT_TERMS = ['WS26', 'SS27', 'WS27', 'SS28']
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
      && (m.grade === null || typeof m.grade === 'number'))
    && isObj(p.weekly) && Object.values(p.weekly).every((e) => isObj(e)
      && Array.isArray(e.enabledSlots) && e.enabledSlots.every((i) => Number.isInteger(i))
      && typeof e.ackFingerprint === 'string'
      && (e.moduleId === null || typeof e.moduleId === 'string')
      && (e.title === undefined || typeof e.title === 'string'))
    && Array.isArray(p.followed) && p.followed.every((f) => isObj(f) && typeof f.role === 'string' && typeof f.lens === 'string')
    && isObj(p.notes) && Object.values(p.notes).every((n) => typeof n === 'string')
}

export function profileFromState(s: UserState, prev: Profile | null): Profile {
  const base = prev ?? emptyProfile()
  const weekly: Record<string, WeeklyEntry> = {}
  // This term's planned modules mirror the weekly plan; everything else (other terms, passed, …) is kept.
  const modules = Object.fromEntries(Object.entries(base.modules)
    .filter(([, m]) => !(m.term === CURRENT_TERM && m.status === 'planned')))
  for (const [id, { countAs, ...entry }] of Object.entries(s.selected)) {
    weekly[id] = entry
    if (entry.moduleId) modules[entry.moduleId] = { term: CURRENT_TERM, status: 'planned', countAs: countAs ?? null, grade: null }
  }
  return { ...base, areas: [...(s.areas ?? [])], weekly, modules, lastSeenScrapedAt: s.lastSeenScrapedAt }
}

export function stateFromProfile(p: Profile, device: Pick<UserState, 'lang' | 'theme'>): UserState {
  const selected: Record<string, SelectedEntry> = {}
  for (const [id, entry] of Object.entries(p.weekly)) {
    const countAs = entry.moduleId ? p.modules[entry.moduleId]?.countAs : null
    selected[id] = countAs ? { ...entry, countAs } : { ...entry }
  }
  return { version: 1, selected, lang: device.lang, lastSeenScrapedAt: p.lastSeenScrapedAt, areas: [...p.areas], theme: device.theme }
}
