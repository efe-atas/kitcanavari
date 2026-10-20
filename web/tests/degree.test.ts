import { describe, expect, test } from 'vitest'
import { areaSuggestions, bucketOf, bucketOptions, degreeReport, moduleAreas, moduleKind } from '../src/logic/degree'
import { defaultState } from '../src/store'
import type { CoursesFile, Module, UserState } from '../src/types'
import { entry, ev, mod } from './fixtures'

const AREA = 'Area of Specialization: '
const m = (id: string, ects: number, title: string, fields: string[]): Module =>
  ({ ...mod(id, ects), title, fields })

const data: CoursesFile = {
  meta: { scrapedAt: '', term: '', termGuid: '', spo: '', warnings: [] },
  tree: [
    { id: 'T', title: '1.4 Advanced Mandatory Modules', children: [], eventIds: ['algo'] },
    { id: 'P', title: '1.7 Practical Courses', children: [], eventIds: ['beat', 'fine'] },
  ],
  events: {
    algo: ev('algo', [], { moduleIds: ['ALGO'] }),
    itsec: ev('itsec', [], { moduleIds: ['ITSEC'] }),
    crypto: ev('crypto', [], { moduleIds: ['CRYPTO'] }),
    sem: ev('sem', [], { moduleIds: ['SEM'] }),
    prak: ev('prak', [], { moduleIds: ['PRAK'] }),
    beat: ev('beat', [], { moduleIds: ['BEAT'] }),
    fine: ev('fine', [], { moduleIds: ['FINE', 'FINEP'] }),
    law: ev('law', [], { moduleIds: ['LAW'] }),
  },
  modules: {
    ALGO: m('ALGO', 6, 'Algorithms II', [`${AREA}Algorithm Engineering`, 'Elective Studies in Informatics']),
    ITSEC: m('ITSEC', 6, 'IT Security', [`${AREA}Cryptography and Security`, 'Elective Studies in Informatics']),
    CRYPTO: m('CRYPTO', 5, 'Scientific Methods', [`${AREA}Cryptography and Security`, 'Elective Studies in Informatics']),
    SEM: m('SEM', 4, 'Seminar: Privacy and Security', [`${AREA}Cryptography and Security`, 'Elective Studies in Informatics']),
    PRAK: m('PRAK', 4, 'Practical Course: Building PETs', [`${AREA}Cryptography and Security`, 'Elective Studies in Informatics']),
    BEAT: m('BEAT', 6, 'Beating the Worst-Case', [`${AREA}Algorithm Engineering`, 'Elective Studies in Informatics']),
    FINE: m('FINE', 6, 'Fine-Grained Complexity Theory', [`${AREA}Algorithm Engineering`]),
    FINEP: m('FINEP', 6, 'Practical Course: Fine-grained', [`${AREA}Algorithm Engineering`]),
    LAW: m('LAW', 3, 'EU Law', ['Minor Studies: Law']),
  },
}

const withSel = (ids: Record<string, string>, extra: Partial<UserState> = {}): UserState =>
  ({ ...defaultState(), ...extra, selected: Object.fromEntries(Object.entries(ids).map(([e, mid]) => [e, entry(mid)])) })

describe('module classification', () => {
  test('areas come from "Area of Specialization" fields', () => {
    expect(moduleAreas(data.modules.ITSEC)).toEqual(['Cryptography and Security'])
    expect(moduleAreas(data.modules.LAW)).toEqual([])
  })
  test('kind from handbook Stammmodul titles, module titles and the catalog tree', () => {
    expect(moduleKind(data, data.modules.ALGO)).toBe('stamm')
    expect(moduleKind(data, data.modules.ITSEC)).toBe('stamm')
    expect(moduleKind(data, data.modules.SEM)).toBe('seminar')
    expect(moduleKind(data, data.modules.PRAK)).toBe('practical')
    expect(moduleKind(data, data.modules.BEAT)).toBe('practical') // sole module of a 1.7 event
    expect(moduleKind(data, data.modules.FINE)).toBe('lecture') // shares its 1.7 event with a practical
    expect(moduleKind(data, data.modules.CRYPTO)).toBe('lecture')
  })
})

describe('buckets', () => {
  test('options list chosen-or-any areas, then elective, minor', () => {
    expect(bucketOptions(data.modules.ITSEC)).toEqual(['Cryptography and Security', 'elective'])
    expect(bucketOptions(data.modules.FINE)).toEqual(['Algorithm Engineering', 'elective'])
    expect(bucketOptions(data.modules.LAW)).toEqual(['minor'])
  })
  test('default is a chosen area, else elective; explicit countAs wins', () => {
    const none = withSel({ itsec: 'ITSEC' })
    expect(bucketOf(none, data, 'itsec')).toBe('elective')
    const chosen = withSel({ itsec: 'ITSEC' }, { areas: ['Cryptography and Security'] })
    expect(bucketOf(chosen, data, 'itsec')).toBe('Cryptography and Security')
    chosen.selected.itsec.countAs = 'elective'
    expect(bucketOf(chosen, data, 'itsec')).toBe('elective')
  })
})

describe('degreeReport', () => {
  test('lecture minimum excludes Stammmodule, seminars and practicals', () => {
    const s = withSel({ itsec: 'ITSEC', crypto: 'CRYPTO', sem: 'SEM', prak: 'PRAK' }, { areas: ['Cryptography and Security'] })
    const r = degreeReport(s, data)
    expect(r.areas[0]).toMatchObject({ area: 'Cryptography and Security', cp: 19, lectureCp: 5, lectureMin: 10 })
    expect(r.stamm.count).toBe(1)
    expect(r.seminarCp).toBe(4)
    expect(r.practicalCp).toBe(4)
    expect(r.total).toBe(19)
  })
  test('Telematics needs only 8 lecture CP', () => {
    const r = degreeReport(withSel({}, { areas: ['Telematics'] }), data)
    expect(r.areas[0].lectureMin).toBe(8)
  })
  test('counts each module once and routes to elective and minor', () => {
    const s = withSel({ itsec: 'ITSEC', law: 'LAW', crypto: 'CRYPTO' })
    s.selected.crypto = { ...s.selected.crypto, moduleId: 'ITSEC' }
    const r = degreeReport(s, data)
    expect(r.electiveCp).toBe(6)
    expect(r.minorCp).toBe(3)
    expect(r.total).toBe(9)
  })
  test('flags too many seminar/practical credits', () => {
    const big: CoursesFile = {
      ...data,
      modules: { ...data.modules, SEM: { ...data.modules.SEM, ects: 10 }, PRAK: { ...data.modules.PRAK, ects: 10 } },
    }
    const r = degreeReport(withSel({ sem: 'SEM', prak: 'PRAK' }), big)
    expect(r.issues.map((i) => i.key)).toContain('deg.spOver')
  })
})

test('suggestions rank areas by credits the selection could bring', () => {
  const s = withSel({ itsec: 'ITSEC', crypto: 'CRYPTO', algo: 'ALGO' })
  expect(areaSuggestions(s, data).slice(0, 2)).toEqual([
    { area: 'Cryptography and Security', cp: 11 },
    { area: 'Algorithm Engineering', cp: 6 },
  ])
})

test('Stammmodule of the 09/09/2026 handbook are recognised by id even under another title', () => {
  const m: Module = { ...mod('M-INFO-107676', 6), title: 'Multimodal AI (renamed)' }
  expect(moduleKind(data, m)).toBe('stamm')
  expect(moduleKind(data, { ...mod('X', 6), title: 'Advanced Artificial Intelligence' })).toBe('lecture')
})

test('courses from two different minors are flagged; only one minor counts', () => {
  const two: CoursesFile = {
    ...data,
    events: { ...data.events, math: ev('math', [], { moduleIds: ['MATH'] }) },
    modules: { ...data.modules, MATH: m('MATH', 9, 'Graph Theory', ['Minor Studies: Mathematics']) },
  }
  const r = degreeReport(withSel({ law: 'LAW', math: 'MATH' }), two)
  expect(r.minorCp).toBe(12)
  expect(r.issues).toContainEqual({ key: 'deg.twoMinors', params: { minors: 'Law, Mathematics' } })
})
