import { useState } from 'preact/hooks'
import { RULES } from '../../logic/degree'
import type { Lang } from '../../types'
import { BoardLegend, BucketBoard, type ChipKind } from '../BucketBoard'
import { Icon } from '../Icon'

type Col = 'a1' | 'a2' | 'elective' | 'minor' | 'iq' | 'thesis'

interface Chip {
  title: string
  ects: number
  kind: ChipKind
  col: Col
  sem: number
}

/**
 * A complete, rule-conforming sample degree built from real modules of the 2025 handbook
 * (areas: Cryptography and Security + Human-centred Machine Intelligence). Sums to 120 ECTS.
 */
const PLAN: Chip[] = [
  { sem: 1, col: 'a1', kind: 'stamm', ects: 6, title: 'IT Security' },
  { sem: 1, col: 'a1', kind: 'lecture', ects: 6, title: 'Resilient Networking' },
  { sem: 1, col: 'a1', kind: 'seminar', ects: 4, title: 'Seminar: Privacy and Security' },
  { sem: 1, col: 'a2', kind: 'lecture', ects: 6, title: 'Natural Language Processing' },
  { sem: 1, col: 'elective', kind: 'stamm', ects: 6, title: 'Algorithms II' },
  { sem: 1, col: 'iq', kind: 'iq', ects: 2, title: 'SpZ' },
  { sem: 2, col: 'a1', kind: 'lecture', ects: 6, title: 'Privacy Enhancing Technologies' },
  { sem: 2, col: 'a1', kind: 'practical', ects: 4, title: 'AISEC-Lab' },
  { sem: 2, col: 'a2', kind: 'stamm', ects: 6, title: 'Advanced Artificial Intelligence' },
  { sem: 2, col: 'elective', kind: 'stamm', ects: 6, title: 'Software Engineering II' },
  { sem: 2, col: 'minor', kind: 'minor', ects: 6, title: 'Math I' },
  { sem: 3, col: 'a2', kind: 'lecture', ects: 6, title: 'Reinforcement Learning' },
  { sem: 3, col: 'a2', kind: 'practical', ects: 6, title: 'Research Practical: AI & Security' },
  { sem: 3, col: 'elective', kind: 'lecture', ects: 5, title: 'Parallel Algorithms' },
  { sem: 3, col: 'minor', kind: 'minor', ects: 6, title: 'Math II' },
  { sem: 3, col: 'minor', kind: 'minor', ects: 6, title: 'Math III' },
  { sem: 3, col: 'iq', kind: 'iq', ects: 3, title: 'HoC' },
  { sem: 4, col: 'thesis', kind: 'thesis', ects: 30, title: 'Master’s Thesis' },
]

const COLS: { id: Col; min: number; max?: number }[] = [
  { id: 'a1', min: RULES.areaMin },
  { id: 'a2', min: RULES.areaMin },
  { id: 'elective', min: RULES.electiveMin, max: RULES.electiveMax },
  { id: 'minor', min: RULES.minorMin, max: RULES.minorMax },
  { id: 'iq', min: RULES.iqMin, max: RULES.iqMax },
  { id: 'thesis', min: RULES.thesis },
]

const copy = {
  tr: {
    title: 'Örnek: dört dönemde 120 ECTS',
    lead: 'Yüksek lisansı altı kovayı doldurmak gibi düşün. Dönemleri tek tek ilerlet ve her dersin nereye düştüğünü izle.',
    steps: ['Başlangıç', '1. dönem', '2. dönem', '3. dönem', '4. dönem'],
    prev: 'Önceki', next: 'Sonraki',
    cols: {
      a1: ['1. alan', 'Cryptography and Security'], a2: ['2. alan', 'Human-centred Machine Intelligence'],
      elective: ['Seçmeli', 'Elective Studies'], minor: ['Yan dal', 'Matematik'], iq: ['Disiplinlerarası', 'HoC, SpZ'],
      thesis: ['Tez', 'Master’s Thesis'],
    } as Record<Col, [string, string]>,
    stories: [
      {
        h: 'Altı kova, alt çizgiler',
        p: [
          'İki uzmanlık alanı, seçmeli, yan dal, disiplinlerarası ve tez. Kesikli çizgi her kovanın en az ne kadar dolması gerektiğini gösteriyor.',
          'Bu örnekte seçilen alanlar Cryptography and Security ile Human-centred Machine Intelligence.',
          'Altındaki sayaçlar diğer şartları izliyor: 4 Stammmodul, her alanda 10 ECTS normal ders, seminer ve praktikum.',
        ],
      },
      {
        h: '1. dönem (kış): 30 ECTS',
        p: [
          'IT Security bir Stammmodul ve 1. alana ait, oraya sayıldı. Ama alanın "10 ECTS normal ders" şartına sayılmaz.',
          'Algorithms II de bir Stammmodul, fakat iki alanın dışında kalıyor. Bu yüzden seçmeliye düştü; Stammmodul sayacı yine de 2 oldu.',
          'Resilient Networking ve Natural Language Processing normal ders: alanların ders şartını dolduruyorlar.',
          'Tek bir seminer (4 ECTS) seminer şartını (en az 3) karşıladı. Dil Merkezi\'nden bir kurs disiplinlerarasına gitti.',
        ],
      },
      {
        h: '2. dönem (yaz): 28 ECTS',
        p: [
          'Yazın açılan iki Stammmodul alındı: Advanced AI 2. alana, Software Engineering II seçmeliye. Stammmodul sayacı 4/4.',
          'Privacy Enhancing Technologies ile 1. alanın normal ders toplamı 12 oldu; şart tamam.',
          'AISEC-Lab ilk praktikum. Yan dal (Matematik) ilk modülüyle başladı.',
        ],
      },
      {
        h: '3. dönem (kış): 32 ECTS',
        p: [
          'Reinforcement Learning ile 2. alanın ders şartı da tamam (12/10).',
          'Bir araştırma praktikumuyla praktikum 10 ECTS oldu. Seminer + praktikum toplamı 14, yani 12–18 aralığında.',
          'Yan dal 18 ECTS\'e ulaştı; bundan fazlası sayılmazdı. Seçmeli 17 ECTS ile 6–49 aralığında.',
        ],
      },
      {
        h: '4. dönem: tez',
        p: [
          'Master tezi 30 ECTS. Toplam 120 ECTS ve tüm şartlar tamam.',
          'Bu yalnızca bir örnek. Senin alanların ve derslerin farklı olacak; "Programım"daki panel aynı hesabı senin planın için yapıyor.',
        ],
      },
    ],
    counters: {
      total: 'Toplam', stamm: 'Stammmodul', a1Lec: '1. alan normal ders', a2Lec: '2. alan normal ders',
      seminar: 'Seminer', practical: 'Praktikum', sp: 'Seminer + praktikum',
    },
  },
  en: {
    title: 'Example: 120 ECTS in four terms',
    lead: 'Think of the degree as six buckets to fill. Step through the terms and watch where each course lands.',
    steps: ['Start', 'Term 1', 'Term 2', 'Term 3', 'Term 4'],
    prev: 'Previous', next: 'Next',
    cols: {
      a1: ['Area 1', 'Cryptography and Security'], a2: ['Area 2', 'Human-centred Machine Intelligence'],
      elective: ['Elective', 'Elective Studies'], minor: ['Minor', 'Mathematics'], iq: ['Interdisciplinary', 'HoC, SpZ'],
      thesis: ['Thesis', 'Master’s Thesis'],
    } as Record<Col, [string, string]>,
    stories: [
      {
        h: 'Six buckets, each with a floor',
        p: [
          'Two areas of specialization, elective studies, a minor, interdisciplinary qualifications and the thesis. The dashed line marks how full each bucket must get.',
          'In this example the areas are Cryptography and Security and Human-centred Machine Intelligence.',
          'The counters below track the other rules: 4 advanced mandatory modules, 10 ECTS of lectures per area, seminars and practicals.',
        ],
      },
      {
        h: 'Term 1 (winter): 30 ECTS',
        p: [
          'IT Security is an advanced mandatory module in area 1, so it counts there, but not towards the area’s 10 ECTS of lectures.',
          'Algorithms II is advanced mandatory too, but outside both areas, so it lands in elective studies. It still counts for the advanced mandatory counter (2).',
          'Resilient Networking and Natural Language Processing are lectures, so they fill the areas’ lecture minimum.',
          'One seminar (4 ECTS) meets the seminar minimum of 3. A Language Center course counts as interdisciplinary.',
        ],
      },
      {
        h: 'Term 2 (summer): 28 ECTS',
        p: [
          'The two summer advanced mandatory modules: Advanced AI goes to area 2, Software Engineering II to elective studies. Counter: 4/4.',
          'Privacy Enhancing Technologies brings area 1 to 12 ECTS of lectures; requirement met.',
          'AISEC-Lab is the first practical. The minor (Mathematics) starts with its first module.',
        ],
      },
      {
        h: 'Term 3 (winter): 32 ECTS',
        p: [
          'Reinforcement Learning completes area 2’s lecture minimum (12/10).',
          'A research practical brings practicals to 10 ECTS. Seminars + practicals add up to 14, inside 12–18.',
          'The minor reaches 18 ECTS; anything above would be discarded. Elective studies sit at 17, inside 6–49.',
        ],
      },
      {
        h: 'Term 4: thesis',
        p: [
          'The Master’s thesis adds 30 ECTS. Total 120 ECTS and every rule is met.',
          'This is only an example. Your areas and courses will differ; the panel in “My schedule” runs the same check on your plan.',
        ],
      },
    ],
    counters: {
      total: 'Total', stamm: 'Advanced mandatory', a1Lec: 'Area 1 lectures', a2Lec: 'Area 2 lectures',
      seminar: 'Seminars', practical: 'Practicals', sp: 'Seminars + practicals',
    },
  },
}

function Counter({ label, value, min, max, unit = 'ECTS' }: { label: string; value: number; min: number; max?: number; unit?: string }) {
  const done = value >= min && (max === undefined || value <= max)
  return (
    <li class={`counter${done ? ' is-done' : ''}`}>
      <span class="counter-label">{done && <Icon name="check" size={13} />}{label}</span>
      <span class="counter-value"><strong>{value}</strong> / {max !== undefined ? `${min}–${max}` : min}{unit && ` ${unit}`}</span>
    </li>
  )
}

export function ExamplePlan({ lang }: { lang: Lang }) {
  const c = copy[lang]
  const [step, setStep] = useState(0)
  const shown = PLAN.filter((x) => x.sem <= step)
  const sum = (pred: (x: Chip) => boolean) => shown.filter(pred).reduce((n, x) => n + x.ects, 0)
  const story = c.stories[step]
  const last = c.steps.length - 1

  return (
    <section class="guide-section example" aria-labelledby="example-title">
      <h3 id="example-title">{c.title}</h3>
      <p class="guide-note">{c.lead}</p>

      <div class="stepper" role="tablist" aria-label={c.title}>
        {c.steps.map((s, i) => (
          <button key={s} type="button" role="tab" aria-selected={step === i} class={`step-tab${i < step ? ' is-past' : ''}`}
            onClick={() => setStep(i)}>
            <span class="step-dot" aria-hidden="true">{i < step ? <Icon name="check" size={12} /> : i}</span>
            {s}
          </button>
        ))}
      </div>

      <div class="example-body">
        <div class="story" aria-live="polite">
          <h4>{story.h}</h4>
          <ul>{story.p.map((p) => <li key={p}>{p}</li>)}</ul>
          <div class="story-nav">
            <button type="button" class="button-quiet" disabled={step === 0} onClick={() => setStep(step - 1)}>{c.prev}</button>
            <button type="button" class="button" disabled={step === last} onClick={() => setStep(step + 1)}>
              {c.next}<Icon name="arrow" size={16} />
            </button>
          </div>
        </div>

        <BucketBoard lang={lang}
          columns={COLS.map((col) => ({ ...col, title: c.cols[col.id][0], sub: c.cols[col.id][1] }))}
          chips={shown.map((x) => ({ ...x, key: x.title, fresh: x.sem === step }))} />
      </div>

      <BoardLegend lang={lang} kinds={['stamm', 'lecture', 'seminar', 'practical', 'minor', 'iq', 'thesis']} />

      <ul class="counters">
        <Counter label={c.counters.total} value={sum(() => true)} min={RULES.total} />
        <Counter label={c.counters.stamm} value={shown.filter((x) => x.kind === 'stamm').length} min={RULES.stamm} unit="" />
        <Counter label={c.counters.a1Lec} value={sum((x) => x.col === 'a1' && x.kind === 'lecture')} min={RULES.areaLectureMin} />
        <Counter label={c.counters.a2Lec} value={sum((x) => x.col === 'a2' && x.kind === 'lecture')} min={RULES.areaLectureMin} />
        <Counter label={c.counters.seminar} value={sum((x) => x.kind === 'seminar')} min={RULES.seminarMin} />
        <Counter label={c.counters.practical} value={sum((x) => x.kind === 'practical')} min={RULES.practicalMin} />
        <Counter label={c.counters.sp} value={sum((x) => x.kind === 'seminar' || x.kind === 'practical')} min={RULES.spMin} max={RULES.spMax} />
      </ul>
    </section>
  )
}
