"""Small parsing helpers shared by the page parsers."""
from __future__ import annotations

import re
from urllib.parse import parse_qs, urlparse

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
