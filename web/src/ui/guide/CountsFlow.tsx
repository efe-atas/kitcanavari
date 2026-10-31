import { cl } from '../../locale'
import type { Lang } from '../../types'
import { Icon } from '../Icon'

const copy = {
  tr: {
    title: 'Bir ders nereye sayılır?',
    lead: 'Her derste iki soru var: kredisi hangi kovaya gidiyor ve hangi sayaçları dolduruyor.',
    whereTitle: 'Nereye?',
    start: ['Programa bir ders ekledin', 'Ders bir modüle bağlı; ECTS modülde yazar.'],
    q1: 'Modül, seçtiğin iki alandan birinde mi?',
    q1yes: ['O alana say', 'İstersen seçmeliye de sayabilirsin.'],
    q2: 'Başka bir uzmanlık alanında ya da Elective Studies listesinde mi?',
    q2yes: ['Seçmeliye say', 'Tüm alanların modülleri seçmeliye gidebilir.'],
    q2no: ['Yan dal ya da disiplinlerarası', 'Matematik, Hukuk… ya da HoC, SpZ dersleri.'],
    yes: 'Evet', no: 'Hayır',
    whatTitle: 'Neyi doldurur?',
    whatLead: 'Alan toplamına her tür sayılır, ama alanın 10 ECTS\'lik ders şartına sadece normal dersler sayılır.',
    kindCol: 'Ders türü',
    cols: ['Kova toplamı', 'Alanın ders şartı (10)', 'Stammmodul (4)', 'Seminer + praktikum (12–18)'],
    rows: [
      ['lecture', 'Normal ders', [true, true, false, false]],
      ['stamm', 'Stammmodul', [true, false, true, false]],
      ['seminar', 'Seminer', [true, false, false, true]],
      ['practical', 'Praktikum', [true, false, false, true]],
    ] as [string, string, boolean[]][],
    yesLabel: 'sayılır', noLabel: 'sayılmaz',
  },
  en: {
    title: 'Where does a course count?',
    lead: 'Every course raises two questions: which bucket its credits go to, and which counters it fills.',
    whereTitle: 'Where?',
    start: ['You add a course', 'It belongs to a module; the ECTS are on the module.'],
    q1: 'Is the module in one of your two areas?',
    q1yes: ['Count it in that area', 'Or in elective studies, if you prefer.'],
    q2: 'Is it in another area or on the Elective Studies list?',
    q2yes: ['Count it as elective', 'Modules of every area may go there.'],
    q2no: ['Minor or interdisciplinary', 'Mathematics, Law… or HoC and SpZ courses.'],
    yes: 'Yes', no: 'No',
    whatTitle: 'What does it fill?',
    whatLead: 'Every kind counts towards a bucket’s total, but only lectures count towards an area’s 10 ECTS of lectures.',
    kindCol: 'Course kind',
    cols: ['Bucket total', 'Area lectures (10)', 'Advanced mandatory (4)', 'Seminars + practicals (12–18)'],
    rows: [
      ['lecture', 'Lecture', [true, true, false, false]],
      ['stamm', 'Advanced mandatory', [true, false, true, false]],
      ['seminar', 'Seminar', [true, false, false, true]],
      ['practical', 'Practical', [true, false, false, true]],
    ] as [string, string, boolean[]][],
    yesLabel: 'counts', noLabel: 'does not count',
  },
}

function Box({ kind, title, text }: { kind: 'start' | 'question' | 'end'; title: string; text?: string }) {
  return (
    <div class={`flow-box flow-${kind}`}>
      <strong>{title}</strong>
      {text && <span>{text}</span>}
    </div>
  )
}

export function CountsFlow({ lang }: { lang: Lang }) {
  const c = copy[cl(lang)]
  return (
    <section class="guide-section" aria-labelledby="flow-title">
      <h2 id="flow-title">{c.title}</h2>
      <p class="guide-note">{c.lead}</p>

      <div class="flow-grid">
        <div class="panel flow-panel">
          <h3>{c.whereTitle}</h3>
          <div class="flow">
            <Box kind="start" title={c.start[0]} text={c.start[1]} />
            <div class="flow-arrow" aria-hidden="true" />
            <Box kind="question" title={c.q1} />
            <div class="flow-branch">
              <div class="flow-leg">
                <span class="flow-answer is-yes">{c.yes}</span>
                <Box kind="end" title={c.q1yes[0]} text={c.q1yes[1]} />
              </div>
              <div class="flow-leg">
                <span class="flow-answer">{c.no}</span>
                <Box kind="question" title={c.q2} />
                <div class="flow-branch">
                  <div class="flow-leg">
                    <span class="flow-answer is-yes">{c.yes}</span>
                    <Box kind="end" title={c.q2yes[0]} text={c.q2yes[1]} />
                  </div>
                  <div class="flow-leg">
                    <span class="flow-answer">{c.no}</span>
                    <Box kind="end" title={c.q2no[0]} text={c.q2no[1]} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="panel flow-panel">
          <h3>{c.whatTitle}</h3>
          <p class="note flow-what-lead">{c.whatLead}</p>
          <div class="table-scroll" role="region" aria-label={c.whatTitle} tabIndex={0}>
          <table class="fill-matrix">
            <thead>
              <tr><th scope="col"><span class="sr-only">{c.kindCol}</span></th>{c.cols.map((col) => <th key={col} scope="col">{col}</th>)}</tr>
            </thead>
            <tbody>
              {c.rows.map(([kind, label, cells]) => (
                <tr key={kind}>
                  <th scope="row"><span class={`legend-swatch kind-${kind}`} />{label}</th>
                  {cells.map((on, i) => (
                    <td key={i} class={on ? 'is-on' : ''}>
                      {on ? <Icon name="check" size={16} /> : <span class="dash" aria-hidden="true" />}
                      <span class="sr-only">{on ? c.yesLabel : c.noLabel}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </section>
  )
}
