import { describe, expect, test } from 'vitest'
import { emptyFilters, filterEvents } from '../src/logic/filter'
import { defaultState } from '../src/store'
import type { CoursesFile } from '../src/types'
import { entry, ev, mod, slot } from './fixtures'

const data: CoursesFile = {
  meta: { scrapedAt: '', term: '', termGuid: '', spo: '', warnings: [] },
  tree: [{ id: 'F1', title: '1.', eventIds: [], children: [{ id: 'F1a', title: '1.1', eventIds: ['b'], children: [] }] },
    { id: 'F2', title: '2.', eventIds: ['c'], children: [] }],
  events: {
    a: ev('a', [slot('Tue', '14:00', '15:30')], { number: '300', title: 'Algorithms II', lecturers: [{ name: 'Sanders', unit: '' }] }),
    b: ev('b', [slot('Tue', '15:00', '16:00')], { number: '100', title: 'Robotics', typeCode: 'S', language: 'German', moduleIds: ['M2'] }),
    c: ev('c', [slot('Wed', '08:00', '09:30')], { number: '200', title: 'Telematics' }),
  },
  modules: { M1: mod('M1', 6), M2: mod('M2', 3, 'Seminar') },
}

describe('filterEvents', () => {
  test('no filters returns all sorted by number', () => {
    expect(filterEvents(data, emptyFilters(), defaultState()).map((e) => e.id)).toEqual(['b', 'c', 'a'])
  })
  test('filter by query matches lecturer', () => {
    expect(filterEvents(data, { ...emptyFilters(), query: 'sand' }, defaultState()).map((e) => e.id)).toEqual(['a'])
    expect(filterEvents(data, { ...emptyFilters(), query: '200' }, defaultState()).map((e) => e.id)).toEqual(['c'])
  })
  test('filter by fieldId includes descendants', () => {
    expect(filterEvents(data, { ...emptyFilters(), fieldId: 'F1' }, defaultState()).map((e) => e.id)).toEqual(['b'])
  })
  test('filter by type, language, day, time, ects, part', () => {
    const f = emptyFilters()
    expect(filterEvents(data, { ...f, types: ['S'] }, defaultState()).map((e) => e.id)).toEqual(['b'])
    expect(filterEvents(data, { ...f, languages: ['German'] }, defaultState()).map((e) => e.id)).toEqual(['b'])
    expect(filterEvents(data, { ...f, days: ['Wed'] }, defaultState()).map((e) => e.id)).toEqual(['c'])
    expect(filterEvents(data, { ...f, from: '14:30' }, defaultState()).map((e) => e.id)).toEqual(['b'])
    expect(filterEvents(data, { ...f, to: '10:00' }, defaultState()).map((e) => e.id)).toEqual(['c'])
    expect(filterEvents(data, { ...f, ects: [3] }, defaultState()).map((e) => e.id)).toEqual(['b'])
    expect(filterEvents(data, { ...f, parts: ['Seminar'] }, defaultState()).map((e) => e.id)).toEqual(['b'])
  })
  test('filter noConflict hides overlapping events', () => {
    const st = { ...defaultState(), selected: { a: entry('M1') } }
    expect(filterEvents(data, { ...emptyFilters(), noConflict: true }, st).map((e) => e.id)).toEqual(['c', 'a'])
  })
})
