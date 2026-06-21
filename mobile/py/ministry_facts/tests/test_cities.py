from ministry_facts.core.cities import province_to_code


def test_exact_match():
    assert province_to_code("İstanbul") == "34"
    assert province_to_code("Ankara") == "06"


def test_case_and_diacritic_insensitive():
    assert province_to_code("istanbul") == "34"
    assert province_to_code("ISTANBUL") == "34"
    assert province_to_code("Istanbul") == "34"


def test_unknown_returns_none():
    assert province_to_code("Atlantis") is None
    assert province_to_code("") is None
    assert province_to_code(None) is None
