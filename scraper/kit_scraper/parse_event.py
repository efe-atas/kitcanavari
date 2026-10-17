"""Event (Veranstaltung) detail page → Event + links to its SPO modules."""
from __future__ import annotations

import re
from dataclasses import dataclass

from bs4 import BeautifulSoup, Tag

from .models import KIT_BASE, SPO, Event, Lecturer
from .parse_sessions import parse_appointments
from .util import cascampus_path, clean

_MODULE_RE = re.compile(r"\b(M-[A-Z]+-\d+)\b")
_ROOT_HEADLINE = "KIT Department of Informatics"


@dataclass
class ParsedEvent:
    event: Event
    in_spo: bool
    module_pages: dict[str, str]
    sessions_page: str | None


def _fields(soup: BeautifulSoup) -> dict[str, Tag]:
    out: dict[str, Tag] = {}
    for f in soup.find_all("div", class_="field"):
        label, element = f.find("div", class_="label"), f.find("div", class_="element")
        if label and element:
            out.setdefault(clean(label.get_text()).rstrip(":"), element)
    return out


def _value(fields: dict[str, Tag], *prefixes: str) -> str | None:
    for key, el in fields.items():
        if any(key.startswith(p) for p in prefixes):
            return clean(el.get_text(" ")) or None
    return None


def _paragraphs(el: Tag | None) -> str:
    if el is None:
        return ""
    blocks = [clean(p.get_text(" ")) for p in el.find_all(["p", "li", "h3", "h4"])]
    blocks = [b for b in blocks if b]
    return "\n\n".join(blocks) if blocks else clean(el.get_text(" "))


def _table_rows(soup: BeautifulSoup, table_id: str) -> list[Tag]:
    table = soup.find("table", id=table_id)
    if table is None:
        return []
    body = table.find("tbody", class_="tablecontent") or table
    return body.find_all("tr", recursive=False)


def parse_event(html: str, event_id: str) -> ParsedEvent:
    soup = BeautifulSoup(html, "lxml")
    fields = _fields(soup)

    type_ = _value(fields, "Event type") or ""
    code = re.search(r"\(([^()]+)\)\s*$", type_)
    sws = _value(fields, "WTH", "SWS")
    content_el = next((el for k, el in fields.items() if k.startswith("Content")), None)
    ilias = soup.find("a", class_="elearning-link")

    lecturers = []
    for tr in _table_rows(soup, "lecturerlist"):
        tds = tr.find_all("td")
        if tds:
            lecturers.append(Lecturer(clean(tds[0].get_text(" ")), clean(tds[1].get_text(" ")) if len(tds) > 1 else ""))

    paths = []
    for tr in _table_rows(soup, "FIELDLIST"):
        parts = [clean(a.get_text()) for a in tr.find_all("a")]
        if parts and parts[0] == _ROOT_HEADLINE:
            parts = parts[1:]
        if parts:
            paths.append(parts)

    in_spo, module_ids, module_pages = False, [], {}
    rows = _table_rows(soup, "PRODUCTLIST")
    for i, tr in enumerate(rows):
        if "folding-close" not in tr.get("class", []) or SPO not in tr.get_text():
            continue
        in_spo = True
        for sub in rows[i + 1:]:
            if "collapsible" not in sub.get("class", []):
                break
            for a in sub.find_all("a", href=re.compile(r"abstractModuleView\.asp")):
                m = _MODULE_RE.search(a.get_text())
                if m and m.group(1) not in module_ids:
                    module_ids.append(m.group(1))
                    module_pages[m.group(1)] = cascampus_path(a["href"])

    slots, sessions = parse_appointments(soup)
    event = Event(
        id=event_id,
        number=_value(fields, "Course number") or "",
        title=_value(fields, "Title") or "",
        type=type_,
        type_code=code.group(1) if code else "",
        language=_value(fields, "Language"),
        sws=float(sws.replace(",", ".")) if sws and re.fullmatch(r"[\d.,]+", sws) else None,
        format=_value(fields, "Event format"),
        content_text=_paragraphs(content_el),
        ilias_url=ilias["href"] if ilias else None,
        kit_url=f"{KIT_BASE}event.asp?gguid={event_id}",
        catalog_paths=paths,
        lecturers=lecturers,
        slots=slots,
        sessions=sessions,
        module_ids=module_ids,
    )
    return ParsedEvent(event, in_spo, module_pages, None)
