import { useMemo, useState } from 'preact/hooks'
import { t } from '../../i18n'
import { addDays, berlinNow, clashes, defaultWeek, mondayOf, occKey, occurrences, semesterBounds, weekDates } from '../../logic/calendar'
import { roadmapEntries } from '../../logic/roadmap'
import type { CoursesFile, SelectedEntry, UserState } from '../../types'
import { Icon } from '../Icon'
import { termName } from '../roadmap/format'
import { courseHref } from '../route'
import { CalendarGrid } from './Calendar'

/** "SS 27" → "SS27": the catalog's term label as a plan term id. */
export const termIdOf = (label: string) => label.replace(/\s+/g, '').replace(/^(WS\d{2})\/\d{2}$/, '$1')

/**
 * The next term's week from its published catalog: every course of the modules planned for that term, all groups
 * shown, so clashes are visible before choosing groups.
 */
export function NextTermPreview({ next, state }: { next: CoursesFile; state: UserState }) {
  const { lang } = state
  const term = termIdOf(next.meta.term)
  const planned = Object.entries(roadmapEntries(state)).filter(([, e]) => e.term === term && e.status === 'planned').map(([id]) => id)
  const selected = useMemo(() => {
    const out: Record<string, SelectedEntry> = {}
    for (const ev of Object.values(next.events)) {
      const mid = ev.moduleIds.find((m) => planned.includes(m))
      if (mid) out[ev.id] = { enabledSlots: ev.slots.map((_, i) => i), moduleId: mid, ackFingerprint: ev.fingerprint }
    }
    return out
  }, [next, planned.join()])
  const [week, setWeek] = useState(() => {
    // Open on a week inside that term: its dated sessions, or a fortnight into the semester.
    const w = defaultWeek(next.events, berlinNow().date, term)
    const b = semesterBounds(term)
    return b && (w < mondayOf(b.from) || w > b.to) ? mondayOf(addDays(b.from, 14)) : w
  })
  const dates = weekDates(week)
  const occ = occurrences(selected, next.events, dates[0], dates[6], term)
  const clash = clashes(occ)
  const clashing = new Set(clash.flatMap((c) => [occKey(c.a), occKey(c.b)]))
  const missing = planned.filter((id) => !Object.values(selected).some((e) => e.moduleId === id))
  const open = (eventId: string) => { const mid = selected[eventId]?.moduleId; if (mid) location.hash = courseHref(mid) }
  return (
    <section class="next-term" aria-labelledby="next-title">
      <h2 id="next-title">{t(lang, 'nx.title', { term: termName(lang, term) })}</h2>
      <p class="career-section-lead">{t(lang, 'nx.lead')}</p>
      {!planned.length ? <p class="cal-empty">{t(lang, 'nx.none', { term: termName(lang, term) })}</p> : (
        <>
          <div class="week-nav" role="group" aria-label={t(lang, 'wk.nav')}>
            <button type="button" class="icon-button" onClick={() => setWeek(addDays(week, -7))} aria-label={t(lang, 'wk.prev')}><Icon name="chevronLeft" size={18} /></button>
            <span class="week-label">{dates[0]} – {dates[6]}</span>
            <button type="button" class="icon-button" onClick={() => setWeek(addDays(week, 7))} aria-label={t(lang, 'wk.next')}><Icon name="chevron" size={18} /></button>
            {clash.length > 0 && <span class="week-stats"><span class="is-bad"><Icon name="alert" size={14} />{t(lang, 'wk.clashes', { n: clash.length })}</span></span>}
          </div>
          <div class="schedule-scroll"><CalendarGrid lang={lang} data={next} dates={dates} occ={occ} clashing={clashing} today={berlinNow()} onOpen={open} /></div>
          {missing.length > 0 && <p class="note">{t(lang, 'nx.missing', { n: missing.length })}</p>}
        </>
      )}
    </section>
  )
}
