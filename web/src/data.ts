import type { ChangesFile, CoursesFile, StatusFile } from './types'

export async function loadData(): Promise<{ courses: CoursesFile; changes: ChangesFile; status: StatusFile | null }> {
  const get = async <T,>(name: string): Promise<T> => {
    const res = await fetch(`./data/${name}`, { cache: 'no-cache' })
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`)
    return res.json() as Promise<T>
  }
  const [courses, changes, status] = await Promise.all([
    get<CoursesFile>('courses.json'),
    get<ChangesFile>('changes.json'),
    get<StatusFile>('status.json').catch(() => null),
  ])
  return { courses, changes, status }
}
