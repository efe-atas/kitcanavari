import { useState } from 'preact/hooks'
import { t } from '../../i18n'
import { DEFAULT_PROFILE_REPO, type Sync } from '../../store'
import type { Lang } from '../../types'
import { Icon } from '../Icon'

const TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new'

export function SyncForm({ lang, sync }: { lang: Lang; sync: Sync }) {
  const [repo, setRepo] = useState(sync.config ? `${sync.config.owner}/${sync.config.repo}` : DEFAULT_PROFILE_REPO)
  const [token, setToken] = useState('')
  const repoOk = /^[\w.-]+\/[\w.-]+$/.test(repo.trim())
  const [owner, name] = repo.trim().split('/')
  const valid = repoOk && token.trim().length > 0
  const connected = !!sync.config

  return (
    <div class="sync-form">

        <p class={`sync-state sync-${sync.status}`}>
          <strong>{t(lang, `sync.${sync.status}`)}</strong>
          {['auth', 'error', 'offline', 'conflict', 'limited', 'norepo'].includes(sync.status) && (
            <span> — {t(lang, `sync.help.${sync.status}`)}</span>
          )}
          {sync.detail && sync.status === 'error' && <span class="muted"> ({sync.detail})</span>}
        </p>

        {sync.status === 'conflict' && (
          <div class="detail-actions">
            <button type="button" class="button" onClick={() => sync.resolve('local')}>{t(lang, 'sync.keepLocal')}</button>
            <button type="button" class="button-quiet" onClick={() => sync.resolve('remote')}>{t(lang, 'sync.keepRemote')}</button>
          </div>
        )}
        {connected && ['auth', 'error', 'offline', 'limited', 'norepo'].includes(sync.status) && (
          <div class="detail-actions">
            <button type="button" class="button-quiet" onClick={() => sync.retry()}>{t(lang, 'sync.retry')}</button>
          </div>
        )}

        {connected ? (
          <section>
            <p>{t(lang, 'sync.connectedTo', { repo: `${sync.config!.owner}/${sync.config!.repo}` })}</p>
            <button type="button" class="button-quiet" onClick={() => sync.disconnect()}>{t(lang, 'sync.disconnect')}</button>
          </section>
        ) : (
          <form class="sync-form" onSubmit={(e) => {
            e.preventDefault()
            if (valid) sync.connect({ owner, repo: name, token: token.trim() })
          }}>
            <p class="prose">{t(lang, 'sync.intro')}</p>
            <ol class="prose sync-steps">
              <li>{t(lang, 'sync.step1')}</li>
              <li>{t(lang, 'sync.step2')} <a class="ext-link" href={TOKEN_URL} target="_blank" rel="noopener">{t(lang, 'sync.tokenPage')}<Icon name="external" size={14} /></a></li>
              <li>{t(lang, 'sync.step3')}</li>
            </ol>
            <label class="field">
              {t(lang, 'sync.repo')}
              <input type="text" value={repo} spellcheck={false} onInput={(e) => setRepo((e.target as HTMLInputElement).value)} />
            </label>
            <label class="field">
              Token
              <input type="password" autocomplete="off" value={token} onInput={(e) => setToken((e.target as HTMLInputElement).value)} />
            </label>
            <button type="submit" class="button" disabled={!valid}>{t(lang, 'sync.connect')}</button>
          </form>
        )}
    </div>
  )
}
