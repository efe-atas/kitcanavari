import { useEffect, useRef } from 'preact/hooks'
import { t } from '../../i18n'
import { bucketOptions, moduleKind } from '../../logic/degree'
import type { ModuleRow } from '../../logic/handbook'
import type { CoursesFile, Lang } from '../../types'
import { TermLink } from '../glossary/GlossaryView'
import { Icon } from '../Icon'

interface Props {
  lang: Lang
  data: CoursesFile
  row: ModuleRow
  myAreas: string[]
  /** Open one of this term's courses of the module. */
  onOpenEvent: (eventId: string) => void
  onClose: () => void
}

const paragraphs = (text: string) => text.split('\n\n').map((p, i) => <p key={i}>{p}</p>)

export function ModuleDetail({ lang, data, row, myAreas, onOpenEvent, onClose }: Props) {
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
