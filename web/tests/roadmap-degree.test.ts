import { describe, expect, test } from 'vitest'
import { roadmapReport } from '../src/logic/degree'
import { defaultState, placeModule, setGrade, setStatus } from '../src/store'
import type { UserState } from '../src/types'
import { makeCourses, makeHandbook } from './appdata'

const AREAS = ['Human-centred Machine Intelligence', 'Cryptography and Security']
const base = (): UserState => ({ ...defaultState(), areas: AREAS })
const report = (s: UserState) => roadmapReport(s, makeCourses(), makeHandbook())

describe('roadmapReport', () => {
  test('counts passed and planned separately', () => {
    const s = placeModule(placeModule(base(), 'H1', 'prior'), 'H2', 'SS27')
    const r = report(s)
    expect(r.done.total).toBe(6)
    expect(r.all.total).toBe(9)
    expect(r.all.seminarCp).toBe(3)
    expect(r.done.areas[0]).toMatchObject({ area: AREAS[0], cp: 6, lectureCp: 6 })
    expect(r.all.areas[1]).toMatchObject({ area: AREAS[1], cp: 3, lectureCp: 0 })
  })

  test('failed and dropped do not count', () => {
    const s = setStatus(placeModule(setStatus(placeModule(base(), 'H1', 'prior'), 'H1', 'failed'), 'H2', 'SS27'), 'H2', 'dropped')
    expect(report(s).all.total).toBe(0)
  })

  test('gpa is credit-weighted over graded passed modules', () => {
    let s = setGrade(placeModule(base(), 'H1', 'prior'), 'H1', 1.0)
    s = setGrade(placeModule(s, 'M3', 'prior'), 'M3', 2.0)
    s = placeModule(s, 'H2', 'prior')
    const r = report(s)
    expect(r.gpa).toBe(1.5) // KIT keeps only the first decimal, without rounding
    expect(r.gradedCp).toBe(14)
    expect(report(base()).gpa).toBeNull()
  })

  test('unknown modules are listed, not counted', () => {
    const r = report(placeModule(placeModule(base(), 'GONE', 'SS27'), 'H1', 'SS27'))
    expect(r.unknown).toEqual(['GONE'])
    expect(r.all.total).toBe(6)
  })

  test('the weekly plan counts as planned', () => {
    const s: UserState = { ...base(), selected: { sec: { enabledSlots: [0], moduleId: 'M3', ackFingerprint: '' } } }
    expect(report(s).all.total).toBe(8)
    expect(report(s).done.total).toBe(0)
  })

  test('gpa truncation is safe against floating point noise', () => {
    let s = setGrade(placeModule(base(), 'H1', 'prior'), 'H1', 1.3)
    s = setGrade(placeModule(s, 'H2', 'prior'), 'H2', 1.3)
    expect(report(s).gpa).toBe(1.3)
  })
})
