// Mirrors spec §4 (data/courses.json, data/changes.json) and the per-user state of spec §6.

export type Day = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'

export interface Slot {
  day: Day | null
  start: string | null
  end: string | null
  room: string | null
  rhythm: string
  firstDate: string | null
  count: number | null
}

export interface Session {
  date: string
  start: string
  end: string
  room: string | null
  cancelled: boolean
  /** Index into Event.slots of the appointment series this date belongs to. */
  slot?: number | null
}

export interface Lecturer {
  name: string
  unit: string
}

export interface Event {
  id: string
  number: string
  title: string
  type: string
  typeCode: string
  language: string | null
  sws: number | null
  format: string | null
  contentText: string
  iliasUrl: string | null
  kitUrl: string
  catalogPaths: string[][]
  lecturers: Lecturer[]
  slots: Slot[]
  sessions: Session[]
  moduleIds: string[]
  fingerprint: string
}

export interface ModuleDescription {
  objectives: string | null
  content: string | null
  prerequisites: string | null
  exam: string | null
  workload: string | null
}

export interface Module {
  id: string
  title: string
  ects: number | null
  recurrence: string | null
  language: string | null
  level: string | null
  assignment: string | null
  part: string | null
  fields: string[]
  bricks: { id: string; title: string; ects: number | null }[]
  description: ModuleDescription
  kitUrl: string
}

export interface FieldNode {
  id: string
  title: string
  children: FieldNode[]
  eventIds: string[]
}

export type Recurrence = 'winter' | 'summer' | 'each' | 'irregular'

/** One module of the module handbook (data/handbook.json), parsed from the PDF by hand. */
export interface HandbookModule {
  id: string
  title: string
  ects: number | null
  recurrence: Recurrence
  language: string | null
  level: number | null
  fields: string[]
  coordinators: string[]
  bricks: { id: string; title: string; ects: number | null; term: string }[]
  competenceGoals: string | null
  content: string | null
  prerequisites: string | null
  recommendations: string | null
}

export interface HandbookFile {
  meta: { source: string; asOf: string; parsedAt: string }
  modules: Record<string, HandbookModule>
}

export type SkillId =
  | 'algo' | 'distsys' | 'sysperf' | 'mltheory' | 'dl' | 'nlp' | 'cv' | 'robotics'
  | 'security' | 'crypto' | 'embedded' | 'swe' | 'data' | 'formal' | 'research'

export interface Bilingual { tr: string; en: string }

/** Curated by Claude by hand (spec §1): module → skill → [score 0–3, one-sentence reason]. */
export interface SkillsFile {
  meta: { curatedAt: string; handbookAsOf: string }
  modules: Record<string, Partial<Record<SkillId, [number, string]>>>
}

export interface Role {
  id: string
  title: Bilingual
  summary: Bilingual
  /** Sum to 1. */
  weights: Partial<Record<SkillId, number>>
  /** Skill points (score × ECTS / 6) that count as full coverage. */
  targets: Partial<Record<SkillId, number>>
}

export interface RolesFile { roles: Role[] }

export interface SalaryBand { role: string; band: string; source: string; asOf: string }

export interface Lens {
  id: string
  title: Bilingual
  /** Unlisted skills: 1. */
  multipliers: Partial<Record<SkillId, number>>
  cities: string[]
  salary: SalaryBand[]
  interview: Bilingual
  offCourse: { tr: string[]; en: string[] }
  downsides: { tr: string[]; en: string[] }
}

export interface LensesFile { lenses: Lens[] }

export interface CareerData { skills: SkillsFile; roles: RolesFile; lenses: LensesFile }

export type ChangeKind =
  | 'added' | 'removed' | 'slot_changed' | 'room_changed'
  | 'session_cancelled' | 'session_added' | 'session_removed'
  | 'content_changed' | 'lecturers_changed' | 'modules_changed'

export interface Change {
  at: string
  eventId: string
  eventTitle: string
  kind: ChangeKind
  summary: string
  before?: unknown
  after?: unknown
}

export interface CoursesFile {
  meta: { scrapedAt: string; term: string; termGuid: string; spo: string; warnings: string[] }
  tree: FieldNode[]
  events: Record<string, Event>
  modules: Record<string, Module>
}

export interface ChangesFile {
  entries: Change[]
}

/** Written on every successful scrape, even when the catalog did not change. */
export interface StatusFile {
  checkedAt: string
}

export interface SelectedEntry {
  enabledSlots: number[]
  moduleId: string | null
  ackFingerprint: string
  /** Title at the time of adding, shown if the event later disappears from the catalog. */
  title?: string
  /** Where the module's credits count: an area of specialization, 'elective', 'minor' or 'iq'. Unset = default. */
  countAs?: string | null
}

export type Lang = 'tr' | 'en'

export type ModuleStatus = 'planned' | 'passed' | 'failed' | 'dropped'

/** A module's place in the multi-term roadmap. */
export interface RoadmapEntry {
  /** 'WS26', 'SS27', … or 'prior'. */
  term: string
  status: ModuleStatus
  countAs: string | null
  /** 1.0–4.0 when passed and graded. */
  grade: number | null
}

export interface Roadmap {
  terms: string[]
  /** Entries the user set; modules of this term's weekly plan are added as planned on top (see roadmapEntries). */
  modules: Record<string, RoadmapEntry>
  notes: Record<string, string>
}

export interface UserState {
  version: 1
  selected: Record<string, SelectedEntry>
  lang: Lang
  lastSeenScrapedAt: string
  /** Chosen areas of specialization (at most two). */
  areas?: string[]
  /** Colour theme; light when unset. */
  theme?: 'light' | 'dark'
  roadmap?: Roadmap
}
