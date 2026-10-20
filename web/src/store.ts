import { useCallback, useState } from 'preact/hooks'
import type { CoursesFile, Event, Lang, UserState } from './types'

export const STORAGE_KEY = 'kitcanavari:v1'
/** ackFingerprint of an acknowledged event that is no longer in the catalog. */
export const REMOVED_ACK = '__removed__'

const browserLang = (): Lang =>
  typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('tr') ? 'tr' : 'en'

export const defaultState = (): UserState => ({ version: 1, selected: {}, lang: browserLang(), lastSeenScrapedAt: '' })

function isState(x: unknown): x is UserState {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false
  const s = x as Partial<UserState>
  return s.version === 1 && !!s.selected && typeof s.selected === 'object' && !Array.isArray(s.selected)
    && (s.lang === 'tr' || s.lang === 'en') && typeof s.lastSeenScrapedAt === 'string'
    && (s.theme === undefined || s.theme === 'light' || s.theme === 'dark')
    && (s.areas === undefined || (Array.isArray(s.areas) && s.areas.every((a) => typeof a === 'string')))
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

export function useAppState(): [UserState, (fn: (s: UserState) => UserState) => void, boolean] {
  const [init] = useState(() => loadState(safeLocalStorage()))
  const [state, setState] = useState(init.state)
  const [persistent, setPersistent] = useState(init.persistent)
  const update = useCallback((fn: (s: UserState) => UserState) => {
    setState((prev) => {
      const next = fn(prev)
      if (!saveState(safeLocalStorage(), next)) setPersistent(false)
      return next
    })
  }, [])
  return [state, update, persistent]
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
  return e ? { ...s, selected: { ...s.selected, [id]: { ...e, countAs } } } : s
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

export function acknowledge(s: UserState, ids: string[], data: CoursesFile): UserState {
  const selected = { ...s.selected }
  for (const id of ids) {
    const ev = data.events[id]
    // A vanished event stays in the schedule (spec §7); only its alert is silenced.
    if (selected[id]) selected[id] = { ...selected[id], ackFingerprint: ev ? ev.fingerprint : REMOVED_ACK }
  }
  return { ...s, selected, lastSeenScrapedAt: data.meta.scrapedAt }
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
