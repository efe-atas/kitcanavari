"""Field (course catalog node) page → sidebar tree rows + listed event ids."""
from __future__ import annotations

import re
from dataclasses import dataclass

from bs4 import BeautifulSoup

from .util import clean, gguid

_ITEMS_RE = re.compile(r"Items\s+(\d+)\s*-\s*(\d+)\s+of\s+(\d+)")
_TITLE_RE = re.compile(r"Course catalog:\s*(.+?)\s*\([^()]*\)\s*$")


@dataclass
class FieldRow:
    id: str
    title: str
    depth: int
    count: int | None


@dataclass
class FieldPage:
    field_id: str
    title: str
    tree_rows: list[FieldRow]
    event_ids: list[str]
    total_count: int
    listed_count: int


def parse_field(html: str) -> FieldPage:
    soup = BeautifulSoup(html, "lxml")

    view_link = soup.find("a", href=re.compile(r"field\.asp\?gguid=0x[0-9A-F]+&(amp;)?view=list"))
    field_id = gguid(view_link["href"]) if view_link else ""

    heading = soup.find(string=_TITLE_RE)
    title = clean(_TITLE_RE.search(clean(heading)).group(1)) if heading else ""

    rows = []
    for tr in soup.find_all("tr", class_=re.compile(r"^hierarchy\d+$")):
        depth = int(next(c for c in tr["class"] if c.startswith("hierarchy"))[len("hierarchy"):])
        link = tr.find("a")
        badge = tr.find("span", class_="badge")
        rows.append(FieldRow(
            id=tr.get("id", ""),
            # The current/expandable node has no link; its title sits in td.title.
            title=clean((link or tr.find("td", class_="title") or tr).get_text(" ")),
            depth=depth,
            count=int(badge.get_text()) if badge and badge.get_text().strip().isdigit() else None,
        ))

    event_ids: list[str] = []
    for a in soup.find_all("a", href=re.compile(r"event\.asp\?gguid=")):
        if a.find_parent("tr", class_=re.compile(r"hierarchy")):
            continue
        eid = gguid(a["href"])
        if eid and eid not in event_ids:
            event_ids.append(eid)

    m = _ITEMS_RE.search(clean(soup.get_text(" ")))
    total, listed = (int(m.group(3)), int(m.group(2)) - int(m.group(1)) + 1) if m else (0, 0)

    return FieldPage(field_id, title, rows, event_ids, total, listed)
