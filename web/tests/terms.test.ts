import { expect, test } from 'vitest'
import { nextTerm, offeringIssue, termLabel } from '../src/logic/terms'

test('term labels', () => {
  expect(termLabel('WS26')).toBe('WS 26/27')
  expect(termLabel('SS27')).toBe('SS 27')
  expect(termLabel('WS99')).toBe('WS 99/00')
  expect(termLabel('prior')).toBe('prior')
})

test('next term alternates winter and summer', () => {
  expect(nextTerm('WS26')).toBe('SS27')
  expect(nextTerm('SS27')).toBe('WS27')
  expect(nextTerm('SS28')).toBe('WS28')
})

test('offering warnings', () => {
  expect(offeringIssue({ recurrence: 'winter', eventIds: [] }, 'SS27')).toBe('wrongSeason')
  expect(offeringIssue({ recurrence: 'summer', eventIds: [] }, 'WS27')).toBe('wrongSeason')
  expect(offeringIssue({ recurrence: 'summer', eventIds: [] }, 'SS27')).toBeNull()
  expect(offeringIssue({ recurrence: 'each', eventIds: [] }, 'WS27')).toBeNull()
  expect(offeringIssue({ recurrence: 'irregular', eventIds: [] }, 'SS27')).toBe('irregular')
  expect(offeringIssue({ recurrence: 'winter', eventIds: [] }, 'WS26')).toBe('notThisTerm')
  expect(offeringIssue({ recurrence: 'winter', eventIds: ['e1'] }, 'WS26')).toBeNull()
  expect(offeringIssue({ recurrence: 'irregular', eventIds: [] }, 'prior')).toBeNull()
})
