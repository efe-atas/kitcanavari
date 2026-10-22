import { describe, expect, test } from 'vitest'
import { matrixCells, rowBucket, rowsFor } from '../src/logic/matrix'
import { nextSteps } from '../src/logic/nextSteps'
import { addModuleToTerm, defaultState, placeModule, setGrade, setStatus } from '../src/store'
import type { UserState } from '../src/types'
import { makeCourses, makeHandbook } from './appdata'

const AREAS = ['Human-centred Machine Intelligence', 'Cryptography and Security']
const base = (): UserState => ({ ...defaultState(), areas: AREAS })

describe('matrix', () => {
  test('rows follow the chosen areas; minor and other only when used', () => {
    expect(rowsFor(defaultState(), [])).toEqual(['area0', 'area1', 'elective', 'iq'])
    expect(rowsFor(base(), ['minor', 'other'])).toEqual(['area0', 'area1', 'elective', 'minor', 'iq', 'other'])
    expect(rowBucket(base(), 'area1')).toBe('Cryptography and Security')
    expect(rowBucket(base(), 'other')).toBeNull()
  })

  test('places entries by where they count and by term', () => {
    let s = placeModule(placeModule(base(), 'H1', 'prior'), 'H2', 'SS27')
    s = setGrade(s, 'H1', 1.7)
    s = { ...s, selected: { sec: { enabledSlots: [0], moduleId: 'M3', ackFingerprint: '' } } }
    const m = matrixCells(s, makeCourses(), makeHandbook())
    expect(m.columns.slice(0, 3)).toEqual(['prior', 'WS26', 'SS27'])
    expect(m.cells.area0.prior.map((c) => c.id)).toEqual(['H1'])
    expect(m.cells.area0.prior[0]).toMatchObject({ status: 'passed', grade: 1.7, ects: 6 })
    expect(m.cells.area1.SS27.map((c) => c.id)).toEqual(['H2'])
    expect(m.cells.area1.WS26[0]).toMatchObject({ id: 'M3', inSchedule: true, kind: 'seminar' })
    expect(m.rowTotals.area1).toMatchObject({ cp: 11, done: 0, min: 15 })
    expect(m.rowTotals.area0).toMatchObject({ cp: 6, done: 6, lectureCp: 6, lectureMin: 10 })
    expect(m.colTotals).toMatchObject({ prior: 6, WS26: 8, SS27: 3 })
  })

  test('failed and dropped are shown but not counted; unknown ids go to other', () => {
    let s = setStatus(placeModule(base(), 'H1', 'SS27'), 'H1', 'failed')
    s = placeModule(s, 'GONE', 'WS27')
    const m = matrixCells(s, makeCourses(), makeHandbook())
    expect(m.cells.area0.SS27[0].status).toBe('failed')
    expect(m.rowTotals.area0.cp).toBe(0)
    expect(m.cells.other.WS27[0]).toMatchObject({ id: 'GONE', title: null })
    expect(rowsFor(s, Object.keys(m.cells).filter((r) => Object.values(m.cells[r]).some((x) => x.length)))).toContain('other')
  })

  test('a season warning is attached to the item', () => {
    const m = matrixCells(placeModule(base(), 'H2', 'WS27'), makeCourses(), makeHandbook())
    expect(m.cells.area1.WS27[0].issue).toBe('wrongSeason')
  })
})

describe('nextSteps', () => {
  test('asks for areas first', () => {
    expect(nextSteps(defaultState(), makeCourses(), makeHandbook())[0]).toMatchObject({ key: 'step.areas', action: { focus: 'areas' } })
  })

  test('lists missing requirements in order with add actions', () => {
    const steps = nextSteps(placeModule(base(), 'H1', 'prior'), makeCourses(), makeHandbook())
    expect(steps.map((s) => s.key)).toEqual(['step.areaCp', 'step.areaLecture', 'step.areaCp', 'step.areaLecture', 'step.stamm', 'step.seminar', 'step.practical', 'step.elective'])
    expect(steps[0]).toMatchObject({ params: { area: AREAS[0], n: 9 }, action: { term: 'SS27', row: 'area0' } })
    expect(steps.find((s) => s.key === 'step.seminar')!.action).toMatchObject({ kind: 'seminar' })
  })

  test('says nothing is missing when every rule is met', () => {
    expect(nextSteps(base(), makeCourses(), makeHandbook()).some((s) => s.key === 'step.done')).toBe(false)
  })
})

describe('addModuleToTerm', () => {
  test('current term also adds the module\'s courses to the weekly plan', () => {
    const s = addModuleToTerm(base(), makeCourses(), makeHandbook(), 'M3', 'WS26', 'area1')
    expect(Object.keys(s.selected).sort()).toEqual(['ml', 'sec'])
    expect(s.roadmap?.modules.M3).toBeUndefined() // the weekly plan carries it
  })

  test('another term only places it, and a chosen row becomes countAs', () => {
    const s = addModuleToTerm(base(), makeCourses(), makeHandbook(), 'H2', 'SS27', 'elective')
    expect(s.selected).toEqual({})
    expect(s.roadmap!.modules.H2).toMatchObject({ term: 'SS27', status: 'planned', countAs: 'elective' })
    expect(addModuleToTerm(base(), makeCourses(), makeHandbook(), 'H2', 'SS27', 'area1').roadmap!.modules.H2.countAs).toBeNull()
  })
})
