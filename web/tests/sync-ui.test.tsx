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
    if (url === 'https://api.github.com/repos/efe-atas/kitcanavari-me') return new Response('{"id":1}')
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

/** The sync status button (the sidebar's; phones show the same one in the top bar). */
const status = async (name: RegExp) => (await screen.findAllByRole('button', { name }))[0]

async function connect() {
  fireEvent.click(await status(/Sync off/))
  fireEvent.input(await screen.findByLabelText('Token'), { target: { value: 'github_pat_test' } })
  fireEvent.click(screen.getByRole('button', { name: 'Connect' }))
}

/** Add module M3 (two courses this term) on the courses page. */
async function addCourse() {
  location.hash = '#/courses/WS26/elective'
  fireEvent.click(await screen.findByRole('button', { name: 'Add: Module M3' }))
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  localStorage.clear()
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, selected: {}, lang: 'en', lastSeenScrapedAt: '' }))
  location.hash = '#/'
  loadData.mockResolvedValue({ courses: makeCourses(), changes: makeChanges(), handbook: null })
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

describe('profile sync', () => {
  test('connects and saves the plan to the profile repo', async () => {
    const gh = github()
    vi.stubGlobal('fetch', gh.f)
    render(<App />)
    await connect()
    await status(/Saved/)
    expect(gh.profile().weekly).toEqual({})
    await addCourse()
    await status(/Saving/)
    await act(async () => { vi.advanceTimersByTime(3000) })
    await status(/Saved/)
    expect(Object.keys(gh.profile().weekly)).toHaveLength(2)
    expect(JSON.parse(localStorage.getItem('kitcanavari:sync')!).token).toBe('github_pat_test')
  })

  test('shows auth error and keeps editing', async () => {
    vi.stubGlobal('fetch', github(401).f)
    render(<App />)
    await connect()
    await status(/Token invalid/)
    await addCourse()
    await waitFor(() => expect(Object.keys(JSON.parse(localStorage.getItem(STORAGE_KEY)!).selected)).toHaveLength(2))
  })

  test('without a config the app never calls GitHub', async () => {
    const gh = github()
    vi.stubGlobal('fetch', gh.f)
    render(<App />)
    await addCourse()
    await act(async () => { vi.advanceTimersByTime(5000) })
    expect(gh.s.urls.filter((u) => u.includes('api.github.com'))).toEqual([])
  })

  test('disconnect stops saving and keeps a backup of the local plan', async () => {
    const before = localStorage.getItem(STORAGE_KEY)
    const gh = github()
    vi.stubGlobal('fetch', gh.f)
    render(<App />)
    await connect()
    await status(/Saved/)
    expect(localStorage.getItem(`${STORAGE_KEY}:backup`)).toBe(before)
    const puts = () => gh.f.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'PUT').length
    const afterConnect = puts()
    await addCourse()
    fireEvent.click(await status(/Saving/))
    fireEvent.click(await screen.findByRole('button', { name: 'Disconnect' }))
    await act(async () => { vi.advanceTimersByTime(5000) })
    expect(puts()).toBe(afterConnect)
    expect(localStorage.getItem('kitcanavari:profile-cache')).toBeNull()
    expect(await status(/Sync off/)).toBeTruthy()
  })

  test('the repo field needs exactly owner/name', async () => {
    vi.stubGlobal('fetch', github().f)
    render(<App />)
    fireEvent.click(await status(/Sync off/))
    fireEvent.input(await screen.findByLabelText('Token'), { target: { value: 't' } })
    fireEvent.input(screen.getByLabelText('Repo (owner/name)'), { target: { value: 'a/b/c' } })
    expect((screen.getByRole('button', { name: 'Connect' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.input(screen.getByLabelText('Repo (owner/name)'), { target: { value: 'efe-atas/kitcanavari-me' } })
    expect((screen.getByRole('button', { name: 'Connect' }) as HTMLButtonElement).disabled).toBe(false)
  })
})
