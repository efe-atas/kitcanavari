// Term ids of the roadmap ("WS26" = winter 2026/27, "SS27" = summer 2027, "prior" = before the first term) and the
// offering warnings of spec §4: a warning, never a block.
import { CURRENT_TERM } from '../sync/profile'
import type { ModuleRow } from './handbook'

export const PRIOR = 'prior'

const TERM_RE = /^(WS|SS)(\d{2})$/
const two = (n: number) => String(n % 100).padStart(2, '0')

export function termLabel(term: string): string {
  const m = TERM_RE.exec(term)
  if (!m) return term
  const y = Number(m[2])
  return m[1] === 'WS' ? `WS ${m[2]}/${two(y + 1)}` : `SS ${m[2]}`
}

export function nextTerm(term: string): string {
  const m = TERM_RE.exec(term)
  if (!m) return term
  const y = Number(m[2])
  return m[1] === 'WS' ? `SS${two(y + 1)}` : `WS${m[2]}`
}

export type OfferingIssue = 'notThisTerm' | 'wrongSeason' | 'irregular'

export function offeringIssue(row: Pick<ModuleRow, 'recurrence' | 'eventIds'>, term: string): OfferingIssue | null {
  if (term === PRIOR) return null
  if (term === CURRENT_TERM) return row.eventIds.length ? null : 'notThisTerm'
  if (row.recurrence === 'irregular') return 'irregular'
  const season = term.startsWith('WS') ? 'winter' : term.startsWith('SS') ? 'summer' : null
  if (season && row.recurrence !== 'each' && row.recurrence !== season) return 'wrongSeason'
  return null
}
