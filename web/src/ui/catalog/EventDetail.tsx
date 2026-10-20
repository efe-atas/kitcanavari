import { useEffect, useRef } from 'preact/hooks'
import { t } from '../../i18n'
import type { CoursesFile, Event, Lang, Module } from '../../types'
import { bucketOptions, moduleKind } from '../../logic/degree'
import { fmtDate, fmtSlot, recurrenceKey, typeClass } from '../format'
import { TermLink } from '../glossary/GlossaryView'
import { AttendanceBlock } from './AttendanceBlock'
import { Icon } from '../Icon'

interface Props {
  lang: Lang
  data: CoursesFile
  ev: Event
  inSchedule: boolean
  myAreas: string[]
  onToggle: () => void
  onClose: () => void
}

/** Catalog type code → glossary entry. */
const TYPE_TERMS: Record<string, string> = { V: 'vorlesung', 'Ü': 'uebung', 'VÜ': 'vue', S: 'seminar', P: 'praktikum', Pg: 'pg' }

function ModuleBlock({ lang, data, m, myAreas }: { lang: Lang; data: CoursesFile; m: Module; myAreas: string[] }) {
  const kind = moduleKind(data, m)
  const rec = recurrenceKey(m.recurrence)
  const places = bucketOptions(m)
  const rows: [string, string | null][] = [
    ['module.recurrence', rec ? t(lang, rec) : m.recurrence],
    ['module.exam', m.description.exam],
    ['module.prerequisites', m.description.prerequisites],
    ['module.objectives', m.description.objectives],
    ['module.content', m.description.content],
    ['module.workload', m.description.workload],
  ]
  return (
    <details class="module">
      <summary>
        <span class="module-id">{m.id}</span> {m.title}
        {kind !== 'lecture' && <span class={`tag tag-${kind}`}>{t(lang, `kind.${kind}`)}</span>}
        {kind !== 'lecture' && <TermLink id={kind === 'practical' ? 'praktikum' : kind} lang={lang} />}
        {m.ects !== null && <span class="module-ects">{t(lang, 'module.ects', { n: m.ects })}</span>}
      </summary>
      <dl>
        {places.length > 0 && (
          <div>
            <dt>{t(lang, 'module.areas')} <TermLink id="area" lang={lang} /></dt>
            <dd class="place-list">
              {places.map((p) => (
                <span key={p} class={`tag ${myAreas.includes(p) ? 'tag-area' : 'tag-quiet'}`}>
                  {myAreas.includes(p) && <Icon name="check" size={12} />}
                  {p === 'elective' || p === 'minor' || p === 'iq' ? t(lang, `bucket.${p}`) : p}
                </span>
              ))}
            </dd>
          </div>
        )}
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <div key={k}><dt>{t(lang, k)}</dt><dd class="prose">{v}</dd></div>
        ))}
      </dl>
      <a class="ext-link" href={m.kitUrl} target="_blank" rel="noopener">{t(lang, 'event.kit')}<Icon name="external" size={14} /></a>
    </details>
  )
}

export function EventDetail({ lang, data, ev, inSchedule, myAreas, onToggle, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ev.id])

  const modules = ev.moduleIds.map((id) => data.modules[id]).filter(Boolean)
  return (
    <div class="detail-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class={`detail type-${typeClass(ev.typeCode)}`} role="dialog" aria-modal="true" aria-labelledby="detail-title" tabIndex={-1} ref={ref}>
        <header class="detail-head">
          <div>
            <p class="detail-kicker"><span class="type-badge">{ev.typeCode || '?'}</span>{TYPE_TERMS[ev.typeCode] && <TermLink id={TYPE_TERMS[ev.typeCode]} lang={lang} />}<span>{ev.number}</span><span>{ev.type}</span>{ev.language && <span>{ev.language}{ev.language !== 'English' && <TermLink id="language" lang={lang} />}</span>}</p>
            <h2 id="detail-title">{ev.title}</h2>
          </div>
          <button type="button" class="icon-button" onClick={onClose} aria-label={t(lang, 'event.close')}><Icon name="close" size={20} /></button>
        </header>
        <div class="detail-actions">
          <button type="button" class={inSchedule ? 'button-quiet' : 'button'} onClick={onToggle}>
            {!inSchedule && <Icon name="plus" size={16} />}
            {t(lang, inSchedule ? 'event.remove' : 'event.add')}
          </button>
          {ev.iliasUrl && <a class="ext-link" href={ev.iliasUrl} target="_blank" rel="noopener">{t(lang, 'event.ilias')}<Icon name="external" size={14} /></a>}
          <a class="ext-link" href={ev.kitUrl} target="_blank" rel="noopener">{t(lang, 'event.kit')}<Icon name="external" size={14} /></a>
        </div>

        <AttendanceBlock lang={lang} data={data} ev={ev} />

        <section>
          <h3>{t(lang, 'event.slots')}</h3>
          {ev.slots.length ? (
            <ul class="plain">
              {ev.slots.map((s, i) => (
                <li key={i} class="slot-row">
                  <strong>{fmtSlot(lang, s)}</strong>
                  {s.room && <span class="muted">{s.room}</span>}
                  {s.count ? <span class="muted">{s.count}×</span> : null}
                </li>
              ))}
            </ul>
          ) : <p class="muted">{t(lang, 'event.noSlots')}</p>}
        </section>

        {ev.sessions.length > 0 && (
          <details class="sessions">
            <summary>{t(lang, 'event.sessions')} ({ev.sessions.length})</summary>
            <ul class="plain session-list">
              {ev.sessions.map((s) => (
                <li key={s.date + s.start} class={s.cancelled ? 'cancelled' : ''}>
                  <span class="session-when">{fmtDate(lang, s.date)} {s.start}–{s.end}</span>
                  {s.cancelled && <span class="tag-cancelled">{t(lang, 'event.cancelled')}</span>}
                </li>
              ))}
            </ul>
          </details>
        )}

        <section>
          <h3>{t(lang, 'event.modules')}</h3>
          {modules.length ? modules.map((m) => <ModuleBlock key={m.id} lang={lang} data={data} m={m} myAreas={myAreas} />) : <p class="muted">{t(lang, 'event.noModules')}</p>}
        </section>

        {ev.contentText && (
          <section>
            <h3>{t(lang, 'event.content')}</h3>
            <div class="prose">{ev.contentText.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}</div>
          </section>
        )}

        <section>
          <h3>{t(lang, 'event.lecturers')}</h3>
          <ul class="plain lecturers">{ev.lecturers.map((l) => <li key={l.name}>{l.name}</li>)}</ul>
        </section>
      </div>
    </div>
  )
}
