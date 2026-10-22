import { describe, expect, test } from 'vitest'
import { AuthError, ConflictError, getProfile, InvalidRemoteError, OfflineError, putProfile, type SyncConfig } from '../src/sync/github'
import { emptyProfile } from '../src/sync/profile'

const cfg: SyncConfig = { owner: 'o', repo: 'r', token: 't' }
const URL_ = 'https://api.github.com/repos/o/r/contents/profile.json'

type Call = { url: string; init: RequestInit }
const fakeFetch = (respond: (c: Call) => Response) => {
  const calls: Call[] = []
  const f = (async (url: string, init: RequestInit = {}) => {
    const c = { url, init }
    calls.push(c)
    return respond(c)
  }) as unknown as typeof fetch
  return { f, calls }
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const header = (c: Call, k: string) => new Headers(c.init.headers).get(k)

describe('github client', () => {
  test('round-trips non-ASCII', async () => {
    const profile = { ...emptyProfile(), notes: { M1: 'Çok iyi ğüşıö' } }
    const put = fakeFetch(() => json({ content: { sha: 's2' } }))
    expect(await putProfile(cfg, profile, null, 'msg', put.f)).toBe('s2')
    const content = JSON.parse(String(put.calls[0].init.body)).content as string
    const get = fakeFetch(() => json({ sha: 's2', content: content.replace(/(.{60})/g, '$1\n') }))
    const got = await getProfile(cfg, get.f)
    expect(got).toEqual({ profile, sha: 's2' })
  })

  test('sends auth headers and no-store', async () => {
    const get = fakeFetch(() => json({}, 404))
    await getProfile(cfg, get.f)
    expect(get.calls[0].url).toBe(URL_)
    expect(header(get.calls[0], 'Authorization')).toBe('Bearer t')
    expect(header(get.calls[0], 'X-GitHub-Api-Version')).toBe('2022-11-28')
    expect(get.calls[0].init.cache).toBe('no-store')
    const put = fakeFetch(() => json({ content: { sha: 'x' } }))
    await putProfile(cfg, emptyProfile(), null, 'm', put.f)
    await putProfile(cfg, emptyProfile(), 'old', 'm', put.f)
    expect(put.calls[0].init.method).toBe('PUT')
    expect(JSON.parse(String(put.calls[0].init.body))).not.toHaveProperty('sha')
    expect(JSON.parse(String(put.calls[1].init.body)).sha).toBe('old')
  })

  test('maps statuses', async () => {
    expect(await getProfile(cfg, fakeFetch(() => json({}, 404)).f)).toBeNull()
    await expect(putProfile(cfg, emptyProfile(), 's', 'm', fakeFetch(() => json({}, 409)).f)).rejects.toBeInstanceOf(ConflictError)
    await expect(putProfile(cfg, emptyProfile(), 's', 'm', fakeFetch(() => json({}, 422)).f)).rejects.toBeInstanceOf(ConflictError)
    await expect(getProfile(cfg, fakeFetch(() => json({}, 401)).f)).rejects.toBeInstanceOf(AuthError)
    await expect(putProfile(cfg, emptyProfile(), 's', 'm', fakeFetch(() => json({}, 403)).f)).rejects.toBeInstanceOf(AuthError)
    const offline = (async () => { throw new TypeError('Failed to fetch') }) as unknown as typeof fetch
    await expect(getProfile(cfg, offline)).rejects.toBeInstanceOf(OfflineError)
    const garbage = btoa('{"version": 7}')
    await expect(getProfile(cfg, fakeFetch(() => json({ sha: 'a', content: garbage })).f)).rejects.toBeInstanceOf(InvalidRemoteError)
    await expect(getProfile(cfg, fakeFetch(() => json({ sha: 'a', content: btoa('not json') })).f)).rejects.toBeInstanceOf(InvalidRemoteError)
  })
})
