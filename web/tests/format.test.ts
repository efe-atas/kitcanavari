import { expect, test } from 'vitest'
import { blockHasConflict } from '../src/ui/schedule/WeekGrid'
import { fmtSlot } from '../src/ui/format'
import { ev, session, slot } from './fixtures'

test('slot with a day but no time does not print null', () => {
  expect(fmtSlot('en', slot('Mon', null, null, 'block'))).toBe('Mon (block)')
})

test('a one-date clash does not mark an unrelated weekly block', () => {
  const e = ev('a', [slot('Fri', '09:45', '11:15'), { ...slot('Fri', '09:00', '17:00', 'single'), firstDate: '2026-10-16' }], {
    sessions: [{ ...session('2026-10-23', '09:45', '11:15'), slot: 0 }, { ...session('2026-10-16', '09:00', '17:00'), slot: 1 }],
  })
  const block = { eventId: 'a', slotIdx: 0, day: 'Fri' as const, start: '09:45', end: '11:15', room: null }
  const clash = { a: 'a', b: 'b', day: 'Fri', start: '10:00', end: '11:00', date: '2026-10-16' }
  expect(blockHasConflict(block, clash, e)).toBe(false)
  expect(blockHasConflict(block, { ...clash, date: '2026-10-23' }, e)).toBe(true)
  expect(blockHasConflict(block, { ...clash, date: undefined }, e)).toBe(true)
})
