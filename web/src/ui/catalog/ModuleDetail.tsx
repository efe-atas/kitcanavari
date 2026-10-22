import { useEffect, useRef } from 'preact/hooks'
import { t } from '../../i18n'
import { bucketOptions, moduleKind } from '../../logic/degree'
import type { ModuleRow } from '../../logic/handbook'
import type { CareerData, CoursesFile, Lang, SkillId } from '../../types'
import { topRoles } from '../../logic/career'
import { roleTitle } from '../career/model'
import { PRIOR } from '../../logic/terms'
import { TermLink } from '../glossary/GlossaryView'
import { termName } from '../roadmap/format'
import { Icon } from '../Icon'

interface Props {
  lang: Lang
  data: CoursesFile
  career: CareerData | null
  row: ModuleRow
  myAreas: string[]
  /** Open one of this term's courses of the module. */
  onOpenEvent: (eventId: string) => void
  /** Roadmap terms, and the term the module is already in. */
  terms: string[]
  placedTerm: string | null
  onPlace: (term: string) => void
  onClose: () => void
}

const paragraphs = (text: string) => text.split('\n\n').map((p, i) => <p key={i}>{p}</p>)

export function ModuleDetail({ lang, data, career, row, myAreas, onOpenEvent, terms, placedTerm, onPlace, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [row.id])

  const kind = moduleKind(data, row)
  const places = bucketOptions(row)
  const { hb, current } = row
  const sections: [string, string | null | undefined][] = hb
    ? [['module.objectives', hb.competenceGoals], ['module.content', hb.content],
      ['module.prerequisites', hb.prerequisites], ['module.recommendations', hb.recommendations]]
    : [['module.exam', current?.description.exam], ['module.prerequisites', current?.description.prerequisites],
      ['module.objectives', current?.description.objectives], ['module.content', current?.description.content]]

  return (
    <div class="detail-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="detail" role="dialog" aria-modal="true" aria-labelledby="module-detail-title" tabIndex={-1} ref={ref}>
        <header class="detail-head">
          <div>
            <p class="detail-kicker">
              <span>{row.id}</span>
              {row.ects !== null && <span>{t(lang, 'module.ects', { n: row.ects })}</span>}
              <span>{t(lang, `rec.${row.recurrence}`)}</span>
              {kind !== 'lecture' && <span class={`tag tag-${kind}`}>{t(lang, `kind.${kind}`)}</span>}
            </p>
            <h2 id="module-detail-title">{row.title}</h2>
          </div>
          <button type="button" class="icon-button" onClick={onClose} aria-label={t(lang, 'event.close')}><Icon name="close" size={20} /></button>
        </header>

        {!hb && <p class="muted">{t(lang, 'module.notInHandbook')}</p>}

        <div class="detail-actions road-place">
          <label>
            {t(lang, 'road.placeIn')}
            <select value="" onChange={(e) => {
              const v = (e.target as HTMLSelectElement).value
              if (v) onPlace(v)
            }}>
              <option value="">—</option>
              {[PRIOR, ...terms].map((term) => <option key={term} value={term}>{termName(lang, term)}</option>)}
            </select>
          </label>
          {placedTerm && <span class="tag tag-area"><Icon name="check" size={12} />{t(lang, 'road.inRoadmap', { term: termName(lang, placedTerm) })}</span>}
        </div>

        <section>
          <h3>{t(lang, 'module.thisTerm')}</h3>
          {row.eventIds.length ? (
            <ul class="plain module-events">
              {row.eventIds.map((id) => data.events[id]).filter(Boolean).map((ev) => (
                <li key={ev.id}>
                  <button type="button" class="link-button" onClick={() => onOpenEvent(ev.id)}>{ev.title}</button>
                  <span class="muted"> {ev.typeCode} · {ev.number}</span>
                </li>
              ))}
            </ul>
          ) : <p class="muted">{t(lang, 'module.notThisTerm')}</p>}
        </section>

        {career && (
          <section class="module-skills">
            <h3>{t(lang, 'module.skills')}</h3>
            {career.skills.modules[row.id] ? (
              <>
                <ul class="plain">
                  {(Object.entries(career.skills.modules[row.id]!) as [SkillId, [number, string]][])
                    .sort((a, b) => b[1][0] - a[1][0])
                    .map(([s, [score, reason]]) => (
                      <li key={s}><span class="tag tag-skill">{t(lang, `skill.${s}`)} {'●'.repeat(score)}{'○'.repeat(3 - score)}</span> {reason}</li>
                    ))}
                </ul>
                {topRoles(row.id, career).length > 0 && (
                  <p><strong>{t(lang, 'module.topRoles')}:</strong> {topRoles(row.id, career).map((r) => roleTitle(career, r.role, lang)).join(', ')}</p>
                )}
              </>
            ) : <p class="muted">{t(lang, 'module.unscored')}</p>}
          </section>
        )}

        {places.length > 0 && (
          <section>
            <h3>{t(lang, 'module.areas')} <TermLink id="area" lang={lang} /></h3>
            <p class="place-list">
              {places.map((p) => (
                <span key={p} class={`tag ${myAreas.includes(p) ? 'tag-area' : 'tag-quiet'}`}>
                  {myAreas.includes(p) && <Icon name="check" size={12} />}
                  {p === 'elective' || p === 'minor' || p === 'iq' ? t(lang, `bucket.${p}`) : p}
                </span>
              ))}
            </p>
          </section>
        )}

        {hb && hb.coordinators.length > 0 && (
          <section>
            <h3>{t(lang, 'module.coordinators')}</h3>
            <ul class="plain lecturers">{hb.coordinators.map((c) => <li key={c}>{c}</li>)}</ul>
          </section>
        )}

        {sections.filter(([, v]) => v).map(([k, v]) => (
          <section key={k}>
            <h3>{t(lang, k)}</h3>
            <div class="prose prose-lines">{paragraphs(v!)}</div>
          </section>
        ))}

        {hb && hb.bricks.length > 0 && (
          <section>
            <h3>{t(lang, 'module.bricks')}</h3>
            <ul class="plain">
              {hb.bricks.map((b) => (
                <li key={b.id} class="slot-row">
                  <span class="module-id">{b.id}</span> {b.title}
                  {b.ects !== null && <span class="muted"> · {t(lang, 'module.ects', { n: b.ects })}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {current?.kitUrl && (
          <a class="ext-link" href={current.kitUrl} target="_blank" rel="noopener">{t(lang, 'event.kit')}<Icon name="external" size={14} /></a>
        )}
      </div>
    </div>
  )
}
