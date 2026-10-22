import { describe, expect, test } from 'vitest'
import { defaultState } from '../src/store'
import { emptyProfile, isProfile, profileFromState, stateFromProfile, type Profile } from '../src/sync/profile'
import type { UserState } from '../src/types'

describe('profile', () => {
  test('round-trips a state through a profile', () => {
    const s: UserState = {
      version: 1, lang: 'tr', theme: 'dark', lastSeenScrapedAt: 'x', areas: ['Telematics'],
      selected: { e1: { enabledSlots: [0], moduleId: 'M1', ackFingerprint: 'f', title: 'Çizge', countAs: 'elective' } },
    }
    const p = profileFromState(s, null)
    expect(p.modules.M1).toEqual({ term: 'WS26', status: 'planned', countAs: 'elective', grade: null })
    expect(p.weekly.e1).not.toHaveProperty('countAs')
    expect(p).not.toHaveProperty('lang')
    expect(p).not.toHaveProperty('theme')
    expect(stateFromProfile(p, { lang: 'tr', theme: 'dark' })).toEqual(s)
  })

  test('roadmap entries, notes and terms come from the state; followed from the previous profile', () => {
    const prev: Profile = { ...emptyProfile(), followed: [{ role: 'ml-eng', lens: 'bigtech' }], notes: { OLD: 'stale' } }
    const s: UserState = {
      ...defaultState(), selected: {},
      roadmap: {
        terms: ['WS26', 'SS27'], notes: { M9: 'iyi hoca' },
        modules: { M9: { term: 'prior', status: 'passed', countAs: null, grade: 1.3 }, M8: { term: 'SS27', status: 'planned', countAs: null, grade: null } },
      },
    }
    const p = profileFromState(s, prev)
    expect(Object.keys(p.modules).sort()).toEqual(['M8', 'M9'])
    expect(p.notes).toEqual({ M9: 'iyi hoca' })
    expect(p.terms).toEqual(['WS26', 'SS27'])
    expect(p.followed).toHaveLength(1)
  })

  test('isProfile rejects other versions and malformed modules', () => {
    expect(isProfile(emptyProfile())).toBe(true)
    expect(isProfile({ ...emptyProfile(), version: 2 })).toBe(false)
    expect(isProfile({ ...emptyProfile(), modules: { M1: { term: 'WS26' } } })).toBe(false)
    expect(isProfile(null)).toBe(false)
  })
})
