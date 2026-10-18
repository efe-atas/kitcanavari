"""Playwright session that opens KIT catalog deeplinks and returns the cascampus iframe HTML."""
from __future__ import annotations

import re
import time

from playwright.sync_api import Frame, Page, sync_playwright

from .models import KIT_BASE, TERM_GUID

CASCAMPUS_BASE = "https://cascampus.studium.kit.edu/campus/all/"
USER_AGENT_SUFFIX = "kitcanavari-scraper (+https://github.com/kitcanavari)"
_ITEMS_RE = re.compile(r"Items\s+(\d+)\s*-\s*(\d+)\s+of\s+(\d+)")


def _with_term(page: str) -> str:
    """Pin the term explicitly; without tguid the site silently serves the 'current' term."""
    if "tguid=" in page:
        return page
    return page + ("&" if "?" in page else "?") + f"tguid={TERM_GUID}&lang=en"


class FetchError(RuntimeError):
    pass


class Fetcher:
    def __init__(self, delay: float = 1.0, retries: int = 3, timeout_ms: int = 60_000):
        self.delay = delay
        self.retries = retries
        self.timeout_ms = timeout_ms
        self._pw = None
        self._browser = None
        self._page: Page | None = None

    def __enter__(self) -> Fetcher:
        self._pw = sync_playwright().start()
        self._browser = self._pw.chromium.launch()
        ua = self._browser.new_page().evaluate("navigator.userAgent")
        context = self._browser.new_context(user_agent=f"{ua} {USER_AGENT_SUFFIX}")
        self._page = context.new_page()
        self._page.set_default_timeout(self.timeout_ms)
        return self

    def __exit__(self, *exc) -> None:
        if self._browser:
            self._browser.close()
        if self._pw:
            self._pw.stop()

    def _frame(self) -> Frame:
        deadline = time.monotonic() + self.timeout_ms / 1000
        while time.monotonic() < deadline:
            for f in self._page.frames:
                if "cascampus" in f.url:
                    try:
                        f.wait_for_load_state("networkidle")
                        if f.evaluate("document.body && document.body.innerText.length > 0"):
                            return f
                    except Exception:
                        pass
            self._page.wait_for_timeout(250)
        raise FetchError("cascampus frame did not load")

    def _open(self, page: str) -> Frame:
        page = _with_term(page)
        last: Exception | None = None
        for attempt in range(self.retries):
            time.sleep(self.delay)
            try:
                frame = self._current_frame()
                if frame is not None and attempt == 0:
                    # Outer page already passed the bot check: only navigate the iframe.
                    frame.goto(CASCAMPUS_BASE + page, wait_until="networkidle")
                else:
                    # A fresh about:blank first: hash-only changes would not reload the outer frame.
                    self._page.goto("about:blank")
                    self._page.goto(KIT_BASE + page, wait_until="networkidle")
                frame = self._frame()
                if "cascampus" not in frame.url or "Verifying your browser" in frame.content():
                    raise FetchError("iframe did not show catalog content")
                return frame
            except Exception as e:  # noqa: BLE001 - retry any navigation failure
                last = e
        raise FetchError(f"failed to load {page}: {last}")

    def _current_frame(self) -> Frame | None:
        return next((f for f in self._page.frames if "cascampus" in f.url), None)

    def get(self, page: str) -> str:
        return self._open(page).content()

    def get_field(self, page: str) -> str:
        last: Exception | None = None
        for _ in range(self.retries):
            try:
                frame = self._open(page)
                m = _ITEMS_RE.search(frame.evaluate("document.body.innerText"))
                if m and int(m.group(2)) < int(m.group(3)):
                    frame = self._show_all(frame, int(m.group(3)))
                return frame.content()
            except Exception as e:  # noqa: BLE001 - Playwright timeouts etc. become a retryable FetchError
                last = e
        raise FetchError(f"failed to list all events of {page}: {last}")

    def _show_all(self, frame: Frame, total: int) -> Frame:
        """Pick 200 items per page and wait until the iframe itself lists all `total` events."""
        select = frame.locator("select:has(option[value='200'])").first
        if select.count():
            select.select_option("200")
        else:
            frame.locator("a", has_text=re.compile(r"^\s*200\s*$")).first.click()
        deadline = time.monotonic() + self.timeout_ms / 1000
        while time.monotonic() < deadline:
            self._page.wait_for_timeout(500)
            current = self._current_frame()
            try:
                m = current and _ITEMS_RE.search(current.evaluate("document.body.innerText"))
            except Exception:  # noqa: BLE001 - frame is mid-navigation
                continue
            if m and int(m.group(1)) == 1 and int(m.group(2)) == int(m.group(3)) == total:
                current.wait_for_load_state("networkidle")
                return current
        raise FetchError(f"listing did not expand to {total} items")
