"""Module page (+ its "Module description" tab) → Module."""
from __future__ import annotations

import re

from bs4 import BeautifulSoup, Tag

from .models import Brick, Module, ModuleDescription
from .util import cascampus_path, clean, label_fields, label_value, paragraphs

_BRICK_RE = re.compile(r"^T-[A-Z]+-\d+$")
_NUM_RE = re.compile(r"^\d+(?:[.,]\d+)?$")

_DESCRIPTION_LABELS = {
    "objectives": ("Competence goal", "Learning objectives", "Qualifikationsziele", "Lernziele"),
    "content": ("Content", "Inhalt"),
    "prerequisites": ("Prerequisites", "Voraussetzungen"),
    "exam": ("Assessment", "Competence Certificate", "Erfolgskontrolle"),
    "workload": ("Effort", "Workload", "Arbeitsaufwand"),
}


def _number(text: str | None) -> float | None:
    text = clean(text)
    return float(text.replace(",", ".")) if _NUM_RE.match(text) else None


def _table_after_caption(soup: BeautifulSoup, caption: str) -> Tag | None:
    h2 = soup.find("h2", class_="table-caption", string=lambda s: s and clean(s).startswith(caption))
    return h2.find_next("table") if h2 else None


def module_description_page(html: str) -> str | None:
    a = BeautifulSoup(html, "lxml").find("a", id="tab-details")
    return cascampus_path(a["href"]) if a and a.get("href") else None


def parse_module(html: str, description_html: str | None, kit_url: str) -> Module:
    soup = BeautifulSoup(html, "lxml")
    fields = label_fields(soup)

    bricks = []
    table = _table_after_caption(soup, "Bricks")
    for tr in table.find_all("tr") if table else []:
        cells = [clean(td.get_text(" ")) for td in tr.find_all("td")]
        idx = next((i for i, c in enumerate(cells) if _BRICK_RE.match(c)), None)
        if idx is not None:
            bricks.append(Brick(cells[idx], cells[idx + 1] if idx + 1 < len(cells) else "", _number(cells[-1])))

    field_titles = []
    table = _table_after_caption(soup, "Fields")
    body = table.find("tbody", class_="tablecontent") if table else None
    for tr in body.find_all("tr") if body else []:
        title = clean(tr.get_text(" "))
        if title and title not in field_titles:
            field_titles.append(title)

    description = ModuleDescription()
    if description_html:
        dfields = label_fields(BeautifulSoup(description_html, "lxml"))
        for attr, labels in _DESCRIPTION_LABELS.items():
            el = next((e for k, e in dfields.items() if k.startswith(labels)), None)
            setattr(description, attr, paragraphs(el) or None)

    return Module(
        id=label_value(fields, "Identifier") or "",
        title=label_value(fields, "Title") or "",
        ects=_number(label_value(fields, "Credit points")),
        recurrence=label_value(fields, "Recurrence"),
        language=label_value(fields, "Language"),
        level=label_value(fields, "Level"),
        assignment=label_value(fields, "Assignment type"),
        part=label_value(fields, "Compulsory-elective part"),
        fields=field_titles,
        bricks=bricks,
        description=description,
        kit_url=kit_url,
    )
