# KIT CS Master Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A shareable static site that shows KIT WS 26/27 Informatik courses linked to SPO 88-979-H-2025, lets each visitor build a conflict-checked weekly schedule with an ECTS counter, and alerts them when selected courses change — fed by a daily scraper.

**Architecture:** A Python + Playwright scraper (`scraper/`) crawls the KIT catalog through its iframe deeplinks, writes `data/courses.json` and `data/changes.json`, and is run daily by GitHub Actions, which commits changed data. A Vite + TypeScript + Preact app (`web/`) loads those JSON files and keeps per-user state in localStorage; a second workflow builds it and deploys to GitHub Pages.

**Tech Stack:** Python 3.12, Playwright (Chromium), BeautifulSoup4, pytest · Node 20+, Vite, TypeScript, Preact, Vitest, @testing-library/preact · GitHub Actions, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-18-kit-cs-master-planner-design.md`

## Global Constraints

- Target term: WS 26/27, `tguid=0xD25DBD9C86874091993315DA11571AAF`; SPO filter string: `88-979-H-2025`.
- Pages are opened only via `https://campus.studium.kit.edu/english/events/catalog.php#!campus/all/<page>` and read from the frame whose URL contains `cascampus`; never request cascampus directly.
- Crawl roots: field `0x01291EE9E14C46BD916AC325D0EE8CE2` ("1. Informatik Lehrveranstaltungen") plus its siblings under `0x94CCACA48C644F43B4A6B70586D36CA5` (2.–7.).
- Politeness: sequential requests, ≥1 s pause between page loads, 3 retries per page, User-Agent suffix `kitcanavari-scraper (+<repo url>)`.
- JSON shape and field names exactly as spec §4 (camelCase); write with `ensure_ascii=False`, `indent=1`, keys sorted, so diffs stay small.
- `changes.json` keeps entries from the last 90 days only.
- Safety thresholds (no write, exit code 2): failed events > 10 %, or event count drops > 30 % vs previous `courses.json`, or any event missing `number`/`title`.
- localStorage key `kitcanavari:v1`; all access wrapped in try/catch.
- UI languages `tr` and `en`; default `tr` if `navigator.language` starts with `tr`, else `en`. KIT content is shown untranslated.
- Stale-data warning when `meta.scrapedAt` is older than 3 days.
- Schedule grid Mon–Fri 08:00–20:00 (add Sat/Sun columns only if a selected event has a weekend slot).
- Timezone for `.ics`: `Europe/Berlin`.

## Review Focus

1. Events with no regular weekly time (block seminars, "by arrangement", empty appointment table) — must parse with `day: null`, land in the "unscheduled / block" list, never crash conflict checks. Tests: Task 3 `test_event_without_slots`, Task 7 `conflicts ignores slots with null day`.
2. The same event listed under several catalog fields — must appear once, with all `catalogPaths`. Test: Task 6 `test_event_in_two_fields_is_deduplicated`.
3. Fields with more events than one page (1.7 has 40, page shows 25) — every event must be collected. Tests: Task 2 `test_total_count`, Task 6 `test_short_field_listing_adds_warning`.
4. Corrupt, foreign or old-version localStorage content — app starts with empty state, never a blank page. Test: Task 8 `loadState returns default on corrupt json`.
5. A selected event that disappears from the catalog — stays visible greyed out, excluded from ECTS, reported as an alert. Tests: Task 7 `computeEcts skips missing events`, Task 8 `alerts include removed events`.

---

## File Structure

```
scraper/
  pyproject.toml                 package kit_scraper, deps, pytest config
  kit_scraper/
    models.py                    dataclasses for spec §4 + to_json_dict()
    fetch.py                     Fetcher: Playwright session, deeplink → iframe HTML
    parse_field.py               field page → FieldPage
    parse_event.py               event page → ParsedEvent (Event + module links)
    parse_sessions.py            appointment list → list[Session]
    parse_module.py              module + description pages → Module
    fingerprint.py               stable hash of an Event
    diff.py                      old/new courses dict → list[Change]
    run.py                       crawl orchestration, thresholds, file writes (CLI)
    capture.py                   dev tool: save live pages as fixtures
  tests/fixtures/*.html          real KIT pages
  tests/test_*.py
web/
  package.json, vite.config.ts, tsconfig.json, index.html
  public/data -> ../../data      symlink for dev server
  src/
    types.ts                     TS mirror of spec §4 + UserState
    data.ts                      loadData()
    store.ts                     loadState/saveState + useAppState hook
    i18n.ts                      dictionaries + t()
    logic/time.ts                minutes(), weekday helpers
    logic/conflicts.ts           findConflicts()
    logic/ects.ts                computeEcts()
    logic/alerts.ts              pendingAlerts()
    logic/ics.ts                 buildIcs()
    logic/filter.ts              filterEvents()
    ui/App.tsx                   tabs, header, footer (data age)
    ui/catalog/*.tsx             Tree, Filters, EventCard, EventDetail
    ui/schedule/*.tsx            WeekGrid, EctsPanel, UnscheduledList
    ui/changes/ChangesView.tsx
    styles.css
  tests/*.test.ts(x)
data/courses.json, data/changes.json
.github/workflows/scrape.yml, deploy.yml
ops/launchd/com.kitcanavari.scrape.plist, ops/README.md   (fallback)
```

---

### Task 1: Scraper scaffold, models, fetcher, fixture capture

**Files:**
- Create: `scraper/pyproject.toml`, `scraper/kit_scraper/__init__.py`, `scraper/kit_scraper/models.py`, `scraper/kit_scraper/fetch.py`, `scraper/kit_scraper/capture.py`
- Create: `scraper/tests/test_models.py`
- Add fixtures: `scraper/tests/fixtures/event_sessions.html`, `module_description.html`, `event_lecture.html`, `event_block.html`

**Interfaces:**
- Produces (`models.py`, all `@dataclass`):
  - `Lecturer(name: str, unit: str)`
  - `Slot(day: str | None, start: str | None, end: str | None, room: str | None, rhythm: str, first_date: str | None, count: int | None)`
  - `Session(date: str, start: str, end: str, room: str | None, cancelled: bool)`
  - `Event(id, number, title, type, type_code, language, sws: float | None, format, content_text, ilias_url, kit_url, catalog_paths: list[list[str]], lecturers: list[Lecturer], slots: list[Slot], sessions: list[Session], module_ids: list[str], fingerprint: str = "")`
  - `ModuleDescription(objectives, content, prerequisites, exam, workload)` all `str | None`
  - `Brick(id: str, title: str, ects: float | None)`
  - `Module(id, title, ects: float | None, recurrence, language, level, assignment, part, fields: list[str], bricks: list[Brick], description: ModuleDescription, kit_url: str)`
  - `FieldNode(id: str, title: str, children: list["FieldNode"], event_ids: list[str])`
  - `Change(at, event_id, event_title, kind, summary, before=None, after=None)`
  - every class has `to_json_dict() -> dict` emitting spec §4 camelCase keys (snake→camel; `first_date`→`firstDate`, `type_code`→`typeCode`, `content_text`→`contentText`, etc.); `Change` omits `before`/`after` when `None`. Also `Event.from_json_dict(d) -> Event` and `Module.from_json_dict(d)` (needed by diff/run to read the previous file).
  - `KIT_BASE = "https://campus.studium.kit.edu/english/events/catalog.php#!campus/all/"`, `TERM_GUID`, `SPO = "88-979-H-2025"` constants in `models.py`.
- Produces (`fetch.py`): `class Fetcher` — context manager; `get(page: str) -> str` where `page` is a cascampus-relative path such as `"event.asp?gguid=0x…"`; opens `KIT_BASE + page`, waits for `networkidle` + the cascampus frame, returns `frame.content()`. Retries 3×, sleeps `delay` (default 1.0 s) before every load. `get_field(page: str) -> str` additionally, when the "Items a - b of N" text shows `b < N`, chooses 200 in the items-per-page control inside the frame, waits for reload, and returns that HTML.

- [ ] **Step 1: Scaffold** `pyproject.toml` (name `kit_scraper`, Python ≥3.12, deps `playwright`, `beautifulsoup4`, `lxml`; dev extra `pytest`; `[tool.pytest.ini_options] testpaths=["tests"]`). Create venv: `cd scraper && uv venv && uv pip install -e '.[dev]' && .venv/bin/playwright install chromium`.

- [ ] **Step 2: Write failing test** `tests/test_models.py`

```python
def test_event_to_json_dict_uses_camel_case():
    e = Event(id="0x1", number="2424283", title="T", type="Practical course (P)", type_code="P",
              language="English", sws=4, format="On-Site", content_text="c", ilias_url=None,
              kit_url="u", catalog_paths=[["1. Informatik Lehrveranstaltungen", "1.7 Practical Courses"]],
              lecturers=[Lecturer("A", "B")],
              slots=[Slot("Tue", "14:00", "15:30", "50.34 Raum 148", "weekly", "2026-10-27", 15)],
              sessions=[], module_ids=["M-INFO-101567"])
    d = e.to_json_dict()
    assert d["typeCode"] == "P" and d["contentText"] == "c" and d["iliasUrl"] is None
    assert d["slots"][0]["firstDate"] == "2026-10-27"
    assert d["moduleIds"] == ["M-INFO-101567"]
    assert Event.from_json_dict(d) == e

def test_change_omits_empty_before_after():
    c = Change(at="2026-10-18T04:00:00Z", event_id="0x1", event_title="T", kind="added", summary="Added")
    assert "before" not in c.to_json_dict()
```

- [ ] **Step 3: Run** `cd scraper && .venv/bin/pytest tests/test_models.py -v` → FAIL (import error).
- [ ] **Step 4: Implement `models.py`** (snake→camel via one helper over `dataclasses.fields`).
- [ ] **Step 5: Run** same command → PASS.
- [ ] **Step 6: Implement `fetch.py`** and `capture.py` (`python -m kit_scraper.capture <page> <out.html>` → `Fetcher().get(page)` written to file).
- [ ] **Step 7: Capture missing fixtures** (manual, live network):
  - `event_sessions.html`: the GPU-Computing event's appointment-list view. Open `event.asp?gguid=0x020D8FDB8FA84510A69499DAC43719B5` in `capture`, find in that HTML the link that lists individual dates (the termin row's count "15" or a `view=app`/appointment link) and capture its target. Record the exact page path used in a comment at the top of `parse_sessions.py` later.
  - `module_description.html`: the "Module description" tab of `abstractModuleView.asp?gguid=0x14CC2798E558E54E9011EF8375B7567B&camvguid=0x38196997375FAA4EABDA0984EE4FE07B&camvceid=CMPEL_D6B658EC&cafiguid=0x85D55FFA24FA48D4826A8F3E37731B4D` (find the tab link in `module.html`).
  - `event_lecture.html`: any SPO-2025 lecture with both a Vorlesung slot and an Übung (pick one from field 1.4 "Advanced Mandatory Modules" `0x6E894F5FE7FA4E0092796324BD190EC3`).
  - `event_block.html`: any event whose appointment table has no weekly row (block seminar from 1.6 Seminars `0x41A77324052144A2AEE84FCFD3CB9A98`), or with an empty appointment table.
  Expected: each file contains the event/module title text; `grep -c "Verifying your browser" *.html` → 0.
- [ ] **Step 8: Commit** `git add scraper && git commit -m "feat(scraper): scaffold, models, fetcher, fixtures"`

---

### Task 2: Field page parser

**Files:** Create `scraper/kit_scraper/parse_field.py`, `scraper/tests/test_parse_field.py`

**Interfaces:**
- Consumes: fixtures `field_root.html`, `field_practical.html`.
- Produces: `@dataclass FieldRow(id: str, title: str, depth: int, count: int | None)`; `@dataclass FieldPage(field_id: str, title: str, tree_rows: list[FieldRow], event_ids: list[str], total_count: int, listed_count: int)`; `parse_field(html: str) -> FieldPage`.
  - `tree_rows`: from sidebar `tr[class*=hierarchy]` rows — `id` = row `id` attr, `depth` = N in `hierarchyN`, `title` whitespace-collapsed, `count` = `span.badge` int or None.
  - `event_ids`: unique `gguid` of `event.asp` links in the events table, in page order.
  - `total_count`/`listed_count`: from "Items a - b of N" (`N`, `b-a+1`); both = 0 when the page says "No entries".

- [ ] **Step 1: Failing tests**

```python
def test_practical_courses_events():
    p = parse_field(fixture("field_practical.html"))
    assert p.field_id == "0x51515308AECE499594589506DFA75784"
    assert p.event_ids[0] == "0x93504EA110CF48EAA2CB5E40F5D33B51"
    assert "0x020D8FDB8FA84510A69499DAC43719B5" in p.event_ids
    assert len(p.event_ids) == len(set(p.event_ids)) == 25

def test_total_count():
    p = parse_field(fixture("field_practical.html"))
    assert (p.total_count, p.listed_count) == (40, 25)

def test_root_tree_rows():
    p = parse_field(fixture("field_root.html"))
    rows = {r.id: r for r in p.tree_rows}
    assert rows["0x51515308AECE499594589506DFA75784"].title == "1.7 Practical Courses"
    assert rows["0x51515308AECE499594589506DFA75784"].count == 41
    assert rows["0x51515308AECE499594589506DFA75784"].depth > rows["0x01291EE9E14C46BD916AC325D0EE8CE2"].depth
    assert p.event_ids == [] and p.total_count == 0
```
(`fixture(name)` helper in `tests/conftest.py` reads `tests/fixtures/<name>`.)

- [ ] **Step 2: Run** `.venv/bin/pytest tests/test_parse_field.py -v` → FAIL.
- [ ] **Step 3: Implement** with BeautifulSoup + lxml.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(scraper): field page parser`

---

### Task 3: Event and session parsers

**Files:** Create `scraper/kit_scraper/parse_event.py`, `scraper/kit_scraper/parse_sessions.py`, `scraper/tests/test_parse_event.py`, `scraper/tests/test_parse_sessions.py`

**Interfaces:**
- Consumes: `Event`, `Slot`, `Lecturer`, `Session`, `SPO` from Task 1.
- Produces:
  - `@dataclass ParsedEvent(event: Event, in_spo: bool, module_pages: dict[str, str], sessions_page: str | None)` — `module_pages` maps `M-INFO-…` → cascampus-relative `abstractModuleView.asp?…` path (taken from the SPO's collapsible row); `sessions_page` = path for the appointment list found in Task 1 Step 7.
  - `parse_event(html: str, event_id: str) -> ParsedEvent`. `catalog_paths` from "Course Catalog Headlines" (drop the leading "KIT Department of Informatics"); `sessions` left empty; `fingerprint` left `""`. SPO mapping: in "Degree Programs and Bricks", the `tr.folding-close` row whose text contains the `SPO` constant (`88-979-H-2025`) is followed by `tr.collapsible` rows; each holds `field › M-INFO-… › T-INFO-…` links — collect module ids (`M-INFO-\d+`) in order, deduplicated.
  - Slot parsing: day from "Mon/Tue/…, weekly|biweekly|…" → `day` 3-letter English or `None`; rhythm = the text after the comma lowercased (`"weekly"`, `"biweekly"`, else raw text, `"block"` if the row says block); times "2:00 PM - 3:30 PM" → `"14:00"`, `"15:30"`; start date `MM/DD/YYYY` → ISO; count int.
  - `type_code` = letters inside the trailing parentheses of `type`; `sws` = WTH as float.
  - `parse_sessions(html: str) -> list[Session]` — one per row, dates ISO, times 24 h, `cancelled` true when the row is marked cancelled (struck-through/"cancelled"/"entfällt" marker as seen in the fixture).

- [ ] **Step 1: Failing tests** (`test_parse_event.py`)

```python
def test_gpu_computing_event():
    pe = parse_event(fixture("event.html"), "0x020D8FDB8FA84510A69499DAC43719B5")
    e = pe.event
    assert (e.number, e.title, e.language, e.sws, e.type_code, e.format) == \
           ("2424283", "Practical course GPU-Computing", "English", 4.0, "P", "On-Site")
    assert e.slots == [Slot("Tue", "14:00", "15:30", "50.34 Raum 148", "weekly", "2026-10-27", 15)]
    assert [l.name for l in e.lecturers] == ["Dmitrii Klepikov", "Nathan Lerzer", "Prof. Dr.-Ing. Carsten Dachsbacher"]
    assert e.catalog_paths == [["1. Informatik Lehrveranstaltungen", "1.7 Practical Courses"]]
    assert e.content_text.startswith("Beim GPU-Computing")
    assert e.ilias_url.startswith("https://ilias.studium.kit.edu/")
    assert pe.in_spo and e.module_ids == ["M-INFO-101567"]
    assert pe.module_pages["M-INFO-101567"].startswith("abstractModuleView.asp?gguid=0x14CC2798E558E54E9011EF8375B7567B")

def test_lecture_has_multiple_slots():
    e = parse_event(fixture("event_lecture.html"), "x").event
    assert len(e.slots) >= 2 and all(s.day for s in e.slots)

def test_event_without_slots():
    e = parse_event(fixture("event_block.html"), "x").event
    assert all(s.day is None for s in e.slots)   # may also be []
```
`test_parse_sessions.py`: `parse_sessions(fixture("event_sessions.html"))` has 15 items, first `== Session("2026-10-27", "14:00", "15:30", "50.34 Raum 148", False)`, all dates are Tuesdays. Add one synthetic test with a minimal HTML row carrying the fixture's cancelled marker → `cancelled is True`.

- [ ] **Step 2: Run** `.venv/bin/pytest tests/test_parse_event.py tests/test_parse_sessions.py -v` → FAIL.
- [ ] **Step 3: Implement both parsers.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(scraper): event and session parsers`

---

### Task 4: Module parser

**Files:** Create `scraper/kit_scraper/parse_module.py`, `scraper/tests/test_parse_module.py`

**Interfaces:**
- Consumes: `Module`, `Brick`, `ModuleDescription`.
- Produces: `parse_module(html: str, description_html: str | None, kit_url: str) -> Module`; `module_description_page(html: str) -> str | None` (path of the "Module description" tab).
  - Read the "Module Details" label/value pairs, not the left-hand module list at the top of the page.
  - Description: map headings in the description page — Learning objectives/Competence Certificate/Content/Prerequisites/Workload (EN or DE labels) → fields; missing → `None`.

- [ ] **Step 1: Failing test**

```python
def test_visual_computing_module():
    m = parse_module(fixture("module.html"), fixture("module_description.html"), "u")
    assert (m.id, m.title, m.ects, m.recurrence) == \
           ("M-INFO-101567", "Practical Course: Visual Computing", 6.0, "Each term")
    assert (m.assignment, m.part, m.language) == ("Compulsory elective", "Elective Studies", "English")
    assert m.fields == ["Elective Studies in Informatics"]
    assert m.bricks == [Brick("T-INFO-103000", "Practical Course: Visual Computing", 6.0)]
    assert m.description.exam  # non-empty text from the description tab

def test_module_without_description():
    assert parse_module(fixture("module.html"), None, "u").description.exam is None
```
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(scraper): module parser`

---

### Task 5: Fingerprint and diff

**Files:** Create `scraper/kit_scraper/fingerprint.py`, `scraper/kit_scraper/diff.py`, `scraper/tests/test_diff.py`

**Interfaces:**
- Produces:
  - `fingerprint(e: Event) -> str` — first 16 hex chars of sha256 over canonical JSON (`sort_keys=True`) of `{slots, sessions, lecturers names, module_ids}`; content text excluded (content edits are reported but don't trigger personal alerts).
  - `diff(old: dict[str, Event], new: dict[str, Event], at: str) -> list[Change]`, deterministic order (by event id, then kind). Rules:
    - id only in new → `added`; only in old → `removed`.
    - slots compared positionally after sorting by (day, start): differing day/start/end/rhythm → one `slot_changed`; otherwise only rooms differ → `room_changed`. Slot list length differs → `slot_changed`.
    - sessions keyed by (date, start): newly `cancelled` → `session_cancelled` (one per session); key only in new → `session_added`; only in old → `session_removed`.
    - `content_text` differs → `content_changed`; lecturer names differ → `lecturers_changed`; module_ids differ → `modules_changed`.
    - `summary` English, e.g. `"Room 50.34 Raum 148 → 50.34 Raum 131"`, `"Session 2026-11-12 14:00 cancelled"`, `"Tue 14:00–15:30 → Wed 10:00–11:30"`.
  - `prune(entries: list[Change], now: str, days: int = 90) -> list[Change]`.

- [ ] **Step 1: Failing tests** — build a base `Event` via a `make_event(**overrides)` helper, then one test per kind:

```python
def test_room_only_change():
    old = {"a": make_event()}
    new = {"a": make_event(slots=[replace(BASE_SLOT, room="50.34 Raum 131")])}
    [c] = diff(old, new, AT)
    assert c.kind == "room_changed" and "50.34 Raum 131" in c.summary

def test_cancelled_session():
    new = {"a": make_event(sessions=[Session("2026-11-12", "14:00", "15:30", None, True)])}
    old = {"a": make_event(sessions=[Session("2026-11-12", "14:00", "15:30", None, False)])}
    assert [c.kind for c in diff(old, new, AT)] == ["session_cancelled"]

def test_identical_produces_nothing():
    assert diff({"a": make_event()}, {"a": make_event()}, AT) == []

def test_fingerprint_ignores_content_but_not_room():
    assert fingerprint(make_event()) == fingerprint(make_event(content_text="other"))
    assert fingerprint(make_event()) != fingerprint(make_event(slots=[replace(BASE_SLOT, room="X")]))

def test_prune_drops_old_entries(): ...   # entry 91 days before `now` removed, 89 kept
```
plus `added`, `removed`, `slot_changed`, `session_added`, `content_changed`, `modules_changed` one-liners.
- [ ] **Step 2: Run** `.venv/bin/pytest tests/test_diff.py -v` → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(scraper): fingerprint and diff`

---

### Task 6: Crawl orchestration, thresholds, first real scrape

**Files:** Create `scraper/kit_scraper/run.py`, `scraper/tests/test_run.py`; create `data/courses.json`, `data/changes.json` (output)

**Interfaces:**
- Consumes: everything above. `Fetcher` is injected so tests use a `FakeFetcher(pages: dict[str, str])` that returns fixture HTML by page path.
- Produces:
  - `crawl(fetcher, roots: list[str], previous: dict | None) -> tuple[dict, list[str]]` — returns `(courses_json_dict, warnings)`. BFS over field ids from `tree_rows` restricted to descendants of the roots (a row belongs to the subtree while depth > root depth in sidebar order); `get_field` each; collect event ids → `catalog_paths` accumulate per id (dedupe); `get` each event, skip `in_spo == False`; fetch sessions page when present; fetch each module (and its description) once. If an event page fails after retries and `previous` has it, reuse the previous version and add a warning; else count as failed. When `listed_count < total_count` for a field, add warning `"field <id>: listed <b> of <N>"`. Builds `tree` (FieldNode, only fields that contain ≥1 kept event in their subtree), `events`, `modules`, `meta`, sets each `Event.fingerprint`.
  - `check_thresholds(new: dict, previous: dict | None, failed: int, attempted: int) -> str | None` — returns reason string when a Global Constraints threshold is hit.
  - `main(argv)`: `python -m kit_scraper.run --out ../data [--limit N]` — reads previous files, crawls, checks thresholds (exit 2 + message, files untouched), diffs, prepends changes, prunes, writes both files. `--limit` caps events for smoke runs.

- [ ] **Step 1: Failing tests** with `FakeFetcher`:

```python
def test_event_in_two_fields_is_deduplicated():
    # two field pages both listing GPU event → one event with two catalogPaths
    data, _ = crawl(fake_with_two_fields(), ROOTS, None)
    ev = data["events"]["0x020D8FDB8FA84510A69499DAC43719B5"]
    assert len(ev["catalogPaths"]) == 2

def test_non_spo_event_is_dropped(): ...      # event fixture with SPO text removed → not in events
def test_short_field_listing_adds_warning(): ...  # field_practical as-is (25 of 40) → warning contains "listed 25 of 40"
def test_threshold_count_drop():
    assert "drop" in check_thresholds(new_with(60), prev_with(100), 0, 60)
def test_threshold_failed_ratio():
    assert check_thresholds(new_with(100), None, 12, 100) is not None
def test_failed_event_reuses_previous(): ...   # fetcher raises for one event, previous has it → kept + warning
```
- [ ] **Step 2: Run** `.venv/bin/pytest -v` → new tests FAIL.
- [ ] **Step 3: Implement `run.py`.**
- [ ] **Step 4: Run** full suite → PASS.
- [ ] **Step 5: Smoke run** `cd scraper && .venv/bin/python -m kit_scraper.run --out ../data --limit 10` → exit 0, `data/courses.json` has ≤10 events each with ≥1 `moduleIds`.
- [ ] **Step 6: Full run** (no `--limit`). Verify: exit 0; `warnings` reviewed; event count plausible (compare a few fields' badge counts); spot-check 3 events against the KIT site (times, room, ECTS of a module). Record runtime in commit message.
- [ ] **Step 7: Commit** `git add scraper data && git commit -m "feat(scraper): crawl orchestration + initial data"`

---

### Task 7: Web scaffold, types, schedule logic (conflicts, ECTS, ics)

**Files:** Create `web/package.json`, `web/vite.config.ts`, `web/tsconfig.json`, `web/index.html`, `web/public/data` (symlink to `../../data`), `web/src/types.ts`, `web/src/logic/time.ts`, `web/src/logic/conflicts.ts`, `web/src/logic/ects.ts`, `web/src/logic/ics.ts`, `web/tests/schedule.test.ts`, `web/tests/fixtures.ts`

**Interfaces:**
- Produces (`types.ts`): `Slot`, `Session`, `Lecturer`, `Event`, `Module`, `FieldNode`, `Change`, `CoursesFile`, `ChangesFile` exactly mirroring spec §4; `SelectedEntry { enabledSlots: number[]; moduleId: string | null; ackFingerprint: string }`; `UserState { version: 1; selected: Record<string, SelectedEntry>; lang: 'tr' | 'en'; lastSeenScrapedAt: string }`.
- Produces (`logic/`):
  - `toMinutes(hhmm: string): number`; `weekdayOf(isoDate: string): Slot['day']`.
  - `activeSessions(ev: Event, enabled: number[]): Session[]` — non-cancelled sessions whose (weekday, start) matches an enabled slot, plus sessions matching no slot.
  - `findConflicts(selected: Record<string, SelectedEntry>, events: Record<string, Event>): Conflict[]`, `Conflict { a: string; b: string; day: string; start: string; end: string; date?: string }`. If both events have sessions → compare `activeSessions` pairwise on same date (`a.start < b.end && b.start < a.end`), one Conflict per distinct (pair, weekday, overlap window) with first `date`. Otherwise compare enabled slots with non-null `day`. Unknown event ids skipped.
  - `computeEcts(selected, events, modules): { total: number; byPart: Record<string, number>; duplicateModules: string[]; unknown: string[] }` — sums `ects` of each distinct chosen `moduleId` (fallback `events[id].moduleIds[0]`), grouped by `module.part ?? '—'`; module chosen by >1 event listed in `duplicateModules`; `ects === null` → in `unknown`; events missing from `events` ignored.
  - `buildIcs(selected, events, scrapedAt: string): string` — VCALENDAR with one VEVENT per `activeSessions` item: `UID:<eventId>-<date>-<start>@kitcanavari`, `DTSTART;TZID=Europe/Berlin:YYYYMMDDTHHMMSS`, `SUMMARY:<number> <title>`, `LOCATION:<room>`, CRLF line endings, lines folded at 75 octets.

- [ ] **Step 1: Scaffold** `npm create vite@latest web -- --template preact-ts`, add `vitest`, `@testing-library/preact`, `jsdom`; `vite.config.ts` sets `base: './'` and `test.environment: 'jsdom'`; `ln -s ../../data web/public/data`. `npm run build` → succeeds.
- [ ] **Step 2: Failing tests** `tests/schedule.test.ts` (fixtures built with small `ev()`/`mod()` helpers):

```ts
test('overlapping weekly slots conflict', () => {
  const c = findConflicts(sel('a', 'b'), { a: ev('a', [slot('Tue', '14:00', '15:30')]), b: ev('b', [slot('Tue', '15:00', '16:30')]) });
  expect(c).toEqual([{ a: 'a', b: 'b', day: 'Tue', start: '15:00', end: '15:30' }]);
});
test('touching slots do not conflict', ...)            // 14:00–15:30 vs 15:30–17:00 → []
test('disabled slot is ignored', ...)                   // enabledSlots: [] → []
test('conflicts ignores slots with null day', ...)      // block event → []
test('biweekly sessions on different dates do not conflict', ...)
test('cancelled session does not conflict', ...)
test('computeEcts counts a module once and reports duplicate', () => {
  const r = computeEcts({ a: entry('M1'), b: entry('M1') }, evs, { M1: mod('M1', 6, 'Elective Studies') });
  expect(r).toMatchObject({ total: 6, byPart: { 'Elective Studies': 6 }, duplicateModules: ['M1'] });
});
test('computeEcts skips missing events', ...)           // selected id not in events → total 0, no throw
test('buildIcs emits one VEVENT per active session with Berlin TZID', ...)  // 3 sessions, 1 cancelled → 2 VEVENT, contains 'DTSTART;TZID=Europe/Berlin:20261027T140000', '\r\n'
```
- [ ] **Step 3: Run** `cd web && npx vitest run tests/schedule.test.ts` → FAIL.
- [ ] **Step 4: Implement** `time.ts`, `conflicts.ts`, `ects.ts`, `ics.ts`.
- [ ] **Step 5: Run** → PASS.
- [ ] **Step 6: Commit** `feat(web): scaffold, types, schedule logic`

---

### Task 8: State store, alerts, i18n, data loading, filtering

**Files:** Create `web/src/store.ts`, `web/src/logic/alerts.ts`, `web/src/logic/filter.ts`, `web/src/i18n.ts`, `web/src/data.ts`, `web/tests/state.test.ts`, `web/tests/filter.test.ts`

**Interfaces:**
- Produces:
  - `loadState(storage: Storage | null): { state: UserState; persistent: boolean }` — missing/corrupt/`version !== 1` → default state (`lang` from `navigator.language`); `storage` null or throwing → `persistent: false`.
  - `saveState(storage: Storage | null, s: UserState): boolean`.
  - `useAppState(): [UserState, (fn: (s: UserState) => UserState) => void, boolean /*persistent*/]` — Preact hook persisting on every update.
  - `addEvent(s, ev: Event): UserState` (all slots enabled, `moduleId = ev.moduleIds[0] ?? null`, `ackFingerprint = ev.fingerprint`), `removeEvent(s, id)`, `toggleSlot(s, id, idx)`, `setModule(s, id, moduleId)`, `acknowledge(s, ids: string[], events)`, `exportState(s): string`, `importState(json: string): UserState | null`.
  - `pendingAlerts(state, data: CoursesFile, changes: ChangesFile): Alert[]`, `Alert { eventId: string; title: string; removed: boolean; changes: Change[] }` — events in `selected` whose `ackFingerprint !== events[id]?.fingerprint` (missing → `removed: true`); `changes` = `changes.entries` for that id with `at > state.lastSeenScrapedAt`, or all entries for that id if none are newer. `acknowledge` sets each entry's `ackFingerprint` to the current fingerprint (drops removed ids from `selected`) and sets `lastSeenScrapedAt = data.meta.scrapedAt`.
  - `filterEvents(data: CoursesFile, f: Filters, state: UserState): Event[]`, `Filters { query: string; fieldId: string | null; types: string[]; languages: string[]; days: string[]; from: string | null; to: string | null; ects: number[]; parts: string[]; noConflict: boolean }`. Query matches number/title/lecturer case-insensitively; `fieldId` matches events in that node's subtree; `noConflict` uses `findConflicts` against current selection. Sorted by number.
  - `t(lang, key, params?)` with flat `tr`/`en` dictionaries; missing key returns the key.
  - `loadData(): Promise<{ courses: CoursesFile; changes: ChangesFile }>` from `./data/courses.json`, `./data/changes.json`.

- [ ] **Step 1: Failing tests**

```ts
test('loadState returns default on corrupt json', () => {
  const s = memStorage({ 'kitcanavari:v1': '{not json' });
  expect(loadState(s).state.selected).toEqual({});
});
test('loadState treats throwing storage as non-persistent', ...)
test('alerts flag fingerprint change', ...)        // ack 'aaa', data fp 'bbb' → 1 alert with matching changes
test('alerts include removed events', ...)         // selected id absent from data → removed: true
test('acknowledge clears alerts', ...)
test('importState rejects garbage', () => expect(importState('[]')).toBeNull())
test('filter by query matches lecturer', ...)
test('filter noConflict hides overlapping events', ...)
test('filter by fieldId includes descendants', ...)
```
- [ ] **Step 2: Run** `npx vitest run` → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(web): state, alerts, filters, i18n`

---

### Task 9: UI — app shell and catalog

**Files:** Create `web/src/ui/App.tsx`, `web/src/ui/catalog/{Tree,Filters,EventCard,EventDetail}.tsx`, `web/src/styles.css`, `web/tests/catalog.test.tsx`; modify `web/src/main.tsx`

**Interfaces:**
- Consumes: `loadData`, `useAppState`, `filterEvents`, `findConflicts`, `computeEcts`-adjacent helpers, `t`.
- Produces: `<App/>` with tabs `catalog | schedule | changes` (hash routing `#/catalog` etc.), header language toggle, footer `Veri: <date>` / `Data: <date>` with stale warning (> 3 days), banner when `persistent === false`, loading and load-error states.
- Catalog: tree with counts (drawer under 720 px width), filter bar, card list (title, type badge, language, SWS, ECTS range from linked modules e.g. `4–6`, slots, "in schedule" state, ⚠ when it conflicts with the schedule), detail panel (content, slots, sessions with cancelled struck through, lecturers, modules collapsible with ECTS/part/exam/prerequisites/objectives, ILIAS + KIT links, add/remove button).

- [ ] **Step 1: Failing tests** (render `<App/>` with `loadData` mocked to a small fixture):
  - `shows events and filters by search` — typing a lecturer name leaves only matching cards.
  - `adding an event marks card as in schedule and persists` — click add → card shows in-schedule label; memory storage contains event id.
  - `shows stale data warning` — `scrapedAt` 4 days ago → warning text visible.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Visual check** `npm run dev` with real `data/` → catalog renders, filtering works at desktop and 375 px width (browser devtools).
- [ ] **Step 6: Commit** `feat(web): app shell and catalog`

---

### Task 10: UI — schedule and changes views

**Files:** Create `web/src/ui/schedule/{WeekGrid,EctsPanel,UnscheduledList}.tsx`, `web/src/ui/changes/ChangesView.tsx`, `web/tests/schedule-ui.test.tsx`; modify `web/src/ui/App.tsx`

**Interfaces:**
- Consumes: `findConflicts`, `computeEcts`, `buildIcs`, `pendingAlerts`, `acknowledge`, `toggleSlot`, `setModule`, `exportState`, `importState`.
- Schedule: grid per Global Constraints; blocks positioned by minutes; conflicting blocks red border + textual list above grid (`"{a} ↔ {b}: {day} {start}–{end}"`); per-event slot toggles and module select; EctsPanel (total, by part, duplicate warning, unknown ECTS note); UnscheduledList (events whose enabled slots all have `day === null`); removed-from-catalog events greyed with label; buttons `.ics indir`/`Download .ics` (Blob download), export/import JSON (file input; invalid file → error message).
- Changes: top section = `pendingAlerts` with "Gördüm / Mark as seen"; bottom = all `changes.entries`, toggle "only my schedule / all"; tab label shows unread count badge.

- [ ] **Step 1: Failing tests**
  - `conflicting events show conflict message` — two overlapping selected events → message lists both titles.
  - `ects total updates when module changes` — select second module (8 ECTS) → total shows 8.
  - `mark as seen clears badge` — alert badge "1" → click → badge gone.
  - `import invalid file shows error`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Visual check** in dev server: add 4–5 real courses including one with a conflict; download `.ics` and open in macOS Calendar (events on correct Berlin times).
- [ ] **Step 6: Commit** `feat(web): schedule and changes views`

---

### Task 11: GitHub workflows, repo, deploy, fallback

**Files:** Create `.github/workflows/scrape.yml`, `.github/workflows/deploy.yml`, `ops/launchd/com.kitcanavari.scrape.plist`, `ops/README.md`, `README.md`

**Interfaces:**
- `scrape.yml`: `on: schedule: cron '0 4 * * *'` + `workflow_dispatch`; `permissions: contents: write`; ubuntu-latest, Python 3.12, `pip install -e scraper && playwright install --with-deps chromium`, `python -m kit_scraper.run --out data`; if `git status --porcelain data` non-empty → commit `chore(data): scrape <date>` as `github-actions[bot]` and push. Non-zero exit fails the job (GitHub emails the owner).
- `deploy.yml`: on push to `main` (paths `web/**`, `data/**`) + `workflow_dispatch`; `permissions: pages: write, id-token: write`; Node 20, `npm ci && npm test -- --run && npm run build` in `web/`, `cp -r data web/dist/data` (replacing the symlink target), `actions/upload-pages-artifact` + `actions/deploy-pages`. Also trigger deploy at the end of `scrape.yml` when data was committed (pushes from `GITHUB_TOKEN` don't trigger other workflows → call deploy via `workflow_call` or a `needs` job).
- `ops/`: launchd plist running `scraper/.venv/bin/python -m kit_scraper.run --out data && git commit/push` daily at 07:00 local; README explains when/how to enable (`launchctl load`).
- `README.md`: what the site is, link, how to run locally (scraper + web), how data updates.

- [ ] **Step 1: Repo** — user creates a public GitHub repo `kitcanavari` (or installs `gh` via `brew install gh && gh auth login` and we run `gh repo create kitcanavari --public --source . --push`). Set Pages source to "GitHub Actions". Expected: `git remote -v` shows origin, `git push -u origin main` succeeds.
- [ ] **Step 2: Write workflows**; validate syntax with `npx --yes action-validator .github/workflows/*.yml` (or `actionlint` if installed) → no errors.
- [ ] **Step 3: Push and run** `scrape` via workflow_dispatch. Expected: job green, data commit (or "no changes"), deploy green, site loads at `https://<user>.github.io/kitcanavari/` with today's data date.
- [ ] **Step 4: If scrape fails on the bot check** (log shows "Verifying your browser" / no cascampus frame): disable the `schedule` trigger, enable the launchd fallback per `ops/README.md`, run it once manually, confirm push → deploy.
- [ ] **Step 5: Commit** `ci: daily scrape + pages deploy`
