import { describe, expect, test } from 'vitest'
import { planFigures, prereqIssues, prereqLinks, scenarioState, suggestModules } from '../src/logic/advisor'
import { moduleRows, type ModuleRow } from '../src/logic/handbook'
import { defaultState, placeModule, saveScenario, setStatus } from '../src/store'
import { makeCourses, makeHandbook } from './appdata'
import { makeCareer } from './careerdata'

const row = (id: string, title: string, prerequisites: string | null = null): ModuleRow => ({
  id, title, ects: 6, recurrence: 'each', fields: ['Elective Studies in Informatics'], current: null, eventIds: [],
  hb: { id, title, ects: 6, recurrence: 'each', language: null, level: null, fields: [], coordinators: [], bricks: [], competenceGoals: null, content: null, prerequisites, recommendations: null },
})

describe('prerequisites', () => {
  const rows = [
    row('A', 'Robotics I - Introduction to Robotics'),
    row('B', 'Humanoid Robots - Locomotion', 'Knowledge of Robotics I - Introduction to Robotics is recommended.'),
    row('C', 'Robotics III - Sensors and Perception in Robotics'),
    row('D', 'Seminar: Perception', 'The module Robotics III - Sensors and Perception in Robotics must not have been started.'),
  ]
  test('titles in prerequisite texts become links; "must not" makes an exclusion', () => {
    const l = prereqLinks(rows)
    expect(l.get('B')).toEqual({ before: ['A'], excludes: [] })
    expect(l.get('D')).toEqual({ before: [], excludes: ['C'] })
    expect(l.has('A')).toBe(false)
  })
  test('order, missing and excluded modules in the plan', () => {
    const l = prereqLinks(rows)
    let s = placeModule(placeModule(defaultState(), 'B', 'SS27'), 'A', 'WS27')
    s = placeModule(placeModule(s, 'D', 'SS27'), 'C', 'WS26')
    expect(prereqIssues(s, l)).toEqual([{ id: 'B', other: 'A', kind: 'order' }, { id: 'D', other: 'C', kind: 'excluded' }])
    s = placeModule(s, 'A', 'prior')
    expect(prereqIssues(s, l).find((x) => x.id === 'B')).toBeUndefined()
    expect(prereqIssues(placeModule(defaultState(), 'B', 'SS27'), l)).toEqual([{ id: 'B', other: 'A', kind: 'missing' }])
  })
})

describe('suggestions and scenarios', () => {
  test('suggests what the degree lacks, offered in the term, not yet planned', () => {
    const data = makeCourses()
    const rows = moduleRows(data, makeHandbook())
    const s = { ...defaultState(), areas: ['Human-centred Machine Intelligence', 'Cryptography and Security'] }
    const sug = suggestModules({ state: s, courses: data, handbook: makeHandbook(), career: makeCareer(), rows, term: 'SS27' })
    expect(sug.map((x) => x.row.id)).toContain('H2') // summer seminar in area 2
    expect(sug.find((x) => x.row.id === 'H2')!.reasons).toContain('seminar')
    expect(sug.some((x) => x.row.id === 'H1')).toBe(false) // winter only
    const planned = placeModule(s, 'H2', 'SS27')
    expect(suggestModules({ state: planned, courses: data, handbook: makeHandbook(), career: null, rows, term: 'SS27' }).some((x) => x.row.id === 'H2')).toBe(false)
  })

  test('a scenario is measured like the current plan', () => {
    const data = makeCourses()
    const rows = moduleRows(data, makeHandbook())
    let s = setStatus(placeModule(defaultState(), 'H1', 'prior'), 'H1', 'passed')
    s = saveScenario(s, 'A')
    s = placeModule(s, 'H2', 'SS27')
    const now = planFigures(s, data, makeHandbook(), null, rows)
    const then = planFigures(scenarioState(s, s.scenarios![0]), data, makeHandbook(), null, rows)
    expect(now.ects).toBe(then.ects + 3)
    expect(then.fit).toBeNull()
  })
})
