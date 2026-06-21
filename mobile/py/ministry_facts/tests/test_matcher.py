from ministry_facts.core.matcher import CatalogMatcher
from ministry_facts.core.models import MinistryEntry

def _e(marka="Ülker", firma="Ülker Gıda San. A.Ş."):
    return MinistryEntry(source="tarim:liste1", firma=firma, marka=marka, urun="X",
        violation="v", category_hint="", province=None, district=None, batch=None,
        announced_at=None, source_url="", raw={})

def test_matches_existing_brand_diacritic_insensitive():
    cands = [{"id": "L9", "name": "ÜLKER", "entity_type": "brand"}]
    m = CatalogMatcher(lambda name: cands)
    assert m.match(_e(marka="Ülker")) == "L9"

def test_prefers_brand_entity_type_over_others():
    cands = [{"id": "Lb", "name": "Ülker", "entity_type": "business"},
             {"id": "Lr", "name": "Ülker", "entity_type": "brand"}]
    m = CatalogMatcher(lambda name: cands)
    assert m.match(_e(marka="Ülker")) == "Lr"

def test_no_match_returns_none():
    m = CatalogMatcher(lambda name: [{"id": "X", "name": "Başka Marka", "entity_type": "brand"}])
    assert m.match(_e(marka="Ülker")) is None

def test_falls_back_to_firma_when_marka_unmatched():
    # marka="Acme" finds nothing; the firma (a longer legal name) is the one in catalog.
    def fetch(name):
        if name == "Acme": return []
        return [{"id": "Lf", "name": "Acme Gıda", "entity_type": "business"}]
    m = CatalogMatcher(fetch)
    e = _e(marka="Acme", firma="Acme Gıda San. ve Tic. Ltd. Şti.")
    assert m.match(e) == "Lf"

def test_short_name_not_matched():
    m = CatalogMatcher(lambda name: [{"id": "L1", "name": "AB", "entity_type": "brand"}])
    e = _e(marka="AB", firma="AB")
    assert m.match(e) is None
