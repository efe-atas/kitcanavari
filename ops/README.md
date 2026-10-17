# Fallback: scrape on your Mac

Use this only if the `scrape` GitHub workflow fails because KIT's bot check blocks GitHub's servers
(the log shows "Verifying your browser" or "cascampus frame did not load").

1. Disable the schedule in `.github/workflows/scrape.yml` (delete the `schedule:` block) and push.
2. Make sure the scraper works locally: `cd scraper && uv venv && uv pip install -e '.[dev]' && .venv/bin/playwright install chromium`.
3. Make sure `git push` works without a password prompt (SSH key or credential helper).
4. Install the daily job (07:00; runs at the next wake-up if the Mac was asleep):

   ```sh
   cp ops/launchd/com.kitcanavari.scrape.plist ~/Library/LaunchAgents/
   launchctl load ~/Library/LaunchAgents/com.kitcanavari.scrape.plist
   launchctl start com.kitcanavari.scrape   # run once now
   tail -f /tmp/kitcanavari-scrape.log
   ```

The push triggers the `deploy` workflow, which publishes the new data.
To remove it: `launchctl unload ~/Library/LaunchAgents/com.kitcanavari.scrape.plist`.
