# Degree guidance: requirements tracker, catalog badges, guide page

Date: 2026-10-20. Source of rules: module handbook 88-979-H-2025, version 09/09/2026 (WS 26/27), §1.3, §2, §3
(https://www.informatik.kit.edu/downloads/stud/88-979-H-2025_v1_2026-09-09_en.pdf).

## Problem
A first-semester student sees courses but not how they add up to the degree: which area a course counts for,
what a Stammmodul is, how many seminars/practicals are needed.

## Rules encoded (web/src/logic/degree.ts)
- 120 CP total, thesis 30.
- 2 areas of specialization, each ≥15 CP, of which ≥10 CP lectures (8 for Telematics); seminars, practicals and
  Stammmodule do not count towards the lecture minimum. Both areas together ≤73 CP.
- Elective Studies 6–49 CP; any area module may count there. Minor 9–18 CP. Interdisciplinary Qualifications 2–6 CP.
- 4 Stammmodule (11 modules in handbook Figure 2, matched by id and title), counted in areas or electives.
- Seminars ≥3 CP, practicals ≥6 CP, together 12–18 CP (areas + electives only).
- A module counts in exactly one place.

## Derived data
- Module areas: `fields` entries starting with "Area of Specialization: ".
- Module kind: title (Seminar / Practical Course / Lab / Research Practical / Practice of Research), else catalog
  tree node (1.4 → Stammmodul, 1.6 → seminar, 1.7/1.8 → practical) when the module is the event's only module;
  Stammmodul by normalized handbook title. Heuristic; shown as such in the guide.

## State (backwards compatible, still version 1)
- `UserState.areas?: string[]` (0–2 chosen areas).
- `SelectedEntry.countAs?: string | null` — area name | `elective` | `minor` | `iq`. Default: first chosen area of the
  module, else elective, else minor, else iq.

## UI
- Catalog: kind badge (Stammmodul/Seminar/Practical), "irregular"/"winter only" hint, chosen-area marker;
  filters for area and kind (replaces the "module part" select). Detail lists the areas a module counts for.
- Schedule: degree panel with area pickers, progress rows per rule, suggestions of best-filled areas when fewer than
  two are chosen, warnings; per-course "counts as" select. ECTS panel shows progress to a 30 CP semester.
- New tab "Guide": structure of the degree, rules, first-semester tactics using this term's data, sources and ISS.

The planner covers one term; the panel shows this term's contribution towards whole-degree minimums.
