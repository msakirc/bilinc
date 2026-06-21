from catalog_tests.fakes import FakeStore

def test_put_key_is_conditional():
    s = FakeStore()
    assert s.put_key("brand", "wikidata", "Q42", "cid1") is True
    assert s.put_key("brand", "wikidata", "Q42", "cid2") is False  # already claimed

def test_get_keys_batch_and_alias_chase():
    s = FakeStore()
    s.put_key("brand", "wikidata", "Q42", "cid1")
    s.put_entity("cid1", {"entity_type": "brand", "name": "X", "keys": {"wikidata": "Q42"}})
    got = s.get_keys([("brand", "wikidata", "Q42"), ("brand", "wikidata", "ZZZ")])
    assert got == {("brand", "wikidata", "Q42"): "cid1"}

def test_put_entity_unions_sources_idempotent():
    s = FakeStore()
    e = {"entity_type": "brand", "name": "X",
         "sources": {"nsi#1": {"source": "nsi", "source_id": "1"}}}
    s.put_entity("cid1", e)
    s.put_entity("cid1", e)  # same source again
    assert len(s.get_entity("cid1")["sources"]) == 1

def test_merge_repoints_keys_and_tombstones():
    s = FakeStore()
    s.put_key("brand", "gtin", "A", "loser")
    s.put_entity("loser", {"entity_type": "brand", "name": "X", "keys": {"gtin": "A"},
                           "sources": {"s#1": {"source": "s", "source_id": "1"}}})
    s.put_entity("survivor", {"entity_type": "brand", "name": "X", "keys": {},
                              "sources": {"s#2": {"source": "s", "source_id": "2"}}})
    s.merge("survivor", "loser")
    assert s.resolve_alias("loser") == "survivor"
    assert s.get_keys([("brand", "gtin", "A")]) == {("brand", "gtin", "A"): "survivor"}
    assert len(s.get_entity("survivor")["sources"]) == 2  # unioned
    s.merge("survivor", "loser")  # idempotent re-merge: no error
