from pathlib import Path
from ministry_facts.sources.gubis import parse_detail

FIX = Path(__file__).parent / "fixtures" / "gubis_detail.html"


def test_parses_detail_into_entry():
    e = parse_detail(FIX.read_text(encoding="utf-8"), "10705")
    assert e is not None
    assert e.source == "gubis"
    assert e.firma
    assert e.violation
    assert e.raw.get("BildirimNo")   # used for external_key
