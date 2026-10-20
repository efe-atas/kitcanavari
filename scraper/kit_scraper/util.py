"""Small parsing helpers shared by the page parsers."""
from __future__ import annotations

import re
from urllib.parse import parse_qs, urlparse

from bs4 import BeautifulSoup, Tag

_GGUID_RE = re.compile(r"[?&]gguid=(0x[0-9A-Fa-f]+)")


def clean(text: str | None) -> str:
    """Collapse whitespace (incl. nbsp) to single spaces and strip."""
    return re.sub(r"\s+", " ", (text or "").replace("\xa0", " ")).strip()


def gguid(href: str) -> str:
    m = _GGUID_RE.search(href.replace("&amp;", "&"))
    return m.group(1) if m else ""


def cascampus_path(href: str) -> str:
    """'../../campus/all/abstractModuleView.asp?a=1&tguid=…' → 'abstractModuleView.asp?a=1' (tguid/lang dropped)."""
    url = urlparse(href.replace("&amp;", "&"))
    name = url.path.rsplit("/", 1)[-1]
    query = [(k, v[0]) for k, v in parse_qs(url.query).items() if k not in ("tguid", "lang")]
    return name + ("?" + "&".join(f"{k}={v}" for k, v in query) if query else "")


def table_after_caption(soup: BeautifulSoup, caption: str) -> Tag | None:
    h2 = soup.find("h2", class_="table-caption", string=lambda s: s and clean(s).startswith(caption))
    return h2.find_next("table") if h2 else None


def label_fields(soup: BeautifulSoup) -> dict[str, Tag]:
    out: dict[str, Tag] = {}
    for f in soup.find_all("div", class_="field"):
        label, element = f.find("div", class_="label"), f.find("div", class_="element")
        if label and element:
            out.setdefault(clean(label.get_text()).rstrip(":"), element)
    return out


def label_value(fields: dict[str, Tag], *prefixes: str) -> str | None:
    for key, el in fields.items():
        if any(key.startswith(p) for p in prefixes):
            return clean(el.get_text(" ")) or None
    return None


def paragraphs(el: Tag | None) -> str:
    if el is None:
        return ""
    blocks = [clean(p.get_text(" ")) for p in el.find_all(["p", "li", "h3", "h4"])]
    blocks = [b for b in blocks if b]
    return "\n\n".join(blocks) if blocks else clean(el.get_text(" "))
