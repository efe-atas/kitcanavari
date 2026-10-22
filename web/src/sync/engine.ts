// Keeps the in-memory UserState and the remote profile.json in step (spec §3): debounced saves, replay of pending
// updates on a sha conflict, an offline cache that survives reloads, and a status for the top bar.
import type { UserState } from '../types'
import { AuthError, ConflictError, getProfile, InvalidRemoteError, OfflineError, putProfile, type SyncConfig } from './github'
import { isProfile, profileFromState, stateFromProfile, type Profile } from './profile'

export type SyncStatus = 'off' | 'loading' | 'saved' | 'pending' | 'saving' | 'offline' | 'auth' | 'conflict' | 'error'

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

export class SyncEngine {
  private current: UserState | null = null
  /** Last profile known to be on the server, and its sha. */
  private base: Profile | null = null
  private sha: string | null = null
  private pending: Updater[] = []
  private timer: unknown = null
  private started = false
  private status: SyncStatus = 'off'
  private work: Promise<void> = Promise.resolve()

  private cfg: SyncConfig
  private deps: EngineDeps
  private onState: (s: UserState) => void
  private onStatus: (s: SyncStatus, detail?: string) => void

  constructor(cfg: SyncConfig, deps: EngineDeps, onState: (s: UserState) => void, onStatus: (s: SyncStatus, detail?: string) => void) {
    this.cfg = cfg
    this.deps = deps
    this.onState = onState
    this.onStatus = onStatus
  }

  /** Resolves when queued network work has finished (tests, and before tearing the engine down). */
  idle(): Promise<void> {
    return this.work
  }

  start(local: UserState): Promise<void> {
    return this.enqueue(() => this.doStart(local))
  }

  record(fn: Updater, next: UserState): void {
    this.current = next
    this.pending.push(fn)
    this.writeCache(true)
    if (this.status === 'conflict' || this.status === 'error' || this.status === 'auth') return
    this.setStatus('pending')
    if (this.timer !== null) this.deps.clearTimer(this.timer)
    this.timer = this.deps.setTimer(() => { this.timer = null; void this.flush() }, SAVE_DELAY_MS)
  }

  flush(): Promise<void> {
    return this.enqueue(() => this.doFlush())
  }

  retry(): Promise<void> {
    return this.started ? this.flush() : this.start(this.current!)
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
        this.setStatus('saved')
      } catch (e) {
        this.fail(e)
      }
    })
  }

  private enqueue(job: () => Promise<void>): Promise<void> {
    this.work = this.work.then(job, job)
    return this.work
  }

  private async doStart(local: UserState): Promise<void> {
    this.current = local
    const cache = this.readCache()
    if (cache) this.emit(stateFromProfile(cache.profile, device(local)))
    this.setStatus('loading')
    try {
      const remote = await this.deps.get(this.cfg)
      this.started = true
      if (!remote) {
        const profile = profileFromState(this.current, cache?.profile ?? null)
        this.sha = await this.deps.put(this.cfg, profile, null, this.message())
        this.base = profile
        this.writeCache(false)
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
        this.writeCache(false)
      } else {
        this.adopt(remote.profile, remote.sha)
      }
      this.setStatus('saved')
    } catch (e) {
      this.fail(e)
    }
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
          if (this.pending.length) this.timer = this.deps.setTimer(() => { this.timer = null; void this.flush() }, SAVE_DELAY_MS)
          return
        } catch (e) {
          if (!(e instanceof ConflictError)) throw e
          const remote = await this.deps.get(this.cfg)
          this.base = remote?.profile ?? null
          this.sha = remote?.sha ?? null
          const from = remote ? stateFromProfile(remote.profile, device(this.current!)) : this.current!
          this.emit(this.pending.reduce((s, fn) => fn(s), from))
        }
      }
      this.setStatus('conflict')
    } catch (e) {
      this.fail(e)
    }
  }

  /** Replace local state with a remote profile. */
  private adopt(profile: Profile, sha: string): void {
    this.base = profile
    this.sha = sha
    this.emit(stateFromProfile(profile, device(this.current!)))
    this.writeCache(false)
  }

  private emit(s: UserState): void {
    this.current = s
    this.onState(s)
  }

  private fail(e: unknown): void {
    const detail = e instanceof Error ? e.message : String(e)
    if (e instanceof OfflineError) {
      this.setStatus('offline', detail)
      this.deps.onOnline(() => void this.retry())
    } else if (e instanceof AuthError) this.setStatus('auth', detail)
    else if (e instanceof InvalidRemoteError) this.setStatus('error', detail)
    else this.setStatus('error', detail)
  }

  private setStatus(s: SyncStatus, detail?: string): void {
    this.status = s
    this.onStatus(s, detail)
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
    if (!this.current) return
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
