#!/usr/bin/env python3
"""
Bilinç — Name Suggestion Index (NSI) Brands Fetcher

Pulls the OpenStreetMap Name Suggestion Index — a curated, machine-readable
catalog of ~17K real-world brands (supermarkets, fast food, banks, fuel,
electronics, etc.), each linked to Wikidata + Wikipedia + official website.

We keep brands that are either worldwide ("001") or explicitly available in
Turkey ("tr"), minus those that exclude Turkey. Inserted as listings.

Data source: https://github.com/osmlab/name-suggestion-index (ISC license)
Access: public GitHub raw JSON, no auth.

Usage:
    python nsi-brands.py                # Dry run, print stats
    python nsi-brands.py --supabase     # Fetch + upsert into Supabase
    python nsi-brands.py --worldwide    # Also include pure-worldwide brands (default: TR-relevant only)
"""

import os
import re
import sys
import json
import logging
import argparse
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

# NSI's dist/ is gitignored build output; the published package is served via jsDelivr (npm CDN).
NSI_URL = "https://cdn.jsdelivr.net/npm/name-suggestion-index@latest/dist/nsi.json"
USER_AGENT = "BilinçApp/1.0 (https://bilinc.app; data import)"
BATCH_SIZE = 200

DATA_DIR = Path(__file__).parent / "data"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", datefmt="%H:%M:%S")
logger = logging.getLogger("nsi-brands")

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


# NSI tree key (e.g. "brands/shop/supermarket") → Bilinç top-level category slug
CATEGORY_MAP = {
    "supermarket": "market-bakkal", "convenience": "market-bakkal", "greengrocer": "market-bakkal",
    "fast_food": "restoran-lokanta", "restaurant": "restoran-lokanta", "cafe": "kafe-bar", "bar": "kafe-bar",
    "pub": "kafe-bar", "bakery": "firin-pastane", "pharmacy": "eczane", "chemist": "eczane",
    "bank": "banka-finans", "atm": "banka-finans", "fuel": "akaryakit", "car_repair": "oto-servis",
    "hotel": "otel-konaklama", "electronics": "elektronik", "mobile_phone": "elektronik",
    "clothes": "giyim", "shoes": "giyim", "hairdresser": "kuafor-berber",
}


def fetch_nsi() -> dict:
    cache = DATA_DIR / "nsi.json"
    if cache.exists():
        logger.info(f"Using cached {cache.name}")
        return json.loads(cache.read_text(encoding="utf-8"))
    logger.info("Downloading NSI dist (nsi.json)...")
    resp = requests.get(NSI_URL, headers={"User-Agent": USER_AGENT}, timeout=120)
    resp.raise_for_status()
    DATA_DIR.mkdir(exist_ok=True)
    cache.write_text(resp.text, encoding="utf-8")
    logger.info(f"Saved {cache.name} ({len(resp.content)//1024} KB)")
    return resp.json()


def _loc_set(item):
    ls = item.get("locationSet", {}) or {}
    inc = {str(x).lower() for x in ls.get("include", []) if isinstance(x, str)}
    exc = {str(x).lower() for x in ls.get("exclude", []) if isinstance(x, str)}
    return inc, exc


def tr_relevant(item, worldwide_ok: bool) -> bool:
    inc, exc = _loc_set(item)
    if any(x == "tr" or x.startswith("tr-") for x in exc):
        return False
    if any(x == "tr" or x.startswith("tr-") for x in inc):
        return True
    if worldwide_ok and "001" in inc:
        return True
    return False


def parse_nsi(data: dict, worldwide_ok: bool) -> list[dict]:
    nsi = data.get("nsi", {})
    seen, brands = set(), []
    for tree_key, block in nsi.items():
        # tree_key like "brands/shop/supermarket" or "operators/amenity/fuel"
        if not tree_key.startswith("brands/"):
            continue
        leaf = tree_key.rsplit("/", 1)[-1]
        category = CATEGORY_MAP.get(leaf)
        for item in block.get("items", []):
            if not tr_relevant(item, worldwide_ok):
                continue
            iid = item.get("id")
            name = item.get("displayName") or ""
            if not iid or not name or iid in seen:
                continue
            seen.add(iid)
            tags = item.get("tags", {}) or {}
            brands.append({
                "id": iid,
                "name": name.strip(),
                "wikidata": tags.get("brand:wikidata") or tags.get("operator:wikidata") or "",
                "website": tags.get("website") or tags.get("contact:website") or "",
                "official_name": tags.get("official_name") or "",
                "category": category,
                "leaf": leaf,
            })
    logger.info(f"Parsed {len(brands)} TR-relevant brands ({'worldwide+TR' if worldwide_ok else 'TR-only'})")
    return brands


def get_supabase():
    from supabase import create_client
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def insert_brands(brands: list[dict], dry_run: bool = True):
    if dry_run:
        logger.info(f"[DRY RUN] Would upsert {len(brands)} brands")
        from collections import Counter
        for leaf, n in Counter(b["leaf"] for b in brands).most_common(20):
            logger.info(f"  {leaf}: {n}")
        with_wd = sum(1 for b in brands if b["wikidata"])
        logger.info(f"  With Wikidata id: {with_wd}  | with website: {sum(1 for b in brands if b['website'])}")
        return

    client = get_supabase()
    total = 0
    for i in range(0, len(brands), BATCH_SIZE):
        batch = brands[i:i + BATCH_SIZE]
        rows = []
        for b in batch:
            rows.append({
                "name": b["name"][:255],
                "slug": f"nsi-{slugify(b['name'])}"[:80],
                "entity_type": "business",
                "status": "active",
                "source": "nsi",
                "source_id": f"nsi:{b['id']}",
                "description": (b["official_name"] or None),
            })
        try:
            resp = client.table("listings").upsert(rows, on_conflict="source_id").execute()
            total += len(resp.data)
            logger.info(f"Batch {i // BATCH_SIZE + 1}: upserted {len(resp.data)}")
        except Exception as e:
            logger.error(f"Batch error at {i}: {e}")
    logger.info(f"Total brands upserted: {total}")

    # Websites → listing_contacts
    contacts = []
    for b in brands:
        if not b["website"]:
            continue
        try:
            resp = client.table("listings").select("id").eq("source_id", f"nsi:{b['id']}").execute()
            if resp.data:
                contacts.append({"listing_id": resp.data[0]["id"], "website": b["website"][:255]})
        except Exception:
            pass
    for i in range(0, len(contacts), BATCH_SIZE):
        try:
            client.table("listing_contacts").upsert(contacts[i:i+BATCH_SIZE], on_conflict="listing_id").execute()
        except Exception as e:
            logger.error(f"Contact error: {e}")
    if contacts:
        logger.info(f"Upserted {len(contacts)} websites")


def main():
    parser = argparse.ArgumentParser(description="NSI Brands Fetcher")
    parser.add_argument("--supabase", action="store_true")
    parser.add_argument("--worldwide", action="store_true", help="Include pure-worldwide brands (no explicit TR)")
    args = parser.parse_args()

    data = fetch_nsi()
    brands = parse_nsi(data, worldwide_ok=args.worldwide or True)  # worldwide brands are sold in TR; keep by default

    DATA_DIR.mkdir(exist_ok=True)
    out = DATA_DIR / "nsi-brands.json"
    out.write_text(json.dumps(brands, ensure_ascii=False, indent=2), encoding="utf-8")
    logger.info(f"Saved {out}")

    insert_brands(brands, dry_run=not args.supabase)
    if not args.supabase:
        logger.info("Run with --supabase to upsert")


if __name__ == "__main__":
    main()
