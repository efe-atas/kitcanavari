import { describe, expect, test } from 'vitest'
import { roadmapEntries } from '../src/logic/roadmap'
import {
  defaultState, importState, placeModule, putDeadline, removeDeadline, removeScenario, saveScenario, setExpected, setReview,
} from '../src/store'
import { isProfile, profileFromState, stateFromProfile } from '../src/sync/profile'

describe('the user own data next to the plan', () => {
  test('dates are kept in date order and can be removed', () => {
    let s = putDeadline(defaultState(), { moduleId: 'H1', title: 'Exam', date: '2027-02-20', time: '09:00', kind: 'exam' })
    s = putDeadline(s, { moduleId: null, title: 'Register', date: '2027-01-10', time: null, kind: 'registration' })
    expect(s.deadlines!.map((d) => d.title)).toEqual(['Register', 'Exam'])
    s = removeDeadline(s, s.deadlines![0].id)
    expect(s.deadlines!.map((d) => d.title)).toEqual(['Exam'])
  })

  test('expected grades and reviews', () => {
    let s = setExpected(defaultState(), 'H1', 1.7)
    expect(s.expected).toEqual({ H1: 1.7 })
    expect(setExpected(s, 'H1', 5)).toBe(s)
    s = setExpected(s, 'H1', null)
    expect(s.expected).toEqual({})
    s = setReview(s, 'H1', { difficulty: 4, workload: 3, recommend: true, text: 'good' })
    expect(s.reviews!.H1.difficulty).toBe(4)
    s = setReview(s, 'H1', { difficulty: null, workload: null, recommend: null, text: ' ' })
    expect(s.reviews).toEqual({})
  })

  test('a scenario keeps a copy of the plan', () => {
    let s = placeModule(defaultState(), 'H1', 'SS27')
    s = saveScenario(s, 'ML heavy')
    const sc = s.scenarios![0]
    expect(sc.name).toBe('ML heavy')
    expect(sc.roadmap.modules).toEqual(roadmapEntries(s))
    expect(removeScenario(s, sc.id).scenarios).toEqual([])
  })

  test('everything round-trips through backups and the synced profile; bad values are refused', () => {
    let s = putDeadline(placeModule(defaultState(), 'H1', 'SS27'), { moduleId: 'H1', title: 'Exam', date: '2027-02-20', time: null, kind: 'exam' })
    s = saveScenario(setReview(setExpected(s, 'H1', 2.3), 'H1', { difficulty: 2, workload: null, recommend: false, text: '' }), 'A')
    expect(importState(JSON.stringify(s))).toEqual(s)
    const p = profileFromState(s, null)
    expect(isProfile(p)).toBe(true)
    const back = stateFromProfile(p, { lang: 'en' })
    expect([back.deadlines, back.scenarios, back.expected, back.reviews]).toEqual([s.deadlines, s.scenarios, s.expected, s.reviews])
    expect(importState(JSON.stringify({ ...s, deadlines: [{ id: 'x', title: 'a', date: 'tomorrow', time: null, kind: 'exam', moduleId: null }] }))).toBeNull()
    expect(importState(JSON.stringify({ ...s, expected: { H1: 7 } }))).toBeNull()
    expect(importState(JSON.stringify({ ...s, reviews: { H1: { difficulty: 9, workload: null, recommend: null, text: '' } } }))).toBeNull()
    // A device that never used them keeps what another device saved.
    expect(profileFromState(defaultState(), p).deadlines).toEqual(s.deadlines)
  })
})
