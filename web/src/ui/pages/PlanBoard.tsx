import { useMemo } from 'preact/hooks'
import { t } from '../../i18n'
import { RULES } from '../../logic/degree'
import { matrixCells, type CellItem, type RowId } from '../../logic/matrix'
import { CURRENT_TERM, PRIOR } from '../../logic/terms'
import { addTerm } from '../../store'
import type { CoursesFile, HandbookFile, Lang, UserState } from '../../types'
import { Icon } from '../Icon'
import { rowLabel } from '../plan/labels'
import { termName } from '../roadmap/format'
import { courseHref, pageHref } from '../route'
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

function CourseCard({ lang, state, item }: { lang: Lang; state: UserState; item: CellItem & { row: RowId } }) {
  const title = item.title ?? item.id
  const grade = item.grade !== null ? String(item.grade).replace('.', lang === 'tr' ? ',' : '.') : null
  const kind = item.kind !== 'lecture' ? t(lang, `kind.${item.kind}`) : null
  return (
    <li>
      <a class={`course-card status-${item.status}${item.issue ? ' has-issue' : ''}`} href={courseHref(item.id)}>
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
        </span>
        <span class="course-where">{rowLabel(lang, state, item.row)}</span>
        {item.issue && <span class="course-warn"><Icon name="alert" size={12} />{t(lang, `road.warn.${item.issue}`)}</span>}
      </a>
    </li>
  )
}

export function PlanBoard({ data, handbook, state, update }: Props) {
  const { lang } = state
  const matrix = useMemo(() => matrixCells(state, data, handbook), [state, data, handbook])
  const items = (term: string) => ROW_ORDER.flatMap((row) => (matrix.cells[row][term] ?? []).map((it) => ({ ...it, row })))

  return (
    <div class="plan">
      <PageHead title={t(lang, 'nav.plan')} lead={t(lang, 'page.plan.lead')}>
        <a class="button" href={pageHref({ kind: 'courses', term: CURRENT_TERM, row: null, filter: null })}><Icon name="plus" size={16} />{t(lang, 'pl.add')}</a>
        <button type="button" class="button-quiet" onClick={() => update(addTerm)}><Icon name="plus" size={16} />{t(lang, 'road.addTerm')}</button>
      </PageHead>

      {!(state.areas ?? []).length && (
        <p class="callout">
          <Icon name="alert" size={16} />
          <span>{t(lang, 'pl.noAreas')}</span>
          <a href={pageHref({ kind: 'overview' })}>{t(lang, 'step.pickAreas')}</a>
        </p>
      )}

      <div class="lanes">
        {[...matrix.columns.filter((term) => term !== PRIOR), PRIOR].map((term, index) => {
          const list = items(term)
          const cp = matrix.colTotals[term] ?? 0
          const isNow = term === CURRENT_TERM
          return (
            <section key={term} class={`lane${isNow ? ' is-now' : ''}${term === PRIOR ? ' is-prior' : ''}`} aria-labelledby={`lane-${term}`}>
              <header class="lane-head"><span class="semester-number">{term === PRIOR ? '↶' : String(index + 1).padStart(2, '0')}</span>
                <h2 id={`lane-${term}`}>{termName(lang, term)}</h2>
                {isNow && <span class="now-badge">{t(lang, 'pl.now')}</span>}
                <span class={`lane-cp${cp > HEAVY ? ' is-heavy' : ''}`}>
                  <strong>{cp}</strong> ECTS{cp > HEAVY && <span class="lane-heavy">, {t(lang, 'pl.heavy', { n: RULES.semesterTarget })}</span>}
                </span>
                <div class="workload-meter" role="img" aria-label={`${cp} / ${RULES.semesterTarget} ECTS`}><span style={{ width: `${Math.min(100, cp / RULES.semesterTarget * 100)}%` }} /></div>
              </header>
              <div class="lane-content">
              {list.length > 0
                ? <ul class="plain lane-list">{list.map((it) => <CourseCard key={it.id} lang={lang} state={state} item={it} />)}</ul>
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
    </div>
  )
}
