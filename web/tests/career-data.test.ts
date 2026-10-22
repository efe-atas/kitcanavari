import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { loadData } from '../src/data'
import { validateCareer } from '../src/logic/careerSchema'
import type { CareerData } from '../src/types'
import { makeChanges, makeCourses } from './appdata'
import { makeCareer } from './careerdata'

const has = (errors: string[], part: string) => errors.some((e) => e.includes(part))

describe('validateCareer', () => {
  test('a valid dataset has no errors', () => expect(validateCareer(makeCareer())).toEqual([]))

  test('rejects bad scores, skills, weights, salaries and ids', () => {
    const c = makeCareer()
    c.skills.modules.H1 = { dl: [4, 'x'], nope: [1, 'x'], mltheory: [2, ' '] } as never
    c.roles.roles[0].weights = { dl: 0.9 }
    c.lenses.lenses[0].salary = [{ role: 'ml-eng', band: '€1', source: '', asOf: '2026-10' }, { role: 'ghost', band: '€1', source: 'https://x', asOf: '2026-10' }]
    const errors = validateCareer(c)
    expect(has(errors, 'H1.dl')).toBe(true)
    expect(has(errors, 'H1.nope')).toBe(true)
    expect(has(errors, 'H1.mltheory')).toBe(true)
    expect(has(errors, 'ml-eng weights')).toBe(true)
    expect(has(errors, 'salary source')).toBe(true)
    expect(has(errors, 'ghost')).toBe(true)
  })

  test('reports malformed lenses instead of throwing', () => {
    const c = makeCareer()
    delete (c.lenses.lenses[0] as Partial<typeof c.lenses.lenses[0]>).offCourse
    delete (c.lenses.lenses[0] as Partial<typeof c.lenses.lenses[0]>).cities
    expect(() => validateCareer(c)).not.toThrow()
    expect(has(validateCareer(c), 'offCourse')).toBe(true)
    expect(has(validateCareer(c), 'cities')).toBe(true)
  })

  test('requires every role and lens id', () => {
    const c = makeCareer()
    c.roles.roles = c.roles.roles.slice(1)
    expect(has(validateCareer(c), 'ml-eng')).toBe(true)
  })

  const dir = resolve(__dirname, '../../data/career')
  test.skipIf(!existsSync(`${dir}/roles.json`) || !existsSync(`${dir}/lenses.json`))('real career files are valid', () => {
    const read = (n: string) => JSON.parse(readFileSync(`${dir}/${n}`, 'utf-8'))
    const skills = existsSync(`${dir}/skills.json`) ? read('skills.json') : { meta: { curatedAt: '', handbookAsOf: '' }, modules: {} }
    const c: CareerData = { skills, roles: read('roles.json'), lenses: read('lenses.json') }
    expect(validateCareer(c)).toEqual([])
  })
})

// Reports, never fails: this suite gates every deploy (also the daily data deploy), and the site shows unscored
// modules on its own. Scoring new modules is a hand step in a Claude session (spec §1).
test('lists handbook modules without scores', () => {
  const root = resolve(__dirname, '../../data')
  const handbook = JSON.parse(readFileSync(`${root}/handbook.json`, 'utf-8')) as { modules: Record<string, unknown> }
  const skills = existsSync(`${root}/career/skills.json`)
    ? (JSON.parse(readFileSync(`${root}/career/skills.json`, 'utf-8')) as { modules: Record<string, unknown> }).modules : {}
  const unscored = Object.keys(handbook.modules).filter((id) => !(id in skills))
  if (unscored.length) console.warn(`career: ${unscored.length} handbook modules have no skill scores: ${unscored.join(', ')}`)
  expect(Array.isArray(unscored)).toBe(true)
})

describe('loadData career', () => {
  afterEach(() => vi.unstubAllGlobals())
  test('invalid career files are not used', async () => {
    const bad = makeCareer()
    bad.roles.roles = bad.roles.roles.slice(1)
    const files: Record<string, unknown> = { 'courses.json': makeCourses(), 'changes.json': makeChanges(), 'skills.json': bad.skills, 'roles.json': bad.roles, 'lenses.json': bad.lenses }
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const body = files[url.split('/').pop()!]
      return body ? new Response(JSON.stringify(body)) : new Response('nope', { status: 404 })
    }))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect((await loadData()).career).toBeNull()
  })
  test('missing career files do not fail loading', async () => {
    const files: Record<string, unknown> = { 'courses.json': makeCourses(), 'changes.json': makeChanges(), 'roles.json': makeCareer().roles }
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const body = files[url.split('/').pop()!]
      return body ? new Response(JSON.stringify(body)) : new Response('nope', { status: 404 })
    }))
    const data = await loadData()
    expect(data.career).toBeNull()
    expect(Object.keys(data.courses.events)).toHaveLength(3)
  })
})
