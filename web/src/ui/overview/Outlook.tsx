import { useState } from 'preact/hooks'
import { t } from '../../i18n'
import { RULES } from '../../logic/degree'
import { neededAverage, type Forecast, type GradeOutlook } from '../../logic/insights'
import type { Lang } from '../../types'
import { Icon } from '../Icon'
import { termName } from '../roadmap/format'

const grade = (lang: Lang, n: number) => n.toFixed(1).replace('.', lang === 'en' ? '.' : ',')
const TARGETS = Array.from({ length: 31 }, (_, i) => Math.round((1 + i * 0.1) * 10) / 10)

/** When the degree is likely done, and what the remaining grades need to be for a target average. */
export function Outlook({ lang, forecast: f, grades: g, projected }: { lang: Lang; forecast: Forecast; grades: GradeOutlook; projected: { average: number; cp: number; expectedCp: number } | null }) {
  const modules = RULES.total - RULES.thesis
  const [target, setTarget] = useState(() => (g.average !== null ? Math.max(1, Math.floor(g.average * 10) / 10) : 2.0))
  const need = neededAverage(g, target)
  return (
    <section class="card outlook-card" aria-labelledby="outlook-title">
      <header class="card-head">
        <div>
          <p class="eyebrow">{t(lang, 'out.eyebrow')}</p>
          <h2 id="outlook-title">{t(lang, 'out.title')}</h2>
        </div>
        <Icon name="cap" size={22} />
      </header>
      <div class="outlook-hero">
        <strong>{f.thesisTerm ? termName(lang, f.thesisTerm) : '—'}</strong>
        <span>{t(lang, f.assumed ? 'out.estimate' : 'out.planned')}</span>
      </div>
      <p class="outlook-text">
        {f.assumed
          ? t(lang, 'out.assumed', { cp: f.moduleCp, total: modules, n: f.extraTerms, per: RULES.semesterTarget, done: termName(lang, f.doneTerm!) })
          : t(lang, 'out.onPlan', { done: termName(lang, f.doneTerm!), thesis: termName(lang, f.thesisTerm!) })}
      </p>
      <div class="meter outlook-meter" role="img" aria-label={t(lang, 'out.meter', { cp: Math.min(f.moduleCp, modules), total: modules })}>
        <span style={{ width: `${Math.min(100, (f.moduleCp / modules) * 100)}%` }} />
      </div>

      <div class="whatif">
        <h3>{t(lang, 'gpa.title')}</h3>
        <p class="whatif-now">
          {g.average !== null
            ? <>{t(lang, 'gpa.now', { cp: g.gradedCp })} <strong>{grade(lang, Math.floor(g.average * 10 + 1e-9) / 10)}</strong></>
            : t(lang, 'gpa.noGrades')}
        </p>
        <label class="whatif-target">
          <span>{t(lang, 'gpa.target')}</span>
          <select value={String(target)} onChange={(e) => setTarget(Number((e.target as HTMLSelectElement).value))}>
            {TARGETS.map((x) => <option key={x} value={String(x)}>{grade(lang, x)}</option>)}
          </select>
        </label>
        <p class={`whatif-result is-${need.kind}`} aria-live="polite">
          {need.kind === 'need' && <>{t(lang, 'gpa.need', { cp: g.remainingCp })} <strong>{grade(lang, need.grade)}</strong></>}
          {need.kind === 'safe' && t(lang, 'gpa.safe')}
          {need.kind === 'out-of-reach' && t(lang, 'gpa.outOfReach')}
          {need.kind === 'nothing-left' && t(lang, 'gpa.nothingLeft')}
        </p>
        {projected && (
          <p class="whatif-projected">{t(lang, 'gpa.projected', { cp: projected.expectedCp })} <strong>{grade(lang, Math.floor(projected.average * 10 + 1e-9) / 10)}</strong></p>
        )}
        <p class="whatif-note">{t(lang, projected ? 'gpa.noteExpected' : 'gpa.note')}</p>
      </div>
    </section>
  )
}
