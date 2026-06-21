#!/usr/bin/env python3
"""
Bilinç — Open Products Facts + Open Pet Food Facts Fetcher

Sister databases of Open Food Facts covering generic products (Open Products
Facts) and pet food (Open Pet Food Facts). Same ODbL license, same barcode
model — reuses the off-products approach but on the smaller tab-delimited CSV
exports. Filters to Turkish-tagged products by default.

Data source: https://world.openproductsfacts.org / https://world.openpetfoodfacts.org (ODbL)
Access: public static CSV exports, no auth.

Usage:
    python openproductsfacts.py                 # Download + process, dry run
    python openproductsfacts.py --supabase      # Also push to Supabase
    python openproductsfacts.py --all           # Keep all countries, not just Turkey
    python openproductsfacts.py --skip-download  # Reuse cached CSVs
"""

import os
import re
import sys
import csv
import json
import hashlib
import logging
import argparse
from pathlib import Path
from collections import defaultdict

import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

SOURCES = {
    "openproductsfacts": "https://static.openproductsfacts.org/data/en.openproductsfacts.org.products.csv",
    "openpetfoodfacts": "https://static.openpetfoodfacts.org/data/en.openpetfoodfacts.org.products.csv",
}
SOURCE_PREFIX = {"openproductsfacts": "opf", "openpetfoodfacts": "opff"}

DATA_DIR = Path(__file__).parent / "data"
BATCH_SIZE = 200

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", datefmt="%H:%M:%S")
logger = logging.getLogger("openproductsfacts")

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

csv.field_size_limit(min(sys.maxsize, 2**31 - 1))


def slugify(name: str) -> str:
    tr_map = {'ş':'s','Ş':'S','ı':'i','İ':'I','ğ':'g','Ğ':'G','ü':'u','Ü':'U','ö':'o','Ö':'O','ç':'c','Ç':'C'}
    slug = name.lower()
    for tr, en in tr_map.items():
        slug = slug.replace(tr, en)
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s_]+', '-', slug)
    slug = re.sub(r'-+', '-', slug).strip('-')[:80]
    return slug


def download(url: str, dest: Path):
    if dest.exists():
        logger.info(f"Using cached {dest.name} ({dest.stat().st_size//1024} KB)")
        return
    logger.info(f"Downloading {dest.name}...")
    resp = requests.get(url, stream=True, timeout=60)
    resp.raise_for_status()
    dest.parent.mkdir(exist_ok=True)
    with open(dest, "wb") as f:
        for chunk in resp.iter_content(chunk_size=8192 * 16):
            f.write(chunk)
    logger.info(f"Downloaded {dest.name} ({dest.stat().st_size//1024} KB)")


def load_products(csv_path: Path, source: str, keep_all: bool) -> list[dict]:
    latin_re = re.compile(r'[a-zA-ZçÇğĞıİöÖşŞüÜ]')
    products = []
    with open(csv_path, encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for row in reader:
            countries = (row.get("countries_tags") or "").lower()
            if not keep_all and "en:turkey" not in countries and "turkey" not in countries:
                continue
            name = (row.get("product_name") or "").strip()
            if len(name) < 2 or not latin_re.search(name):
                continue
            barcode = (row.get("code") or "").strip().strip('"')
            brand = (row.get("brands") or "").strip()
            products.append({
                "name": name,
                "brand": brand,
                "barcode": barcode,
                "categories": (row.get("categories") or "").strip(),
                "image_url": (row.get("image_url") or row.get("image_front_url") or "").strip(),
                "source": source,
            })
    logger.info(f"  {source}: {len(products)} products ({'all' if keep_all else 'Turkish'})")
    return products


def get_supabase():
    from supabase import create_client
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def source_id_for(p: dict) -> str:
    px = SOURCE_PREFIX[p["source"]]
    if p["barcode"]:
        return f"{px}:{p['barcode']}"
    h = hashlib.md5(f"{p['brand']}:{p['name']}".encode()).hexdigest()[:12]
    return f"{px}:{h}"


def insert_products(products: list[dict], dry_run: bool = True):
    if dry_run:
        logger.info(f"[DRY RUN] Would upsert {len(products)} products")
        brands = defaultdict(int)
        for p in products:
            brands[p["brand"] or "(no brand)"] += 1
        for b, n in sorted(brands.items(), key=lambda x: -x[1])[:15]:
            logger.info(f"  {b}: {n}")
        logger.info(f"  With barcode: {sum(1 for p in products if p['barcode'])} | with image: {sum(1 for p in products if p['image_url'])}")
        return

    client = get_supabase()
    total = 0
    for i in range(0, len(products), BATCH_SIZE):
        batch = products[i:i + BATCH_SIZE]
        rows = []
        for p in batch:
            px = SOURCE_PREFIX[p["source"]]
            bslug = slugify(p["brand"]) if p["brand"] else ""
            nslug = slugify(p["name"])
            slug = f"{px}-{bslug}-{nslug}" if bslug else f"{px}-{nslug}"
            desc = " — ".join(x for x in [p["brand"], p["categories"][:200]] if x) or None
            rows.append({
                "name": p["name"][:255],
                "slug": slug[:80],
                "entity_type": "business",
                "status": "active",
                "source": p["source"],
                "source_id": source_id_for(p),
                "description": desc,
            })
        try:
            resp = client.table("listings").upsert(rows, on_conflict="source_id").execute()
            total += len(resp.data)
            logger.info(f"Batch {i // BATCH_SIZE + 1}: upserted {len(resp.data)}")
        except Exception as e:
            logger.error(f"Batch error at {i}: {e}")
    logger.info(f"Total products upserted: {total}")

    # Barcodes → listing_sources
    bc_count = 0
    for i in range(0, len(products), BATCH_SIZE):
        rows = []
        for p in products[i:i + BATCH_SIZE]:
            if not p["barcode"]:
                continue
            try:
                resp = client.table("listings").select("id").eq("source_id", source_id_for(p)).execute()
                if resp.data:
                    rows.append({"listing_id": resp.data[0]["id"], "source": "barcode",
                                 "external_id": p["barcode"], "confidence_score": 1.0})
            except Exception:
                pass
        if rows:
            try:
                client.table("listing_sources").upsert(rows, on_conflict="source,external_id").execute()
                bc_count += len(rows)
            except Exception as e:
                logger.error(f"Barcode error: {e}")
    logger.info(f"Inserted {bc_count} barcode mappings")


def main():
    parser = argparse.ArgumentParser(description="Open Products / Pet Food Facts Fetcher")
    parser.add_argument("--supabase", action="store_true")
    parser.add_argument("--all", action="store_true", help="Keep all countries, not just Turkey")
    parser.add_argument("--skip-download", action="store_true")
    args = parser.parse_args()

    DATA_DIR.mkdir(exist_ok=True)
    products = []
    for source, url in SOURCES.items():
        dest = DATA_DIR / f"{source}.csv"
        if not args.skip_download:
            download(url, dest)
        if dest.exists():
            products.extend(load_products(dest, source, keep_all=args.all))

    out = DATA_DIR / "openproductsfacts.json"
    out.write_text(json.dumps(products, ensure_ascii=False, indent=2), encoding="utf-8")
    logger.info(f"Saved {out} ({len(products)} total)")

    insert_products(products, dry_run=not args.supabase)
    if not args.supabase:
        logger.info("Run with --supabase to upsert")


if __name__ == "__main__":
    main()
