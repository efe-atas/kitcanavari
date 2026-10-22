// The plan table (spec 2026-10-23 §3.2): every roadmap entry sits in one row (where its credits count) and one
// column (its term). Rows are the two chosen areas, elective, minor, IQ and "other"; Stammmodul, seminar and
// practical are requirements across rows and travel on the item as its kind.
import type { CoursesFile, HandbookFile, ModuleStatus, UserState } from '../types'
import { AREAS, defaultBucket, ELECTIVE, IQ, MINOR, moduleKind, RULES, type Kind } from './degree'
import { derivedEntries, roadmapEntries } from './roadmap'
import { DEFAULT_TERMS, offeringIssue, PRIOR, termOrder, type OfferingIssue } from './terms'
import { recurrenceOf } from './handbook'

export type RowId = 'area0' | 'area1' | 'elective' | 'minor' | 'iq' | 'other'

export interface CellItem {
  id: string
  /** null when the module is in neither the handbook nor the catalog. */
  title: string | null
  ects: number | null
  status: ModuleStatus
  grade: number | null
  kind: Kind
  issue: OfferingIssue | null
  /** Part of this term's weekly schedule. */
  inSchedule: boolean
}

export interface RowTotal {
  /** Passed + planned. */
  cp: number
  done: number
  min: number
  max: number | null
  /** Areas only: lecture credits and their minimum. */
  lectureCp?: number
  lectureMin?: number
}

export interface Matrix {
  columns: string[]
  cells: Record<RowId, Record<string, CellItem[]>>
  rowTotals: Record<RowId, RowTotal>
  colTotals: Record<string, number>
}

const ALL_ROWS: RowId[] = ['area0', 'area1', 'elective', 'minor', 'iq', 'other']

/** Rows to show: areas, elective and IQ always; minor and other only when something sits there. */
export const rowsFor = (_s: UserState, used: string[]): RowId[] =>
  ALL_ROWS.filter((r) => !(r === 'minor' || r === 'other') || used.includes(r))

/** The bucket (defaultBucket's vocabulary) a row stands for. */
export function rowBucket(s: UserState, row: RowId): string | null {
  const areas = s.areas ?? []
  if (row === 'area0') return areas[0] ?? null
  if (row === 'area1') return areas[1] ?? null
  if (row === 'elective') return ELECTIVE
  if (row === 'minor') return MINOR
  if (row === 'iq') return IQ
  return null
}

function rowOf(s: UserState, bucket: string | null): RowId {
  const areas = s.areas ?? []
  if (bucket && bucket === areas[0]) return 'area0'
  if (bucket && bucket === areas[1]) return 'area1'
  if (bucket === ELECTIVE) return 'elective'
  if (bucket === MINOR) return 'minor'
  if (bucket === IQ) return 'iq'
  return 'other'
}

export function matrixCells(s: UserState, courses: CoursesFile, handbook: HandbookFile | null): Matrix {
  const entries = roadmapEntries(s)
  const inWeekly = new Set(Object.keys(derivedEntries(s)))
  const terms = s.roadmap?.terms ?? DEFAULT_TERMS
  const extra = [...new Set(Object.values(entries).map((e) => e.term))]
    .filter((t) => t !== PRIOR && !terms.includes(t)).sort((a, b) => termOrder(a) - termOrder(b))
  const columns = [PRIOR, ...terms, ...extra]
  const empty = () => Object.fromEntries(columns.map((c) => [c, [] as CellItem[]]))
  const cells = Object.fromEntries(ALL_ROWS.map((r) => [r, empty()])) as Matrix['cells']
  const events = new Map<string, string[]>()
  for (const ev of Object.values(courses.events)) for (const m of ev.moduleIds) events.set(m, [...(events.get(m) ?? []), ev.id])

  const rowTotals = Object.fromEntries(ALL_ROWS.map((r) => [r, { cp: 0, done: 0, min: 0, max: null }])) as Record<RowId, RowTotal>
  const areaMin = (row: RowId) => {
    const name = rowBucket(s, row)
    return name ? RULES.areaLectureMinReduced[name] ?? RULES.areaLectureMin : RULES.areaLectureMin
  }
  rowTotals.area0 = { cp: 0, done: 0, min: RULES.areaMin, max: null, lectureCp: 0, lectureMin: areaMin('area0') }
  rowTotals.area1 = { cp: 0, done: 0, min: RULES.areaMin, max: null, lectureCp: 0, lectureMin: areaMin('area1') }
  rowTotals.elective = { cp: 0, done: 0, min: RULES.electiveMin, max: RULES.electiveMax }
  rowTotals.minor = { cp: 0, done: 0, min: RULES.minorMin, max: RULES.minorMax }
  rowTotals.iq = { cp: 0, done: 0, min: RULES.iqMin, max: RULES.iqMax }
  const colTotals = Object.fromEntries(columns.map((c) => [c, 0]))

  for (const [id, e] of Object.entries(entries)) {
    const hb = handbook?.modules[id]
    const cat = courses.modules[id]
    const info = hb ?? cat
    const bucket = info ? defaultBucket(info.fields, (s.areas ?? []).filter((a) => AREAS.includes(a)), e.countAs) : null
    const row = rowOf(s, bucket)
    const kind = info ? moduleKind(courses, info) : 'lecture'
    const recurrence = hb?.recurrence ?? recurrenceOf(cat?.recurrence ?? null)
    const item: CellItem = {
      id, title: info?.title ?? null, ects: info?.ects ?? null, status: e.status, grade: e.grade, kind,
      issue: info ? offeringIssue({ recurrence, eventIds: events.get(id) ?? [] }, e.term) : null,
      inSchedule: inWeekly.has(id),
    }
    cells[row][e.term].push(item)
    if ((e.status === 'passed' || e.status === 'planned') && item.ects) {
      const t = rowTotals[row]
      t.cp += item.ects
      if (e.status === 'passed') t.done += item.ects
      if (t.lectureCp !== undefined && kind === 'lecture') t.lectureCp += item.ects
      colTotals[e.term] += item.ects
    }
  }
  for (const r of ALL_ROWS) for (const c of columns) cells[r][c].sort((a, b) => (a.title ?? a.id).localeCompare(b.title ?? b.id))
  return { columns, cells, rowTotals, colTotals }
}
