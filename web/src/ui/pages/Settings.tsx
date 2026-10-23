import { useState } from 'preact/hooks'
import { t } from '../../i18n'
import { exportState, importState, setLang, toggleTheme, type Sync } from '../../store'
import type { CoursesFile, Lang, UserState } from '../../types'
import { download } from '../download'
import { fmtDate } from '../format'
import { Icon } from '../Icon'
import { SyncForm } from '../sync/SyncForm'
import { PageHead } from './PageHead'

interface Props {
  lang: Lang
  state: UserState
  update: (fn: (s: UserState) => UserState) => void
  sync: Sync
  checkedAt: string
  data: CoursesFile
}

export function Settings({ lang, state, update, sync, checkedAt, data }: Props) {
  const theme = state.theme ?? 'light'
  const [importError, setImportError] = useState(false)
  const onImport = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const next = importState(await file.text())
    setImportError(!next)
    if (next) update(() => next)
    ;(e.target as HTMLInputElement).value = ''
  }

  return (
    <div class="settings">
      <PageHead title={t(lang, 'nav.settings')} lead={t(lang, 'page.settings.lead')} />

      <section class="settings-card" aria-labelledby="set-look">
        <h2 id="set-look">{t(lang, 'set.look')}</h2>
        <div class="setting-row">
          <span class="setting-label" id="set-lang">{t(lang, 'set.lang')}</span>
          <div class="segmented" role="group" aria-labelledby="set-lang">
            {(['tr', 'en'] as Lang[]).map((l) => (
              <button key={l} type="button" aria-pressed={lang === l} onClick={() => update((s) => setLang(s, l))}>{t(lang, `set.lang.${l}`)}</button>
            ))}
          </div>
        </div>
        <div class="setting-row">
          <span class="setting-label" id="set-theme">{t(lang, 'set.theme')}</span>
          <div class="segmented" role="group" aria-labelledby="set-theme">
            {(['light', 'dark'] as const).map((x) => (
              <button key={x} type="button" aria-pressed={theme === x} onClick={() => theme !== x && update(toggleTheme)}>
                <Icon name={x === 'light' ? 'sun' : 'moon'} size={16} />{t(lang, `set.theme.${x}`)}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section class="settings-card" aria-labelledby="set-sync">
        <h2 id="set-sync">{t(lang, 'sync.title')}</h2>
        <SyncForm lang={lang} sync={sync} />
      </section>

      <section class="settings-card" aria-labelledby="set-backup">
        <h2 id="set-backup">{t(lang, 'set.backup')}</h2>
        <p class="settings-text">{t(lang, 'set.backupText')}</p>
        <div class="settings-actions">
          <button type="button" class="button-quiet" onClick={() => download('kit-plan.json', exportState(state), 'application/json')}>
            <Icon name="download" size={16} />{t(lang, 'schedule.export')}
          </button>
          <label class="button-quiet">
            <Icon name="upload" size={16} />{t(lang, 'schedule.import')}
            <input type="file" accept="application/json,.json" aria-label={t(lang, 'schedule.import')} hidden onChange={onImport} />
          </label>
        </div>
        {importError && <p class="note note-warn" role="alert">{t(lang, 'schedule.importError')}</p>}
      </section>

      <section class="settings-card" aria-labelledby="set-data">
        <h2 id="set-data">{t(lang, 'set.data')}</h2>
        <dl class="facts">
          <div><dt>{t(lang, 'set.checked')}</dt><dd>{fmtDate(lang, checkedAt)}</dd></div>
          <div><dt>{t(lang, 'set.term')}</dt><dd>{data.meta.term}</dd></div>
          <div><dt>{t(lang, 'set.spo')}</dt><dd>{data.meta.spo}</dd></div>
        </dl>
      </section>
    </div>
  )
}
