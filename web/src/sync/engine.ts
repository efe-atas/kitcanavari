// Keeps the in-memory UserState and the remote profile.json in step (spec §3): debounced saves, replay of pending
// updates on a sha conflict, an offline cache that survives reloads, and a status for the top bar.
import type { UserState } from '../types'
import {
  AuthError, ConflictError, getProfile, InvalidRemoteError, OfflineError, putProfile, RateLimitError, RepoNotFoundError, type SyncConfig,
} from './github'
import { emptyProfile, isProfile, profileFromState, stateFromProfile, type Profile } from './profile'

export type SyncStatus =
  | 'off' | 'loading' | 'saved' | 'pending' | 'saving' | 'offline' | 'auth' | 'limited' | 'norepo' | 'conflict' | 'error'

export interface EngineDeps {
  get: (cfg: SyncConfig) => ReturnType<typeof getProfile>
  put: (cfg: SyncConfig, profile: Profile, sha: string | null, message: string) => Promise<string>
  storage: Storage | null
  setTimer: (fn: () => void, ms: number) => unknown
  clearTimer: (handle: unknown) => void
  /** Call `fn` once when the browser comes back online. */
  onOnline: (fn: () => void) => void
  device: string
}

export const CACHE_KEY = 'kitcanavari:profile-cache'
export const SAVE_DELAY_MS = 3000
const MAX_ATTEMPTS = 3

type Updater = (s: UserState) => UserState
interface Cache { profile: Profile; sha: string | null; dirty: boolean }

/** The parts of a profile a user edits; used to tell a real local plan from an empty one. */
const planOf = (p: Profile) => JSON.stringify([p.weekly, p.areas, p.modules, p.terms, p.notes, p.followed])
const isEmptyPlan = (s: UserState) => !Object.keys(s.selected).length && !(s.areas ?? []).length
  && !Object.keys(s.roadmap?.modules ?? {}).length && !Object.keys(s.roadmap?.notes ?? {}).length
  && !(s.followed ?? []).length

export class SyncEngine {
  private cfg: SyncConfig
  private deps: EngineDeps
  private onState: (s: UserState) => void
  private onStatus: (s: SyncStatus, detail?: string) => void

  private current: UserState | null = null
  /** The local plan when start() was called, before any edit made while loading. */
  private startLocal: UserState | null = null
  /** Last profile known to be on the server, and its sha. */
  private base: Profile | null = null
  private sha: string | null = null
  private pending: Updater[] = []
  private timer: unknown = null
  /** True once the first load (and, if needed, the first save) has succeeded. */
  private started = false
  private disposed = false
  private waitingOnline = false
  private status: SyncStatus = 'off'
  private work: Promise<void> = Promise.resolve()

  constructor(cfg: SyncConfig, deps: EngineDeps, onState: (s: UserState) => void, onStatus: (s: SyncStatus, detail?: string) => void) {
    this.cfg = cfg
    this.deps = deps
    this.onState = onState
    this.onStatus = onStatus
  }

  /** Resolves when queued network work has finished. */
  idle(): Promise<void> {
    return this.work
  }

  /** Stop for good: no more saves, timers, cache writes or callbacks (after disconnect or a new connection). */
  dispose(): void {
    this.disposed = true
    if (this.timer !== null) this.deps.clearTimer(this.timer)
    this.timer = null
  }

  start(local: UserState): Promise<void> {
    this.current = local
    this.startLocal = local
    return this.enqueue(() => this.doStart())
  }

  record(fn: Updater, next: UserState): void {
    if (this.disposed) return
    const prev = this.current
    this.current = next
    // Language and theme are not in the profile: nothing to save.
    if (prev && planOf(profileFromState(prev, this.base)) === planOf(profileFromState(next, this.base))
      && JSON.stringify(prev.lastSeenScrapedAt) === JSON.stringify(next.lastSeenScrapedAt)) return
    this.pending.push(fn)
    // Before the first load there is no server version to be dirty against; kitcanavari:v1 still has the edit.
    if (this.started) this.writeCache(true)
    if (!this.started || ['conflict', 'error', 'auth', 'norepo'].includes(this.status)) return
    this.setStatus('pending')
    this.schedule()
  }

  flush(): Promise<void> {
    return this.enqueue(() => this.doFlush())
  }

  retry(): Promise<void> {
    return this.started ? this.flush() : this.enqueue(() => this.doStart())
  }

  resolveConflict(keep: 'local' | 'remote'): Promise<void> {
    return this.enqueue(async () => {
      try {
        const remote = await this.deps.get(this.cfg)
        if (keep === 'remote' && remote) {
          this.pending = []
          this.adopt(remote.profile, remote.sha)
        } else {
          const profile = profileFromState(this.current!, remote?.profile ?? this.base)
          this.sha = await this.deps.put(this.cfg, profile, remote?.sha ?? null, this.message())
          this.base = profile
          this.pending = []
          this.writeCache(false)
        }
        this.started = true
        this.setStatus('saved')
      } catch (e) {
        this.fail(e)
      }
    })
  }

  private enqueue(job: () => Promise<void>): Promise<void> {
    const run = () => (this.disposed ? Promise.resolve() : job())
    this.work = this.work.then(run, run)
    return this.work
  }

  private schedule(): void {
    if (this.timer !== null) this.deps.clearTimer(this.timer)
    this.timer = this.deps.setTimer(() => { this.timer = null; void this.flush() }, SAVE_DELAY_MS)
  }

  private async doStart(): Promise<void> {
    const cache = this.readCache()
    if (cache) this.emit(this.replay(stateFromProfile(cache.profile, device(this.current!))))
    this.setStatus('loading')
    try {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        try {
          await this.startOnce(cache)
          return
        } catch (e) {
          // The file appeared or changed between our GET and PUT: look again.
          if (!(e instanceof ConflictError)) throw e
        }
      }
      this.setStatus('conflict')
    } catch (e) {
      this.fail(e)
    }
  }

  private async startOnce(cache: Cache | null): Promise<void> {
    const remote = await this.deps.get(this.cfg)
    if (this.disposed) return
    if (!remote) {
      const sent = this.pending.length
      const profile = profileFromState(this.current!, cache?.profile ?? null)
      this.sha = await this.deps.put(this.cfg, profile, null, this.message())
      this.base = profile
      this.pending = this.pending.slice(sent)
    } else if (cache?.dirty) {
      // Changes made offline before a reload: their updaters are gone, so they only apply onto the same version.
      this.base = remote.profile
      this.sha = remote.sha
      if (cache.sha !== remote.sha) {
        this.setStatus('conflict')
        return
      }
      this.sha = await this.deps.put(this.cfg, cache.profile, remote.sha, this.message())
      this.base = cache.profile
    } else if (!cache && !isEmptyPlan(this.startLocal!)
      && planOf(profileFromState(this.startLocal!, remote.profile)) !== planOf(remote.profile)) {
      // First connection on a device that already has its own plan: never drop it silently.
      this.base = remote.profile
      this.sha = remote.sha
      this.setStatus('conflict')
      return
    } else {
      this.adopt(remote.profile, remote.sha)
    }
    this.started = true
    this.writeCache(this.pending.length > 0)
    this.setStatus(this.pending.length ? 'pending' : 'saved')
    if (this.pending.length) this.schedule()
  }

  private async doFlush(): Promise<void> {
    if (!this.pending.length) return
    this.setStatus('saving')
    try {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const sent = this.pending.length
        const profile = profileFromState(this.current!, this.base)
        try {
          this.sha = await this.deps.put(this.cfg, profile, this.sha, this.message())
          this.base = profile
          this.pending = this.pending.slice(sent)
          this.writeCache(this.pending.length > 0)
          this.setStatus(this.pending.length ? 'pending' : 'saved')
          if (this.pending.length) this.schedule()
          return
        } catch (e) {
          if (!(e instanceof ConflictError)) throw e
          const remote = await this.deps.get(this.cfg)
          // Replay onto the server's version; if the file is gone, onto the last version we synced (never onto
          // the current state, which already contains the pending updates).
          const from = stateFromProfile(remote?.profile ?? this.base ?? emptyProfile(), device(this.current!))
          this.base = remote?.profile ?? null
          this.sha = remote?.sha ?? null
          this.emit(this.replay(from))
        }
      }
      this.setStatus('conflict')
    } catch (e) {
      this.fail(e)
    }
  }

  /** Apply local updates that the server has not seen yet. */
  private replay(from: UserState): UserState {
    return this.pending.reduce((s, fn) => fn(s), from)
  }

  /** Take a remote profile as the new base, keeping local updates not yet sent. */
  private adopt(profile: Profile, sha: string): void {
    this.base = profile
    this.sha = sha
    this.emit(this.replay(stateFromProfile(profile, device(this.current!))))
    this.writeCache(this.pending.length > 0)
  }

  private emit(s: UserState): void {
    this.current = s
    if (!this.disposed) this.onState(s)
  }

  private fail(e: unknown): void {
    const detail = e instanceof Error ? e.message : String(e)
    if (e instanceof OfflineError) {
      this.setStatus('offline', detail)
      if (!this.waitingOnline) {
        this.waitingOnline = true
        this.deps.onOnline(() => { this.waitingOnline = false; if (!this.disposed) void this.retry() })
      }
    } else if (e instanceof AuthError) this.setStatus('auth', detail)
    else if (e instanceof RateLimitError) this.setStatus('limited', detail)
    else if (e instanceof RepoNotFoundError) this.setStatus('norepo', detail)
    else if (e instanceof ConflictError) this.setStatus('conflict', detail)
    else if (e instanceof InvalidRemoteError) this.setStatus('error', detail)
    else this.setStatus('error', detail)
  }

  private setStatus(s: SyncStatus, detail?: string): void {
    this.status = s
    if (!this.disposed) this.onStatus(s, detail)
  }

  private message(): string {
    return `profile: update from ${this.deps.device}`
  }

  private readCache(): Cache | null {
    try {
      const raw = this.deps.storage?.getItem(CACHE_KEY)
      const c = raw ? (JSON.parse(raw) as Cache) : null
      return c && isProfile(c.profile) ? c : null
    } catch {
      return null
    }
  }

  private writeCache(dirty: boolean): void {
    if (!this.current || this.disposed) return
    const cache: Cache = { profile: profileFromState(this.current, this.base), sha: this.sha, dirty }
    try {
      this.deps.storage?.setItem(CACHE_KEY, JSON.stringify(cache))
    } catch {
      /* best effort; the server copy is the source of truth */
    }
  }
}

const device = (s: UserState): Pick<UserState, 'lang' | 'theme'> => ({ lang: s.lang, theme: s.theme })

export function defaultDeps(storage: Storage | null): EngineDeps {
  return {
    get: (cfg) => getProfile(cfg),
    put: (cfg, profile, sha, message) => putProfile(cfg, profile, sha, message),
    storage,
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    onOnline: (fn) => window.addEventListener('online', fn, { once: true }),
    device: (typeof navigator !== 'undefined' && navigator.platform) || 'web',
  }
}
