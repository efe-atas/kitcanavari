#!/bin/zsh
# Fallback when KIT blocks GitHub Actions: scrape on this Mac and push the data.
set -euo pipefail
REPO="${0:A:h:h}"
cd "$REPO"

notify() { osascript -e "display notification \"$1\" with title \"kitcanavari scrape\"" || true; }
trap 'notify "Scrape failed — see /tmp/kitcanavari-scrape.log"' ERR

git pull --ff-only
# caffeinate keeps the Mac awake for the ~40 min crawl (a sleeping Mac hangs the browser session).
(cd scraper && caffeinate -i .venv/bin/python -m kit_scraper.run --out ../data)
if [ -n "$(git status --porcelain data)" ]; then
  git add data
  git commit -m "chore(data): scrape $(date -u +%Y-%m-%d) (local)"
  git push
fi
