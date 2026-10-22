import { useState } from 'preact/hooks'
import { t } from '../../i18n'
import type { ModuleRow } from '../../logic/handbook'
import { offeringIssue } from '../../logic/terms'
import type { Lang } from '../../types'
import { Icon } from '../Icon'

interface Props {
  lang: Lang
  term: string
  termLabel: string
  rows: ModuleRow[]
  /** Module ids already in the roadmap. */
  taken: Set<string>
  onAdd: (id: string) => void
}

const LIMIT = 8

export function AddModule({ lang, term, termLabel, rows, taken, onAdd }: Props) {
  const [q, setQ] = useState('')
  const query = q.trim().toLowerCase()
  const hits = query.length < 2 ? [] : rows
    .filter((r) => !taken.has(r.id))
    .filter((r) => r.title.toLowerCase().includes(query) || r.id.toLowerCase().includes(query)
      || (r.hb?.coordinators ?? []).some((c) => c.toLowerCase().includes(query)))
    .slice(0, LIMIT)
  return (
    <div class="road-add">
      <label class="search-wrap">
        <Icon name="search" size={16} />
        <input type="search" class="search" value={q} placeholder={t(lang, 'road.search')}
          aria-label={t(lang, 'road.searchIn', { term: termLabel })} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
      </label>
      {hits.length > 0 && (
        <ul class="plain road-hits">
          {hits.map((r) => {
            const issue = offeringIssue(r, term)
            return (
              <li key={r.id}>
                <button type="button" class="road-hit" onClick={() => { onAdd(r.id); setQ('') }}>
                  <span>{r.title}</span>
                  <span class="muted">{r.id}{r.ects !== null ? ` · ${r.ects} ECTS` : ''}{issue ? ` · ${t(lang, `road.warn.${issue}`)}` : ''}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
