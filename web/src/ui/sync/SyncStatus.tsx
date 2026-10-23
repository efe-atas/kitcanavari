import { t } from '../../i18n'
import type { Sync } from '../../store'
import type { Lang } from '../../types'
import { Icon } from '../Icon'

export function SyncStatus({ lang, sync, onOpen }: { lang: Lang; sync: Sync; onOpen: () => void }) {
  const label = t(lang, `sync.${sync.status}`)
  // Only states that need the user speak up on phones; "off" and "saved" stay an icon with a name there.
  const quiet = ['off', 'saved', 'loading'].includes(sync.status)
  return (
    <button type="button" class={`sync-status sync-${sync.status}${quiet ? ' is-quiet' : ''}`} onClick={onOpen} aria-label={label} title={label}>
      <Icon name="cloud" size={16} />
      <span class="sync-label" aria-hidden="true">{label}</span>
    </button>
  )
}
