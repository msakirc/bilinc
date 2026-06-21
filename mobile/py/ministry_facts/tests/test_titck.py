from pathlib import Path
from ministry_facts.sources.titck import parse_table

FIX = Path(__file__).parent / "fixtures" / "titck_113.html"


def test_parses_rows_into_entries():
    html = FIX.read_text(encoding="utf-8")
    entries = list(parse_table(html, "titck:113"))
    assert len(entries) > 0
    e = entries[0]
    assert e.source == "titck:113"
    assert e.firma            # non-empty firm
    assert e.violation        # non-empty reason
