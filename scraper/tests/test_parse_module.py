from conftest import fixture

from kit_scraper.models import Brick
from kit_scraper.parse_module import module_description_page, parse_module


def test_visual_computing_module():
    m = parse_module(fixture("module.html"), fixture("module_description.html"), "u")
    assert (m.id, m.title, m.ects, m.recurrence) == \
           ("M-INFO-101567", "Practical Course: Visual Computing", 6.0, "Each term")
    assert (m.assignment, m.part, m.language, m.level) == ("Compulsory elective", "Elective Studies", "English", "4")
    assert m.fields == ["Elective Studies in Informatics"]
    assert m.bricks == [Brick("T-INFO-103000", "Practical Course: Visual Computing", 6.0)]
    assert m.description.exam
    assert m.description.objectives.startswith("In this course, practical problems")
    assert m.description.content.startswith("The practical course deals")
    assert m.description.workload.startswith("Attendance time")
    assert m.kit_url == "u"


def test_module_without_description():
    assert parse_module(fixture("module.html"), None, "u").description.exam is None


def test_description_tab_link():
    p = module_description_page(fixture("module.html"))
    assert p.startswith("abstractModuleView.asp?gguid=0x14CC2798E558E54E9011EF8375B7567B")
    assert "view=details" in p and "tguid" not in p
