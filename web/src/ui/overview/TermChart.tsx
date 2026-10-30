import { useState } from 'preact/hooks'
import { t } from '../../i18n'
import { RULES } from '../../logic/degree'
import type { TermLoad } from '../../logic/insights'
import { PRIOR } from '../../logic/terms'
import type { Lang } from '../../types'
import { termName } from '../roadmap/format'

/** Room under the columns for the term labels (matches .chart-plot's padding-bottom). */
const AXIS = 28

/**
 * Credits per term as columns: passed at the base, planned on top, the usual 30 ECTS as a reference line.
 * Every value is also in the table below the chart.
 */
export function TermChart({ lang, terms }: { lang: Lang; terms: TermLoad[] }) {
  const cols = terms.filter((x) => x.term !== PRIOR || x.cp > 0)
  const [hover, setHover] = useState<string | null>(null)
  const top = Math.max(RULES.semesterTarget + 6, ...cols.map((c) => c.cp))
  const pct = (n: number) => `${(n / top) * 100}%`
  const short = (term: string) => (term === PRIOR ? t(lang, 'chart.prior') : termName(lang, term))
  const label = (c: TermLoad) => t(lang, 'chart.col', { term: short(c.term), passed: c.passed, planned: c.cp - c.passed, total: c.cp })

  return (
    <figure class="term-chart">
      <ul class="plain chart-legend" aria-hidden="true">
        <li><i class="is-passed" />{t(lang, 'chart.passed')}</li>
        <li><i class="is-planned" />{t(lang, 'chart.planned')}</li>
        <li><i class="is-target" />{t(lang, 'chart.target', { n: RULES.semesterTarget })}</li>
      </ul>
      <div class="chart-plot" role="list" aria-label={t(lang, 'chart.title')}>
        <span class="chart-target" style={{ bottom: `calc(${AXIS}px + (100% - ${AXIS}px) * ${RULES.semesterTarget / top})` }} aria-hidden="true"><span>{RULES.semesterTarget}</span></span>
        {cols.map((c) => (
          <div key={c.term} class={`chart-col${hover === c.term ? ' is-hover' : ''}${c.cp > RULES.semesterTarget + 6 ? ' is-heavy' : ''}`} role="listitem"
            tabIndex={0} aria-label={label(c)} onPointerEnter={() => setHover(c.term)} onPointerLeave={() => setHover(null)}
            onFocus={() => setHover(c.term)} onBlur={() => setHover(null)}>
            <div class="chart-stack" style={{ height: pct(c.cp) }}>
              {c.cp > 0 && <span class="chart-value">{c.cp}</span>}
              {c.cp - c.passed > 0 && <span class="chart-seg is-planned" style={{ flexGrow: c.cp - c.passed }} />}
              {c.passed > 0 && <span class="chart-seg is-passed" style={{ flexGrow: c.passed }} />}
            </div>
            <span class="chart-x">{short(c.term)}</span>
            {hover === c.term && (
              <span class="chart-tip" role="tooltip">
                <strong>{short(c.term)}</strong>
                <span><i class="is-passed" /><b>{c.passed}</b> {t(lang, 'chart.passed')}</span>
                <span><i class="is-planned" /><b>{c.cp - c.passed}</b> {t(lang, 'chart.planned')}</span>
              </span>
            )}
          </div>
        ))}
      </div>
      <details class="chart-table">
        <summary>{t(lang, 'chart.table')}</summary>
        <table>
          <thead><tr><th scope="col">{t(lang, 'chart.term')}</th><th scope="col">{t(lang, 'chart.passed')}</th><th scope="col">{t(lang, 'chart.planned')}</th><th scope="col">{t(lang, 'chart.total')}</th></tr></thead>
          <tbody>{cols.map((c) => <tr key={c.term}><th scope="row">{short(c.term)}</th><td>{c.passed}</td><td>{c.cp - c.passed}</td><td>{c.cp}</td></tr>)}</tbody>
        </table>
      </details>
    </figure>
  )
}
