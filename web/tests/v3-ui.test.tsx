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
const gpuSelected = { gpu: { enabledSlots: [0], moduleId: 'M1', ackFingerprint: 'fp-gpu' } }

beforeEach(() => {
  localStorage.clear()
  setState({ areas: AREAS })
  location.hash = '#/'
  loadData.mockResolvedValue({ courses: makeCourses(), changes: makeChanges(), handbook: makeHandbook(), career: makeCareer() })
})
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('quick search and shortcuts', () => {
  test('Ctrl+K finds a course and Enter opens it on the current page', async () => {
    render(<App />)
    await screen.findByRole('region', { name: 'Credits' })
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const dialog = await screen.findByRole('dialog', { name: 'Quick search' })
    const input = within(dialog).getByRole('combobox')
    expect(document.activeElement).toBe(input)
    fireEvent.input(input, { target: { value: 'reinf' } })
    const option = await within(dialog).findByRole('option', { name: /Reinforcement Learning/ })
    expect(option.getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(input, { key: 'Enter' })
    await screen.findByRole('dialog', { name: 'Reinforcement Learning' })
    expect(location.hash).toBe('#/?c=H1')
    expect(screen.queryByRole('dialog', { name: 'Quick search' })).toBeNull()
  })

  test('pages and actions are found too; Escape closes the box', async () => {
    render(<App />)
    await screen.findByRole('region', { name: 'Credits' })
    fireEvent.click(screen.getByRole('button', { name: 'Quick search' }))
    const input = within(await screen.findByRole('dialog', { name: 'Quick search' })).getByRole('combobox')
    fireEvent.input(input, { target: { value: 'week' } })
    fireEvent.click(await screen.findByRole('option', { name: /My week/ }))
    await screen.findByRole('heading', { name: 'My week', level: 1 })
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    await screen.findByRole('dialog', { name: 'Quick search' })
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Quick search' })).toBeNull())
  })

  test('"/" focuses the catalog search; g then p opens the plan; ? lists the shortcuts', async () => {
    location.hash = '#/courses'
    render(<App />)
    const search = await screen.findByRole('searchbox')
    fireEvent.keyDown(window, { key: '/' })
    expect(document.activeElement).toBe(search)
    // Typing in a field never triggers shortcuts.
    fireEvent.keyDown(search, { key: 'g' })
    fireEvent.keyDown(search, { key: 'p' })
    expect(location.hash).toBe('#/courses')
    ;(search as HTMLInputElement).blur()
    fireEvent.keyDown(window, { key: 'g' })
    fireEvent.keyDown(window, { key: 'p' })
    await screen.findByRole('heading', { name: 'Plan', level: 1 })
    fireEvent.keyDown(window, { key: '?' })
    const sheet = await screen.findByRole('dialog', { name: 'Keyboard shortcuts' })
    expect(within(sheet).getByText('Quick search')).toBeTruthy()
  })
})

describe('shortlist', () => {
  test('a starred course shows on the overview and filters the catalog', async () => {
    location.hash = '#/courses/WS27'
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Add to shortlist: Reinforcement Learning' }))
    await waitFor(() => expect(saved().starred).toEqual(['H1']))
    expect(screen.getByRole('button', { name: 'Remove from shortlist: Reinforcement Learning' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('checkbox', { name: /Only my shortlist/ }))
    await waitFor(() => expect(screen.getAllByRole('link', { name: /Reinforcement Learning|Post-Quantum|Module M/ }).map((a) => a.textContent)).toEqual(['Reinforcement Learning']))
    location.hash = '#/'
    const card = await screen.findByRole('region', { name: 'Shortlist' })
    expect(within(card).getByRole('link', { name: /Reinforcement Learning/ })).toBeTruthy()
    fireEvent.click(within(card).getByRole('button', { name: 'Remove from shortlist: Reinforcement Learning' }))
    await waitFor(() => expect(saved().starred).toEqual([]))
  })
})

describe('undo', () => {
  test('moving a course with its menu, then undoing it', async () => {
    setState({ areas: AREAS, ...roadmap({ H1: { term: 'SS27', status: 'planned', countAs: null, grade: null } }) })
    location.hash = '#/plan'
    render(<App />)
    const ss27 = await screen.findByRole('region', { name: 'SS 27' })
    fireEvent.click(within(ss27).getByLabelText('Move: Reinforcement Learning'))
    fireEvent.click(within(ss27).getByRole('button', { name: 'WS 27/28' }))
    await waitFor(() => expect(saved().roadmap.modules.H1.term).toBe('WS27'))
    const toast = await screen.findByRole('status')
    expect(toast.textContent).toContain('Reinforcement Learning → WS 27/28')
    fireEvent.click(within(toast).getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(saved().roadmap.modules.H1.term).toBe('SS27'))
  })

  test('dropping a dragged course on another term moves it', async () => {
    setState({ areas: AREAS, ...roadmap({ H1: { term: 'SS27', status: 'planned', countAs: null, grade: null } }) })
    location.hash = '#/plan'
    render(<App />)
    const card = (await screen.findByRole('link', { name: /Reinforcement Learning/ })).closest('li')!
    const data = new Map<string, string>()
    const dataTransfer = { setData: (k: string, v: string) => data.set(k, v), getData: (k: string) => data.get(k) ?? '', get types() { return [...data.keys()] }, effectAllowed: '', dropEffect: '' }
    fireEvent.dragStart(card, { dataTransfer })
    const target = screen.getByRole('region', { name: 'SS 28' })
    fireEvent.dragOver(target, { dataTransfer })
    fireEvent.drop(target, { dataTransfer })
    await waitFor(() => expect(saved().roadmap.modules.H1.term).toBe('SS28'))
  })

  test('removing in the course sheet and adding in the catalog can both be undone', async () => {
    setState({ areas: AREAS, ...roadmap({ H1: { term: 'SS27', status: 'passed', countAs: null, grade: 1.7 } }), })
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...saved(), roadmap: { ...saved().roadmap, notes: { H1: 'great course' } } }))
    location.hash = '#/plan?c=H1'
    render(<App />)
    const sheet = await screen.findByRole('dialog', { name: 'Reinforcement Learning' })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Remove from plan' }))
    await waitFor(() => expect(saved().roadmap.modules.H1).toBeUndefined())
    fireEvent.click(within(await screen.findByRole('status')).getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(saved().roadmap.modules.H1).toEqual({ term: 'SS27', status: 'passed', countAs: null, grade: 1.7 }))
    expect(saved().roadmap.notes.H1).toBe('great course')

    location.hash = '#/courses/SS27'
    fireEvent.click(await screen.findByRole('button', { name: 'Add: Seminar: Post-Quantum Cryptography' }))
    await waitFor(() => expect(saved().roadmap.modules.H2).toBeTruthy())
    fireEvent.click(within(await screen.findByRole('status')).getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(saved().roadmap.modules.H2).toBeUndefined())
  })

  test('a term chip in the course sheet adds the course there', async () => {
    location.hash = '#/courses?c=H2'
    render(<App />)
    const sheet = await screen.findByRole('dialog', { name: 'Seminar: Post-Quantum Cryptography' })
    // A summer seminar: a winter term warns on its chip, but stays possible.
    expect(within(sheet).getByRole('button', { name: /^Add to term: WS 27\/28 \(.+\)$/ })).toBeTruthy()
    fireEvent.click(within(sheet).getByRole('button', { name: 'Add to term: SS 27' }))
    await waitFor(() => expect(saved().roadmap.modules.H2).toMatchObject({ term: 'SS27', status: 'planned' }))
    expect(await within(sheet).findByRole('group', { name: 'Status' })).toBeTruthy()
  })
})

describe('week in real dates', () => {
  test('pages through weeks; a cancelled session is marked', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-28T09:00:00Z'), shouldAdvanceTime: true })
    setState({ areas: AREAS, selected: gpuSelected })
    location.hash = '#/week'
    render(<App />)
    await screen.findByRole('heading', { name: '26 Oct – 1 Nov 2026', level: 2 })
    fireEvent.click(screen.getByRole('button', { name: 'Agenda', exact: true }))
    const tue = await screen.findByRole('region', { name: /^Tuesday 27 October/ })
    expect(within(tue).getByText('Practical course GPU-Computing')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }))
    await screen.findByRole('heading', { name: '2 Nov – 8 Nov 2026', level: 2 })
    const next = await screen.findByRole('region', { name: /^Tuesday 3 November/ })
    expect(within(next).getByText('Cancelled')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'This week' }))
    await screen.findByRole('heading', { name: '26 Oct – 1 Nov 2026', level: 2 })
  })

  test('the overview shows what is on now', async () => {
    // 13:30 UTC is 14:30 in Karlsruhe (winter time): the GPU practical (14:00–15:30) is running.
    vi.useFakeTimers({ now: new Date('2026-10-27T13:30:00Z'), shouldAdvanceTime: true })
    setState({ areas: AREAS, selected: gpuSelected })
    render(<App />)
    const today = await screen.findByRole('region', { name: 'Tuesday 27 October' })
    expect(within(today).getByText('Now: Practical course GPU-Computing')).toBeTruthy()
    expect(within(today).getByText('14:00')).toBeTruthy()
  })
})

describe('catalog filters', () => {
  test('keeping a day free hides courses that meet on it', async () => {
    location.hash = '#/courses/WS26'
    render(<App />)
    await screen.findByRole('button', { name: 'Add: Module M3' })
    fireEvent.click(screen.getByRole('button', { name: 'Friday free' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Add: Module M3' })).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Remove filter: Fri free' }))
    await screen.findByRole('button', { name: 'Add: Module M3' })
  })
})

describe('outlook and settings', () => {
  test('the overview forecasts the thesis term', async () => {
    setState({ areas: AREAS, ...roadmap({ H1: { term: 'prior', status: 'passed', countAs: null, grade: 1.3 } }) })
    render(<App />)
    const outlook = await screen.findByRole('region', { name: 'Graduation' })
    expect(within(outlook).getByText('estimated thesis term')).toBeTruthy()
    expect(within(outlook).getByText(/Your average so far \(6 ECTS\)/)).toBeTruthy()
  })

  test('the theme can follow the system again', async () => {
    setState({ areas: AREAS, theme: 'dark' })
    location.hash = '#/settings'
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'System' }))
    await waitFor(() => expect(saved().theme).toBeUndefined())
    fireEvent.click(screen.getByRole('button', { name: 'Dark' }))
    await waitFor(() => expect(saved().theme).toBe('dark'))
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})

describe('sharing a plan', () => {
  test('the plan page gives a link; opening it shows the plan read-only and can adopt it', async () => {
    setState({ areas: AREAS, ...roadmap({ H1: { term: 'prior', status: 'passed', countAs: null, grade: 1.3 }, H2: { term: 'SS27', status: 'planned', countAs: null, grade: null } }) })
    location.hash = '#/plan'
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Share' }))
    const dialog = await screen.findByRole('dialog', { name: 'Share plan' })
    const link = within(dialog).getByLabelText('Link') as HTMLInputElement
    expect(link.value).toMatch(/#\/shared\/1~/)
    expect(link.value).not.toContain(',13') // grades stay out by default
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Include my grades' }))
    expect((within(dialog).getByLabelText('Link') as HTMLInputElement).value).toContain(',13')
    const hash = link.value.slice(link.value.indexOf('#'))
    fireEvent.keyDown(window, { key: 'Escape' })

    // Someone else opens it.
    localStorage.clear()
    setState({ areas: [], starred: ['M1'] })
    cleanup()
    location.hash = hash
    render(<App />)
    await screen.findByRole('heading', { name: 'Shared plan', level: 1 })
    expect(within(screen.getByRole('region', { name: 'SS 27' })).getByText('Seminar: Post-Quantum Cryptography')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Use as my plan' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes, use it' }))
    await waitFor(() => expect(saved().roadmap.modules.H2).toMatchObject({ term: 'SS27' }))
    expect(saved().areas).toEqual(AREAS)
    expect(saved().starred).toEqual(['M1'])
    await screen.findByRole('heading', { name: 'Plan', level: 1 })
  })

  test('a broken link says so', async () => {
    location.hash = '#/shared/nonsense'
    render(<App />)
    await screen.findByText(/This link could not be read/)
  })
})

describe('changes', () => {
  test('the feed names each kind of change and can keep to times, rooms and cancellations', async () => {
    const at = new Date().toISOString().replace(/\.\d+Z$/, 'Z')
    loadData.mockResolvedValue({
      courses: makeCourses(), handbook: makeHandbook(), career: makeCareer(),
      changes: { entries: [
        { at, eventId: 'sec', eventTitle: 'IT Security', kind: 'room_changed', summary: 'Room A → Room B' },
        { at, eventId: 'gpu', eventTitle: 'Practical course GPU-Computing', kind: 'lecturers_changed', summary: 'Lecturers: X → Y' },
      ] },
    })
    location.hash = '#/changes'
    render(<App />)
    const feed = await screen.findByRole('region', { name: 'Catalog changes (last 90 days)' })
    expect(within(feed).getByText('Room changed')).toBeTruthy()
    expect(within(feed).getByText('Lecturers changed')).toBeTruthy()
    fireEvent.click(within(feed).getByRole('checkbox', { name: 'Only times, rooms and cancellations' }))
    await waitFor(() => expect(within(feed).queryByText('Lecturers changed')).toBeNull())
    expect(within(feed).getByRole('link', { name: 'IT Security' }).getAttribute('href')).toBe('#/changes?c=M3')
  })
})

describe('career tools', () => {
  test('ranks environments, closes a gap with a course, lists lecturers, reads a job ad and writes CV lines', async () => {
    setState({ areas: AREAS, ...roadmap({ H1: { term: 'prior', status: 'passed', countAs: null, grade: 1.3 } }) })
    location.hash = '#/career/security:bigtech'
    render(<App />)
    await screen.findByRole('heading', { name: 'security · Big Tech', level: 2 })
    // Every environment shows the plan's fit.
    const picker = screen.getByRole('navigation', { name: 'Where do you want to work?' })
    expect(within(picker).getAllByRole('link')).toHaveLength(6)
    expect(within(picker).getByRole('link', { name: 'Big Tech' }).textContent).toMatch(/\d+%/)
    // A gap lists courses that close it; adding one puts it in the plan.
    const gaps = screen.getByRole('list', { name: 'Courses that close the Security gap' })
    fireEvent.click(within(gaps).getByRole('button', { name: /^Add: / }))
    // M3 is offered this term: it lands in the weekly timetable as well.
    await waitFor(() => expect(Object.values(saved().selected as Record<string, { moduleId: string }>).some((e) => e.moduleId === 'M3')).toBe(true))
    // Lecturers.
    expect(screen.getByRole('region', { name: 'Who to write to in this field' }).textContent).toContain('Prof. Coordinator')
    // Job ad.
    fireEvent.input(screen.getByLabelText('Job ad text'), { target: { value: 'Penetration testing and cryptography for our cloud.' } })
    const ad = screen.getByRole('region', { name: 'Compare a job ad with your plan' })
    expect(within(ad).getByText('Security')).toBeTruthy()
    expect(within(ad).getByText('penetration')).toBeTruthy()
    // CV lines in English, grades only when asked.
    const cv = screen.getByRole('region', { name: 'Coursework for your CV and LinkedIn' })
    expect(within(cv).getByLabelText('Coursework for your CV and LinkedIn').textContent).toContain('Reinforcement Learning')
    expect(within(cv).getByLabelText('Coursework for your CV and LinkedIn').textContent).not.toContain('(1.3)')
    fireEvent.click(within(cv).getByRole('checkbox', { name: 'Include grades' }))
    expect(within(cv).getByLabelText('Coursework for your CV and LinkedIn').textContent).toContain('Reinforcement Learning (1.3)')
  })
})
