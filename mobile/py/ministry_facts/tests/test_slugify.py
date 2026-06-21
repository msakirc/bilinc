from ministry_facts.core.slugify import slugify, listing_slug

def test_turkish_chars_transliterated():
    assert slugify("Şahin Süt Ürünleri A.Ş.") == "sahin-sut-urunleri-as"

def test_strips_punctuation_and_collapses_dashes():
    assert slugify("Acme  Gıda / Ltd.") == "acme-gida-ltd"

def test_listing_slug_appends_id_suffix():
    s = listing_slug("Acme Süt", "abcdef12-3456-7890-aaaa-bbbbccccdddd")
    assert s == "acme-sut-abcdef12"
    assert len(s) <= 80
