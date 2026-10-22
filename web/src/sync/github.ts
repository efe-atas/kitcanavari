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

const FILE = 'profile.json'

const url = (cfg: SyncConfig) =>
  `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${FILE}`

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
  if (res.status === 401 || res.status === 403) throw new AuthError(`GitHub ${res.status}`)
  return res
}

export async function getProfile(cfg: SyncConfig, f: typeof fetch = fetch): Promise<{ profile: Profile; sha: string } | null> {
  const res = await request(f, url(cfg), { headers: headers(cfg), cache: 'no-store' })
  if (res.status === 404) return null
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
  if (res.status === 409 || res.status === 422) throw new ConflictError(`GitHub ${res.status}`)
  if (!res.ok) throw new Error(`GitHub ${res.status}`)
  return ((await res.json()) as { content: { sha: string } }).content.sha
}
