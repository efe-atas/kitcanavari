import { describe, expect, test } from 'vitest'
import { moduleRows } from '../src/logic/handbook'
import { fold, highlight, matchScore, searchModules, similarModules } from '../src/logic/search'
import { makeCourses, makeHandbook } from './appdata'
import { makeCareer } from './careerdata'

const rows = () => moduleRows(makeCourses(), makeHandbook())

describe('search', () => {
  test('folds accents and case', () => {
    expect(fold('Müller-Quade École')).toBe('muller-quade ecole')
  })

  test('every word has to match; title starts rank first', () => {
    const r = rows()
    expect(searchModules(r, 'reinforcement').map((x) => x.id)).toEqual(['H1'])
    expect(searchModules(r, 'post quantum').map((x) => x.id)).toEqual(['H2'])
    expect(searchModules(r, 'quantum banana')).toEqual([])
    expect(searchModules(r, 'neumann').map((x) => x.id)).toEqual(['H1']) // coordinator
    const h1 = r.find((x) => x.id === 'H1')!
    expect(matchScore(h1, 'rein')).toBeGreaterThan(matchScore(h1, 'learn'))
    expect(searchModules(r, '').length).toBe(r.length)
  })

  test('highlight splits around the longest matching word', () => {
    expect(highlight('Seminar: Post-Quantum Cryptography', 'quantum')).toEqual(['Seminar: Post-', 'Quantum', ' Cryptography'])
    expect(highlight('Algorithms II', 'xyz')).toBeNull()
  })

  test('similar modules share skills or areas', () => {
    const r = rows()
    const career = makeCareer()
    const sim = similarModules('M3', r, career)
    expect(sim.every((x) => x.id !== 'M3' && x.score > 0)).toBe(true)
    expect(similarModules('nope', r, career)).toEqual([])
    // Without career data, shared areas decide: H2 is in M3's only area.
    expect(similarModules('M3', r, null).map((x) => x.id)).toContain('H2')
  })
})
