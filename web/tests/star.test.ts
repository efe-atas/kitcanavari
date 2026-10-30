import { describe, expect, test } from 'vitest'
import { roadmapEntries } from '../src/logic/roadmap'
import {
  addModuleToTerm, defaultState, importState, moveModule, removeFromRoadmap, restoreModule, setNote, setStar, snapshotModule, toggleSlot,
} from '../src/store'
import { isProfile, profileFromState, stateFromProfile } from '../src/sync/profile'
import { makeCourses, makeHandbook } from './appdata'

describe('shortlist', () => {
  test('starring takes the wanted end state', () => {
    let s = setStar(defaultState(), 'H1', true)
    expect(s.starred).toEqual(['H1'])
    expect(setStar(s, 'H1', true)).toBe(s)
    s = setStar(setStar(s, 'H2', true), 'H1', false)
    expect(s.starred).toEqual(['H2'])
  })

  test('the shortlist is saved, synced and read back; old profiles without it stay valid', () => {
    const s = setStar(defaultState(), 'H1', true)
    expect(importState(JSON.stringify(s))?.starred).toEqual(['H1'])
    expect(importState(JSON.stringify({ ...s, starred: [1] }))).toBeNull()
    const p = profileFromState(s, null)
    expect(p.starred).toEqual(['H1'])
    expect(stateFromProfile(p, { lang: 'en' }).starred).toEqual(['H1'])
    const { starred: _gone, ...old } = p
    expect(isProfile(old)).toBe(true)
    expect(stateFromProfile(old, { lang: 'en' }).starred).toBeUndefined()
    // A device that never starred keeps what another device starred.
    expect(profileFromState(defaultState(), p).starred).toEqual(['H1'])
  })
})

describe('undo by snapshot', () => {
  test('removing and restoring brings back the entry, the weekly courses with their slots, and the note', () => {
    const data = makeCourses()
    let s = addModuleToTerm(defaultState(), data, makeHandbook(), 'M3', 'WS26')
    s = setNote(toggleSlot(s, 'sec', 0), 'M3', 'zor ama iyi')
    const snap = snapshotModule(s, 'M3')
    const removed = removeFromRoadmap(s, 'M3')
    expect(roadmapEntries(removed).M3).toBeUndefined()
    const back = restoreModule(removed, 'M3', snap)
    expect(back.selected).toEqual(s.selected)
    expect(back.roadmap?.notes.M3).toBe('zor ama iyi')
    expect(roadmapEntries(back).M3).toEqual(roadmapEntries(s).M3)
  })

  test('undoing a move or an add', () => {
    const data = makeCourses()
    const s = addModuleToTerm(defaultState(), data, makeHandbook(), 'H1', 'SS27')
    const moved = moveModule(s, data, 'H1', 'WS27')
    expect(roadmapEntries(restoreModule(moved, 'H1', snapshotModule(s, 'H1'))).H1.term).toBe('SS27')
    const empty = snapshotModule(defaultState(), 'H1')
    expect(roadmapEntries(restoreModule(s, 'H1', empty)).H1).toBeUndefined()
  })
})
