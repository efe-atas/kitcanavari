// Terms found in the KIT catalog data and on this site that are new to most incoming students.
// Definitions follow the module handbook 88-979-H-2025 (09/09/2026) where it covers them.
import { attendanceOf } from '../../logic/attendance'
import { moduleKind } from '../../logic/degree'
import type { CoursesFile, Lang } from '../../types'

export type Category = 'structure' | 'types' | 'time' | 'exams' | 'places' | 'career'

export interface Term {
  id: string
  cat: Category
  term: string
  /** Original German and/or English names. */
  aka?: string
  def: Record<Lang, string>
  /** Where the term shows up on this site or in the catalog. */
  where?: Record<Lang, string>
  related?: string[]
  /** A live fact from this term's catalog data. */
  count?: (data: CoursesFile, lang: Lang) => string | null
}

export const CATEGORIES: Record<Category, Record<Lang, string>> = {
  structure: { tr: 'Programın yapısı', en: 'Degree structure' },
  types: { tr: 'Ders türleri', en: 'Course types' },
  time: { tr: 'Zaman ve yük', en: 'Time and workload' },
  exams: { tr: 'Sınavlar ve kayıt', en: 'Exams and registration' },
  places: { tr: 'Kurumlar, araçlar, yerler', en: 'Offices, tools, places' },
  career: { tr: 'Kariyer görünümü', en: 'Career view' },
}

const byType = (code: string) => (data: CoursesFile, lang: Lang) => {
  const n = Object.values(data.events).filter((e) => e.typeCode === code).length
  if (!n) return null
  return lang === 'tr' ? `Bu dönem katalogda ${n} ders bu türde.` : `${n} courses of this type in this term’s catalog.`
}

const byKind = (kind: string) => (data: CoursesFile, lang: Lang) => {
  const n = Object.values(data.modules).filter((m) => moduleKind(data, m) === kind).length
  if (!n) return null
  return lang === 'tr' ? `Bu dönem ${n} modül bu türde.` : `${n} modules of this kind this term.`
}

export const TERMS: Term[] = [
  // Degree structure
  {
    id: 'ects', cat: 'structure', term: 'ECTS', aka: 'LP (Leistungspunkte), CP (credit points)',
    def: {
      tr: 'Kredi birimi. 1 ECTS yaklaşık 30 saat iş yüküne denk gelir: derse girmek, ödevler ve sınava hazırlık dahil. Yüksek lisans toplam 120 ECTS; bir dönem için tipik yük 30 ECTS. LP ve CP aynı şeyin Almanca ve İngilizce adı.',
      en: 'The credit unit. 1 ECTS is about 30 hours of work, including classes, assignments and exam preparation. The Master’s is 120 ECTS; a typical term is 30. LP and CP are the German and English names for the same thing.',
    },
    where: { tr: 'Kartlarda ve "Programım"daki toplamda.', en: 'On course cards and in the total in “My schedule”.' },
    related: ['module', 'sws'],
  },
  {
    id: 'spo', cat: 'structure', term: 'SPO', aka: 'Studien- und Prüfungsordnung',
    def: {
      tr: 'Bölümünün çalışma ve sınav yönetmeliği. Hangi şartlarla mezun olacağını belirler. Bu site SPO 2025\'e (kod 88-979-H-2025) göre hazırlandı.',
      en: 'The study and examination regulations of your programme; they define what you need to graduate. This site follows SPO 2025 (code 88-979-H-2025).',
    },
    where: { tr: 'Sayfanın altındaki bilgi satırında.', en: 'In the footer of every page.' },
    related: ['handbook'],
  },
  {
    id: 'level', cat: 'structure', term: 'Lisans mı, yüksek lisans mı?', aka: 'Bachelor, Master, Level 4',
    def: {
      tr: 'Bu sitedeki her ders yüksek lisansına sayılır. Veriler çekilirken yalnızca senin yüksek lisans yönetmeliğine (SPO 88-979-H-2025) bağlı modülleri olan dersler alınıyor; lisans dersleri hiç gösterilmiyor. Modül kitabına göre bu modüllerin hepsi "Level 4", yani yüksek lisans seviyesi. KIT kataloğundaki dal adlarında "Bachelor" geçse bile bu geçerli. KIT\'in kendi kataloğunda gezerken ise bir dersin ders sayfasındaki "Degree programs and bricks" kısmında SPO 2025 Master\'ın yazıp yazmadığına bak.',
      en: 'Every course on this site counts for your Master’s. The data keeps only courses whose modules belong to your Master’s regulations (SPO 88-979-H-2025); Bachelor courses are never shown. According to the handbook all of these modules are “Level 4”, i.e. Master level, even when a KIT catalog branch says “Bachelor”. When browsing KIT’s own catalog, check that “Degree programs and bricks” on the course page lists the 2025 Master’s.',
    },
    where: { tr: 'Katalog sayfasının başlığının altında.', en: 'Below the catalog page title.' },
    count: (data, lang) => {
      const n = Object.values(data.modules).filter((m) => m.level === '4').length
      const all = Object.keys(data.modules).length
      return lang === 'tr' ? `Bu dönemki ${all} modülün ${n} tanesi Level 4 (yüksek lisans).` : `${n} of this term’s ${all} modules are Level 4 (Master’s).`
    },
    related: ['spo', 'module', 'proseminar'],
  },
  {
    id: 'handbook', cat: 'structure', term: 'Modül kitabı', aka: 'Modulhandbuch, Module handbook',
    def: {
      tr: 'Tüm modülleri, içeriklerini, sınav şekillerini ve programın kurallarını anlatan resmî kılavuz. Her dönem güncellenir; o dönemin sürümü bağlayıcıdır. Bu site WS 26/27 için yayımlanan 09.09.2026 tarihli sürümü kullanıyor.',
      en: 'The official guide to every module, its content and exams, and the programme rules. It is updated every term; the current version is binding. This site uses the 09/09/2026 version for WS 26/27.',
    },
    related: ['spo', 'module'],
  },
  {
    id: 'module', cat: 'structure', term: 'Modül', aka: 'Modul, Module (M-INFO-…)',
    def: {
      tr: 'Kredinin ait olduğu birim. Bir modül bir ya da birkaç dersten oluşur ve ECTS dersin değil modülün üzerindedir. Bir ders birden fazla modüle bağlı olabilir; o zaman hangi modül için alacağını seçersin.',
      en: 'The unit that carries credits. A module consists of one or more courses, and the ECTS belong to the module, not to the course. A course can belong to several modules; then you choose which one you take it for.',
    },
    where: { tr: 'Ders detayındaki "Modüller" ve "Programım"daki "Sayılacağı modül" seçimi.', en: '“Modules” in course details and the “Counts for module” select in “My schedule”.' },
    related: ['teilleistung', 'ects'],
  },
  {
    id: 'teilleistung', cat: 'structure', term: 'Teilleistung', aka: 'Partial achievement, Brick (T-INFO-…)',
    def: {
      tr: 'Modülün sınav ya da ödev parçası. Bir modül bir veya birkaç Teilleistung\'dan oluşur; sınava kaydolurken aslında bunlara kaydolursun. Modül sayfalarında sık görülen "See partial achievements (Teilleistung)" yazısı, sınav ve ön koşul bilgisinin bu parçaların sayfasında olduğu anlamına gelir.',
      en: 'The exam or coursework part of a module. A module has one or more of them, and exam registration is really registration for these. “See partial achievements (Teilleistung)” on module pages means the exam and prerequisite details live on those parts’ pages.',
    },
    where: { tr: 'Ders detayında modül açıklamalarının "Sınav" ve "Ön koşullar" satırları.', en: 'The “Assessment” and “Prerequisites” rows of module details.' },
    count: (data, lang) => {
      const n = Object.values(data.modules).filter((m) => /teilleistung/i.test(`${m.description.exam} ${m.description.prerequisites}`)).length
      return lang === 'tr' ? `${n} modülün açıklamasında geçiyor.` : `Mentioned in ${n} module descriptions.`
    },
    related: ['module', 'pruefungsleistung', 'studienablaufplan'],
  },
  {
    id: 'area', cat: 'structure', term: 'Uzmanlık alanı', aka: 'Vertiefungsfach, Area of Specialization',
    def: {
      tr: 'Derinleştiğin iki konu alanı (ör. Cryptography and Security). İkisinde de en az 15 ECTS, bunun en az 10 ECTS\'i normal ders olmalı (Telematics\'te 8). Bir alanda ilk sınava girdiğinde o alan sabitlenir.',
      en: 'The two subject areas you specialise in (e.g. Cryptography and Security). Each needs at least 15 ECTS, at least 10 of them lectures (8 in Telematics). Your first exam in an area fixes it.',
    },
    where: { tr: 'Katalogdaki "Uzmanlık alanı" filtresi ve "Programım"daki alan seçimi.', en: 'The “Area” filter in the catalog and the area pickers in “My schedule”.' },
    related: ['elective', 'stamm', 'vorlesung'],
  },
  {
    id: 'elective', cat: 'structure', term: 'Seçmeli', aka: 'Wahlbereich, Elective Studies',
    def: {
      tr: '6–49 ECTS\'lik serbest bölüm. Tüm uzmanlık alanlarının modülleri buraya sayılabilir; seçtiğin iki alanın dışındaki dersler genelde buraya gider.',
      en: 'A free part of 6–49 ECTS. Modules from every area may count here; courses outside your two areas usually go here.',
    },
    related: ['area'],
  },
  {
    id: 'minor', cat: 'structure', term: 'Yan dal', aka: 'Ergänzungsfach, Minor Studies',
    def: {
      tr: 'Bilgisayar bilimi dışından bir komşu alan: Biologically Inspired Robotics, Elektrik, Matematik, Ekonomi ya da Hukuk. Tek bir yan dal seçilir; 9–18 ECTS. 18\'in üstü sayılmaz.',
      en: 'A neighbouring field outside computer science: Biologically Inspired Robotics, Electrical Engineering, Mathematics, Economics or Law. You pick one; 9–18 ECTS, credits above 18 are discarded.',
    },
    related: ['iq'],
  },
  {
    id: 'iq', cat: 'structure', term: 'Disiplinlerarası yeterlilikler', aka: 'Überfachliche Qualifikationen, Interdisciplinary Qualifications',
    def: {
      tr: 'Soft skill, dil ve toplumsal konular: 2–6 ECTS, notsuz (geçti/kaldı). HoC, FORUM ve Dil Merkezi (SpZ) dersleri sayılır; İngilizce dil sertifikalarının B2 üstü olması gerekir. "Practice of Research (Methods)" modülleri de buraya sayılabilir. Katılım belgesi yetmez; bir sınav ya da ödev gerekir.',
      en: 'Soft skills, languages and societal topics: 2–6 ECTS, pass/fail. Courses from HoC, FORUM and the Language Center (SpZ) count; English certificates must be above B2. The “Practice of Research (Methods)” modules can count here too. A participation certificate is not enough; an exam or coursework is required.',
    },
    related: ['hoc', 'minor'],
  },
  {
    id: 'stamm', cat: 'structure', term: 'Stammmodul', aka: 'Advanced mandatory module',
    def: {
      tr: 'Bilgisayar biliminin temel konularını kapsayan 11 modülden biri (ör. Algorithms II, IT Security). Bunların 3\'ü (Computer Architecture, Computer Graphics, Formal Systems) Almanca. 4 tanesini almak zorunlu, her biri 6 ECTS. Yılda bir kez açılırlar. Uzmanlık alanında ya da seçmelide sayılırlar ama alanın "10 ECTS normal ders" şartına sayılmazlar. Lisansta aldığını tekrar alamazsın.',
      en: 'One of 11 modules covering core computer science (e.g. Algorithms II, IT Security); three of them (Computer Architecture, Computer Graphics, Formal Systems) are taught in German. Four are required, 6 ECTS each, offered once a year. They count in an area or in elective studies, but not towards an area’s 10 ECTS of lectures. One you passed in your Bachelor’s cannot be taken again.',
    },
    where: { tr: 'Kartlardaki koyu "Stammmodul" rozeti ve "Ders tipi" filtresi.', en: 'The dark badge on cards and the “Kind” filter.' },
    count: byKind('stamm'),
    related: ['area', 'vorlesung'],
  },
  {
    id: 'thesis', cat: 'structure', term: 'Master tezi', aka: 'Masterarbeit, Master’s thesis',
    def: {
      tr: '30 ECTS\'lik bitirme çalışması; genelde son dönemde yazılır.',
      en: 'The 30 ECTS final project, usually written in the last term.',
    },
  },
  {
    id: 'zusatz', cat: 'structure', term: 'Ek dersler', aka: 'Zusatzleistungen, Additional modules',
    def: {
      tr: 'Mezuniyet için gerekmeyen, ilgi için aldığın dersler; en fazla 30 ECTS. Not ortalamasına girmez.',
      en: 'Courses taken beyond the requirements, up to 30 ECTS. They do not count towards your grade.',
    },
  },

  // Course types
  {
    id: 'vorlesung', cat: 'types', term: 'Vorlesung (V)', aka: 'Lecture',
    def: {
      tr: 'Hocanın konuyu anlattığı klasik ders. Kural dilinde "normal ders" denen şey budur: uzmanlık alanının 10 ECTS\'lik ders şartını sadece bunlar doldurur.',
      en: 'The classic lecture. In the rules this is what “lectures” means: only these fill an area’s 10 ECTS lecture minimum.',
    },
    where: { tr: 'Kartın sol üstündeki "V" rozeti.', en: 'The “V” badge on the top left of a card.' },
    count: byType('V'),
    related: ['uebung', 'vue'],
  },
  {
    id: 'uebung', cat: 'types', term: 'Übung (Ü)', aka: 'Exercise, Practice',
    def: {
      tr: 'Derse eşlik eden alıştırma oturumu: problem çözme, ödevlerin konuşulması. Genelde ayrı bir saatte olur ve aynı modüle aittir; ayrıca kredi getirmez.',
      en: 'The exercise session that accompanies a lecture: problem solving and discussing assignments. It usually has its own time slot and belongs to the same module; it brings no extra credits.',
    },
    count: byType('Ü'),
    related: ['vorlesung', 'vue'],
  },
  {
    id: 'vue', cat: 'types', term: 'VÜ', aka: 'Vorlesung/Übung, Lecture / Practice',
    def: {
      tr: 'Ders ve alıştırmanın tek bir etkinlikte birleştiği tür. Kartta birden fazla haftalık termin görürsen biri genelde alıştırmadır.',
      en: 'Lecture and exercise combined in one event. If a card shows several weekly slots, one of them is often the exercise.',
    },
    count: byType('VÜ'),
    related: ['vorlesung', 'uebung'],
  },
  {
    id: 'seminar', cat: 'types', term: 'Seminar (S)', aka: 'Seminer',
    def: {
      tr: 'Küçük grupla bir konuyu derinlemesine çalıştığın ders: genellikle literatür okuma, yazılı bir rapor ve sunum. En az 3 ECTS seminer şart; seminer ve praktikum birlikte 12–18 ECTS olmalı. Alanın ders şartına sayılmaz.',
      en: 'A small-group course on one topic: usually reading papers, writing a report and giving a talk. At least 3 ECTS of seminars are required, and seminars plus practicals must total 12–18 ECTS. They do not count towards an area’s lecture minimum.',
    },
    where: { tr: 'Kartlardaki mor "Seminer" rozeti.', en: 'The purple “Seminar” badge on cards.' },
    count: byType('S'),
    related: ['praktikum', 'proseminar'],
  },
  {
    id: 'proseminar', cat: 'types', term: 'Proseminar', aka: 'Proseminar',
    def: {
      tr: 'Lisans seviyesindeki giriş semineri; yüksek lisansa sayılmaz. KIT kataloğundaki "Proseminars and Basic Practical Courses … Bachelor" dalında yüksek lisans modüllerine de bağlı dersler var. Bu sitede o daldan yalnızca yüksek lisansına sayılanlar görünüyor.',
      en: 'An introductory seminar at Bachelor level that does not count for the Master’s. The KIT catalog branch “Proseminars and Basic Practical Courses … Bachelor” also holds courses linked to Master’s modules; this site shows only those from that branch.',
    },
    related: ['seminar', 'level'],
  },
  {
    id: 'praktikum', cat: 'types', term: 'Praktikum (P)', aka: 'Practical course, Lab',
    def: {
      tr: 'Dönem boyunca süren uygulamalı ders: genellikle takım halinde bir proje, laboratuvar ya da yazılım geliştirme. Şirket stajı değildir. En az 6 ECTS praktikum şart; alanın ders şartına sayılmaz. Kontenjanlar sınırlı olabilir.',
      en: 'A hands-on course over the term, usually a team project, lab work or software development. It is not an internship. At least 6 ECTS are required; practicals do not count towards an area’s lecture minimum. Places may be limited.',
    },
    where: { tr: 'Kartlardaki turuncu "Praktikum" rozeti.', en: 'The orange “Practical” badge on cards.' },
    count: byType('P'),
    related: ['seminar', 'pg'],
  },
  {
    id: 'pg', cat: 'types', term: 'Projektgruppe (Pg)', aka: 'Project group, Research practical',
    def: {
      tr: 'Proje grubu. Bu katalogda "Practice of Research" dersleri bu türde: araştırma yöntemleri ve bir araştırma projesi. Kurallarda praktikum gibi sayılır.',
      en: 'A project group. In this catalog the “Practice of Research” courses use this type: research methods and a research project. The rules treat them as practicals.',
    },
    count: byType('Pg'),
    related: ['praktikum'],
  },
  {
    id: 'language', cat: 'types', term: 'German/English', aka: 'Ders dili, Course language',
    def: {
      tr: 'Programın tamamen İngilizce ve bu sitedeki tüm modüllerin dili İngilizce. "German/English" modülün değil, KIT kataloğunda o dersin oturumlarının dil bilgisi. Böyle işaretlenenlerin hepsi seminer, praktikum ya da proje grubu. Bu dersler genelde Almanca ve İngilizce yüksek lisans programlarına birlikte açılır; dil gruba göre seçilebilir, seminerlerde rapor ve sunum dili de bazen seçilebilir. Kesin bilgi için dersin ILIAS sayfasına bak ya da hocaya yaz. Dil bilgisi hiç girilmemiş derslerde kartta dil yazmaz. İstersen 120 ECTS\'in en fazla 30\'unu Almanca derslerden alabilirsin, ama onlar bu sitede listelenmiyor.',
      en: 'Your programme is fully in English and every module on this site is English. “German/English” describes the course sessions in KIT’s catalog, not the module. All courses marked this way are seminars, practicals or project groups, typically open to both the German and the English Master’s; the language can depend on the group, and seminar reports and talks sometimes allow either. Check the course’s ILIAS page or ask the lecturer to be sure. Courses with no language entered show none on the card. You may take up to 30 of your 120 ECTS in German courses, but those are not listed on this site.',
    },
    where: { tr: 'Kartlarda ve ders detayında dil bilgisi olarak; katalogdaki "Dil" filtresi.', en: 'As the language on cards and in course details; the “Language” filter.' },
    count: (data, lang) => {
      const n = Object.values(data.events).filter((e) => e.language === 'German/English').length
      return lang === 'tr' ? `Bu dönem ${n} ders "German/English" işaretli; tüm modülleri İngilizce.` : `${n} courses are marked “German/English” this term; all their modules are English.`
    },
    related: ['seminar', 'praktikum', 'ilias'],
  },
  {
    id: 'attendance', cat: 'types', term: 'Devam zorunluluğu', aka: 'Anwesenheitspflicht, Attendance requirement',
    def: {
      tr: 'Bir derse belirli oranda katılmanın şart olması. KIT\'te derslerde (Vorlesung) genellikle yoklama alınmaz. Seminer ve praktikumların çoğunda ise devam beklenir: konu ve gruplar ilk buluşmada (kick-off) dağıtılır, sunumlarda bulunman gerekir. Bağlayıcı kural modül kitabında, dersin Teilleistung açıklamasında ya da ders sayfasında yazar; çoğu derste açıkça yazılmaz. Bu site her ders için katalog metninde ve modül açıklamasında geçen ilgili cümleleri bulup ders detayında "Devam ve katılım" bölümünde kaynağıyla gösterir.',
      en: 'Having to attend a course to a certain extent. At KIT, lectures usually take no attendance. Most seminars and practicals do expect it: topics and groups are handed out at the first meeting (kick-off) and you are expected at the talks. The binding rule is in the module handbook (the partial achievement’s description) or on the course page, and is often not stated explicitly. This site finds the relevant sentences in each course and module text and shows them with their source under “Attendance” in the course details.',
    },
    where: { tr: 'Kartlardaki "Devam zorunlu" ve "Kick-off" etiketleri; ders detayındaki "Devam ve katılım" bölümü.', en: 'The “Attendance required” and “Kick-off” tags on cards; the “Attendance” section in course details.' },
    count: (data, lang) => {
      const all = Object.values(data.events).map((e) => attendanceOf(data, e).level)
      const req = all.filter((l) => l === 'required').length
      const kick = all.filter((l) => l === 'kickoff').length
      return lang === 'tr' ? `Bu dönem ${req} derste devam açıkça zorunlu, ${kick} derste ilk buluşma belirtilmiş.` : `This term ${req} courses state required attendance and ${kick} mention a first meeting.`
    },
    related: ['seminar', 'praktikum', 'teilleistung', 'ilias'],
  },
  {
    id: 'block', cat: 'types', term: 'Blok ders', aka: 'Blockveranstaltung, Block course',
    def: {
      tr: 'Düzenli haftalık saati olmayan, birkaç güne ya da tek tek tarihlere toplanmış ders. Takvimde haftalık blok olarak görünmez.',
      en: 'A course without a weekly slot, packed into a few days or single dates. It does not appear as a weekly block in the timetable.',
    },
    where: { tr: '"Programım"daki "Zamanı belirsiz / blok dersler" kutusu.', en: 'The “Unscheduled / block courses” box in “My schedule”.' },
    related: ['rhythm'],
  },

  // Time and workload
  {
    id: 'sws', cat: 'time', term: 'SWS', aka: 'Semesterwochenstunden',
    def: {
      tr: 'Haftalık ders saati. 1 SWS haftada 45 dakika demek; 2 SWS haftada bir 90 dakikalık oturum, 4 SWS haftada iki oturum. ECTS ile karıştırma: SWS sadece sınıfta geçen süre, ECTS ise toplam iş yükü.',
      en: 'Weekly contact hours. 1 SWS is 45 minutes per week; 2 SWS is one 90-minute session a week, 4 SWS two. Don’t confuse it with ECTS: SWS is class time only, ECTS is total workload.',
    },
    where: { tr: 'Kartlarda dilin yanında, ör. "4 SWS".', en: 'On cards next to the language, e.g. “4 SWS”.' },
    count: (data, lang) => {
      const n = Object.values(data.events).filter((e) => e.sws === 2).length
      return lang === 'tr' ? `Bu dönem ${n} ders 2 SWS.` : `${n} courses are 2 SWS this term.`
    },
    related: ['ects', 'termin'],
  },
  {
    id: 'semester', cat: 'time', term: 'WS / SS', aka: 'Wintersemester, Sommersemester',
    def: {
      tr: 'Kış dönemi (Ekim\'de başlar) ve yaz dönemi (Nisan\'da başlar). Birçok modül yalnızca birinde açılır; "Each winter term" sadece kış, "Irregular" düzensiz demek.',
      en: 'Winter term (starts in October) and summer term (starts in April). Many modules run in only one of them; “Each winter term” means winter only, “Irregular” means not every year.',
    },
    where: { tr: 'Modül detayındaki "Dönem" satırı ve kartlardaki "Düzensiz açılır" etiketi.', en: 'The “Offered” row in module details and the “Offered irregularly” tag.' },
    count: (data, lang) => {
      const n = Object.values(data.modules).filter((m) => /irregular/i.test(m.recurrence ?? '')).length
      return lang === 'tr' ? `Bu dönem ${n} modül düzensiz açılıyor.` : `${n} modules this term are offered irregularly.`
    },
  },
  {
    id: 'termin', cat: 'time', term: 'Termin', aka: 'Appointment, Time slot',
    def: {
      tr: 'Bir dersin buluştuğu gün ve saat. Bir ders birden fazla termine sahip olabilir (ör. ders salı, alıştırma perşembe). "Programım"da her termini ayrı ayrı açıp kapatabilirsin.',
      en: 'The day and time a course meets. A course can have several (e.g. lecture on Tuesday, exercise on Thursday). In “My schedule” you can switch each one on or off.',
    },
    where: { tr: 'Ders detayındaki "Haftalık terminler".', en: '“Weekly times” in course details.' },
    related: ['rhythm', 'sws'],
  },
  {
    id: 'rhythm', cat: 'time', term: 'Ritim', aka: 'wöchentlich, 14-täglich, Einzeltermin',
    def: {
      tr: 'Terminin ne sıklıkla tekrarladığı: haftalık (weekly), iki haftada bir (fortnightly) ya da tek seferlik (single). Tek seferlik tarihler takvimde haftalık blok olarak görünmez.',
      en: 'How often a slot repeats: weekly, fortnightly or once (single). Single dates are not drawn as weekly blocks.',
    },
    count: (data, lang) => {
      const n = Object.values(data.events).filter((e) => e.slots.some((x) => x.rhythm === 'single')).length
      return lang === 'tr' ? `Bu dönem ${n} derste tek seferlik termin var.` : `${n} courses have single-date slots this term.`
    },
    related: ['termin', 'block'],
  },
  {
    id: 'format', cat: 'time', term: 'On-Site / Blended / Online', aka: 'Präsenz, Hybrid',
    def: {
      tr: 'Dersin nasıl yapıldığı: yüz yüze, karma (bir kısmı çevrimiçi) ya da tamamen çevrimiçi.',
      en: 'How the course is held: in person, blended (partly online) or fully online.',
    },
  },

  // Exams and registration
  {
    id: 'pruefungsleistung', cat: 'exams', term: 'Prüfungsleistung', aka: 'Exam (graded)',
    def: {
      tr: 'Notlu sınav: yazılı, sözlü ya da "başka türde" (anderer Art; ör. proje, sunum). Genelde bir kez tekrar edilebilir. Yazılı sınav ikinci kez de geçilmezse kısa süre içinde sözlü tekrar sınavı yapılır.',
      en: 'A graded exam: written, oral or “of another type” (anderer Art, e.g. a project or talk). It can usually be repeated once; if a written exam is failed twice, an oral re-examination follows promptly.',
    },
    related: ['studienleistung', 'anmeldung'],
  },
  {
    id: 'studienleistung', cat: 'exams', term: 'Studienleistung', aka: 'Coursework (ungraded)',
    def: {
      tr: 'Notsuz çalışma: ödev teslimi, alıştırma puanı gibi. Bazen sınava girebilmek için ön koşuldur. Modül kitabında aksi yazmadıkça geçene kadar tekrarlanabilir.',
      en: 'Ungraded coursework such as assignments or exercise points, sometimes a prerequisite for the exam. Unless the handbook says otherwise, it can be repeated until passed.',
    },
    related: ['pruefungsleistung', 'teilleistung'],
  },
  {
    id: 'anmeldung', cat: 'exams', term: 'Anmeldung / Abmeldung', aka: 'Exam registration / withdrawal',
    def: {
      tr: 'Sınava kayıt ve kayıttan çekilme; CMS üzerinden yapılır ve son tarihleri vardır. Kayıtsız sınava giremezsin; kaydın "angemeldet" (kayıtlı) göründüğünü kontrol et.',
      en: 'Registering for and withdrawing from an exam, done in CMS with deadlines. You may not sit an exam without registering; check that the status shows “angemeldet” (registered).',
    },
    related: ['studienablaufplan', 'cms'],
  },
  {
    id: 'studienablaufplan', cat: 'exams', term: 'Studienablaufplan', aka: 'Individual study plan',
    def: {
      tr: 'CMS\'teki kişisel çalışma planın. Bir sınava kaydolmadan önce modülü ve Teilleistung\'u bu plana eklemen gerekir; uzmanlık alanlarını ve yan dalını da burada seçersin.',
      en: 'Your personal study plan in CMS. Before registering for an exam you add the module and its partial achievement here; you also choose your areas and minor here.',
    },
    related: ['anmeldung', 'teilleistung', 'cms'],
  },

  // Offices, tools, places
  {
    id: 'cms', cat: 'places', term: 'CMS / KIT Campus', aka: 'campus.studium.kit.edu',
    def: {
      tr: 'KIT\'in kampüs yönetim portalı: ders kataloğu, çalışma planın, sınav kayıtları ve notların. Bu sitedeki veriler de oradaki katalogdan geliyor.',
      en: 'KIT’s campus management portal: the course catalog, your study plan, exam registration and grades. This site’s data comes from its catalog.',
    },
    where: { tr: 'Ders detayındaki "KIT sayfası" bağlantısı.', en: 'The “KIT page” link in course details.' },
    related: ['studienablaufplan', 'ilias'],
  },
  {
    id: 'ilias', cat: 'places', term: 'ILIAS', aka: 'E-learning platform',
    def: {
      tr: 'KIT\'in e-öğrenme platformu. Ders materyalleri, duyurular, ödev teslimleri ve çoğu zaman seminer/praktikum kayıt bilgileri buradadır.',
      en: 'KIT’s e-learning platform: course materials, announcements, assignment submission and often seminar/practical registration details.',
    },
    where: { tr: 'Ders detayındaki "ILIAS kursu" bağlantısı.', en: 'The “ILIAS course” link in course details.' },
    count: (data, lang) => {
      const n = Object.values(data.events).filter((e) => e.iliasUrl).length
      return lang === 'tr' ? `Bu dönem ${n} dersin ILIAS bağlantısı var.` : `${n} courses link to ILIAS this term.`
    },
    related: ['cms'],
  },
  {
    id: 'iss', cat: 'places', term: 'ISS', aka: 'Informatik Studiengangservice',
    def: {
      tr: 'Informatik fakültesinin resmî öğrenci danışmanlık ofisi. Sınav kaydı sorunları, alan değişikliği ve resmî sorular için: beratung-informatik@informatik.kit.edu.',
      en: 'The informatics department’s official study advice office. For registration problems, changing areas and official questions: beratung-informatik@informatik.kit.edu.',
    },
    related: ['fachschaft'],
  },
  {
    id: 'fachschaft', cat: 'places', term: 'Fachschaft', aka: 'FSMI, Student representatives',
    def: {
      tr: 'Matematik ve Informatik öğrenci temsilciliği. Gayriresmî ama çok faydalı tavsiyeler verir ve oryantasyon haftasını (O-Phase) düzenler.',
      en: 'The mathematics and informatics student body. It gives informal but very useful advice and runs the orientation week (O-Phase).',
    },
    related: ['iss'],
  },
  {
    id: 'hoc', cat: 'places', term: 'HoC, FORUM, SpZ', aka: 'House of Competence, FORUM, Sprachenzentrum',
    def: {
      tr: 'Disiplinlerarası derslerin geldiği yerler: HoC soft skill dersleri, FORUM bilim ve toplum dersleri, SpZ (Dil Merkezi) dil kursları verir.',
      en: 'Where interdisciplinary courses come from: HoC offers soft-skill courses, FORUM science-and-society courses, SpZ (Language Center) language courses.',
    },
    related: ['iq'],
  },
  {
    id: 'room', cat: 'places', term: 'Raum, Hörsaal, Seminarraum', aka: 'Room, Lecture hall, Seminar room',
    def: {
      tr: 'Oda, amfi ve seminer odası. Yerler "bina numarası + oda" şeklinde yazılır: "50.34 Raum 236", 50.34 numaralı binadaki 236 numaralı oda demek. Büyük amfilerin adı vardır (ör. Hertz-Hörsaal).',
      en: 'Room, lecture hall and seminar room. Locations read “building number + room”: “50.34 Raum 236” is room 236 in building 50.34. Large halls have names (e.g. Hertz-Hörsaal).',
    },
    where: { tr: 'Takvim bloklarında ve haftalık terminlerde.', en: 'In timetable blocks and weekly times.' },
  },
  {
    id: 'ics', cat: 'places', term: '.ics dosyası', aka: 'iCalendar',
    def: {
      tr: 'Takvim dosyası. "Programım"daki ".ics indir" ile programını Google Takvim, Apple Takvim ya da Outlook\'a aktarabilirsin.',
      en: 'A calendar file. “Download .ics” in “My schedule” exports your timetable to Google Calendar, Apple Calendar or Outlook.',
    },
  },
  {
    id: 'skill-score', cat: 'career', term: 'Beceri puanı', aka: 'Skill score',
    def: {
      tr: 'Her modülün 15 beceriden her birine 0–3 arası katkısı ve tek cümlelik gerekçesi. Puanlar modül el kitabının metninden elle hazırlandı (Claude, 22.10.2026); otomatik değil, yön göstericidir.',
      en: 'Each module’s 0–3 contribution to each of 15 skills, with a one-sentence reason. Scores were curated by hand from the module handbook text (Claude, 22 Oct 2026); they are a guide, not automatic.',
    },
    where: { tr: 'Katalog modül kartlarındaki beceri rozetleri ve modül detayındaki "Beceriler".', en: 'Skill badges on catalog module cards and “Skills” in the module detail.' },
    related: ['career-fit'],
  },
  {
    id: 'career-fit', cat: 'career', term: 'Kariyer uyumu', aka: 'Career fit',
    def: {
      tr: 'Yol haritandaki modüllerin beceri puanları ECTS ile ağırlıklanıp toplanır ve bir rolün hedefleriyle karşılaştırılır. "Planla" geçilen + planlanan, "şu an" sadece geçilen modülleri sayar. Yüzde yaklaşık bir ölçüdür.',
      en: 'The skill scores of your roadmap modules, weighted by ECTS and summed, compared with a role’s targets. “Planned” counts passed and planned modules, “now” only passed ones. The percentage is approximate.',
    },
    where: { tr: '"Kariyer" sekmesindeki ısı haritası ve "Yol Haritası"ndaki takip çubukları.', en: 'The grid on the “Career” tab and the followed-path bars on the “Roadmap”.' },
    related: ['employer-lens', 'skill-score'],
  },
  {
    id: 'employer-lens', cat: 'career', term: 'İşveren merceği', aka: 'Employer lens',
    def: {
      tr: 'Aynı rol farklı işverenlerde farklı becerileri öne çıkarır (ör. Big Tech algoritma ve dağıtık sistemler, AI lab araştırma). Mercek rol ağırlıklarını buna göre çarpar; şehirler, mülakat, ders dışı adımlar ve kaynaklı maaş bantlarını da taşır.',
      en: 'The same role stresses different skills at different employers (e.g. Big Tech algorithms and distributed systems, AI labs research). A lens multiplies the role’s weights accordingly and also lists cities, interviews, steps beyond courses and sourced salary bands.',
    },
    where: { tr: '"Kariyer" sekmesinin sütunları ve yol detayı.', en: 'The columns of the “Career” tab and the path detail.' },
    related: ['career-fit'],
  },
]

export const termById = (id: string) => TERMS.find((t) => t.id === id)
