// Degree rules of the Computer Science M.Sc., SPO 88-979-H-2025 (module handbook of 09/09/2026, WS 26/27, §1.3, §2, §3).
import type { CoursesFile, HandbookFile, Module, UserState } from '../types'
import { chosenModule } from './ects'
import { roadmapEntries } from './roadmap'

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

/** Handbook Figure 2 (09/09/2026). Matched by id, and by title in case a module gets a new id. */
const STAMM_IDS = new Set([
  'M-INFO-107201', 'M-INFO-100818', 'M-INFO-100856', 'M-INFO-100799', 'M-INFO-107166', 'M-INFO-106998',
  'M-INFO-107169', 'M-INFO-107676', 'M-INFO-107162', 'M-INFO-107235', 'M-INFO-107243',
])
const STAMM_TITLES = [
  'Algorithms II', 'Computer Architecture', 'Computer Graphics', 'Formal Systems', 'Human Computer Interaction', 'IT Security',
  'Machine Learning - Foundations and Algorithms', 'Multimodal Artificial Intelligence', 'Robotics I - Introduction to Robotics',
  'Software Engineering II', 'Telematics',
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

export const moduleAreas = (m: Pick<Module, 'fields'>): string[] =>
  m.fields.filter((f) => f.startsWith(AREA_PREFIX)).map((f) => f.slice(AREA_PREFIX.length))

const MINOR_PREFIX = 'Minor Studies: '

/** Minor subjects a module belongs to, e.g. "Mathematics". */
export const moduleMinors = (m: Pick<Module, 'fields'>): string[] =>
  m.fields.filter((f) => f.startsWith(MINOR_PREFIX)).map((f) => f.slice(MINOR_PREFIX.length).trim())

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

export const moduleKind = (data: CoursesFile, m: Pick<Module, 'id' | 'title'>): Kind =>
  (STAMM_IDS.has(m.id) ? 'stamm' : null) ?? kindFromTitle(m.title) ?? kindsFromTree(data).get(m.id) ?? 'lecture'

export function bucketOptions(m: Pick<Module, 'fields'>): Bucket[] {
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
  // The roadmap entry is the single place a module's choice lives once it is stored there.
  return defaultBucket(m.fields, state.areas ?? [], roadmapEntries(state)[m.id]?.countAs ?? entry.countAs ?? null)
}

/** Where a module counts: a valid explicit choice, else a chosen area, else elective, minor or IQ. */
export function defaultBucket(fields: string[], chosen: string[], countAs: string | null): Bucket | null {
  const options = bucketOptions({ fields })
  if (countAs && options.includes(countAs)) return countAs
  return options.find((b) => chosen.includes(b))
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

/** A module counted towards the degree. */
export interface DegreeItem {
  id: string
  title: string
  ects: number
  fields: string[]
  kind: Kind
  bucket: Bucket
}

export function degreeReport(state: UserState, data: CoursesFile): DegreeReport {
  const items = placed(state, data).map(({ m, bucket }): DegreeItem =>
    ({ id: m.id, title: m.title, ects: m.ects ?? 0, fields: m.fields, kind: moduleKind(data, m), bucket }))
  return reportFromItems(items, state.areas ?? [])
}

export function reportFromItems(items: DegreeItem[], chosenAreas: string[]): DegreeReport {
  const chosen = chosenAreas.slice(0, 2)
  const sum = (pred: (x: DegreeItem) => boolean) => items.filter(pred).reduce((n, x) => n + x.ects, 0)
  const isCs = (b: Bucket) => b !== MINOR && b !== IQ

  const areas = chosen.map((area) => ({
    area,
    cp: sum((x) => x.bucket === area),
    lectureCp: sum((x) => x.bucket === area && x.kind === 'lecture'),
    lectureMin: RULES.areaLectureMinReduced[area] ?? RULES.areaLectureMin,
  }))
  const stammItems = items.filter((x) => x.kind === 'stamm' && isCs(x.bucket))
  const r: DegreeReport = {
    areas,
    areaTotal: sum((x) => AREAS.includes(x.bucket)),
    stamm: { count: stammItems.length, titles: stammItems.map((x) => x.title) },
    seminarCp: sum((x) => x.kind === 'seminar' && isCs(x.bucket)),
    practicalCp: sum((x) => x.kind === 'practical' && isCs(x.bucket)),
    electiveCp: sum((x) => x.bucket === ELECTIVE),
    minorCp: sum((x) => x.bucket === MINOR),
    iqCp: sum((x) => x.bucket === IQ),
    total: sum(() => true),
    issues: [],
  }

  const outside = items.filter((x) => AREAS.includes(x.bucket) && !chosen.includes(x.bucket))
  if (chosen.length === 2) for (const x of outside) r.issues.push({ key: 'deg.outsideAreas', params: { title: x.title, area: x.bucket } })
  if (r.seminarCp + r.practicalCp > RULES.spMax) r.issues.push({ key: 'deg.spOver', params: { n: r.seminarCp + r.practicalCp } })
  if (r.areaTotal > RULES.areasMax) r.issues.push({ key: 'deg.areaOver', params: { n: r.areaTotal } })
  if (r.electiveCp > RULES.electiveMax) r.issues.push({ key: 'deg.electiveOver', params: { n: r.electiveCp } })
  if (r.minorCp > RULES.minorMax) r.issues.push({ key: 'deg.minorOver', params: { n: r.minorCp } })
  if (r.stamm.count > RULES.stamm) r.issues.push({ key: 'deg.stammExtra', params: { n: r.stamm.count } })
  const minors = [...new Set(items.filter((x) => x.bucket === MINOR).flatMap((x) => moduleMinors(x)))]
  if (minors.length > 1) r.issues.push({ key: 'deg.twoMinors', params: { minors: minors.join(', ') } })
  return r
}

export interface RoadmapReport {
  /** Passed modules only. */
  done: DegreeReport
  /** Passed and planned. */
  all: DegreeReport
  gpa: number | null
  gradedCp: number
  /** Roadmap ids found in neither the handbook nor the catalog. */
  unknown: string[]
}

/** The whole degree over every term of the roadmap (spec §4). */
export function roadmapReport(state: UserState, courses: CoursesFile, handbook: HandbookFile | null): RoadmapReport {
  const chosen = state.areas ?? []
  const done: DegreeItem[] = []
  const all: DegreeItem[] = []
  const unknown: string[] = []
  let weighted = 0
  let gradedCp = 0
  for (const [id, e] of Object.entries(roadmapEntries(state))) {
    if (e.status !== 'passed' && e.status !== 'planned') continue
    const info = handbook?.modules[id] ?? courses.modules[id]
    if (!info) {
      unknown.push(id)
      continue
    }
    const bucket = defaultBucket(info.fields, chosen, e.countAs)
    if (info.ects === null || !bucket) continue
    const item: DegreeItem = { id, title: info.title, ects: info.ects, fields: info.fields, kind: moduleKind(courses, info), bucket }
    all.push(item)
    if (e.status === 'passed') {
      done.push(item)
      if (e.grade !== null) {
        weighted += e.grade * info.ects
        gradedCp += info.ects
      }
    }
  }
  return {
    done: reportFromItems(done, chosen),
    all: reportFromItems(all, chosen),
    // KIT keeps only the first decimal of an overall grade, without rounding (the epsilon absorbs float noise).
    gpa: gradedCp ? Math.floor((weighted / gradedCp) * 10 + 1e-9) / 10 : null,
    gradedCp,
    unknown,
  }
}

/** Areas ranked by the credits the current selection could contribute to each, for choosing areas. */
export function areaSuggestions(state: UserState, data: CoursesFile): { area: string; cp: number }[] {
  const cp = new Map<string, number>()
  for (const { m } of placed(state, data)) {
    for (const a of moduleAreas(m)) cp.set(a, (cp.get(a) ?? 0) + (m.ects ?? 0))
  }
  return [...cp].map(([area, n]) => ({ area, cp: n })).sort((a, b) => b.cp - a.cp || a.area.localeCompare(b.area))
}
