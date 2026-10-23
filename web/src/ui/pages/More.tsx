import { t } from '../../i18n'
import type { Lang } from '../../types'
import { Icon, type IconName } from '../Icon'
import { pageHref, type Page } from '../route'
import { PageHead } from './PageHead'

const ITEMS: { kind: 'career' | 'changes' | 'help' | 'settings'; icon: IconName; page: Page }[] = [
  { kind: 'career', icon: 'briefcase', page: { kind: 'career', focus: null } },
  { kind: 'changes', icon: 'bell', page: { kind: 'changes' } },
  { kind: 'help', icon: 'help', page: { kind: 'help', id: null } },
  { kind: 'settings', icon: 'settings', page: { kind: 'settings' } },
]

/** Phones: the pages that do not fit in the bottom bar. */
export function More({ lang, alerts }: { lang: Lang; alerts: number }) {
  return (
    <div class="more">
      <PageHead title={t(lang, 'nav.more')} />
      <ul class="plain more-list">
        {ITEMS.map((x) => (
          <li key={x.kind}>
            <a class="more-item" href={pageHref(x.page)}>
              <Icon name={x.icon} size={20} />
              <span class="more-text">
                <strong>{t(lang, `nav.${x.kind}`)}</strong>
                <span>{t(lang, `page.${x.kind}.lead`)}</span>
              </span>
              {x.kind === 'changes' && alerts > 0 && <span class="nav-badge">{alerts}</span>}
              <Icon name="chevron" size={16} />
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
