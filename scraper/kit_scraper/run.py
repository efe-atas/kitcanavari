"""Crawl the catalog, apply safety thresholds, write data/courses.json + data/changes.json.

    python -m kit_scraper.run --out ../data [--limit N] [--root 0x…]
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

from .diff import diff, prune
from .fetch import Fetcher, FetchError
from .fingerprint import fingerprint
from .models import KIT_BASE, SPO, TERM, TERM_GUID, Change, Event, FieldNode, Module
from .parse_event import parse_event
from .parse_field import FieldRow, parse_field
from .parse_module import module_description_page, parse_module

DEPARTMENT_ROOT = "0x94CCACA48C644F43B4A6B70586D36CA5"
MAX_FAILED_RATIO = 0.10
MAX_COUNT_DROP = 0.30


@dataclass
class CrawlResult:
    data: dict
    warnings: list[str] = field(default_factory=list)
    failed: int = 0
    attempted: int = 0
    field_failures: int = 0


def _subtree(rows: list[FieldRow], root: str) -> FieldNode | None:
    """Rebuild the nested tree below `root` from the flat sidebar rows (ordered, with depths)."""
    idx = next((i for i, r in enumerate(rows) if r.id == root), None)
    if idx is None:
        return None
    top = FieldNode(root, rows[idx].title)
    stack: list[tuple[int, FieldNode]] = [(rows[idx].depth, top)]
    for r in rows[idx + 1:]:
        if r.depth <= rows[idx].depth:
            break
        while stack[-1][0] >= r.depth:
            stack.pop()
        node = FieldNode(r.id, r.title)
        stack[-1][1].children.append(node)
        stack.append((r.depth, node))
    return top


def _walk(node: FieldNode):
    yield node
    for c in node.children:
        yield from _walk(c)


def _prune_tree(node: FieldNode, keep: set[str]) -> FieldNode | None:
    children = [c for c in (_prune_tree(c, keep) for c in node.children) if c]
    ids = [e for e in node.event_ids if e in keep]
    if not children and not ids:
        return None
    return FieldNode(node.id, node.title, children, ids)


def _previous_field_events(previous: dict | None) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}

    def walk(nodes: list[dict]) -> None:
        for n in nodes:
            out[n["id"]] = n.get("eventIds", [])
            walk(n.get("children", []))

    walk((previous or {}).get("tree", []))
    return out


def crawl(fetcher, roots: list[str], previous: dict | None, now: str, limit: int | None = None) -> CrawlResult:
    res = CrawlResult(data={})
    prev_events = (previous or {}).get("events", {})
    prev_modules = (previous or {}).get("modules", {})
    prev_fields = _previous_field_events(previous)

    trees: list[FieldNode] = []
    for root in roots:
        root_page = parse_field(fetcher.get_field(f"field.asp?gguid={root}"))
        tree = _subtree(root_page.tree_rows, root) or FieldNode(root, root_page.title)
        trees.append(tree)
        for node in _walk(tree):
            complete = True
            try:
                page = root_page if node.id == root else parse_field(fetcher.get_field(f"field.asp?gguid={node.id}"))
                node.event_ids = page.event_ids
                if page.listed_count < page.total_count:
                    res.warnings.append(f"field {node.id}: listed {page.listed_count} of {page.total_count}")
                    complete = False
            except Exception as e:  # noqa: BLE001 - one bad field must not kill the run
                res.warnings.append(f"field {node.id}: {e}")
                complete = False
            if not complete:
                # Never let a broken field page silently drop its events: reuse last run's list or abort.
                if node.id in prev_fields:
                    node.event_ids += [e for e in prev_fields[node.id] if e not in node.event_ids]
                else:
                    res.field_failures += 1

    order: list[str] = []
    for tree in trees:
        for node in _walk(tree):
            order += [e for e in node.event_ids if e not in order]
    if limit is not None:
        order = order[:limit]

    events: dict[str, Event] = {}
    module_pages: dict[str, str] = {}
    for eid in order:
        res.attempted += 1
        try:
            parsed = parse_event(fetcher.get(f"event.asp?gguid={eid}"), eid)
        except Exception as e:  # noqa: BLE001 - count, keep previous version, go on
            res.failed += 1
            if eid in prev_events:
                events[eid] = Event.from_json_dict(prev_events[eid])
                res.warnings.append(f"event {eid}: failed, kept previous version ({e})")
            else:
                res.warnings.append(f"event {eid}: failed ({e})")
            continue
        if not parsed.in_spo:
            continue
        events[eid] = parsed.event
        for mid, path in parsed.module_pages.items():
            module_pages.setdefault(mid, path)

    needed = {mid for e in events.values() for mid in e.module_ids}
    modules: dict[str, Module] = {}
    for mid in sorted(needed):
        path = module_pages.get(mid)
        try:
            if path is None:
                raise FetchError("no module link")
            html = fetcher.get(path)
            desc_path = module_description_page(html)
            desc = None
            if desc_path:
                try:
                    desc = fetcher.get(desc_path)
                except Exception as e:  # noqa: BLE001
                    res.warnings.append(f"module {mid}: description failed ({e})")
            modules[mid] = parse_module(html, desc, KIT_BASE + path)
        except Exception as e:  # noqa: BLE001
            if mid in prev_modules:
                modules[mid] = Module.from_json_dict(prev_modules[mid])
            res.warnings.append(f"module {mid}: fetch failed ({e})")

    for e in events.values():
        e.fingerprint = fingerprint(e)

    keep = set(events)
    out_tree = [n for t in trees for c in t.children if (n := _prune_tree(c, keep))]
    res.data = {
        "meta": {"scrapedAt": now, "term": TERM, "termGuid": TERM_GUID, "spo": SPO, "warnings": res.warnings},
        "tree": [n.to_json_dict() for n in out_tree],
        "events": {k: events[k].to_json_dict() for k in sorted(events)},
        "modules": {k: modules[k].to_json_dict() for k in sorted(modules)},
    }
    return res


def check_thresholds(new: dict, previous: dict | None, failed: int, attempted: int, field_failures: int = 0) -> str | None:
    if field_failures:
        return f"{field_failures} field page(s) failed or were incomplete and no previous data exists"
    if attempted and failed / attempted > MAX_FAILED_RATIO:
        return f"too many failed events: {failed}/{attempted}"
    events = new.get("events", {})
    bad = [k for k, e in events.items() if not e.get("number") or not e.get("title")]
    if bad:
        return f"events missing number/title: {', '.join(bad[:5])}"
    prev_count = len((previous or {}).get("events", {}))
    if prev_count and len(events) < prev_count * (1 - MAX_COUNT_DROP):
        return f"event count drop: {prev_count} → {len(events)}"
    if attempted == 0 or not events:
        return "no events found"
    return None


def _read(path: Path) -> dict | None:
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None


def _write(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")


def main(argv: list[str] | None = None, fetcher_factory: Callable = Fetcher, now: str | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--limit", type=int)
    ap.add_argument("--root", action="append")
    args = ap.parse_args(argv)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    now = now or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    previous = _read(out / "courses.json")
    fetcher = fetcher_factory()
    with fetcher if hasattr(fetcher, "__enter__") else _null(fetcher) as f:
        res = crawl(f, args.root or [DEPARTMENT_ROOT], previous, now, args.limit)

    for w in res.warnings:
        print("warning:", w, file=sys.stderr)
    reason = None if args.limit else check_thresholds(res.data, previous, res.failed, res.attempted, res.field_failures)
    if reason:
        print(f"aborting, nothing written: {reason}", file=sys.stderr)
        return 2

    old = {k: Event.from_json_dict(v) for k, v in (previous or {}).get("events", {}).items()}
    new = {k: Event.from_json_dict(v) for k, v in res.data["events"].items()}
    old_changes = [Change.from_json_dict(c) for c in (_read(out / "changes.json") or {}).get("entries", [])]
    changes = prune(diff(old, new, now) + old_changes, now) if previous else prune(diff({}, new, now), now)

    _write(out / "courses.json", res.data)
    _write(out / "changes.json", {"entries": [c.to_json_dict() for c in changes]})
    print(f"ok: {len(new)} events, {len(res.data['modules'])} modules, {len(changes)} change entries")
    return 0


class _null:
    def __init__(self, obj):
        self.obj = obj

    def __enter__(self):
        return self.obj

    def __exit__(self, *exc):
        return False


if __name__ == "__main__":
    sys.exit(main())
