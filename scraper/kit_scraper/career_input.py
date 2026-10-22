"""Short per-module text for hand curation of career skill scores (spec §1). Prints text only; never scores."""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

GOALS_MAX = 500
CONTENT_MAX = 600
_PREFIXES = ("Area of Specialization: ", "Minor Studies: ")


def _flat(text: str | None, limit: int) -> str:
    return re.sub(r"\s+", " ", text or "").strip()[:limit]


def _fields(fields: list[str]) -> str:
    out = []
    for f in fields:
        for p in _PREFIXES:
            if f.startswith(p):
                f = f[len(p):]
        out.append(f)
    return ", ".join(out)


def _read(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def lines(data: Path, skip_scored: bool) -> list[str]:
    handbook = _read(data / "handbook.json").get("modules", {})
    catalog = _read(data / "courses.json").get("modules", {})
    scored = set(_read(data / "career" / "skills.json").get("modules", {})) if skip_scored else set()
    out = []
    for mid in sorted(set(handbook) | set(catalog)):
        if mid in scored:
            continue
        hb = handbook.get(mid)
        m = catalog.get(mid, {})
        desc = m.get("description") or {}
        title = (hb or m).get("title", "")
        ects = (hb or m).get("ects")
        goals = hb.get("competenceGoals") if hb else desc.get("objectives")
        content = hb.get("content") if hb else desc.get("content")
        out.append(" | ".join([mid, title, f"{ects:g} ECTS" if ects is not None else "? ECTS",
                               _fields((hb or m).get("fields", [])), _flat(goals, GOALS_MAX), _flat(content, CONTENT_MAX)]))
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("data", help="the data/ directory")
    ap.add_argument("--out", required=True)
    ap.add_argument("--all", action="store_true", help="include modules that already have scores")
    args = ap.parse_args(argv)
    rows = lines(Path(args.data), skip_scored=not args.all)
    Path(args.out).write_text("".join(r + "\n" for r in rows), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
