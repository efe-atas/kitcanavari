import type { ChangesFile, CoursesFile } from '../src/types'
import { ev, mod, session, slot } from './fixtures'

export const daysAgo = (n: number) => new Date(Date.now() - n * 86400_000).toISOString().replace(/\.\d+Z$/, 'Z')

export const makeCourses = (scrapedAt = daysAgo(0)): CoursesFile => ({
  meta: { scrapedAt, term: 'WS 26/27', termGuid: '', spo: '88-979-H-2025', warnings: [] },
  tree: [{ id: 'F1', title: '1.7 Practical Courses', children: [], eventIds: ['gpu', 'ml'] },
    { id: 'F2', title: '1.6 Seminars', children: [], eventIds: ['sec'] }],
  events: {
    gpu: ev('gpu', [slot('Tue', '14:00', '15:30', 'weekly', '50.34 Raum 148')], {
      number: '2424283', title: 'Practical course GPU-Computing', typeCode: 'P', type: 'Practical course (P)',
      lecturers: [{ name: 'Prof. Dr.-Ing. Carsten Dachsbacher', unit: 'IVD' }], moduleIds: ['M1'],
      sessions: [session('2026-10-27', '14:00', '15:30'), session('2026-11-03', '14:00', '15:30', true)],
      contentText: 'Beim GPU-Computing werden eine CPU und ein Grafikprozessor gemeinsam eingesetzt.',
    }),
    ml: ev('ml', [slot('Tue', '15:00', '16:30')], {
      number: '2424281', title: 'Practical Course Machine Learning', typeCode: 'P',
      lecturers: [{ name: 'Hanebeck', unit: '' }], moduleIds: ['M2', 'M3'],
    }),
    sec: ev('sec', [slot('Fri', '09:45', '11:15')], {
      number: '2400010', title: 'IT Security', typeCode: 'VÜ', lecturers: [{ name: 'Müller-Quade', unit: '' }], moduleIds: ['M3'],
    }),
  },
  modules: { M1: mod('M1', 6), M2: mod('M2', 4), M3: mod('M3', 8, 'Area of Specialization') },
})

export const makeChanges = (): ChangesFile => ({ entries: [] })
