import { useEffect, useRef } from 'preact/hooks'
import { t } from '../../i18n'
import type { CoursesFile, Event, Lang, Module } from '../../types'
import { fmtDate, fmtSlot, typeClass } from '../format'

interface Props {
  lang: Lang
  data: CoursesFile
  ev: Event
  inSchedule: boolean
  onToggle: () => void
  onClose: () => void
}

function ModuleBlock({ lang, m }: { lang: Lang; m: Module }) {
  const rows: [string, string | null][] = [
    ['module.part', [m.part, ...m.fields].filter(Boolean).join(' / ') || null],
    ['module.recurrence', m.recurrence],
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
        {m.ects !== null && <span class="module-ects">{t(lang, 'module.ects', { n: m.ects })}</span>}
      </summary>
      <dl>
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <div key={k}><dt>{t(lang, k)}</dt><dd class="prose">{v}</dd></div>
        ))}
      </dl>
      <a href={m.kitUrl} target="_blank" rel="noopener">{t(lang, 'event.kit')}</a>
    </details>
  )
}

export function EventDetail({ lang, data, ev, inSchedule, onToggle, onClose }: Props) {
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
            <p class="detail-kicker"><span class="type-badge">{ev.typeCode || '?'}</span> {ev.number} · {ev.type}</p>
            <h2 id="detail-title">{ev.title}</h2>
          </div>
          <button type="button" class="icon-button" onClick={onClose} aria-label={t(lang, 'event.close')}>✕</button>
        </header>
        <div class="detail-actions">
          <button type="button" class={inSchedule ? 'button-quiet' : 'button'} onClick={onToggle}>
            {t(lang, inSchedule ? 'event.remove' : 'event.add')}
          </button>
          {ev.iliasUrl && <a href={ev.iliasUrl} target="_blank" rel="noopener">{t(lang, 'event.ilias')}</a>}
          <a href={ev.kitUrl} target="_blank" rel="noopener">{t(lang, 'event.kit')}</a>
        </div>

        <section>
          <h3>{t(lang, 'event.slots')}</h3>
          {ev.slots.length ? (
            <ul class="plain">
              {ev.slots.map((s, i) => <li key={i}>{fmtSlot(lang, s)}{s.room ? ` · ${s.room}` : ''}{s.count ? ` · ${s.count}×` : ''}</li>)}
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
          {modules.length ? modules.map((m) => <ModuleBlock key={m.id} lang={lang} m={m} />) : <p class="muted">{t(lang, 'event.noModules')}</p>}
        </section>

        {ev.contentText && (
          <section>
            <h3>{t(lang, 'event.content')}</h3>
            <div class="prose">{ev.contentText.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}</div>
          </section>
        )}

        <section>
          <h3>{t(lang, 'event.lecturers')}</h3>
          <ul class="plain">{ev.lecturers.map((l) => <li key={l.name}>{l.name}</li>)}</ul>
        </section>
      </div>
    </div>
  )
}
