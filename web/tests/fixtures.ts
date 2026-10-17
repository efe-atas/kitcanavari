import type { Day, Event, Module, SelectedEntry, Session, Slot } from '../src/types'

export const slot = (day: Day | null, start: string | null, end: string | null, rhythm = 'weekly', room: string | null = 'R1'): Slot =>
  ({ day, start, end, room, rhythm, firstDate: null, count: null })

export const session = (date: string, start: string, end: string, cancelled = false): Session =>
  ({ date, start, end, room: 'R1', cancelled })

export const ev = (id: string, slots: Slot[] = [], extra: Partial<Event> = {}): Event => ({
  id, number: `N-${id}`, title: `Title ${id}`, type: 'Lecture (V)', typeCode: 'V', language: 'English',
  sws: 2, format: 'On-Site', contentText: '', iliasUrl: null, kitUrl: '', catalogPaths: [],
  lecturers: [{ name: 'Prof. Lecturer', unit: 'U' }], slots, sessions: [], moduleIds: ['M1'], fingerprint: `fp-${id}`,
  ...extra,
})

export const mod = (id: string, ects: number | null, part: string | null = 'Elective Studies'): Module => ({
  id, title: `Module ${id}`, ects, recurrence: null, language: null, level: null, assignment: null, part,
  fields: [], bricks: [], description: { objectives: null, content: null, prerequisites: null, exam: null, workload: null },
  kitUrl: '',
})

export const entry = (moduleId: string | null = null, enabledSlots = [0, 1, 2, 3]): SelectedEntry =>
  ({ enabledSlots, moduleId, ackFingerprint: '' })

export const sel = (...ids: string[]): Record<string, SelectedEntry> =>
  Object.fromEntries(ids.map((id) => [id, entry()]))
