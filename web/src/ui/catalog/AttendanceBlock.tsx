import { t } from '../../i18n'
import { attendanceOf } from '../../logic/attendance'
import type { CoursesFile, Event, Lang } from '../../types'
import { TermLink } from '../glossary/GlossaryView'
import { Icon } from '../Icon'

const MAX_REGISTRATION = 3

/** "Attendance" section of the course detail: the status, the sentences it is based on and where they come from. */
export function AttendanceBlock({ lang, data, ev }: { lang: Lang; data: CoursesFile; ev: Event }) {
  const a = attendanceOf(data, ev)
  const main = a.hints.filter((h) => h.kind !== 'registration')
  const registration = a.hints.filter((h) => h.kind === 'registration').slice(0, MAX_REGISTRATION)
  return (
    <section class={`attendance att-${a.level}`}>
      <h3>{t(lang, 'att.title')}<TermLink id="attendance" lang={lang} /></h3>
      <p class="att-status">
        <Icon name={a.level === 'unknown' ? 'search' : 'alert'} size={16} />
        <strong>{t(lang, `att.${a.level}`)}</strong>
      </p>
      {[...main, ...registration].length > 0 && (
        <ul class="att-hints">
          {[...main, ...registration].map((h) => (
            <li key={h.text} class={`att-hint hint-${h.kind}`}>
              <span class="att-hint-kind">{t(lang, `att.kind.${h.kind}`)} · {t(lang, `att.src.${h.source}`)}</span>
              <q lang="en">{h.text}</q>
            </li>
          ))}
        </ul>
      )}
      <p class="note">{t(lang, a.general === 'small' ? 'att.generalSmall' : 'att.generalLecture')}</p>
    </section>
  )
}
