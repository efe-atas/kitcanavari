import { t } from '../../i18n'
import type { CellItem } from '../../logic/matrix'
import type { Lang } from '../../types'
import { panelHref } from '../route'
import { Icon } from '../Icon'

const KIND_SHORT: Record<string, string> = { stamm: 'plan.kind.stamm', seminar: 'plan.kind.seminar', practical: 'plan.kind.practical' }

/** One course in the plan table; opens its detail. */
export function CoursePill({ lang, item, active = false }: { lang: Lang; item: CellItem; active?: boolean }) {
  const title = item.title ?? item.id
  const status = t(lang, `road.status.${item.status}`)
  const warn = item.issue ? t(lang, `road.warn.${item.issue}`) : null
  return (
    <a class={`pill status-${item.status}${item.issue ? ' has-issue' : ''}${active ? ' is-active' : ''}`} aria-current={active ? 'true' : undefined} href={panelHref({ kind: 'course', id: item.id })}
      aria-label={[title, item.ects !== null ? `${item.ects} ECTS` : null, status, item.grade !== null ? String(item.grade) : null, warn].filter(Boolean).join(', ')}>
      <span class="pill-title">{title}</span>
      <span class="pill-meta" aria-hidden="true">
        {item.status === 'passed' && <Icon name="check" size={12} />}
        {item.ects !== null && <span>{item.ects}</span>}
        {KIND_SHORT[item.kind] && <span class="pill-kind">{t(lang, KIND_SHORT[item.kind])}</span>}
        {item.grade !== null && <span class="pill-grade">{String(item.grade).replace('.', lang === 'tr' ? ',' : '.')}</span>}
        {item.issue && <span class="pill-warn"><Icon name="alert" size={12} /></span>}
      </span>
    </a>
  )
}
