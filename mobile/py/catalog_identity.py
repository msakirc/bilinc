# mobile/py/catalog_identity.py
"""Cloud-native entity identity resolver. Scrapers import resolve()/upsert().

See docs/superpowers/specs/2026-06-20-catalog-dedup-design.md.
DynamoDB is the authority; Turso (read-only) is an optional fuzzy accelerator.
"""
import time
from uuid import uuid4

import catalog_common as cc

KEY_PRIORITY = ("gtin", "mbid", "wikidata", "gers", "fsq", "osm")


def _mint_ts(store, cid):
    e = store.get_entity(cid) or {}
    return (e.get("mint_ts") or float("inf"), cid)  # tie-break by id; None-safe


def merge_canonicals(store, *ids):
    """Merge >=2 canonical ids into one. Deterministic survivor (oldest mint_ts,
    tie-break smallest id). Atomic + idempotent via Store.merge."""
    live = sorted({store.resolve_alias(i) for i in ids}, key=lambda c: _mint_ts(store, c))
    if len(live) <= 1:
        return live[0] if live else None
    survivor = live[0]
    for loser in live[1:]:
        store.merge(survivor, loser)
    return survivor


def _ordered_keys(record):
    et = record["entity_type"]
    return [(et, k, str(record["keys"][k])) for k in KEY_PRIORITY if record["keys"].get(k)]


def _entity_from(record, *, fuzzy_pending=False):
    src = record["source"]
    sid = record["source_id"]
    return {
        "entity_type": record["entity_type"],
        "name": record["name"],
        "aliases": list(record.get("aliases", [])),
        "lat": record.get("lat"), "lon": record.get("lon"),
        "public": record.get("public", {}), "private": record.get("private", {}),
        "attrs": record.get("attrs", {}),
        "keys": dict(record.get("keys", {})),
        "links": [],
        "sources": {f"{src}#{sid}": {"source": src, "source_id": sid}},
        "fuzzy_pending": fuzzy_pending,
        "mint_ts": time.time(),
    }


def _mint(record, store, *, fuzzy_pending=False):
    cid = uuid4().hex
    for (et, k, v) in _ordered_keys(record):
        if not store.put_key(et, k, v, cid):
            return None  # race lost -> caller restarts from step 1
    store.put_entity(cid, _entity_from(record, fuzzy_pending=fuzzy_pending))
    return cid


def resolve(record, store, candidates=None):
    """Return the canonical_id for `record`, deduping against `store`.

    candidates: optional callable(record) -> list[entity] (Turso fuzzy reader).
    None means the fuzzy accelerator is unavailable -> keyless records degrade
    to fuzzy_pending mint, reconciled later by catalog_reconcile.
    """
    while True:
        triples = _ordered_keys(record)

        # Step 1: strong-key lookup (collect ALL, not first-hit).
        if triples:
            found = store.get_keys(triples)
            ids = sorted(set(found.values()), key=lambda c: _mint_ts(store, c))
            if len(ids) > 1:
                cid = merge_canonicals(store, *ids)
            elif len(ids) == 1:
                cid = ids[0]
            else:
                cid = None
            if cid:
                # capture the return: a second present key may be concurrently
                # claimed by an older rival and folded, moving the live id.
                cid = _ensure_keys(record, store, cid)  # index any unindexed present keys
                store.put_entity(cid, _entity_from(record))
                return cid

        # Step 2 + 3: fuzzy adoption / keyless (Task 7 fills this in).
        cid = _fuzzy_resolve(record, store, candidates)
        if cid:
            return cid

        # Step 4: mint (race -> None -> loop restarts at step 1).
        pending = (candidates is None) and not triples
        cid = _mint(record, store, fuzzy_pending=pending)
        if cid:
            return cid


def _ensure_keys(record, store, cid):
    """Index any present strong keys not yet pointing anywhere. On race-loss to a
    DIFFERENT id, fold the two together (closes C2 residue)."""
    for (et, k, v) in _ordered_keys(record):
        if not store.put_key(et, k, v, cid):
            other = store.get_keys([(et, k, v)]).get((et, k, v))
            if other and other != cid:
                cid = merge_canonicals(store, cid, other)
    return cid


def upsert(store, cid, record):
    """Idempotent write of `record` under canonical id `cid`. Safe to call after
    resolve() and safe to re-run (sources keyed by source#source_id)."""
    store.put_entity(store.resolve_alias(cid), _entity_from(record))


def _fuzzy_resolve(record, store, candidates):
    """Step 2/3: adopt a fuzzy-matching existing entity, else (keyless) signal mint.

    Returns a canonical_id to adopt, or None to fall through to mint.
    """
    if candidates is None:
        return None  # accelerator unavailable -> caller mints fuzzy_pending
    matcher = cc.matcher_for(record["entity_type"])
    if matcher is None:
        return None
    for cand in candidates(record):
        # candidate id field contract: Turso reader MUST attach the canonical id as
        # one of _cid / canonical_id / id (documented in CATALOG.md).
        cid = cand.get("_cid") or cand.get("canonical_id") or cand.get("id")
        if cid and matcher(record, cand):
            cid = store.resolve_alias(cid)
            cid = _ensure_keys(record, store, cid)  # adopt + index any keys this record adds
            store.put_entity(cid, _entity_from(record))
            return cid
    return None
