import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { STORAGE_KEY } from '../src/store'
import type { UserState } from '../src/types'
import { makeChanges, makeCourses } from './appdata'

const loadData = vi.fn()
vi.mock('../src/data', () => ({ loadData: () => loadData() }))
const { App } = await import('../src/ui/App')

const setState = (patch: Partial<UserState>) =>
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, selected: {}, lang: 'en', lastSeenScrapedAt: '', ...patch }))
const pick = (moduleId: string, fp: string) => ({ enabledSlots: [0], moduleId, ackFingerprint: fp })

beforeEach(() => {
  localStorage.clear()
  loadData.mockResolvedValue({ courses: makeCourses(), changes: makeChanges() })
})
afterEach(cleanup)

describe('schedule view', () => {
  beforeEach(() => { location.hash = '#/schedule' })

  test('empty schedule invites adding courses', async () => {
    setState({})
    render(<App />)
    await screen.findByText('Your schedule is empty. Add courses from the catalog.')
  })

  test('conflicting events show conflict message', async () => {
    setState({ selected: { gpu: pick('M1', 'fp-gpu'), ml: pick('M2', 'fp-ml') } })
    render(<App />)
    const list = await screen.findByRole('region', { name: 'Conflicts' })
    expect(list.textContent).toContain('Practical course GPU-Computing')
    expect(list.textContent).toContain('Practical Course Machine Learning')
    expect(list.textContent).toContain('15:00–15:30')
  })

  test('ects total updates when module changes', async () => {
    setState({ selected: { ml: pick('M2', 'fp-ml') } })
    render(<App />)
    const total = await screen.findByTestId('ects-total')
    expect(total.textContent).toContain('4')
    fireEvent.change(screen.getByLabelText(/Counts for module/), { target: { value: 'M3' } })
    await waitFor(() => expect(screen.getByTestId('ects-total').textContent).toContain('8'))
  })

  test('removed event is shown greyed and labelled', async () => {
    setState({ selected: { gone: pick('M1', 'x') } })
    render(<App />)
    await screen.findByText('Removed from catalog')
  })

  test('import invalid file shows error', async () => {
    setState({})
    render(<App />)
    const input = await screen.findByLabelText('Import')
    const file = new File(['not json'], 'x.json', { type: 'application/json' })
    fireEvent.change(input, { target: { files: [file] } })
    await screen.findByText('Could not read the file or it is not a valid schedule.')
  })
})

describe('changes view', () => {
  beforeEach(() => { location.hash = '#/changes' })

  test('mark as seen clears badge', async () => {
    const courses = makeCourses()
    courses.events.gpu.fingerprint = 'fp-new'
    loadData.mockResolvedValue({
      courses,
      changes: { entries: [{ at: courses.meta.scrapedAt, eventId: 'gpu', eventTitle: 'GPU', kind: 'room_changed', summary: 'Room 50.34 Raum 148 → 50.34 Raum 131' }] },
    })
    setState({ selected: { gpu: pick('M1', 'fp-old') } })
    render(<App />)
    await screen.findByText('Room 50.34 Raum 148 → 50.34 Raum 131', { selector: '.alert li' })
    expect(screen.getByTestId('changes-badge').textContent).toBe('1')
    fireEvent.click(screen.getByRole('button', { name: 'Mark as seen' }))
    await waitFor(() => expect(screen.queryByTestId('changes-badge')).toBeNull())
    expect(screen.getByText('No changes to your courses since your last visit.')).toBeTruthy()
  })

  test('feed can be limited to my schedule', async () => {
    loadData.mockResolvedValue({
      courses: makeCourses(),
      changes: { entries: [
        { at: '2026-10-19T04:00:00Z', eventId: 'gpu', eventTitle: 'GPU', kind: 'added', summary: 'Added: GPU' },
        { at: '2026-10-19T04:00:00Z', eventId: 'sec', eventTitle: 'IT Security', kind: 'added', summary: 'Added: IT Security' },
      ] },
    })
    setState({ selected: { gpu: pick('M1', 'fp-gpu') } })
    render(<App />)
    await screen.findByText('Added: IT Security')
    fireEvent.click(screen.getByRole('button', { name: 'Only my schedule' }))
    await waitFor(() => expect(screen.queryByText('Added: IT Security')).toBeNull())
    expect(screen.getByText('Added: GPU')).toBeTruthy()
  })
})
