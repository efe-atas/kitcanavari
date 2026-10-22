# Tek Sayfa Yeniden Tasarım Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 7 sekmeli arayüzü tek bir şart × dönem tablosu + yan paneller olarak yeniden kurmak.

**Architecture:** Mantık katmanı (`logic/*`, `sync/*`, `store.ts`) korunur. Yeni saf modüller: `logic/matrix.ts` (girdileri satır×döneme dağıtır, toplamlar), `logic/nextSteps.ts` (eksik şartlardan sıralı eylemler), `store.addModuleToTerm`. UI: `ui/App.tsx` yeniden (üst bar + ana sayfa + `Drawer`), `ui/plan/*` (StatusStrip, NextSteps, PlanMatrix, TermCards), `ui/panels/*` (AddCourse, CourseDetail, WeekPanel, GoalPanel, ChangesPanel, InfoPanel, SyncPanel). Eski sekme görünümleri silinir; yeniden kullanılabilir alt bileşenler (WeekGrid, FitGrid/PathDetail, ChangesView gövdesi, Glossary terimleri, SyncDialog formu) panellere taşınır.

**Tech Stack:** Preact + TS + vitest; Better Design MCP (ui/ux prensipleri yüklendi; inceleme Task 7).

**Spec:** `docs/superpowers/specs/2026-10-23-one-page-redesign-design.md`

## Global Constraints
- Emoji yok; ikonlar `ui/Icon.tsx`.
- Mevcut CSS token'ları; tek vurgu rengi accent, eksik/uyarı `--warn`.
- Masaüstü panel modal değil (aria-modal yok, `role="complementary"` + başlık); telefon (≤640px) alttan tam sayfa, odak içinde.
- Esc ve tarayıcı geri tuşu paneli kapatır (rota `#/`).
- Eski rotalar yönlendirilir: `#/catalog*`→`#/add/<CURRENT>/elective`, `#/schedule`→`#/week`, `#/roadmap`→`#/`, `#/career[/x]`→`#/goal[/x]`, `#/changes`→`#/changes`, `#/glossary[/x]`,`#/guide`→`#/info[/x]`.
- Metinler tr+en; senkronlu kullanıcının verisi (localStorage/profil) aynı şekilde okunur.

## Review Focus
- Şimdiki döneme ders eklemek haftalık programa da ekler; çıkarmak ikisinden de çıkarır.
- Hiç alanı/dersi olmayan kullanıcı: tablo boş hücrelerle ve "İki uzmanlık alanını seç" adımıyla anlamlı.
- Handbook/kariyer verisi yok → tablo çalışır, Ders ekle yalnız katalog modülleriyle, Hedef düğmesi gizli.
- Klavye: tüm hücreler/kutucuklar/paneller sekmeyle gezilebilir, Esc kapatır, odak geri döner.
- 390 px: yatay taşma yok, panel tam ekran.

---

### Task 1: Saf mantık — matrix, nextSteps, addModuleToTerm
- Create `web/src/logic/matrix.ts`: `rowsFor(state): RowId[]` (`area:<ad>`|`area-slot:<0|1>` boşsa, `elective`, `minor` (yalnız doluysa), `iq`, `unassigned` (yalnız doluysa)); `matrixCells(state, courses, handbook): { columns: string[]; cells: Record<RowId, Record<term, CellItem[]>>; rowTotals; colTotals }`. `CellItem { id, title, ects|null, status, grade, kind, issue: OfferingIssue|null, inSchedule }`.
- Create `web/src/logic/nextSteps.ts`: `nextSteps(state, courses, handbook): Step[]`, `Step { key, params, action: { term, row, kind? } | { focus: 'areas' } | null, severity: 'todo'|'warn' }`, spec §3.4 sırası.
- `store.ts`: `addModuleToTerm(s, courses, id, term, row?: RowId)` — `placeModule`; `term===CURRENT_TERM` ise modülün bu dönemki her etkinliği `addEvent` (zaten seçili olan atlanır); `row` bir alan/elective/minor/iq ise ve `defaultBucket` farklıysa `setEntryCountAs`.
- Testler: `web/tests/matrix.test.ts`, `web/tests/next-steps.test.ts`, `web/tests/roadmap-state.test.ts` (+addModuleToTerm).
- Commit: `feat(web): matrix, next steps and add-to-term logic`

### Task 2: Kabuk — rota, üst bar, Drawer, durum şeridi, sıradaki adımlar
- `ui/route.ts`: `parseRoute(hash): { panel: Panel | null }` + eski rota yönlendirmesi; `href(panel)`.
- `ui/Drawer.tsx`: başlık, kapat düğmesi, Esc, odak yönetimi (açılınca başlığa; kapanınca tetikleyiciye), telefonda modal davranış.
- `ui/App.tsx` yeniden: üst bar (Hedef düğmesi, Değişiklikler düğmesi + sayaç, SyncStatus, tema, dil), `PlanPage`, `Drawer` içinde panel.
- `ui/plan/StatusStrip.tsx`, `ui/plan/NextSteps.tsx`.
- Testler: `web/tests/shell.test.tsx` (yönlendirmeler, Esc kapatır, geri kapatır, sayaç).
- Commit: `feat(web): one-page shell with drawer panels`

### Task 3: Tablo ve telefon kartları
- `ui/plan/PlanMatrix.tsx` (masaüstü `<table>`), `ui/plan/TermCards.tsx` (≤640px, CSS ile değişim — ikisi de DOM'da, biri gizli değil: `matchMedia` ile tek render), `ui/plan/CoursePill.tsx`.
- Alan satırı başlıkları seçim kutusu (setArea).
- Testler: `web/tests/plan-ui.test.tsx` (hücre içerikleri, toplamlar, "+" rotası, kutucuk rotası, alan değişimi).
- Commit: `feat(web): requirement × term plan table`

### Task 4: Ders ekle paneli
- `ui/panels/AddCourse.tsx`: arama, Tür çipleri, "Sadece bu dönem açılanlar", gruplu sıralama, Ekle (`addModuleToTerm`), şimdiki dönemde saat özeti + çakışma.
- Testler: sıralama (uyanlar önce), Ekle → tablo + haftalık program, filtreler.
- Commit: `feat(web): add-course panel`

### Task 5: Ders detayı paneli
- `ui/panels/CourseDetail.tsx`: durum segmenti, not, dönem, nereye sayılır, kişisel not, haftalık saatler (toggleSlot), bağlantılar, kariyer katkısı, el kitabı, Planından çıkar.
- Testler: kontroller store'u günceller; çıkar.
- Commit: `feat(web): course detail panel`

### Task 6: Diğer paneller ve temizlik
- `WeekPanel` (WeekGrid + çakışma + unscheduled + .ics + yedek), `GoalPanel` (FitGrid + PathDetail; öneri Ekle → addModuleToTerm), `ChangesPanel`, `InfoPanel` (Glossary terimi + Rehber metni), `SyncPanel` (SyncDialog formu).
- `TermLink` → `#/info/<id>`.
- Eski görünümleri sil (catalog/*, schedule/ScheduleView, DegreePanel, EctsPanel, PlanBoard, BucketBoard, roadmap/*, career/CareerView, glossary/GlossaryView sayfa kısmı, guide/GuideView sayfası) ve kullanılmayan i18n anahtarlarını temizle; UI testlerini yeni yapıya taşı.
- Commit: `feat(web): week, goal, changes, info and sync panels; remove old tabs`

### Task 7: Better Design incelemesi
- `get-review-rules`, `check-comprehension` (ana sayfa, Ders ekle, Ders detayı; tr ve en), `inspect-spacing` 390/1440/1728 `[::1]:5199` üzerinde; kritik/ciddi bulguları düzelt; önce/sonra ekran görüntüleri.
- Commit: `fix(web): design review fixes`
