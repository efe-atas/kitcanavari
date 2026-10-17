from conftest import fixture

from kit_scraper.parse_field import parse_field


def test_practical_courses_events():
    p = parse_field(fixture("field_practical.html"))
    assert p.field_id == "0x51515308AECE499594589506DFA75784"
    assert p.title == "1.7 Practical Courses"
    assert p.event_ids[0] == "0x93504EA110CF48EAA2CB5E40F5D33B51"
    assert "0x020D8FDB8FA84510A69499DAC43719B5" in p.event_ids
    assert len(p.event_ids) == len(set(p.event_ids)) == 25


def test_total_count():
    p = parse_field(fixture("field_practical.html"))
    assert (p.total_count, p.listed_count) == (40, 25)


def test_full_listing_counts_match():
    p = parse_field(fixture("field_seminars.html"))
    assert (p.total_count, p.listed_count, len(p.event_ids)) == (33, 33, 33)


def test_root_tree_rows():
    p = parse_field(fixture("field_root.html"))
    rows = {r.id: r for r in p.tree_rows}
    assert rows["0x51515308AECE499594589506DFA75784"].title == "1.7 Practical Courses"
    assert rows["0x51515308AECE499594589506DFA75784"].count == 41
    assert rows["0x51515308AECE499594589506DFA75784"].depth > rows["0x01291EE9E14C46BD916AC325D0EE8CE2"].depth
    assert p.event_ids == [] and p.total_count == 0
