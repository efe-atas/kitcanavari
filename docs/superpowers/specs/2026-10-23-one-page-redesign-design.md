# Tek Sayfa Yeniden Tasarım — Tasarım

Tarih: 2026-10-23 · Durum: Kullanıcı kalan kararları devretti ("daha iyi tasarımla devam et, hepsini yap")

## 1. Sorun

Kullanıcı: "sistem çok karmaşık… roadmap karmaşık duruyor, neyden ne yaptığın belli değil." Analiz (gerçek planla gezilerek):

- Aynı bilgi birden çok yerde: "ne alıyorum" Katalog/Programım/Yol Haritası'nda; "mezuniyete ne kaldı" Programım yan paneli (yalnız bu dönem), Kovalar tablosu ve Yol Haritası alt paneli (tüm dönemler) — iki farklı sayı.
- Alan seçimi ve "nereye sayılır" iki-üç yerde.
- 7 sekme; ders/modül ayrımı arayüze sızıyor; bağlamsız sayılar (%39, 29/90); her şey aynı görsel ağırlıkta; jargon ayrı sayfada.
- Kök neden: her aşama yeni sekme ekledi, sorulara göre hiç yeniden düzenlenmedi.

## 2. Kullanıcı kararları (görsel yardımcıyla)

1. Açılışta **hepsinin özeti** tek ekranda.
2. Ana yapı **şart × dönem tablosu** (satır = kredinin sayıldığı yer, sütun = dönem).
3. **Tek ana sayfa + yandan açılan paneller** (A); **emoji yok**, sitenin ince çizgi ikonları.
4. Telefonda tablo **dönem dönem alt alta** kartlar.

## 3. Tasarım

### 3.1 Sayfa (tek rota `#/`)

Yukarıdan aşağı:

1. **Üst bar** (sade): marka · *Hedef* düğmesi (takip edilen ilk yol: "ML Engineer · Big Tech · %39", yoksa "Hedef seç") · Değişiklikler düğmesi (bekleyen uyarı sayısıyla) · senkron durumu · tema · dil. Sekme yok.
2. **Durum şeridi**: tek satır, üç sayı ve bir yorum:
   - "**29** / 120 ECTS" (geçilen + planlanan; yanında küçük "6 geçildi")
   - "Stammmodul **2** / 4", "Seminer **0** / 3", "Praktikum **0** / 6" — bunlar kova değil, kovaları kesen şartlar; tablonun satırına sığmadıkları için burada.
   - Eksik olan sayı turuncu, tamam olan sessiz ve onay işaretli. Tamamlananlar soluk (vurgu = eksik).
3. **Sıradaki adımlar**: en fazla 3 cümle, her biri bir eylem düğmesi. Örnek: "Seminer yok — en az 3 ECTS gerekli · **Seminer ekle**". Hepsi tamamsa: "Tüm şartlar planında karşılanıyor."
4. **Tablo** (aşağıda).
5. Altbilgi: veri tarihi, SPO.

### 3.2 Tablo

- **Sütunlar**: `Önceden` (geçilmiş/tanınmış) · yol haritası dönemleri (WS 26/27 = *şimdi*, vurgulu zemin) · listede olmayan dönemlerdeki girdiler için ek sütunlar · son sütunda "+ Dönem" düğmesi (başlıkta).
- **Satırlar** (kredinin sayıldığı yer, `defaultBucket` ile aynı kural):
  1. 1. uzmanlık alanı (başlık bir seçim kutusu; boşsa "Alan seç")
  2. 2. uzmanlık alanı
  3. Seçmeli
  4. Yan dal (yalnız içinde ders varsa ya da kullanıcı açtıysa; boşsa gizli, "+ yan dal" bağlantısı)
  5. Disiplinlerarası (IQ)
  6. Atanmamış (yalnız sayılacak yeri olmayan/bilinmeyen modül varsa)
- **Satır sonu**: o satırın planlı toplamı / alt sınırı ("6 / 15"); alanlarda altında "normal ders 6 / 10". Eksikse turuncu, tamamsa onay + sessiz.
- **Sütun altı**: dönem ECTS'i (planlı); >36 ise turuncu "yoğun" ipucu.
- **Ders kutucuğu** (pill): kısa başlık (2 satır, sonra kesme), ECTS, şart işaretleri küçük harf etiketi olarak: `Stamm`, `Sem`, `Prak`. Durum:
  - planlandı: açık zemin, normal metin
  - geçti: dolu zemin + onay + not (varsa "1,7")
  - kaldı / bıraktım: üstü çizili, soluk
  - açılış uyarısı (o dönemde açılmaz/düzensiz/bu dönem yok): turuncu nokta + başlıkta açıklama (`title` değil, görünür kısa metin: detayda).
  Kutucuğa tıklamak → **Ders detayı** paneli.
- **Boş hücre**: hover/odakta (dokunmatikte her zaman) "+" düğmesi → **Ders ekle** paneli, o satır ve dönem önseçili. Hücrede ders varsa "+" küçük ve hücrenin altında.
- **Tez**: ayrı satır yerine tablonun altında tek satır not: "Yüksek lisans tezi: 30 ECTS (genelde son dönem)".
- Klavye: tablo hücreleri sırayla odaklanabilir düğmeler; `<table>` + `scope` başlıklar.

### 3.3 Yan panel (tek bileşen, rota ile)

Masaüstünde sağda ~440 px, modal değil (tablo arkada kullanılabilir); telefonda alttan açılan tam yükseklik sayfa, odak içinde tutulur, kapanınca odak tetikleyiciye döner. Esc ve geri tuşu kapatır. Rotalar:

| Rota | Panel |
|---|---|
| `#/add/<dönem>/<satır>` | Ders ekle |
| `#/course/<modülId>` | Ders detayı |
| `#/week` | Bu dönemin haftalık takvimi |
| `#/goal` · `#/goal/<rol>:<mercek>` | Hedef (kariyer) |
| `#/changes` | Değişiklikler |
| `#/info/<terim>` | Terim açıklaması (eski Sözlük/Rehber) |
| `#/sync` | Senkron ayarları |

Eski rotalar (`#/catalog`, `#/schedule`, `#/roadmap`, `#/career`, `#/glossary/x`, `#/guide`) karşılığına yönlendirilir.

**Ders ekle**
- Başlık: "SS 27 · Seçmeli için ders ekle". Arama kutusu (ad, kod, hoca/koordinatör).
- Liste sırası: (1) bu satıra sayılabilen **ve** bu dönemde uyarısı olmayanlar; (2) hedef varsa hedefe katkısı yüksek olan önce; (3) başlık. Uymayanlar en altta "Başka yerlere sayılır / bu dönem açılmaz" başlığıyla, soluk.
- Filtre çipleri (az): Tür (Ders/Seminer/Praktikum/Stamm), "Sadece bu dönemde açılanlar" (varsayılan açık).
- Her satır: başlık, ECTS, tür etiketi, açılış uyarısı, hedef katkısı (3 noktalı ölçek), şimdiki dönemse haftalık saat özeti ve çakışma işareti. Sağda "Ekle".
- **Ekle** → modül o döneme `planned` olarak girer; satır önseçiliyse ve varsayılan yer değilse `countAs` o satır olur. **Şimdiki dönemse modülün bu dönemki tüm dersleri haftalık programa da eklenir** (ders/modül ayrımı kullanıcıya görünmez).
- "Tüm dersleri ara" bağlantısı filtreleri gevşetir (eski Katalog'un yerini alır).

**Ders detayı**
- Başlık, kod, ECTS, tür, hangi dönemde açıldığı.
- Kontroller (tek blok, etiketli): Durum (segment: Planlandı · Geçti · Kaldı · Bıraktım), Not (Geçti ise), Dönem (seçim), Nereye sayılır (seçim), Kişisel not.
- Şimdiki dönemdeyse: haftalık saatler (seri bazında aç/kapat), oda, ILIAS/KIT bağlantıları, oturum iptalleri.
- "Kariyere katkısı": güçlü beceriler + en uygun roller (gerekçeler açılır bölümde).
- "Modül el kitabı": hedefler, içerik, önkoşul (açılır bölüm, kapalı başlar).
- Alt: "Planından çıkar" (onaysız; geri al için 5 sn'lik bildirim).

**Bu hafta** (`#/week`): mevcut haftalık takvim (WeekGrid), çakışma uyarıları, zamanı belli olmayan dersler, `.ics` indir, yedek dışa/içe aktar. Tetikleyici: şimdiki dönem sütun başlığındaki "Haftalık takvim" bağlantısı.

**Hedef** (`#/goal`): mevcut ısı haritası + yol detayı (açıklar, önerilen dersler "Ekle" → ilgili dönem/satır), takip et. Üstte bir cümle: "Planın her role ne kadar uyuyor; puanlar el kitabından elle hazırlandı."

**Değişiklikler**, **Terim açıklaması**, **Senkron**: mevcut içerikler panel içinde.

### 3.4 Sıradaki adımlar (kurallar, öncelik sırasıyla)

`roadmapReport(...).all` ve durumdan:

1. Alan seçilmemiş → "İki uzmanlık alanını seç" (ilk satır başlığına odak).
2. Her alan: toplam < 15 → "<Alan>: <n> ECTS daha" · Ekle(ilk kalan dönem, o alan); normal ders < alt sınır → "<Alan>: normal derste <n> ECTS daha" · Ekle(tür=ders).
3. Stammmodul < 4 → "<n> Stammmodul daha" · Ekle(tür=Stamm, satır=seçmeli).
4. Seminer < 3 → "Seminer yok" · Ekle(tür=seminer). Praktikum < 6 → benzer.
5. Seçmeli < 6 → "Seçmeliye <n> ECTS".
6. Taşma uyarıları (`issues`) → uyarı olarak (eylem: ilgili detay).
En fazla 3 gösterilir; fazlası "+ <n> şart daha" ile açılır.

### 3.5 Görsel dil

- Mevcut token'lar korunur (`--accent`, `--surface*`, `--line*`, `--warn`, `--danger`, koyu tema).
- Hiyerarşi: tek vurgu rengi (accent) yalnız birincil eylemlere ve "şimdi" sütununa; turuncu (`--warn`) yalnız eksik/uyarıya; tamamlanan şeyler sessiz. Satır kovaları renkle değil konumla ayrılır (renk yalnız durum anlatır) — renk körlüğüne dayanıklı.
- Tipografi: sayfa başlığı yok (tablo kendini anlatır; durum şeridindeki büyük sayı ilk okunan). Sayılar `tabular-nums`.
- Emoji yok; `Icon` setine eksikler eklenir (plus, close, alert, check, calendar, compass, bell, cloud, info).
- Jargon yanında ⓘ yerine sitenin `?` bağlantısı → `#/info/<terim>` paneli.

### 3.6 Telefon (≤ 640 px)

- Durum şeridi iki satıra kırılır; sıradaki adımlar aynı.
- Tablo yerine **dönem kartları** alt alta: kart başlığı dönem + ECTS; içinde satır adlarıyla dersler; her satırda "+". Toplamlar durum şeridinde ve kart altında.
- Panel alttan tam ekran sayfa.

### 3.7 Kaldırılanlar

Katalog, Programım, Yol Haritası, Kariyer, Değişiklikler, Rehber, Sözlük sekmeleri ve sayfaları; Kovalar tablosu; ikinci mezuniyet paneli; ECTS paneli. İçerikleri yukarıdaki panellere taşınır. Mantık katmanı (`logic/*`, `sync/*`, `store.ts`) değişmez; yalnız `addModuleToTerm` eklenir.

## 4. Test

- Mantık: `nextSteps` kuralları; `matrixCells` (girdi → satır/dönem); `addModuleToTerm` (şimdiki dönemde dersleri programa ekler, `countAs`).
- UI: tablo hücreleri ve toplamlar; "+" → Ders ekle önseçili, sıralama, Ekle; kutucuk → Ders detayı ve kontroller; Bu hafta paneli; Hedef paneli; eski rotaların yönlendirmesi; telefon kartları (jsdom'da sınıf/yapı); senkron ve değişiklikler panelleri.
- Görsel (Better Design): `get-review-rules`, `check-comprehension` (Türkçe ve İngilizce), `inspect-spacing` 390/1440/1728; ayrı origin `[::1]:5199` üzerinde.
