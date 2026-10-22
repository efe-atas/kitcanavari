// One page (#/) with at most one side panel, named by the hash. Old tab routes forward to their new home.
import type { Kind } from '../logic/degree'
import type { RowId } from '../logic/matrix'
import { CURRENT_TERM } from '../logic/terms'

export type Panel =
  | { kind: 'add'; term: string; row: RowId; filter: Kind | null }
  | { kind: 'course'; id: string }
  | { kind: 'week' }
  | { kind: 'goal'; focus: string | null }
  | { kind: 'changes' }
  | { kind: 'info'; id: string | null }
  | { kind: 'sync' }

const ROWS: RowId[] = ['area0', 'area1', 'elective', 'minor', 'iq', 'other']
const KINDS: Kind[] = ['stamm', 'lecture', 'seminar', 'practical']

/** The panel a hash asks for, or a redirect for an old route. */
export function parseHash(hash: string): { panel: Panel | null; redirect?: string } {
  const [head, a, b, c] = hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent)
  switch (head) {
    case 'add':
      return a && ROWS.includes(b as RowId)
        ? { panel: { kind: 'add', term: a, row: b as RowId, filter: KINDS.includes(c as Kind) ? (c as Kind) : null } }
        : { panel: null, redirect: '#/' }
    case 'course': return a ? { panel: { kind: 'course', id: a } } : { panel: null, redirect: '#/' }
    case 'week': return { panel: { kind: 'week' } }
    case 'goal': return { panel: { kind: 'goal', focus: a || null } }
    case 'changes': return { panel: { kind: 'changes' } }
    case 'info': return { panel: { kind: 'info', id: a || null } }
    case 'sync': return { panel: { kind: 'sync' } }
    // Old tabs.
    case 'catalog': return { panel: null, redirect: `#/add/${CURRENT_TERM}/elective` }
    case 'schedule': return { panel: null, redirect: '#/week' }
    case 'career': return { panel: null, redirect: a ? `#/goal/${a}` : '#/goal' }
    case 'glossary': return { panel: null, redirect: a ? `#/info/${a}` : '#/info' }
    case 'guide': return { panel: null, redirect: '#/info/guide' }
    case 'roadmap': return { panel: null, redirect: '#/' }
    default: return { panel: null }
  }
}

export function panelHref(p: Panel): string {
  switch (p.kind) {
    case 'add': return `#/add/${p.term}/${p.row}${p.filter ? `/${p.filter}` : ''}`
    case 'course': return `#/course/${encodeURIComponent(p.id)}`
    case 'goal': return p.focus ? `#/goal/${p.focus}` : '#/goal'
    case 'info': return p.id ? `#/info/${p.id}` : '#/info'
    default: return `#/${p.kind}`
  }
}

export const closePanel = () => { location.hash = '#/' }
