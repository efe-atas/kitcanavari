from conftest import fixture

from kit_scraper.parse_spo import field_modules, minor_fields, module_events


def test_minor_fields_lists_every_minor_of_the_degree_program():
    fields = minor_fields(fixture("spo_product.html"))
    assert [t for _, t, _ in fields] == [
        "Minor Studies: Biologically Inspired Robotics", "Minor Studies: Electrical Engineering",
        "Minor Studies: Mathematics", "Minor Studies: Economics", "Minor Studies: Law",
    ]
    gguid, _, path = fields[0]
    assert gguid == "0x7E147493AD4B4EFAB386F1ED24D2FEAC"
    assert path == "abstractFieldView.asp?gguid=0x7E147493AD4B4EFAB386F1ED24D2FEAC"


def test_field_modules_maps_ids_to_module_pages():
    mods = field_modules(fixture("field_minor.html"))
    assert list(mods)[:2] == ["M-MACH-107806", "M-MACH-106903"]
    assert len(mods) == 7
    assert mods["M-MACH-107558"].startswith("abstractModuleView.asp?gguid=0xB2218F4070E648A3BE0B694CD6FC9DF2&")
    assert "tguid" not in mods["M-MACH-107558"]


def test_module_events_reads_only_the_events_table():
    assert module_events(fixture("module_minor.html")) == [
        "0xC96F7C15CD934165B7902FFAD456DE0A", "0xC12424E383904C138AA3359689B3701C",
    ]


def test_module_without_events_this_term():
    assert module_events(fixture("module_minor_no_events.html")) == []
