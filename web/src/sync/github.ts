// GitHub Contents API for the single profile.json in the user's private repo (spec §3).
import { isProfile, type Profile } from './profile'

export interface SyncConfig {
  owner: string
  repo: string
  token: string
}

export class AuthError extends Error {}
/** The file changed on the server since our sha (HTTP 409/422). */
export class ConflictError extends Error {}
/** The remote file is not a profile we understand; it must never be overwritten. */
export class InvalidRemoteError extends Error {}
export class OfflineError extends Error {}
/** GitHub's primary or secondary rate limit; not a token problem. */
export class RateLimitError extends Error {}
/** The repo does not exist, or the token cannot see it (GitHub answers 404 for both). */
export class RepoNotFoundError extends Error {}

const FILE = 'profile.json'

const repoUrl = (cfg: SyncConfig) => `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}`
const url = (cfg: SyncConfig) => `${repoUrl(cfg)}/contents/${FILE}`

const headers = (cfg: SyncConfig) => ({
  Authorization: `Bearer ${cfg.token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
})

function toBase64(text: string): string {
  let bin = ''
  for (const b of new TextEncoder().encode(text)) bin += String.fromCharCode(b)
  return btoa(bin)
}

function fromBase64(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ''))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

async function request(f: typeof fetch, input: string, init: RequestInit): Promise<Response> {
  let res: Response
  try {
    res = await f(input, init)
  } catch (e) {
    throw new OfflineError(e instanceof Error ? e.message : String(e))
  }
  if (res.status === 429 || (res.status === 403
    && (res.headers.get('x-ratelimit-remaining') === '0' || res.headers.has('retry-after')))) {
    throw new RateLimitError(`GitHub ${res.status}`)
  }
  if (res.status === 401 || res.status === 403) throw new AuthError(`GitHub ${res.status}`)
  return res
}

export async function getProfile(cfg: SyncConfig, f: typeof fetch = fetch): Promise<{ profile: Profile; sha: string } | null> {
  const res = await request(f, url(cfg), { headers: headers(cfg), cache: 'no-store' })
  if (res.status === 404) {
    // No file yet, or no repo / no access: only the first may be created.
    const repo = await request(f, repoUrl(cfg), { headers: headers(cfg), cache: 'no-store' })
    if (repo.status === 404) throw new RepoNotFoundError(`${cfg.owner}/${cfg.repo}`)
    return null
  }
  if (!res.ok) throw new Error(`GitHub ${res.status}`)
  const body = (await res.json()) as { sha: string; content: string }
  let parsed: unknown
  try {
    parsed = JSON.parse(fromBase64(body.content))
  } catch {
    throw new InvalidRemoteError(`${FILE} is not valid JSON`)
  }
  if (!isProfile(parsed)) throw new InvalidRemoteError(`${FILE} is not a version 1 profile`)
  return { profile: parsed, sha: body.sha }
}

export async function putProfile(cfg: SyncConfig, profile: Profile, sha: string | null, message: string,
  f: typeof fetch = fetch): Promise<string> {
  const body = { message, content: toBase64(JSON.stringify(profile, null, 1) + '\n'), ...(sha ? { sha } : {}) }
  const res = await request(f, url(cfg), { method: 'PUT', headers: headers(cfg), body: JSON.stringify(body) })
  if (res.status === 409) throw new ConflictError('GitHub 409')
  if (res.status === 422) {
    // 422 is also used for validation errors (e.g. a file that is too large); only a sha mismatch is a conflict.
    const message = String(((await res.json().catch(() => ({}))) as { message?: unknown }).message ?? '')
    if (/sha/i.test(message)) throw new ConflictError(`GitHub 422: ${message}`)
    throw new Error(`GitHub 422: ${message}`)
  }
  if (!res.ok) throw new Error(`GitHub ${res.status}`)
  return ((await res.json()) as { content: { sha: string } }).content.sha
}
