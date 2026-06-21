"""One-time backfill: dedup the legacy L#/META items in DynamoDB bilinc-catalog
into canonical ENTITY#/XKEY# items via a global in-memory union-find snapshot pass.

This is NOT the incremental resolver (catalog_identity.resolve) — historical data is
a static snapshot, so global union-find (merge-catalog's model) gives transitive +
order-independent clustering with no Turso dependency. canonical_id is deterministic
(uuid5).

--write is a ONE-SHOT pass over the COMPLETE snapshot. Re-running the SAME snapshot
is idempotent (deterministic ids). Re-running over a GROWING snapshot can orphan
keyless / multi-key entities (their seed depends on which members/keys are present),
so only run once the upload is complete — do NOT run while the upload is still filling.

backfill() returns the L#->canonical redirect map (legacy L#<id> -> ENTITY#<cid>) so
the remap is recoverable. ACTUALLY STAMPING the redirect onto legacy L# items is a
live boto3 follow-up (deferred), not done here.

Run (after Supabase+Turso unblock + phone-scrub + upload complete):
    python catalog_backfill.py --report     # cluster + stats, write nothing
    python catalog_backfill.py --write       # write ENTITY#/XKEY# (one-shot)
"""
import uuid
import logging
from collections import defaultdict

import catalog_common as cc

logger = logging.getLogger("catalog-backfill")

NAMESPACE = uuid.UUID("6f4a1e2c-1d3b-4a5c-9e7f-0a1b2c3d4e5f")

# source_id -> strong-key extraction. Keys named to match catalog_common.STRONG_KEYS.
_COLON_MAP = {"foursquare": "fsq", "overture": "gers", "wikidata": "wikidata",
              "off": "gtin", "opf": "gtin", "openproductsfacts": "gtin",
              "kaggle": "gtin", "musicbrainz": "mbid", "mb": "mbid"}


def keys_from_source(source, source_id):
    """Map a legacy (source, source_id) to a strong-keys dict. Returns {} when the
    source_id carries no recognised strong identity (e.g. synthetic catalog slugs)."""
    if not source_id:
        return {}
    sid = str(source_id)
    if sid.startswith("osm_"):
        return {"osm": sid[len("osm_"):]}
    if ":" in sid:
        prefix, _, rest = sid.partition(":")
        kname = _COLON_MAP.get(prefix.lower())
        # only the single-value forms carry a real key; multi-colon slugs (catalog:x:y) do not
        if kname and ":" not in rest:
            return {kname: rest}
    return {}


GRID_DP = 3  # ~100m blocking cell for businesses
WINDOW = 25  # sorted-neighborhood comparison window (non-business fuzzy blocking)


class UF:
    def __init__(self, n):
        self.p = list(range(n))
        self.r = [0] * n

    def find(self, x):
        while self.p[x] != x:
            self.p[x] = self.p[self.p[x]]
            x = self.p[x]
        return x

    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra == rb:
            return
        if self.r[ra] < self.r[rb]:
            ra, rb = rb, ra
        self.p[rb] = ra
        if self.r[ra] == self.r[rb]:
            self.r[ra] += 1


def _grid_key(lat, lon):
    return (round(lat, GRID_DP), round(lon, GRID_DP))


def _fuzzy_pairs(records, idxs):
    """Yield candidate (i, j) within one entity_type via cheap blocking, so we never
    do a full O(n^2) sweep. business -> 3x3 spatial grid; else -> sorted-neighborhood
    over name-token prefix buckets.

    No global `seen` set: duplicate (i, j) pairs are harmless because cluster() guards
    every pair with uf.find(i) != uf.find(j) and union is idempotent — so dropping
    `seen` removes the O(pairs) memory blowup at zero correctness cost.
    """
    if not idxs:
        return
    etype = records[idxs[0]]["entity_type"]
    if etype == cc.ENTITY_BUSINESS:
        # SKIP geo-less businesses entirely: match_business(require_geo=True) always
        # returns False when either side lacks lat, so those comparisons are 100% wasted.
        grid = defaultdict(list)
        for i in idxs:
            r = records[i]
            if r.get("lat") is None:
                continue
            grid[_grid_key(r["lat"], r["lon"])].append(i)
        step = 10 ** (-GRID_DP)
        for i in idxs:
            r = records[i]
            if r.get("lat") is None:
                continue
            gk = _grid_key(r["lat"], r["lon"])
            cells = [(round(gk[0] + dx, GRID_DP), round(gk[1] + dy, GRID_DP))
                     for dx in (-step, 0, step) for dy in (-step, 0, step)]
            for cell in cells:
                for j in grid.get(cell, ()):
                    if i < j:  # dup pairs across overlapping cells are fine (no `seen`)
                        yield i, j
    else:
        # Sorted-neighborhood (bounded): within each 3-char prefix bucket, sort members
        # by name and only compare each to the next WINDOW positions -> O(bucket*WINDOW).
        # Approximation: true dups with very different names in the same prefix bucket but
        # beyond the window may be missed. Acceptable for a snapshot tool — a missed merge
        # is just a cleanable dup; reconcile/run again later.
        token_idx = defaultdict(list)
        for i in idxs:
            for t in cc.name_tokens(records[i]["name"]):
                token_idx[t[:3]].append(i)
        for bucket in token_idx.values():
            bucket = sorted(bucket, key=lambda x: records[x]["name"])
            for a in range(len(bucket)):
                for b in range(a + 1, min(a + 1 + WINDOW, len(bucket))):
                    i, j = (bucket[a], bucket[b]) if bucket[a] < bucket[b] else (bucket[b], bucket[a])
                    yield i, j


def cluster(records):
    """Global union-find over a snapshot. Returns a list of clusters (each a list of
    records). Strong keys union across sources/types; fuzzy unions within a type only."""
    uf = UF(len(records))
    key_owner = {}
    for i, r in enumerate(records):
        etype = r["entity_type"]
        for kname, val in r.get("keys", {}).items():
            # Scope by entity_type: a brand and a product sharing the same wikidata QID
            # are NOT merged (matches the resolver's type-scoped key index, spec §7).
            kk = (etype, kname, str(val))
            if kk in key_owner:
                uf.union(key_owner[kk], i)
            else:
                key_owner[kk] = i
    by_type = defaultdict(list)
    for i, r in enumerate(records):
        by_type[r["entity_type"]].append(i)
    for etype, idxs in by_type.items():
        matcher = cc.matcher_for(etype)
        if not matcher:
            continue
        for i, j in _fuzzy_pairs(records, idxs):
            if uf.find(i) != uf.find(j) and matcher(records[i], records[j]):
                uf.union(i, j)
    groups = defaultdict(list)
    for i in range(len(records)):
        groups[uf.find(i)].append(records[i])
    return list(groups.values())


def canonical_id_for(members):
    """Deterministic canonical id (uuid5). Same real entity -> same id across re-runs.

    KEYED case (any member has a strong key): seed on the FULL sorted set of strong
    keys present in the cluster, so the id is invariant to which key appeared first
    within the complete snapshot. KEYLESS case: seed on the sorted member L# ids.

    The seed is PREFIXED with entity_type: clusters are single-type (cluster() scopes
    the strong-key union by type), and two different types sharing a strong key (e.g. a
    brand and a product on the same wikidata QID) are distinct entities that must NOT
    collide onto one id. \x1f (unit separator) joins ids so a value can't span fields.
    """
    etype = members[0]["entity_type"]
    key_parts = sorted(f"{kn}:{v}"
                       for m in members
                       for kn, v in m.get("keys", {}).items())
    if key_parts:
        seed = f"{etype}:keys:" + "\x1f".join(key_parts)
    else:
        ids = sorted(m.get("_pk", m.get("source_id", "")) for m in members)
        seed = f"{etype}:members:" + "\x1f".join(ids)
    return uuid.uuid5(NAMESPACE, seed).hex


def _best_name(members):
    """Pick the richest display name: longest, then most Turkish diacritics. Ties on
    (length, diacritic-count) are broken deterministically by lexically smallest name,
    so the result is invariant to member ordering."""
    names = [m["name"] for m in members]

    def diac(n):
        return sum(ch in "şŞıİğĞüÜöÖçÇ" for ch in n)

    best_score = max((len(n), diac(n)) for n in names)
    return min(n for n in names if (len(n), diac(n)) == best_score)


def merge_cluster(members):
    """Collapse a cluster into one canonical entity dict (no id; caller stamps it).
    First-writer-wins from the richest member; sources/keys/aliases unioned."""
    members = sorted(members, key=lambda m: -(len(m.get("public", {})) + len(m.get("attrs", {}))))
    keys, public, private, attrs = {}, {}, {}, {}
    aliases, sources = set(), {}
    lat = lon = None
    for m in members:
        sources[f"{m['source']}#{m['source_id']}"] = {"source": m["source"], "source_id": m["source_id"]}
        for k, v in m.get("keys", {}).items():
            keys.setdefault(k, str(v))
        for k, v in m.get("public", {}).items():
            if v:
                public.setdefault(k, v)
        for k, v in m.get("attrs", {}).items():
            if v:
                attrs.setdefault(k, v)
        for a in m.get("aliases", []):
            aliases.add(a)
        if lat is None and m.get("lat") is not None:
            lat, lon = m["lat"], m["lon"]
    name = _best_name(members)
    aliases.update(m["name"] for m in members if m["name"] != name)
    return {
        "entity_type": members[0]["entity_type"], "name": name,
        "keys": keys, "lat": lat, "lon": lon,
        "public": public, "private": private, "attrs": attrs,
        "aliases": sorted(aliases), "sources": sources,
        "links": [], "fuzzy_pending": False,
    }


def backfill(record_iter, store, *, write):
    """Cluster all records (global snapshot UF), then write one canonical entity per
    cluster with a deterministic id. Returns stats dict (write=False => report only).

    stats["redirect"] is the legacy L#<id> -> canonical ENTITY#<cid> map, so the remap
    is recoverable; empty {} when write=False. ACTUALLY STAMPING the redirect onto the
    legacy L# items is a live boto3 follow-up (deferred), not done here."""
    records = list(record_iter)
    clusters = cluster(records)
    stats = {"records": len(records), "entities": len(clusters),
             "collapsed": len(records) - len(clusters), "redirect": {}}
    if not write:
        logger.info("[report] %(records)d records -> %(entities)d entities "
                    "(%(collapsed)d collapsed)", stats)
        return stats
    redirect = stats["redirect"]
    for members in clusters:
        cid = canonical_id_for(members)
        entity = merge_cluster(members)
        entity["mint_ts"] = 0.0  # backfill epoch; live mints use time.time()
        store.put_entity(cid, entity)
        et = entity["entity_type"]
        for kname, val in entity["keys"].items():
            store.put_key(et, kname, str(val), cid)
        for m in members:
            pk = m.get("_pk")
            if pk:
                redirect[pk] = cid
    logger.info("[write] %(records)d records -> %(entities)d entities "
                "(%(collapsed)d collapsed)", stats)
    return stats


def _scan_legacy(table_name):  # pragma: no cover  (live boto3, integration-deferred)
    """Yield raw records adapted from L#/META items in DynamoDB. Resumable scan."""
    import boto3
    from boto3.dynamodb.conditions import Attr
    t = boto3.resource("dynamodb").Table(table_name)
    kwargs = {"FilterExpression": Attr("SK").eq("META")}
    while True:
        resp = t.scan(**kwargs)
        for it in resp.get("Items", []):
            lat = it.get("latitude"); lon = it.get("longitude")
            rec = cc.make_record(
                entity_type=it.get("entityType") or "business",
                source=it.get("source") or "legacy",
                source_id=it.get("sourceId") or it["PK"],
                name=it.get("name") or "?",
                keys=keys_from_source(it.get("source"), it.get("sourceId")),
                lat=float(lat) if lat is not None else None,
                lon=float(lon) if lon is not None else None,
                public={k: it.get(k) for k in ("slug", "cityCode", "addressLine") if it.get(k)},
            )
            rec["_pk"] = it["PK"]
            yield rec
        lek = resp.get("LastEvaluatedKey")
        if not lek:
            break
        kwargs["ExclusiveStartKey"] = lek


if __name__ == "__main__":  # pragma: no cover
    import os, argparse
    from catalog_store import DynamoStore
    logging.basicConfig(level=logging.INFO)
    ap = argparse.ArgumentParser(description="One-time legacy catalog backfill/dedup")
    ap.add_argument("--write", action="store_true",
                    help="ONE-SHOT persist over the COMPLETE snapshot (default: report "
                         "only). Re-running the same snapshot is idempotent; re-running "
                         "a still-filling snapshot can orphan entities — run once, after "
                         "the upload is complete.")
    ap.add_argument("--table", default=os.environ.get("CATALOG_TABLE", "bilinc-catalog"))
    args = ap.parse_args()
    backfill(_scan_legacy(args.table), DynamoStore(table_name=args.table), write=args.write)
