# mobile/py/catalog_tests/test_resolve_race.py
import catalog_common as cc
from catalog_tests.fakes import FakeStore
from catalog_identity import resolve

class RacyStore(FakeStore):
    """Simulates a concurrent winner: the FIRST put_key for a given triple is
    pre-claimed by 'rival' exactly once, forcing the resolver to restart."""
    def __init__(self, steal_triple, rival_cid):
        super().__init__()
        self._steal = steal_triple
        self._rival = rival_cid
        self._stolen = False

    def put_key(self, etype, kname, value, cid):
        if not self._stolen and (etype, kname, value) == self._steal:
            self._stolen = True
            self.keys[self._steal] = self._rival           # rival wins the claim
            self.entities[self._rival] = {"entity_type": etype, "name": "Rival",
                                          "mint_ts": 1.0, "keys": {kname: value},
                                          "sources": {}, "aliases": [], "links": []}
            return False
        return super().put_key(etype, kname, value, cid)

def test_mint_race_restarts_and_converges_to_rival():
    s = RacyStore(("product", "gtin", "G1"), "rival")
    cid = resolve(cc.make_record(entity_type=cc.ENTITY_PRODUCT, source="off",
                                 source_id="1", name="Cola", keys={"gtin": "G1"}), s)
    assert cid == "rival"  # restarted, found rival's now-indexed key


class EnsureRacyStore(FakeStore):
    """Steals the SECOND key exactly once, during _ensure_keys — pointing it at an
    OLDER rival so merge_canonicals tombstones the step-1 id. Regression for the bug
    where resolve() ignored _ensure_keys' return and wrote/returned the tombstone."""
    def __init__(self, steal_triple, rival_cid):
        super().__init__()
        self._steal = steal_triple
        self._rival = rival_cid
        self._stolen = False

    def put_key(self, etype, kname, value, cid):
        if not self._stolen and (etype, kname, value) == self._steal:
            self._stolen = True
            self.keys[self._steal] = self._rival
            self.entities[self._rival] = {"entity_type": etype, "name": "Rival",
                                          "mint_ts": 1.0, "keys": {kname: value},
                                          "sources": {}, "aliases": [], "links": []}
            return False
        return super().put_key(etype, kname, value, cid)


def test_second_key_stolen_during_ensure_returns_live_survivor():
    s = EnsureRacyStore(("product", "wikidata", "Q9"), "rival_old")
    # key1 (gtin) already indexed to 'main' with a NEWER mint_ts than rival_old.
    s.keys[("product", "gtin", "G1")] = "main"
    s.entities["main"] = {"entity_type": "product", "name": "Cola", "mint_ts": 99.0,
                          "keys": {"gtin": "G1"}, "sources": {}, "aliases": [], "links": []}
    cid = resolve(cc.make_record(entity_type=cc.ENTITY_PRODUCT, source="off",
                                 source_id="1", name="Cola",
                                 keys={"gtin": "G1", "wikidata": "Q9"}), s)
    # step-1 finds 'main'; ensuring Q9 races, folds main+rival_old -> older survivor.
    assert cid == s.resolve_alias(cid)            # never returns a tombstone
    assert cid == "rival_old"                     # older mint_ts wins
    assert s.resolve_alias("main") == "rival_old"
