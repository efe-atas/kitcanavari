import { afterEach, describe, expect, test, vi } from 'vitest'
import { loadData } from '../src/data'
import { emptyModuleFilters, filterModules, moduleRows } from '../src/logic/handbook'
import { makeChanges, makeCourses, makeHandbook } from './appdata'

describe('moduleRows', () => {
  test('merges handbook and catalog modules by id', () => {
    const rows = moduleRows(makeCourses(), makeHandbook())
    expect(rows.map((r) => r.id).sort()).toEqual(['H1', 'H2', 'M1', 'M2', 'M3'])
    const m3 = rows.find((r) => r.id === 'M3')!
    expect(m3.hb).not.toBeNull()
    expect(m3.current).not.toBeNull()
    expect(m3.eventIds.sort()).toEqual(['ml', 'sec'])
    expect(rows.find((r) => r.id === 'M1')!.hb).toBeNull()
    expect(rows.find((r) => r.id === 'H1')!.eventIds).toEqual([])
  })

  test('catalog-only modules derive recurrence from the catalog text', () => {
    const c = makeCourses()
    c.modules.M1 = { ...c.modules.M1, recurrence: 'Each summer term' }
    expect(moduleRows(c, makeHandbook()).find((r) => r.id === 'M1')!.recurrence).toBe('summer')
    expect(moduleRows(c, makeHandbook()).find((r) => r.id === 'M2')!.recurrence).toBe('irregular')
  })
})

describe('filterModules', () => {
  const c = makeCourses()
  const rows = moduleRows(c, makeHandbook())
  const f = emptyModuleFilters()
  const ids = (xs: { id: string }[]) => xs.map((r) => r.id).sort()

  test('by recurrence', () => expect(ids(filterModules(c, rows, { ...f, recurrence: ['summer'] }))).toEqual(['H2']))
  test('offered this term', () => expect(ids(filterModules(c, rows, { ...f, offeredNow: true }))).toEqual(['M1', 'M2', 'M3']))
  test('by kind', () => expect(ids(filterModules(c, rows, { ...f, kinds: ['seminar'] }))).toEqual(['H2', 'M3']))
  test('by coordinator query', () => expect(ids(filterModules(c, rows, { ...f, query: 'neumann' }))).toEqual(['H1']))
  test('by area', () => expect(ids(filterModules(c, rows, { ...f, areas: ['Cryptography and Security'] }))).toEqual(['H2', 'M3']))
  test('by ects', () => expect(ids(filterModules(c, rows, { ...f, ects: [6] }))).toEqual(['H1', 'M1']))
})

describe('loadData', () => {
  afterEach(() => vi.unstubAllGlobals())

  test('a missing handbook does not fail loading', async () => {
    const files: Record<string, unknown> = { 'courses.json': makeCourses(), 'changes.json': makeChanges(), 'status.json': { checkedAt: 'x' } }
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const body = files[url.split('/').pop()!]
      return body ? new Response(JSON.stringify(body)) : new Response('nope', { status: 404 })
    }))
    const data = await loadData()
    expect(data.handbook).toBeNull()
    expect(Object.keys(data.courses.events)).toHaveLength(3)
  })
})
