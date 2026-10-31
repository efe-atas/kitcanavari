import { describe, expect, test } from 'vitest'
import { courseworkLines, expertsFor, fitByTerm, isStale, matchJobAd, pathRole, rankEnvironments, skillProfile } from '../src/logic/careerPlus'
import { EMPTY_HANDBOOK, moduleRows } from '../src/logic/handbook'
import { defaultState, placeModule, setGrade, setStatus } from '../src/store'
import { pointsOf } from '../src/ui/career/model'
import { makeCourses, makeHandbook } from './appdata'
import { makeCareer } from './careerdata'

const career = makeCareer()
const rows = moduleRows(makeCourses(), makeHandbook() ?? EMPTY_HANDBOOK)
const lens = (id: string) => career.lenses.lenses.find((l) => l.id === id)!

function plan() {
  let s = placeModule(defaultState(), 'H1', 'prior')
  s = setGrade(s, 'H1', 1.3)
  s = placeModule(s, 'H2', 'SS27')
  return placeModule(s, 'M3', 'WS27')
}

describe('career paths', () => {
  test('a chosen role is used; without one the environment decides', () => {
    expect(pathRole(career, 'security', lens('bigtech')).id).toBe('security')
    expect(pathRole(career, null, lens('bigtech')).id).toBe('environment')
    expect(pathRole(career, 'nope', lens('bigtech')).id).toBe('environment')
  })

  test('environments are ranked by fit with the same role', () => {
    const p = pointsOf(plan(), career, rows).all
    const ranked = rankEnvironments(p, career, 'security')
    expect(ranked).toHaveLength(6)
    expect(ranked[0].fit).toBeGreaterThanOrEqual(ranked[5].fit)
    expect(ranked.every((x) => x.fit >= 0 && x.fit <= 100)).toBe(true)
  })

  test('fit grows term by term', () => {
    const role = pathRole(career, 'security', lens('bigtech'))
    const f = fitByTerm(plan(), career, rows, role, lens('bigtech'))
    expect(f.map((x) => x.term)).toEqual(['prior', 'WS26', 'SS27', 'WS27', 'SS28'])
    expect(f[0].fit).toBe(0) // RL does not serve security
    expect(f[2].fit).toBeGreaterThan(f[1].fit) // post-quantum seminar in SS27
    expect(f[3].fit).toBeGreaterThan(f[2].fit)
    expect(f[4].fit).toBe(f[3].fit)
  })

  test('the skill profile lists the path skills with their targets', () => {
    const s = setStatus(plan(), 'H2', 'passed')
    const prof = skillProfile(pointsOf(s, career, rows), pathRole(career, 'security', lens('quant')), lens('quant'))
    expect(prof.map((x) => x.skill)).toEqual(['security', 'crypto'])
    const crypto = prof.find((x) => x.skill === 'crypto')!
    expect(crypto.target).toBe(6)
    expect(crypto.now).toBeGreaterThan(0)
    expect(crypto.all).toBeGreaterThan(crypto.now)
  })

  test('lecturers of the modules a path needs', () => {
    const experts = expertsFor(pathRole(career, 'ml-eng', lens('ailab')), lens('ailab'), career, rows)
    expect(experts[0].name).toBe('Prof. Dr. Gerhard Neumann')
    expect(experts[0].modules.map((m) => m.id)).toEqual(['H1'])
  })
})

describe('job ads and CV lines', () => {
  test('a job ad becomes skills, with the words that matched', () => {
    const m = matchJobAd('We build LLM products in PyTorch on Kubernetes. Experience with distributed systems and C++ is a plus.')
    const skills = m.map((x) => x.skill)
    expect(skills).toContain('dl')
    expect(skills).toContain('distsys')
    expect(skills).toContain('sysperf')
    expect(m.find((x) => x.skill === 'dl')!.hits).toEqual(expect.arrayContaining(['pytorch', 'llm']))
    expect(matchJobAd('Barista wanted')).toEqual([])
    // A word inside another word does not count.
    expect(matchJobAd('regitarre')).toEqual([])
  })

  test('coursework is grouped under the skill each module is strongest in', () => {
    const name = (s: string) => `skill ${s}`
    const role = pathRole(career, 'security', lens('bigtech'))
    const passedOnly = courseworkLines(plan(), career, rows, role, lens('bigtech'), name, { planned: false, grades: true })
    expect(passedOnly).toEqual([{ heading: 'skill mltheory', items: ['Reinforcement Learning (1.3)'] }])
    const all = courseworkLines(plan(), career, rows, role, lens('bigtech'), name, { planned: true, grades: false })
    expect(all.map((g) => g.heading)).toEqual(['skill security', 'skill crypto', 'skill mltheory'])
    expect(all[1].items).toEqual(['Seminar: Post-Quantum Cryptography (ongoing)'])
  })

  test('salary bands older than six months are flagged', () => {
    expect(isStale('2026-04', '2026-10-31')).toBe(false)
    expect(isStale('2026-03', '2026-10-31')).toBe(true)
    expect(isStale('?', '2026-10-31')).toBe(true)
  })
})
