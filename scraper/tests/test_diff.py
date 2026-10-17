from dataclasses import replace

from kit_scraper.diff import diff, prune
from kit_scraper.fingerprint import fingerprint
from kit_scraper.models import Change, Event, Lecturer, Session, Slot

AT = "2026-10-20T04:00:00Z"
BASE_SLOT = Slot("Tue", "14:00", "15:30", "50.34 Raum 148", "weekly", "2026-10-27", 15)


def make_event(**overrides) -> Event:
    base = dict(id="a", number="2424283", title="GPU", type="Practical course (P)", type_code="P",
                language="English", sws=4.0, format="On-Site", content_text="text", ilias_url=None,
                kit_url="u", catalog_paths=[["1."]], lecturers=[Lecturer("Dachsbacher", "IVD")],
                slots=[BASE_SLOT], sessions=[], module_ids=["M-INFO-101567"])
    base.update(overrides)
    return Event(**base)


def kinds(old, new):
    return [c.kind for c in diff(old, new, AT)]


def test_identical_produces_nothing():
    assert diff({"a": make_event()}, {"a": make_event()}, AT) == []


def test_added_and_removed():
    assert kinds({}, {"a": make_event()}) == ["added"]
    assert kinds({"a": make_event()}, {}) == ["removed"]
    c = diff({}, {"a": make_event()}, AT)[0]
    assert (c.at, c.event_id, c.event_title) == (AT, "a", "GPU")


def test_room_only_change():
    old = {"a": make_event()}
    new = {"a": make_event(slots=[replace(BASE_SLOT, room="50.34 Raum 131")])}
    [c] = diff(old, new, AT)
    assert c.kind == "room_changed" and "50.34 Raum 131" in c.summary and "50.34 Raum 148" in c.summary


def test_slot_time_change():
    new = {"a": make_event(slots=[replace(BASE_SLOT, day="Wed", start="10:00", end="11:30")])}
    [c] = diff({"a": make_event()}, new, AT)
    assert c.kind == "slot_changed" and c.summary == "Tue 14:00–15:30 → Wed 10:00–11:30"


def test_slot_count_change_is_slot_changed():
    new = {"a": make_event(slots=[BASE_SLOT, replace(BASE_SLOT, day="Fri")])}
    assert kinds({"a": make_event()}, new) == ["slot_changed"]


def test_cancelled_session():
    new = {"a": make_event(sessions=[Session("2026-11-12", "14:00", "15:30", None, True)])}
    old = {"a": make_event(sessions=[Session("2026-11-12", "14:00", "15:30", None, False)])}
    [c] = diff(old, new, AT)
    assert c.kind == "session_cancelled" and c.summary == "Session 2026-11-12 14:00 cancelled"


def test_session_added_and_removed():
    s1 = Session("2026-11-12", "14:00", "15:30", None, False)
    s2 = Session("2026-11-19", "14:00", "15:30", None, False)
    assert kinds({"a": make_event(sessions=[s1])}, {"a": make_event(sessions=[s1, s2])}) == ["session_added"]
    assert kinds({"a": make_event(sessions=[s1, s2])}, {"a": make_event(sessions=[s1])}) == ["session_removed"]


def test_content_lecturers_modules_changed():
    assert kinds({"a": make_event()}, {"a": make_event(content_text="new")}) == ["content_changed"]
    assert kinds({"a": make_event()}, {"a": make_event(lecturers=[Lecturer("X", "Y")])}) == ["lecturers_changed"]
    assert kinds({"a": make_event()}, {"a": make_event(module_ids=["M-INFO-1"])}) == ["modules_changed"]


def test_order_is_deterministic():
    old = {"b": make_event(id="b"), "a": make_event()}
    new = {"a": make_event(content_text="new", module_ids=[]), "c": make_event(id="c")}
    assert [(c.event_id, c.kind) for c in diff(old, new, AT)] == \
           [("a", "content_changed"), ("a", "modules_changed"), ("b", "removed"), ("c", "added")]


def test_fingerprint_ignores_content_but_not_room():
    assert fingerprint(make_event()) == fingerprint(make_event(content_text="other"))
    assert fingerprint(make_event()) != fingerprint(make_event(slots=[replace(BASE_SLOT, room="X")]))
    assert len(fingerprint(make_event())) == 16


def test_prune_drops_old_entries():
    old = Change("2026-07-21T04:00:00Z", "a", "GPU", "added", "Added")   # 91 days before
    keep = Change("2026-07-23T04:00:00Z", "a", "GPU", "added", "Added")  # 89 days before
    assert prune([keep, old], "2026-10-20T04:00:00Z") == [keep]
