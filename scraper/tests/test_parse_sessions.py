from datetime import date

from conftest import fixture

from kit_scraper.models import Session
from kit_scraper.parse_sessions import parse_sessions


def test_gpu_sessions():
    s = parse_sessions(fixture("event.html"))
    assert len(s) == 15
    assert s[0] == Session("2026-10-27", "14:00", "15:30", "50.34 Raum 148", False, 0)
    assert all(date.fromisoformat(x.date).weekday() == 1 for x in s)


def test_lecture_sessions_include_single_date():
    s = parse_sessions(fixture("event_lecture.html"))
    assert len(s) == 31
    assert Session("2026-10-16", "09:00", "17:00", "50.34 Raum 252", False, 2) in s
    assert Session("2026-10-30", "09:45", "11:15", "40.50 Engler-Bunte-Hörsaal", False, 1) in s


def test_no_appointments():
    assert parse_sessions(fixture("event_block.html")) == []


CANCELLED = """<table class="listview" id="APPLIST">
<tbody class="tablehead"><tr><th></th><th class="app">Date</th><th class="time">Time</th><th>Room</th><th>Start</th><th></th></tr></tbody>
<tbody class="tablecontent">
<tr id="0x1" class="odd folding-close"><td></td><td class="app"><a>Tue, weekly</a></td><td class="time"><a>2:00 PM&nbsp;-&nbsp;3:30 PM</a></td>
<td><a>50.34 Raum 148</a></td><td class="nomobile">10/27/2026</td><td class="icon"><span class="badge">2</span></td></tr>
<tr class="collapsible odd"><td>&nbsp;</td><td class="collapsible" colspan="15">10/27/2026</td></tr>
<tr class="collapsible odd"><td>&nbsp;</td><td class="collapsible failureApp" colspan="15">11/3/2026</td></tr>
</tbody></table>"""


def test_cancelled_marker():
    s = parse_sessions(CANCELLED)
    assert [x.cancelled for x in s] == [False, True]
    assert s[1].date == "2026-11-03"
