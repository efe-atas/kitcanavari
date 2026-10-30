import { describe, expect, test } from 'vitest'
import {
  addDays, berlinNow, clashes, defaultWeek, mondayOf, occurrences, phaseOf, semesterBounds, weekDates,
} from '../src/logic/calendar'
import { ev, sel, session, slot } from './fixtures'

const withSlot = (s: ReturnType<typeof session>, i: number) => ({ ...s, slot: i })

describe('dates', () => {
  test('weeks start on Monday and days add across months', () => {
    expect(mondayOf('2026-11-01')).toBe('2026-10-26') // a Sunday
    expect(mondayOf('2026-10-26')).toBe('2026-10-26')
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02')
    expect(weekDates('2026-10-26', 5)).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30'])
  })

  test('today is taken in Karlsruhe, whatever the device zone', () => {
    // 23:30 UTC on 31 Oct 2026 is already 1 Nov, 00:30 in Berlin (winter time, UTC+1).
    expect(berlinNow(new Date('2026-10-31T23:30:00Z'))).toEqual({ date: '2026-11-01', minutes: 30, day: 'Sun' })
    expect(berlinNow(new Date('2026-07-01T10:15:00Z')).minutes).toBe(12 * 60 + 15) // summer time, UTC+2
  })

  test('semester bounds', () => {
    expect(semesterBounds('WS26')).toEqual({ from: '2026-10-01', to: '2027-03-31' })
    expect(semesterBounds('SS27')).toEqual({ from: '2027-04-01', to: '2027-09-30' })
    expect(semesterBounds('prior')).toBeNull()
  })
})

describe('occurrences', () => {
  const lecture = ev('lec', [slot('Tue', '14:00', '15:30'), slot('Thu', '09:45', '11:15')], {
    sessions: [
      withSlot(session('2026-10-27', '14:00', '15:30'), 0), withSlot(session('2026-10-29', '09:45', '11:15', true), 1),
      withSlot(session('2026-11-03', '14:00', '15:30'), 0),
    ],
  })

  test('dated sessions of enabled slots, cancelled ones marked', () => {
    const occ = occurrences(sel('lec'), { lec: lecture }, '2026-10-26', '2026-11-01')
    expect(occ.map((o) => [o.date, o.start, o.cancelled])).toEqual([['2026-10-27', '14:00', false], ['2026-10-29', '09:45', true]])
    const onlyTue = occurrences({ lec: { enabledSlots: [0], moduleId: null, ackFingerprint: '' } }, { lec: lecture }, '2026-10-26', '2026-11-08')
    expect(onlyTue.map((o) => o.date)).toEqual(['2026-10-27', '2026-11-03'])
  })

  test('weekly slots without dates repeat inside the semester; fortnightly ones every other week from the first date', () => {
    const weekly = ev('w', [slot('Fri', '09:45', '11:15')])
    const fortnight = ev('f', [{ ...slot('Wed', '08:00', '09:30', 'fortnightly'), firstDate: '2026-10-21', count: 2 }])
    const occ = occurrences(sel('w', 'f'), { w: weekly, f: fortnight }, '2026-10-19', '2026-11-15')
    expect(occ.filter((o) => o.eventId === 'w').map((o) => o.date)).toEqual(['2026-10-23', '2026-10-30', '2026-11-06', '2026-11-13'])
    expect(occ.filter((o) => o.eventId === 'f').map((o) => o.date)).toEqual(['2026-10-21', '2026-11-04'])
    expect(occurrences(sel('w'), { w: weekly }, '2027-04-05', '2027-04-11')).toEqual([])
  })

  test('clashes are per date and ignore cancelled sessions', () => {
    const other = ev('o', [slot('Tue', '15:00', '16:30')], {
      sessions: [withSlot(session('2026-10-27', '15:00', '16:30'), 0), withSlot(session('2026-11-03', '15:00', '16:30', true), 0)],
    })
    const occ = occurrences(sel('lec', 'o'), { lec: lecture, o: other }, '2026-10-26', '2026-11-08')
    const c = clashes(occ)
    expect(c).toHaveLength(1)
    expect(c[0]).toMatchObject({ start: '15:00', end: '15:30' })
    expect(c[0].a.date).toBe('2026-10-27')
  })

  test('the phase of a session today', () => {
    expect(phaseOf({ start: '14:00', end: '15:30' }, 14 * 60 + 10)).toBe('live')
    expect(phaseOf({ start: '14:00', end: '15:30' }, 16 * 60)).toBe('done')
    expect(phaseOf({ start: '14:00', end: '15:30' }, 9 * 60)).toBe('next')
  })

  test('the calendar opens on this week, inside the dated weeks', () => {
    const events = { lec: lecture }
    expect(defaultWeek(events, '2026-10-30')).toBe('2026-10-26')
    expect(defaultWeek(events, '2026-09-01')).toBe('2026-10-26')
    expect(defaultWeek(events, '2027-06-01')).toBe('2026-11-02')
  })
})

describe('calendar layout', () => {
  test('overlapping sessions share the day side by side; separate ones keep the full width', async () => {
    const { layoutDay } = await import('../src/ui/schedule/Calendar')
    const o = (eventId: string, start: string, end: string) => ({ eventId, slotIdx: 0, date: '2026-10-26', start, end, room: null, cancelled: false, dated: true })
    const items = [o('a', '09:45', '11:15'), o('b', '10:00', '11:30'), o('c', '11:15', '12:00'), o('d', '14:00', '15:30')]
    const lanes = layoutDay(items)
    const get = (id: string) => lanes.get(`${id}|2026-10-26|${items.find((x) => x.eventId === id)!.start}|0`)
    expect(get('a')).toEqual({ col: 0, cols: 2 })
    expect(get('b')).toEqual({ col: 1, cols: 2 })
    expect(get('c')).toEqual({ col: 0, cols: 2 }) // starts when a ends, still overlaps b
    expect(get('d')).toEqual({ col: 0, cols: 1 })
  })
})
