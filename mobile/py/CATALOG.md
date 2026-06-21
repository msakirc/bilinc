# Catalog dedup — the ONE way to add catalog data

Every scraper (business / product / brand / work) MUST dedup through
`catalog_identity`. Do NOT write your own normalization or matching.

    import catalog_common as cc
    from catalog_identity import resolve, upsert

    rec = cc.make_record(entity_type=..., source=..., source_id=..., name=..., keys=...)
    cid = resolve(rec, store, candidates=turso_candidates)  # candidates=None if Turso down
    upsert(store, cid, rec)

- Authority = DynamoDB (`catalog_store.DynamoStore`). Turso = read-only fuzzy
  accelerator; pass `candidates=None` when unavailable (writes currently blocked).
- `candidates` is a callable `(record) -> list[entity-dict]`. Each candidate dict
  MUST carry its canonical id as `_cid` (or `canonical_id` / `id`) or fuzzy adoption
  silently won't fire. Candidates should also carry `name`, `lat`, `lon`, `attrs` so
  the matchers can score them.
- Run tests from `mobile/py/`: `cd mobile/py && python -m pytest -q` (top-level
  modules `catalog_common`/`catalog_identity` only resolve with that cwd).
- `canonical_id` is an opaque uuid. Strong keys (gtin/mbid/wikidata/gers/fsq/osm)
  live in type-scoped index items. A shared key across types is a relationship
  (`links[]`), NOT a merge.
- games + music = entity_type `work`, not product.
- Identity logic + merge_canonicals: see
  `docs/superpowers/specs/2026-06-20-catalog-dedup-design.md`.
- Run the reconcile sweep periodically: `python catalog_reconcile.py`.
