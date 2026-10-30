import { useMemo, useRef, useState } from 'preact/hooks'
import { t } from '../../i18n'
import { moduleKind, type Kind } from '../../logic/degree'
import { EMPTY_HANDBOOK, moduleRows } from '../../logic/handbook'
import { roadmapEntries } from '../../logic/roadmap'
import { fold, highlight, searchModules } from '../../logic/search'
import type { CoursesFile, HandbookFile, Lang, UserState } from '../../types'
import { Icon, type IconName } from '../Icon'
import { Overlay } from '../Overlay'
import { termName } from '../roadmap/format'
import { courseHref } from '../route'

export interface PaletteCommand {
  id: string
  label: string
  icon: IconName
  /** Extra words that find this command. */
  keywords?: string
  hint?: string
  run: () => void
}

interface Props {
  lang: Lang
  data: CoursesFile
  handbook: HandbookFile | null
  state: UserState
  pages: PaletteCommand[]
  actions: PaletteCommand[]
  onClose: () => void
}

interface Item {
  id: string
  group: 'courses' | 'pages' | 'actions'
  label: string
  icon: IconName
  meta?: string
  kind?: Kind
  starred?: boolean
  run: () => void
}

const COURSES = 8

function Highlighted({ text, query }: { text: string; query: string }) {
  const h = highlight(text, query)
  return h ? <>{h[0]}<mark>{h[1]}</mark>{h[2]}</> : <>{text}</>
}

/** One box to reach any course, page or action from the keyboard (Ctrl/⌘ K). */
export function CommandPalette({ lang, data, handbook, state, pages, actions, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const rows = useMemo(() => moduleRows(data, handbook ?? EMPTY_HANDBOOK), [data, handbook])
  const entries = roadmapEntries(state)
  const starred = state.starred ?? []

  const items = useMemo((): Item[] => {
    const q = query.trim()
    const course = (r: (typeof rows)[number]): Item => {
      const e = entries[r.id]
      return {
        id: `course:${r.id}`, group: 'courses', label: r.title, icon: 'book', kind: moduleKind(data, r), starred: starred.includes(r.id),
        meta: [r.ects != null ? `${r.ects} ECTS` : null, e ? termName(lang, e.term) : null].filter(Boolean).join(' · '),
        run: () => { location.hash = courseHref(r.id) },
      }
    }
    const matches = (c: PaletteCommand) => !q || fold(`${c.label} ${c.keywords ?? ''}`).includes(fold(q))
    const command = (group: Item['group']) => (c: PaletteCommand): Item => ({ id: `${group}:${c.id}`, group, label: c.label, icon: c.icon, meta: c.hint, run: c.run })
    const courses = q
      ? searchModules(rows, q, COURSES).map(course)
      : starred.map((id) => rows.find((r) => r.id === id)).filter((r): r is (typeof rows)[number] => !!r).slice(0, 5).map(course)
    return [...courses, ...pages.filter(matches).map(command('pages')), ...actions.filter(matches).map(command('actions'))]
  }, [query, rows, pages, actions, state, lang])

  const current = Math.min(active, Math.max(0, items.length - 1))
  const run = (it: Item | undefined) => {
    if (!it) return
    onClose()
    it.run()
  }
  const move = (delta: number) => {
    if (!items.length) return
    const next = (current + delta + items.length) % items.length
    setActive(next)
    list.current?.querySelector(`#pal-${next}`)?.scrollIntoView({ block: 'nearest' })
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
    else if (e.key === 'Enter') { e.preventDefault(); run(items[current]) }
    else if (e.key === 'Tab') e.preventDefault()
  }
  const groups = (['courses', 'pages', 'actions'] as const).map((g) => ({ g, items: items.map((it, i) => ({ it, i })).filter((x) => x.it.group === g) }))
    .filter((x) => x.items.length)
  const groupLabel = (g: Item['group']) => t(lang, g === 'courses' ? (query.trim() ? 'cmd.courses' : 'cmd.starred') : `cmd.${g}`)

  return (
    <Overlay label={t(lang, 'cmd.title')} onClose={onClose} initialFocus={() => input.current} class="palette">
      <div class="palette-search">
        <Icon name="search" size={20} />
        <input ref={input} type="text" role="combobox" aria-expanded="true" aria-controls="palette-list" aria-autocomplete="list"
          aria-activedescendant={items.length ? `pal-${current}` : undefined} aria-label={t(lang, 'cmd.title')}
          placeholder={t(lang, 'cmd.placeholder')} value={query} spellcheck={false} autocomplete="off"
          onInput={(e) => { setQuery((e.target as HTMLInputElement).value); setActive(0) }} onKeyDown={onKey} />
        <kbd>Esc</kbd>
      </div>
      <div class="palette-list" id="palette-list" role="listbox" ref={list} aria-label={t(lang, 'cmd.results')}>
        {!items.length && <p class="palette-empty">{t(lang, 'cmd.none', { q: query.trim() })}</p>}
        {groups.map(({ g, items: its }) => (
          <div key={g} role="group" aria-labelledby={`pal-g-${g}`} class="palette-group">
            <div id={`pal-g-${g}`} class="palette-group-label" role="presentation">{groupLabel(g)}</div>
            {its.map(({ it, i }) => (
              <div key={it.id} id={`pal-${i}`} role="option" aria-selected={i === current} class="palette-item"
                onMouseMove={() => i !== current && setActive(i)} onClick={() => run(it)}>
                <span class={`palette-icon${it.kind ? ` kind-${it.kind}` : ''}`}><Icon name={it.icon} size={17} /></span>
                <span class="palette-label"><Highlighted text={it.label} query={it.group === 'courses' ? query : ''} /></span>
                {it.starred && <span class="palette-star" aria-label={t(lang, 'star.on')}><Icon name="star" size={14} filled /></span>}
                {it.kind && it.kind !== 'lecture' && <span class={`tag tag-${it.kind}`}>{t(lang, `kind.${it.kind}`)}</span>}
                {it.meta && <span class="palette-meta">{it.meta}</span>}
                <Icon name="arrow" size={15} />
              </div>
            ))}
          </div>
        ))}
      </div>
      <footer class="palette-foot" aria-hidden="true">
        <span><kbd>↑</kbd><kbd>↓</kbd> {t(lang, 'cmd.navigate')}</span>
        <span><kbd>↵</kbd> {t(lang, 'cmd.open')}</span>
        <span><kbd>?</kbd> {t(lang, 'cmd.shortcuts')}</span>
      </footer>
    </Overlay>
  )
}

export interface Shortcut {
  keys: string[]
  label: string
}

/** The keyboard shortcuts (opened with ?). */
export function ShortcutsDialog({ lang, shortcuts, onClose }: { lang: Lang; shortcuts: Shortcut[]; onClose: () => void }) {
  return (
    <Overlay label={t(lang, 'cmd.shortcuts')} onClose={onClose} class="shortcuts">
      <div class="shortcuts-head">
        <h2>{t(lang, 'cmd.shortcuts')}</h2>
        <button type="button" class="icon-button" onClick={onClose} aria-label={t(lang, 'event.close')}><Icon name="close" size={18} /></button>
      </div>
      <ul class="plain shortcut-list" tabIndex={0} aria-label={t(lang, 'cmd.shortcuts')}>
        {shortcuts.map((s) => (
          <li key={s.label}><span>{s.label}</span><span>{s.keys.map((k, i) => <kbd key={i}>{k}</kbd>)}</span></li>
        ))}
      </ul>
    </Overlay>
  )
}
