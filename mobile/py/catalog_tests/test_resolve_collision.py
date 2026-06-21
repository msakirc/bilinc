# mobile/py/catalog_tests/test_resolve_collision.py
import catalog_common as cc
from catalog_tests.fakes import FakeStore
from catalog_identity import resolve

def test_two_keys_indexed_to_two_ids_merge_into_one():
    s = FakeStore()
    # entity A known only by gtin; entity B known only by wikidata
    a = resolve(cc.make_record(entity_type=cc.ENTITY_PRODUCT, source="off",
                               source_id="1", name="Cola", keys={"gtin": "G1"}), s)
    b = resolve(cc.make_record(entity_type=cc.ENTITY_PRODUCT, source="opf",
                               source_id="2", name="Cola", keys={"wikidata": "Q9"}), s)
    assert a != b
    # a NEW record carrying BOTH keys must collapse them
    c = resolve(cc.make_record(entity_type=cc.ENTITY_PRODUCT, source="ovr",
                               source_id="3", name="Cola", keys={"gtin": "G1", "wikidata": "Q9"}), s)
    assert s.resolve_alias(a) == c
    assert s.resolve_alias(b) == c
    assert s.get_keys([("product", "gtin", "G1"), ("product", "wikidata", "Q9")]) == {
        ("product", "gtin", "G1"): c, ("product", "wikidata", "Q9"): c}
