import { t } from '../i18n'
import { moduleAreas, moduleKind, moduleMinors, type Kind } from '../logic/degree'
import { eventModules } from '../logic/filter'
import { FORTNIGHTLY } from '../logic/ics'
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

/** "fortnightly" → "iki haftada bir"; a rhythm the catalog words some other way stays as it is. */
export function rhythmLabel(lang: Lang, rhythm: string): string {
  const key = `rhythm.${FORTNIGHTLY.test(rhythm) ? 'fortnightly' : rhythm}`
  const label = t(lang, key)
  return label === key ? rhythm : label
}

export function fmtSlot(lang: Lang, s: Slot): string {
  if (s.rhythm === 'single' && s.firstDate) return `${fmtDate(lang, s.firstDate)} ${s.start ?? ''}–${s.end ?? ''}`
  if (!s.day) return rhythmLabel(lang, s.rhythm)
  const rhythm = s.rhythm === 'weekly' ? '' : ` (${rhythmLabel(lang, s.rhythm)})`
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

/** Kind of the event's default module; null when it has no module. */
export function eventKind(data: CoursesFile, ev: Event): Kind | null {
  const m = eventModules(data, ev)[0]
  return m ? moduleKind(data, m) : null
}

/** Minor subjects of an event whose modules count only as a minor (taught by another department or law). */
export function eventMinors(data: CoursesFile, ev: Event): string[] {
  const mods = eventModules(data, ev)
  if (mods.some((m) => moduleAreas(m).length || m.fields.some((f) => f.startsWith('Elective Studies')))) return []
  return [...new Set(mods.flatMap(moduleMinors))]
}

export const eventAreas = (data: CoursesFile, ev: Event): string[] =>
  [...new Set(eventModules(data, ev).flatMap(moduleAreas))]

/** Translation key for a module recurrence, or null for "each term". */
export function recurrenceKey(rec: string | null): string | null {
  if (!rec) return null
  if (/irregular/i.test(rec)) return 'rec.irregular'
  if (/winter/i.test(rec)) return 'rec.winter'
  if (/summer/i.test(rec)) return 'rec.summer'
  return null
}
