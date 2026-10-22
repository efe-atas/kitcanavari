# Handbook → Tüm Modüller Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modül el kitabı PDF'indeki 210 modülü `data/handbook.json`'a çıkarmak ve katalogda "Tüm modüller" modunda göstermek.

**Architecture:** Yeni `kit_scraper.parse_handbook` modülü `pdftotext -layout` çıktısını satır tabanlı ayrıştırır; elle çalıştırılır, günlük scrape'e girmez. Web tarafı `handbook.json`'ı isteğe bağlı yükler (yoksa site bugünkü gibi çalışır), katalog modülleriyle id üzerinden birleştirir ve katalog sekmesine "Bu dönem / Tüm modüller" anahtarı ekler.

**Tech Stack:** Python 3.12 + pytest (scraper), poppler `pdftotext`; Vite + TypeScript + Preact + vitest (web).

**Spec:** `docs/superpowers/specs/2026-10-22-personal-roadmap-career-design.md` (§2.1 `handbook.json`, §5 Katalog satırı, §7 aşama 1)

## Global Constraints

- Kaynak PDF `kit_docs/module_handbook.pdf` commit edilmez; `.gitignore`'a `kit_docs/` eklenir. `data/handbook.json` commit edilir.
- Parser günlük `scrape.yml`'e eklenmez; yalnız elle çalıştırılır.
- `recurrence` değerleri: `winter` ("Each winter term"), `summer` ("Each summer term"), `each` ("Each term"), diğer her şey `irregular`.
- Handbook modülünde alan listesi `fields` adını taşır (courses.json `Module.fields` ile aynı biçim: `"Area of Specialization: …"`, `"Elective Studies in Informatics"`).
- JSON yazımı `run._write` ile aynı: `ensure_ascii=False, indent=1, sort_keys=True` + sondaki `\n`.
- Kullanıcıya görünen her metin `web/src/i18n.ts` içinde hem `tr` hem `en` anahtarıyla.
- `handbook.json` yüklenemezse (404, bozuk JSON) site hata vermez; "Tüm modüller" anahtarı gizlenir.

## Review Focus

- Sayfa kırılımı bir bölümün ortasına denk gelir (RL "Recommendations") → altbilgi/üstbilgi satırları metne karışmamalı. *(Task 1 testi `test_page_break_removed`)*
- Başlık ve `[M-…]` id'si iki satıra bölünür (`[M-` / `INFO-106303]`) → id birleşik, başlık tek boşlukla. *(Task 1 `test_wrapped_title_and_id`)*
- Katalogda olup handbook'ta olmayan modül (ör. minor modülleri) → Tüm modüller listesinde yine görünmeli, "handbook'ta yok" diye kaybolmamalı. *(Task 3 `moduleRows` testi)*
- `handbook.json` eksik → katalog çalışır, anahtar görünmez. *(Task 4 testi)*
- "Bu dönem açık" modülde etkinliğe gitme: modül kartından bu dönemin etkinliğine geçilebilmeli (programa ekleme etkinlik üzerinden kalır). *(Task 4 testi)*

---

### Task 1: Handbook ayrıştırıcısı

**Files:**
- Create: `scraper/kit_scraper/parse_handbook.py`
- Create: `scraper/tests/fixtures/handbook_excerpt.txt`
- Create: `scraper/tests/test_parse_handbook.py`
- Modify: `.gitignore` (+ `kit_docs/`)

**Interfaces:**
- Produces:
  - `parse_handbook_text(text: str) -> dict` → `{"meta": {"source": str, "asOf": "YYYY-MM-DD"}, "modules": {id: HandbookModule}}`
  - HandbookModule dict anahtarları: `id, title, ects (float|None), recurrence, language (str|None), level (int|None), fields (list[str]), coordinators (list[str]), bricks (list[{id,title,ects,term}]), competenceGoals, content, prerequisites, recommendations` (metinler `str|None`)
  - `pdf_to_text(pdf: Path) -> str` (`subprocess.run(["pdftotext", "-layout", str(pdf), "-"], check=True, capture_output=True, text=True).stdout`)
  - `main(argv: list[str] | None = None, now: str | None = None) -> int` — argümanlar: `pdf` (konum), `--out` (dosya yolu). `meta.parsedAt = now or UTC ISO`.

- [ ] **Step 1: Fixture'ı oluştur**

`pdftotext -layout kit_docs/module_handbook.pdf -` çıktısından olduğu gibi (satırları değiştirmeden) şu parçaları sırayla `handbook_excerpt.txt`'e kopyala:
1. Bir "Module Handbook as of 09/09/2026" satırı içeren herhangi bir sayfa altbilgisi (3 satır: `Computer Science Master 2025 (Master of Science (M.Sc.))`, sayfa no, `Module Handbook as of 09/09/2026`).
2. `4.1 Module: Access Control Systems…` başlığından `4.2 Module:` başlığından önceki satıra kadar.
3. `4.128 Module: Reinforcement Learning` başlığından `4.130 Module:` başlığından önceki satıra kadar (4.128 + 4.129 Reliable Computing I; arada sayfa kırılımı ve `4 MODULES … Module: …` üstbilgisi var).
4. `5.1 Module component: Practical Course: Decentralized Learning Lab [T-` satırı ve ardından gelen 10 satır.

- [ ] **Step 2: Failing testleri yaz** (`test_parse_handbook.py`, `fixture("handbook_excerpt.txt")`)

```python
def test_modules_stop_at_components():
    assert list(parse()["modules"]) == ["M-INFO-106303", "M-INFO-105623", "M-INFO-100850"]

def test_as_of():
    assert parse()["meta"]["asOf"] == "2026-09-09"

def test_wrapped_title_and_id():
    m = parse()["modules"]["M-INFO-106303"]
    assert m["title"] == "Access Control Systems: Models and Technology"
    assert (m["ects"], m["recurrence"], m["language"], m["level"]) == (5.0, "summer", "English", 4)
    assert m["fields"] == ["Area of Specialization: Cryptography and Security",
                           "Area of Specialization: Telematics", "Elective Studies in Informatics"]
    assert m["coordinators"] == ["Prof. Dr. Hannes Hartenstein"]

def test_rl_bricks_and_sections():
    m = parse()["modules"]["M-INFO-105623"]
    assert m["recurrence"] == "winter" and m["ects"] == 6.0
    assert m["coordinators"] == ["TT-Prof. Dr. Rudolf Lioutikov", "Prof. Dr. Gerhard Neumann"]
    assert m["bricks"] == [{"id": "T-INFO-111255", "title": "Reinforcement Learning", "ects": 6.0, "term": "WT"}]
    assert m["competenceGoals"].startswith("- Students are able to understand the RL problem")
    assert "Meta Reinforcement Learning" in m["content"]
    assert m["prerequisites"] is None          # "See partial achievements (Teilleistung)" → None

def test_page_break_removed():
    rec = parse()["modules"]["M-INFO-105623"]["recommendations"]
    assert "Good Python knowledge" in rec
    assert "Computer Science Master 2025" not in rec and "4 MODULES" not in rec and "188" not in rec

def test_irregular():
    m = parse()["modules"]["M-INFO-100850"]
    assert (m["title"], m["recurrence"], m["ects"]) == ("Reliable Computing I", "irregular", 3.0)

def test_main_writes_json(tmp_path, monkeypatch):
    monkeypatch.setattr(parse_handbook, "pdf_to_text", lambda p: fixture("handbook_excerpt.txt"))
    out = tmp_path / "handbook.json"
    assert parse_handbook.main(["x.pdf", "--out", str(out)], now="2026-10-22T00:00:00Z") == 0
    data = json.loads(out.read_text())
    assert data["meta"]["parsedAt"] == "2026-10-22T00:00:00Z" and len(data["modules"]) == 3

@pytest.mark.skipif(not PDF.exists() or not shutil.which("pdftotext"), reason="handbook PDF not present")
def test_full_handbook_smoke():
    mods = parse_handbook_text(pdf_to_text(PDF))["modules"]
    assert len(mods) == 210
    assert Counter(m["recurrence"] for m in mods.values())["winter"] == 66
    assert Counter(m["recurrence"] for m in mods.values())["summer"] == 54
    assert Counter(m["recurrence"] for m in mods.values())["each"] == 39
    assert all(re.fullmatch(r"M-[A-Z]+-\d+", k) and m["title"] and m["ects"] for k, m in mods.items())
```
(`parse = lambda: parse_handbook_text(fixture("handbook_excerpt.txt"))`, `PDF = Path(__file__).parents[2] / "kit_docs/module_handbook.pdf"`)

- [ ] **Step 3: Testleri çalıştır, fail ettiğini gör**

Run: `cd scraper && .venv/bin/pytest tests/test_parse_handbook.py -v`
Expected: FAIL — `ModuleNotFoundError: kit_scraper.parse_handbook`

- [ ] **Step 4: `parse_handbook.py`'yi yaz**

Satır tabanlı algoritma:
1. Gürültü satırlarını at: `Computer Science Master 2025 (Master of Science (M.Sc.))`, yalnız rakamdan oluşan satır, `Module Handbook as of …` (önce buradan `asOf` = `DD/MM/YYYY` → ISO), `^4 MODULES\b`, `^5 MODULE COMPONENTS\b`, yalnız `M` içeren satır.
2. Modül başlığı: `^\s+4\.\d+ Module: `. Bölüm `^\s+5\.\d+ Module component:` görülünce biter. Başlık satırı `]` içerene kadar sonraki boş olmayan satırlar eklenir; `[...]` içindeki boşluklar silinip id olur, kalan kısım tek boşlukla başlık.
3. `Coordinators:` / `Part of:` değerleri: etiket sütunundan sonraki metin; sonraki etikete (`Organisation:`) veya boş satıra kadar devam satırları ayrı öğe.
4. `Credits … Grading … Recurrence` başlığından sonraki ilk dolu satır: `^\s*(\d+(?:,\d+)?) CP\s+(graded|pass/fail)\s+(.+?)\s{2,}(\d+ terms?)\s+(.+?)\s{2,}(\d+)\s+\d+\s*$` → ects, recurrence ham metni (normalize et), language, level.
5. Brick satırı: `^\s+(T-[A-Z]+-\d+)\s+(.+?)\s{2,}(\S+(?: \S+)?)\s+(\d+(?:,\d+)?) CP\b`; `Assessment` başlığına kadar.
6. Metin bölümleri: girintili satırı tam olarak `Assessment | Prerequisites | Competence Goal | Content | Workload | Recommendations | Annotation | Literature` olan başlıklar; gövde bir sonraki başlığa / sonraki modüle kadar, satırlar `strip` edilip boş satırlar paragraf ayırıcı (`\n\n`), paragraf içi satırlar tek boşlukla birleşir — ancak `-`, `•`, `◦` veya `\d+\.` ile başlayan satırlar yeni satıra (`\n`) geçer. Gövde tam olarak `See partial achievements (Teilleistung)` ise `None`.
7. `source = "88-979-H-2025 Module Handbook"`.

- [ ] **Step 5: Testlerin geçtiğini doğrula**

Run: `cd scraper && .venv/bin/pytest -v`
Expected: tümü PASS (smoke testi PDF yereldeyse çalışır ve geçer).

- [ ] **Step 6: Commit**

```bash
git add .gitignore scraper/kit_scraper/parse_handbook.py scraper/tests/test_parse_handbook.py scraper/tests/fixtures/handbook_excerpt.txt
git commit -m "feat(scraper): parse the module handbook PDF"
```

### Task 2: `data/handbook.json` üret ve README'yi güncelle

**Files:**
- Create: `data/handbook.json`
- Modify: `README.md` ("Run locally" altına bir satır), `ops/README.md` değil

**Interfaces:**
- Consumes: `main()` (Task 1)

- [ ] **Step 1: Üret**

Run: `cd scraper && .venv/bin/python -m kit_scraper.parse_handbook ../kit_docs/module_handbook.pdf --out ../data/handbook.json`
Expected: çıkış kodu 0; `python3 -c "import json;print(len(json.load(open('../data/handbook.json'))['modules']))"` → `210`

- [ ] **Step 2: Spot kontrol** — `M-INFO-105623` girdisini oku; başlık, CP, recurrence, alanlar handbook sayfasıyla aynı mı; metin alanlarında `Module Handbook as of` geçmiyor mu (`grep -c "Module Handbook as of" ../data/handbook.json` → `0`).

- [ ] **Step 3: README** — "Run locally" bölümüne: `.venv/bin/python -m kit_scraper.parse_handbook ../kit_docs/module_handbook.pdf --out ../data/handbook.json   # yeni el kitabı geldiğinde, elle (poppler gerekir)`

- [ ] **Step 4: Commit**

```bash
git add data/handbook.json README.md
git commit -m "chore(data): add module handbook 2026-09-09"
```

### Task 3: Web veri katmanı — tip, yükleme, birleştirme, filtre

**Files:**
- Modify: `web/src/types.ts` (+ `HandbookModule`, `HandbookFile`, `Recurrence`)
- Modify: `web/src/data.ts` (handbook isteğe bağlı)
- Modify: `web/src/logic/degree.ts` (`moduleAreas`, `moduleKind`, `bucketOptions` parametre tipleri gevşer)
- Create: `web/src/logic/handbook.ts`
- Create: `web/tests/handbook.test.ts`
- Modify: `web/tests/appdata.ts` (+ `makeHandbook()`)

**Interfaces:**
- Produces:
  - `type Recurrence = 'winter' | 'summer' | 'each' | 'irregular'`
  - `interface HandbookModule { id; title; ects: number|null; recurrence: Recurrence; language: string|null; level: number|null; fields: string[]; coordinators: string[]; bricks: {id; title; ects: number|null; term: string}[]; competenceGoals; content; prerequisites; recommendations: string|null }`
  - `interface HandbookFile { meta: { source: string; asOf: string; parsedAt: string }; modules: Record<string, HandbookModule> }`
  - `loadData()` dönüşüne `handbook: HandbookFile | null` eklenir (hata → `null`, `status.json` ile aynı desen).
  - `moduleAreas(m: Pick<Module, 'fields'>)`, `moduleKind(data, m: Pick<Module, 'id' | 'title'>)`, `bucketOptions(m: Pick<Module, 'fields'>)` — davranış aynı.
  - `interface ModuleRow { id: string; title: string; ects: number|null; recurrence: Recurrence; fields: string[]; hb: HandbookModule | null; current: Module | null; eventIds: string[] }`
  - `moduleRows(courses: CoursesFile, handbook: HandbookFile): ModuleRow[]` — handbook modülleri ∪ courses.json modülleri (id'ye göre); `eventIds` = bu dönem bu modüle bağlı etkinlikler; yalnız katalogda olanın `recurrence`'ı `Module.recurrence` metninden aynı kurallarla türetilir; başlığa göre sıralı.
  - `interface ModuleFilters { query: string; areas: string[]; kinds: Kind[]; ects: number[]; recurrence: Recurrence[]; offeredNow: boolean }`, `emptyModuleFilters()`
  - `filterModules(courses: CoursesFile, rows: ModuleRow[], f: ModuleFilters): ModuleRow[]` — `query` başlık, id ve koordinatörlerde (küçük harf) arar.

- [ ] **Step 1: Failing testler** (`handbook.test.ts`, `makeCourses()` + `makeHandbook()`)

`makeHandbook()`: `M3` ("Module M3", katalogda da var, `recurrence: 'winter'`), `H1` ("Reinforcement Learning", 6, `winter`, HCMI alanı, koordinatör "Neumann"), `H2` ("Seminar: Post-Quantum Cryptography", 3, `summer`, Crypto alanı).

```ts
test('merges handbook and catalog modules by id', () => {
  const rows = moduleRows(makeCourses(), makeHandbook())
  expect(rows.map((r) => r.id).sort()).toEqual(['H1', 'H2', 'M1', 'M2', 'M3'])
  const m3 = rows.find((r) => r.id === 'M3')!
  expect(m3.hb).not.toBeNull(); expect(m3.current).not.toBeNull(); expect(m3.eventIds.sort()).toEqual(['ml', 'sec'])
  expect(rows.find((r) => r.id === 'M1')!.hb).toBeNull()        // catalog-only stays visible
  expect(rows.find((r) => r.id === 'H1')!.eventIds).toEqual([])
})
test('filters by recurrence, offered now, kind and query', () => {
  const c = makeCourses(), rows = moduleRows(c, makeHandbook())
  const f = emptyModuleFilters()
  expect(filterModules(c, rows, { ...f, recurrence: ['summer'] }).map((r) => r.id)).toEqual(['H2'])
  expect(filterModules(c, rows, { ...f, offeredNow: true }).map((r) => r.id).sort()).toEqual(['M1', 'M2', 'M3'])
  expect(filterModules(c, rows, { ...f, kinds: ['seminar'] }).map((r) => r.id)).toEqual(['H2'])
  expect(filterModules(c, rows, { ...f, query: 'neumann' }).map((r) => r.id)).toEqual(['H1'])
  expect(filterModules(c, rows, { ...f, areas: ['Cryptography and Security'] }).map((r) => r.id).sort()).toEqual(['H2', 'M3'])
})
```
Ayrıca `data.ts` için: `fetch` `handbook.json`'da 404 döndürünce `loadData()` reddetmez ve `handbook === null`.

- [ ] **Step 2: Çalıştır, fail ettiğini gör** — Run: `cd web && npx vitest run tests/handbook.test.ts` → FAIL (modül yok)

- [ ] **Step 3: Tipleri, `data.ts`'i, `degree.ts` imzalarını ve `logic/handbook.ts`'i uygula**

- [ ] **Step 4: Tüm testler + tip kontrolü** — Run: `cd web && npx vitest run && npx tsc -b` → PASS, hata yok

- [ ] **Step 5: Commit**

```bash
git add web/src/types.ts web/src/data.ts web/src/logic/degree.ts web/src/logic/handbook.ts web/tests/handbook.test.ts web/tests/appdata.ts
git commit -m "feat(web): load the module handbook and merge it with catalog modules"
```

### Task 4: Katalogda "Tüm modüller" modu

**Files:**
- Modify: `web/src/ui/App.tsx` (`handbook`'u `CatalogView`'a geçir)
- Modify: `web/src/ui/catalog/CatalogView.tsx` (mod anahtarı, modül listesi)
- Create: `web/src/ui/catalog/ModuleCard.tsx`, `web/src/ui/catalog/ModuleDetail.tsx`, `web/src/ui/catalog/ModuleFilters.tsx`
- Modify: `web/src/i18n.ts`, `web/src/styles.css`
- Test: `web/tests/catalog.test.tsx`

**Interfaces:**
- Consumes: `moduleRows`, `filterModules`, `emptyModuleFilters`, `ModuleRow` (Task 3); mevcut `moduleKind`, `bucketOptions`, `Chips` deseni, `TermLink`.
- Produces: `CatalogView` prop'u `handbook: HandbookFile | null`.

Davranış:
- Başlıkta iki düğmeli anahtar: `catalog.mode.term` "Bu dönem" / "This term", `catalog.mode.all` "Tüm modüller" / "All modules". `handbook === null` iken anahtar render edilmez. Seçim `#/catalog/all` alt rotası ile tutulur (mevcut `route.sub`), böylece yenilemede kalır.
- Tüm modüller modunda sol ağaç ve dock gizlenir; sonuç sayısı `catalog.moduleCount` "{n} modül" / "{n} modules".
- `ModuleCard`: başlık, id, CP, tür etiketi (lecture dışı), recurrence etiketi (`rec.winter` / `rec.summer` / `rec.irregular`; `each` → yeni `rec.each` "Her dönem" / "Every term"), kullanıcının alanlarındaki alanlar `tag-area`, bu dönem etkinliği varsa `module.offeredNow` "Bu dönem açık" / "Offered this term".
- `ModuleDetail` (EventDetail ile aynı panel yapısı): alanlar (`bucketOptions`), koordinatörler, bricks, `competenceGoals`, `content`, `prerequisites`, `recommendations` (handbook yoksa `current.description` alanları), handbook bulunmuyorsa `module.notInHandbook` notu, ve bu dönemin etkinlikleri için düğmeler: tıklayınca "Bu dönem" moduna geçip o etkinliğin detayını açar.
- `ModuleFilters`: arama (`filter.searchModules` "Modül adı, kodu veya koordinatör ara…"), tür, ECTS, recurrence (`filter.recurrence` "Açılış" / "Offered"), alan select'i, `filter.offeredNow` onay kutusu.

- [ ] **Step 1: Failing UI testleri** (`catalog.test.tsx`; `loadData` mock'u `handbook: makeHandbook()` döndürür)

```tsx
test('switches to all modules and filters by recurrence', async () => {
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: 'All modules' }))
  await screen.findByText('Reinforcement Learning')
  expect(screen.getByText('5 modules')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Summer term only' }))
  await waitFor(() => expect(screen.queryByText('Reinforcement Learning')).toBeNull())
  expect(screen.getByText('Seminar: Post-Quantum Cryptography')).toBeTruthy()
})
test('module detail links to this term\'s event', async () => {
  location.hash = '#/catalog/all'
  render(<App />)
  fireEvent.click(await screen.findByText('Module M3'))
  fireEvent.click(screen.getByRole('button', { name: 'IT Security' }))
  await screen.findByRole('button', { name: 'Add to schedule' })   // event detail open in term mode
  expect(location.hash).toBe('#/catalog')
})
test('hides the mode switch without a handbook', async () => {
  loadData.mockResolvedValue({ courses: makeCourses(), changes: makeChanges(), handbook: null })
  render(<App />)
  await screen.findByText('IT Security')
  expect(screen.queryByRole('button', { name: 'All modules' })).toBeNull()
})
```

- [ ] **Step 2: Çalıştır, fail ettiğini gör** — Run: `cd web && npx vitest run tests/catalog.test.tsx` → 3 yeni test FAIL

- [ ] **Step 3: Bileşenleri ve i18n anahtarlarını uygula** (yeni anahtarlar `tr` ve `en`'de; `tests/i18n.test.ts` iki dilin anahtar kümelerinin eşitliğini zaten denetliyorsa onu da geçmeli)

- [ ] **Step 4: Tüm testler, tip kontrolü, build** — Run: `cd web && npx vitest run && npm run build` → PASS

- [ ] **Step 5: Tarayıcıda dene** — `npm run dev`, `#/catalog/all`: 210+ modül listelenir, recurrence/alan filtreleri çalışır, telefon genişliğinde (375 px) yatay kaydırma yok, koyu tema okunur.

- [ ] **Step 6: Commit**

```bash
git add web/src web/tests
git commit -m "feat(web): browse all handbook modules in the catalog"
```
