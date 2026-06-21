from ministry_facts.sources.eu_safety_gate import normalize_to_entry


def test_maps_notification_to_entry_for_turkey_origin():
    raw = {"id": "A12345", "publicationDate": "2026-02-01",
           "products": [{"name": "Oyuncak Ayı", "brand": "ToyCo",
                         "originCountry": "Türkiye"}],
           "risks": [{"type": "Chemical"}], "riskDescription": "Yüksek kurşun"}
    e = normalize_to_entry(raw)
    assert e is not None
    assert e.source == "eu_safety_gate"
    assert e.marka == "ToyCo"
    assert e.raw["alert_id"] == "A12345"


def test_skips_non_turkey_origin():
    raw = {"id": "B1", "products": [{"name": "X", "brand": "Y", "originCountry": "China"}]}
    assert normalize_to_entry(raw, turkey_only=True) is None


def test_does_not_false_match_austria_or_australia():
    for origin in ("Austria", "Australia", "Central African Republic"):
        raw = {"id": "C1", "products": [{"name": "X", "brand": "Y", "originCountry": origin}]}
        assert normalize_to_entry(raw, turkey_only=True) is None


def test_matches_turkey_variants_and_iso_code():
    for origin in ("Türkiye", "Turkey", "TURKIYE", "tr", "TR"):
        raw = {"id": "C2", "products": [{"name": "X", "brand": "Y", "originCountry": origin}]}
        assert normalize_to_entry(raw, turkey_only=True) is not None
