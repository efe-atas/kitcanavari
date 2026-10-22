import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { STORAGE_KEY } from '../src/store'
import { makeChanges, makeCourses, makeHandbook } from './appdata'
import { makeCareer } from './careerdata'

const loadData = vi.fn()
vi.mock('../src/data', () => ({ loadData: () => loadData() }))
const { App } = await import('../src/ui/App')

const saved = () => JSON.parse(localStorage.getItem(STORAGE_KEY)!)
const setState = (extra: object) =>
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, selected: {}, lang: 'en', lastSeenScrapedAt: '', ...extra }))

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

  test('catalog cards mark modules that are not scored', async () => {
    location.hash = '#/catalog/all'
    render(<App />)
    const card = (await screen.findByText('Module M1')).closest('li')!
    expect(within(card).getByText('Not scored')).toBeTruthy()
    const scored = screen.getByText('Reinforcement Learning').closest('li')!
    expect(within(scored).queryByText('Not scored')).toBeNull()
  })

  test('followed paths that no longer exist can be removed', async () => {
    setState({ followed: [{ role: 'ghost', lens: 'bigtech' }] })
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Remove ghost · Big Tech' }))
    await waitFor(() => expect(saved().followed).toEqual([]))
  })

  test('the follow limit is explained in visible text', async () => {
    setState({ followed: [{ role: 'quant', lens: 'quant' }, { role: 'backend', lens: 'quant' }, { role: 'academia', lens: 'quant' }] })
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /^security · Big Tech/ }))
    const detail = await screen.findByRole('region', { name: 'security · Big Tech' })
    expect(within(detail).getByText('You can follow up to 3 paths.')).toBeTruthy()
    expect((within(detail).getByRole('button', { name: 'Follow' }) as HTMLButtonElement).disabled).toBe(true)
  })

  test('grid cells say when a path is followed, and the roadmap bar links to that path', async () => {
    setState({ followed: [{ role: 'security', lens: 'bigtech' }] })
    render(<App />)
    await screen.findByRole('button', { name: /^security · Big Tech: .*followed/ })
    location.hash = '#/roadmap'
    const link = await screen.findByRole('link', { name: 'security · Big Tech' })
    expect(link.getAttribute('href')).toBe('#/career/security:bigtech')
    location.hash = '#/career/security:bigtech'
    await screen.findByRole('region', { name: 'security · Big Tech' })
  })

  test('the unscored counter shows', async () => {
    render(<App />)
    await screen.findByText(/modules are not scored yet/)
  })

  test('catalog cards show the best roles', async () => {
    location.hash = '#/catalog/all'
    render(<App />)
    const card = (await screen.findByText('Reinforcement Learning')).closest('li')!
    expect(within(card).getByText('Best for: ML Engineer')).toBeTruthy()
  })

  test('the glossary explains career fit', async () => {
    location.hash = '#/glossary'
    render(<App />)
    await screen.findByText('Career fit')
  })
})
