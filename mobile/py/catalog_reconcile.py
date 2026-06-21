# mobile/py/catalog_reconcile.py
"""Periodic reconcile sweep: collapse fuzzy_pending duplicates that were minted
while the Turso fuzzy accelerator was unavailable. Enumerates via the sparse
fuzzy_pending index (Store.iter_fuzzy_pending) — never a full scan.

Usage: python catalog_reconcile.py   (wires DynamoStore in __main__)
"""
import logging
from collections import defaultdict

import catalog_common as cc
from catalog_identity import merge_canonicals

logger = logging.getLogger("catalog-reconcile")


def _block_key(e):
    et = e["entity_type"]
    if et == cc.ENTITY_BUSINESS and e.get("lat") is not None:
        return (et, round(e["lat"], 3), round(e["lon"], 3))
    toks = cc.name_tokens(e["name"])
    return (et, min(toks)[:3]) if toks else (et, "")


def reconcile(store):
    """Returns the number of merges performed."""
    pending = list(store.iter_fuzzy_pending())
    blocks = defaultdict(list)
    for cid, e in pending:
        blocks[_block_key(e)].append((cid, e))

    merges = 0
    for bucket in blocks.values():
        for i in range(len(bucket)):
            ci, ei = bucket[i]
            ci = store.resolve_alias(ci)
            matcher = cc.matcher_for(ei["entity_type"])
            if matcher is None:
                continue
            for j in range(i + 1, len(bucket)):
                cj, ej = bucket[j]
                cj = store.resolve_alias(cj)
                if ci == cj:
                    continue
                if matcher(ei, ej):
                    surv = merge_canonicals(store, ci, cj)
                    store.clear_fuzzy_pending(surv)  # authoritative clear (works on DynamoStore too)
                    merges += 1
                    ci = surv
    logger.info("reconcile: %d pending, %d merges", len(pending), merges)
    return merges


if __name__ == "__main__":  # pragma: no cover
    from catalog_store import DynamoStore
    logging.basicConfig(level=logging.INFO)
    reconcile(DynamoStore())
