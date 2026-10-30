import { expect, test } from 'vitest'
import { fmtSlot } from '../src/ui/format'
import { slot } from './fixtures'

test('slot with a day but no time does not print null', () => {
  expect(fmtSlot('en', slot('Mon', null, null, 'block'))).toBe('Mon (block)')
})

test('rhythms are translated, unknown ones are kept', () => {
  expect(fmtSlot('tr', slot('Wed', '09:45', '11:15', 'fortnightly'))).toBe('Çar 09:45–11:15 (iki haftada bir)')
  expect(fmtSlot('en', slot('Wed', '09:45', '11:15', 'biweekly'))).toBe('Wed 09:45–11:15 (fortnightly)')
  expect(fmtSlot('en', slot(null, null, null, 'every full moon'))).toBe('every full moon')
})
