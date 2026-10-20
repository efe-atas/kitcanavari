import { expect, test } from 'vitest'
import { attendanceOf } from '../src/logic/attendance'
import type { CoursesFile } from '../src/types'
import { ev, mod } from './fixtures'

const data = (contentText: string, workload: string | null = null, typeCode = 'S', moduleId = 'M1'): CoursesFile => ({
  meta: { scrapedAt: '', term: '', termGuid: '', spo: '', warnings: [] },
  tree: [],
  events: { e: ev('e', [], { contentText, typeCode, moduleIds: [moduleId] }) },
  modules: { [moduleId]: { ...mod(moduleId, 3), description: { objectives: null, content: null, prerequisites: null, exam: null, workload } } },
})

test('explicit statements make attendance required', () => {
  const d = data('Additional Information Attendance is mandatory, as active participation in discussions is required.', null, 'VÜ')
  const a = attendanceOf(d, d.events.e)
  expect(a.level).toBe('required')
  expect(a.hints[0]).toMatchObject({ kind: 'required', source: 'course' })
  expect(a.general).toBe('lecture')
})

test('compulsory attendance in the module workload counts too', () => {
  const d = data('', 'approx. 10 hrs. preparation of presentation approx. 10 hrs. compulsory attendance')
  expect(attendanceOf(d, d.events.e)).toMatchObject({ level: 'required', general: 'small' })
})

test('workload "attendance time" alone is not a requirement', () => {
  const d = data('Topics will be assigned in the first meeting in October.', 'Attendance time: 15h. Self-study: 45h.')
  const a = attendanceOf(d, d.events.e)
  expect(a.level).toBe('kickoff')
  expect(a.hints.map((h) => h.kind)).toEqual(['kickoff'])
})

test('registration hints are collected without raising the level', () => {
  const d = data('Since the number of places is limited, registration through ILIAS is required.')
  const a = attendanceOf(d, d.events.e)
  expect(a.level).toBe('unknown')
  expect(a.hints).toEqual([{ kind: 'registration', source: 'course', text: 'Since the number of places is limited, registration through ILIAS is required.' }])
})

test('handbook-only statements are added by module id', () => {
  const d = data('', null, 'S', 'M-INFO-103306')
  expect(attendanceOf(d, d.events.e).hints[0]).toMatchObject({ kind: 'registration', source: 'handbook' })
})

test('abbreviations do not split sentences and "(attendance mandatory)" counts', () => {
  const d = data('Attendance during the attendance phase (min. 42 hours) is part of the work. 01.10.2026 Kick-Off-Event (attendance mandatory) Campus North.', null, 'P')
  const a = attendanceOf(d, d.events.e)
  expect(a.hints[0].text).toBe('Attendance during the attendance phase (min. 42 hours) is part of the work.')
  expect(a.hints.every((h) => h.kind === 'required')).toBe(true)
})
