// A few pages in a sidebar, each answering one question, and a course sheet that opens over any of them
// (`?c=<module id>` after the page). Old routes (tabs, side panels) forward to their new home.
import type { Kind } from '../logic/degree'
import type { RowId } from '../logic/matrix'

export type Page =
  | { kind: 'overview' }
  | { kind: 'plan' }
  | { kind: 'courses'; term: string | null; row: RowId | null; filter: Kind | null; starred?: boolean }
  | { kind: 'week' }
  | { kind: 'career'; focus: string | null }
  | { kind: 'changes' }
  | { kind: 'help'; id: string | null }
  | { kind: 'settings' }
  | { kind: 'more' }
  | { kind: 'shared'; code: string }

export interface Route {
  page: Page
  /** Module id of the open course sheet. */
  course: string | null
}

const ROWS: RowId[] = ['area0', 'area1', 'elective', 'minor', 'iq', 'other']
const KINDS: Kind[] = ['stamm', 'lecture', 'seminar', 'practical']

function pageOf(head: string, a?: string, b?: string, c?: string): Page | null {
  switch (head) {
    case '': return { kind: 'overview' }
    case 'plan': return { kind: 'plan' }
    case 'courses': return {
      kind: 'courses', term: a || null, row: ROWS.includes(b as RowId) ? (b as RowId) : null,
      filter: KINDS.includes(c as Kind) ? (c as Kind) : null,
    }
    case 'week': return { kind: 'week' }
    case 'career': return { kind: 'career', focus: a || null }
    case 'changes': return { kind: 'changes' }
    case 'help': return { kind: 'help', id: a || null }
    case 'settings': return { kind: 'settings' }
    case 'more': return { kind: 'more' }
    case 'shared': return { kind: 'shared', code: a ?? '' }
    default: return null
  }
}

/** Old hashes (tabs before 2026-10-23, side panels before 2026-10-24) and where they live now. */
function legacy(head: string, a?: string, b?: string, c?: string): string | null {
  const tail = (...xs: (string | undefined)[]) => xs.filter(Boolean).map((x) => `/${x}`).join('')
  switch (head) {
    case 'add': return `#/courses${tail(a, b, c)}`
    case 'course': return a ? `#/plan?c=${encodeURIComponent(a)}` : '#/plan'
    case 'goal': return `#/career${tail(a)}`
    case 'info': return `#/help${tail(a)}`
    case 'glossary': return `#/help${tail(a)}`
    case 'guide': return '#/help/guide'
    case 'sync': return '#/settings'
    case 'catalog': return '#/courses'
    case 'schedule': return '#/week'
    case 'roadmap': return '#/plan'
    default: return null
  }
}

/** The route a hash asks for, or a redirect for an old or unknown one. */
export function parseHash(hash: string): { route: Route; redirect?: string } {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?')
  const [head = '', a, b, c] = path.split('/').map(decodeURIComponent)
  const params = new URLSearchParams(query)
  const course = params.get('c')
  const page = pageOf(head, a, b, c)
  if (page?.kind === 'courses' && params.get('starred') === '1') page.starred = true
  if (page) return { route: { page, course } }
  const to = legacy(head, a, b, c) ?? '#/'
  return { route: parseHash(to).route, redirect: to }
}

export function pageHref(p: Page): string {
  const parts = (...xs: (string | null)[]) => xs.filter((x): x is string => !!x).map(encodeURIComponent).join('/')
  switch (p.kind) {
    case 'overview': return '#/'
    case 'courses': {
      const rest = parts(p.term, p.term ? p.row : null, p.term && p.row ? p.filter : null)
      return rest ? `#/courses/${rest}` : '#/courses'
    }
    case 'career': return p.focus ? `#/career/${p.focus}` : '#/career'
    case 'help': return p.id ? `#/help/${p.id}` : '#/help'
    case 'shared': return `#/shared/${p.code}`
    default: return `#/${p.kind}`
  }
}

/** The current page with the sheet for one course on top. */
export function courseHref(id: string): string {
  const base = location.hash.replace(/\?.*$/, '') || '#/'
  return `${base}?c=${encodeURIComponent(id)}`
}

export const closeCourse = () => { location.hash = location.hash.replace(/\?.*$/, '') || '#/' }
