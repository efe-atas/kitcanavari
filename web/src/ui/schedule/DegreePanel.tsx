import { t } from '../../i18n'
import { AREAS, areaSuggestions, degreeReport, RULES } from '../../logic/degree'
import { setArea } from '../../store'
import type { CoursesFile, Lang, UserState } from '../../types'
import { TermLink } from '../glossary/GlossaryView'
import { Icon } from '../Icon'

interface Props {
  lang: Lang
  data: CoursesFile
  state: UserState
  update: (fn: (s: UserState) => UserState) => void
}

/** One requirement: credits so far against a minimum (and optional maximum). */
function Row({ label, value, min, max, unit = 'ECTS', detail, term, lang }: {
  label: string; value: number; min: number; max?: number; unit?: string; detail?: string; term?: string; lang?: Lang
}) {
  const over = max !== undefined && value > max
  const done = value >= min && !over
  const pct = Math.min(100, (value / (max ?? min)) * 100)
  return (
    <li class={`req${done ? ' is-done' : ''}${over ? ' is-over' : ''}`}>
      <span class="req-label">
        {done && <Icon name="check" size={14} />}
        {over && <Icon name="alert" size={14} />}
        {label}
        {term && lang && <TermLink id={term} lang={lang} />}
      </span>
      <span class="req-value">
        <strong>{value}</strong> / {max !== undefined && min !== max ? `${min}–${max}` : min} {unit}
      </span>
      <span class="req-bar" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
        {max !== undefined && min < max && <i style={{ left: `${(min / max) * 100}%` }} />}
      </span>
      {detail && <span class="req-detail">{detail}</span>}
    </li>
  )
}

export function DegreePanel({ lang, data, state, update }: Props) {
  const r = degreeReport(state, data)
  const chosen = state.areas ?? []
  const suggestions = chosen.length < 2 ? areaSuggestions(state, data).filter((s) => !chosen.includes(s.area)).slice(0, 3) : []
  const sp = r.seminarCp + r.practicalCp

  return (
    <section class="panel degree" aria-labelledby="degree-title">
      <h3 id="degree-title">{t(lang, 'deg.title')}</h3>
      <p class="panel-sub">{t(lang, 'deg.sub')}</p>

      <div class="area-pickers">
        {[0, 1].map((i) => (
          <div key={i} class="area-picker">
            <span class="field-label">
              <label for={`area-${i}`}>{t(lang, 'deg.area', { n: i + 1 })}</label>
              {i === 0 && <TermLink id="area" lang={lang} />}
            </span>
            <select id={`area-${i}`} value={chosen[i] ?? ''} onChange={(e) => update((s) => setArea(s, i, (e.target as HTMLSelectElement).value || null))}
              disabled={i === 1 && !chosen[0]}>
              <option value="">{t(lang, 'deg.noArea')}</option>
              {AREAS.filter((a) => a === chosen[i] || !chosen.includes(a)).map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        ))}
      </div>

      {suggestions.length > 0 && (
        <div class="suggest">
          <p>{chosen.length ? t(lang, 'deg.suggest') : `${t(lang, 'deg.pickHint')} ${t(lang, 'deg.suggest')}`}</p>
          <ul>
            {suggestions.map((s) => (
              <li key={s.area}>
                <button type="button" class="chip" onClick={() => update((st) => setArea(st, chosen.length, s.area))}>
                  <Icon name="plus" size={12} />{s.area} <strong>{s.cp}</strong>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul class="reqs">
        {r.areas.map((a) => (
          <li key={a.area} class="req-group">
            <span class="req-group-title">{a.area}</span>
            <ul class="reqs">
              <Row label={t(lang, 'deg.areaCp')} value={a.cp} min={RULES.areaMin} />
              <Row label={t(lang, 'deg.lectureCp')} value={a.lectureCp} min={a.lectureMin} />
            </ul>
          </li>
        ))}
        <Row term="stamm" lang={lang} label={t(lang, 'deg.stamm')} value={r.stamm.count} min={RULES.stamm} unit="" detail={r.stamm.titles.join(', ') || undefined} />
        <Row term="seminar" lang={lang} label={t(lang, 'deg.seminar')} value={r.seminarCp} min={RULES.seminarMin} />
        <Row term="praktikum" lang={lang} label={t(lang, 'deg.practical')} value={r.practicalCp} min={RULES.practicalMin} />
        <Row label={t(lang, 'deg.sp')} value={sp} min={RULES.spMin} max={RULES.spMax} />
        <Row term="elective" lang={lang} label={t(lang, 'deg.elective')} value={r.electiveCp} min={RULES.electiveMin} max={RULES.electiveMax} />
      </ul>
      <ul class="reqs reqs-after">
        <Row term="minor" lang={lang} label={t(lang, 'bucket.minor')} value={r.minorCp} min={RULES.minorMin} max={RULES.minorMax} />
      </ul>
      <p class="note">{t(lang, 'deg.other', { iq: `${RULES.iqMin}–${RULES.iqMax}` })}</p>

      {r.issues.length > 0 && (
        <ul class="issues">
          {r.issues.map((i, n) => <li key={n}><Icon name="alert" size={14} />{t(lang, i.key, i.params)}</li>)}
        </ul>
      )}
      <a class="ext-link guide-link" href="#/guide">{t(lang, 'deg.guideLink')}<Icon name="arrow" size={14} /></a>
    </section>
  )
}
