#!/usr/bin/env python3
"""
Bilinç — MusicBrainz Turkish Labels & Artists Fetcher

Pulls Turkish record labels (brands) and artists (creators) from the
MusicBrainz database via its public web service. Optionally pulls each
artist's release-groups (albums = products). CC0 data.

Data source: https://musicbrainz.org (CC0 / public domain core data)
Access: public WS/2 API. Hard rate limit ~1 req/sec — script paces itself.

Usage:
    python musicbrainz.py                 # Dry run: labels + artists
    python musicbrainz.py --supabase      # Upsert labels + artists to Supabase
    python musicbrainz.py --releases      # Also fetch release-groups per artist (slow)
"""

import os
import re
import sys
import json
import time
import logging
import argparse
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

MB_BASE = "https://musicbrainz.org/ws/2"
USER_AGENT = "BilinçApp/1.0 (https://bilinc.app; data import; sakircimen@gmail.com)"
BATCH_SIZE = 200
PAGE = 100
RATE_SLEEP = 1.1  # MusicBrainz: max 1 req/sec

DATA_DIR = Path(__file__).parent / "data"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", datefmt="%H:%M:%S")
logger = logging.getLogger("musicbrainz")

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


def slugify(name: str) -> str:
    tr_map = {'ş':'s','Ş':'S','ı':'i','İ':'I','ğ':'g','Ğ':'G','ü':'u','Ü':'U','ö':'o','Ö':'O','ç':'c','Ç':'C'}
    slug = name.lower()
    for tr, en in tr_map.items():
        slug = slug.replace(tr, en)
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s_]+', '-', slug)
    slug = re.sub(r'-+', '-', slug).strip('-')[:80]
    return slug


def mb_get(path: str, params: dict) -> dict:
    params = {**params, "fmt": "json"}
    resp = requests.get(f"{MB_BASE}/{path}", params=params,
                        headers={"User-Agent": USER_AGENT}, timeout=60)
    if resp.status_code == 503:
        logger.warning("503 rate-limited, backing off 5s")
        time.sleep(5)
        return mb_get(path, params)
    resp.raise_for_status()
    time.sleep(RATE_SLEEP)
    return resp.json()


def search_all(entity: str, query: str, list_key: str) -> list[dict]:
    """Paginate a MusicBrainz search until exhausted."""
    out, offset = [], 0
    while True:
        data = mb_get(entity, {"query": query, "limit": PAGE, "offset": offset})
        items = data.get(list_key, [])
        out.extend(items)
        count = data.get("count", 0)
        logger.info(f"  {entity}: {len(out)}/{count}")
        offset += PAGE
        if offset >= count or not items:
            break
    return out


def fetch_labels() -> list[dict]:
    logger.info("=== Turkish labels (brands) ===")
    raw = search_all("label", "country:TR", "labels")
    return [{
        "mbid": l["id"],
        "name": l.get("name", ""),
        "entity_kind": "label",
        "type": l.get("type", ""),
        "disambiguation": l.get("disambiguation", ""),
    } for l in raw if l.get("name")]


def fetch_artists() -> list[dict]:
    logger.info("=== Turkish artists (creators) ===")
    raw = search_all("artist", "country:TR", "artists")
    return [{
        "mbid": a["id"],
        "name": a.get("name", ""),
        "entity_kind": "artist",
        "type": a.get("type", ""),
        "disambiguation": a.get("disambiguation", ""),
    } for a in raw if a.get("name")]


def fetch_release_groups(artists: list[dict]) -> list[dict]:
    logger.info(f"=== Release-groups for {len(artists)} artists (slow) ===")
    out = []
    for i, a in enumerate(artists):
        try:
            data = mb_get("release-group", {"artist": a["mbid"], "limit": PAGE})
            for rg in data.get("release-groups", []):
                if not rg.get("title"):
                    continue
                out.append({
                    "mbid": rg["id"],
                    "name": rg["title"],
                    "entity_kind": "release-group",
                    "type": rg.get("primary-type", ""),
                    "disambiguation": a["name"],  # artist name as parent hint
                })
        except Exception as e:
            logger.warning(f"  {a['name']}: {e}")
        if (i + 1) % 25 == 0:
            logger.info(f"  {i+1}/{len(artists)} artists, {len(out)} release-groups")
    return out


def get_supabase():
    from supabase import create_client
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def insert_items(items: list[dict], dry_run: bool = True):
    if dry_run:
        logger.info(f"[DRY RUN] Would upsert {len(items)} items")
        from collections import Counter
        for k, n in Counter(i["entity_kind"] for i in items).most_common():
            logger.info(f"  {k}: {n}")
        for it in items[:10]:
            logger.info(f"  {it['name']} ({it['entity_kind']}) — {it['type'] or '?'}")
        return

    client = get_supabase()
    total = 0
    for i in range(0, len(items), BATCH_SIZE):
        batch = items[i:i + BATCH_SIZE]
        rows = []
        for it in batch:
            desc = " — ".join(x for x in [it["type"], it["disambiguation"]] if x) or None
            rows.append({
                "name": it["name"][:255],
                "slug": f"mb-{slugify(it['name'])}"[:80],
                "entity_type": "business",
                "status": "active",
                "source": "musicbrainz",
                "source_id": f"mb:{it['mbid']}",
                "description": desc,
            })
        try:
            resp = client.table("listings").upsert(rows, on_conflict="source_id").execute()
            total += len(resp.data)
            logger.info(f"Batch {i // BATCH_SIZE + 1}: upserted {len(resp.data)}")
        except Exception as e:
            logger.error(f"Batch error at {i}: {e}")
    logger.info(f"Total upserted: {total}")


def main():
    parser = argparse.ArgumentParser(description="MusicBrainz Turkish Labels & Artists")
    parser.add_argument("--supabase", action="store_true")
    parser.add_argument("--releases", action="store_true", help="Also fetch release-groups (slow)")
    args = parser.parse_args()

    items = fetch_labels() + fetch_artists()
    if args.releases:
        artists = [i for i in items if i["entity_kind"] == "artist"]
        items += fetch_release_groups(artists)

    # Dedup by mbid
    seen, deduped = set(), []
    for it in items:
        if it["mbid"] not in seen:
            seen.add(it["mbid"])
            deduped.append(it)
    items = deduped
    logger.info(f"=== Total: {len(items)} unique items ===")

    DATA_DIR.mkdir(exist_ok=True)
    out = DATA_DIR / "musicbrainz.json"
    out.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
    logger.info(f"Saved {out}")

    insert_items(items, dry_run=not args.supabase)
    if not args.supabase:
        logger.info("Run with --supabase to upsert")


if __name__ == "__main__":
    main()
