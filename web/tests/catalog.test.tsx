import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { STORAGE_KEY } from '../src/store'
import { daysAgo, makeChanges, makeCourses } from './appdata'

const loadData = vi.fn()
vi.mock('../src/data', () => ({ loadData: () => loadData() }))
const { App } = await import('../src/ui/App')

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, selected: {}, lang: 'en', lastSeenScrapedAt: '' }))
  location.hash = '#/catalog'
  loadData.mockResolvedValue({ courses: makeCourses(), changes: makeChanges() })
})
afterEach(cleanup)

describe('catalog', () => {
  test('shows events and filters by search', async () => {
    render(<App />)
    await screen.findByText('Practical course GPU-Computing')
    expect(screen.getByText('IT Security')).toBeTruthy()
    fireEvent.input(screen.getByPlaceholderText('Search title, number or lecturer…'), { target: { value: 'hanebeck' } })
    await waitFor(() => expect(screen.queryByText('IT Security')).toBeNull())
    expect(screen.getByText('Practical Course Machine Learning')).toBeTruthy()
  })

  test('shows ECTS range from linked modules', async () => {
    render(<App />)
    await screen.findByText('Practical Course Machine Learning')
    expect(screen.getByText('4–8 ECTS')).toBeTruthy()
  })

  test('adding an event marks card as in schedule and persists', async () => {
    render(<App />)
    await screen.findByText('Practical course GPU-Computing')
    fireEvent.click(screen.getAllByRole('button', { name: 'Add to schedule' })[0])
    await screen.findByText('In schedule')
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).selected).toHaveProperty('sec')
  })

  test('marks conflicting cards once something is in the schedule', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1, lang: 'en', lastSeenScrapedAt: '',
      selected: { gpu: { enabledSlots: [0], moduleId: 'M1', ackFingerprint: 'fp-gpu' } },
    }))
    render(<App />)
    await screen.findByText('Practical Course Machine Learning')
    expect(screen.getAllByTitle('Conflicts with your schedule')).toHaveLength(1)
  })

  test('opens detail with sessions, cancelled ones marked', async () => {
    render(<App />)
    fireEvent.click(await screen.findByText('Practical course GPU-Computing'))
    await screen.findByText(/Beim GPU-Computing/)
    expect(screen.getByText('cancelled')).toBeTruthy()
    expect(screen.getAllByRole('link', { name: 'KIT page' }).length).toBeGreaterThan(0)
  })

  test('field tree filters the list', async () => {
    render(<App />)
    await screen.findByText('IT Security')
    fireEvent.click(screen.getByRole('button', { name: /1.6 Seminars/ }))
    await waitFor(() => expect(screen.queryByText('Practical course GPU-Computing')).toBeNull())
    expect(screen.getByText('IT Security')).toBeTruthy()
  })

  test('shows stale data warning', async () => {
    loadData.mockResolvedValue({ courses: makeCourses(daysAgo(4)), changes: makeChanges() })
    render(<App />)
    await screen.findByText(/has not been updated for 4 days/)
  })

  test('shows load error', async () => {
    loadData.mockRejectedValue(new Error('courses.json: HTTP 404'))
    render(<App />)
    await screen.findByText(/Could not load data: courses.json: HTTP 404/)
  })
})
