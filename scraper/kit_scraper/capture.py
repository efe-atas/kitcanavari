"""Dev tool: save a live catalog page as a test fixture.

    python -m kit_scraper.capture "event.asp?gguid=0x…" tests/fixtures/event.html [--field]
"""
import sys
from pathlib import Path

from .fetch import Fetcher


def main(argv: list[str]) -> None:
    page, out = argv[0], Path(argv[1])
    with Fetcher() as f:
        html = f.get_field(page) if "--field" in argv else f.get(page)
    out.write_text(html, encoding="utf-8")
    print(f"wrote {out} ({len(html)} bytes)")


if __name__ == "__main__":
    main(sys.argv[1:])
