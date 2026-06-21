#!/usr/bin/env python3
"""
Bilinc -- Upload brand entities to DynamoDB + Turso.

Reads the prepared brand JSON files (wikidata-brands.json + brand-products.json),
dedupes by brand slug, and writes entity_type='brand' listings to DynamoDB
(single-table) and the Turso search index.

Brand listing IDs are deterministic (uuid5 of "brand:<slug>") so the upload is
idempotent and re-runnable. Products link to brands by brand-name match in
off-products.py (insert_products_dynamodb scans existing brands), so run this
before (or re-run products after) to populate GSI4 brand->product linkage.

Usage:
    python brands-to-dynamo.py            # Dry run (counts + samples)
    python brands-to-dynamo.py --write    # Write to DynamoDB + Turso

AWS creds: uses the default boto3 chain. Set AWS_PROFILE=bilinc-serverless.
"""

import os
import re
import sys
import json
import time
import uuid
import logging
import argparse
from decimal import Decimal
from pathlib import Path

import boto3
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

AWS_REGION = os.environ.get("AWS_REGION", "eu-central-1")
DYNAMODB_TABLE = os.environ.get("DYNAMODB_TABLE", "bilinc-catalog")
TURSO_URL = os.environ.get("TURSO_URL", "")
TURSO_AUTH_TOKEN = os.environ.get("TURSO_AUTH_TOKEN", "")

DATA_DIR = Path(__file__).parent / "data"
WIKIDATA_BRANDS = DATA_DIR / "wikidata-brands.json"
BRAND_PRODUCTS = DATA_DIR / "brand-products.json"

BATCH_SIZE = 25
BRAND_NAMESPACE = uuid.UUID("6f9619ff-8b86-d011-b42d-00c04fc964ff")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("brands-dynamo")

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

TR_MAP = str.maketrans({
    "ı": "i", "İ": "i", "ş": "s", "Ş": "s", "ğ": "g", "Ğ": "g",
    "ü": "u", "Ü": "u", "ö": "o", "Ö": "o", "ç": "c", "Ç": "c",
})


def slugify(name: str) -> str:
    slug = (name or "").translate(TR_MAP).lower()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")[:80]
    return slug


def brand_id(slug: str) -> str:
    return str(uuid.uuid5(BRAND_NAMESPACE, f"brand:{slug}"))


def invert_rating(rating: float) -> str:
    score = int(round((rating or 0) * 100))
    return f"{10000 - score:05d}"


def load_brands() -> list[dict]:
    """Merge wikidata + brand-products into a deduped brand list (by slug)."""
    brands: dict[str, dict] = {}

    if WIKIDATA_BRANDS.exists():
        for b in json.loads(WIKIDATA_BRANDS.read_text(encoding="utf-8")):
            name = (b.get("name") or "").strip()
            if not name:
                continue
            slug = slugify(name)
            if not slug:
                continue
            brands[slug] = {
                "name": name,
                "slug": slug,
                "description": (b.get("description") or "").strip() or None,
                "website": (b.get("website") or "").strip() or None,
                "logo": (b.get("logo") or "").strip() or None,
                "industry": (b.get("industry") or "").strip() or None,
                "source": "wikidata",
                "sourceId": f"wikidata:{b.get('qid')}" if b.get("qid") else None,
            }

    if BRAND_PRODUCTS.exists():
        for p in json.loads(BRAND_PRODUCTS.read_text(encoding="utf-8")):
            name = (p.get("brand") or "").strip()
            if not name:
                continue
            slug = (p.get("brand_slug") or "").strip() or slugify(name)
            if not slug or slug in brands:
                continue
            brands[slug] = {
                "name": name,
                "slug": slug,
                "description": None,
                "website": None,
                "logo": None,
                "industry": None,
                "source": "catalog",
                "sourceId": f"catalog:{slug}",
            }

    return list(brands.values())


def build_item(b: dict) -> dict:
    lid = brand_id(b["slug"])
    created_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    item = {
        "PK": f"L#{lid}",
        "SK": "META",
        "name": b["name"][:255],
        "slug": f"brand-{b['slug']}"[:80],
        "entityType": "brand",
        "status": "active",
        "description": b.get("description"),
        "rating": Decimal("0"),
        "totalReviews": 0,
        "source": b.get("source"),
        "sourceId": b.get("sourceId"),
        "createdAt": created_at,
        "updatedAt": created_at,
        "GSI3PK": "TYPE#brand",
        "GSI3SK": created_at,
    }
    contacts = {}
    if b.get("website"):
        contacts["website"] = b["website"]
    if contacts:
        item["contacts"] = contacts

    brand_data = {}
    if b.get("logo"):
        brand_data["logo"] = b["logo"]
    if b.get("industry"):
        brand_data["industry"] = b["industry"]
    if brand_data:
        item["brandData"] = brand_data

    return {k: v for k, v in item.items() if v is not None}


def _turso_arg(v):
    if v is None:
        return {"type": "null", "value": None}
    if isinstance(v, bool):
        return {"type": "integer", "value": "1" if v else "0"}
    if isinstance(v, int):
        return {"type": "integer", "value": str(v)}
    if isinstance(v, float):
        return {"type": "float", "value": v}
    return {"type": "text", "value": str(v)}


def turso_execute(statements: list[dict]):
    encoded = []
    for s in statements:
        stmt = {"sql": s["sql"]}
        if "args" in s:
            stmt["args"] = [_turso_arg(a) for a in s["args"]]
        encoded.append({"type": "execute", "stmt": stmt})
    resp = requests.post(
        f"{TURSO_URL}/v2/pipeline",
        headers={
            "Authorization": f"Bearer {TURSO_AUTH_TOKEN}",
            "Content-Type": "application/json",
        },
        json={"requests": encoded},
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", help="Write to DynamoDB + Turso")
    args = parser.parse_args()

    brands = load_brands()
    logger.info(f"Loaded {len(brands)} distinct brands")

    if not args.write:
        for b in brands[:8]:
            logger.info(f"  [{b['source']}] {b['name']} ({b['slug']})")
        logger.info(f"[DRY RUN] Would write {len(brands)} brands to DynamoDB + Turso")
        return

    dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
    table = dynamodb.Table(DYNAMODB_TABLE)

    total = 0
    errors = 0
    for i in range(0, len(brands), BATCH_SIZE):
        batch = brands[i:i + BATCH_SIZE]
        try:
            with table.batch_writer() as dynamo_batch:
                for b in batch:
                    dynamo_batch.put_item(Item=build_item(b))

            stmts = []
            for b in batch:
                stmts.append({
                    "sql": (
                        "INSERT OR REPLACE INTO listings_search "
                        "(id, name, entity_type, city_code, category_slug, "
                        "rating, total_reviews, latitude, longitude) "
                        "VALUES (?, ?, 'brand', NULL, NULL, 0, 0, NULL, NULL)"
                    ),
                    "args": [brand_id(b["slug"]), b["name"]],
                })
            turso_execute(stmts)
            total += len(batch)
        except Exception as e:
            errors += 1
            logger.error(f"Batch error at offset {i}: {e}")

        if total % 250 == 0 and total:
            logger.info(f"Wrote {total}/{len(brands)} brands (errors: {errors})")

    logger.info(f"Done: {total} brands written, {errors} batch errors")


if __name__ == "__main__":
    main()
