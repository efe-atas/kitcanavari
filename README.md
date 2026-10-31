# kitcanavari — KIT CS Master course planner

A website for browsing the KIT course catalog for **Computer Science Master (SPO 88-979-H-2025)**
and building a weekly timetable: conflict check, ECTS counter, `.ics` export, and alerts when
a course you picked changes (time, room, cancelled session).

Your schedule lives only in your browser (localStorage); use *Export* to back it up or move it to another device.

## What it does

- **Overview:** today's sessions in real dates (live, next, cancelled), the 120-credit ledger, every degree
  requirement with what is missing, a graduation outlook (the term your modules reach 90 ECTS, then the thesis), a
  grade calculator with expected grades, upcoming exams and deadlines, and how fresh the catalog is.
- **Courses:** search all 211 modules; filter by kind, area of specialization, free weekdays, "fits my week" and
  your shortlist; add to any term with one click (and undo it); suggestions for the chosen term that fill open
  requirements.
- **Plan:** terms as a list or a board; drag a course to another term or use its move menu; print it or save it as
  PDF; share it as a link that opens read-only (grades and course reviews only if you choose) and compare a
  friend's plan with yours; warnings when a recommended prerequisite comes later; save alternative plans as
  scenarios and compare their credits, workload and fit side by side.
- **My week:** the timetable in real calendar weeks, with block dates, cancellations, clashes per date and an
  `.ics` export; weekly contact hours and estimated workload; a preview of next term's timetable once KIT publishes it.
- **Course sheet:** your own exam dates and deadlines, an expected grade, and a private review (difficulty,
  workload, would recommend).
- **Career:** pick a work environment and optionally a role; skill gaps and profile, fit per term, courses that close
  gaps, lecturers to approach, a job-ad matcher, CV coursework lines and a full course proposal that respects the
  degree rules.
- **Quick search:** `Ctrl/⌘ K` (or `/`) reaches any course, page or action; `G` then a letter jumps between pages;
  `?` lists the shortcuts.
- **Installable and offline:** add it to your home screen; without a connection it shows the last downloaded
  catalog. Turkish and English; light, dark or system theme.

## How the data stays fresh

`.github/workflows/scrape.yml` runs every day: a Playwright scraper (`scraper/`) reads the public
KIT course catalog, keeps only courses linked to SPO 2025, and writes `data/courses.json` and
`data/changes.json` (a 90-day change log). If anything changed, it commits the data and redeploys
the site (`web/`) to GitHub Pages. If the catalog looks broken (many failures, or a > 30 % drop in
courses) nothing is written and the workflow fails, so you get an e-mail from GitHub.

Next term's timetable: once KIT opens the catalog for the coming term, set the repository variables
`NEXT_TERM_GUID` (the catalog's `tguid` for that term) and `NEXT_TERM` (for example `SS 27`). The daily run then
also writes `data/next/courses.json`, and *My week* shows a preview. A failure there never blocks the current data.

## Profile sync (optional)

The plan can live in a private GitHub repo instead of only in one browser, so every device shows the same plan:

1. Create a private repo, e.g. `efe-atas/kitcanavari-me` (it can stay empty; the site writes `profile.json`).
2. Create a [fine-grained token](https://github.com/settings/personal-access-tokens/new) with access to **only that
   repo** and the permission *Contents: Read and write*.
3. On the site, click the cloud button in the top bar, enter `owner/repo` and the token, and press *Connect*.

The token is stored only in that browser's localStorage. Changes are saved about three seconds after you make them,
each save is a commit, so `git log` in the profile repo is your undo history.

## Run locally

```sh
# scraper (≈ 1 h for the whole catalog; KIT's server is slow)
cd scraper
uv venv && uv pip install -e '.[dev]' && .venv/bin/playwright install chromium
.venv/bin/pytest
.venv/bin/python -m kit_scraper.run --out ../data            # full run
.venv/bin/python -m kit_scraper.run --out /tmp/x --limit 10 --root 0x51515308AECE499594589506DFA75784   # quick try
.venv/bin/python -m kit_scraper.parse_handbook ../kit_docs/module_handbook.pdf --out ../data/handbook.json   # new handbook only, by hand (needs poppler)

# website
cd web
npm install
npm test
npm run dev      # serves ../data via the web/public/data symlink
```

Design and plan: `docs/superpowers/specs/` (latest: `2026-10-30-v3-design.md`), `docs/superpowers/plans/`.
Fallback for scraping on a Mac: `ops/README.md`.

This is an unofficial student project and is not affiliated with KIT.
