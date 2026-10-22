import json
import re
import shutil
from collections import Counter
from pathlib import Path

import pytest
from conftest import fixture

from kit_scraper import parse_handbook
from kit_scraper.parse_handbook import parse_handbook_text, pdf_to_text

PDF = Path(__file__).parents[2] / "kit_docs" / "module_handbook.pdf"


def parse():
    return parse_handbook_text(fixture("handbook_excerpt.txt"))


def test_modules_stop_at_components():
    assert list(parse()["modules"]) == ["M-INFO-106303", "M-INFO-105623", "M-INFO-100850", "M-INFO-107897"]


def test_as_of():
    assert parse()["meta"]["asOf"] == "2026-09-09"


def test_wrapped_title_and_id():
    m = parse()["modules"]["M-INFO-106303"]
    assert m["title"] == "Access Control Systems: Models and Technology"
    assert (m["ects"], m["recurrence"], m["language"], m["level"]) == (5.0, "summer", "English", 4)
    assert m["fields"] == ["Area of Specialization: Cryptography and Security",
                           "Area of Specialization: Telematics", "Elective Studies in Informatics"]
    assert m["coordinators"] == ["Prof. Dr. Hannes Hartenstein"]


def test_rl_bricks_and_sections():
    m = parse()["modules"]["M-INFO-105623"]
    assert m["recurrence"] == "winter" and m["ects"] == 6.0
    assert m["coordinators"] == ["TT-Prof. Dr. Rudolf Lioutikov", "Prof. Dr. Gerhard Neumann"]
    assert m["bricks"] == [{"id": "T-INFO-111255", "title": "Reinforcement Learning", "ects": 6.0, "term": "WT"}]
    assert m["competenceGoals"].startswith("- Students are able to understand the RL problem")
    assert "Meta Reinforcement Learning" in m["content"]
    assert m["prerequisites"] is None


def test_page_break_removed():
    rec = parse()["modules"]["M-INFO-105623"]["recommendations"]
    assert "Good Python knowledge" in rec
    assert "Computer Science Master 2025" not in rec and "4 MODULES" not in rec and "188" not in rec


def test_irregular():
    m = parse()["modules"]["M-INFO-100850"]
    assert (m["title"], m["recurrence"], m["ects"]) == ("Reliable Computing I", "irregular", 3.0)


def test_main_writes_json(tmp_path, monkeypatch):
    monkeypatch.setattr(parse_handbook, "pdf_to_text", lambda p: fixture("handbook_excerpt.txt"))
    out = tmp_path / "handbook.json"
    assert parse_handbook.main(["x.pdf", "--out", str(out)], now="2026-10-22T00:00:00Z") == 0
    data = json.loads(out.read_text())
    assert data["meta"]["parsedAt"] == "2026-10-22T00:00:00Z" and len(data["modules"]) == 4


def test_wrapped_field_and_usage_suffix():
    m = parse()["modules"]["M-INFO-107897"]
    assert m["title"] == "Practical Course: Customized Embedded Processor Design"
    assert m["fields"] == ["Area of Specialization: Design of Embedded Systems and Computer Architectures",
                           "Elective Studies in Informatics"]


def test_usage_until_and_prerequisite_for_label():
    text = ("                 4.1 Module: X [M-INFO-1]\n        Coordinators:  Prof. A\n"
            "        Part of:  Area of Specialization: Telematics (Usage until 3/31/2027)\n"
            "                  Elective Studies in Informatics\n"
            "        Prerequisite for:     T-INFO-101287 - Seminar: Hot Topics\n"
            "                              T-INFO-103009 - Practical\n\n       Content\n       C.\n")
    m = parse_handbook_text(text)["modules"]["M-INFO-1"]
    assert m["fields"] == ["Area of Specialization: Telematics", "Elective Studies in Informatics"]
    assert m["coordinators"] == ["Prof. A"]


def test_wrapped_running_header_does_not_leak():
    mods = parse_handbook_text(fixture("handbook_wrapped_header.txt"))["modules"]
    rec = mods["M-INFO-1"]["recommendations"]
    assert rec.endswith("Knowledge of power systems or power electronics is helpful.")
    assert mods["M-MACH-106904"]["title"] == "Practical Course: Software Development and Application of Mobile, Bio-Inspired Robots"


@pytest.mark.parametrize("heading", ["Additional Information", "Module Grade Calculation", "Teaching and Learning Methods",
                                     "Modeled Prerequisites", "Election notes"])
def test_unknown_headings_close_the_section(heading):
    text = ("                 4.1 Module: X [M-INFO-1]\n        Part of:  Elective Studies in Informatics\n\n"
            f"       Content\n       Real content.\n\n       {heading}\n       Admin text.\n")
    assert parse_handbook_text(text)["modules"]["M-INFO-1"]["content"] == "Real content."


@pytest.mark.parametrize("body", ["None", "none", "None.", "See partial archievements (Teilleistung)", "See partial achivements (Teilleitung)", "See module component",
                                  "See partial achievement"])
def test_placeholder_prerequisites_are_none(body):
    text = ("                 4.1 Module: X [M-INFO-1]\n        Part of:  Elective Studies in Informatics\n\n"
            f"       Prerequisites\n       {body}\n\n       Content\n       Real content.\n")
    m = parse_handbook_text(text)["modules"]["M-INFO-1"]
    assert m["prerequisites"] is None and m["content"] == "Real content."


@pytest.mark.skipif(not PDF.exists() or not shutil.which("pdftotext"), reason="handbook PDF not present")
def test_full_handbook_smoke():
    mods = parse_handbook_text(pdf_to_text(PDF))["modules"]
    assert len(mods) == 210
    rec = Counter(m["recurrence"] for m in mods.values())
    assert (rec["winter"], rec["summer"], rec["each"]) == (66, 54, 39)
    assert all(re.fullmatch(r"M-[A-Z]+-\d+", k) and m["title"] and m["ects"] for k, m in mods.items())
