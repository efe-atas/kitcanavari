import type { CareerData, Lens, Role } from '../src/types'

const text = (s: string) => ({ tr: s, en: s })
const ROLE_IDS = ['ml-eng', 'research-sci', 'data-sci', 'backend', 'quant', 'security', 'robotics', 'embedded', 'architect', 'academia']
const LENS_IDS = ['bigtech', 'quant', 'ailab', 'industry', 'startup', 'academia']

const role = (id: string, weights: Role['weights'], targets: Role['targets']): Role =>
  ({ id, title: text(id === 'ml-eng' ? 'ML Engineer' : id), summary: text(`${id} summary`), weights, targets })
const lens = (id: string, multipliers: Lens['multipliers'] = {}): Lens => ({
  id, title: text(id === 'bigtech' ? 'Big Tech' : id), multipliers, cities: ['Zürich'],
  salary: id === 'bigtech' ? [{ role: 'ml-eng', band: '€70–90k', source: 'https://example.org/salary', asOf: '2026-10' }] : [],
  interview: text('LeetCode'), offCourse: { tr: ['Staj'], en: ['Internship'] }, downsides: { tr: ['Rekabet'], en: ['Competition'] },
})

/** A small, valid career dataset matching makeHandbook()/makeCourses() module ids. */
export const makeCareer = (): CareerData => ({
  skills: {
    meta: { curatedAt: '2026-10-22', handbookAsOf: '2026-09-09' },
    modules: {
      H1: { mltheory: [3, 'RL theory.'], dl: [3, 'Deep RL.'], robotics: [2, 'Robot control.'] },
      H2: { crypto: [3, 'Post-quantum schemes.'], research: [2, 'Seminar.'] },
      M3: { security: [3, 'Security basics.'], crypto: [2, 'Some crypto.'] },
    },
  },
  roles: {
    roles: ROLE_IDS.map((id) => id === 'ml-eng'
      ? role(id, { dl: 0.5, mltheory: 0.3, swe: 0.2 }, { dl: 6, mltheory: 6, swe: 6 })
      : id === 'security'
        ? role(id, { security: 0.6, crypto: 0.4 }, { security: 6, crypto: 6 })
        : role(id, { algo: 1 }, { algo: 6 })),
  },
  lenses: { lenses: LENS_IDS.map((id) => (id === 'bigtech' ? lens(id, { swe: 2 }) : lens(id))) },
})
