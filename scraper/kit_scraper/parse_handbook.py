"""Module handbook PDF (pdftotext -layout) → data/handbook.json. Run by hand when a new handbook is published."""
from __future__ import annotations

import argparse
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

SOURCE = "88-979-H-2025 Module Handbook"

_MODULE_RE = re.compile(r"^\s+4\.\d+ Module: (.*)$")
_COMPONENTS_RE = re.compile(r"^\s+5\.\d+ Module component:")
_AS_OF_RE = re.compile(r"Module Handbook as of (\d{2})/(\d{2})/(\d{4})")
_NOISE_RES = [
    re.compile(r"^Computer Science Master 2025 \(Master of Science \(M\.Sc\.\)\)\s*$"),
    re.compile(r"^\s*\d+\s*$"),
    re.compile(r"^Module Handbook as of "),
    re.compile(r"^4 MODULES\b"),
    re.compile(r"^5 MODULE COMPONENTS\b"),
    re.compile(r"^\s*M\s*$"),
]
# Running page header after a footer; a long title wraps around the "4 MODULES" line.
_HEADER_PART_RES = [re.compile(r"^\s{20,}Module: "), re.compile(r"^\s{20,}.*\[M-[A-Z]+-\d+\]\s*$")]
_LABEL_RE = re.compile(r"^\s*(Coordinators|Organisation|Part of|Prerequisite for):\s*(.*)$")
_CREDITS_HEAD_RE = re.compile(r"^\s*Credits\s+Grading\s+Recurrence")
_CREDITS_RE = re.compile(
    r"^\s*(\d+(?:,\d+)?) CP\s+(?:graded|pass/fail)\s+(.+?)\s{2,}\d+ terms?\s+(.+?)\s{2,}(\d+)\s+\d+\s*$")
_BRICK_RE = re.compile(r"^\s+(T-[A-Z]+-\d+)\s+(.+?)\s{2,}(\S+(?: \S+)?)\s+(\d+(?:,\d+)?) CP\b")
_SECTIONS = {
    "Assessment": None,
    "Prerequisites": "prerequisites",
    "Competence Goal": "competenceGoals",
    "Content": "content",
    "Workload": None,
    "Recommendations": "recommendations",
    "Annotation": None,
    "Literature": None,
    "Additional Information": None,
    "Module Grade Calculation": None,
    "Teaching and Learning Methods": None,
    "Modeled Prerequisites": None,
    "Election notes": None,
    "Courses": None,
    "Exams": None,
}
# Bodies that only say "nothing here" (several misspellings occur in the handbook).
_PLACEHOLDER_RE = re.compile(r"^(none\.?|see (partial a\w+|module component)\b.*)$", re.I)
_FIELD_PREFIXES = ("Area of Specialization", "Elective Studies", "Minor Studies", "Interdisciplinary", "Master")
_USAGE_RE = re.compile(r"\s*\(Usage (?:from|until) [^)]*\)$")
_ITEM_RE = re.compile(r"^(-|–|\*|•|◦|▪|\d+\.)\s")
_RECURRENCE = {"Each winter term": "winter", "Each summer term": "summer", "Each term": "each"}


def _num(s: str) -> float:
    return float(s.replace(",", "."))


def _text(lines: list[str]) -> str | None:
    """Join body lines: blank lines split paragraphs, list items start a new line, other lines are soft-wrapped."""
    paras: list[str] = []
    cur = ""
    for raw in lines + [""]:
        line = raw.strip()
        if not line:
            if cur:
                paras.append(cur)
            cur = ""
        elif not cur:
            cur = line
        elif _ITEM_RE.match(line):
            cur += "\n" + line
        else:
            cur += " " + line
    text = "\n\n".join(paras).strip()
    if not text or _PLACEHOLDER_RE.match(text):
        return None
    return text


def _parse_module(head: str, lines: list[str]) -> dict:
    # The heading may wrap: "Title [M-" / "INFO-106303]".
    i = 0
    while "]" not in head and i < len(lines):
        if lines[i].strip():
            head += " " + lines[i].strip()
        i += 1
    m = re.match(r"^(.*?)\s*\[(.*?)\]", head)
    if not m:
        raise ValueError(f"unparseable module heading: {head!r}")
    title, mid = re.sub(r"\s+", " ", m.group(1)).strip(), re.sub(r"\s+", "", m.group(2))
    lines = lines[i:]

    out: dict = {
        "id": mid, "title": title, "ects": None, "recurrence": "irregular", "language": None, "level": None,
        "fields": [], "coordinators": [], "bricks": [],
        "competenceGoals": None, "content": None, "prerequisites": None, "recommendations": None,
    }
    label = None
    section: str | None = None
    bodies: dict[str, list[str]] = {}
    credits_next = False
    for line in lines:
        stripped = line.strip()
        if section is None and (lm := _LABEL_RE.match(line)):
            label = lm.group(1)
            if lm.group(2):
                _add_label(out, label, lm.group(2))
            continue
        if label and section is None:
            if stripped and not _CREDITS_HEAD_RE.match(line):
                _add_label(out, label, stripped)
                continue
            label = None
        if _CREDITS_HEAD_RE.match(line):
            credits_next = True
            continue
        if credits_next and stripped:
            credits_next = False
            if cm := _CREDITS_RE.match(line):
                out["ects"] = _num(cm.group(1))
                out["recurrence"] = _RECURRENCE.get(cm.group(2).strip(), "irregular")
                out["language"] = cm.group(3).strip()
                out["level"] = int(cm.group(4))
            continue
        if stripped in _SECTIONS:
            section = stripped
            bodies.setdefault(section, [])
            continue
        if section is None:
            if bm := _BRICK_RE.match(line):
                out["bricks"].append({"id": bm.group(1), "title": bm.group(2).strip(),
                                      "term": bm.group(3), "ects": _num(bm.group(4))})
            continue
        bodies[section].append(line)
    out["fields"] = _clean_fields(out["fields"])
    for name, key in _SECTIONS.items():
        if key and name in bodies:
            out[key] = _text(bodies[name])
    return out


def _add_label(out: dict, label: str, value: str) -> None:
    if label == "Coordinators":
        out["coordinators"].append(value.strip())
    elif label == "Part of":
        value = value.strip()
        if out["fields"] and not value.startswith(_FIELD_PREFIXES):
            out["fields"][-1] += " " + value  # wrapped "(Usage from" / "7/13/2026)"
        else:
            out["fields"].append(value)


def _clean_fields(fields: list[str]) -> list[str]:
    """Drop "(Usage from|until <date>)" so names match the catalog's field titles."""
    out: list[str] = []
    for f in fields:
        f = _USAGE_RE.sub("", f)
        if f not in out:
            out.append(f)
    return out


def parse_handbook_text(text: str) -> dict:
    as_of = None
    blocks: list[tuple[str, list[str]]] = []
    in_header = False
    for line in text.splitlines():
        if am := _AS_OF_RE.search(line):
            as_of = as_of or f"{am.group(3)}-{am.group(2)}-{am.group(1)}"
            in_header = True
            continue
        if _COMPONENTS_RE.match(line):
            break
        if any(r.match(line) for r in _NOISE_RES):
            # A page break is not a paragraph break: drop the blank lines before the footer as well.
            while blocks and blocks[-1][1] and not blocks[-1][1][-1].strip():
                blocks[-1][1].pop()
            continue
        if in_header:
            if not _MODULE_RE.match(line) and (not line.strip() or any(r.match(line) for r in _HEADER_PART_RES)):
                continue
            in_header = False
        if hm := _MODULE_RE.match(line):
            blocks.append((hm.group(1), []))
        elif blocks:
            blocks[-1][1].append(line)
    modules = {}
    for head, lines in blocks:
        m = _parse_module(head, lines)
        modules[m["id"]] = m
    return {"meta": {"source": SOURCE, "asOf": as_of}, "modules": modules}


def pdf_to_text(pdf: Path) -> str:
    return subprocess.run(["pdftotext", "-layout", str(pdf), "-"], check=True, capture_output=True, text=True).stdout


def main(argv: list[str] | None = None, now: str | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("pdf")
    ap.add_argument("--out", required=True)
    args = ap.parse_args(argv)
    data = parse_handbook_text(pdf_to_text(Path(args.pdf)))
    data["meta"]["parsedAt"] = now or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    Path(args.out).write_text(json.dumps(data, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
