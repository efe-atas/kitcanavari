import { describe, expect, test } from 'vitest'
import { findConflicts } from '../src/logic/conflicts'
import { computeEcts } from '../src/logic/ects'
import { buildIcs } from '../src/logic/ics'
import { activeSessions } from '../src/logic/time'
import { entry, ev, mod, sel, session, slot } from './fixtures'

describe('findConflicts', () => {
  test('overlapping weekly slots conflict', () => {
    const c = findConflicts(sel('a', 'b'), { a: ev('a', [slot('Tue', '14:00', '15:30')]), b: ev('b', [slot('Tue', '15:00', '16:30')]) })
    expect(c).toEqual([{ a: 'a', b: 'b', day: 'Tue', start: '15:00', end: '15:30' }])
  })
  test('touching slots do not conflict', () => {
    expect(findConflicts(sel('a', 'b'), { a: ev('a', [slot('Tue', '14:00', '15:30')]), b: ev('b', [slot('Tue', '15:30', '17:00')]) })).toEqual([])
  })
  test('disabled slot is ignored', () => {
    const s = { a: entry(null, []), b: entry() }
    expect(findConflicts(s, { a: ev('a', [slot('Tue', '14:00', '15:30')]), b: ev('b', [slot('Tue', '14:00', '15:30')]) })).toEqual([])
  })
  test('conflicts ignores slots with null day', () => {
    expect(findConflicts(sel('a', 'b'), { a: ev('a', [slot(null, null, null, 'block')]), b: ev('b', [slot('Tue', '14:00', '15:30')]) })).toEqual([])
  })
  test('biweekly sessions on different dates do not conflict', () => {
    const a = ev('a', [slot('Tue', '14:00', '15:30', 'biweekly')], { sessions: [session('2026-10-27', '14:00', '15:30')] })
    const b = ev('b', [slot('Tue', '14:00', '15:30', 'biweekly')], { sessions: [session('2026-11-03', '14:00', '15:30')] })
    expect(findConflicts(sel('a', 'b'), { a, b })).toEqual([])
  })
  test('sessions on same date conflict and report the first date', () => {
    const a = ev('a', [slot('Tue', '14:00', '15:30')], { sessions: [session('2026-10-27', '14:00', '15:30'), session('2026-11-03', '14:00', '15:30')] })
    const b = ev('b', [slot('Tue', '15:00', '16:00')], { sessions: [session('2026-10-27', '15:00', '16:00'), session('2026-11-03', '15:00', '16:00')] })
    expect(findConflicts(sel('a', 'b'), { a, b })).toEqual([{ a: 'a', b: 'b', day: 'Tue', start: '15:00', end: '15:30', date: '2026-10-27' }])
  })
  test('cancelled session does not conflict', () => {
    const a = ev('a', [slot('Tue', '14:00', '15:30')], { sessions: [session('2026-10-27', '14:00', '15:30', true)] })
    const b = ev('b', [slot('Tue', '14:00', '15:30')], { sessions: [session('2026-10-27', '14:00', '15:30')] })
    expect(findConflicts(sel('a', 'b'), { a, b })).toEqual([])
  })
  test('unknown event ids are skipped', () => {
    expect(findConflicts(sel('a', 'gone'), { a: ev('a', [slot('Tue', '14:00', '15:30')]) })).toEqual([])
  })
})

describe('activeSessions with slot index', () => {
  test('parallel groups at the same time are told apart by slot index', () => {
    const e = ev('a', [slot('Tue', '14:00', '15:30', 'weekly', 'R1'), slot('Tue', '14:00', '15:30', 'weekly', 'R2')], {
      sessions: [{ ...session('2026-10-27', '14:00', '15:30'), slot: 0 }, { ...session('2026-10-27', '14:00', '15:30'), room: 'R2', slot: 1 }],
    })
    expect(activeSessions(e, [1]).map((s) => s.room)).toEqual(['R2'])
  })
  test('single-date slots can be switched off', () => {
    const e = ev('a', [slot('Tue', '14:00', '15:30'), slot('Fri', '09:00', '17:00', 'single')], {
      sessions: [{ ...session('2026-10-27', '14:00', '15:30'), slot: 0 }, { ...session('2026-10-16', '09:00', '17:00'), slot: 1 }],
    })
    expect(activeSessions(e, [0]).map((s) => s.date)).toEqual(['2026-10-27'])
  })
})

describe('activeSessions', () => {
  test('keeps sessions of enabled slots and unmatched sessions, drops cancelled', () => {
    const e = ev('a', [slot('Tue', '14:00', '15:30'), slot('Fri', '09:45', '11:15')], {
      sessions: [session('2026-10-27', '14:00', '15:30'), session('2026-10-30', '09:45', '11:15'),
        session('2026-10-16', '09:00', '17:00'), session('2026-11-03', '14:00', '15:30', true)],
    })
    expect(activeSessions(e, [1]).map((s) => s.date)).toEqual(['2026-10-30', '2026-10-16'])
  })
})

describe('computeEcts', () => {
  const evs = { a: ev('a'), b: ev('b', [], { moduleIds: ['M2'] }) }
  test('computeEcts counts a module once and reports duplicate', () => {
    const r = computeEcts({ a: entry('M1'), b: entry('M1') }, evs, { M1: mod('M1', 6, 'Elective Studies') })
    expect(r).toMatchObject({ total: 6, byPart: { 'Elective Studies': 6 }, duplicateModules: ['M1'], unknown: [] })
  })
  test('falls back to the first module and groups by part', () => {
    const r = computeEcts({ a: entry(null), b: entry(null) }, evs, { M1: mod('M1', 6), M2: mod('M2', 5, 'Master Thesis') })
    expect(r).toEqual({ total: 11, byPart: { 'Elective Studies': 6, 'Master Thesis': 5 }, duplicateModules: [], unknown: [] })
  })
  test('null ects is reported as unknown', () => {
    expect(computeEcts({ a: entry('M1') }, evs, { M1: mod('M1', null) })).toMatchObject({ total: 0, unknown: ['M1'] })
  })
  test('computeEcts skips missing events', () => {
    expect(computeEcts({ gone: entry('M1') }, evs, { M1: mod('M1', 6) })).toMatchObject({ total: 0 })
  })
})

describe('buildIcs', () => {
  test('buildIcs emits one VEVENT per active session with Berlin TZID', () => {
    const a = ev('a', [slot('Tue', '14:00', '15:30')], {
      number: '2424283', title: 'GPU',
      sessions: [session('2026-10-27', '14:00', '15:30'), session('2026-11-03', '14:00', '15:30'), session('2026-11-10', '14:00', '15:30', true)],
    })
    const ics = buildIcs(sel('a'), { a }, '2026-10-20T04:00:00Z')
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2)
    expect(ics).toContain('DTSTART;TZID=Europe/Berlin:20261027T140000')
    expect(ics).toContain('DTEND;TZID=Europe/Berlin:20261027T153000')
    expect(ics).toContain('UID:a-2026-10-27-14:00@kitcanavari')
    expect(ics).toContain('SUMMARY:2424283 GPU')
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true)
  })
  test('escapes commas and semicolons in text', () => {
    const a = ev('a', [slot('Tue', '14:00', '15:30')], { title: 'A, B; C', sessions: [session('2026-10-27', '14:00', '15:30')] })
    expect(buildIcs(sel('a'), { a }, '2026-10-20T04:00:00Z')).toContain(String.raw`A\, B\; C`)
  })
})
