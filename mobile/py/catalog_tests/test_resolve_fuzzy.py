# mobile/py/catalog_tests/test_resolve_fuzzy.py
import catalog_common as cc
from catalog_tests.fakes import FakeStore
from catalog_identity import resolve

def biz_rec(name, lat, lon, keys=None, src="osm", sid="1"):
    return cc.make_record(entity_type=cc.ENTITY_BUSINESS, source=src, source_id=sid,
                          name=name, lat=lat, lon=lon, keys=keys or {})

def test_keyless_business_adopts_fuzzy_candidate():
    s = FakeStore()
    first = resolve(biz_rec("Starbucks Kadıköy", 40.9901, 29.0270), s,
                    candidates=lambda r: [])  # no candidate -> mints, NOT fuzzy_pending
    assert s.get_entity(first).get("fuzzy_pending") in (False, None)
    # second nearby same-name; candidate provider returns the first
    second = resolve(biz_rec("Starbucks", 40.9902, 29.0271, src="fsq", sid="9"), s,
                     candidates=lambda r: [dict(s.get_entity(first), _cid=first)])
    assert second == first

def test_keyed_record_adopts_keyless_then_indexes_key():
    s = FakeStore()
    kid = resolve(biz_rec("Migros Şişli", 41.06, 28.98), s, candidates=lambda r: [])
    # later a record with the SAME place arrives carrying an fsq key
    got = resolve(biz_rec("Migros", 41.0601, 28.9801, keys={"fsq": "F1"}, src="fsq", sid="2"),
                  s, candidates=lambda r: [dict(s.get_entity(kid), _cid=kid)])
    assert got == kid
    assert s.get_keys([("business", "fsq", "F1")]) == {("business", "fsq", "F1"): kid}
