import json

from conftest import fixture

from kit_scraper.fetch import FetchError
from kit_scraper.models import Event
from kit_scraper.parse_event import parse_event
from kit_scraper.run import check_thresholds, crawl, main

GPU = "0x020D8FDB8FA84510A69499DAC43719B5"
BLOCK = "0x77DC960F3A5A43ADB54E127419135391"
ROOT = "0xR00T"
MODULE_PAGE = "abstractModuleView.asp?gguid=0x14CC2798E558E54E9011EF8375B7567B&camvguid=0x38196997375FAA4EABDA0984EE4FE07B&camvceid=CMPEL_D6B658EC&cafiguid=0x85D55FFA24FA48D4826A8F3E37731B4D"
NOW = "2026-10-20T04:00:00Z"


def field_html(fid: str, events: list[str], listed: int | None = None, total: int | None = None) -> str:
    """Synthetic field page: sidebar R > F1, F2 (+ F1 > F1a) and an events table."""
    rows = "".join(
        f'<tr class="hierarchy{d}" id="{i}"><td class="indented title"><a href="field.asp?gguid={i}">{t}</a></td>'
        f'<td class="icon"><span class="badge">1</span></td></tr>'
        for i, t, d in [("0xDEPT", "KIT Department of Informatics", 1), (ROOT, "Root", 2),
                        ("0xF1", "F1", 3), ("0xF1A", "F1a", 4), ("0xF2", "F2", 3), ("0xOTHER", "Other", 2)])
    links = "".join(f'<tr><td><a href="../../campus/all/event.asp?gguid={e}&amp;rwfiguid={fid}">{e}</a></td></tr>'
                    for e in events)
    n = len(events)
    items = f"Items 1 - {listed or n}&nbsp;of&nbsp;{total or n}" if n else "No entries"
    return (f'<a href="field.asp?gguid={fid}&amp;view=list">List of events</a><h1>Course catalog: X (WS 26/27)</h1>'
            f'<table>{links}</table><div>{items}</div><table>{rows}</table>')


class FakeFetcher:
    def __init__(self, pages: dict[str, str]):
        self.pages = pages
        self.calls: list[str] = []

    def get(self, page: str) -> str:
        self.calls.append(page)
        if page not in self.pages:
            raise FetchError(page)
        return self.pages[page]

    get_field = get


def pages(**fields: str) -> dict[str, str]:
    base = {
        f"event.asp?gguid={GPU}": fixture("event.html"),
        f"event.asp?gguid={BLOCK}": fixture("event_block.html"),
        MODULE_PAGE: fixture("module.html"),
        MODULE_PAGE + "&view=details": fixture("module_description.html"),
    }
    defaults = {ROOT: field_html(ROOT, []), "0xF1": field_html("0xF1", []),
                "0xF1A": field_html("0xF1A", []), "0xF2": field_html("0xF2", [])}
    defaults.update(fields)
    base.update({f"field.asp?gguid={k}": v for k, v in defaults.items()})
    return base


def test_event_in_two_fields_is_deduplicated():
    fake = FakeFetcher(pages(**{"0xF1A": field_html("0xF1A", [GPU]), "0xF2": field_html("0xF2", [GPU])}))
    r = crawl(fake, [ROOT], None, NOW)
    assert list(r.data["events"]) == [GPU]
    assert fake.calls.count(f"event.asp?gguid={GPU}") == 1
    tree = r.data["tree"]
    assert [n["title"] for n in tree] == ["F1", "F2"]
    assert tree[0]["children"][0]["eventIds"] == [GPU] and tree[1]["eventIds"] == [GPU]
    assert r.data["modules"]["M-INFO-101567"]["ects"] == 6.0
    assert r.data["events"][GPU]["fingerprint"]
    assert r.data["meta"]["scrapedAt"] == NOW and r.data["meta"]["spo"] == "88-979-H-2025"


def test_non_spo_event_is_dropped():
    r = crawl(FakeFetcher(pages(**{"0xF1": field_html("0xF1", [BLOCK]), "0xF2": field_html("0xF2", [GPU])})),
              [ROOT], None, NOW)
    assert list(r.data["events"]) == [GPU]
    assert [n["title"] for n in r.data["tree"]] == ["F2"]
    assert (r.failed, r.attempted) == (0, 2)


def test_short_field_listing_adds_warning():
    r = crawl(FakeFetcher(pages(**{"0xF2": field_html("0xF2", [GPU], listed=25, total=40)})), [ROOT], None, NOW)
    assert any("listed 25 of 40" in w for w in r.warnings)
    assert r.field_failures == 1


def _previous_with_tree(node_id: str, event_ids: list[str]) -> dict:
    ev = parse_event(fixture("event_lecture.html"), "0xDEAD0002").event
    return {"events": {"0xDEAD0002": ev.to_json_dict()}, "modules": {},
            "tree": [{"id": "0xF1", "title": "F1", "eventIds": [], "children": [
                {"id": node_id, "title": "F1a", "eventIds": event_ids, "children": []}]}]}


def test_failed_field_falls_back_to_previous_event_ids():
    p = pages(**{"0xF2": field_html("0xF2", [GPU])})
    del p["field.asp?gguid=0xF1A"]
    fake = FakeFetcher(p)
    r = crawl(fake, [ROOT], _previous_with_tree("0xF1A", ["0xDEAD0002"]), NOW)
    assert "event.asp?gguid=0xDEAD0002" in fake.calls
    assert "0xDEAD0002" in r.data["events"]          # kept from previous (fetch failed in fake)
    assert r.field_failures == 0


def test_failed_field_without_previous_aborts(tmp_path):
    p = pages(**{"0xF2": field_html("0xF2", [GPU])})
    del p["field.asp?gguid=0xF1A"]
    assert main(["--out", str(tmp_path), "--root", ROOT], fetcher_factory=lambda: FakeFetcher(p), now=NOW) == 2
    assert not (tmp_path / "courses.json").exists()


def test_short_listing_merges_previous_event_ids():
    p = pages(**{"0xF1A": field_html("0xF1A", [GPU], listed=1, total=2)})
    fake = FakeFetcher(p)
    r = crawl(fake, [ROOT], _previous_with_tree("0xF1A", [GPU, "0xDEAD0002"]), NOW)
    assert "event.asp?gguid=0xDEAD0002" in fake.calls and r.field_failures == 0


class ExplodingFetcher(FakeFetcher):
    def get(self, page):
        if page == f"event.asp?gguid={BLOCK}":
            return "<html>" + "x" * 10  # parses to an event without SPO; fine
        if page == "event.asp?gguid=0xDEAD0003":
            raise ValueError("boom")
        return super().get(page)

    get_field = get


def test_unexpected_exception_counts_as_failed_event():
    r = crawl(ExplodingFetcher(pages(**{"0xF2": field_html("0xF2", [GPU, "0xDEAD0003"])})), [ROOT], None, NOW)
    assert (r.failed, r.attempted) == (1, 2) and GPU in r.data["events"]


def test_failed_event_reuses_previous():
    prev_event = parse_event(fixture("event_lecture.html"), "0xDEAD0001").event
    previous = {"events": {"0xDEAD0001": prev_event.to_json_dict()}, "modules": {}}
    r = crawl(FakeFetcher(pages(**{"0xF2": field_html("0xF2", [GPU, "0xDEAD0001"])})), [ROOT], previous, NOW)
    assert Event.from_json_dict(r.data["events"]["0xDEAD0001"]).number == "2400010"
    assert any("0xDEAD0001" in w for w in r.warnings)
    assert r.failed == 1  # reused data still counts toward the failure ratio


def test_failed_event_without_previous_counts_as_failed():
    r = crawl(FakeFetcher(pages(**{"0xF2": field_html("0xF2", [GPU, "0xDEAD0001"])})), [ROOT], None, NOW)
    assert (r.failed, r.attempted) == (1, 2) and "0xDEAD0001" not in r.data["events"]


def _data(n: int) -> dict:
    return {"events": {str(i): {"number": str(i), "title": "t"} for i in range(n)}}


def test_threshold_count_drop():
    assert "drop" in check_thresholds(_data(60), _data(100), 0, 60)
    assert check_thresholds(_data(80), _data(100), 0, 80) is None


def test_threshold_failed_ratio():
    assert check_thresholds(_data(100), None, 12, 100) is not None
    assert check_thresholds(_data(100), None, 10, 100) is None


def test_threshold_missing_title():
    bad = {"events": {"x": {"number": "1", "title": ""}}}
    assert check_thresholds(bad, None, 0, 1) is not None


def test_main_writes_files_and_appends_changes(tmp_path):
    fake = FakeFetcher(pages(**{"0xF2": field_html("0xF2", [GPU])}))
    assert main(["--out", str(tmp_path), "--root", ROOT], fetcher_factory=lambda: fake, now=NOW) == 0
    courses = json.loads((tmp_path / "courses.json").read_text())
    assert list(courses["events"]) == [GPU]
    # first run: nothing to compare against, so no "added" flood in the feed
    assert json.loads((tmp_path / "changes.json").read_text())["entries"] == []

    fake.pages[f"event.asp?gguid={GPU}"] = fake.pages[f"event.asp?gguid={GPU}"].replace("50.34 Raum 148", "50.34 Raum 131")
    assert main(["--out", str(tmp_path), "--root", ROOT], fetcher_factory=lambda: fake,
                now="2026-10-21T04:00:00Z") == 0
    entries = json.loads((tmp_path / "changes.json").read_text())["entries"]
    assert [e["kind"] for e in entries] == ["room_changed"]
    assert json.loads((tmp_path / "status.json").read_text())["checkedAt"] == "2026-10-21T04:00:00Z"


def test_unchanged_run_only_touches_status(tmp_path):
    fake = FakeFetcher(pages(**{"0xF2": field_html("0xF2", [GPU])}))
    main(["--out", str(tmp_path), "--root", ROOT], fetcher_factory=lambda: fake, now=NOW)
    before = (tmp_path / "courses.json").read_bytes(), (tmp_path / "changes.json").read_bytes()
    assert main(["--out", str(tmp_path), "--root", ROOT], fetcher_factory=lambda: fake, now="2026-10-22T04:00:00Z") == 0
    assert ((tmp_path / "courses.json").read_bytes(), (tmp_path / "changes.json").read_bytes()) == before
    assert json.loads((tmp_path / "status.json").read_text())["checkedAt"] == "2026-10-22T04:00:00Z"


def test_limit_refuses_to_overwrite_real_data(tmp_path):
    fake = FakeFetcher(pages(**{"0xF2": field_html("0xF2", [GPU])}))
    main(["--out", str(tmp_path), "--root", ROOT], fetcher_factory=lambda: fake, now=NOW)
    before = (tmp_path / "courses.json").read_bytes()
    assert main(["--out", str(tmp_path), "--root", ROOT, "--limit", "1"], fetcher_factory=lambda: fake, now=NOW) == 3
    assert (tmp_path / "courses.json").read_bytes() == before


def test_kit_urls_pin_the_term():
    r = crawl(FakeFetcher(pages(**{"0xF2": field_html("0xF2", [GPU])})), [ROOT], None, NOW)
    assert "tguid=0xD25DBD9C86874091993315DA11571AAF" in r.data["modules"]["M-INFO-101567"]["kitUrl"]
    assert "tguid=0xD25DBD9C86874091993315DA11571AAF" in r.data["events"][GPU]["kitUrl"]


def test_main_threshold_leaves_files_untouched(tmp_path):
    fake = FakeFetcher(pages(**{"0xF2": field_html("0xF2", [GPU])}))
    main(["--out", str(tmp_path), "--root", ROOT], fetcher_factory=lambda: fake, now=NOW)
    before = (tmp_path / "courses.json").read_text()
    empty = FakeFetcher(pages())
    assert main(["--out", str(tmp_path), "--root", ROOT], fetcher_factory=lambda: empty, now=NOW) == 2
    assert (tmp_path / "courses.json").read_text() == before
