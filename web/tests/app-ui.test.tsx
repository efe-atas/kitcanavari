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
/** In the plan: a roadmap entry, or (this term) a course of the weekly schedule. */
const inPlan = (id: string) => !!saved().roadmap?.modules[id] || Object.values(saved().selected as Record<string, { moduleId?: string }>).some((e) => e.moduleId === id)
const roadmap = (modules: object) => ({ roadmap: { terms: ['WS26', 'SS27', 'WS27', 'SS28'], modules, notes: {} } })
/** A term lane of the plan page. */
const lane = (name: string) => screen.findByRole('region', { name })

beforeEach(() => {
  localStorage.clear()
  setState({ areas: AREAS })
  location.hash = '#/'
  loadData.mockResolvedValue({ courses: makeCourses(), changes: makeChanges(), handbook: makeHandbook(), career: makeCareer() })
})
afterEach(cleanup)

describe('overview', () => {
  test('shows the credits and each requirement with a link to add what is missing', async () => {
    setState({ areas: AREAS, selected: { sec: { enabledSlots: [0], moduleId: 'M3', ackFingerprint: '' } },
      ...roadmap({ H1: { term: 'prior', status: 'passed', countAs: null, grade: 1.7 }, H2: { term: 'SS27', status: 'planned', countAs: null, grade: null } }) })
    render(<App />)
    const credits = await screen.findByRole('region', { name: 'Credits' })
    expect(within(credits).getByText('17')).toBeTruthy()
    expect(within(credits).getByRole('img', { name: /6 passed, 11 planned/ })).toBeTruthy()
    const stamm = screen.getByRole('link', { name: 'Add a course: Advanced mandatory modules' })
    expect(stamm.getAttribute('href')).toBe('#/courses/SS27/elective/stamm')
    // This term lists the course added to the weekly schedule.
    expect(within(screen.getByRole('region', { name: 'This term, WS 26/27' })).getByText('Module M3')).toBeTruthy()
  })

  test('the areas are picked on the overview', async () => {
    setState({})
    render(<App />)
    fireEvent.change(await screen.findByRole('combobox', { name: '1st area of specialization' }), { target: { value: AREAS[0] } })
    await waitFor(() => expect(saved().areas).toEqual([AREAS[0]]))
  })

  test('following a career path shows it as the goal', async () => {
    location.hash = '#/career/security:bigtech'
    render(<App />)
    await screen.findByRole('heading', { name: 'Big Tech', level: 2 })
    expect(screen.getByRole('link', { name: 'Big Tech' }).getAttribute('aria-current')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Make it my goal' }))
    await screen.findByRole('button', { name: 'Your goal' })
    expect(saved().followed).toEqual([{ role: 'environment', lens: 'bigtech' }])
    location.hash = '#/'
    await screen.findByRole('link', { name: /Big Tech\s*\d+% fit/ })
  })

  test('without career data there is no goal', async () => {
    loadData.mockResolvedValue({ courses: makeCourses(), changes: makeChanges(), handbook: makeHandbook(), career: null })
    render(<App />)
    await screen.findByRole('region', { name: 'Credits' })
    expect(screen.queryByRole('heading', { name: 'Career goal' })).toBeNull()
  })
})

describe('career', () => {
  test('selects only an environment and accepts legacy role links', async () => {
    location.hash = '#/career/security:bigtech'
    render(<App />)
    await screen.findByRole('heading', { name: 'Big Tech', level: 2 })
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.queryByRole('region', { name: 'Jobs that fit you best' })).toBeNull()
    fireEvent.click(screen.getByRole('link', { name: 'startup', exact: true }))
    await waitFor(() => expect(location.hash).toBe('#/career/startup'))
    await screen.findByRole('heading', { name: 'startup', level: 2 })
    expect(screen.getByText('Skills emphasized in this environment')).toBeTruthy()
  })

})

describe('study plan', () => {
  test('rebuild can remove a current course from both roadmap and weekly timetable', async () => {
    setState({ areas: AREAS, selected: { sec: { enabledSlots: [0], moduleId: 'M3', ackFingerprint: '' } },
      ...roadmap({ H1: { term: 'prior', status: 'passed', countAs: null, grade: 1.7 } }) })
    location.hash = '#/career/bigtech'
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Prepare course suggestions' }))
    fireEvent.click(screen.getByRole('button', { name: 'Rebuild for this environment' }))
    fireEvent.click(screen.getByRole('button', { name: 'Take out of the plan: Module M3' }))
    expect(inPlan('M3')).toBe(true) // Draft edits do not change the saved plan.
    expect(screen.getByRole('region', { name: 'Not in this program' }).textContent).toContain('Module M3')
    fireEvent.click(screen.getByRole('button', { name: /^Update my plan: add \d+, remove 1$/ }))
    await waitFor(() => expect(inPlan('M3')).toBe(false))
    expect(saved().selected.sec).toBeUndefined()
    expect(saved().roadmap.modules.H1).toMatchObject({ status: 'passed', grade: 1.7 })
  })

  test('exploration and draft generation do not mutate the plan; fill mode preserves future courses', async () => {
    setState({ areas: AREAS, ...roadmap({ GONE: { term: 'WS27', status: 'planned', countAs: null, grade: null } }) })
    location.hash = '#/career/security:bigtech'
    const original = localStorage.getItem(STORAGE_KEY)
    render(<App />)
    const prepare = await screen.findByRole('button', { name: 'Prepare course suggestions' })
    expect(screen.queryByRole('button', { name: /^Add these/ })).toBeNull()
    fireEvent.click(prepare)
    expect(screen.getByRole('button', { name: 'Keep my plan, fill the gaps' }).getAttribute('aria-pressed')).toBe('true')
    expect(localStorage.getItem(STORAGE_KEY)).toBe(original)
    expect(screen.queryByRole('region', { name: 'Not in this program' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^Add these/ }))
    await waitFor(() => expect(saved().roadmap.modules.GONE.term).toBe('WS27'))
    expect(await screen.findByRole('status')).toBeTruthy()
  })

  test('suggests courses for the remaining terms; taking one out and adding the rest updates the plan', async () => {
    location.hash = '#/career/security:bigtech'
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Prepare course suggestions' }))
    const plan = await screen.findByRole('region', { name: 'Suggested courses until graduation' })
    expect(within(plan).getByRole('region', { name: 'SS 28' }).textContent).toContain('Master’s thesis')
    fireEvent.click(within(plan).getByRole('button', { name: 'Take out of the plan: Module M3' }))
    await waitFor(() => expect(within(plan).queryByRole('link', { name: 'Module M3' })).toBeNull())
    fireEvent.click(within(plan).getByRole('button', { name: /^Add these \d+ courses to my plan$/ }))
    await waitFor(() => expect(saved().roadmap.modules.H2).toMatchObject({ term: 'SS27', status: 'planned' }))
    expect(saved().roadmap.modules.M3).toBeUndefined()
    expect(screen.getByText('Your plan was updated to this program.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Add these/ })).toBeNull()
    expect(screen.getByRole('link', { name: 'Open plan' })).toBeTruthy()
  })

  test('rebuilding for a job drops future plans that do not serve it, unless kept', async () => {
    setState({ areas: AREAS, ...roadmap({ GONE: { term: 'WS27', status: 'planned', countAs: null, grade: null } }) })
    location.hash = '#/career/security:bigtech'
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Prepare course suggestions' }))
    const plan = await screen.findByRole('region', { name: 'Suggested courses until graduation' })
    fireEvent.click(within(plan).getByRole('button', { name: 'Rebuild for this environment' }))
    const dropped = within(plan).getByRole('region', { name: 'Not in this program' })
    expect(within(dropped).getByText('GONE')).toBeTruthy()
    fireEvent.click(within(plan).getByRole('button', { name: /^Update my plan: add \d+, remove 1$/ }))
    await waitFor(() => expect(saved().roadmap.modules.GONE).toBeUndefined())
    expect(inPlan('M3')).toBe(true)
  })

  test('keeping a dropped course and filling the gaps leave the plan as it is', async () => {
    setState({ areas: AREAS, ...roadmap({ GONE: { term: 'WS27', status: 'planned', countAs: null, grade: null } }) })
    location.hash = '#/career/security:bigtech'
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Prepare course suggestions' }))
    const plan = await screen.findByRole('region', { name: 'Suggested courses until graduation' })
    fireEvent.click(within(plan).getByRole('button', { name: 'Rebuild for this environment' }))
    fireEvent.click(within(plan).getByRole('button', { name: 'Keep' }))
    await waitFor(() => expect(within(plan).queryByRole('region', { name: 'Not in this program' })).toBeNull())
    fireEvent.click(within(plan).getByRole('button', { name: 'Keep my plan, fill the gaps' }))
    fireEvent.click(within(plan).getByRole('button', { name: /^Add these \d+ courses to my plan$/ }))
    await waitFor(() => expect(inPlan('M3')).toBe(true))
    expect(saved().roadmap.modules.GONE).toMatchObject({ term: 'WS27' })
  })

  test('without areas it offers the two that fit the job', async () => {
    setState({})
    location.hash = '#/career/security:bigtech'
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Prepare course suggestions' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Pick these two areas' }))
    await waitFor(() => expect(saved().areas).toHaveLength(2))
    expect(new Set(saved().areas).size).toBe(2)
  })
})

describe('plan', () => {
  test('puts each course in its term and says where it counts', async () => {
    setState({ areas: AREAS, ...roadmap({ H1: { term: 'prior', status: 'passed', countAs: null, grade: 1.7 }, H2: { term: 'SS27', status: 'planned', countAs: null, grade: null } }) })
    location.hash = '#/plan'
    render(<App />)
    const prior = await lane('Passed before')
    expect(within(prior).getByText('Reinforcement Learning')).toBeTruthy()
    expect(within(prior).getByText(AREAS[0])).toBeTruthy()
    expect(within(prior).getByText(/Passed, 1.7/)).toBeTruthy()
    expect(within(await lane('SS 27')).getByText('Seminar: Post-Quantum Cryptography')).toBeTruthy()
  })

  test('a module found nowhere shows as counting elsewhere', async () => {
    setState({ areas: AREAS, ...roadmap({ GONE: { term: 'SS27', status: 'planned', countAs: null, grade: null } }) })
    location.hash = '#/plan'
    render(<App />)
    const ss27 = await lane('SS 27')
    expect(within(ss27).getByText('GONE')).toBeTruthy()
    expect(within(ss27).getByText('Counts elsewhere')).toBeTruthy()
  })

  test('the add link of a term opens the courses page for that term', async () => {
    location.hash = '#/plan'
    render(<App />)
    const link = within(await lane('SS 27')).getByRole('link', { name: 'Add a course to SS 27' })
    expect(link.getAttribute('href')).toBe('#/courses/SS27')
  })
})

describe('courses', () => {
  test('adding with a preset place counts the course there', async () => {
    location.hash = '#/courses/SS27/elective'
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Add: Seminar: Post-Quantum Cryptography' }))
    await waitFor(() => expect(saved().roadmap.modules.H2).toMatchObject({ term: 'SS27', countAs: 'elective' }))
    await screen.findByRole('link', { name: 'In plan: SS 27' })
  })

  test('adding in the current term puts its courses in the weekly timetable', async () => {
    location.hash = '#/courses/WS26/area1'
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Add: Module M3' }))
    await waitFor(() => expect(Object.keys(saved().selected).sort()).toEqual(['ml', 'sec']))
    location.hash = '#/week'
    await screen.findByRole('heading', { name: 'My week', level: 1 })
    expect(screen.getAllByText('IT Security').length).toBeGreaterThan(0)
  })

  test('the term and place can be changed on the page', async () => {
    location.hash = '#/courses'
    render(<App />)
    fireEvent.change(await screen.findByLabelText('Add to term'), { target: { value: 'SS27' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Add: Seminar: Post-Quantum Cryptography' }))
    await waitFor(() => expect(saved().roadmap.modules.H2).toMatchObject({ term: 'SS27' }))
  })
})

describe('course sheet', () => {
  test('edits status, grade and term, and removes', async () => {
    setState({ areas: AREAS, ...roadmap({ H1: { term: 'SS27', status: 'planned', countAs: null, grade: null } }) })
    location.hash = '#/plan'
    render(<App />)
    fireEvent.click(within(await lane('SS 27')).getByRole('link', { name: /Reinforcement Learning/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Reinforcement Learning' })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Passed' }))
    await waitFor(() => expect(saved().roadmap.modules.H1.status).toBe('passed'))
    const grade = await within(sheet).findByLabelText('Grade')
    fireEvent.input(grade, { target: { value: '1,3' } })
    fireEvent.blur(grade)
    await waitFor(() => expect(saved().roadmap.modules.H1.grade).toBe(1.3))
    fireEvent.change(within(sheet).getByLabelText('Term'), { target: { value: 'WS27' } })
    await waitFor(() => expect(saved().roadmap.modules.H1.term).toBe('WS27'))
    fireEvent.click(within(sheet).getByRole('button', { name: 'Remove from plan' }))
    await waitFor(() => expect(saved().roadmap.modules).toEqual({}))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(location.hash).toBe('#/plan')
  })

  test('Escape closes it and keeps the page', async () => {
    location.hash = '#/courses?c=H1'
    render(<App />)
    await screen.findByRole('dialog')
    await waitFor(() => expect(document.activeElement?.id).toBe('sheet-title'))
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(location.hash).toBe('#/courses')
  })
})

test('old links land on the new pages', async () => {
  location.hash = '#/glossary/stamm'
  render(<App />)
  await screen.findByRole('heading', { name: 'Help', level: 1 })
  expect(location.hash).toBe('#/help/stamm')
  location.hash = '#/schedule'
  await screen.findByRole('heading', { name: 'My week', level: 1 })
  location.hash = '#/add/SS27/elective/seminar'
  await screen.findByRole('heading', { name: 'Courses', level: 1 })
  expect(location.hash).toBe('#/courses/SS27/elective/seminar')
  location.hash = '#/course/H1'
  await screen.findByRole('dialog', { name: 'Reinforcement Learning' })
  expect(location.hash).toBe('#/plan?c=H1')
})

test('the menu marks the current page', async () => {
  location.hash = '#/plan'
  render(<App />)
  const nav = (await screen.findAllByRole('navigation', { name: 'Main menu' }))[0]
  expect(within(nav).getByRole('link', { name: 'Plan' }).getAttribute('aria-current')).toBe('page')
  expect(within(nav).getByRole('link', { name: 'Overview' }).getAttribute('aria-current')).toBeNull()
})

test('catalog confirms an addition and offers the plan as the next destination', async () => {
  location.hash = '#/courses/SS27/elective'
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: 'Add: Seminar: Post-Quantum Cryptography' }))
  const feedback = await screen.findByRole('status')
  expect(feedback.textContent).toContain('Seminar: Post-Quantum Cryptography added to your plan.')
  expect(within(feedback).getByRole('link', { name: 'View my plan' }).getAttribute('href')).toBe('#/plan')
})

test('clearing an empty search restores results without changing the selected term', async () => {
  location.hash = '#/courses/SS27/elective'
  render(<App />)
  const search = await screen.findByRole('searchbox')
  fireEvent.input(search, { target: { value: 'no matching course 999' } })
  await screen.findByRole('heading', { name: 'No course here matches these filters.' })
  const buttons = await screen.findAllByRole('button', { name: 'Reset filters' })
  fireEvent.click(buttons[0])
  expect((search as HTMLInputElement).value).toBe('')
  expect((screen.getByLabelText('Add to term') as HTMLSelectElement).value).toBe('SS27')
  expect(await screen.findByRole('button', { name: 'Add: Seminar: Post-Quantum Cryptography' })).toBeTruthy()
})

test('catalog sorting orders the matching courses by credits', async () => {
  location.hash = '#/courses'
  const { container } = render(<App />)
  fireEvent.change(await screen.findByLabelText('Sort'), { target: { value: 'credits' } })
  await waitFor(() => expect(container.querySelector('.result-title')?.textContent).toBe('Module M3'))
  const credits = Array.from(container.querySelectorAll('.result-credit strong')).map((el) => Number(el.textContent))
  expect(credits).toEqual([...credits].sort((a, b) => b - a))
})

test('agenda keeps the selected events and opens the same course detail', async () => {
  setState({ areas: AREAS, selected: { sec: { enabledSlots: [0], moduleId: 'M3', ackFingerprint: '' } } })
  location.hash = '#/week'
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: 'Agenda', exact: true }))
  const day = await screen.findByRole('region', { name: 'Friday' })
  expect(day.textContent).toContain('09:45')
  fireEvent.click(within(day).getByRole('button', { name: /IT Security/ }))
  await screen.findByRole('dialog', { name: 'Module M3' })
  expect(location.hash).toBe('#/week?c=M3')
})

test('mobile filters preserve the destination when reopened', async () => {
  location.hash = '#/courses/SS27'
  render(<App />)
  const toggle = await screen.findByRole('button', { name: /Refine your selection/ })
  expect(toggle.getAttribute('aria-expanded')).toBe('false')
  fireEvent.click(toggle)
  expect(toggle.getAttribute('aria-expanded')).toBe('true')
  fireEvent.change(screen.getByLabelText('Add to term'), { target: { value: 'WS27' } })
  fireEvent.click(toggle)
  fireEvent.click(toggle)
  expect((screen.getByLabelText('Add to term') as HTMLSelectElement).value).toBe('WS27')
})
