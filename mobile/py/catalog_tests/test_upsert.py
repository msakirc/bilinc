import catalog_common as cc
from catalog_tests.fakes import FakeStore
from catalog_identity import resolve, upsert

def test_upsert_is_idempotent_on_sources():
    s = FakeStore()
    r = cc.make_record(entity_type=cc.ENTITY_BRAND, source="nsi", source_id="1",
                       name="Acme", keys={"wikidata": "Q1"})
    cid = resolve(r, s)
    upsert(s, cid, r)
    upsert(s, cid, r)  # re-run / at-least-once delivery
    assert len(s.get_entity(cid)["sources"]) == 1
