import { validateCareer } from './logic/careerSchema'
import type { CareerData, ChangesFile, CoursesFile, HandbookFile, LensesFile, RolesFile, SkillsFile, StatusFile } from './types'

export async function loadData(): Promise<{
  courses: CoursesFile; changes: ChangesFile; status: StatusFile | null; handbook: HandbookFile | null; career: CareerData | null
}> {
  const get = async <T,>(name: string): Promise<T> => {
    const res = await fetch(`./data/${name}`, { cache: 'no-cache' })
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`)
    return res.json() as Promise<T>
  }
  const [courses, changes, status, handbook, career] = await Promise.all([
    get<CoursesFile>('courses.json'),
    get<ChangesFile>('changes.json'),
    get<StatusFile>('status.json').catch(() => null),
    get<HandbookFile>('handbook.json').catch(() => null),
    Promise.all([get<SkillsFile>('career/skills.json'), get<RolesFile>('career/roles.json'), get<LensesFile>('career/lenses.json')])
      .then(([skills, roles, lenses]): CareerData | null => {
        const career = { skills, roles, lenses }
        const errors = validateCareer(career)
        if (!errors.length) return career
        console.warn(`career data ignored: ${errors.slice(0, 5).join('; ')}`)
        return null
      })
      .catch(() => null),
  ])
  return { courses, changes, status, handbook, career }
}
