import { skillPoints, type SkillPoints } from '../../logic/career'
import type { ModuleRow } from '../../logic/handbook'
import { roadmapEntries } from '../../logic/roadmap'
import type { CareerData, Lang, UserState } from '../../types'

/** Skill points of the roadmap: planned (passed + planned) and now (passed only). */
export function pointsOf(state: UserState, career: CareerData, rows: ModuleRow[]): { all: SkillPoints; now: SkillPoints } {
  const ects = new Map(rows.map((r) => [r.id, r.ects]))
  const get = (id: string) => ects.get(id) ?? null
  const entries = roadmapEntries(state)
  return { all: skillPoints(entries, career, get, ['passed', 'planned']), now: skillPoints(entries, career, get, ['passed']) }
}

export const roleTitle = (career: CareerData, id: string, lang: Lang) => career.roles.roles.find((r) => r.id === id)?.title[lang] ?? id
export const lensTitle = (career: CareerData, id: string, lang: Lang) => career.lenses.lenses.find((l) => l.id === id)?.title[lang] ?? id
export const pathTitle = (career: CareerData, role: string, lens: string, lang: Lang) =>
  `${roleTitle(career, role, lang)} · ${lensTitle(career, lens, lang)}`
