"""Degree-program structure pages → the minor fields, their modules and this term's events of a module.

Minor modules are taught by other departments, so their events are not in the Informatics catalog tree;
they are reached through the program (abstractProductView) → field (abstractFieldView) → module pages.
"""
from __future__ import annotations

import re

from bs4 import BeautifulSoup

from .util import cascampus_path, clean, gguid, table_after_caption

_MODULE_ID_RE = re.compile(r"^M-[A-Z]+-\d+$")


def minor_fields(html: str) -> list[tuple[str, str, str]]:
    """(gguid, title, path) of every "Minor Studies: …" field of the program, in page order."""
    out: list[tuple[str, str, str]] = []
    for a in BeautifulSoup(html, "lxml").find_all("a", href=re.compile(r"abstractFieldView\.asp")):
        title = clean(a.get_text(" "))
        gid = gguid(a["href"])
        if title.startswith("Minor Studies:") and gid and all(g != gid for g, _, _ in out):
            out.append((gid, title, cascampus_path(a["href"])))
    return out


def field_modules(html: str) -> dict[str, str]:
    """Module id → module page path for the modules listed on a field page."""
    out: dict[str, str] = {}
    for a in BeautifulSoup(html, "lxml").find_all("a", href=re.compile(r"abstractModuleView\.asp")):
        mid = clean(a.get_text(" "))
        if _MODULE_ID_RE.match(mid):
            out.setdefault(mid, cascampus_path(a["href"]))
    return out


def module_events(html: str) -> list[str]:
    """Event ids from the module page's "Events (term)" table; the page has none when the module is not offered."""
    table = table_after_caption(BeautifulSoup(html, "lxml"), "Events")
    out: list[str] = []
    for a in table.find_all("a", href=re.compile(r"event\.asp\?")) if table else []:
        eid = gguid(a["href"])
        if eid and eid not in out:
            out.append(eid)
    return out
