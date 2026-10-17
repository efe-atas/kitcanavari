import type { ChangesFile, CoursesFile } from './types'

export async function loadData(): Promise<{ courses: CoursesFile; changes: ChangesFile }> {
  const get = async <T,>(name: string): Promise<T> => {
    const res = await fetch(`./data/${name}`, { cache: 'no-cache' })
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`)
    return res.json() as Promise<T>
  }
  const [courses, changes] = await Promise.all([get<CoursesFile>('courses.json'), get<ChangesFile>('changes.json')])
  return { courses, changes }
}
