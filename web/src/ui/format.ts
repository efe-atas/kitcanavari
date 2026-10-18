import { t } from '../i18n'
import { eventModules } from '../logic/filter'
import type { CoursesFile, Event, Lang, Slot } from '../types'

export function ectsLabel(data: CoursesFile, ev: Event): string | null {
  const values = [...new Set(eventModules(data, ev).map((m) => m.ects).filter((x): x is number => x !== null))].sort((a, b) => a - b)
  if (!values.length) return null
  const n = values.length === 1 ? fmtNum(values[0]) : `${fmtNum(values[0])}–${fmtNum(values[values.length - 1])}`
  return `${n} ECTS`
}

const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

export function fmtDate(lang: Lang, iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC',
  })
}

export function fmtSlot(lang: Lang, s: Slot): string {
  if (s.rhythm === 'single' && s.firstDate) return `${fmtDate(lang, s.firstDate)} ${s.start ?? ''}–${s.end ?? ''}`
  if (!s.day) return s.rhythm
  const rhythm = s.rhythm === 'weekly' ? '' : ` (${s.rhythm})`
  const time = s.start && s.end ? ` ${s.start}–${s.end}` : ''
  return `${t(lang, `day.${s.day}`)}${time}${rhythm}`
}

/** Single-letter-ish type class used for colour coding: V, Ü, P, S or other. */
export const typeClass = (code: string) => {
  const c = code.toUpperCase()
  if (c.startsWith('P')) return 'p'
  if (c.startsWith('S')) return 's'
  if (c.includes('Ü') || c === 'U' || c === 'Ü') return 'u'
  if (c.startsWith('V')) return 'v'
  return 'x'
}
