import { describe, expect, test } from 'vitest'
import { roadmapEntries } from '../src/logic/roadmap'
import { addModuleToTerm, defaultState, moveModule, setStatus } from '../src/store'
import { stateFromProfile, profileFromState } from '../src/sync/profile'
import { makeCourses, makeHandbook } from './appdata'

const AREAS = ['Human-centred Machine Intelligence', 'Cryptography and Security']
const base = () => ({ ...defaultState(), areas: AREAS })

describe('moveModule', () => {
  test('a course leaving the current term leaves the weekly timetable, keeping where it counts', () => {
    const data = makeCourses()
    let s = addModuleToTerm(base(), data, makeHandbook(), 'M3', 'WS26', 'elective')
    expect(Object.keys(s.selected).sort()).toEqual(['ml', 'sec'])
    s = moveModule(s, data, 'M3', 'SS27')
    expect(s.selected).toEqual({})
    expect(roadmapEntries(s).M3).toEqual({ term: 'SS27', status: 'planned', countAs: 'elective', grade: null })
  })

  test('a planned course arriving in the current term brings its courses into the timetable', () => {
    const data = makeCourses()
    let s = addModuleToTerm(base(), data, makeHandbook(), 'M3', 'SS27')
    expect(s.selected).toEqual({})
    s = moveModule(s, data, 'M3', 'WS26')
    expect(Object.keys(s.selected).sort()).toEqual(['ml', 'sec'])
    // Exactly what the weekly plan implies: nothing is stored twice, so a sync gives the same state.
    expect(s.roadmap?.modules.M3).toBeUndefined()
    const back = stateFromProfile(profileFromState(s, null), { lang: 'en' })
    expect(roadmapEntries(back).M3).toEqual(roadmapEntries(s).M3)
  })

  test('a passed course moved into the current term stays out of the timetable', () => {
    const data = makeCourses()
    let s = setStatus(addModuleToTerm(base(), data, makeHandbook(), 'M3', 'prior'), 'M3', 'passed')
    s = moveModule(s, data, 'M3', 'WS26')
    expect(s.selected).toEqual({})
    expect(roadmapEntries(s).M3).toMatchObject({ term: 'WS26', status: 'passed' })
  })

  test('moving to the same term changes nothing; an unknown module is added there', () => {
    const data = makeCourses()
    const s = addModuleToTerm(base(), data, makeHandbook(), 'H1', 'SS27')
    expect(moveModule(s, data, 'H1', 'SS27')).toBe(s)
    expect(roadmapEntries(moveModule(base(), data, 'H2', 'WS27')).H2).toMatchObject({ term: 'WS27', status: 'planned' })
  })
})
