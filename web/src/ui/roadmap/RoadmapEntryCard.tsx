import { useEffect, useState } from 'preact/hooks'
import { t } from '../../i18n'
import { bucketOptions, moduleKind } from '../../logic/degree'
import type { ModuleRow } from '../../logic/handbook'
import { offeringIssue, PRIOR } from '../../logic/terms'
import { placeModule, removeFromRoadmap, setEntryCountAs, setGrade, setNote, setStatus } from '../../store'
import type { CoursesFile, Lang, ModuleStatus, RoadmapEntry, UserState } from '../../types'
import { Icon } from '../Icon'
import { termName } from './format'

interface Props {
  lang: Lang
  data: CoursesFile
  id: string
  entry: RoadmapEntry
  row: ModuleRow | null
  note: string
  inSchedule: boolean
  terms: string[]
  update: (fn: (s: UserState) => UserState) => void
}

const STATUSES: ModuleStatus[] = ['planned', 'passed', 'failed', 'dropped']

export function RoadmapEntryCard({ lang, data, id, entry, row, note, inSchedule, terms, update }: Props) {
  const [draft, setDraft] = useState(note)
  useEffect(() => setDraft(note), [note])
  const [gradeBad, setGradeBad] = useState(false)
  const commitGrade = (raw: string) => {
    const text = raw.trim().replace(',', '.')
    const value = text === '' ? null : Number(text)
    if (value !== null && !(value >= 1 && value <= 4)) return setGradeBad(true)
    setGradeBad(false)
    if (value !== entry.grade) update((s) => setGrade(s, id, value))
  }
  const issue = row ? offeringIssue(row, entry.term) : null
  const kind = row ? moduleKind(data, row) : null
  const places = row ? bucketOptions(row) : []
  return (
    <li class={`road-card status-${entry.status}`}>
      <div class="road-card-head">
        <span class="card-number">{id}</span>
        {row?.ects != null && <span class="road-cp">{t(lang, 'module.ects', { n: row.ects })}</span>}
        <button type="button" class="icon-button road-remove" aria-label={t(lang, 'road.remove')} title={t(lang, 'road.remove')}
          onClick={() => update((s) => removeFromRoadmap(s, id))}>
          <Icon name="close" size={14} />
        </button>
      </div>
      <p class="road-title">{row ? row.title : t(lang, 'road.unknown')}</p>
      {((kind && kind !== 'lecture') || inSchedule || issue) && (
        <p class="card-tags">
          {kind && kind !== 'lecture' && <span class={`tag tag-${kind}`}>{t(lang, `kind.${kind}`)}</span>}
          {inSchedule && <span class="tag tag-area"><Icon name="check" size={12} />{t(lang, 'road.inSchedule')}</span>}
          {issue && <span class="tag tag-warn"><Icon name="alert" size={12} />{t(lang, `road.warn.${issue}`)}</span>}
        </p>
      )}
      <div class="road-fields">
        <label>
          {t(lang, 'road.status')}
          <select value={entry.status} onChange={(e) => update((s) => setStatus(s, id, (e.target as HTMLSelectElement).value as ModuleStatus))}>
            {STATUSES.map((st) => <option key={st} value={st}>{t(lang, `road.status.${st}`)}</option>)}
          </select>
        </label>
        {entry.status === 'passed' && (
          <label>
            {t(lang, 'road.grade')}
            <input key={String(entry.grade)} type="text" inputMode="decimal" defaultValue={entry.grade === null ? '' : String(entry.grade)}
              aria-invalid={gradeBad} title={gradeBad ? t(lang, 'road.gradeInvalid') : undefined}
              onBlur={(e) => commitGrade((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => e.key === 'Enter' && commitGrade((e.target as HTMLInputElement).value)} />
          </label>
        )}
        {places.length > 1 && (
          <label>
            {t(lang, 'road.countAs')}
            <select value={entry.countAs ?? ''} onChange={(e) => update((s) => setEntryCountAs(s, id, (e.target as HTMLSelectElement).value || null))}>
              <option value="">{t(lang, 'road.countAuto')}</option>
              {places.map((p) => <option key={p} value={p}>{p === 'elective' || p === 'minor' || p === 'iq' ? t(lang, `bucket.${p}`) : p}</option>)}
            </select>
          </label>
        )}
        <label>
          {t(lang, 'road.move')}
          <select value={entry.term} onChange={(e) => update((s) => placeModule(s, id, (e.target as HTMLSelectElement).value))}>
            {[PRIOR, ...terms].map((term) => <option key={term} value={term}>{termName(lang, term)}</option>)}
          </select>
        </label>
      </div>
      <details class="road-note" open={!!note}>
        <summary>{t(lang, 'road.noteToggle')}</summary>
        <textarea aria-label={t(lang, 'road.note')} rows={2} value={draft}
          onInput={(e) => setDraft((e.target as HTMLTextAreaElement).value)}
          onBlur={() => draft !== note && update((s) => setNote(s, id, draft))} />
      </details>
    </li>
  )
}
