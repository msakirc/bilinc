from ministry_facts.core.models import normalize_name

def test_strips_suffixes_and_folds_diacritics():
    assert normalize_name("Ülker Çikolata San. ve Tic. A.Ş.") == normalize_name("ülker çikolata")
    assert normalize_name("ÜLKER") == normalize_name("ülker") == "ulker"

def test_empty():
    assert normalize_name("") == ""
    assert normalize_name(None) == ""
