#!/bin/zsh
# Fallback when KIT blocks GitHub Actions: scrape on this Mac and push the data.
set -euo pipefail
REPO="${0:A:h:h}"
cd "$REPO"
git pull --ff-only
(cd scraper && .venv/bin/python -m kit_scraper.run --out ../data)
if [ -n "$(git status --porcelain data)" ]; then
  git add data
  git commit -m "chore(data): scrape $(date -u +%Y-%m-%d) (local)"
  git push
fi
