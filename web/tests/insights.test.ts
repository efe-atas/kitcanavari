import { describe, expect, test } from 'vitest'
import { forecast, gradeOutlook, neededAverage } from '../src/logic/insights'
import { defaultState, placeModule, setGrade } from '../src/store'
import type { HandbookFile, HandbookModule } from '../src/types'
import { makeCourses } from './appdata'

const hb = (n: number, ects = 30): HandbookFile => ({
  meta: { source: '', asOf: '', parsedAt: '' },
  modules: Object.fromEntries(Array.from({ length: n }, (_, i) => [`B${i}`, {
    id: `B${i}`, title: `Block ${i}`, ects, recurrence: 'each', language: null, level: null, fields: ['Elective Studies in Informatics'],
    coordinators: [], bricks: [], competenceGoals: null, content: null, prerequisites: null, recommendations: null,
  } satisfies HandbookModule])),
})

describe('forecast', () => {
  test('the term the plan reaches 90 module credits, and the thesis term after it', () => {
    let s = placeModule(placeModule(placeModule(defaultState(), 'B0', 'WS26'), 'B1', 'SS27'), 'B2', 'WS27')
    const f = forecast(s, makeCourses(), hb(3))
    expect(f).toMatchObject({ moduleCp: 90, doneTerm: 'WS27', thesisTerm: 'SS28', assumed: false })
    expect(f.terms.map((t) => [t.term, t.cp])).toEqual([['prior', 0], ['WS26', 30], ['SS27', 30], ['WS27', 30], ['SS28', 0]])
    s = placeModule(s, 'B2', 'prior')
    expect(forecast(s, makeCourses(), hb(3))).toMatchObject({ doneTerm: 'SS27', thesisTerm: 'WS27' })
  })

  test('a plan short of 90 assumes full terms after its last planned term', () => {
    const s = placeModule(defaultState(), 'B0', 'SS27')
    expect(forecast(s, makeCourses(), hb(1))).toMatchObject({ moduleCp: 30, doneTerm: 'SS28', thesisTerm: 'WS28', assumed: true, extraTerms: 2 })
    expect(forecast(defaultState(), makeCourses(), hb(0))).toMatchObject({ doneTerm: 'SS28', assumed: true, extraTerms: 3 })
  })
})

describe('grade outlook', () => {
  test('average of graded modules and the average the rest needs for a target', () => {
    let s = setGrade(placeModule(defaultState(), 'B0', 'prior'), 'B0', 1.3)
    s = placeModule(s, 'B1', 'SS27')
    const o = gradeOutlook(s, makeCourses(), hb(2))
    expect(o).toMatchObject({ gradedCp: 30, remainingCp: 30 })
    expect(o.average).toBeCloseTo(1.3)
    expect(neededAverage(o, 1.5)).toEqual({ kind: 'need', grade: 1.7 })
    expect(neededAverage(o, 1.0)).toEqual({ kind: 'out-of-reach' })
    expect(neededAverage(o, 3.0)).toEqual({ kind: 'safe' })
    expect(neededAverage({ ...o, remainingCp: 0 }, 2)).toEqual({ kind: 'nothing-left' })
  })
})
