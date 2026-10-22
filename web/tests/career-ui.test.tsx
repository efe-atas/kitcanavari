import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { STORAGE_KEY } from '../src/store'
import { makeChanges, makeCourses, makeHandbook } from './appdata'
import { makeCareer } from './careerdata'

const loadData = vi.fn()
vi.mock('../src/data', () => ({ loadData: () => loadData() }))
const { App } = await import('../src/ui/App')

const saved = () => JSON.parse(localStorage.getItem(STORAGE_KEY)!)

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, selected: {}, lang: 'en', lastSeenScrapedAt: '' }))
  location.hash = '#/career'
  loadData.mockResolvedValue({ courses: makeCourses(), changes: makeChanges(), handbook: makeHandbook(), career: makeCareer() })
})
afterEach(cleanup)

describe('career tab', () => {
  test('shows a role × lens grid', async () => {
    render(<App />)
    const grid = await screen.findByRole('table', { name: 'Fit by role and employer type' })
    expect(within(grid).getAllByRole('button')).toHaveLength(60)
  })

  test('a cell opens the path with gaps; suggestions go to the roadmap; follow shows on the roadmap', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /^security · Big Tech/ }))
    const detail = await screen.findByRole('region', { name: 'security · Big Tech' })
    expect(within(detail).getAllByText('Security').length).toBeGreaterThan(0)
    fireEvent.click(within(detail).getAllByRole('button', { name: /Add to roadmap/ })[0])
    await waitFor(() => expect(Object.keys(saved().roadmap.modules)).toContain('M3'))
    expect(within(detail).getByText(/€70–90k|No sourced salary band/)).toBeTruthy()
    fireEvent.click(within(detail).getByRole('button', { name: 'Follow' }))
    await waitFor(() => expect(saved().followed).toEqual([{ role: 'security', lens: 'bigtech' }]))
    location.hash = '#/roadmap'
    await screen.findByText('security · Big Tech')
  })

  test('without career data the tab says so', async () => {
    loadData.mockResolvedValue({ courses: makeCourses(), changes: makeChanges(), handbook: makeHandbook(), career: null })
    render(<App />)
    await screen.findByText('No career data yet.')
  })

  test('module detail in the catalog shows skill reasons', async () => {
    location.hash = '#/catalog/all'
    render(<App />)
    fireEvent.click(await screen.findByText('Reinforcement Learning'))
    await screen.findByText('RL theory.')
    expect(screen.getByText('ML Engineer')).toBeTruthy()
  })
})
