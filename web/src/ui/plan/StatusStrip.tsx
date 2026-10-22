import { t } from '../../i18n'
import { RULES, type RoadmapReport } from '../../logic/degree'
import type { Lang } from '../../types'
import { TermLink } from '../glossary/GlossaryView'
import { Icon } from '../Icon'

function Fact({ label, value, min, term, lang }: { label: string; value: number; min: number; term?: string; lang: Lang }) {
  const done = value >= min
  return (
    <div class={`fact${done ? ' is-done' : ' is-missing'}`}>
      <span class="fact-value">{done && <Icon name="check" size={14} />}<strong>{value}</strong> / {min}</span>
      <span class="fact-label">{label}{term && <TermLink id={term} lang={lang} />}</span>
    </div>
  )
}

/** The three numbers that answer "how far along am I". */
export function StatusStrip({ lang, report }: { lang: Lang; report: RoadmapReport }) {
  const { all, done } = report
  const modulesTarget = RULES.total - RULES.thesis
  const sp = all.seminarCp + all.practicalCp
  return (
    <section class="status-strip" aria-label={t(lang, 'plan.status')}>
      <div class="fact fact-lead">
        <span class="fact-value"><strong>{all.total}</strong> / {modulesTarget} ECTS</span>
        <span class="fact-label">{t(lang, 'plan.totalLabel', { done: done.total })}</span>
      </div>
      <Fact lang={lang} label={t(lang, 'deg.stamm')} value={all.stamm.count} min={RULES.stamm} term="stamm" />
      <Fact lang={lang} label={t(lang, 'plan.spLabel')} value={sp} min={RULES.spMin} term="seminar" />
      {report.gpa !== null && (
        <div class="fact">
          <span class="fact-value"><strong>{String(report.gpa).replace('.', lang === 'tr' ? ',' : '.')}</strong></span>
          <span class="fact-label">{t(lang, 'plan.gpa', { cp: report.gradedCp })}</span>
        </div>
      )}
    </section>
  )
}
