# kitcanavari — KIT CS Master course planner

A website for browsing the KIT course catalog for **Computer Science Master (SPO 88-979-H-2025)**
and building a weekly timetable: conflict check, ECTS counter, `.ics` export, and alerts when
a course you picked changes (time, room, cancelled session).

Your schedule lives only in your browser (localStorage); use *Export* to back it up or move it to another device.

## How the data stays fresh

`.github/workflows/scrape.yml` runs every day: a Playwright scraper (`scraper/`) reads the public
KIT course catalog, keeps only courses linked to SPO 2025, and writes `data/courses.json` and
`data/changes.json` (a 90-day change log). If anything changed, it commits the data and redeploys
the site (`web/`) to GitHub Pages. If the catalog looks broken (many failures, or a > 30 % drop in
courses) nothing is written and the workflow fails, so you get an e-mail from GitHub.

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

Design and plan: `docs/superpowers/specs/`, `docs/superpowers/plans/`. Fallback for scraping on a Mac: `ops/README.md`.

This is an unofficial student project and is not affiliated with KIT.
