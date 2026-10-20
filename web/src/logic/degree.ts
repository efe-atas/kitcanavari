// Degree rules of the Computer Science M.Sc., SPO 88-979-H-2025 (module handbook of 14/10/2025, §1.3, §2, §3).
import type { CoursesFile, Module, UserState } from '../types'
import { chosenModule } from './ects'

export const RULES = {
  total: 120,
  thesis: 30,
  areaMin: 15,
  areaLectureMin: 10,
  areaLectureMinReduced: { Telematics: 8 } as Record<string, number>,
  areasMax: 73,
  stamm: 4,
  seminarMin: 3,
  practicalMin: 6,
  spMin: 12,
  spMax: 18,
  electiveMin: 6,
  electiveMax: 49,
  minorMin: 9,
  minorMax: 18,
  iqMin: 2,
  iqMax: 6,
  semesterTarget: 30,
}

/** Handbook Figure 2. Matched by title because the catalog uses newer module ids. */
const STAMM_TITLES = [
  'Advanced Artificial Intelligence', 'Algorithms II', 'Computer Architecture', 'Computer Graphics', 'Formal Systems',
  'Human Computer Interaction', 'IT Security', 'Robotics I - Introduction to Robotics', 'Software Engineering II', 'Telematics',
]

export const AREAS = [
  'Algorithm Engineering', 'Cryptography and Security', 'Data Science', 'Design of Embedded Systems and Computer Architectures',
  'Human-centred Machine Intelligence', 'Robotics and Automation', 'Software Engineering and Compiler Construction',
  'Telematics', 'Theoretical Foundations',
]

export type Kind = 'stamm' | 'seminar' | 'practical' | 'lecture'
/** Where a module's credits go: an area name, or one of these. */
export type Bucket = string
export const ELECTIVE = 'elective'
export const MINOR = 'minor'
export const IQ = 'iq'

const AREA_PREFIX = 'Area of Specialization: '
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const STAMM = new Set(STAMM_TITLES.map(norm))

export const moduleAreas = (m: Module): string[] =>
  m.fields.filter((f) => f.startsWith(AREA_PREFIX)).map((f) => f.slice(AREA_PREFIX.length))

const kindFromTitle = (title: string): Kind | null => {
  if (STAMM.has(norm(title))) return 'stamm'
  if (/\bseminar\b/i.test(title)) return 'seminar'
  if (/practical course|\bpraktikum|\blab\b|research practical|research project|practice of research/i.test(title)) return 'practical'
  return null
}

const kindFromNode = (title: string): Kind | null => {
  if (/advanced mandatory/i.test(title)) return 'stamm'
  if (/seminar/i.test(title)) return 'seminar'
  if (/practical/i.test(title)) return 'practical'
  return null
}

const treeKinds = new WeakMap<CoursesFile, Map<string, Kind>>()

/** Kind of modules that are the only module of an event filed under a seminar/practical/Stammmodul catalog node. */
function kindsFromTree(data: CoursesFile): Map<string, Kind> {
  let out = treeKinds.get(data)
  if (out) return out
  out = new Map()
  const walk = (nodes: CoursesFile['tree']) => nodes.forEach((n) => {
    const k = kindFromNode(n.title)
    if (k) for (const id of n.eventIds) {
      const mids = data.events[id]?.moduleIds ?? []
      if (mids.length === 1 && !out!.has(mids[0])) out!.set(mids[0], k)
    }
    walk(n.children)
  })
  walk(data.tree)
  treeKinds.set(data, out)
  return out
}

export const moduleKind = (data: CoursesFile, m: Module): Kind =>
  kindFromTitle(m.title) ?? kindsFromTree(data).get(m.id) ?? 'lecture'

export function bucketOptions(m: Module): Bucket[] {
  const areas = moduleAreas(m)
  const out: Bucket[] = [...areas]
  if (areas.length || m.fields.some((f) => f.startsWith('Elective Studies'))) out.push(ELECTIVE)
  if (m.fields.some((f) => f.startsWith('Minor Studies'))) out.push(MINOR)
  if (m.fields.some((f) => f.startsWith('Interdisciplinary'))) out.push(IQ)
  return out
}

export function bucketOf(state: UserState, data: CoursesFile, eventId: string): Bucket | null {
  const entry = state.selected[eventId]
  const ev = data.events[eventId]
  const mid = entry && ev ? chosenModule(entry, ev) : null
  const m = mid ? data.modules[mid] : null
  if (!m) return null
  const options = bucketOptions(m)
  if (entry.countAs && options.includes(entry.countAs)) return entry.countAs
  return options.find((b) => (state.areas ?? []).includes(b))
    ?? (options.includes(ELECTIVE) ? ELECTIVE : options.find((b) => b === MINOR || b === IQ) ?? null)
}

export interface AreaProgress {
  area: string
  cp: number
  lectureCp: number
  lectureMin: number
}

export interface Issue {
  key: string
  params?: Record<string, string | number>
}

export interface DegreeReport {
  areas: AreaProgress[]
  areaTotal: number
  stamm: { count: number; titles: string[] }
  seminarCp: number
  practicalCp: number
  electiveCp: number
  minorCp: number
  iqCp: number
  total: number
  issues: Issue[]
}

export interface Placed {
  eventId: string
  m: Module
  bucket: Bucket
}

/** Unique modules of the selection with the bucket each one counts in (first event wins for duplicates). */
export function placed(state: UserState, data: CoursesFile): Placed[] {
  const seen = new Set<string>()
  const out: Placed[] = []
  for (const id of Object.keys(state.selected)) {
    const ev = data.events[id]
    const mid = ev ? chosenModule(state.selected[id], ev) : null
    const m = mid ? data.modules[mid] : null
    const bucket = bucketOf(state, data, id)
    if (!m || m.ects === null || !bucket || seen.has(m.id)) continue
    seen.add(m.id)
    out.push({ eventId: id, m, bucket })
  }
  return out
}

export function degreeReport(state: UserState, data: CoursesFile): DegreeReport {
  const chosen = (state.areas ?? []).slice(0, 2)
  const items = placed(state, data)
  const withKind = items.map((x) => ({ ...x, kind: moduleKind(data, x.m) }))
  const sum = (pred: (x: (typeof withKind)[number]) => boolean) =>
    withKind.filter(pred).reduce((n, x) => n + (x.m.ects ?? 0), 0)
  const isCs = (b: Bucket) => b !== MINOR && b !== IQ

  const areas = chosen.map((area) => ({
    area,
    cp: sum((x) => x.bucket === area),
    lectureCp: sum((x) => x.bucket === area && x.kind === 'lecture'),
    lectureMin: RULES.areaLectureMinReduced[area] ?? RULES.areaLectureMin,
  }))
  const stammItems = withKind.filter((x) => x.kind === 'stamm' && isCs(x.bucket))
  const r: DegreeReport = {
    areas,
    areaTotal: sum((x) => AREAS.includes(x.bucket)),
    stamm: { count: stammItems.length, titles: stammItems.map((x) => x.m.title) },
    seminarCp: sum((x) => x.kind === 'seminar' && isCs(x.bucket)),
    practicalCp: sum((x) => x.kind === 'practical' && isCs(x.bucket)),
    electiveCp: sum((x) => x.bucket === ELECTIVE),
    minorCp: sum((x) => x.bucket === MINOR),
    iqCp: sum((x) => x.bucket === IQ),
    total: sum(() => true),
    issues: [],
  }

  const outside = withKind.filter((x) => AREAS.includes(x.bucket) && !chosen.includes(x.bucket))
  if (chosen.length === 2) for (const x of outside) r.issues.push({ key: 'deg.outsideAreas', params: { title: x.m.title, area: x.bucket } })
  if (r.seminarCp + r.practicalCp > RULES.spMax) r.issues.push({ key: 'deg.spOver', params: { n: r.seminarCp + r.practicalCp } })
  if (r.areaTotal > RULES.areasMax) r.issues.push({ key: 'deg.areaOver', params: { n: r.areaTotal } })
  if (r.electiveCp > RULES.electiveMax) r.issues.push({ key: 'deg.electiveOver', params: { n: r.electiveCp } })
  if (r.minorCp > RULES.minorMax) r.issues.push({ key: 'deg.minorOver', params: { n: r.minorCp } })
  if (r.stamm.count > RULES.stamm) r.issues.push({ key: 'deg.stammExtra', params: { n: r.stamm.count } })
  return r
}

/** Areas ranked by the credits the current selection could contribute to each, for choosing areas. */
export function areaSuggestions(state: UserState, data: CoursesFile): { area: string; cp: number }[] {
  const cp = new Map<string, number>()
  for (const { m } of placed(state, data)) {
    for (const a of moduleAreas(m)) cp.set(a, (cp.get(a) ?? 0) + (m.ects ?? 0))
  }
  return [...cp].map(([area, n]) => ({ area, cp: n })).sort((a, b) => b.cp - a.cp || a.area.localeCompare(b.area))
}
