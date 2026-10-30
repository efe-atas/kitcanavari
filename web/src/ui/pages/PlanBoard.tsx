import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { t } from '../../i18n'
import { RULES } from '../../logic/degree'
import { matrixCells, type CellItem, type RowId } from '../../logic/matrix'
import { roadmapEntries } from '../../logic/roadmap'
import { CURRENT_TERM, PRIOR } from '../../logic/terms'
import { addTerm, moveModule, restoreModule, snapshotModule } from '../../store'
import type { CoursesFile, HandbookFile, Lang, UserState } from '../../types'
import { Icon } from '../Icon'
import { ShareDialog } from '../ShareDialog'
import { rowLabel } from '../plan/labels'
import { termName } from '../roadmap/format'
import { courseHref, pageHref } from '../route'
import { useToast } from '../toast'
import { PageHead } from './PageHead'

interface Props {
  data: CoursesFile
  handbook: HandbookFile | null
  state: UserState
  update: (fn: (s: UserState) => UserState) => void
}

/** More than this in one term is a lot (a typical term is 30). */
const HEAVY = 36
const ROW_ORDER: RowId[] = ['area0', 'area1', 'elective', 'minor', 'iq', 'other']
const DRAG_TYPE = 'application/x-kit-module'
const VIEW_KEY = 'kitcanavari:planView'
type View = 'list' | 'board'

function savedView(): View {
  try {
    const v = localStorage.getItem(VIEW_KEY)
    if (v === 'list' || v === 'board') return v
  } catch { /* private mode */ }
  return typeof matchMedia === 'function' && matchMedia('(min-width: 1100px)').matches ? 'board' : 'list'
}

interface CardProps {
  lang: Lang
  state: UserState
  item: CellItem & { row: RowId }
  term: string
  terms: string[]
  onMove: (id: string, term: string) => void
}

function CourseCard({ lang, state, item, term, terms, onMove }: CardProps) {
  const title = item.title ?? item.id
  const grade = item.grade !== null ? String(item.grade).replace('.', lang === 'tr' ? ',' : '.') : null
  const kind = item.kind !== 'lecture' ? t(lang, `kind.${item.kind}`) : null
  const menu = useRef<HTMLDetailsElement>(null)
  return (
    <li class={`course-card status-${item.status}${item.issue ? ' has-issue' : ''}`} draggable
      onDragStart={(e) => {
        e.dataTransfer?.setData(DRAG_TYPE, item.id)
        e.dataTransfer?.setData('text/plain', title)
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
        ;(e.currentTarget as HTMLElement).classList.add('is-dragging')
        document.body.classList.add('is-dragging-course')
      }}
      onDragEnd={(e) => { (e.currentTarget as HTMLElement).classList.remove('is-dragging'); document.body.classList.remove('is-dragging-course') }}>
      <span class="course-grip" aria-hidden="true"><Icon name="grip" size={16} /></span>
      <a class="course-main" href={courseHref(item.id)} draggable={false}>
        <span class="course-title">{title}</span>
        <span class="course-meta">
          <span class="course-ects">{item.ects ?? '?'} ECTS</span>
          {kind && <span class={`tag tag-${item.kind}`}>{kind}</span>}
          {item.status !== 'planned' && (
            <span class={`course-status is-${item.status}`}>
              {item.status === 'passed' && <Icon name="check" size={12} />}
              {t(lang, `road.status.${item.status}`)}{grade && `, ${grade}`}
            </span>
          )}
          {item.inSchedule && <span class="course-sched" title={t(lang, 'pl.inWeek')}><Icon name="calendar" size={12} /><span class="sr-only">{t(lang, 'pl.inWeek')}</span></span>}
        </span>
        <span class="course-where">{rowLabel(lang, state, item.row)}</span>
        {item.issue && <span class="course-warn"><Icon name="alert" size={12} />{t(lang, `road.warn.${item.issue}`)}</span>}
      </a>
      <details class="move-menu" ref={menu}>
        <summary class="icon-button" aria-label={t(lang, 'pl.moveLabel', { title })}><Icon name="swap" size={16} /></summary>
        <div class="move-pop" role="group" aria-label={t(lang, 'pl.moveTo')}>
          <p>{t(lang, 'pl.moveTo')}</p>
          {terms.filter((x) => x !== term).map((x) => (
            <button key={x} type="button" onClick={() => { menu.current?.removeAttribute('open'); onMove(item.id, x) }}>
              {termName(lang, x)}
            </button>
          ))}
        </div>
      </details>
    </li>
  )
}

/** The plan term by term: drag a course to another term, or use its move menu. */
export function PlanBoard({ data, handbook, state, update }: Props) {
  const { lang } = state
  const toast = useToast()
  const [view, setView] = useState<View>(savedView)
  const [over, setOver] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const matrix = useMemo(() => matrixCells(state, data, handbook), [state, data, handbook])
  const items = (term: string) => ROW_ORDER.flatMap((row) => (matrix.cells[row][term] ?? []).map((it) => ({ ...it, row })))
  const columns = [...matrix.columns.filter((term) => term !== PRIOR), PRIOR]
  const total = Object.values(matrix.colTotals).reduce((n, x) => n + x, 0)
  useEffect(() => { try { localStorage.setItem(VIEW_KEY, view) } catch { /* private mode */ } }, [view])
  useEffect(() => () => document.body.classList.remove('is-dragging-course'), [])
  useEffect(() => {
    // An open move menu closes when the user clicks elsewhere or presses Escape, like any menu.
    const closeAll = (except?: EventTarget | null) => document.querySelectorAll<HTMLDetailsElement>('details.move-menu[open]').forEach((d) => {
      if (!(except instanceof Node && d.contains(except))) d.removeAttribute('open')
    })
    const onDown = (e: PointerEvent) => closeAll(e.target)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeAll() }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
  }, [])

  const move = (id: string, term: string) => {
    const from = roadmapEntries(state)[id]?.term
    if (!from || from === term) return
    const snap = snapshotModule(state, id)
    const title = items(from).find((x) => x.id === id)?.title ?? id
    update((s) => moveModule(s, data, id, term))
    toast({
      message: t(lang, 'toast.moved', { title, term: termName(lang, term) }),
      action: { label: t(lang, 'toast.undo'), run: () => update((s) => restoreModule(s, id, snap)) },
    })
  }

  return (
    <div class={`plan is-${view}`}>
      <PageHead title={t(lang, 'nav.plan')} lead={t(lang, 'page.plan.lead2')}>
        <div class="segmented plan-view" role="group" aria-label={t(lang, 'pl.view')}>
          <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}><Icon name="list" size={16} />{t(lang, 'pl.view.list')}</button>
          <button type="button" aria-pressed={view === 'board'} onClick={() => setView('board')}><Icon name="columns" size={16} />{t(lang, 'pl.view.board')}</button>
        </div>
        <button type="button" class="button-quiet" onClick={() => setSharing(true)}><Icon name="share" size={16} />{t(lang, 'share.short')}</button>
        <button type="button" class="button-quiet plan-print" onClick={() => window.print()}><Icon name="print" size={16} />{t(lang, 'pl.print')}</button>
        <button type="button" class="button-quiet" onClick={() => update(addTerm)}><Icon name="plus" size={16} />{t(lang, 'road.addTerm')}</button>
        <a class="button" href={pageHref({ kind: 'courses', term: CURRENT_TERM, row: null, filter: null })}><Icon name="plus" size={16} />{t(lang, 'pl.add')}</a>
      </PageHead>

      {!(state.areas ?? []).length && (
        <p class="callout">
          <Icon name="alert" size={16} />
          <span>{t(lang, 'pl.noAreas')}</span>
          <a href={pageHref({ kind: 'overview' })}>{t(lang, 'step.pickAreas')}</a>
        </p>
      )}
      <p class="plan-hint"><Icon name="grip" size={14} />{t(lang, 'pl.dragHint')}</p>
      <p class="print-only print-summary">{t(lang, 'pl.printSummary', { cp: total, areas: (state.areas ?? []).join(' · ') || '—' })}</p>

      <div class="lanes">
        {columns.map((term, index) => {
          const list = items(term)
          const cp = matrix.colTotals[term] ?? 0
          const isNow = term === CURRENT_TERM
          return (
            <section key={term} class={`lane${isNow ? ' is-now' : ''}${term === PRIOR ? ' is-prior' : ''}${over === term ? ' is-over' : ''}`}
              aria-labelledby={`lane-${term}`}
              onDragOver={(e) => {
                if (!e.dataTransfer?.types.includes(DRAG_TYPE)) return
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                if (over !== term) setOver(term)
              }}
              onDragLeave={(e) => { if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) setOver(null) }}
              onDrop={(e) => {
                const id = e.dataTransfer?.getData(DRAG_TYPE)
                setOver(null)
                document.body.classList.remove('is-dragging-course')
                if (!id) return
                e.preventDefault()
                move(id, term)
              }}>
              <header class="lane-head">
                <span class="semester-number">{term === PRIOR ? t(lang, 'pl.priorShort') : String(index + 1).padStart(2, '0')}</span>
                <h2 id={`lane-${term}`}>{termName(lang, term)}</h2>
                {isNow && <span class="now-badge">{t(lang, 'pl.now')}</span>}
                <span class={`lane-cp${cp > HEAVY ? ' is-heavy' : ''}`}>
                  <strong>{cp}</strong> ECTS{cp > HEAVY && <span class="lane-heavy">, {t(lang, 'pl.heavy', { n: RULES.semesterTarget })}</span>}
                </span>
                <div class={`workload-meter${cp > HEAVY ? ' is-heavy' : ''}`} role="img" aria-label={`${cp} / ${RULES.semesterTarget} ECTS`}>
                  <span style={{ width: `${Math.min(100, cp / RULES.semesterTarget * 100)}%` }} />
                </div>
              </header>
              <div class="lane-content">
                {list.length > 0
                  ? <ul class="plain lane-list">{list.map((it) => <CourseCard key={it.id} lang={lang} state={state} item={it} term={term} terms={columns} onMove={move} />)}</ul>
                  : <p class="lane-empty">{t(lang, term === PRIOR ? 'pl.priorEmpty' : 'pl.empty')}</p>}
                <div class="lane-foot">
                  <a class="lane-add" href={pageHref({ kind: 'courses', term, row: null, filter: null })}
                    aria-label={t(lang, 'pl.addTo', { term: termName(lang, term) })}>
                    <Icon name="plus" size={16} />{t(lang, 'pl.add')}
                  </a>
                  {isNow && <a class="lane-link" href={pageHref({ kind: 'week' })}><Icon name="calendar" size={16} />{t(lang, 'plan.week')}</a>}
                </div>
              </div>
            </section>
          )
        })}
      </div>
      <p class="plan-note">{t(lang, 'plan.thesis')}</p>
      {sharing && <ShareDialog lang={lang} state={state} onClose={() => setSharing(false)} />}
    </div>
  )
}
