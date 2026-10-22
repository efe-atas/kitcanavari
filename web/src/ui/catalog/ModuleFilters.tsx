import { t } from '../../i18n'
import type { Kind } from '../../logic/degree'
import { emptyModuleFilters, type ModuleFilters as F } from '../../logic/handbook'
import type { Lang, Recurrence } from '../../types'
import { Icon } from '../Icon'
import { Chips, toggle } from './Filters'

interface Props {
  lang: Lang
  value: F
  onChange: (f: F) => void
  options: { ects: number[]; areas: string[] }
}

const KINDS: Kind[] = ['stamm', 'lecture', 'seminar', 'practical']
const RECURRENCES: Recurrence[] = ['winter', 'summer', 'each', 'irregular']

export function ModuleFilters({ lang, value, onChange, options }: Props) {
  const set = (patch: Partial<F>) => onChange({ ...value, ...patch })
  const dirty = JSON.stringify(value) !== JSON.stringify(emptyModuleFilters())
  return (
    <div class="filters">
      <label class="search-wrap">
        <Icon name="search" />
        <input type="search" class="search" placeholder={t(lang, 'filter.searchModules')} value={value.query}
          onInput={(e) => set({ query: (e.target as HTMLInputElement).value })} />
      </label>
      <div class="filter-row">
        <Chips label={t(lang, 'filter.kind')} all={KINDS} chosen={value.kinds} render={(v) => t(lang, `kind.${v}`)}
          onToggle={(v) => set({ kinds: toggle(value.kinds, v) })} />
        <Chips label={t(lang, 'filter.recurrence')} all={RECURRENCES} chosen={value.recurrence} render={(v) => t(lang, `rec.${v}`)}
          onToggle={(v) => set({ recurrence: toggle(value.recurrence, v) })} />
        <Chips label={t(lang, 'filter.ects')} all={options.ects} chosen={value.ects} render={(v) => String(v)}
          onToggle={(v) => set({ ects: toggle(value.ects, v) })} />
      </div>
      <div class="filter-row filter-row-secondary">
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
          <input type="checkbox" checked={value.offeredNow} onChange={(e) => set({ offeredNow: (e.target as HTMLInputElement).checked })} />
          {t(lang, 'filter.offeredNow')}
        </label>
        {dirty && (
          <button type="button" class="link-button" onClick={() => onChange(emptyModuleFilters())}>
            {t(lang, 'filter.reset')}
          </button>
        )}
      </div>
    </div>
  )
}
