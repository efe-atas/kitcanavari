import { useEffect, useMemo, useState } from 'preact/hooks'
import { t } from '../../i18n'
import { roadmapReport } from '../../logic/degree'
import { matrixCells, rowsFor, type RowId } from '../../logic/matrix'
import { nextSteps } from '../../logic/nextSteps'
import type { CoursesFile, HandbookFile, UserState } from '../../types'
import { NextSteps } from './NextSteps'
import { PlanMatrix } from './PlanMatrix'
import { StatusStrip } from './StatusStrip'
import { TermCards } from './TermCards'

interface Props {
  data: CoursesFile
  handbook: HandbookFile | null
  state: UserState
  update: (fn: (s: UserState) => UserState) => void
  /** The cell or course the open side panel is about, highlighted in the table. */
  active: { term: string; row: RowId } | { id: string } | null
}

const PHONE = '(max-width: 640px)'

function usePhone(): boolean {
  const get = () => typeof matchMedia === 'function' && matchMedia(PHONE).matches
  const [phone, setPhone] = useState(get)
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const mq = matchMedia(PHONE)
    const on = () => setPhone(mq.matches)
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return phone
}

export function PlanPage({ data, handbook, state, update, active }: Props) {
  const { lang } = state
  const phone = usePhone()
  const report = useMemo(() => roadmapReport(state, data, handbook), [state, data, handbook])
  const steps = useMemo(() => nextSteps(state, data, handbook), [state, data, handbook])
  const matrix = useMemo(() => matrixCells(state, data, handbook), [state, data, handbook])
  const used = (Object.keys(matrix.cells) as RowId[]).filter((r) => Object.values(matrix.cells[r]).some((x) => x.length))
  const rows = rowsFor(state, used)
  const focusAreas = () => document.getElementById('area-select-0')?.focus()

  return (
    <div class="plan-page">
      <h1 class="sr-only">{t(lang, 'plan.title')}</h1>
      <StatusStrip lang={lang} report={report} />
      <NextSteps lang={lang} steps={steps} onFocusAreas={focusAreas} />
      {phone
        ? <TermCards lang={lang} state={state} matrix={matrix} rows={rows} update={update} active={active} />
        : <PlanMatrix lang={lang} state={state} matrix={matrix} rows={rows} update={update} active={active} />}
      <p class="thesis-note">{t(lang, 'plan.thesis')}</p>
    </div>
  )
}
