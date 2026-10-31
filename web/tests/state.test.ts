import { describe, expect, test } from 'vitest'
import { pendingAlerts } from '../src/logic/alerts'
import { acknowledge, addEvent, defaultState, exportState, importState, loadState, removeEvent, saveState, setModule, toggleSlot, STORAGE_KEY } from '../src/store'
import type { ChangesFile, CoursesFile, UserState } from '../src/types'
import { ev, slot } from './fixtures'

const memStorage = (init: Record<string, string> = {}): Storage => {
  const m = new Map(Object.entries(init))
  return {
    get length() { return m.size },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => { m.delete(k) },
    setItem: (k, v) => { m.set(k, String(v)) },
  }
}

const throwing: Storage = { ...memStorage(), getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') } }

const courses = (events: CoursesFile['events'], scrapedAt = '2026-10-21T04:00:00Z'): CoursesFile =>
  ({ meta: { scrapedAt, term: 'WS 26/27', termGuid: '', spo: '', warnings: [] }, tree: [], events, modules: {} })

describe('store', () => {
  test('a saved German interface opens in English, keeping the plan', () => {
    const raw = JSON.stringify({ version: 1, selected: {}, lang: 'de', lastSeenScrapedAt: 'x', starred: ['M1'] })
    const r = loadState(memStorage({ [STORAGE_KEY]: raw }))
    expect(r.state.lang).toBe('en')
    expect(r.state.starred).toEqual(['M1'])
  })
  test('loadState returns default on corrupt json', () => {
    const r = loadState(memStorage({ [STORAGE_KEY]: '{not json' }))
    expect(r.state.selected).toEqual({})
    expect(r.persistent).toBe(true)
  })
  test('unreadable saved state is backed up before being replaced', () => {
    const raw = JSON.stringify({ version: 2, selected: { a: { future: true } } })
    const s = memStorage({ [STORAGE_KEY]: raw })
    expect(loadState(s).state.selected).toEqual({})
    expect(s.getItem(`${STORAGE_KEY}:backup`)).toBe(raw)
  })
  test('loadState returns default on wrong version', () => {
    expect(loadState(memStorage({ [STORAGE_KEY]: JSON.stringify({ version: 9, selected: { a: 1 } }) })).state.selected).toEqual({})
  })
  test('loadState treats throwing storage as non-persistent', () => {
    expect(loadState(throwing).persistent).toBe(false)
    expect(loadState(null).persistent).toBe(false)
    expect(saveState(throwing, defaultState())).toBe(false)
  })
  test('save then load round-trips', () => {
    const s = memStorage()
    const st = addEvent(defaultState(), ev('a', [slot('Tue', '14:00', '15:30'), slot('Fri', '10:00', '11:30')]))
    expect(saveState(s, st)).toBe(true)
    expect(loadState(s).state).toEqual(st)
  })
  test('addEvent enables all slots, picks first module, stores fingerprint and title', () => {
    const st = addEvent(defaultState(), ev('a', [slot('Tue', '14:00', '15:30'), slot('Fri', '10:00', '11:30')]))
    expect(st.selected.a).toEqual({ enabledSlots: [0, 1], moduleId: 'M1', ackFingerprint: 'fp-a', title: 'Title a' })
  })
  test('toggleSlot, setModule, removeEvent', () => {
    let st = addEvent(defaultState(), ev('a', [slot('Tue', '14:00', '15:30'), slot('Fri', '10:00', '11:30')]))
    st = toggleSlot(st, 'a', 0)
    expect(st.selected.a.enabledSlots).toEqual([1])
    st = toggleSlot(st, 'a', 0)
    expect(st.selected.a.enabledSlots).toEqual([0, 1])
    st = setModule(st, 'a', 'M9')
    expect(st.selected.a.moduleId).toBe('M9')
    expect(removeEvent(st, 'a').selected).toEqual({})
  })
  test('loadState rejects entries with malformed moduleId or slots', () => {
    const bad = (e: object) => memStorage({ [STORAGE_KEY]: JSON.stringify({ version: 1, lang: 'en', lastSeenScrapedAt: '', selected: { a: e } }) })
    expect(loadState(bad({ enabledSlots: [0], ackFingerprint: '', moduleId: 5 })).state.selected).toEqual({})
    expect(loadState(bad({ enabledSlots: ['x'], ackFingerprint: '', moduleId: null })).state.selected).toEqual({})
    expect(loadState(bad({ enabledSlots: [0], ackFingerprint: '', moduleId: 'M1', title: 3 })).state.selected).toEqual({})
  })
  test('importState rejects garbage', () => {
    expect(importState('[]')).toBeNull()
    expect(importState('nope')).toBeNull()
    expect(importState('{"selected": 5}')).toBeNull()
  })
  test('export/import round-trips', () => {
    const st = addEvent(defaultState(), ev('a'))
    expect(importState(exportState(st))).toEqual(st)
  })
})

describe('pendingAlerts', () => {
  const changes: ChangesFile = {
    entries: [
      { at: '2026-10-21T04:00:00Z', eventId: 'a', eventTitle: 'A', kind: 'room_changed', summary: 'Room X → Y' },
      { at: '2026-10-19T04:00:00Z', eventId: 'a', eventTitle: 'A', kind: 'added', summary: 'Added' },
    ],
  }
  const withA = (ack: string): UserState => ({ ...defaultState(), lastSeenScrapedAt: '2026-10-20T04:00:00Z', selected: { a: { enabledSlots: [0], moduleId: null, ackFingerprint: ack } } })

  test('alerts flag fingerprint change', () => {
    const alerts = pendingAlerts(withA('old'), courses({ a: ev('a', [], { fingerprint: 'new' }) }), changes)
    expect(alerts).toHaveLength(1)
    expect(alerts[0]).toMatchObject({ eventId: 'a', removed: false })
    expect(alerts[0].changes.map((c) => c.kind)).toEqual(['room_changed'])
  })
  test('no alert when fingerprint matches', () => {
    expect(pendingAlerts(withA('fp-a'), courses({ a: ev('a') }), changes)).toEqual([])
  })
  test('alerts include removed events', () => {
    const [al] = pendingAlerts(withA('fp-a'), courses({}), changes)
    expect(al).toMatchObject({ eventId: 'a', removed: true })
  })
  test('acknowledge clears alerts', () => {
    const data = courses({ a: ev('a', [], { fingerprint: 'new' }) })
    const st = acknowledge(withA('old'), ['a'], data)
    expect(pendingAlerts(st, data, changes)).toEqual([])
    expect(st.lastSeenScrapedAt).toBe('2026-10-21T04:00:00Z')
  })
  test('acknowledging a removed event keeps it in the schedule and silences the alert', () => {
    const st = acknowledge(withA('x'), ['a'], courses({}))
    expect(st.selected).toHaveProperty('a')
    expect(pendingAlerts(st, courses({}), changes)).toEqual([])
  })
  test('a removed event that comes back alerts again', () => {
    const st = acknowledge(withA('x'), ['a'], courses({}))
    expect(pendingAlerts(st, courses({ a: ev('a') }), changes)).toHaveLength(1)
  })
})
