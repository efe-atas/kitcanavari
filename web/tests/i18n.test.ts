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

test('German covers the interface and falls back to English for the rest', () => {
  const tr = Object.keys(dictionaries.tr)
  expect(Object.keys(dictionaries.de).every((k) => tr.includes(k))).toBe(true)
  expect(Object.keys(dictionaries.de).length).toBeGreaterThan(600)
  expect(t('de', 'nav.week')).toBe('Meine Woche')
  expect(t('de', 'pl.addTo', { term: 'SS 27' })).toBe('Kurs zu SS 27 hinzufügen')
  expect(t('de', 'tab.catalog')).toBe('Catalog') // not used by the interface: English
  for (const [k, v] of Object.entries(dictionaries.de)) {
    expect([...v.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort(), k).toEqual([...dictionaries.en[k].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort())
  }
})
