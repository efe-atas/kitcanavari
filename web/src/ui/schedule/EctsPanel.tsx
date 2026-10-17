import { t } from '../../i18n'
import type { EctsSummary } from '../../logic/ects'
import type { Lang } from '../../types'

export function EctsPanel({ lang, ects }: { lang: Lang; ects: EctsSummary }) {
  return (
    <section class="panel">
      <h3>{t(lang, 'schedule.ects')}</h3>
      <p class="ects-total" data-testid="ects-total">{ects.total} <small>ECTS</small></p>
      {Object.keys(ects.byPart).length > 0 && (
        <ul class="ects-parts">
          {Object.entries(ects.byPart).map(([part, n]) => <li key={part}><span>{part}</span><strong>{n}</strong></li>)}
        </ul>
      )}
      {ects.duplicateModules.map((id) => <p key={id} class="note note-warn">{t(lang, 'schedule.duplicate', { id })}</p>)}
      {ects.unknown.length > 0 && <p class="note">{t(lang, 'schedule.unknownEcts', { ids: ects.unknown.join(', ') })}</p>}
    </section>
  )
}
