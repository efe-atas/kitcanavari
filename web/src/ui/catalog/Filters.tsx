import { t } from '../../i18n'
import type { Kind } from '../../logic/degree'
import { emptyFilters, type Filters as F } from '../../logic/filter'
import type { Lang } from '../../types'
import { Icon } from '../Icon'

interface Props {
  lang: Lang
  value: F
  onChange: (f: F) => void
  options: { types: string[]; languages: string[]; ects: number[]; areas: string[] }
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const KINDS: Kind[] = ['stamm', 'lecture', 'seminar', 'practical']

function Chips<T extends string | number>({ label, all, chosen, render, onToggle }: {
  label: string; all: T[]; chosen: T[]; render: (v: T) => string; onToggle: (v: T) => void
}) {
  if (!all.length) return null
  return (
    <fieldset class="chips">
      <legend>{label}</legend>
      {all.map((v) => (
        <button key={String(v)} type="button" class="chip" aria-pressed={chosen.includes(v)} onClick={() => onToggle(v)}>
          {render(v)}
        </button>
      ))}
    </fieldset>
  )
}

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

export function Filters({ lang, value, onChange, options }: Props) {
  const set = (patch: Partial<F>) => onChange({ ...value, ...patch })
  const dirty = JSON.stringify({ ...value, fieldId: null }) !== JSON.stringify({ ...emptyFilters(), fieldId: null })
  return (
    <div class="filters">
      <label class="search-wrap">
        <Icon name="search" />
        <input
          type="search"
          class="search"
          placeholder={t(lang, 'filter.search')}
          value={value.query}
          onInput={(e) => set({ query: (e.target as HTMLInputElement).value })}
        />
      </label>
      <div class="filter-row">
        <Chips label={t(lang, 'filter.kind')} all={KINDS} chosen={value.kinds} render={(v) => t(lang, `kind.${v}`)}
          onToggle={(v) => set({ kinds: toggle(value.kinds, v) })} />
        <Chips label={t(lang, 'filter.type')} all={options.types} chosen={value.types} render={(v) => v}
          onToggle={(v) => set({ types: toggle(value.types, v) })} />
        <Chips label={t(lang, 'filter.language')} all={options.languages} chosen={value.languages} render={(v) => v}
          onToggle={(v) => set({ languages: toggle(value.languages, v) })} />
        <Chips label={t(lang, 'filter.day')} all={DAYS} chosen={value.days} render={(v) => t(lang, `day.${v}`)}
          onToggle={(v) => set({ days: toggle(value.days, v) })} />
        <Chips label={t(lang, 'filter.ects')} all={options.ects} chosen={value.ects} render={(v) => String(v)}
          onToggle={(v) => set({ ects: toggle(value.ects, v) })} />
      </div>
      <div class="filter-row filter-row-secondary">
        <label class="time-field">
          {t(lang, 'filter.from')}
          <input type="time" step={900} value={value.from ?? ''} onInput={(e) => set({ from: (e.target as HTMLInputElement).value || null })} />
        </label>
        <label class="time-field">
          {t(lang, 'filter.to')}
          <input type="time" step={900} value={value.to ?? ''} onInput={(e) => set({ to: (e.target as HTMLInputElement).value || null })} />
        </label>
        {options.areas.length > 0 && (
          <label class="part-field">
            {t(lang, 'filter.area')}
            <select value={value.areas[0] ?? ''} onChange={(e) => {
              const v = (e.target as HTMLSelectElement).value
              set({ areas: v ? [v] : [] })
            }}>
              <option value="">—</option>
              {options.areas.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
        )}
        <label class="check">
          <input type="checkbox" checked={value.noConflict} onChange={(e) => set({ noConflict: (e.target as HTMLInputElement).checked })} />
          {t(lang, 'filter.noConflict')}
        </label>
        {dirty && (
          <button type="button" class="link-button" onClick={() => onChange({ ...emptyFilters(), fieldId: value.fieldId })}>
            {t(lang, 'filter.reset')}
          </button>
        )}
      </div>
    </div>
  )
}
