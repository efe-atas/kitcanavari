# Kişisel Yol Haritası ve Kariyer Planlayıcı — Tasarım

Tarih: 2026-10-22 · Durum: Onay bekliyor

## 1. Amaç

kitcanavari'yi tek kişilik (proje sahibi) bir danışmana çevirmek: mezuniyete kadar çok dönemli ders planı, kalıcı ve
cihazlar arası senkron bir profil, ve her modülün hangi kariyer yoluna (rol × işveren tipi) ne kadar yaradığını
gösteren bir kariyer görünümü.

**Kullanıcı:** yalnızca proje sahibi (CS Master, SPO 88-979-H-2025, ilk dönem WS 26/27). Kariyer hedefi henüz net
değil; site yolları **karşılaştırmaya ve keşfetmeye** yardım eder.

**Başarı kriterleri**
- Her dönem başında siteyi açıp "şu ana kadar nerede duruyorum, hedeflerime göre önümüzdeki dönemlerde ne almalıyım"
  sorusuna tek ekranda cevap alınır.
- Handbook'taki 210 modülün tamamı (yalnızca bu dönem açılanlar değil) gelecek dönemlere yerleştirilebilir; açılmadığı
  döneme konan modül uyarı verir.
- Laptop ve telefonda aynı profil görünür; her değişiklik geri alınabilir (git geçmişi).
- Her modül için "hangi rol/mercek için ne kadar faydalı ve neden" gerekçesiyle görülebilir.
- İşletme maliyeti 0 €; API anahtarı yok.

**Kapsam dışı (YAGNI):** başka kullanıcılar / plan paylaşımı, sunucu, Claude API ile otomatik puanlama, sınav
tarihleri, takvim hatırlatıcıları, hedef/OKR takibi, başka SPO'lar.

**Kalıcı kural:** Modül → beceri küratörlüğü ve maaş araştırması Claude tarafından Claude Code oturumunda **bir kez**
yapılır; yalnızca proje sahibi açıkça istediğinde yenilenir. Hiçbir otomasyon (Actions, API) puanlama yapmaz.

## 2. Veri

### 2.1 Public veri (mevcut repo, `data/`)

| Dosya | Üreten | Sıklık |
|---|---|---|
| `courses.json`, `changes.json`, `status.json` | mevcut scraper | her gün (değişmez) |
| `handbook.json` | `kit_scraper.parse_handbook` (yeni) | elle, yeni handbook geldiğinde |
| `career/skills.json` | Claude (elle küratörlük) | istek üzerine |
| `career/roles.json`, `career/lenses.json` | Claude (elle küratörlük) | istek üzerine |

Kaynak PDF `kit_docs/module_handbook.pdf` yereldir, commit edilmez (`.gitignore`'a `kit_docs/` eklenir); türetilen
`handbook.json` commit edilir.

**`handbook.json`**
```jsonc
{
  "meta": { "source": "88-979-H-2025 Module Handbook", "asOf": "2026-09-09", "parsedAt": "…" },
  "modules": {
    "M-INFO-105623": {
      "id": "M-INFO-105623",
      "title": "Reinforcement Learning",
      "ects": 6,
      "recurrence": "winter",          // winter | summer | each | irregular
      "language": "English",
      "level": 4,
      "parts": ["Area of Specialization: Human-centred Machine Intelligence", "Elective Studies in Informatics"],
      "coordinators": ["TT-Prof. Dr. Rudolf Lioutikov", "Prof. Dr. Gerhard Neumann"],
      "bricks": [{ "id": "T-INFO-111255", "title": "Reinforcement Learning", "ects": 6, "term": "WT" }],
      "competenceGoals": "…", "content": "…", "prerequisites": "…", "recommendations": "…"
    }
  }
}
```
Ayrıştırma: `pdftotext -layout` çıktısında `4.N Module: <başlık> [M-…]` başlıkları, sayfa üst/alt bilgileri
(`Computer Science Master 2025 …`, `Module Handbook as of …`, `4 MODULES … Module: …`) atılarak bloklara bölünür; tablo
satırı `Credits Grading Recurrence …` altındaki satırdan CP ve recurrence okunur. "Each winter term" → `winter`,
"Each summer term" → `summer`, "Each term" → `each`, diğerleri → `irregular`.
Katalog modülleri (`courses.json`) ile birleştirme modül id'si üzerinden yapılır; bu dönem etkinliği olan modül "şimdi
açık" sayılır.

**`career/skills.json`** — modül başına beceri puanı (0–3) ve tek cümlelik gerekçe:
```jsonc
{
  "meta": { "curatedAt": "2026-10-22", "handbookAsOf": "2026-09-09" },
  "skills": ["algo", "distsys", "sysperf", "mltheory", "dl", "nlp", "cv", "robotics", "security", "crypto",
             "embedded", "swe", "data", "formal", "research"],
  "modules": {
    "M-INFO-105623": { "algo": [1, "…"], "mltheory": [3, "…"], "dl": [3, "…"], "robotics": [2, "…"] }
  }
}
```
Yazılmayan beceri = 0. Beceri anahtarları sabittir; görünen adlar i18n'dedir.

**`career/roles.json`** — ~10 rol: ML/AI Engineer, Research Scientist, Data Scientist, Backend/Distributed Systems,
Quant Developer, Security Engineer, Robotics/Autonomous, Embedded/Hardware AI, Software Architect, Akademi/PhD.
```jsonc
{ "id": "ml-eng", "weights": { "dl": 0.3, "mltheory": 0.2, "swe": 0.15, … },   // toplam 1
  "targets": { "dl": 12, "mltheory": 9, … },  // tam kapsama için gereken beceri puanı
  "summary": { "tr": "…", "en": "…" } }
```

**`career/lenses.json`** — 6 mercek: Big Tech/FAANG, Quant/Trading, AI Lab/Scale-up, Alman sanayisi/Mittelstand,
Startup, Akademi.
```jsonc
{ "id": "bigtech", "multipliers": { "algo": 1.5, "distsys": 1.4, … },   // yazılmayan = 1
  "cities": ["Zürich", "München", "London", "Dublin"],
  "salary": [{ "role": "ml-eng", "band": "…", "source": "…", "asOf": "2026-10" }],
  "interview": { "tr": "…" }, "offCourse": { "tr": ["…"] }, "downsides": { "tr": ["…"] } }
```
Maaş bantları küratörlük sırasında web araştırmasıyla bulunur, her biri kaynak + tarih taşır ve arayüzde "yaklaşık"
olarak gösterilir. Kaynağı bulunamayan bant yazılmaz.

### 2.2 Özel veri: profil (ayrı private repo)

Private repo `efe-atas/kitcanavari-me`, tek dosya `profile.json`. Pages üzerinden **servis edilmez**; site GitHub
REST API (`GET/PUT /repos/{owner}/{repo}/contents/profile.json`) ile okur/yazar.
```jsonc
{
  "version": 1,
  "areas": ["Human-centred Machine Intelligence", "Algorithm Engineering"],
  "terms": ["WS26", "SS27", "WS27", "SS28"],          // sona dönem eklenebilir
  "modules": {
    "M-INFO-105623": { "term": "WS26", "status": "planned", "countAs": null, "grade": null }
    // status: planned | passed | failed | dropped; term: dönem id | "prior" (önceden geçilmiş/tanınmış)
  },
  "weekly": { "<eventId>": { "enabledSlots": [0], "moduleId": "M-…", "ackFingerprint": "…", "title": "…" } },
  "lastSeenScrapedAt": "…",
  "followed": [{ "role": "ml-eng", "lens": "bigtech" }],   // en fazla 3
  "notes": { "M-INFO-105623": "serbest metin" }
}
```
- `weekly` = bugünkü `UserState.selected` (yalnız mevcut dönem, etkinlik bazlı). `countAs` artık modül düzeyindedir
  (`profile.modules[*].countAs`); etkinlik eklemek ilgili modülü mevcut dönemde `planned` olarak `modules`'a ekler.
- Cihaza özel olanlar (`lang`, `theme`, token, profil cache'i) localStorage'da kalır.

## 3. Senkronizasyon

- **Kurulum (cihaz başına bir kez):** fine-grained PAT, yalnız `kitcanavari-me` reposu, *Contents: read & write*.
  Ayarlar ekranına yapıştırılır, localStorage'da saklanır; "çıkış" token'ı ve cache'i siler.
- **Açılış:** API'den `profile.json` + `sha` çekilir, localStorage'a cache'lenir. Ağ yoksa cache ile "çevrimdışı" modda
  çalışılır (düzenleme serbest); bekleyen değişiklikler bağlantı gelince gönderilir.
- **Kaydetme:** son değişiklikten 3 sn sonra `PUT` (commit mesajı: `profile: <kısa özet>`), bilinen `sha` ile.
- **Çakışma (409/422 sha uyuşmazlığı):** güncel dosya çekilir, yereldeki bekleyen işlemler (operasyon listesi olarak
  tutulur: modül taşı/ekle/sil, not yaz…) onun üstüne yeniden uygulanır, tekrar gönderilir. 3 denemede olmazsa
  kullanıcıya uyarı + "yerel sürümü zorla yaz / sunucudakini al" seçimi.
- **Hatalar:** 401/403 → "token geçersiz/süresi dolmuş"; 404 → "repo veya dosya yok, oluştur?" (ilk kurulumda dosya
  site tarafından oluşturulur). Başarısız yazma cache'i bozmaz, üst barda kalıcı gösterge çıkar.
- **Token yokken:** site bugünkü gibi çalışır (katalog + localStorage `kitcanavari:v1`). İlk girişte mevcut
  localStorage planı profile taşınır (`selected` → `weekly` + `modules`, `areas` korunur); eski anahtar yedek olarak
  bırakılır.

## 4. Hesaplar (`web/src/logic/`)

- **Dönem uygunluğu** (`offering.ts`): `WS*` dönemine `winter|each`, `SS*` dönemine `summer|each` uygundur;
  `irregular` → "belirsiz" uyarısı; mevcut dönemde (`WS26`) katalogda etkinliği olmayan modül → "bu dönem açılmıyor"
  uyarısı. Engel değil, uyarıdır.
- **Tüm derece** (`degree.ts` genişler): mevcut kurallar artık `passed` + `planned` (+ `prior`) modüllerin tamamı
  üzerinden hesaplanır; satırlar "geçildi" ve "planlandı" diye iki renkle gösterilir. Toplam 120 CP (tez 30 dahil).
  Mevcut dönem-içi gösterim (bu dönemin katkısı) haftalık plan sekmesinde kalır.
- **Not ortalaması**: `passed` ve notu olan modüllerin CP ağırlıklı ortalaması (1.0–4.0).
- **Kariyer uyumu** (`career.ts`):
  - Beceri puanı: `P_s = Σ_m score(m,s) × ects(m) / 6`, `m` ∈ passed ∪ planned ∪ prior. Yalnız passed ile ayrıca
    "şu anki" değer hesaplanır.
  - Rol × mercek: `w'_s = weight(r,s) × mult(l,s)`, normalize edilir. Uyum = `Σ w'_s × min(1, P_s / target(r,s))`,
    yüzde olarak.
  - Açıklar: `w'_s` büyük ve `P_s/target` küçük olan ilk 3 beceri; her biri için gelecek dönemlere uygun ve henüz
    planda olmayan, o beceride en yüksek puanlı 3 modül önerilir.

## 5. Arayüz

| Sekme | Değişiklik |
|---|---|
| Katalog | "Bu dönem / Tüm modüller (handbook)" anahtarı. Handbook modu modül kartları gösterir (CP, recurrence, alanlar). Her kartta beceri rozetleri ve en uygun 3 rol; detayda beceri gerekçeleri ve "dönem X'e ekle". Not alanı. |
| Plan (haftalık) | Aynı; ders eklemek modülü `WS26`'ya `planned` ekler. |
| **Yol Haritası** (yeni) | Sütunlar: Önceden geçilmiş, WS26, SS27, WS27, SS28 (+ dönem ekle). Modül kartı: CP, durum, not, uygunluk uyarısı; taşı/durum değiştir/not gir. Alt panel: tüm derece kuralları, toplam CP, ortalama, takip edilen yolların uyum çubukları. |
| **Kariyer** (yeni) | Rol × mercek ısı haritası (uyum %). Hücre detayı: beceri profili (sahip olunan / hedef), açıklar + önerilen modüller, mercek bilgisi (şehirler, maaş bandı + kaynak + tarih, mülakat, ders dışı adımlar, dezavantajlar). "Takip et" (≤3). |
| Ayarlar (üst bar) | Token girişi, senkron durumu (kaydedildi / bekliyor / hata), çıkış. |
| Rehber / Sözlük | Beceri ve mercek açıklamaları; puanların küratörlükle üretildiği ve yaklaşık olduğu notu. |

Puanlanmamış modüller: `skills.json`'da olmayan handbook modülleri "puanlanmadı" rozetiyle gösterilir ve Kariyer
sekmesinde sayıları belirtilir ("12 modül puanlanmadı — güncellemek için Claude'a söyle").

## 6. Test

- Python: `parse_handbook` için birkaç modül bloğundan kesilmiş fixture'lar (normal, irregular, çok alanlı, sayfa
  kırılımlı); tam PDF üzerinde modül sayısı smoke testi (PDF yoksa skip).
- TS birim: `offering`, tüm derece hesabı, not ortalaması, `career` uyum/açık/öneri, profil göçü (v1 localStorage →
  profil), senkron (sahte `fetch`: başarı, 409 sonrası yeniden uygulama, 401, 404 → oluşturma, çevrimdışı kuyruk).
- Veri doğrulama testi: `skills.json` / `roles.json` / `lenses.json` anahtarları sabit beceri listesine uyar, rol
  ağırlıkları toplamı 1, her maaş bandında kaynak + tarih var.

## 7. Aşamalar

Tek spec, dört aşama; her biri kendi başına kullanılabilir ve ayrı uygulama planı alır.

1. **Handbook → tüm modüller:** `parse_handbook`, `data/handbook.json`, katalogda "Tüm modüller" modu.
2. **Profil ve senkron:** private repo, token akışı, `profile.json` okuma/yazma, localStorage göçü.
3. **Yol haritası:** çok dönemli plan, uygunluk uyarıları, tüm derece hesabı, notlar ve ortalama.
4. **Kariyer:** Claude küratörlüğü (`career/*.json`, maaş araştırması dahil), uyum hesabı, Kariyer sekmesi,
   katalog rozetleri.
