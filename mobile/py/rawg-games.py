#!/usr/bin/env python3
"""
⛔ DO NOT USE — NOT COMMERCIALLY FREE. RAWG is non-commercial only; commercial
use needs a written grant (see docs/commercial-grant-needed.md). This script is
DORMANT: excluded from the merge pipeline (no --local sink), do not run, do not
wire, until a commercial license is secured.

Bilinç — RAWG Video Games Fetcher

Pulls video game titles (products) from the RAWG.io database — 500K+ games
with cover art, release date, genres and platforms. Games are global products
sold in Turkey, so no country filter is applied.

Data source: https://rawg.io/apidocs (free API key required)
License: RAWG content is free for non-commercial; commercial use requires
attribution + a link back to rawg.io per their ToS. Keep the attribution on
any game listing page. Set RAWG_API_KEY in py/.env (free at rawg.io/apidocs).

Usage:
    python rawg-games.py                       # Dry run, first few pages
    python rawg-games.py --supabase            # Upsert to Supabase
    python rawg-games.py --max-pages 200       # Up to 200 pages x 40 = 8000 games
    python rawg-games.py --ordering -added     # RAWG ordering (default: -added = popular first)
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
RAWG_API_KEY = os.environ.get("RAWG_API_KEY", "")

RAWG_BASE = "https://api.rawg.io/api"
PAGE_SIZE = 40
BATCH_SIZE = 200

DATA_DIR = Path(__file__).parent / "data"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", datefmt="%H:%M:%S")
logger = logging.getLogger("rawg-games")

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


def fetch_games(max_pages: int, ordering: str) -> list[dict]:
    if not RAWG_API_KEY:
        logger.error("RAWG_API_KEY not set in py/.env — get a free key at https://rawg.io/apidocs")
        sys.exit(1)
    out = []
    for page in range(1, max_pages + 1):
        params = {"key": RAWG_API_KEY, "page": page, "page_size": PAGE_SIZE, "ordering": ordering}
        resp = requests.get(f"{RAWG_BASE}/games", params=params, timeout=60)
        if resp.status_code == 429:
            logger.warning("429 rate-limited, sleeping 10s")
            time.sleep(10)
            continue
        resp.raise_for_status()
        data = resp.json()
        results = data.get("results", [])
        if not results:
            break
        for g in results:
            if not g.get("name") or not g.get("slug"):
                continue
            out.append({
                "rawg_id": g["id"],
                "rawg_slug": g["slug"],
                "name": g["name"],
                "released": g.get("released") or "",
                "image_url": g.get("background_image") or "",
                "genres": ", ".join(x.get("name", "") for x in g.get("genres", [])),
                "metacritic": g.get("metacritic"),
            })
        logger.info(f"  page {page}/{max_pages}: {len(results)} games (total {len(out)})")
        if not data.get("next"):
            break
        time.sleep(0.3)
    return out


def get_supabase():
    from supabase import create_client
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def insert_games(games: list[dict], dry_run: bool = True):
    if dry_run:
        logger.info(f"[DRY RUN] Would upsert {len(games)} games")
        for g in games[:15]:
            logger.info(f"  {g['name']} ({g['released'][:4] or '?'}) — {g['genres'] or 'no genre'}")
        logger.info(f"  With image: {sum(1 for g in games if g['image_url'])}")
        return

    client = get_supabase()
    total = 0
    for i in range(0, len(games), BATCH_SIZE):
        batch = games[i:i + BATCH_SIZE]
        rows = []
        for g in batch:
            desc = " — ".join(x for x in [g["genres"], g["released"][:4]] if x) or None
            rows.append({
                "name": g["name"][:255],
                "slug": f"rawg-{slugify(g['rawg_slug'] or g['name'])}"[:80],
                "entity_type": "business",
                "status": "active",
                "source": "rawg",
                "source_id": f"rawg:{g['rawg_id']}",
                "description": desc,
            })
        try:
            resp = client.table("listings").upsert(rows, on_conflict="source_id").execute()
            total += len(resp.data)
            logger.info(f"Batch {i // BATCH_SIZE + 1}: upserted {len(resp.data)}")
        except Exception as e:
            logger.error(f"Batch error at {i}: {e}")
    logger.info(f"Total games upserted: {total}")


def main():
    parser = argparse.ArgumentParser(description="RAWG Video Games Fetcher")
    parser.add_argument("--supabase", action="store_true")
    parser.add_argument("--max-pages", type=int, default=5, help="Pages of 40 games each")
    parser.add_argument("--ordering", default="-added", help="RAWG ordering field")
    args = parser.parse_args()

    games = fetch_games(args.max_pages, args.ordering)
    logger.info(f"=== Fetched {len(games)} games ===")

    DATA_DIR.mkdir(exist_ok=True)
    out = DATA_DIR / "rawg-games.json"
    out.write_text(json.dumps(games, ensure_ascii=False, indent=2), encoding="utf-8")
    logger.info(f"Saved {out}")

    insert_games(games, dry_run=not args.supabase)
    if not args.supabase:
        logger.info("Run with --supabase to upsert")


if __name__ == "__main__":
    main()
