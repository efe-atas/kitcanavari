// Attendance and participation hints, read from the course page text and module descriptions in the catalog data,
// plus a few statements that only the module handbook (09/09/2026, partial achievements) contains.
import type { CoursesFile, Event } from '../types'

export type AttendanceLevel = 'required' | 'kickoff' | 'unknown'
export type HintKind = 'required' | 'kickoff' | 'registration'
export type HintSource = 'course' | 'module' | 'handbook'

export interface Hint {
  kind: HintKind
  text: string
  source: HintSource
}

export interface Attendance {
  level: AttendanceLevel
  hints: Hint[]
  /** Which general rule of thumb applies when the sources say nothing explicit. */
  general: 'small' | 'lecture'
}

const REQUIRED = /compulsory attendance|attendance (?:is )?(?:mandatory|compulsory|required|obligatory)|mandatory attendance|attendance during the attendance phase|Anwesenheitspflicht|Anwesenheit (?:ist )?(?:Pflicht|verpflichtend|erforderlich)|must (?:attend|be present)|presence is (?:mandatory|required)|participation is (?:mandatory|compulsory|required)|regularly and successfully participate|active participation in the class is expected/i
const KICKOFF = /kick-?off|Vorbesprechung|first meeting|introductory (?:session|meeting|event|assignment)|first lecture week|first session|topics will be assigned/i
const REGISTRATION = /(?:number of (?:places|participants) is limited|places are limited|places is limited|limited number of participants|participation slots are limited|registration (?:through|via|on) (?:ILIAS|the website)|register (?:on|via|using) |Campus Plus|application period|secure your spot)/i

/** Statements from partial-achievement pages of the handbook, which the catalog data does not include. */
const HANDBOOK: Record<string, Hint[]> = {
  'M-INFO-103306': [{ kind: 'registration', source: 'handbook', text: 'Students may redraw from their participation until the end of the second seminar date.' }],
}

const sentences = (text: string | null | undefined): string[] =>
  (text ?? '').split(/(?<!\b(?:approx|min|max|ca|hrs|e\.g|i\.e|No|Para|Abs|vs|Dr|Prof)\.)(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 8 && s.length < 400)

function scan(text: string | null | undefined, source: HintSource): Hint[] {
  const out: Hint[] = []
  for (const s of sentences(text)) {
    const kind: HintKind | null = REQUIRED.test(s) ? 'required' : KICKOFF.test(s) ? 'kickoff' : REGISTRATION.test(s) ? 'registration' : null
    if (kind) out.push({ kind, text: s, source })
  }
  return out
}

const SMALL_TYPES = /^(S|P|Pg)$/

export function attendanceOf(data: CoursesFile, ev: Event): Attendance {
  const modules = ev.moduleIds.map((id) => data.modules[id]).filter(Boolean)
  const all = [
    ...scan(ev.contentText, 'course'),
    ...modules.flatMap((m) => [
      ...scan(m.description.workload, 'module'),
      ...scan(m.description.exam, 'module'),
      ...scan(m.description.prerequisites, 'module'),
    ]),
    ...modules.flatMap((m) => HANDBOOK[m.id] ?? []),
  ]
  const seen = new Set<string>()
  const hints = all.filter((h) => !seen.has(h.text) && seen.add(h.text))
  const level: AttendanceLevel = hints.some((h) => h.kind === 'required') ? 'required'
    : hints.some((h) => h.kind === 'kickoff') ? 'kickoff' : 'unknown'
  return { level, hints, general: SMALL_TYPES.test(ev.typeCode) ? 'small' : 'lecture' }
}
