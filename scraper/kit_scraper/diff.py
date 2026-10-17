"""Compare two scrapes and describe what changed per event."""
from __future__ import annotations

from datetime import datetime, timedelta

from .models import Change, Event, Session, Slot


def _when(s: Slot) -> str:
    if not s.day:
        return s.rhythm
    return f"{s.day} {s.start}–{s.end}"


def _slot_key(s: Slot) -> tuple:
    return (s.day or "", s.start or "", s.first_date or "")


def _slot_changes(old: Event, new: Event, at: str) -> list[Change]:
    a, b = sorted(old.slots, key=_slot_key), sorted(new.slots, key=_slot_key)
    timing = lambda s: (s.day, s.start, s.end, s.rhythm)  # noqa: E731
    mk = lambda kind, summary: Change(at, new.id, new.title, kind, summary)  # noqa: E731

    if len(a) != len(b) or any(timing(x) != timing(y) for x, y in zip(a, b)):
        summary = ", ".join(map(_when, a)) or "—"
        summary += " → " + (", ".join(map(_when, b)) or "—")
        return [mk("slot_changed", summary)]
    rooms = [(x, y) for x, y in zip(a, b) if x.room != y.room]
    if rooms:
        summary = "; ".join(f"Room {x.room or '—'} → {y.room or '—'}" for x, y in rooms)
        return [mk("room_changed", summary)]
    return []


def _session_changes(old: Event, new: Event, at: str) -> list[Change]:
    key = lambda s: (s.date, s.start)  # noqa: E731
    a: dict[tuple, Session] = {key(s): s for s in old.sessions}
    b: dict[tuple, Session] = {key(s): s for s in new.sessions}
    out = []
    for k in sorted(a.keys() | b.keys()):
        label = f"Session {k[0]} {k[1]}"
        if k not in a:
            out.append(Change(at, new.id, new.title, "session_added", f"{label} added"))
        elif k not in b:
            out.append(Change(at, new.id, new.title, "session_removed", f"{label} removed"))
        elif b[k].cancelled and not a[k].cancelled:
            out.append(Change(at, new.id, new.title, "session_cancelled", f"{label} cancelled"))
    return out


def _event_changes(old: Event, new: Event, at: str) -> list[Change]:
    out = _slot_changes(old, new, at) + _session_changes(old, new, at)
    if old.content_text != new.content_text:
        out.append(Change(at, new.id, new.title, "content_changed", "Description updated"))
    old_names, new_names = [l.name for l in old.lecturers], [l.name for l in new.lecturers]
    if old_names != new_names:
        out.append(Change(at, new.id, new.title, "lecturers_changed",
                          f"Lecturers: {', '.join(old_names) or '—'} → {', '.join(new_names) or '—'}",
                          before=old_names, after=new_names))
    if old.module_ids != new.module_ids:
        out.append(Change(at, new.id, new.title, "modules_changed",
                          f"Modules: {', '.join(old.module_ids) or '—'} → {', '.join(new.module_ids) or '—'}",
                          before=old.module_ids, after=new.module_ids))
    return sorted(out, key=lambda c: c.kind)


def diff(old: dict[str, Event], new: dict[str, Event], at: str) -> list[Change]:
    out: list[Change] = []
    for eid in sorted(old.keys() | new.keys()):
        if eid not in old:
            out.append(Change(at, eid, new[eid].title, "added", f"Added: {new[eid].number} {new[eid].title}"))
        elif eid not in new:
            out.append(Change(at, eid, old[eid].title, "removed", f"Removed: {old[eid].number} {old[eid].title}"))
        else:
            out.extend(_event_changes(old[eid], new[eid], at))
    return out


def _parse(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


def prune(entries: list[Change], now: str, days: int = 90) -> list[Change]:
    cutoff = _parse(now) - timedelta(days=days)
    return [c for c in entries if _parse(c.at) >= cutoff]
