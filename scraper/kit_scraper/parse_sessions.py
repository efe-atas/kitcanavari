"""Appointments table (APPLIST) of an event page → slots and individual sessions.

The event page itself lists every session date as `tr.collapsible` rows under each
appointment-series row, so no separate appointment page is fetched.
"""
from __future__ import annotations

import re
from datetime import date, datetime

from bs4 import BeautifulSoup, Tag

from .models import Session, Slot
from .util import clean

_DAYS = {"Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"}
_DATE_RE = re.compile(r"(\d{1,2})/(\d{1,2})/(\d{4})")
_TIME_RE = re.compile(r"(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)", re.I)


def us_date(text: str) -> str | None:
    m = _DATE_RE.search(text or "")
    return date(int(m.group(3)), int(m.group(1)), int(m.group(2))).isoformat() if m else None


def to_24h(text: str) -> str:
    return datetime.strptime(clean(text).upper().replace(" ", ""), "%I:%M%p").strftime("%H:%M")


def _is_cancelled(tag: Tag) -> bool:
    for el in [tag, *tag.find_all(True)]:
        if any("failure" in c.lower() or "cancel" in c.lower() for c in el.get("class", [])):
            return True
    return tag.find(["del", "s", "strike"]) is not None


def _columns(table: Tag) -> dict[str, int]:
    head = table.find("tbody", class_="tablehead") or table
    cells = head.find("tr").find_all(["th", "td"])
    return {clean(c.get_text()).lower(): i for i, c in enumerate(cells) if clean(c.get_text())}


def parse_appointments(html: str | BeautifulSoup) -> tuple[list[Slot], list[Session]]:
    soup = html if isinstance(html, BeautifulSoup) else BeautifulSoup(html, "lxml")
    table = soup.find("table", id="APPLIST")
    if table is None:
        return [], []
    cols = _columns(table)
    body = table.find("tbody", class_="tablecontent") or table

    slots: list[Slot] = []
    sessions: list[Session] = []
    current: Slot | None = None
    for tr in body.find_all("tr", recursive=False):
        cells = tr.find_all("td", recursive=False)
        if "collapsible" in tr.get("class", []):
            d = us_date(tr.get_text())
            if current and d and current.start:
                sessions.append(Session(d, current.start, current.end, current.room, _is_cancelled(tr), len(slots) - 1))
            continue

        def cell(name: str) -> str:
            i = cols.get(name)
            return clean(cells[i].get_text(" ")) if i is not None and i < len(cells) else ""

        when = cell("date")
        day_part, _, rest = when.partition(",")
        day = day_part.strip() if day_part.strip() in _DAYS else None
        rest = rest.strip()
        single_date = us_date(rest)
        rhythm = "single" if single_date else (rest.lower() or "block")
        m = _TIME_RE.search(cell("time"))
        start, end = (to_24h(m.group(1)), to_24h(m.group(2))) if m else (None, None)
        badge = cells[-1].get_text().strip() if cells else ""
        current = Slot(
            day=day, start=start, end=end, room=cell("room") or None, rhythm=rhythm,
            first_date=single_date or us_date(cell("start")),
            count=int(badge) if badge.isdigit() else None,
        )
        slots.append(current)
        if single_date and start:
            sessions.append(Session(single_date, start, end, current.room, _is_cancelled(tr), len(slots) - 1))
    return slots, sessions


def parse_sessions(html: str) -> list[Session]:
    return parse_appointments(html)[1]
