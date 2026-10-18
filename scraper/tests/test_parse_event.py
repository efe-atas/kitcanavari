from conftest import fixture

from kit_scraper.models import Slot
from kit_scraper.parse_event import parse_event

GPU = "0x020D8FDB8FA84510A69499DAC43719B5"


def test_gpu_computing_event():
    pe = parse_event(fixture("event.html"), GPU)
    e = pe.event
    assert (e.number, e.title, e.language, e.sws, e.type_code, e.format) == \
           ("2424283", "Practical course GPU-Computing", "English", 4.0, "P", "On-Site")
    assert e.type == "Practical course (P)"
    assert e.slots == [Slot("Tue", "14:00", "15:30", "50.34 Raum 148", "weekly", "2026-10-27", 15)]
    assert [l.name for l in e.lecturers] == ["Dmitrii Klepikov", "Nathan Lerzer", "Prof. Dr.-Ing. Carsten Dachsbacher"]
    assert e.lecturers[0].unit.startswith("KIT Department of Informatics")
    assert e.catalog_paths == [["1. Informatik Lehrveranstaltungen", "1.7 Practical Courses"]]
    assert e.content_text.startswith("Beim GPU-Computing")
    assert "\n\n" in e.content_text
    assert e.ilias_url.startswith("https://ilias.studium.kit.edu/")
    assert e.kit_url.endswith("event.asp?gguid=" + GPU + "&tguid=0xD25DBD9C86874091993315DA11571AAF")
    assert pe.in_spo and e.module_ids == ["M-INFO-101567"]
    assert pe.module_pages["M-INFO-101567"].startswith("abstractModuleView.asp?gguid=0x14CC2798E558E54E9011EF8375B7567B")
    assert pe.sessions_page is None
    assert len(e.sessions) == 15


def test_lecture_has_multiple_slots():
    e = parse_event(fixture("event_lecture.html"), "x").event
    assert e.number == "2400010" and e.type_code == "VÜ"
    assert e.slots[0] == Slot("Tue", "14:00", "15:30", "10.11 Hertz-Hörsaal", "weekly", "2026-10-27", 15)
    assert e.slots[1] == Slot("Fri", "09:45", "11:15", "40.50 Engler-Bunte-Hörsaal", "weekly", "2026-10-30", 15)
    assert e.slots[2] == Slot("Fri", "09:00", "17:00", "50.34 Raum 252", "single", "2026-10-16", None)


def test_event_without_slots():
    pe = parse_event(fixture("event_block.html"), "x")
    assert pe.event.slots == [] and pe.event.sessions == []
    assert pe.event.title and pe.event.number
    assert pe.in_spo is False
