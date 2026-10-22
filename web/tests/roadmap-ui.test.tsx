import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { STORAGE_KEY } from '../src/store'
import { makeChanges, makeCourses, makeHandbook } from './appdata'

const loadData = vi.fn()
vi.mock('../src/data', () => ({ loadData: () => loadData() }))
const { App } = await import('../src/ui/App')

const saved = () => JSON.parse(localStorage.getItem(STORAGE_KEY)!)
const setState = (extra: object) =>
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, selected: {}, lang: 'en', lastSeenScrapedAt: '', ...extra }))
const column = async (label: string) => screen.findByRole('region', { name: label })

beforeEach(() => {
  localStorage.clear()
  setState({})
  location.hash = '#/roadmap'
  loadData.mockResolvedValue({ courses: makeCourses(), changes: makeChanges(), handbook: makeHandbook() })
})
afterEach(cleanup)

describe('roadmap tab', () => {
  test('adds a module to a later term and warns about the season', async () => {
    render(<App />)
    const ss27 = await column('SS 27')
    fireEvent.input(within(ss27).getByRole('searchbox'), { target: { value: 'Reinforcement' } })
    fireEvent.click(within(ss27).getByRole('button', { name: /Reinforcement Learning/ }))
    await waitFor(() => expect(saved().roadmap.modules.H1.term).toBe('SS27'))
    const col = await column('SS 27')
    expect(within(col).getByText('Reinforcement Learning')).toBeTruthy()
    expect(within(col).getByText('Not offered in that season')).toBeTruthy()
  })

  test('weekly plan shows up in the current term', async () => {
    setState({ selected: { sec: { enabledSlots: [0], moduleId: 'M3', ackFingerprint: '' } } })
    render(<App />)
    const ws = await column('WS 26/27')
    expect(within(ws).getByText('Module M3')).toBeTruthy()
    expect(within(ws).getByText('In schedule')).toBeTruthy()
  })

  test('passing with a grade updates the degree panel', async () => {
    setState({ roadmap: { terms: ['WS26', 'SS27', 'WS27', 'SS28'], modules: { H1: { term: 'prior', status: 'passed', countAs: null, grade: null } }, notes: {} } })
    render(<App />)
    const prior = await column('Passed before')
    const grade = within(prior).getByLabelText('Grade')
    fireEvent.input(grade, { target: { value: '1,3' } })
    fireEvent.blur(grade)
    await screen.findByText('Grade average: 1.3 (6 ECTS graded)')
    expect(saved().roadmap.modules.H1.grade).toBe(1.3)
  })

  test('an out-of-range grade is flagged and not saved', async () => {
    setState({ roadmap: { terms: ['WS26', 'SS27', 'WS27', 'SS28'], modules: { H1: { term: 'prior', status: 'passed', countAs: null, grade: 2 } }, notes: {} } })
    render(<App />)
    const grade = within(await column('Passed before')).getByLabelText('Grade')
    fireEvent.input(grade, { target: { value: '4.5' } })
    fireEvent.blur(grade)
    await waitFor(() => expect(grade.getAttribute('aria-invalid')).toBe('true'))
    expect(saved().roadmap.modules.H1.grade).toBe(2)
  })

  test('status, note and remove', async () => {
    setState({ roadmap: { terms: ['WS26', 'SS27', 'WS27', 'SS28'], modules: { H2: { term: 'SS27', status: 'planned', countAs: null, grade: null } }, notes: {} } })
    render(<App />)
    const col = await column('SS 27')
    fireEvent.change(within(col).getByLabelText('Status'), { target: { value: 'dropped' } })
    await waitFor(() => expect(saved().roadmap.modules.H2.status).toBe('dropped'))
    const note = within(col).getByLabelText('Note')
    fireEvent.input(note, { target: { value: 'çok iş' } })
    fireEvent.blur(note)
    await waitFor(() => expect(saved().roadmap.notes.H2).toBe('çok iş'))
    fireEvent.click(within(col).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(saved().roadmap.modules).toEqual({}))
  })

  test('adding a term adds a column', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Add term' }))
    await column('WS 28/29')
  })

  test('catalog module detail places a module', async () => {
    location.hash = '#/catalog/all'
    render(<App />)
    fireEvent.click(await screen.findByText('Reinforcement Learning'))
    fireEvent.change(screen.getByLabelText('Add to term'), { target: { value: 'WS27' } })
    await screen.findByText('In roadmap: WS 27/28')
    location.hash = '#/roadmap'
    const col = await column('WS 27/28')
    expect(within(col).getByText('Reinforcement Learning')).toBeTruthy()
  })

  test('unknown module ids do not crash', async () => {
    setState({ roadmap: { terms: ['WS26', 'SS27', 'WS27', 'SS28'], modules: { GONE: { term: 'SS27', status: 'planned', countAs: null, grade: null } }, notes: {} } })
    render(<App />)
    const col = await column('SS 27')
    expect(within(col).getByText('GONE')).toBeTruthy()
    expect(within(col).getByText('Unknown module')).toBeTruthy()
  })
})
