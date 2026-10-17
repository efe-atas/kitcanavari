from kit_scraper.models import Change, Event, Lecturer, Slot


def test_event_to_json_dict_uses_camel_case():
    e = Event(id="0x1", number="2424283", title="T", type="Practical course (P)", type_code="P",
              language="English", sws=4, format="On-Site", content_text="c", ilias_url=None,
              kit_url="u", catalog_paths=[["1. Informatik Lehrveranstaltungen", "1.7 Practical Courses"]],
              lecturers=[Lecturer("A", "B")],
              slots=[Slot("Tue", "14:00", "15:30", "50.34 Raum 148", "weekly", "2026-10-27", 15)],
              sessions=[], module_ids=["M-INFO-101567"])
    d = e.to_json_dict()
    assert d["typeCode"] == "P" and d["contentText"] == "c" and d["iliasUrl"] is None
    assert d["slots"][0]["firstDate"] == "2026-10-27"
    assert d["moduleIds"] == ["M-INFO-101567"]
    assert Event.from_json_dict(d) == e


def test_change_omits_empty_before_after():
    c = Change(at="2026-10-18T04:00:00Z", event_id="0x1", event_title="T", kind="added", summary="Added")
    assert "before" not in c.to_json_dict()
