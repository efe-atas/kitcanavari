import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { STORAGE_KEY } from '../src/store'
import { daysAgo, makeChanges, makeCourses, makeHandbook } from './appdata'

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

  test('fresh status.json wins over an old scrapedAt (content unchanged for days)', async () => {
    loadData.mockResolvedValue({ courses: makeCourses(daysAgo(10)), changes: makeChanges(), status: { checkedAt: daysAgo(0) } })
    render(<App />)
    await screen.findByText('IT Security')
    expect(screen.queryByText(/has not been updated/)).toBeNull()
  })

  test('shows load error', async () => {
    loadData.mockRejectedValue(new Error('courses.json: HTTP 404'))
    render(<App />)
    await screen.findByText(/Could not load data: courses.json: HTTP 404/)
  })
})

describe('all modules mode', () => {
  beforeEach(() => loadData.mockResolvedValue({ courses: makeCourses(), changes: makeChanges(), handbook: makeHandbook() }))

  test('switches to all modules and filters by recurrence', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'All modules' }))
    await screen.findByText('Reinforcement Learning')
    expect(screen.getByText('5 modules')).toBeTruthy()
    expect(location.hash).toBe('#/catalog/all')
    fireEvent.click(screen.getByRole('button', { name: 'Summer term only' }))
    await waitFor(() => expect(screen.queryByText('Reinforcement Learning')).toBeNull())
    expect(screen.getByText('Seminar: Post-Quantum Cryptography')).toBeTruthy()
  })

  test('module detail shows handbook text and links to this term\'s event', async () => {
    location.hash = '#/catalog/all'
    render(<App />)
    fireEvent.click(await screen.findByText('Module M3'))
    await screen.findByText('Goals of Module M3')
    fireEvent.click(screen.getByRole('button', { name: 'IT Security' }))
    await screen.findByRole('button', { name: 'Add to schedule' })
    expect(location.hash).toBe('#/catalog/all')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Add to schedule' })).toBeNull())
    expect(screen.getByText('5 modules')).toBeTruthy()
  })

  test('an open module detail does not come back after leaving all modules', async () => {
    location.hash = '#/catalog/all'
    render(<App />)
    fireEvent.click(await screen.findByText('Module M3'))
    await screen.findByText('Goals of Module M3')
    fireEvent.click(screen.getByRole('button', { name: 'This term' }))
    await screen.findByText('3 courses')
    fireEvent.click(screen.getByRole('button', { name: 'All modules' }))
    await screen.findByText('5 modules')
    expect(screen.queryByText('Goals of Module M3')).toBeNull()
  })

  test('hides the mode switch without a handbook', async () => {
    loadData.mockResolvedValue({ courses: makeCourses(), changes: makeChanges(), handbook: null })
    render(<App />)
    await screen.findByText('IT Security')
    expect(screen.queryByRole('button', { name: 'All modules' })).toBeNull()
  })
})
