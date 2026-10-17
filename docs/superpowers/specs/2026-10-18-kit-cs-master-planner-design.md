# KIT CS Master Ders Planlayıcı — Tasarım

Tarih: 2026-10-18 · Durum: Onay bekliyor

## 1. Amaç

KIT Computer Science Master (SPO **88-979-H-2025**) öğrencisi için, KIT ders kataloğunu (campus.studium.kit.edu) daha rahat gezilebilir hale getiren, haftalık ders programı kurmayı kolaylaştıran ve katalog dönem içinde güncellendiğinde (saat, oda, iptal, yeni/kaldırılan ders) buna otomatik uyum sağlayan, linkle paylaşılabilir bir web sitesi.

**Kullanıcılar:** Proje sahibi (WS 26/27'de başlayan CS Master öğrencisi) ve linki paylaştığı arkadaşları.

**Başarı kriterleri**
- SPO 2025'e bağlı tüm WS 26/27 Informatik dersleri, içerik + termin + modül/ECTS bilgileriyle sitede görünür.
- Kullanıcı birkaç dakika içinde çakışmasız bir haftalık program kurabilir ve toplam ECTS'yi görür.
- Katalogdaki bir değişiklik en geç ~24 saat içinde siteye yansır; programdaki derslerde değişiklik olduysa kullanıcı siteyi açtığında uyarı görür.
- İşletme maliyeti 0 €, bakım gerektirmez.

**Kapsam dışı (YAGNI):** kullanıcı hesabı / sunucu tarafı saklama, KIT'e giriş yapma veya ders kaydı, push/e-posta bildirimleri, SPO 2025 dışındaki SPO'lar, geçmiş dönemler.

## 2. Veri kaynağı (keşif bulguları)

- `campus.studium.kit.edu/.../catalog.php#!campus/all/<sayfa>` dış çerçevesi, içeriği `cascampus.studium.kit.edu/campus/all/<sayfa>` iframe'inden yükler. cascampus'a doğrudan istek dış çerçeveye yönlendirilir; düz HTTP istekleri bir JavaScript bot kontrolüne ("Verifying your browser…") takılır. **Bu nedenle gerçek tarayıcı (Playwright Chromium) kullanılır ve sayfalar deeplink üzerinden açılıp iframe içeriği okunur.**
- Dönem parametresi: `tguid=0xD25DBD9C86874091993315DA11571AAF` = WS 26/27.
- **Alan sayfası** `field.asp?gguid=…`: alt alan listesi + ders tablosu (sayfalama var; "Items per page" 200'e çekilir). Kök: `0x01291EE9E14C46BD916AC325D0EE8CE2` ("1. Informatik Lehrveranstaltungen"); üst düğüm "KIT Department of Informatics" `0x94CCACA48C644F43B4A6B70586D36CA5` altındaki kardeş dallar (2. Law, 3. Mathematics, 4. Working Groups, 5. Institute Seminars, 6. Colloquia, 7. Miscellaneous) da gezilir.
- **Ders sayfası** `event.asp?gguid=…`: ders no, başlık, dil, SWS (WTH), tür, format, dönem, içerik metni, ILIAS linki, termin tablosu (gün/ritim, saat, oda, başlangıç, adet), hocalar, "Degree Programs and Bricks" (SPO başına `abstractModuleView.asp` ve `abstractBrickView.asp` linkleri), katalog başlıkları.
- **Oturum listesi**: alan/ders sayfalarındaki "Appointment List" görünümü (`view=app`) tekil tarihleri verir; iptaller buradan okunur.
- **Modül sayfası** `abstractModuleView.asp?…`: tanımlayıcı (M-INFO-…), başlık, credit points, recurrence, dil, seviye, assignment type, compulsory-elective part, bricks (T-INFO-…, CP), bu dönemki dersler, alanlar (ör. "Elective Studies in Informatics"); "Module description" sekmesi: öğrenme hedefleri, içerik, ön koşullar, sınav şekli, iş yükü.
- **ECTS derse değil modüle aittir**; bir ders birden fazla modüle bağlı olabilir.

## 3. Mimari

```
GitHub Actions — scrape.yml (cron: her gün 04:00 UTC, + manuel tetikleme)
  └─ scraper (Python 3.12 + Playwright + BeautifulSoup)
       1. Informatik ağacını özyinelemeli gezer → ders linkleri
       2. Her ders: detay + oturum listesi; SPO 88-979-H-2025'e bağlı olmayanları eler
       3. Bulunan her modül: detay + açıklama sekmesi (bir kez)
       4. data/courses.json yazar; önceki sürümle diff → data/changes.json
       5. Değişiklik varsa commit + push → deploy.yml tetiklenir
GitHub Actions — deploy.yml (push to main) → web/ build → GitHub Pages
Statik site (Vite + TypeScript + Preact)
  data/*.json'u fetch eder; kullanıcı durumu localStorage'da
```

Kibarlık kuralları: istekler sıralı, aralarında ~1 sn bekleme, günde bir çalıştırma, tanımlayıcı User-Agent.

**Yedek plan:** Bot kontrolü GitHub Actions IP'lerini engellerse aynı scraper kullanıcının Mac'inde `launchd` ile günde bir çalışır ve `data/` değişikliklerini push eder. Sitenin geri kalanı değişmez.

## 4. Veri modeli

### `data/courses.json`
```ts
{
  meta: { scrapedAt: string /*ISO*/, term: "WS 26/27", termGuid: string,
          spo: "88-979-H-2025", warnings: string[] },
  tree: FieldNode[],                  // { id, title, children: FieldNode[], eventIds: string[] }
  events: Record<string, Event>,      // anahtar: event gguid
  modules: Record<string, Module>     // anahtar: "M-INFO-101567"
}

Event {
  id: string, number: string, title: string,
  type: string,            // "Practical course (P)"
  typeCode: string,        // "V" | "Ü" | "P" | "S" | ... (parantez içinden)
  language: string, sws: number | null, format: string | null,
  contentText: string,     // düz metin, paragraflar \n\n ile
  iliasUrl: string | null, kitUrl: string,
  catalogPaths: string[][],             // ["1. Informatik Lehrveranstaltungen", "1.7 Practical Courses"]
  lecturers: { name: string, unit: string }[],
  slots: { day: "Mon"|"Tue"|"Wed"|"Thu"|"Fri"|"Sat"|"Sun" | null,
           start: "HH:MM" | null, end: "HH:MM" | null,
           room: string | null, rhythm: string,          // "weekly" | "biweekly" | "block" | "single" | ham metin
           firstDate: "YYYY-MM-DD" | null, count: number | null }[],
  sessions: { date: "YYYY-MM-DD", start: "HH:MM", end: "HH:MM",
              room: string | null, cancelled: boolean }[],
  moduleIds: string[]      // yalnızca SPO 2025 bağlantıları
}

Module {
  id: string, title: string, ects: number | null,
  recurrence: string | null, language: string | null, level: string | null,
  assignment: string | null, part: string | null, fields: string[],
  bricks: { id: string, title: string, ects: number | null }[],
  description: { objectives: string | null, content: string | null,
                 prerequisites: string | null, exam: string | null,
                 workload: string | null },
  kitUrl: string
}
```

### `data/changes.json`
```ts
{ entries: Change[] }   // yeni → eski sıralı, son 90 gün
Change {
  at: string /*scrapedAt*/, eventId: string, eventTitle: string,
  kind: "added" | "removed" | "slot_changed" | "room_changed" |
        "session_cancelled" | "session_added" | "session_removed" |
        "content_changed" | "lecturers_changed" | "modules_changed",
  summary: string,         // insan okunur, İngilizce (UI çevirmez; değerler ham)
  before?: unknown, after?: unknown
}
```

Her `Event` için kararlı bir `fingerprint` (slots + sessions + room + lecturers + moduleIds üzerinden hash) üretilir ve `courses.json` içinde `Event.fingerprint` olarak saklanır; site tarafı uyarıları bunu kullanır.

## 5. Scraper bileşenleri (`scraper/kit_scraper/`)

| Modül | Sorumluluk | Arayüz |
|---|---|---|
| `fetch.py` | Playwright oturumu, deeplink açma, iframe HTML'ini döndürme, yeniden deneme (3x), bekleme | `Fetcher.get(path: str) -> str` |
| `parse_field.py` | Alan sayfası → alt alanlar + ders linkleri (+ sayfalama linkleri) | `parse_field(html) -> FieldPage` |
| `parse_event.py` | Ders sayfası → `Event` (SPO 2025 modül linkleri dahil) | `parse_event(html, spo) -> Event` |
| `parse_sessions.py` | Oturum listesi → `sessions[]` | `parse_sessions(html) -> list[Session]` |
| `parse_module.py` | Modül sayfası + açıklama → `Module` | `parse_module(html, desc_html) -> Module` |
| `diff.py` | Eski/yeni `courses.json` → `Change[]` | `diff(old, new, at) -> list[Change]` |
| `run.py` | Orkestrasyon, güvenlik eşikleri, dosya yazımı | CLI: `python -m kit_scraper.run --out data/` |

Parser'lar saf fonksiyonlardır (HTML string → dataclass), ağ erişimi yoktur; fixture'larla test edilir.

## 6. Arayüz

Tek sayfa, üç sekme: **Katalog · Programım · Değişiklikler**. Responsive (mobilde ağaç çekmeceye dönüşür). Arayüz dili **TR/EN** değiştirilebilir (varsayılan tarayıcı diline göre; seçim localStorage'da). KIT içerikleri olduğu gibi (EN/DE) gösterilir.

**Katalog**
- Sol: alan ağacı (ders sayılarıyla). Orta: ders kartları.
- Arama: başlık, ders no, hoca. Filtreler: tür, dil, gün, saat aralığı, ECTS, modül alanı, "programımla çakışmayanlar".
- Kart: başlık, tür rozeti, dil, SWS, ECTS (bağlı modüllerden; birden fazlaysa aralık "4–6"), haftalık slotlar, "programda" durumu, çakışma ise ⚠.
- Detay paneli: içerik, slotlar, oturumlar (iptaller üstü çizili), hocalar, bağlı modüller (ECTS, part/alan, sınav, ön koşullar, hedefler — katlanabilir), ILIAS + KIT orijinal sayfa linkleri, "Programa ekle" düğmesi.

**Programım**
- Pzt–Cum (hafta sonu slotu varsa Cmt/Paz da) 08:00–20:00 ızgara.
- Ders eklenince tüm slotları gelir; slotlar tek tek açılıp kapatılabilir (ör. Übung grubu seçimi).
- Çakışma: aynı günde zaman aralıkları kesişen etkin slotlar (ve rhythm'i "weekly"/"biweekly" olanlar) kırmızı çerçeve + üstte metinsel liste. Blok/tek seferlik dersler oturum tarihleri üzerinden kontrol edilir.
- ECTS sayacı: her ders için sayılacak modül seçilir (varsayılan: ilk modül); aynı modül birden fazla derse atanmışsa bir kez sayılır ve uyarı gösterilir. Toplam + `part`/`fields` bazında dağılım.
- "Zamanı belirsiz / blok" listesi: haftalık slotu olmayan dersler.
- `.ics` dışa aktarma: etkin slotlardan, iptal edilen oturumlar hariç tekil etkinlikler.
- Programı JSON olarak dışa/içe aktarma.

**Değişiklikler**
- Üstte: programdaki dersler için "son onaydan beri değişenler" (kayıtlı fingerprint ≠ güncel fingerprint olan dersler + ilgili `changes.json` kayıtları). "Gördüm" ile fingerprint'ler güncellenir.
- Altta: tüm katalog için son 90 gün değişiklik akışı (filtrelenebilir: sadece programım / tümü).
- Sekme başlığında okunmamış değişiklik sayısı rozeti.

**Kullanıcı durumu (localStorage, anahtar `kitcanavari:v1`)**
```ts
{ selected: { [eventId]: { enabledSlots: number[], moduleId: string | null,
                            ackFingerprint: string } },
  lang: "tr" | "en", lastSeenScrapedAt: string }
```

## 7. Hata durumları

- Sayfa çekilemezse 3 deneme; başarısız ders için önceki sürüm korunur ve `meta.warnings`'e yazılır.
- **Güvenlik eşikleri** (aşılırsa commit yok, workflow fail → GitHub e-postası): başarısız ders oranı > %10, ya da ders sayısı önceki çekime göre > %30 düşüş, ya da parser zorunlu alanları (başlık, ders no) boş döndürürse.
- localStorage'daki ama katalogda olmayan ders: programdan silinmez; gri + "katalogdan kaldırıldı" gösterilir.
- Veri yaşı: sayfa altında "Veri: <tarih>"; 3 günden eskiyse sarı uyarı.
- localStorage erişilemezse (gizli mod vb.) site çalışmaya devam eder, program oturum boyunca bellekte tutulur ve bir uyarı gösterilir.

## 8. Test

- **Scraper (pytest):** keşif sırasında kaydedilen gerçek KIT HTML'leri (`tests/fixtures/`: alan, ders, oturum listesi, modül, modül açıklaması) üzerinde parser testleri; `diff.py` için sentetik eski/yeni veriyle her `kind` türü; güvenlik eşikleri için `run.py` testleri.
- **Site (Vitest):** çakışma tespiti, ECTS hesabı (çift sayım yok), fingerprint tabanlı uyarı mantığı, `.ics` üretimi, localStorage göçü/bozuk veri toleransı.
- **Uçtan uca doğrulama:** ilk gerçek çekim yerelde elle çalıştırılıp çıktı (ders sayısı, örnek dersler) KIT sitesiyle karşılaştırılır; ardından Actions'ta ilk çalıştırma izlenir.

## 9. Repo yapısı

```
kitcanavari/
  scraper/  pyproject.toml, kit_scraper/, tests/ (fixtures/*.html)
  web/      package.json, vite.config.ts, src/ (catalog/, schedule/, changes/, store/, i18n/), tests/
  data/     courses.json, changes.json        (bot commit'ler)
  .github/workflows/  scrape.yml, deploy.yml
  docs/superpowers/specs/
```

## 10. Kurulum gereksinimleri (kullanıcıdan)

- GitHub reposu oluşturma (public — GitHub Pages ücretsiz planda public repo ister) ve push yetkisi. Yerelde `gh` CLI kurulu değil; kurulum ya da elle repo oluşturma plan aşamasında ele alınır.
- Repo ayarlarında Pages kaynağı: "GitHub Actions"; Actions'a `contents: write` izni.
