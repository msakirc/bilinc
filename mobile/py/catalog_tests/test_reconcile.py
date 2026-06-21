# mobile/py/catalog_tests/test_reconcile.py
import catalog_common as cc
from catalog_tests.fakes import FakeStore
from catalog_identity import resolve
from catalog_reconcile import reconcile

def biz_rec(name, lat, lon, src, sid):
    return cc.make_record(entity_type=cc.ENTITY_BUSINESS, source=src, source_id=sid,
                          name=name, lat=lat, lon=lon, keys={})

def test_reconcile_collapses_fuzzy_pending_duplicates():
    s = FakeStore()
    # Turso down -> candidates=None -> both mint as separate fuzzy_pending
    a = resolve(biz_rec("Starbucks Kadıköy", 40.9901, 29.0270, "osm", "1"), s, candidates=None)
    b = resolve(biz_rec("Starbucks", 40.9902, 29.0271, "ovr", "2"), s, candidates=None)
    assert a != b
    merged = reconcile(s)
    assert merged == 1
    assert s.resolve_alias(a) == s.resolve_alias(b)
    # survivor no longer pending after a clean pass with a partner resolved
    surv = s.resolve_alias(a)
    assert s.get_entity(surv)["fuzzy_pending"] is False
