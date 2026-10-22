import { t } from '../../i18n'
import type { Sync } from '../../store'
import type { Lang } from '../../types'
import { Icon } from '../Icon'

export function SyncStatus({ lang, sync, onOpen }: { lang: Lang; sync: Sync; onOpen: () => void }) {
  const label = t(lang, `sync.${sync.status}`)
  return (
    <button type="button" class={`sync-status sync-${sync.status}`} onClick={onOpen} aria-label={label} title={label}>
      <Icon name="cloud" size={16} />
      <span class="sync-label">{label}</span>
    </button>
  )
}
