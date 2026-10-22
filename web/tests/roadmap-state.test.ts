import { describe, expect, test } from 'vitest'
import { roadmapEntries } from '../src/logic/roadmap'
import {
  addEvent, addTerm, defaultState, importState, placeModule, removeEvent, removeFromRoadmap, setCountAs, setEntryCountAs, setGrade, setNote,
  setStatus,
} from '../src/store'
import { bucketOf } from '../src/logic/degree'
import { makeCourses } from './appdata'
import { profileFromState, stateFromProfile } from '../src/sync/profile'
import { ev } from './fixtures'

const withM1 = () => addEvent(defaultState(), ev('e1', [], { moduleIds: ['M1'] }))

describe('roadmap state', () => {
  test('weekly modules appear as planned in the current term', () => {
    expect(roadmapEntries(withM1()).M1).toEqual({ term: 'WS26', status: 'planned', countAs: null, grade: null })
  })

  test('placeModule adds once and moves on the second call', () => {
    let s = placeModule(defaultState(), 'M2', 'SS27')
    s = placeModule(s, 'M2', 'WS27')
    expect(Object.keys(s.roadmap!.modules)).toEqual(['M2'])
    expect(s.roadmap!.modules.M2.term).toBe('WS27')
    expect(placeModule(defaultState(), 'M3', 'prior').roadmap!.modules.M3.status).toBe('passed')
  })

  test('marking a weekly module passed keeps it in the weekly plan and wins over the derived entry', () => {
    const s = setGrade(setStatus(withM1(), 'M1', 'passed'), 'M1', 1.7)
    expect(s.selected).toHaveProperty('e1')
    expect(roadmapEntries(s).M1).toMatchObject({ status: 'passed', grade: 1.7 })
    const back = stateFromProfile(profileFromState(s, null), { lang: 'en' })
    expect(roadmapEntries(back).M1).toMatchObject({ status: 'passed', grade: 1.7 })
    expect(back.selected).toHaveProperty('e1')
  })

  test('countAs set in the roadmap is kept for a weekly module', () => {
    const s = setEntryCountAs(withM1(), 'M1', 'elective')
    expect(roadmapEntries(s).M1.countAs).toBe('elective')
  })

  test('grades outside 1.0–4.0 are ignored', () => {
    const s = placeModule(defaultState(), 'M2', 'prior')
    expect(setGrade(s, 'M2', 5).roadmap!.modules.M2.grade).toBeNull()
    expect(setGrade(s, 'M2', 0.7).roadmap!.modules.M2.grade).toBeNull()
    expect(setGrade(s, 'M2', 4).roadmap!.modules.M2.grade).toBe(4)
  })

  test('removing a weekly module also removes its events', () => {
    const s = removeFromRoadmap(withM1(), 'M1')
    expect(s.selected).toEqual({})
    expect(roadmapEntries(s)).toEqual({})
  })

  test('notes and terms', () => {
    let s = setNote(defaultState(), 'M1', 'iyi hoca')
    expect(s.roadmap!.notes.M1).toBe('iyi hoca')
    expect(setNote(s, 'M1', '  ').roadmap!.notes).toEqual({})
    s = addTerm(addTerm(defaultState()))
    expect(s.roadmap!.terms).toEqual(['WS26', 'SS27', 'WS27', 'SS28', 'WS28', 'SS29'])
  })

  test('roadmap round-trips through the profile', () => {
    let s = placeModule(setNote(addTerm(defaultState()), 'M9', 'not'), 'M9', 'SS27')
    s = { ...s, lang: 'en' }
    const back = stateFromProfile(profileFromState(s, null), { lang: 'en' })
    expect(back.roadmap).toEqual(s.roadmap)
  })

  test('isState accepts old states and rejects a malformed roadmap', () => {
    expect(importState(JSON.stringify({ version: 1, selected: {}, lang: 'en', lastSeenScrapedAt: '' }))).not.toBeNull()
    const bad = { version: 1, selected: {}, lang: 'en', lastSeenScrapedAt: '', roadmap: { terms: [], modules: { M1: { term: 1 } }, notes: {} } }
    expect(importState(JSON.stringify(bad))).toBeNull()
  })

  test('countAs stays one value for a weekly module with a stored entry, also after a sync', () => {
    const data = makeCourses()
    let s = addEvent({ ...defaultState(), areas: ['Telematics'] }, data.events.sec)
    s = setStatus(s, 'M3', 'passed')
    s = setCountAs(s, 'sec', 'elective')
    expect(roadmapEntries(s).M3.countAs).toBe('elective')
    expect(bucketOf(s, data, 'sec')).toBe('elective')
    const back = stateFromProfile(profileFromState(s, null), { lang: 'en' })
    expect(roadmapEntries(back).M3.countAs).toBe('elective')
    expect(bucketOf(back, data, 'sec')).toBe('elective')
  })

  test('an entry equal to the weekly plan is not stored, so local and synced state agree', () => {
    let s = placeModule(withM1(), 'M1', 'WS26')
    expect(s.roadmap?.modules.M1).toBeUndefined()
    s = setStatus(setStatus(s, 'M1', 'failed'), 'M1', 'planned')
    expect(s.roadmap?.modules.M1).toBeUndefined()
    s = setEntryCountAs(s, 'M1', 'elective')
    expect(s.roadmap?.modules.M1).toBeUndefined()
    expect(s.selected.e1.countAs).toBe('elective')
    const local = removeEvent(s, 'e1')
    const synced = removeEvent(stateFromProfile(profileFromState(s, null), { lang: 'en' }), 'e1')
    expect(roadmapEntries(local)).toEqual(roadmapEntries(synced))
  })
})
