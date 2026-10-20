import { t } from '../../i18n'
import { RULES } from '../../logic/degree'
import type { EctsSummary } from '../../logic/ects'
import type { Lang } from '../../types'
import { TermLink } from '../glossary/GlossaryView'

export function EctsPanel({ lang, ects }: { lang: Lang; ects: EctsSummary }) {
  return (
    <section class="panel">
      <h3>{t(lang, 'schedule.ects')}<TermLink id="ects" lang={lang} /></h3>
      <p class="ects-total" data-testid="ects-total">{ects.total} <small>ECTS</small></p>
      <div class="term-bar" aria-hidden="true">
        <span style={{ width: `${Math.min(100, (ects.total / RULES.semesterTarget) * 100)}%` }} />
      </div>
      <p class="note">{t(lang, 'schedule.semester')}</p>
      {ects.duplicateModules.map((id) => <p key={id} class="note note-warn">{t(lang, 'schedule.duplicate', { id })}</p>)}
      {ects.unknown.length > 0 && <p class="note">{t(lang, 'schedule.unknownEcts', { ids: ects.unknown.join(', ') })}</p>}
    </section>
  )
}
