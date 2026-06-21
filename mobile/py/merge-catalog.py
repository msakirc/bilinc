#!/usr/bin/env python3
"""
Bilinc -- cross-source catalog merge / dedup engine.

Reads every data/raw/<source>.jsonl produced by the scrapers, clusters records
that refer to the same real-world entity, and writes one canonical record per
cluster to data/catalog/<entity_type>.jsonl. DB-independent: runs entirely on
local files while Supabase + Turso are paused.

Dedup is two-tier (union-find over records):
  1. STRONG KEY  — any shared identity key (gtin / mbid / wikidata / gers /
     fsq / osm) unions two records immediately, even across sources/types.
     Barcodes, MBIDs and QIDs are exact → zero false merges.
  2. FUZZY (per type, only for records with no strong-key link) —
     business : Haversine <= 120m AND Turkish-folded name match
     product  : same brand + name Jaccard >= 0.6   (no barcode case)
     brand    : name Jaccard >= 0.7
     work     : name Jaccard >= 0.7 AND same year (if both known)

Fuzzy is conservative — a missed merge is a cleanable dup; a wrong merge hides a
real entity. Strong keys do the heavy lifting; fuzzy only mops up keyless rows.

Canonical record = union of all members: strong keys merged, sources[] = every
(source, source_id), name = longest/diacritic-richest, fields filled from the
richest non-null member. Field-level provenance kept in `_provenance`.

Usage:
    python merge-catalog.py                 # merge all raw -> data/catalog/
    python merge-catalog.py --report        # dedup stats only, write nothing
"""

import sys
import json
import logging
import argparse
from pathlib import Path
from collections import defaultdict

import catalog_common as cc
from catalog_common import (
    CATALOG_DIR, STRONG_KEYS, ENTITY_BUSINESS, name_tokens,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s",
                    datefmt="%H:%M:%S")
logger = logging.getLogger("merge-catalog")

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Pair matchers + their thresholds live in catalog_common (cc.matcher_for); this
# file owns only the blocking that generates candidate pairs.
GRID_DP = 3  # ~100m blocking cell


# ---------------------------------------------------------------------------
# Union-Find
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Blocking + pair matching
# ---------------------------------------------------------------------------

def _grid_key(lat, lon):
    return (round(lat, GRID_DP), round(lon, GRID_DP))


def fuzzy_pairs(records, idxs):
    """Yield (i, j) candidate pairs within one entity_type via cheap blocking.

    business → spatial grid (3x3 neighbourhood). everything else → shared name
    token (first 2 chars of each token) so we never do a full O(n^2) sweep.
    """
    if not idxs:
        return
    etype = records[idxs[0]]["entity_type"]

    if etype == ENTITY_BUSINESS:
        grid = defaultdict(list)
        for i in idxs:
            r = records[i]
            if r.get("lat") is not None:
                grid[_grid_key(r["lat"], r["lon"])].append(i)
            else:
                grid[("nogeo",)].append(i)
        step = 10 ** (-GRID_DP)
        seen = set()
        for i in idxs:
            r = records[i]
            if r.get("lat") is None:
                cells = [("nogeo",)]
            else:
                gk = _grid_key(r["lat"], r["lon"])
                cells = [(round(gk[0] + dx, GRID_DP), round(gk[1] + dy, GRID_DP))
                         for dx in (-step, 0, step) for dy in (-step, 0, step)]
            for cell in cells:
                for j in grid.get(cell, ()):
                    if i < j and (i, j) not in seen:
                        seen.add((i, j))
                        yield i, j
    else:
        token_idx = defaultdict(list)
        for i in idxs:
            for t in name_tokens(records[i]["name"]):
                token_idx[t[:3]].append(i)
        seen = set()
        for bucket in token_idx.values():
            for a in range(len(bucket)):
                for b in range(a + 1, len(bucket)):
                    i, j = bucket[a], bucket[b]
                    if i > j:
                        i, j = j, i
                    if (i, j) not in seen:
                        seen.add((i, j))
                        yield i, j


# ---------------------------------------------------------------------------
# Canonical merge
# ---------------------------------------------------------------------------

def _best_name(members):
    # Prefer the longest name; tie-break toward one carrying Turkish diacritics.
    def score(n):
        return (len(n), sum(ch in "şŞıİğĞüÜöÖçÇ" for ch in n))
    return max((m["name"] for m in members), key=score)


def merge_cluster(members):
    keys = {}
    sources = []
    public, private, attrs = {}, {}, {}
    aliases = set()
    lat = lon = None
    prov = {}

    # Richest-first so first-writer-wins fills from the most complete member.
    members = sorted(members, key=lambda m: -(len(m.get("public", {})) + len(m.get("attrs", {}))))

    for m in members:
        sources.append({"source": m["source"], "source_id": m["source_id"]})
        for k, v in m.get("keys", {}).items():
            keys.setdefault(k, v)
        for k, v in m.get("public", {}).items():
            if v and k not in public:
                public[k] = v
                prov[f"public.{k}"] = m["source"]
        for k, v in m.get("private", {}).items():
            if v and k not in private:
                private[k] = v
        for k, v in m.get("attrs", {}).items():
            if v and k not in attrs:
                attrs[k] = v
        for a in m.get("aliases", []):
            aliases.add(a)
        if lat is None and m.get("lat") is not None:
            lat, lon = m["lat"], m["lon"]

    canonical_name = _best_name(members)
    aliases.update(m["name"] for m in members if m["name"] != canonical_name)

    return {
        "entity_type": members[0]["entity_type"],
        "name": canonical_name,
        "keys": keys,
        "lat": lat, "lon": lon,
        "public": public,
        "private": private,
        "attrs": attrs,
        "aliases": sorted(aliases),
        "sources": sources,
        "_provenance": prov,
    }


# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------

def run(report_only: bool):
    records = list(cc.iter_raw())
    if not records:
        logger.warning("No raw records in data/raw/. Run scrapers with their local sink first.")
        return
    logger.info(f"Loaded {len(records)} raw records from data/raw/*.jsonl")

    uf = UF(len(records))

    # Tier 1: strong keys union across EVERYTHING (cross-type allowed — a brand
    # and a product may share a wikidata id; that's a real link).
    key_owner = {}
    for i, r in enumerate(records):
        for kname in STRONG_KEYS:
            v = r.get("keys", {}).get(kname)
            if not v:
                continue
            kk = (kname, v)
            if kk in key_owner:
                uf.union(key_owner[kk], i)
            else:
                key_owner[kk] = i
    strong_clusters = len({uf.find(i) for i in range(len(records))})
    logger.info(f"After strong-key union: {strong_clusters} clusters")

    # Tier 2: fuzzy, per entity_type, only among records still keyless-isolated
    # (we still run it over all — union is idempotent and catches partial keys).
    by_type = defaultdict(list)
    for i, r in enumerate(records):
        by_type[r["entity_type"]].append(i)

    fuzzy_unions = 0
    for etype, idxs in by_type.items():
        matcher = cc.matcher_for(etype)
        if not matcher:
            logger.warning(f"No fuzzy matcher for type '{etype}' — strong keys only")
            continue
        for i, j in fuzzy_pairs(records, idxs):
            if uf.find(i) == uf.find(j):
                continue
            if matcher(records[i], records[j]):
                uf.union(i, j)
                fuzzy_unions += 1
    logger.info(f"Fuzzy unions: {fuzzy_unions}")

    # Build clusters
    clusters = defaultdict(list)
    for i in range(len(records)):
        clusters[uf.find(i)].append(records[i])

    canon = [merge_cluster(ms) for ms in clusters.values()]
    dupes = len(records) - len(canon)
    logger.info(f"Canonical entities: {len(canon)} "
                f"({dupes} duplicates collapsed, {dupes / len(records) * 100:.1f}%)")

    # Per-type + per-source-overlap report
    by_canon_type = defaultdict(int)
    multi_source = 0
    for c in canon:
        by_canon_type[c["entity_type"]] += 1
        if len({s["source"] for s in c["sources"]}) > 1:
            multi_source += 1
    for t, n in sorted(by_canon_type.items()):
        logger.info(f"  {t}: {n}")
    logger.info(f"Entities backed by >1 source: {multi_source}")

    if report_only:
        logger.info("[REPORT] nothing written")
        return

    CATALOG_DIR.mkdir(parents=True, exist_ok=True)
    out = defaultdict(list)
    for c in canon:
        out[c["entity_type"]].append(c)
    for t, recs in out.items():
        path = CATALOG_DIR / f"{t}.jsonl"
        with open(path, "w", encoding="utf-8") as f:
            for r in recs:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
        logger.info(f"Wrote {len(recs)} -> {path}")


def main():
    p = argparse.ArgumentParser(description="Cross-source catalog merge / dedup")
    p.add_argument("--report", action="store_true", help="Stats only, write nothing")
    args = p.parse_args()
    run(report_only=args.report)


if __name__ == "__main__":
    main()
