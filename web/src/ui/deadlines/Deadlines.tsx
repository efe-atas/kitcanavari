import { useState } from 'preact/hooks'
import { t } from '../../i18n'
import { addDays, berlinNow, daysBetween } from '../../logic/calendar'
import { putDeadline, removeDeadline } from '../../store'
import type { Deadline, DeadlineKind, Lang, UserState } from '../../types'
import { Icon } from '../Icon'
import { shortDay } from '../overview/TodayCard'
import { courseHref } from '../route'

const KINDS: DeadlineKind[] = ['exam', 'registration', 'deadline', 'other']

/** Days from today to a date: 0 today, 1 tomorrow, … */
export const daysUntil = (today: string, date: string) => daysBetween(today, date)

/** Dates from today on, soonest first. */
export const upcoming = (list: Deadline[], today: string) => list.filter((d) => d.date >= today)

interface FormProps {
  lang: Lang
  update: (fn: (s: UserState) => UserState) => void
  /** Fixed module (course sheet); otherwise the user may pick one. */
  moduleId?: string | null
  modules?: { id: string; title: string }[]
  onDone?: () => void
}

/** Add a date: what, when (time optional), which kind, and optionally which course. */
export function DeadlineForm({ lang, update, moduleId, modules, onDone }: FormProps) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(() => addDays(berlinNow().date, 7))
  const [time, setTime] = useState('')
  const [kind, setKind] = useState<DeadlineKind>('exam')
  const [mod, setMod] = useState(moduleId ?? '')
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && (title.trim() || kind !== 'other')
  return (
    <form class="deadline-form" onSubmit={(e) => {
      e.preventDefault()
      if (!valid) return
      const course = modules?.find((m) => m.id === mod)
      update((s) => putDeadline(s, {
        moduleId: (moduleId ?? mod) || null, kind, date, time: time || null,
        title: title.trim() || `${t(lang, `dl.kind.${kind}`)}${course ? `: ${course.title}` : ''}`,
      }))
      setTitle('')
      onDone?.()
    }}>
      <label class="field dl-title">{t(lang, 'dl.title')}<input type="text" value={title} placeholder={t(lang, 'dl.titleHint')} onInput={(e) => setTitle((e.target as HTMLInputElement).value)} /></label>
      <label class="field">{t(lang, 'dl.kind')}
        <select value={kind} onChange={(e) => setKind((e.target as HTMLSelectElement).value as DeadlineKind)}>
          {KINDS.map((k) => <option key={k} value={k}>{t(lang, `dl.kind.${k}`)}</option>)}
        </select>
      </label>
      <label class="field">{t(lang, 'dl.date')}<input type="date" value={date} required onInput={(e) => setDate((e.target as HTMLInputElement).value)} /></label>
      <label class="field">{t(lang, 'dl.time')}<input type="time" value={time} onInput={(e) => setTime((e.target as HTMLInputElement).value)} /></label>
      {moduleId === undefined && modules && (
        <label class="field dl-course">{t(lang, 'dl.course')}
          <select value={mod} onChange={(e) => setMod((e.target as HTMLSelectElement).value)}>
            <option value="">{t(lang, 'dl.noCourse')}</option>
            {modules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
          </select>
        </label>
      )}
      <button type="submit" class="button is-small" disabled={!valid}><Icon name="plus" size={14} />{t(lang, 'dl.add')}</button>
    </form>
  )
}

/** A list of dates with how far away they are, each removable. */
export function DeadlineList({ lang, list, update, today, linkCourses = true }: {
  lang: Lang; list: Deadline[]; update: FormProps['update']; today: string; linkCourses?: boolean
}) {
  return (
    <ul class="plain deadline-list">
      {list.map((d) => {
        const n = daysUntil(today, d.date)
        return (
          <li key={d.id} class={`deadline kind-${d.kind}${n <= 3 && n >= 0 ? ' is-soon' : ''}`}>
            <span class="deadline-when"><strong>{shortDay(lang, d.date)}</strong>{d.time && <span>{d.time}</span>}</span>
            <span class="deadline-what">
              {linkCourses && d.moduleId ? <a href={courseHref(d.moduleId)}>{d.title}</a> : <span>{d.title}</span>}
              <small>{t(lang, `dl.kind.${d.kind}`)} · {n === 0 ? t(lang, 'dl.today') : n === 1 ? t(lang, 'dl.tomorrow') : n > 0 ? t(lang, 'dl.inDays', { n }) : t(lang, 'dl.past')}</small>
            </span>
            <button type="button" class="icon-button" aria-label={t(lang, 'dl.remove', { title: d.title })} onClick={() => update((s) => removeDeadline(s, d.id))}>
              <Icon name="close" size={15} />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
