# mobile/py/catalog_tests/test_merge.py
from catalog_tests.fakes import FakeStore
from catalog_identity import merge_canonicals

def _seed(s, cid, ts, keys):
    for k, v in keys.items():
        s.put_key("brand", k, v, cid)
    s.put_entity(cid, {"entity_type": "brand", "name": "X", "mint_ts": ts,
                       "keys": keys, "sources": {f"s#{cid}": {"source": "s", "source_id": cid}}})

def test_survivor_is_oldest_mint_ts():
    s = FakeStore()
    _seed(s, "young", 200.0, {"gtin": "A"})
    _seed(s, "old", 100.0, {"wikidata": "Q1"})
    surv = merge_canonicals(s, "young", "old")
    assert surv == "old"
    assert s.resolve_alias("young") == "old"
    assert s.get_keys([("brand", "gtin", "A")]) == {("brand", "gtin", "A"): "old"}

def test_merge_is_idempotent():
    s = FakeStore()
    _seed(s, "a", 100.0, {"gtin": "A"})
    _seed(s, "b", 200.0, {"gtin": "B"})
    surv1 = merge_canonicals(s, "a", "b")
    surv2 = merge_canonicals(s, "a", "b")  # again
    assert surv1 == surv2 == "a"

def test_merge_three_way():
    s = FakeStore()
    _seed(s, "a", 300.0, {"gtin": "A"})
    _seed(s, "b", 100.0, {"gtin": "B"})
    _seed(s, "c", 200.0, {"gtin": "C"})
    surv = merge_canonicals(s, "a", "b", "c")
    assert surv == "b"
    assert s.resolve_alias("a") == "b" and s.resolve_alias("c") == "b"
