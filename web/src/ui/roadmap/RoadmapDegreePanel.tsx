import { t } from '../../i18n'
import { RULES, type RoadmapReport } from '../../logic/degree'
import type { Lang, UserState } from '../../types'
import { Icon } from '../Icon'
import { AreaPickers, Row } from '../schedule/DegreePanel'

interface Props {
  lang: Lang
  report: RoadmapReport
  state: UserState
  update: (fn: (s: UserState) => UserState) => void
}

export function RoadmapDegreePanel({ lang, report, state, update }: Props) {
  const { done, all } = report
  const passed = (n: number) => t(lang, 'road.passedOf', { n })
  return (
    <section class="panel degree" aria-labelledby="road-degree-title">
      <h3 id="road-degree-title">{t(lang, 'road.degreeTitle')}</h3>
      <p class="panel-sub">{t(lang, 'road.degreeSub')}</p>
      <AreaPickers lang={lang} chosen={state.areas ?? []} update={update} />
      <p class="road-gpa">
        {report.gpa !== null ? t(lang, 'road.gpa', { gpa: report.gpa, cp: report.gradedCp }) : t(lang, 'road.noGpa')}
      </p>
      <ul class="reqs">
        <Row label={t(lang, 'road.total')} value={all.total} min={RULES.total - RULES.thesis} detail={`${passed(done.total)} · ${t(lang, 'road.thesis')}`} />
        {all.areas.map((a, i) => (
          <li key={a.area} class="req-group">
            <span class="req-group-title">{a.area}</span>
            <ul class="reqs">
              <Row label={t(lang, 'deg.areaCp')} value={a.cp} min={RULES.areaMin} detail={passed(done.areas[i]?.cp ?? 0)} />
              <Row label={t(lang, 'deg.lectureCp')} value={a.lectureCp} min={a.lectureMin} detail={passed(done.areas[i]?.lectureCp ?? 0)} />
            </ul>
          </li>
        ))}
        <Row term="stamm" lang={lang} label={t(lang, 'deg.stamm')} value={all.stamm.count} min={RULES.stamm} unit=""
          detail={all.stamm.titles.join(', ') || undefined} />
        <Row term="seminar" lang={lang} label={t(lang, 'deg.seminar')} value={all.seminarCp} min={RULES.seminarMin} detail={passed(done.seminarCp)} />
        <Row term="praktikum" lang={lang} label={t(lang, 'deg.practical')} value={all.practicalCp} min={RULES.practicalMin} detail={passed(done.practicalCp)} />
        <Row label={t(lang, 'deg.sp')} value={all.seminarCp + all.practicalCp} min={RULES.spMin} max={RULES.spMax}
          detail={passed(done.seminarCp + done.practicalCp)} />
        <Row term="elective" lang={lang} label={t(lang, 'deg.elective')} value={all.electiveCp} min={RULES.electiveMin} max={RULES.electiveMax}
          detail={passed(done.electiveCp)} />
        <Row term="minor" lang={lang} label={t(lang, 'bucket.minor')} value={all.minorCp} min={RULES.minorMin} max={RULES.minorMax} detail={passed(done.minorCp)} />
        <Row label={t(lang, 'bucket.iq')} value={all.iqCp} min={RULES.iqMin} max={RULES.iqMax} detail={passed(done.iqCp)} />
      </ul>
      {(all.issues.length > 0 || report.unknown.length > 0) && (
        <ul class="issues">
          {all.issues.map((i, n) => <li key={n}><Icon name="alert" size={14} />{t(lang, i.key, i.params)}</li>)}
          {report.unknown.length > 0 && <li><Icon name="alert" size={14} />{t(lang, 'road.unknownList', { ids: report.unknown.join(', ') })}</li>}
        </ul>
      )}
    </section>
  )
}
