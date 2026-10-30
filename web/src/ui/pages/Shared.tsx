import { useMemo, useState } from 'preact/hooks'
import { t } from '../../i18n'
import { RULES, roadmapReport } from '../../logic/degree'
import { matrixCells, type RowId } from '../../logic/matrix'
import { decodePlan, planState } from '../../logic/share'
import { PRIOR } from '../../logic/terms'
import { adoptPlan } from '../../store'
import type { CoursesFile, HandbookFile, UserState } from '../../types'
import { Icon } from '../Icon'
import { rowLabel } from '../plan/labels'
import { termName } from '../roadmap/format'
import { pageHref } from '../route'
import { useToast } from '../toast'
import { PageHead } from './PageHead'

interface Props {
  code: string
  data: CoursesFile
  handbook: HandbookFile | null
  state: UserState
  update: (fn: (s: UserState) => UserState) => void
}

const ROWS: RowId[] = ['area0', 'area1', 'elective', 'minor', 'iq', 'other']

/** Someone's plan from a link, read-only, with a way to take it over as your own. */
export function Shared({ code, data, handbook, state, update }: Props) {
  const { lang } = state
  const toast = useToast()
  const [confirming, setConfirming] = useState(false)
  const plan = useMemo(() => decodePlan(code), [code])
  const view = useMemo(() => (plan ? planState(plan, state) : null), [plan, lang])
  const matrix = useMemo(() => (view ? matrixCells(view, data, handbook) : null), [view, data, handbook])
  const report = useMemo(() => (view ? roadmapReport(view, data, handbook) : null), [view, data, handbook])

  if (!plan || !view || !matrix || !report) {
    return (
      <div class="shared">
        <PageHead title={t(lang, 'share.viewTitle')} />
        <div class="empty-state"><Icon name="link" size={28} /><p>{t(lang, 'share.broken')}</p><a class="button" href="#/">{t(lang, 'nav.overview')}</a></div>
      </div>
    )
  }
  const adopt = () => {
    const before = state
    update((s) => adoptPlan(s, data, plan))
    location.hash = pageHref({ kind: 'plan' })
    toast({ message: t(lang, 'share.adopted'), action: { label: t(lang, 'toast.undo'), run: () => update(() => before) } })
  }
  const columns = [...matrix.columns.filter((c) => c !== PRIOR), PRIOR]

  return (
    <div class="shared">
      <PageHead title={t(lang, 'share.viewTitle')} lead={t(lang, 'share.viewLead')}>
        {!confirming && <button type="button" class="button" onClick={() => setConfirming(true)}><Icon name="download" size={16} />{t(lang, 'share.adopt')}</button>}
      </PageHead>
      {confirming && (
        <div class="callout shared-confirm" role="alert">
          <Icon name="alert" size={16} /><span>{t(lang, 'share.confirm')}</span>
          <button type="button" class="button is-small" onClick={adopt}>{t(lang, 'share.yes')}</button>
          <button type="button" class="button-quiet is-small" onClick={() => setConfirming(false)}>{t(lang, 'share.no')}</button>
        </div>
      )}
      <dl class="shared-facts">
        <div><dt>{t(lang, 'share.areas')}</dt><dd>{plan.areas.join(' · ') || '—'}</dd></div>
        <div><dt>ECTS</dt><dd><strong>{report.all.total}</strong> / {RULES.total}</dd></div>
        <div><dt>{t(lang, 'chart.passed')}</dt><dd><strong>{report.done.total}</strong></dd></div>
        {report.gpa !== null && <div><dt>{t(lang, 'gpa.short')}</dt><dd><strong>{String(report.gpa).replace('.', lang === 'tr' ? ',' : '.')}</strong></dd></div>}
      </dl>
      <div class="shared-terms">
        {columns.map((term) => {
          const items = ROWS.flatMap((row) => (matrix.cells[row][term] ?? []).map((it) => ({ ...it, row })))
          if (!items.length && term === PRIOR) return null
          return (
            <section key={term} class="card shared-term" aria-label={termName(lang, term)}>
              <header><h2>{termName(lang, term)}</h2><span><strong>{matrix.colTotals[term] ?? 0}</strong> ECTS</span></header>
              {items.length ? (
                <ul class="plain">
                  {items.map((it) => (
                    <li key={it.id} class={`status-${it.status}`}>
                      <span class="shared-title">{it.title ?? it.id}</span>
                      <span class="shared-meta">{it.ects ?? '?'} ECTS · {rowLabel(lang, view, it.row)}{it.kind !== 'lecture' ? ` · ${t(lang, `kind.${it.kind}`)}` : ''}
                        {it.status !== 'planned' ? ` · ${t(lang, `road.status.${it.status}`)}` : ''}{it.grade !== null ? ` ${String(it.grade).replace('.', lang === 'tr' ? ',' : '.')}` : ''}</span>
                    </li>
                  ))}
                </ul>
              ) : <p class="muted">{t(lang, 'pl.empty')}</p>}
            </section>
          )
        })}
      </div>
    </div>
  )
}
