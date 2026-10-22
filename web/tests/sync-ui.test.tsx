import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { STORAGE_KEY } from '../src/store'
import { makeChanges, makeCourses } from './appdata'

const loadData = vi.fn()
vi.mock('../src/data', () => ({ loadData: () => loadData() }))
const { App } = await import('../src/ui/App')

const PROFILE_URL = 'https://api.github.com/repos/efe-atas/kitcanavari-me/contents/profile.json'

/** A fake GitHub holding one file. */
function github(status: number | null = null) {
  const s = { content: null as string | null, sha: null as string | null, n: 0, urls: [] as string[] }
  const f = vi.fn(async (url: string, init: RequestInit = {}) => {
    s.urls.push(url)
    if (status) return new Response('{}', { status })
    if (url !== PROFILE_URL) return new Response('{}', { status: 404 })
    if (init.method === 'PUT') {
      const body = JSON.parse(String(init.body)) as { content: string; sha?: string }
      if ((body.sha ?? null) !== s.sha) return new Response('{}', { status: 409 })
      s.content = body.content
      s.sha = `v${++s.n}`
      return new Response(JSON.stringify({ content: { sha: s.sha } }))
    }
    return s.content ? new Response(JSON.stringify({ sha: s.sha, content: s.content })) : new Response('{}', { status: 404 })
  })
  const profile = () => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(s.content!), (c) => c.charCodeAt(0))))
  return { s, f, profile }
}

async function connect() {
  fireEvent.click(await screen.findByRole('button', { name: /Sync off/ }))
  fireEvent.input(screen.getByLabelText('Token'), { target: { value: 'github_pat_test' } })
  fireEvent.click(screen.getByRole('button', { name: 'Connect' }))
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  localStorage.clear()
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, selected: {}, lang: 'en', lastSeenScrapedAt: '' }))
  location.hash = '#/catalog'
  loadData.mockResolvedValue({ courses: makeCourses(), changes: makeChanges(), handbook: null })
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

describe('profile sync', () => {
  test('connects and saves the plan to the profile repo', async () => {
    const gh = github()
    vi.stubGlobal('fetch', gh.f)
    render(<App />)
    await connect()
    await screen.findByRole('button', { name: /Saved/ })
    expect(gh.profile().weekly).toEqual({})
    fireEvent.click(screen.getAllByRole('button', { name: 'Add to schedule' })[0])
    await screen.findByRole('button', { name: /Saving/ })
    await act(async () => { vi.advanceTimersByTime(3000) })
    await screen.findByRole('button', { name: /Saved/ })
    expect(Object.keys(gh.profile().weekly)).toHaveLength(1)
    expect(JSON.parse(localStorage.getItem('kitcanavari:sync')!).token).toBe('github_pat_test')
  })

  test('shows auth error and keeps editing', async () => {
    vi.stubGlobal('fetch', github(401).f)
    render(<App />)
    await connect()
    await screen.findByRole('button', { name: /Token invalid/ })
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Add to schedule' })[0])
    await waitFor(() => expect(Object.keys(JSON.parse(localStorage.getItem(STORAGE_KEY)!).selected)).toHaveLength(1))
  })

  test('without a config the app never calls GitHub', async () => {
    const gh = github()
    vi.stubGlobal('fetch', gh.f)
    render(<App />)
    await screen.findByText('IT Security')
    fireEvent.click(screen.getAllByRole('button', { name: 'Add to schedule' })[0])
    await act(async () => { vi.advanceTimersByTime(5000) })
    expect(gh.s.urls.filter((u) => u.includes('api.github.com'))).toEqual([])
  })
})
