import { useMemo } from 'preact/hooks'
import { AREAS, moduleAreas, moduleKind, RULES } from '../../logic/degree'
import type { CoursesFile, Lang } from '../../types'
import { TermLink } from '../glossary/GlossaryView'
import { Icon } from '../Icon'
import { CountsFlow } from './CountsFlow'
import { ExamplePlan } from './ExamplePlan'

/** Glossary entry per rule card, in the order of `copy.*.rules`. */
const RULE_TERMS: (string | null)[] = ['area', 'stamm', 'seminar', 'elective', 'minor', 'iq', 'module', 'area', null]

const HANDBOOK = 'https://www.informatik.kit.edu/downloads/stud/88-979-H-2025_v1_2026-09-09_en.pdf'
const FAQ = 'https://www.informatik.kit.edu/faq-wiki/doku.php?id=start'
const ISS = 'beratung-informatik@informatik.kit.edu'

const copy = {
  tr: {
    title: 'Yüksek lisans nasıl işliyor?',
    lead: '120 ECTS beş parçadan oluşur. Hangi dersin nereye sayılacağını ve hangi şartların olduğunu buradan takip et.',
    parts: {
      areas: 'İki uzmanlık alanı', areasNote: 'her biri en az 15',
      elective: 'Seçmeli', minor: 'Yan dal', iq: 'Disiplinlerarası', thesis: 'Master tezi',
    },
    rulesTitle: 'Kurallar',
    rules: [
      ['İki uzmanlık alanı', `Her alanda en az ${RULES.areaMin} ECTS, bunun en az ${RULES.areaLectureMin} ECTS'i normal ders olmalı (Telematics'te 8). Seminer, praktikum ve Stammmodul bu ${RULES.areaLectureMin} ECTS'e sayılmaz. İki alan toplamı en fazla ${RULES.areasMax} ECTS.`],
      ['4 Stammmodul', 'Her biri 6 ECTS. Uzmanlık alanında ya da seçmelide sayılabilir. Lisansta aldığın bir Stammmodulü tekrar alamazsın.'],
      ['Seminer ve praktikum', `En az ${RULES.seminarMin} ECTS seminer ve en az ${RULES.practicalMin} ECTS praktikum. İkisi toplam ${RULES.spMin}–${RULES.spMax} ECTS; fazlası sayılmaz.`],
      ['Seçmeli', `${RULES.electiveMin}–${RULES.electiveMax} ECTS. Tüm alanların modülleri buraya sayılabilir.`],
      ['Yan dal', `${RULES.minorMin}–${RULES.minorMax} ECTS, tek bir yan dal: Biologically Inspired Robotics, Elektrik, Matematik, Ekonomi ya da Hukuk.`],
      ['Disiplinlerarası', `${RULES.iqMin}–${RULES.iqMax} ECTS, notsuz. HoC, FORUM ve Dil Merkezi (SpZ) dersleri; İngilizce dil sertifikalarının B2 üstü olması gerekir.`],
      ['Bir modül tek yere', 'Her modül yalnızca bir bölüme sayılır. Bu yüzden "Programım"da her ders için nereye sayılacağını seçiyorsun.'],
      ['Alan sabitlenir', 'Bir alanda ilk sınava girdiğinde o alan sabitlenir. Değiştirmek için sınav kurulunun onayı gerekir.'],
      ['Dil', 'En fazla 30 ECTS Almanca ders alınabilir.'],
    ] as [string, string][],
    termTitle: (term: string) => `Bu dönem (${term})`,
    stammOffered: 'Bu dönem açılan Stammmodüller',
    stammNote: 'Stammmodüller yılda bir kez açılır. Kaçırırsan bir sonraki kış dönemini beklersin.',
    areaTable: 'Alanlara göre bu dönemin modülleri',
    colArea: 'Alan', colModules: 'Modül', colLecture: 'Normal ders ECTS',
    thinNote: 'Kırmızı: bu dönem, alanın normal ders şartını (10 ECTS) tek başına karşılayacak kadar ders yok.',
    tacticsTitle: 'İlk dönem için taktikler',
    tactics: [
      'Dönem başına yaklaşık 30 ECTS hedefle. Dört dönemin sonuncusu genelde tez (30 ECTS) için ayrılır.',
      'İlgilendiğin alanlara uyan Stammmodülleri ilk yılda al; her biri yılda bir kez açılır.',
      'Alanını henüz bilmiyorsan 2–3 aday alandan normal ders al. "Programım"daki öneri kutusu hangi alanların dolmaya yakın olduğunu gösterir.',
      'Bir alanda sınava girmeden önce o alanı gerçekten istediğinden emin ol; sonra değiştirmek onay ister.',
      'Seminer ve praktikumları dönemlere yay; toplam 18 ECTS üstü sayılmaz. Kontenjanlar sınırlı olabilir, kayıt bilgisini ILIAS veya ders sayfasında erkenden kontrol et.',
      '"Düzensiz açılır" etiketli dersler bir sonraki yıl açılmayabilir; ilgini çekiyorsa şimdi değerlendir.',
      'Yan dal ve disiplinlerarası dersler bu katalogda değil; onları ayrıca planla.',
      'Sınava kaydolmadan önce CMS\'teki çalışma planında modülü ve kısmi başarıyı (Teilleistung) seç.',
    ],
    stepsTitle: 'Bu site ile plan yapmak',
    steps: [
      ['Kataloğu daralt', 'Filtrelerde uzmanlık alanını ve ders tipini (ör. Stammmodul) seç.'],
      ['Programa ekle', 'Kartlardaki hafta şeridi dersin ne zaman olduğunu, kırmızı uyarı çakışmayı gösterir.'],
      ['Şartları takip et', '"Programım"da iki alanını seç, her dersin nereye sayılacağını belirle ve çubukları izle.'],
    ] as [string, string][],
    sourcesTitle: 'Resmî kaynaklar',
    handbook: 'Modül kitabı 88-979-H-2025 (09.09.2026, WS 26/27)',
    faq: 'Informatik FAQ wiki',
    iss: 'Informatik Studiengangservice (ISS)',
    disclaimer: 'Bu sayfa modül kitabının bir özetidir; bağlayıcı olan SPO ve güncel modül kitabıdır. Ders tipleri (seminer, praktikum, Stammmodul) katalogdan tahmin edilir. Emin olmadığında ISS\'e yaz.',
  },
  en: {
    title: 'How the Master’s degree works',
    lead: '120 ECTS come from five parts. Use this page to see where a course can count and which rules apply.',
    parts: {
      areas: 'Two areas of specialization', areasNote: 'at least 15 each',
      elective: 'Elective studies', minor: 'Minor', iq: 'Interdisciplinary', thesis: 'Master’s thesis',
    },
    rulesTitle: 'Rules',
    rules: [
      ['Two areas of specialization', `At least ${RULES.areaMin} ECTS in each, including at least ${RULES.areaLectureMin} ECTS of lectures (8 in Telematics). Seminars, practicals and advanced mandatory modules do not count towards those ${RULES.areaLectureMin} ECTS. Both areas together: at most ${RULES.areasMax} ECTS.`],
      ['4 advanced mandatory modules', '6 ECTS each, counted in an area or in elective studies. One you passed in your Bachelor’s cannot be taken again.'],
      ['Seminars and practicals', `At least ${RULES.seminarMin} ECTS of seminars and ${RULES.practicalMin} ECTS of practicals; ${RULES.spMin}–${RULES.spMax} ECTS together, credits above that do not count.`],
      ['Elective studies', `${RULES.electiveMin}–${RULES.electiveMax} ECTS. Modules of every area may count here.`],
      ['Minor', `${RULES.minorMin}–${RULES.minorMax} ECTS in one minor: Biologically Inspired Robotics, Electrical Engineering, Mathematics, Economics or Law.`],
      ['Interdisciplinary qualifications', `${RULES.iqMin}–${RULES.iqMax} ECTS, pass/fail. Courses from HoC, FORUM and the Language Center (SpZ); English certificates must be above B2.`],
      ['One module, one place', 'Each module counts in exactly one part. That is why you pick where each course counts in “My schedule”.'],
      ['Areas get fixed', 'Your first exam in an area fixes that area. Changing it needs the examination board’s approval.'],
      ['Language', 'At most 30 ECTS may be taken in German.'],
    ] as [string, string][],
    termTitle: (term: string) => `This term (${term})`,
    stammOffered: 'Advanced mandatory modules offered this term',
    stammNote: 'They are offered once a year. Miss one and the next chance is next winter.',
    areaTable: 'This term’s modules by area',
    colArea: 'Area', colModules: 'Modules', colLecture: 'Lecture ECTS',
    thinNote: 'Red: this term alone does not offer enough lectures for the area’s lecture minimum (10 ECTS).',
    tacticsTitle: 'Tactics for your first term',
    tactics: [
      'Aim for about 30 ECTS per term. The last of four terms usually goes to the thesis (30 ECTS).',
      'Take the advanced mandatory modules that fit your likely areas in your first year; each is offered once a year.',
      'Not sure about your areas yet? Take lectures from 2–3 candidate areas. The suggestions in “My schedule” show which areas are filling up.',
      'Be sure about an area before your first exam in it; changing later needs approval.',
      'Spread seminars and practicals over your terms; above 18 ECTS they no longer count. Places can be limited, so check registration on ILIAS or the course page early.',
      'Courses tagged “Offered irregularly” may not run next year; take them now if they interest you.',
      'Minor and interdisciplinary courses are not in this catalog; plan them separately.',
      'Before registering for an exam, add the module and its partial achievement to your study plan in CMS.',
    ],
    stepsTitle: 'Planning with this site',
    steps: [
      ['Narrow the catalog', 'Filter by area and by kind, for example advanced mandatory.'],
      ['Add to your schedule', 'The week strip on each card shows when a course meets; a red warning means a clash.'],
      ['Track the requirements', 'In “My schedule”, choose your two areas, set where each course counts and watch the bars.'],
    ] as [string, string][],
    sourcesTitle: 'Official sources',
    handbook: 'Module handbook 88-979-H-2025 (09/09/2026, WS 26/27)',
    faq: 'Informatics FAQ wiki',
    iss: 'Informatics Study Program Service (ISS)',
    disclaimer: 'This page summarizes the module handbook; the examination regulations and the current handbook are binding. Course kinds (seminar, practical, advanced mandatory) are inferred from the catalog. Ask ISS when in doubt.',
  },
}

/** The 120 ECTS as proportional blocks, minimums first. */
function DegreeBar({ c }: { c: (typeof copy)['tr'] }) {
  const blocks = [
    { key: 'area', label: c.parts.areas, value: `≥ ${RULES.areaMin * 2}`, note: c.parts.areasNote, w: 30 },
    { key: 'elective', label: c.parts.elective, value: `${RULES.electiveMin}–${RULES.electiveMax}`, w: 34 },
    { key: 'minor', label: c.parts.minor, value: `${RULES.minorMin}–${RULES.minorMax}`, w: 16 },
    { key: 'iq', label: c.parts.iq, value: `${RULES.iqMin}–${RULES.iqMax}`, w: 16 },
    { key: 'thesis', label: c.parts.thesis, value: String(RULES.thesis), w: 30 },
  ]
  return (
    <div class="degree-bar" role="img" aria-label={blocks.map((b) => `${b.label}: ${b.value} ECTS`).join(', ')}>
      {blocks.map((b) => (
        <div key={b.key} class={`degree-block block-${b.key}`} style={{ flexGrow: b.w }}>
          <strong>{b.value}</strong>
          <span>{b.label}</span>
          {b.note && <small>{b.note}</small>}
        </div>
      ))}
    </div>
  )
}

export function GuideView({ lang, data }: { lang: Lang; data: CoursesFile }) {
  const c = copy[lang]
  const { stamm, byArea } = useMemo(() => {
    const mods = Object.values(data.modules)
    return {
      stamm: mods.filter((m) => moduleKind(data, m) === 'stamm').sort((a, b) => a.title.localeCompare(b.title)),
      byArea: AREAS.map((area) => {
        const inArea = mods.filter((m) => moduleAreas(m).includes(area))
        return {
          area,
          count: inArea.length,
          lectureCp: inArea.filter((m) => moduleKind(data, m) === 'lecture').reduce((n, m) => n + (m.ects ?? 0), 0),
        }
      }).sort((a, b) => b.count - a.count),
    }
  }, [data])

  return (
    <article class="guide">
      <header class="guide-head">
        <h2>{c.title}</h2>
        <p class="guide-lead">{c.lead}</p>
        <DegreeBar c={c} />
      </header>

      <ExamplePlan lang={lang} />
      <CountsFlow lang={lang} />

      <section class="guide-section">
        <h3>{c.rulesTitle}</h3>
        <dl class="rules">
          {c.rules.map(([k, v], i) => (
            <div key={k} class="rule">
              <dt>{k}{RULE_TERMS[i] && <TermLink id={RULE_TERMS[i]!} lang={lang} />}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section class="guide-section">
        <h3>{c.termTitle(data.meta.term)}</h3>
        <div class="term-grid">
          <div class="panel">
            <h4>{c.stammOffered}</h4>
            <ul class="plain stamm-list">
              {stamm.map((m) => <li key={m.id}><span>{m.title}</span><span class="muted">{m.ects} ECTS</span></li>)}
            </ul>
            <p class="note">{c.stammNote}</p>
          </div>
          <div class="panel">
            <h4>{c.areaTable}</h4>
            <table class="area-table">
              <thead><tr><th>{c.colArea}</th><th>{c.colModules}</th><th>{c.colLecture}</th></tr></thead>
              <tbody>
                {byArea.map((a) => (
                  <tr key={a.area} class={a.lectureCp < (RULES.areaLectureMinReduced[a.area] ?? RULES.areaLectureMin) ? 'is-thin' : ''}>
                    <td>{a.area}</td><td>{a.count}</td><td>{a.lectureCp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {byArea.some((a) => a.lectureCp < (RULES.areaLectureMinReduced[a.area] ?? RULES.areaLectureMin)) && <p class="note">{c.thinNote}</p>}
          </div>
        </div>
      </section>

      <section class="guide-section">
        <h3>{c.tacticsTitle}</h3>
        <ul class="tactics">
          {c.tactics.map((x) => <li key={x}><Icon name="check" size={16} /><span>{x}</span></li>)}
        </ul>
      </section>

      <section class="guide-section">
        <h3>{c.stepsTitle}</h3>
        <ol class="steps">
          {c.steps.map(([k, v]) => <li key={k}><strong>{k}</strong><span>{v}</span></li>)}
        </ol>
      </section>

      <section class="guide-section sources">
        <h3>{c.sourcesTitle}</h3>
        <ul class="plain">
          <li><a class="ext-link" href={HANDBOOK} target="_blank" rel="noopener">{c.handbook}<Icon name="external" size={14} /></a></li>
          <li><a class="ext-link" href={FAQ} target="_blank" rel="noopener">{c.faq}<Icon name="external" size={14} /></a></li>
          <li>{c.iss}: <a href={`mailto:${ISS}`}>{ISS}</a></li>
        </ul>
        <p class="note">{c.disclaimer}</p>
      </section>
    </article>
  )
}
