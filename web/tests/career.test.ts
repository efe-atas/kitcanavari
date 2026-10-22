import { describe, expect, test } from 'vitest'
import { fit, gaps, skillPoints, topRoles } from '../src/logic/career'
import { moduleRows } from '../src/logic/handbook'
import { roadmapEntries } from '../src/logic/roadmap'
import { defaultState, placeModule, toggleFollow } from '../src/store'
import { profileFromState, stateFromProfile } from '../src/sync/profile'
import type { RoadmapEntry } from '../src/types'
import { makeCourses, makeHandbook } from './appdata'
import { makeCareer } from './careerdata'

const career = makeCareer()
const hb = makeHandbook()
const rows = moduleRows(makeCourses(), hb)
const ects = (id: string) => rows.find((r) => r.id === id)?.ects ?? null
const role = (id: string) => career.roles.roles.find((r) => r.id === id)!
const lens = (id: string) => career.lenses.lenses.find((l) => l.id === id)!
const planned = (term = 'SS27'): RoadmapEntry => ({ term, status: 'planned', countAs: null, grade: null })

describe('career', () => {
  test('an empty plan fits nothing', () => {
    const p = skillPoints({}, career, ects, ['passed', 'planned'])
    expect(fit(p, role('ml-eng'), lens('bigtech'))).toBe(0)
  })

  test('skill points scale with credits', () => {
    const p = skillPoints({ H1: planned() }, career, ects, ['passed', 'planned'])
    expect(p.dl).toBe(3)
    expect(p.mltheory).toBe(3)
    expect(skillPoints({ H1: planned() }, career, ects, ['passed']).dl).toBe(0)
  })

  test('fit uses role targets and lens multipliers', () => {
    const p = skillPoints({ H1: planned() }, career, ects, ['passed', 'planned'])
    // ml-eng: dl .5 (3/6), mltheory .3 (3/6), swe .2 (0) → 40 %
    expect(fit(p, role('ml-eng'), lens('startup'))).toBe(40)
    // bigtech doubles swe: weights .5/.3/.4 → normalised → (0.5*.5 + .3*.5)/1.2 = 33 %
    expect(fit(p, role('ml-eng'), lens('bigtech'))).toBe(33)
  })

  test('unscored modules count as zero', () => {
    const p = skillPoints({ M1: planned() }, career, () => 6, ['passed', 'planned'])
    expect(Object.values(p).every((v) => v === 0)).toBe(true)
  })

  test('gaps rank the biggest weighted gap first and suggest modules outside the roadmap', () => {
    const p = skillPoints({}, career, ects, ['passed', 'planned'])
    const g = gaps(p, role('security'), lens('startup'), rows, {}, career, ['SS27', 'WS27'])
    expect(g[0].skill).toBe('security')
    expect(g[0].modules.map((m) => m.id)).toEqual(['M3'])
    expect(g[1].skill).toBe('crypto')
    expect(g[1].modules[0]).toMatchObject({ id: 'H2', score: 3, term: 'SS27' })
    const taken = gaps(p, role('security'), lens('startup'), rows, { H2: planned() }, career, ['SS27', 'WS27'])
    expect(taken[1].modules.map((m) => m.id)).not.toContain('H2')
  })

  test('modules that are never offered in the remaining terms are not suggested', () => {
    const p = skillPoints({}, career, ects, ['passed', 'planned'])
    const g = gaps(p, role('security'), lens('startup'), rows, {}, career, ['WS27'])
    expect(g.find((x) => x.skill === 'crypto')!.modules.map((m) => m.id)).not.toContain('H2')
  })

  test('top roles of a module', () => {
    expect(topRoles('H1', career)[0].role).toBe('ml-eng')
    expect(topRoles('NOPE', career)).toEqual([])
  })
})

describe('followed paths', () => {
  test('toggle adds, removes and caps at three', () => {
    let s = toggleFollow(defaultState(), 'ml-eng', 'bigtech')
    expect(s.followed).toEqual([{ role: 'ml-eng', lens: 'bigtech' }])
    s = toggleFollow(toggleFollow(toggleFollow(s, 'quant', 'quant'), 'security', 'industry'), 'robotics', 'industry')
    expect(s.followed).toHaveLength(3)
    expect(toggleFollow(s, 'ml-eng', 'bigtech').followed).toHaveLength(2)
  })

  test('followed survives the profile round trip', () => {
    const s = toggleFollow(placeModule(defaultState(), 'H1', 'SS27'), 'ml-eng', 'bigtech')
    const back = stateFromProfile(profileFromState(s, null), { lang: 'en' })
    expect(back.followed).toEqual([{ role: 'ml-eng', lens: 'bigtech' }])
    expect(roadmapEntries(back).H1.term).toBe('SS27')
  })
})
