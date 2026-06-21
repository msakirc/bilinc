# mobile/py/catalog_tests/test_resolve_basic.py
import catalog_common as cc
from catalog_tests.fakes import FakeStore
from catalog_identity import resolve

def rec(keys, name="Acme", etype=cc.ENTITY_BRAND):
    return cc.make_record(entity_type=etype, source="nsi", source_id="1",
                          name=name, keys=keys)

def test_first_record_mints_and_indexes_keys():
    s = FakeStore()
    cid = resolve(rec({"wikidata": "Q1"}), s)
    assert cid
    assert s.get_keys([("brand", "wikidata", "Q1")]) == {("brand", "wikidata", "Q1"): cid}
    assert s.get_entity(cid)["entity_type"] == "brand"

def test_second_record_same_key_resolves_to_same_id():
    s = FakeStore()
    a = resolve(rec({"wikidata": "Q1"}), s)
    b = resolve(rec({"wikidata": "Q1"}, name="Acme Corp"), s)
    assert a == b

def test_keyless_with_no_candidates_mints_fuzzy_pending():
    s = FakeStore()
    cid = resolve(rec({}, name="No Key Co"), s, candidates=None)
    assert s.get_entity(cid)["fuzzy_pending"] is True
