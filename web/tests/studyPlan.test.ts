import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import { EMPTY_HANDBOOK, moduleRows } from '../src/logic/handbook'
import { AREAS as ALL_AREAS, RULES } from '../src/logic/degree'
import { environmentRole, lensWeights } from '../src/logic/career'
import { proposeStudyPlan, TERM_CAP } from '../src/logic/studyPlan'
import { offeringIssue } from '../src/logic/terms'
import type { CareerData, CoursesFile, HandbookFile, UserState } from '../src/types'
import { makeCourses, makeHandbook } from './appdata'
import { makeCareer } from './careerdata'

const state = (extra: Partial<UserState> = {}): UserState =>
  ({ version: 1, selected: {}, lang: 'en', lastSeenScrapedAt: '', ...extra })
const AREAS = ['Human-centred Machine Intelligence', 'Cryptography and Security']

describe('environment preparation', () => {
  test('uses environment priorities without selecting a job', () => {
    const lens = { ...makeCareer().lenses.lenses[0], multipliers: { algo: 1.5, swe: 1.2, research: 0.5 } }
    const profile = environmentRole(lens)
    expect(profile.id).toBe('environment')
    expect(Object.keys(profile.weights).sort()).toEqual(['algo', 'swe'])
    expect(profile.targets).toEqual({ algo: 6, swe: 6 })
    expect(lensWeights(profile, lens).algo).toBeGreaterThan(lensWeights(profile, lens).swe!)
  })
})

describe('lensWeights', () => {
  test('a skill the employer type values counts even when the role does not list it', () => {
    const career = makeCareer()
    const role = career.roles.roles.find((r) => r.id === 'ml-eng')!
    const lens = { ...career.lenses.lenses[1], multipliers: { algo: 1.5, research: 0.5 } }
    const w = lensWeights(role, lens)
    expect(w.algo).toBeGreaterThan(0)
    expect(w.research).toBeUndefined()
    expect(Object.values(w).reduce((a, b) => a + (b ?? 0), 0)).toBeCloseTo(1)
  })
})

describe('proposeStudyPlan (fixtures)', () => {
  const courses = makeCourses()
  const handbook = makeHandbook()
  const career = makeCareer()
  const rows = moduleRows(courses, handbook)
  const role = career.roles.roles.find((r) => r.id === 'security')!
  const lens = career.lenses.lenses[0]

  test('without areas it asks for them and suggests two', () => {
    const p = proposeStudyPlan({ state: state(), courses, handbook, career, role, lens, rows })
    expect(p.picks).toEqual([])
    expect(p.needsAreas).toHaveLength(2)
    expect(p.needsAreas).toContain('Cryptography and Security')
  })

  test('places modules only in terms they are offered, keeps the last term for the thesis, skips planned ones', () => {
    const s = state({ areas: AREAS, roadmap: { terms: ['WS26', 'SS27', 'WS27', 'SS28'], modules: { H1: { term: 'WS26', status: 'planned', countAs: null, grade: null } }, notes: {} } })
    const p = proposeStudyPlan({ state: s, courses, handbook, career, role, lens, rows })
    expect(p.thesisTerm).toBe('SS28')
    expect(p.picks.map((x) => x.id)).not.toContain('H1')
    const byId = new Map(rows.map((r) => [r.id, r]))
    for (const pick of p.picks) {
      expect(pick.term).not.toBe('SS28')
      expect(offeringIssue(byId.get(pick.id)!, pick.term)).toBeNull()
    }
    // H2 is a summer seminar: it goes to SS27 and fills the seminar rule.
    expect(p.picks.find((x) => x.id === 'H2')).toMatchObject({ term: 'SS27', kind: 'seminar' })
    // The tiny catalog cannot meet every rule; those are reported, not hidden.
    expect(p.missing).toContain('stamm')
    expect(p.after).toBeGreaterThanOrEqual(p.before)
  })

  test('rebuild keeps a retained course in its original valid semester', () => {
    const s = state({ areas: AREAS, roadmap: { terms: ['WS26', 'SS27', 'WS27', 'SS28'], modules: {
      M3: { term: 'WS27', status: 'planned', countAs: null, grade: null },
    }, notes: {} } })
    const p = proposeStudyPlan({ state: s, courses, handbook, career, role, lens, rows, rebuild: true })
    expect(p.picks.find((x) => x.id === 'M3')).toMatchObject({ was: 'WS27', term: 'WS27' })
  })

  test('rebuild reconsiders current timetable courses but preserves passed and explicitly kept courses', () => {
    const s = state({ areas: AREAS, selected: { sec: { enabledSlots: [0], moduleId: 'M3', ackFingerprint: '' } },
      roadmap: { terms: ['WS26', 'SS27', 'WS27', 'SS28'], modules: {
        H1: { term: 'prior', status: 'passed', countAs: null, grade: 1.7 },
      }, notes: {} } })
    const args = { state: s, courses, handbook, career, role, lens, rows, exclude: new Set(['M3']) }
    expect(proposeStudyPlan(args).dropped).toEqual([])
    const rebuilt = proposeStudyPlan({ ...args, rebuild: true })
    expect(rebuilt.dropped).toContain('M3')
    expect(rebuilt.dropped).not.toContain('H1')
    expect(rebuilt.picks.map((p) => p.id)).not.toContain('H1')
    expect(proposeStudyPlan({ ...args, rebuild: true, keep: new Set(['M3']) }).dropped).not.toContain('M3')
  })

  test('excluded modules stay out', () => {
    const p = proposeStudyPlan({ state: state({ areas: AREAS }), courses, handbook, career, role, lens, rows, exclude: new Set(['H2']) })
    expect(p.picks.map((x) => x.id)).not.toContain('H2')
  })
})

// The real catalog, handbook and career data: a complete plan must meet every rule it can.
const data = (f: string) => resolve(__dirname, '../../data', f)
const real = existsSync(data('handbook.json')) && existsSync(data('career/roles.json'))

describe.runIf(real)('proposeStudyPlan (real data)', () => {
  const read = <T,>(f: string) => JSON.parse(readFileSync(data(f), 'utf8')) as T
  const courses = read<CoursesFile>('courses.json')
  const handbook = read<HandbookFile>('handbook.json')
  const career: CareerData = { skills: read('career/skills.json'), roles: read('career/roles.json'), lenses: read('career/lenses.json') }
  const rows = moduleRows(courses, handbook ?? EMPTY_HANDBOOK)

  test.each([
    ['ml-eng', 'ailab', ['Human-centred Machine Intelligence', 'Data Science']],
    ['security', 'industry', ['Cryptography and Security', 'Telematics']],
    ['backend', 'bigtech', ['Algorithm Engineering', 'Software Engineering and Compiler Construction']],
  ])('%s at %s meets the degree rules', (roleId, lensId, areas) => {
    const role = career.roles.roles.find((r) => r.id === roleId)!
    const lens = career.lenses.lenses.find((l) => l.id === lensId)!
    const p = proposeStudyPlan({ state: state({ areas }), courses, handbook, career, role, lens, rows })
    const r = p.report
    expect(p.missing).toEqual([])
    expect(p.iqLeft).toBeGreaterThanOrEqual(RULES.iqMin)
    expect(p.iqLeft).toBeLessThanOrEqual(RULES.iqMax)
    expect(r.stamm.count).toBe(RULES.stamm)
    for (const a of r.areas) {
      expect(a.cp).toBeGreaterThanOrEqual(RULES.areaMin)
      expect(a.lectureCp).toBeGreaterThanOrEqual(a.lectureMin)
    }
    expect(r.seminarCp).toBeGreaterThanOrEqual(RULES.seminarMin)
    expect(r.practicalCp).toBeGreaterThanOrEqual(RULES.practicalMin)
    expect(r.seminarCp + r.practicalCp).toBeGreaterThanOrEqual(RULES.spMin)
    expect(r.seminarCp + r.practicalCp).toBeLessThanOrEqual(RULES.spMax)
    expect(r.electiveCp).toBeGreaterThanOrEqual(RULES.electiveMin)
    expect(r.areaTotal).toBeLessThanOrEqual(RULES.areasMax)
    expect(r.total + p.iqLeft).toBeGreaterThanOrEqual(RULES.total - RULES.thesis)
    expect(r.total).toBeLessThanOrEqual(RULES.total - RULES.thesis - RULES.iqMin)
    expect(r.issues).toEqual([])
    for (const t of p.terms) expect(t.load).toBeLessThanOrEqual(TERM_CAP)
    expect(p.after).toBeGreaterThan(p.before)
  })

  test('the employer type changes the suggestions', () => {
    const role = career.roles.roles.find((r) => r.id === 'ml-eng')!
    const ids = (lensId: string) => proposeStudyPlan({ state: state({ areas: ['Human-centred Machine Intelligence', 'Data Science'] }), courses, handbook,
      career, role, lens: career.lenses.lenses.find((l) => l.id === lensId)!, rows }).picks.map((p) => p.id)
    const bigtech = new Set(ids('bigtech'))
    expect(ids('ailab').filter((id) => !bigtech.has(id)).length).toBeGreaterThanOrEqual(2)
    expect(ids('academia').filter((id) => !bigtech.has(id)).length).toBeGreaterThanOrEqual(2)
  })

  test('every job, employer type and pair of areas meets the course rules', () => {
    const open: string[] = []
    for (const role of career.roles.roles) for (const lens of career.lenses.lenses) {
      for (let i = 0; i < ALL_AREAS.length; i++) for (let j = i + 1; j < ALL_AREAS.length; j++) {
        const p = proposeStudyPlan({ state: state({ areas: [ALL_AREAS[i], ALL_AREAS[j]] }), courses, handbook, career, role, lens, rows })
        // 'total' only means the terms are full; the page offers to add a term.
        const rules = p.missing.filter((m) => m !== 'total')
        if (rules.length || p.report.issues.length) open.push(`${role.id}/${lens.id}/${ALL_AREAS[i]}+${ALL_AREAS[j]}: ${rules} ${p.report.issues.map((x) => x.key)}`)
      }
    }
    expect(open).toEqual([])
  }, 60_000)

  test('rebuilding a plan made for one job for another changes it; kept and passed courses stay', () => {
    const areas = ['Human-centred Machine Intelligence', 'Data Science']
    const ml = proposeStudyPlan({ state: state({ areas }), courses, handbook, career, rows,
      role: career.roles.roles.find((r) => r.id === 'ml-eng')!, lens: career.lenses.lenses.find((l) => l.id === 'ailab')! })
    const modules = Object.fromEntries(ml.picks.map((p) => [p.id, { term: p.term, status: 'planned' as const, countAs: null, grade: null }]))
    const future = ml.picks.filter((p) => p.term !== 'WS26').map((p) => p.id)
    modules[future[0]] = { ...modules[future[0]], status: 'passed' as never }
    const s = state({ areas, roadmap: { terms: ['WS26', 'SS27', 'WS27', 'SS28'], modules, notes: {} } })
    const args = { state: s, courses, handbook, career, rows, role: career.roles.roles.find((r) => r.id === 'backend')!,
      lens: career.lenses.lenses.find((l) => l.id === 'bigtech')! }
    expect(proposeStudyPlan(args).picks).toEqual([]) // fill mode: the plan is full
    const re = proposeStudyPlan({ ...args, rebuild: true })
    expect(re.dropped.length).toBeGreaterThan(0)
    expect(re.picks.filter((p) => !p.was).length).toBeGreaterThan(0)
    expect(re.dropped).not.toContain(future[0]) // passed
    expect(re.picks.map((p) => p.id)).not.toContain(future[0])
    expect(re.missing).toEqual([])
    expect(re.after).toBeGreaterThan(re.before)
    const kept = re.dropped[0]
    const withKeep = proposeStudyPlan({ ...args, rebuild: true, keep: new Set([kept]) })
    expect(withKeep.dropped).not.toContain(kept)
  })
})
