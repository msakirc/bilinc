#!/usr/bin/env python3
"""
Bilinc -- Populate Turso search index from DynamoDB catalog.

Scans all listing items from DynamoDB, extracts lean search fields,
and batch-inserts into Turso via HTTP API.

Usage:
    python migrate-to-turso.py                # Dry run, show stats
    python migrate-to-turso.py --write        # Write to Turso
"""

import os
import sys
import json
import logging
import argparse
from pathlib import Path

import boto3
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

AWS_REGION = os.environ.get("AWS_REGION", "eu-central-1")
DYNAMODB_TABLE = os.environ.get("DYNAMODB_TABLE", "bilinc-catalog")
TURSO_URL = os.environ["TURSO_URL"]
TURSO_AUTH_TOKEN = os.environ["TURSO_AUTH_TOKEN"]

BATCH_SIZE = 200  # Statements per Turso HTTP call

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("migrate-turso")

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


# ============================================================================
# TURSO HTTP API
# ============================================================================

def turso_execute(statements: list[dict]):
    """Execute a batch of SQL statements against Turso HTTP API.

    Each statement is {"sql": "...", "args": [...]}.
    Turso pipeline endpoint accepts up to ~1000 statements per call.
    """
    resp = requests.post(
        f"{TURSO_URL}/v2/pipeline",
        headers={
            "Authorization": f"Bearer {TURSO_AUTH_TOKEN}",
            "Content-Type": "application/json",
        },
        json={
            "requests": [
                {"type": "execute", "stmt": s}
                for s in statements
            ]
        },
        timeout=60,
    )
    resp.raise_for_status()
    result = resp.json()

    # Check for per-statement errors
    for i, r in enumerate(result.get("results", [])):
        if r.get("type") == "error":
            logger.warning(f"Turso statement {i} error: {r.get('error', {}).get('message', '?')}")

    return result


# ============================================================================
# DYNAMODB SCAN
# ============================================================================

def scan_dynamodb() -> list[dict]:
    """Scan all META items from DynamoDB."""
    dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
    table = dynamodb.Table(DYNAMODB_TABLE)

    items = []
    last_key = None

    while True:
        kwargs = {
            "FilterExpression": "SK = :meta",
            "ExpressionAttributeValues": {":meta": "META"},
        }
        if last_key:
            kwargs["ExclusiveStartKey"] = last_key

        resp = table.scan(**kwargs)
        items.extend(resp["Items"])
        last_key = resp.get("LastEvaluatedKey")

        logger.info(f"Scanned {len(items)} items...")

        if not last_key:
            break

    return items


# ============================================================================
# EXTRACT SEARCH FIELDS
# ============================================================================

def extract_search_record(item: dict) -> dict | None:
    """Extract lean search fields from a DynamoDB catalog item."""
    pk = item.get("PK", "")
    if not pk.startswith("L#"):
        return None

    lid = pk.replace("L#", "")
    name = item.get("name")
    if not name:
        return None

    # Primary category slug
    primary_cat = None
    for cat in (item.get("categories") or []):
        if cat.get("primary"):
            primary_cat = cat.get("slug")
            break

    # Primary photo URL
    primary_photo = None
    for photo in (item.get("photos") or []):
        if photo.get("primary"):
            primary_photo = photo.get("url")
            break
    if not primary_photo and item.get("photos"):
        primary_photo = item["photos"][0].get("url")

    # Brand name (from productData for products)
    parent_name = None
    if item.get("productData"):
        parent_name = item["productData"].get("brand")

    return {
        "id": lid,
        "name": name,
        "entity_type": item.get("entityType", "business"),
        "city_code": item.get("cityCode"),
        "category_slug": primary_cat,
        "parent_name": parent_name,
        "rating": float(item.get("rating", 0)),
        "total_reviews": int(item.get("totalReviews", 0)),
        "latitude": float(item["latitude"]) if item.get("latitude") else None,
        "longitude": float(item["longitude"]) if item.get("longitude") else None,
        "photo_url": primary_photo,
    }


# ============================================================================
# MIGRATION
# ============================================================================

def migrate(dry_run: bool = True):
    """Populate Turso search index from DynamoDB."""
    logger.info("Scanning DynamoDB...")
    items = scan_dynamodb()
    logger.info(f"Found {len(items)} items in DynamoDB")

    # Extract search records
    records = []
    for item in items:
        rec = extract_search_record(item)
        if rec:
            records.append(rec)

    logger.info(f"Extracted {len(records)} search records")

    if dry_run:
        for rec in records[:5]:
            logger.info(
                f"  [{rec['entity_type']}] {rec['name']} "
                f"(city={rec['city_code']}, cat={rec['category_slug']})"
            )
        logger.info(f"[DRY RUN] Would insert {len(records)} search records into Turso")
        logger.info(f"  Turso URL: {TURSO_URL}")
        logger.info(f"  Batch size: {BATCH_SIZE}")
        logger.info("Run with --write to execute migration")
        return

    # Build INSERT statements and send in batches
    inserted = 0
    errors = 0

    for i in range(0, len(records), BATCH_SIZE):
        batch = records[i:i + BATCH_SIZE]
        statements = []

        for rec in batch:
            statements.append({
                "sql": (
                    "INSERT OR REPLACE INTO listings_search "
                    "(id, name, entity_type, city_code, category_slug, "
                    "parent_name, rating, total_reviews, "
                    "latitude, longitude, photo_url) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
                ),
                "args": [
                    rec["id"],
                    rec["name"],
                    rec["entity_type"],
                    rec["city_code"],
                    rec["category_slug"],
                    rec["parent_name"],
                    rec["rating"],
                    rec["total_reviews"],
                    rec["latitude"],
                    rec["longitude"],
                    rec["photo_url"],
                ],
            })

        try:
            turso_execute(statements)
            inserted += len(batch)
        except Exception as e:
            errors += 1
            if errors <= 10:
                logger.error(f"Batch error at offset {i}: {e}")

        if inserted % 5000 == 0 and inserted > 0:
            logger.info(f"Inserted {inserted}/{len(records)}")

    logger.info(f"Search index populated: {inserted} records (errors: {errors})")


# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Populate Turso search index from DynamoDB catalog"
    )
    parser.add_argument(
        "--write", action="store_true",
        help="Actually write to Turso (default is dry run)"
    )
    args = parser.parse_args()
    migrate(dry_run=not args.write)
