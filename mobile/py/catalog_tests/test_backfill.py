import catalog_common as cc
from catalog_backfill import keys_from_source

def test_osm_underscore():
    assert keys_from_source("osm", "osm_123") == {"osm": "123"}
    assert keys_from_source("osm", "osm_node_123") == {"osm": "node_123"}

def test_prefixed_colon_sources():
    assert keys_from_source("foursquare", "foursquare:abc") == {"fsq": "abc"}
    assert keys_from_source("overture", "overture:xyz") == {"gers": "xyz"}
    assert keys_from_source("wikidata", "wikidata:Q42") == {"wikidata": "Q42"}

def test_barcode_like_product():
    assert keys_from_source("off", "off:08690000000001") == {"gtin": "08690000000001"}
    assert keys_from_source("kaggle", "kaggle:08690000000001") == {"gtin": "08690000000001"}

def test_unknown_source_yields_no_key():
    assert keys_from_source("brand-catalog", "catalog:acme:widget") == {}
    assert keys_from_source(None, None) == {}


# Task 2: UF + cluster
from catalog_backfill import cluster

def _rec(name, etype, keys=None, lat=None, lon=None, pk="L#x", attrs=None):
    r = cc.make_record(entity_type=etype, source="s", source_id=pk.split("#")[-1],
                       name=name, keys=keys or {}, lat=lat, lon=lon, attrs=attrs or {})
    r["_pk"] = pk
    return r

def test_strong_key_unions_across_sources():
    recs = [_rec("Cola", cc.ENTITY_PRODUCT, {"gtin": "G1"}, pk="L#1"),
            _rec("Coca Cola", cc.ENTITY_PRODUCT, {"gtin": "G1"}, pk="L#2"),
            _rec("Fanta", cc.ENTITY_PRODUCT, {"gtin": "G2"}, pk="L#3")]
    clusters = cluster(recs)
    assert sorted(len(c) for c in clusters) == [1, 2]  # G1 pair merged, G2 alone

def test_business_geo_name_fuzzy_clusters():
    recs = [_rec("Starbucks Kadıköy", cc.ENTITY_BUSINESS, lat=40.9901, lon=29.0270, pk="L#1"),
            _rec("Starbucks", cc.ENTITY_BUSINESS, lat=40.9902, lon=29.0271, pk="L#2"),
            _rec("Migros", cc.ENTITY_BUSINESS, lat=41.06, lon=28.98, pk="L#3")]
    clusters = cluster(recs)
    assert sorted(len(c) for c in clusters) == [1, 2]  # the two Starbucks merge

def test_distinct_entities_stay_separate():
    recs = [_rec("Acme", cc.ENTITY_BRAND, pk="L#1"),
            _rec("Globex", cc.ENTITY_BRAND, pk="L#2")]
    assert len(cluster(recs)) == 2


# Task 3: canonical_id_for + merge_cluster
from catalog_backfill import canonical_id_for, merge_cluster

def test_canonical_id_deterministic_from_strong_key():
    c1 = [_rec("Cola", cc.ENTITY_PRODUCT, {"gtin": "G1"}, pk="L#1")]
    c2 = [_rec("Coca Cola", cc.ENTITY_PRODUCT, {"gtin": "G1"}, pk="L#9")]  # diff members, same key
    assert canonical_id_for(c1) == canonical_id_for(c2)  # keyed on gtin, not members

def test_canonical_id_keyless_uses_sorted_members():
    a = [_rec("Xx", cc.ENTITY_BRAND, pk="L#2"), _rec("Xx", cc.ENTITY_BRAND, pk="L#1")]
    b = [_rec("Xx", cc.ENTITY_BRAND, pk="L#1"), _rec("Xx", cc.ENTITY_BRAND, pk="L#2")]
    assert canonical_id_for(a) == canonical_id_for(b)  # order-independent

def test_merge_cluster_unions_fields():
    members = [_rec("Starbucks", cc.ENTITY_BUSINESS, {"fsq": "F1"}, 40.99, 29.02, "L#1"),
               _rec("Starbucks Kadıköy", cc.ENTITY_BUSINESS, lat=40.99, lon=29.02, pk="L#2")]
    e = merge_cluster(members)
    assert e["entity_type"] == cc.ENTITY_BUSINESS
    assert e["keys"] == {"fsq": "F1"}
    assert e["name"] == "Starbucks Kadıköy"           # longest/diacritic-richest
    assert len(e["sources"]) == 2                       # both members
    assert e["fuzzy_pending"] is False                  # snapshot fuzzy already done


# Task 4: backfill driver + report/dry-run + scan __main__
from catalog_tests.fakes import FakeStore
from catalog_backfill import backfill

def test_backfill_writes_canonical_and_dedups():
    recs = [_rec("Cola", cc.ENTITY_PRODUCT, {"gtin": "G1"}, pk="L#1"),
            _rec("Coca Cola", cc.ENTITY_PRODUCT, {"gtin": "G1"}, pk="L#2"),
            _rec("Fanta", cc.ENTITY_PRODUCT, {"gtin": "G2"}, pk="L#3")]
    store = FakeStore()
    stats = backfill(iter(recs), store, write=True)
    assert stats["records"] == 3
    assert stats["entities"] == 2            # G1 pair collapsed
    # the gtin index resolves both members' key to one canonical id
    cid = store.get_keys([("product", "gtin", "G1")])[("product", "gtin", "G1")]
    assert cid
    assert store.get_entity(cid)["name"] == "Coca Cola"

def test_backfill_report_writes_nothing():
    recs = [_rec("Aa", cc.ENTITY_BRAND, pk="L#1")]
    store = FakeStore()
    stats = backfill(iter(recs), store, write=False)
    assert stats["entities"] == 1
    assert store.get_keys([]) == {}
    assert not store.entities          # dry-run: nothing persisted

def test_backfill_is_rerun_stable():
    recs = [_rec("Cola", cc.ENTITY_PRODUCT, {"gtin": "G1"}, pk="L#1")]
    store = FakeStore()
    backfill(iter(recs), store, write=True)
    ids1 = set(store.entities)
    backfill(iter(list(recs)), store, write=True)   # re-run same snapshot
    assert set(store.entities) == ids1              # deterministic ids -> no new entities


# Review fixes: cross-type union, geo-less business, deterministic name, redirect, seed
from catalog_backfill import _best_name


def test_cross_type_same_wikidata_not_merged():
    # A brand and a product sharing a wikidata QID must stay separate (type-scoped keys).
    recs = [_rec("Acme", cc.ENTITY_BRAND, {"wikidata": "Q1"}, pk="L#1"),
            _rec("Acme Widget", cc.ENTITY_PRODUCT, {"wikidata": "Q1"}, pk="L#2")]
    assert len(cluster(recs)) == 2


def test_geoless_business_not_fuzzy_merged():
    # Two geo-less businesses with the same name must NOT merge (require_geo=True).
    recs = [_rec("Pizza Place", cc.ENTITY_BUSINESS, pk="L#1"),
            _rec("Pizza Place", cc.ENTITY_BUSINESS, pk="L#2")]
    assert len(cluster(recs)) == 2


def test_best_name_deterministic_tiebreak():
    # Equal-length, equal-diacritic names -> lexically smallest, regardless of order.
    m1 = _rec("Abcd", cc.ENTITY_BRAND, pk="L#1")
    m2 = _rec("Wxyz", cc.ENTITY_BRAND, pk="L#2")
    assert _best_name([m1, m2]) == "Abcd"
    assert _best_name([m2, m1]) == "Abcd"


def test_backfill_returns_redirect_map():
    recs = [_rec("Cola", cc.ENTITY_PRODUCT, {"gtin": "G1"}, pk="L#1"),
            _rec("Coca Cola", cc.ENTITY_PRODUCT, {"gtin": "G1"}, pk="L#2")]
    store = FakeStore()
    stats = backfill(iter(recs), store, write=True)
    redirect = stats["redirect"]
    assert set(redirect) == {"L#1", "L#2"}
    assert redirect["L#1"] == redirect["L#2"]   # both legacy ids -> same canonical cid
    # report mode produces no redirect
    assert backfill(iter(list(recs)), FakeStore(), write=False)["redirect"] == {}


def test_keyed_seed_stable_across_key_subset():
    # Same full strong-key set -> same id, regardless of member composition/order.
    full_a = [_rec("Xx", cc.ENTITY_PRODUCT, {"gtin": "G1", "osm": "O1"}, pk="L#1")]
    full_b = [_rec("Xx", cc.ENTITY_PRODUCT, {"gtin": "G1"}, pk="L#7"),
              _rec("Yy", cc.ENTITY_PRODUCT, {"osm": "O1"}, pk="L#8")]
    assert canonical_id_for(full_a) == canonical_id_for(full_b)
    # Adding an unrelated key changes the id.
    extra = [_rec("Xx", cc.ENTITY_PRODUCT, {"gtin": "G1", "osm": "O1", "fsq": "F9"}, pk="L#1")]
    assert canonical_id_for(extra) != canonical_id_for(full_a)


def test_backfill_cross_type_shared_key_writes_two_entities():
    # Brand and product sharing wikidata Q1 are DISTINCT entities. cluster() keeps them
    # apart (type-scoped union) AND canonical_id_for must not collide their ids, or the
    # second put_entity would clobber the first (data loss). Regression for the seed fix.
    recs = [_rec("Acme", cc.ENTITY_BRAND, {"wikidata": "Q1"}, pk="L#1"),
            _rec("Acme Cola", cc.ENTITY_PRODUCT, {"wikidata": "Q1"}, pk="L#2")]
    store = FakeStore()
    stats = backfill(iter(recs), store, write=True)
    assert stats["entities"] == 2
    assert len(store.entities) == 2                       # no collision on write
    assert canonical_id_for([recs[0]]) != canonical_id_for([recs[1]])
    assert stats["redirect"]["L#1"] != stats["redirect"]["L#2"]
