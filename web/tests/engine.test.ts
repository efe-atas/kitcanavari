import { describe, expect, test, vi } from 'vitest'
import { SyncEngine, type EngineDeps, type SyncStatus } from '../src/sync/engine'
import { AuthError, ConflictError, InvalidRemoteError, OfflineError } from '../src/sync/github'
import { emptyProfile, profileFromState, type Profile } from '../src/sync/profile'
import { addEvent, defaultState, setArea, toggleTheme } from '../src/store'
import type { UserState } from '../src/types'
import { ev } from './fixtures'

const CACHE = 'kitcanavari:profile-cache'
const cfg = { owner: 'o', repo: 'r', token: 't' }

const memStorage = (): Storage => {
  const m = new Map<string, string>()
  return {
    get length() { return m.size }, clear: () => m.clear(), getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null, removeItem: (k) => { m.delete(k) }, setItem: (k, v) => { m.set(k, String(v)) },
  }
}

function server(initial: Profile | null = null) {
  let n = 0
  const s = { profile: initial, sha: initial ? 'v0' : null as string | null, puts: 0, failPut: null as null | (() => Error), failGet: null as null | (() => Error) }
  const get: EngineDeps['get'] = vi.fn(async () => {
    if (s.failGet) throw s.failGet()
    return s.profile ? { profile: structuredClone(s.profile), sha: s.sha! } : null
  })
  const put: EngineDeps['put'] = vi.fn(async (_c, profile, sha) => {
    if (s.failPut) throw s.failPut()
    if ((s.sha ?? null) !== (sha ?? null)) throw new ConflictError('409')
    s.puts++
    s.profile = structuredClone(profile)
    s.sha = `v${++n}`
    return s.sha
  })
  /** Another device creates the file. */
  const remoteEditInit = (p: Profile) => { s.profile = structuredClone(p); s.sha = `v${++n}` }
  /** Another device writes directly. */
  const remoteEdit = (fn: (p: Profile) => Profile) => { s.profile = fn(structuredClone(s.profile!)); s.sha = `v${++n}` }
  return { s, get, put, remoteEdit, remoteEditInit }
}

function setup(srv: ReturnType<typeof server>, storage = memStorage()) {
  let timer: (() => void) | null = null
  let online: (() => void) | null = null
  const states: UserState[] = []
  const statuses: SyncStatus[] = []
  const deps: EngineDeps = {
    get: srv.get, put: srv.put, storage, device: 'test',
    setTimer: (fn) => { timer = fn; return 1 }, clearTimer: () => { timer = null },
    onOnline: (fn) => { online = fn },
  }
  const engine = new SyncEngine(cfg, deps, (s) => states.push(s), (s) => statuses.push(s))
  return {
    engine, storage, states, statuses,
    fire: async () => { const t = timer; timer = null; t?.(); await engine.idle() },
    goOnline: async () => { online?.(); await engine.idle() },
    hasTimer: () => timer !== null,
  }
}

const withEvent = (id: string, s = defaultState()) => addEvent(s, ev(id, [], { moduleIds: [`M-${id}`] }))

describe('SyncEngine', () => {
  test('creates the remote profile from local state on first connect', async () => {
    const srv = server()
    const t = setup(srv)
    await t.engine.start(withEvent('e1'))
    expect(srv.s.profile!.weekly).toHaveProperty('e1')
    expect(t.statuses.at(-1)).toBe('saved')
  })

  test('loads an existing remote profile', async () => {
    const srv = server({ ...emptyProfile(), areas: ['Telematics'] })
    const t = setup(srv)
    await t.engine.start(defaultState())
    expect(t.states.at(-1)!.areas).toEqual(['Telematics'])
    expect(srv.s.puts).toBe(0)
  })

  test('debounces saves', async () => {
    const srv = server(emptyProfile())
    const t = setup(srv)
    await t.engine.start(defaultState())
    const a = withEvent('e1')
    t.engine.record((s) => withEvent('e1', s), a)
    t.engine.record((s) => withEvent('e2', s), withEvent('e2', a))
    expect(srv.s.puts).toBe(0)
    expect(t.statuses.at(-1)).toBe('pending')
    await t.fire()
    expect(srv.s.puts).toBe(1)
    expect(Object.keys(srv.s.profile!.weekly).sort()).toEqual(['e1', 'e2'])
    expect(t.statuses.at(-1)).toBe('saved')
  })

  test('replays pending updates on conflict', async () => {
    const srv = server(emptyProfile())
    const t = setup(srv)
    await t.engine.start(defaultState())
    srv.remoteEdit((p) => ({ ...p, areas: ['Telematics'] }))
    t.engine.record((s) => withEvent('e2', s), withEvent('e2'))
    await t.fire()
    expect(srv.s.profile!.areas).toEqual(['Telematics'])
    expect(srv.s.profile!.weekly).toHaveProperty('e2')
    const merged = t.states.at(-1)!
    expect(merged.areas).toEqual(['Telematics'])
    expect(merged.selected).toHaveProperty('e2')
    expect(t.statuses.at(-1)).toBe('saved')
  })

  test('gives up after three conflicts and lets the user pick', async () => {
    const srv = server({ ...emptyProfile(), areas: ['Telematics'] })
    const t = setup(srv)
    await t.engine.start(defaultState())
    srv.s.failPut = () => new ConflictError('409')
    t.engine.record((s) => setArea(s, 0, 'Data Science'), setArea(t.states.at(-1)!, 0, 'Data Science'))
    await t.fire()
    expect(t.statuses.at(-1)).toBe('conflict')
    expect(srv.put).toHaveBeenCalledTimes(3)
    srv.s.failPut = null
    await t.engine.resolveConflict('remote')
    expect(t.states.at(-1)!.areas).toEqual(['Telematics'])
    expect(t.statuses.at(-1)).toBe('saved')
  })

  test('keeping the local version overwrites the server', async () => {
    const srv = server(emptyProfile())
    const t = setup(srv)
    await t.engine.start(defaultState())
    srv.s.failPut = () => new ConflictError('409')
    t.engine.record((s) => withEvent('e1', s), withEvent('e1'))
    await t.fire()
    srv.s.failPut = null
    srv.remoteEdit((p) => ({ ...p, areas: ['Telematics'] }))
    await t.engine.resolveConflict('local')
    expect(srv.s.profile!.weekly).toHaveProperty('e1')
    expect(t.statuses.at(-1)).toBe('saved')
  })

  test('offline changes survive reload', async () => {
    const storage = memStorage()
    const srv = server(emptyProfile())
    const t = setup(srv, storage)
    await t.engine.start(defaultState())
    srv.s.failPut = () => new OfflineError('offline')
    t.engine.record((s) => withEvent('e1', s), withEvent('e1'))
    await t.fire()
    expect(t.statuses.at(-1)).toBe('offline')
    expect(JSON.parse(storage.getItem(CACHE)!).dirty).toBe(true)

    srv.s.failPut = null
    const t2 = setup(srv, storage)
    await t2.engine.start(defaultState())
    expect(srv.s.profile!.weekly).toHaveProperty('e1')
    expect(t2.states.at(-1)!.selected).toHaveProperty('e1')
    expect(JSON.parse(storage.getItem(CACHE)!).dirty).toBe(false)
  })

  test('sends queued changes when the connection returns', async () => {
    const srv = server(emptyProfile())
    const t = setup(srv)
    await t.engine.start(defaultState())
    srv.s.failPut = () => new OfflineError('offline')
    t.engine.record((s) => withEvent('e1', s), withEvent('e1'))
    await t.fire()
    srv.s.failPut = null
    await t.goOnline()
    expect(srv.s.profile!.weekly).toHaveProperty('e1')
    expect(t.statuses.at(-1)).toBe('saved')
  })

  test('invalid remote is never overwritten', async () => {
    const srv = server()
    srv.s.failGet = () => new InvalidRemoteError('bad')
    const t = setup(srv)
    await t.engine.start(withEvent('e1'))
    t.engine.record((s) => withEvent('e2', s), withEvent('e2'))
    await t.fire()
    expect(t.statuses.at(-1)).toBe('error')
    expect(srv.put).not.toHaveBeenCalled()
  })

  test('auth error keeps local state', async () => {
    const storage = memStorage()
    const srv = server(emptyProfile())
    const t = setup(srv, storage)
    await t.engine.start(defaultState())
    const before = t.states.length
    srv.s.failPut = () => new AuthError('401')
    t.engine.record((s) => withEvent('e1', s), withEvent('e1'))
    await t.fire()
    expect(t.statuses.at(-1)).toBe('auth')
    expect(t.states.length).toBe(before)
    expect(JSON.parse(storage.getItem(CACHE)!).dirty).toBe(true)
    expect(profileFromState(withEvent('e1'), null).weekly).toHaveProperty('e1')
  })

  test('connecting with a local plan to an existing remote asks instead of discarding it', async () => {
    const srv = server({ ...emptyProfile(), areas: ['Telematics'] })
    const t = setup(srv)
    await t.engine.start(withEvent('e1'))
    expect(t.statuses.at(-1)).toBe('conflict')
    expect(t.states.some((s) => !s.selected.e1)).toBe(false)
    expect(srv.s.puts).toBe(0)
    await t.engine.resolveConflict('local')
    expect(srv.s.profile!.weekly).toHaveProperty('e1')
  })

  test('edits made while the first load is in flight are kept and sent', async () => {
    const srv = server({ ...emptyProfile(), areas: ['Telematics'] })
    let release!: () => void
    const gate = new Promise<void>((r) => { release = r })
    const realGet = srv.get
    srv.get = vi.fn(async (c) => { await gate; return realGet(c) })
    const t = setup(srv)
    const started = t.engine.start(defaultState())
    t.engine.record((s) => withEvent('e1', s), withEvent('e1'))
    release()
    await started
    const shown = t.states.at(-1)!
    expect(shown.areas).toEqual(['Telematics'])
    expect(shown.selected).toHaveProperty('e1')
    await t.fire()
    expect(srv.s.profile!.weekly).toHaveProperty('e1')
    expect(srv.s.profile!.areas).toEqual(['Telematics'])
  })

  test('a failed first save is retried when the connection returns', async () => {
    const srv = server()
    srv.s.failPut = () => new OfflineError('offline')
    const t = setup(srv)
    await t.engine.start(withEvent('e1'))
    expect(t.statuses.at(-1)).toBe('offline')
    srv.s.failPut = null
    await t.goOnline()
    expect(srv.s.profile!.weekly).toHaveProperty('e1')
    expect(t.statuses.at(-1)).toBe('saved')
  })

  test('a file created elsewhere during the first connect is loaded, not an error', async () => {
    const srv = server()
    const realGet = srv.get
    srv.get = vi.fn(async (c) => {
      const r = await realGet(c)
      if (!srv.s.profile) srv.remoteEditInit({ ...emptyProfile(), areas: ['Telematics'] })
      return r
    })
    const t = setup(srv)
    await t.engine.start(defaultState())
    expect(t.statuses.at(-1)).toBe('saved')
    expect(t.states.at(-1)!.areas).toEqual(['Telematics'])
  })

  test('a disposed engine stops saving and writing the cache', async () => {
    const storage = memStorage()
    const srv = server(emptyProfile())
    const t = setup(srv, storage)
    await t.engine.start(defaultState())
    t.engine.record((s) => withEvent('e1', s), withEvent('e1'))
    t.engine.dispose()
    storage.removeItem(CACHE)
    await t.fire()
    t.engine.record((s) => withEvent('e2', s), withEvent('e2'))
    expect(srv.s.puts).toBe(0)
    expect(storage.getItem(CACHE)).toBeNull()
  })

  test('device-only changes do not save', async () => {
    const srv = server(emptyProfile())
    const t = setup(srv)
    await t.engine.start(defaultState())
    t.engine.record(toggleTheme, toggleTheme(defaultState()))
    expect(t.hasTimer()).toBe(false)
    expect(t.statuses.at(-1)).toBe('saved')
    expect(srv.s.puts).toBe(0)
  })
})
