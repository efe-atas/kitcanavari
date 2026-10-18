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
}

export type Lang = 'tr' | 'en'

export interface UserState {
  version: 1
  selected: Record<string, SelectedEntry>
  lang: Lang
  lastSeenScrapedAt: string
}
