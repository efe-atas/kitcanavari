import { expect, test } from 'vitest'
import { dictionaries, t } from '../src/i18n'

test('translates in both languages and interpolates params', () => {
  expect(t('tr', 'tab.catalog')).toBe('Katalog')
  expect(t('en', 'tab.catalog')).toBe('Catalog')
  expect(t('en', 'data.age', { date: '20.10.2026' })).toContain('20.10.2026')
})
test('missing key returns the key', () => {
  expect(t('tr', 'nope.key')).toBe('nope.key')
})
test('both dictionaries have the same keys', () => {
  expect(Object.keys(dictionaries.tr).sort()).toEqual(Object.keys(dictionaries.en).sort())
})
