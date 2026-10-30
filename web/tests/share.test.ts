import { describe, expect, test } from 'vitest'
import { roadmapEntries } from '../src/logic/roadmap'
import { decodePlan, encodePlan, planState } from '../src/logic/share'
import { addModuleToTerm, adoptPlan, defaultState, placeModule, setEntryCountAs, setGrade, setNote, setStar } from '../src/store'
import { parseHash } from '../src/ui/route'
import { makeCourses, makeHandbook } from './appdata'

const AREAS = ['Human-centred Machine Intelligence', 'Cryptography and Security']

function sample() {
  const data = makeCourses()
  let s = { ...defaultState(), areas: AREAS }
  s = addModuleToTerm(s, data, makeHandbook(), 'M3', 'WS26')
  s = setGrade(placeModule(s, 'H1', 'prior'), 'H1', 1.3)
  s = setEntryCountAs(placeModule(s, 'H2', 'SS27'), 'H2', 'elective')
  s = placeModule(s, 'M-INFO-107201', 'WS27')
  return setNote(s, 'H1', 'private note')
}

describe('shared plans', () => {
  test('a plan round-trips through its code, grades only when asked', () => {
    const s = sample()
    const code = encodePlan(s, true)
    expect(code).toMatch(/^[A-Za-z0-9~.,-]+$/)
    expect(code).toContain('i107201,2,p')
    const plan = decodePlan(code)!
    expect(plan.areas).toEqual(AREAS)
    expect(plan.terms).toEqual(['WS26', 'SS27', 'WS27', 'SS28'])
    expect(plan.modules).toEqual(roadmapEntries(s))
    const noGrades = decodePlan(encodePlan(s, false))!
    expect(noGrades.modules.H1.grade).toBeNull()
    expect(JSON.stringify(plan)).not.toContain('private note')
  })

  test('broken or foreign codes are refused', () => {
    expect(decodePlan('')).toBeNull()
    expect(decodePlan('2~0~WS26~')).toBeNull()
    expect(decodePlan('1~99~WS26~')).toBeNull()
    expect(decodePlan('1~0~WS26~i1,0,z')).toBeNull()
    expect(decodePlan('1~0~WS26~i1,0,s,55')).toBeNull()
    expect(decodePlan('1~~~')).toEqual({ areas: [], terms: [], modules: {} })
  })

  test('the route opens a shared plan', () => {
    expect(parseHash('#/shared/1~0~WS26~').route.page).toEqual({ kind: 'shared', code: '1~0~WS26~' })
  })

  test('adopting a shared plan replaces the plan and keeps notes, shortlist and device settings', () => {
    const data = makeCourses()
    const mine = setStar(setNote({ ...defaultState(), lang: 'en' as const, theme: 'dark' as const }, 'X', 'mine'), 'H2', true)
    const plan = decodePlan(encodePlan(sample(), true))!
    const next = adoptPlan(mine, data, plan)
    expect(next.areas).toEqual(AREAS)
    expect(roadmapEntries(next)).toEqual(plan.modules)
    expect(Object.keys(next.selected).sort()).toEqual(['ml', 'sec'])
    expect(next.roadmap!.notes.X).toBe('mine')
    expect(next.starred).toEqual(['H2'])
    expect([next.lang, next.theme]).toEqual(['en', 'dark'])
    expect(planState(plan, { lang: 'en' }).roadmap!.modules).toEqual(plan.modules)
  })
})
