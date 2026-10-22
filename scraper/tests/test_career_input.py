import json

from kit_scraper import career_input


def _data(tmp_path, skills=None):
    hb = {"meta": {}, "modules": {
        "M-A": {"id": "M-A", "title": "Alpha", "ects": 6.0, "fields": ["Area of Specialization: Telematics"],
                "competenceGoals": "G" * 900, "content": "Line one.\n\nLine two.", "recommendations": None},
        "M-B": {"id": "M-B", "title": "Beta", "ects": 3.0, "fields": [], "competenceGoals": None, "content": None},
    }}
    courses = {"modules": {"M-B": {"id": "M-B", "title": "Beta"}, "M-C": {
        "id": "M-C", "title": "Gamma", "ects": 4.0, "fields": ["Elective Studies in Informatics"],
        "description": {"objectives": "Obj.", "content": "Cont."}}}}
    (tmp_path / "handbook.json").write_text(json.dumps(hb))
    (tmp_path / "courses.json").write_text(json.dumps(courses))
    if skills is not None:
        (tmp_path / "career").mkdir()
        (tmp_path / "career" / "skills.json").write_text(json.dumps({"meta": {}, "modules": skills}))
    return tmp_path


def test_lists_handbook_and_catalog_only_modules(tmp_path):
    lines = career_input.lines(_data(tmp_path), skip_scored=False)
    assert [l.split(" | ")[0] for l in lines] == ["M-A", "M-B", "M-C"]
    a = lines[0]
    assert "Alpha | 6 ECTS | Telematics" in a
    assert "G" * 500 in a and "G" * 501 not in a
    assert "Line one. Line two." in a and "\n" not in a
    assert "Obj." in lines[2] and "Cont." in lines[2]


def test_skips_scored_modules(tmp_path):
    lines = career_input.lines(_data(tmp_path, {"M-A": {"algo": [1, "x"]}}), skip_scored=True)
    assert [l.split(" | ")[0] for l in lines] == ["M-B", "M-C"]


def test_main_writes_file(tmp_path):
    out = tmp_path / "in.txt"
    assert career_input.main([str(_data(tmp_path)), "--out", str(out)]) == 0
    assert out.read_text().count("\n") == 3
