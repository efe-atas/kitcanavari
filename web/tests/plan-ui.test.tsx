import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { STORAGE_KEY } from '../src/store'
import { makeChanges, makeCourses, makeHandbook } from './appdata'
import { makeCareer } from './careerdata'

const loadData = vi.fn()
vi.mock('../src/data', () => ({ loadData: () => loadData() }))
const { App } = await import('../src/ui/App')

const AREAS = ['Human-centred Machine Intelligence', 'Cryptography and Security']
const saved = () => JSON.parse(localStorage.getItem(STORAGE_KEY)!)
const setState = (extra: object) =>
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, selected: {}, lang: 'en', lastSeenScrapedAt: '', ...extra }))
const roadmap = (modules: object) => ({ roadmap: { terms: ['WS26', 'SS27', 'WS27', 'SS28'], modules, notes: {} } })
const table = () => screen.findByRole('table')
/** The table cell of a row (by its header text) and a term column (by index: 0 = prior). */
async function cell(rowText: string | RegExp, col: number) {
  const t = await table()
  const row = within(t).getAllByRole('row').find((r) => within(r).queryAllByText(rowText).length)!
  return within(row).getAllByRole('cell')[col]
}

beforeEach(() => {
  localStorage.clear()
  setState({ areas: AREAS })
  location.hash = '#/'
  loadData.mockResolvedValue({ courses: makeCourses(), changes: makeChanges(), handbook: makeHandbook(), career: makeCareer() })
})
afterEach(cleanup)

describe('plan page', () => {
  test('places each course by where it counts and when, with totals', async () => {
    setState({ areas: AREAS, selected: { sec: { enabledSlots: [0], moduleId: 'M3', ackFingerprint: '' } },
      ...roadmap({ H1: { term: 'prior', status: 'passed', countAs: null, grade: 1.7 }, H2: { term: 'SS27', status: 'planned', countAs: null, grade: null } }) })
    render(<App />)
    expect(within(await cell(AREAS[0], 0)).getByText('Reinforcement Learning')).toBeTruthy()
    expect(within(await cell(AREAS[1], 1)).getByText('Module M3')).toBeTruthy()
    expect(within(await cell(AREAS[1], 2)).getByText('Seminar: Post-Quantum Cryptography')).toBeTruthy()
    const status = screen.getByRole('region', { name: 'Where you stand' })
    expect(within(status).getByText('17')).toBeTruthy()
  })

  test('without areas the first step asks for them, and picking one names the row', async () => {
    setState({})
    render(<App />)
    await screen.findByText(/Pick your two areas/)
    fireEvent.change(screen.getByRole('combobox', { name: '1st area of specialization' }), { target: { value: AREAS[0] } })
    await waitFor(() => expect(saved().areas).toEqual([AREAS[0]]))
    expect(within(await table()).getByText(AREAS[0])).toBeTruthy()
  })

  test('a next step opens the add panel for the right cell', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /more/ }))
    const link = (await screen.findAllByRole('link', { name: /Add a seminar/ }))[0]
    expect(link.getAttribute('href')).toBe('#/add/SS27/elective/seminar')
  })

  test('the + of a cell opens the add panel, highlights the cell, and adding fills it', async () => {
    render(<App />)
    const target = await cell('Elective studies', 2)
    location.hash = within(target).getByRole('link', { name: /Elective studies · SS 27: add a course/ }).getAttribute('href')!
    const panel = await screen.findByRole('complementary', { name: 'Add a course · SS 27 · Elective studies' })
    expect(target.className).toContain('is-target')
    fireEvent.click(within(panel).getByRole('button', { name: 'Add: Seminar: Post-Quantum Cryptography' }))
    await waitFor(() => expect(saved().roadmap.modules.H2).toMatchObject({ term: 'SS27', countAs: 'elective' }))
    expect(within(await cell('Elective studies', 2)).getByText('Seminar: Post-Quantum Cryptography')).toBeTruthy()
  })

  test('adding in the current term puts its courses in the weekly timetable', async () => {
    location.hash = '#/add/WS26/area1'
    render(<App />)
    const panel = await screen.findByRole('complementary')
    fireEvent.click(within(panel).getByRole('button', { name: 'Add: Module M3' }))
    await waitFor(() => expect(Object.keys(saved().selected).sort()).toEqual(['ml', 'sec']))
    location.hash = '#/week'
    const week = await screen.findByRole('complementary', { name: 'Weekly timetable · WS 26/27' })
    expect(within(week).getAllByText('IT Security').length).toBeGreaterThan(0)
  })

  test('the course detail edits status, grade and term, and removes', async () => {
    setState({ areas: AREAS, ...roadmap({ H1: { term: 'SS27', status: 'planned', countAs: null, grade: null } }) })
    render(<App />)
    fireEvent.click(within(await cell(AREAS[0], 2)).getByRole('link', { name: /Reinforcement Learning/ }))
    const panel = await screen.findByRole('complementary', { name: 'Reinforcement Learning' })
    fireEvent.click(within(panel).getByRole('button', { name: 'Passed' }))
    await waitFor(() => expect(saved().roadmap.modules.H1.status).toBe('passed'))
    const grade = await within(panel).findByLabelText('Grade')
    fireEvent.input(grade, { target: { value: '1,3' } })
    fireEvent.blur(grade)
    await waitFor(() => expect(saved().roadmap.modules.H1.grade).toBe(1.3))
    fireEvent.change(within(panel).getByLabelText('Term'), { target: { value: 'WS27' } })
    await waitFor(() => expect(saved().roadmap.modules.H1.term).toBe('WS27'))
    fireEvent.click(within(panel).getByRole('button', { name: 'Remove from plan' }))
    await waitFor(() => expect(saved().roadmap.modules).toEqual({}))
    await waitFor(() => expect(screen.queryByRole('complementary')).toBeNull())
  })

  test('Escape closes the panel', async () => {
    location.hash = '#/week'
    render(<App />)
    await screen.findByRole('complementary')
    await waitFor(() => expect(document.activeElement?.id).toBe('drawer-title')) // the panel is set up
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('complementary')).toBeNull())
    expect(location.hash).toBe('#/')
  })

  test('old tab links still land somewhere sensible', async () => {
    location.hash = '#/glossary/stamm'
    render(<App />)
    await screen.findByRole('complementary', { name: 'Terms and rules' })
    expect(location.hash).toBe('#/info/stamm')
    location.hash = '#/schedule'
    await screen.findByRole('complementary', { name: /Weekly timetable/ })
    location.hash = '#/catalog'
    await screen.findByRole('complementary', { name: /Add a course · WS 26\/27/ })
  })

  test('following a goal shows it in the top bar', async () => {
    location.hash = '#/goal'
    render(<App />)
    const panel = await screen.findByRole('complementary', { name: 'Goal: career paths' })
    fireEvent.click(within(panel).getByRole('button', { name: /^security · Big Tech/ }))
    fireEvent.click(await within(panel).findByRole('button', { name: 'Follow' }))
    await screen.findByRole('link', { name: /Goal: security · Big Tech/ })
  })

  test('without career data there is no goal button', async () => {
    loadData.mockResolvedValue({ courses: makeCourses(), changes: makeChanges(), handbook: makeHandbook(), career: null })
    render(<App />)
    await table()
    expect(screen.queryByRole('link', { name: /Goal|Pick a goal/ })).toBeNull()
  })

  test('a module found nowhere shows in its own row', async () => {
    setState({ areas: AREAS, ...roadmap({ GONE: { term: 'SS27', status: 'planned', countAs: null, grade: null } }) })
    render(<App />)
    expect(within(await cell('Counts elsewhere', 2)).getByText('GONE')).toBeTruthy()
  })
})
