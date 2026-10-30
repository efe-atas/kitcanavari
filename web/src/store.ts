import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import { CACHE_KEY, defaultDeps, SyncEngine, type SyncStatus } from './sync/engine'
import type { SyncConfig } from './sync/github'
import { emptyRoadmap, roadmapEntries } from './logic/roadmap'
import { CURRENT_TERM, nextTerm, PRIOR, termOrder } from './logic/terms'
import { defaultBucket } from './logic/degree'
import { rowBucket, type RowId } from './logic/matrix'
import type { CoursesFile, Event, HandbookFile, Lang, ModuleStatus, Roadmap, RoadmapEntry, SelectedEntry, UserState } from './types'

export { roadmapEntries }

export const STORAGE_KEY = 'kitcanavari:v1'
/** ackFingerprint of an acknowledged event that is no longer in the catalog. */
export const REMOVED_ACK = '__removed__'

const browserLang = (): Lang =>
  typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('tr') ? 'tr' : 'en'

export const defaultState = (): UserState => ({ version: 1, selected: {}, lang: browserLang(), lastSeenScrapedAt: '' })

const STATUSES: ModuleStatus[] = ['planned', 'passed', 'failed', 'dropped']

function isRoadmap(r: unknown): r is Roadmap {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return false
  const m = r as Partial<Roadmap>
  return Array.isArray(m.terms) && m.terms.every((t) => typeof t === 'string')
    && !!m.modules && typeof m.modules === 'object' && Object.values(m.modules).every((e) => !!e && typeof e === 'object'
      && typeof e.term === 'string' && STATUSES.includes(e.status)
      && (e.countAs === null || typeof e.countAs === 'string') && (e.grade === null || (typeof e.grade === 'number' && e.grade >= 1 && e.grade <= 4)))
    && !!m.notes && typeof m.notes === 'object' && Object.values(m.notes).every((n) => typeof n === 'string')
}

function isState(x: unknown): x is UserState {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false
  const s = x as Partial<UserState>
  return s.version === 1 && !!s.selected && typeof s.selected === 'object' && !Array.isArray(s.selected)
    && (s.lang === 'tr' || s.lang === 'en') && typeof s.lastSeenScrapedAt === 'string'
    && (s.theme === undefined || s.theme === 'light' || s.theme === 'dark')
    && (s.areas === undefined || (Array.isArray(s.areas) && s.areas.every((a) => typeof a === 'string')))
    && (s.roadmap === undefined || isRoadmap(s.roadmap))
    && (s.followed === undefined || (Array.isArray(s.followed)
      && s.followed.every((f) => !!f && typeof f.role === 'string' && typeof f.lens === 'string')))
    && (s.starred === undefined || (Array.isArray(s.starred) && s.starred.every((id) => typeof id === 'string')))
    && Object.values(s.selected).every((e) => !!e && typeof e === 'object'
      && Array.isArray(e.enabledSlots) && e.enabledSlots.every((i) => Number.isInteger(i))
      && typeof e.ackFingerprint === 'string'
      && (e.moduleId === null || typeof e.moduleId === 'string')
      && (e.title === undefined || typeof e.title === 'string')
      && (e.countAs === undefined || e.countAs === null || typeof e.countAs === 'string'))
}

export function loadState(storage: Storage | null): { state: UserState; persistent: boolean } {
  if (!storage) return { state: defaultState(), persistent: false }
  let raw: string | null
  try {
    raw = storage.getItem(STORAGE_KEY)
  } catch {
    return { state: defaultState(), persistent: false }
  }
  let parsed: unknown = null
  try {
    parsed = raw ? JSON.parse(raw) : null
  } catch {
    parsed = undefined
  }
  if (isState(parsed)) return { state: parsed, persistent: true }
  if (raw) {
    // Keep what we could not read (corrupt, or written by a newer version) instead of silently overwriting it.
    try {
      storage.setItem(`${STORAGE_KEY}:backup`, raw)
    } catch {
      /* best effort */
    }
  }
  return { state: defaultState(), persistent: true }
}

export function saveState(storage: Storage | null, s: UserState): boolean {
  if (!storage) return false
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(s))
    return true
  } catch {
    return false
  }
}

const safeLocalStorage = (): Storage | null => {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

export const SYNC_KEY = 'kitcanavari:sync'
export const DEFAULT_PROFILE_REPO = 'efe-atas/kitcanavari-me'

export function loadSyncConfig(storage: Storage | null): SyncConfig | null {
  try {
    const c = JSON.parse(storage?.getItem(SYNC_KEY) ?? 'null') as Partial<SyncConfig> | null
    return c && typeof c.owner === 'string' && typeof c.repo === 'string' && typeof c.token === 'string' && c.token
      ? { owner: c.owner, repo: c.repo, token: c.token } : null
  } catch {
    return null
  }
}

export function saveSyncConfig(storage: Storage | null, cfg: SyncConfig): void {
  try {
    storage?.setItem(SYNC_KEY, JSON.stringify(cfg))
  } catch {
    /* the engine still runs for this session */
  }
}

/** Forget the token and the profile cache; the local plan (kitcanavari:v1) stays. */
export function clearSync(storage: Storage | null): void {
  try {
    storage?.removeItem(SYNC_KEY)
    storage?.removeItem(CACHE_KEY)
  } catch {
    /* best effort */
  }
}

export interface Sync {
  status: SyncStatus
  detail?: string
  config: SyncConfig | null
  connect: (cfg: SyncConfig) => void
  disconnect: () => void
  resolve: (keep: 'local' | 'remote') => void
  retry: () => void
}

export function useAppState(): [UserState, (fn: (s: UserState) => UserState) => void, boolean, Sync] {
  const [init] = useState(() => loadState(safeLocalStorage()))
  const [state, setState] = useState(init.state)
  const [persistent, setPersistent] = useState(init.persistent)
  const current = useRef(init.state)
  const engine = useRef<SyncEngine | null>(null)
  const [config, setConfig] = useState<SyncConfig | null>(() => loadSyncConfig(safeLocalStorage()))
  const [status, setStatus] = useState<{ status: SyncStatus; detail?: string }>({ status: 'off' })

  const commit = useCallback((next: UserState) => {
    current.current = next
    setState(next)
    if (!saveState(safeLocalStorage(), next)) setPersistent(false)
  }, [])

  const update = useCallback((fn: (s: UserState) => UserState) => {
    const next = fn(current.current)
    commit(next)
    engine.current?.record(fn, next)
  }, [commit])

  const startEngine = useCallback((cfg: SyncConfig) => {
    engine.current?.dispose()
    // Spec §3: the pre-sync plan stays as a backup.
    try {
      const storage = safeLocalStorage()
      const raw = storage?.getItem(STORAGE_KEY)
      if (raw && !storage!.getItem(`${STORAGE_KEY}:backup`)) storage!.setItem(`${STORAGE_KEY}:backup`, raw)
    } catch {
      /* best effort */
    }
    const e = new SyncEngine(cfg, defaultDeps(safeLocalStorage()),
      // Remote state never carries this device's language or theme.
      (s) => { if (engine.current === e) commit({ ...s, lang: current.current.lang, theme: current.current.theme }) },
      (st, detail) => { if (engine.current === e) setStatus({ status: st, detail }) })
    engine.current = e
    void e.start(current.current)
  }, [commit])

  useEffect(() => {
    if (config) startEngine(config)
  }, [])

  const sync: Sync = {
    ...status,
    config,
    connect: (cfg) => {
      saveSyncConfig(safeLocalStorage(), cfg)
      setConfig(cfg)
      startEngine(cfg)
    },
    disconnect: () => {
      engine.current?.dispose()
      engine.current = null
      clearSync(safeLocalStorage())
      setConfig(null)
      setStatus({ status: 'off' })
    },
    resolve: (keep) => void engine.current?.resolveConflict(keep),
    retry: () => void engine.current?.retry(),
  }
  return [state, update, persistent, sync]
}

export const addEvent = (s: UserState, ev: Event): UserState => ({
  ...s,
  selected: {
    ...s.selected,
    [ev.id]: { enabledSlots: ev.slots.map((_, i) => i), moduleId: ev.moduleIds[0] ?? null, ackFingerprint: ev.fingerprint, title: ev.title },
  },
})

export const removeEvent = (s: UserState, id: string): UserState => {
  const { [id]: _removed, ...rest } = s.selected
  return { ...s, selected: rest }
}

export const toggleSlot = (s: UserState, id: string, idx: number): UserState => {
  const e = s.selected[id]
  if (!e) return s
  const enabledSlots = e.enabledSlots.includes(idx)
    ? e.enabledSlots.filter((i) => i !== idx)
    : [...e.enabledSlots, idx].sort((a, b) => a - b)
  return { ...s, selected: { ...s.selected, [id]: { ...e, enabledSlots } } }
}

export const setModule = (s: UserState, id: string, moduleId: string | null): UserState => {
  const e = s.selected[id]
  return e ? { ...s, selected: { ...s.selected, [id]: { ...e, moduleId } } } : s
}

export const setCountAs = (s: UserState, id: string, countAs: string | null): UserState => {
  const e = s.selected[id]
  if (!e) return s
  const next = { ...s, selected: { ...s.selected, [id]: { ...e, countAs } } }
  // A stored roadmap entry of the same module carries the same choice.
  const stored = e.moduleId ? s.roadmap?.modules[e.moduleId] : undefined
  return stored ? putEntry(next, e.moduleId!, { ...stored, countAs }) : next
}

/** Sets area slot `idx` (0 or 1); an empty value clears it. */
export const setArea = (s: UserState, idx: number, area: string | null): UserState => {
  const areas = [...(s.areas ?? [])]
  if (area) areas[idx] = area
  else areas.splice(idx, 1)
  return { ...s, areas: areas.filter((a, i) => a && areas.indexOf(a) === i).slice(0, 2) }
}

export const setLang = (s: UserState, lang: Lang): UserState => ({ ...s, lang })

export const toggleTheme = (s: UserState): UserState => ({ ...s, theme: s.theme === 'dark' ? 'light' : 'dark' })

/** A fixed theme, or none to follow the system. */
export function setTheme(s: UserState, theme: 'light' | 'dark' | null): UserState {
  const { theme: _old, ...rest } = s
  return theme ? { ...rest, theme } : rest
}

export function acknowledge(s: UserState, ids: string[], data: CoursesFile): UserState {
  const selected = { ...s.selected }
  for (const id of ids) {
    const ev = data.events[id]
    // A vanished event stays in the schedule (spec §7); only its alert is silenced.
    if (selected[id]) selected[id] = { ...selected[id], ackFingerprint: ev ? ev.fingerprint : REMOVED_ACK }
  }
  return { ...s, selected, lastSeenScrapedAt: data.meta.scrapedAt }
}

const roadmapOf = (s: UserState): Roadmap => s.roadmap ?? emptyRoadmap()

/**
 * Store a module's entry, unless it is exactly what this term's weekly plan implies: then the plan carries it (its
 * countAs on the module's events) and nothing is stored. The synced profile makes the same split (stateFromProfile),
 * so a state behaves the same before and after a sync.
 */
function putEntry(s: UserState, id: string, entry: RoadmapEntry): UserState {
  const r = roadmapOf(s)
  const { [id]: _old, ...modules } = r.modules
  const events = Object.entries(s.selected).filter(([, e]) => e.moduleId === id)
  if (events.length && entry.term === CURRENT_TERM && entry.status === 'planned' && entry.grade === null) {
    const selected = { ...s.selected }
    for (const [eid, { countAs: _c, ...e }] of events) selected[eid] = entry.countAs ? { ...e, countAs: entry.countAs } : e
    return { ...s, selected, roadmap: { ...r, modules } }
  }
  return { ...s, roadmap: { ...r, modules: { ...modules, [id]: entry } } }
}

/** Change one module's entry. Unknown modules are left alone. */
function withEntry(s: UserState, id: string, fn: (e: RoadmapEntry) => RoadmapEntry): UserState {
  const current = roadmapEntries(s)[id]
  return current ? putEntry(s, id, fn(current)) : s
}

/** This term's courses of a module join the weekly timetable (all their slots on); ones already there stay as they are. */
function withWeeklyEvents(s: UserState, courses: CoursesFile, id: string): UserState {
  const selected = { ...s.selected }
  for (const ev of Object.values(courses.events)) {
    if (!ev.moduleIds.includes(id) || selected[ev.id]) continue
    selected[ev.id] = { enabledSlots: ev.slots.map((_, i) => i), moduleId: id, ackFingerprint: ev.fingerprint, title: ev.title }
  }
  return { ...s, selected }
}

const withoutWeeklyEvents = (s: UserState, id: string): UserState =>
  ({ ...s, selected: Object.fromEntries(Object.entries(s.selected).filter(([, e]) => e.moduleId !== id)) })

/** Put a module into a term; a module already in the roadmap moves there. */
export function placeModule(s: UserState, id: string, term: string): UserState {
  const existing = roadmapEntries(s)[id]
  return putEntry(s, id, existing
    ? { ...existing, term }
    : { term, status: term === PRIOR ? 'passed' : 'planned', countAs: null, grade: null })
}

/**
 * Move a module to another term (or add it there). The weekly timetable is the current term's: a module that leaves
 * the term takes its courses out of it, a planned one that arrives brings them in, as adding it would.
 */
export function moveModule(s: UserState, courses: CoursesFile, id: string, term: string): UserState {
  const existing = roadmapEntries(s)[id]
  if (existing?.term === term) return s
  let next = term === CURRENT_TERM && (existing?.status ?? 'planned') === 'planned' ? withWeeklyEvents(s, courses, id) : s
  next = placeModule(next, id, term)
  return term === CURRENT_TERM ? next : withoutWeeklyEvents(next, id)
}

export const setStatus = (s: UserState, id: string, status: ModuleStatus): UserState => withEntry(s, id, (e) => ({ ...e, status }))

/** KIT pass grades are 1.0–4.0; anything else is ignored. */
export const setGrade = (s: UserState, id: string, grade: number | null): UserState =>
  grade !== null && !(grade >= 1 && grade <= 4) ? s : withEntry(s, id, (e) => ({ ...e, grade }))

export const setEntryCountAs = (s: UserState, id: string, countAs: string | null): UserState =>
  withEntry(s, id, (e) => ({ ...e, countAs }))

/** Remove a module from the roadmap, and its courses from this term's weekly plan. */
export function removeFromRoadmap(s: UserState, id: string): UserState {
  const r = roadmapOf(s)
  const { [id]: _gone, ...modules } = r.modules
  return { ...withoutWeeklyEvents(s, id), roadmap: { ...r, modules } }
}

export function setNote(s: UserState, id: string, text: string): UserState {
  const r = roadmapOf(s)
  const { [id]: _old, ...notes } = r.notes
  return { ...s, roadmap: { ...r, notes: text.trim() ? { ...notes, [id]: text } : notes } }
}

/** Add the term after the latest one (or the current term to an empty list); never a duplicate. */
export function addTerm(s: UserState): UserState {
  const r = roadmapOf(s)
  const latest = r.terms.filter((t) => termOrder(t) >= 0).sort((a, b) => termOrder(a) - termOrder(b)).at(-1)
  const next = latest ? nextTerm(latest) : CURRENT_TERM
  return r.terms.includes(next) ? s : { ...s, roadmap: { ...r, terms: [...r.terms, next] } }
}

/**
 * Add a module to a term of the plan. In the current term its courses join the weekly schedule too, so "course"
 * and "module" stay one thing for the user. A row that differs from where it would count by default becomes countAs.
 */
export function addModuleToTerm(s: UserState, courses: CoursesFile, handbook: HandbookFile | null, id: string, term: string,
  row?: RowId): UserState {
  let next = term === CURRENT_TERM ? withWeeklyEvents(s, courses, id) : s
  next = placeModule(next, id, term)
  const bucket = row ? rowBucket(next, row) : null
  const fields = (handbook?.modules[id] ?? courses.modules[id])?.fields
  if (bucket && fields && defaultBucket(fields, next.areas ?? [], null) !== bucket) next = setEntryCountAs(next, id, bucket)
  return next
}

export const MAX_FOLLOWED = 3

/**
 * Follow (on) or unfollow a career path; a fourth one is not added. Takes the wanted end state rather than toggling,
 * so a sync conflict replay on another device's state cannot flip it back.
 */
export function setFollow(s: UserState, role: string, lens: string, on: boolean): UserState {
  const list = s.followed ?? []
  const has = list.some((f) => f.role === role && f.lens === lens)
  if (on === has) return s
  if (!on) return { ...s, followed: list.filter((f) => !(f.role === role && f.lens === lens)) }
  return list.length >= MAX_FOLLOWED ? s : { ...s, followed: [...list, { role, lens }] }
}

/** Star (on) or unstar a module. Takes the wanted end state, like setFollow, so a sync replay cannot flip it. */
export function setStar(s: UserState, id: string, on: boolean): UserState {
  const list = s.starred ?? []
  if (list.includes(id) === on) return s
  return { ...s, starred: on ? [...list, id] : list.filter((x) => x !== id) }
}

/** Everything the plan holds about one module: its stored entry, its courses in the weekly timetable, its note. */
export interface ModuleSnapshot {
  entry: RoadmapEntry | null
  events: Record<string, SelectedEntry>
  note: string | null
}

export function snapshotModule(s: UserState, id: string): ModuleSnapshot {
  return {
    entry: s.roadmap?.modules[id] ?? null,
    events: Object.fromEntries(Object.entries(s.selected).filter(([, e]) => e.moduleId === id)),
    note: s.roadmap?.notes[id] ?? null,
  }
}

/** Put a module back exactly as a snapshot had it (the undo of adding, moving or removing it). */
export function restoreModule(s: UserState, id: string, snap: ModuleSnapshot): UserState {
  const r = roadmapOf(s)
  const { [id]: _entry, ...modules } = r.modules
  const { [id]: _note, ...notes } = r.notes
  const selected = { ...Object.fromEntries(Object.entries(s.selected).filter(([, e]) => e.moduleId !== id)), ...snap.events }
  return {
    ...s, selected,
    roadmap: { ...r, modules: snap.entry ? { ...modules, [id]: snap.entry } : modules, notes: snap.note !== null ? { ...notes, [id]: snap.note } : notes },
  }
}

export const exportState = (s: UserState): string => JSON.stringify(s, null, 1)

export function importState(json: string): UserState | null {
  try {
    const parsed: unknown = JSON.parse(json)
    return isState(parsed) ? parsed : null
  } catch {
    return null
  }
}
