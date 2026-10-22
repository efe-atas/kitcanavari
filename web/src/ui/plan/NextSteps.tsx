import { useState } from 'preact/hooks'
import { t } from '../../i18n'
import type { Step } from '../../logic/nextSteps'
import type { Lang } from '../../types'
import { Icon } from '../Icon'
import { panelHref } from '../route'

const SHOWN = 3

/** The missing requirements as actions: "what do I do next". */
export function NextSteps({ lang, steps, onFocusAreas }: { lang: Lang; steps: Step[]; onFocusAreas: () => void }) {
  const [all, setAll] = useState(false)
  if (!steps.length) {
    return <p class="next-steps is-done"><Icon name="check" size={16} />{t(lang, 'step.done')}</p>
  }
  const shown = all ? steps : steps.slice(0, SHOWN)
  return (
    <section class="next-steps" aria-labelledby="next-steps-title">
      <h2 id="next-steps-title">{t(lang, 'step.title')}</h2>
      <ol>
        {shown.map((s, i) => (
          <li key={i} class={`step step-${s.severity}`}>
            <span class="step-text">{s.severity === 'warn' && <Icon name="alert" size={14} />}{t(lang, s.key, s.params)}</span>
            {s.action && 'focus' in s.action && (
              <button type="button" class="button-quiet" onClick={onFocusAreas}>{t(lang, 'step.pickAreas')}</button>
            )}
            {s.action && 'term' in s.action && (
              <a class="button-quiet" href={panelHref({ kind: 'add', term: s.action.term, row: s.action.row, filter: s.action.kind ?? null })}>
                <Icon name="plus" size={14} />{t(lang, `step.add.${s.action.kind ?? 'any'}`)}
              </a>
            )}
          </li>
        ))}
      </ol>
      {steps.length > SHOWN && (
        <button type="button" class="link-button" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? t(lang, 'step.fewer') : t(lang, 'step.more', { n: steps.length - SHOWN })}
        </button>
      )}
    </section>
  )
}
