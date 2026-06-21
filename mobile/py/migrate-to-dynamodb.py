#!/usr/bin/env python3
"""
Bilinc -- Migrate listings from Supabase to DynamoDB.

Reads all listings + related data (contacts, hours, photos, categories)
from Supabase, transforms to DynamoDB single-table format with proper
PK/SK and GSI keys, and batch-writes to DynamoDB.

Usage:
    python migrate-to-dynamodb.py                # Dry run, show stats
    python migrate-to-dynamodb.py --write        # Actually write to DynamoDB
    python migrate-to-dynamodb.py --write --resume 50000  # Resume from offset
"""

import os
import sys
import json
import time
import logging
import argparse
from decimal import Decimal
from pathlib import Path

import boto3
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
AWS_REGION = os.environ.get("AWS_REGION", "eu-central-1")
DYNAMODB_TABLE = os.environ.get("DYNAMODB_TABLE", "bilinc-catalog")

BATCH_SIZE = 25  # DynamoDB BatchWriteItem max
SUPABASE_PAGE_SIZE = 1000

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("migrate-dynamo")

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


# ============================================================================
# CLIENTS
# ============================================================================

def get_supabase():
    from supabase import create_client
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def get_dynamodb_table():
    dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
    return dynamodb.Table(DYNAMODB_TABLE)


# ============================================================================
# HELPERS
# ============================================================================

def invert_rating(rating: float) -> str:
    """Invert rating for descending sort in DynamoDB.

    Rating 4.2 -> score 420 -> inverted 10000-420=9580 -> '09580'
    DynamoDB sorts SK ascending, so lower inverted = higher rating = appears first.
    """
    score = int(round((rating or 0) * 100))
    inverted = 10000 - score
    return f"{inverted:05d}"


def strip_none(d: dict) -> dict:
    """Remove keys with None values -- DynamoDB doesn't allow None."""
    return {k: v for k, v in d.items() if v is not None}


def to_decimal(val) -> Decimal | None:
    """Convert a numeric value to Decimal for DynamoDB, or None."""
    if val is None:
        return None
    return Decimal(str(val))


# ============================================================================
# CACHES -- Load related tables into memory
# ============================================================================

def load_all_pages(client, table_name: str, select: str = "*") -> list[dict]:
    """Load all rows from a Supabase table using range-based pagination."""
    all_rows = []
    offset = 0
    while True:
        resp = (client.table(table_name)
                .select(select)
                .range(offset, offset + SUPABASE_PAGE_SIZE - 1)
                .execute())
        all_rows.extend(resp.data)
        if len(resp.data) < SUPABASE_PAGE_SIZE:
            break
        offset += SUPABASE_PAGE_SIZE
    return all_rows


def load_contacts_cache(client) -> dict:
    """Load listing_contacts keyed by listing_id."""
    logger.info("Loading contacts...")
    cache = {}
    rows = load_all_pages(client, "listing_contacts")
    for c in rows:
        cache[c["listing_id"]] = c
    logger.info(f"  Loaded {len(cache)} contacts")
    return cache


def load_hours_cache(client) -> dict:
    """Load listing_hours grouped by listing_id."""
    logger.info("Loading hours...")
    cache = {}
    rows = load_all_pages(client, "listing_hours")
    for h in rows:
        cache.setdefault(h["listing_id"], []).append(h)
    logger.info(f"  Loaded hours for {len(cache)} listings")
    return cache


def load_photos_cache(client) -> dict:
    """Load listing_photos grouped by listing_id."""
    logger.info("Loading photos...")
    cache = {}
    rows = load_all_pages(client, "listing_photos")
    for p in rows:
        cache.setdefault(p["listing_id"], []).append(p)
    logger.info(f"  Loaded photos for {len(cache)} listings")
    return cache


def load_categories_cache(client) -> dict:
    """Load listing_categories with joined category slug, grouped by listing_id."""
    logger.info("Loading categories...")
    cache = {}
    rows = load_all_pages(
        client, "listing_categories",
        select="listing_id, is_primary, categories(slug, name)"
    )
    for lc in rows:
        cache.setdefault(lc["listing_id"], []).append(lc)
    logger.info(f"  Loaded categories for {len(cache)} listings")
    return cache


# ============================================================================
# TRANSFORM
# ============================================================================

def build_dynamo_item(
    listing: dict,
    contacts: dict | None,
    hours: list,
    photos: list,
    categories: list,
) -> dict:
    """Transform a Supabase listing + related data into a DynamoDB item."""
    lid = listing["id"]
    rating = float(listing.get("average_rating") or 0)
    inv_rating = invert_rating(rating)

    # --- Categories ---
    primary_cat = None
    cat_list = []
    for lc in categories:
        cat = lc.get("categories") or lc.get("category")
        if not cat:
            continue
        slug = cat["slug"] if isinstance(cat, dict) else lc.get("category_slug", "")
        is_primary = lc.get("is_primary", False)
        cat_list.append({"slug": slug, "primary": is_primary})
        if is_primary:
            primary_cat = slug

    # --- Photos ---
    photo_list = []
    for p in photos:
        entry = {
            "url": p["url"],
            "primary": p.get("is_primary", False),
            "source": p.get("source", "user"),
        }
        photo_list.append(entry)

    # --- Base item ---
    item = {
        "PK": f"L#{lid}",
        "SK": "META",
        "name": listing["name"],
        "slug": listing["slug"],
        "entityType": listing["entity_type"],
        "status": listing.get("status", "active"),
        "description": listing.get("description"),
        "cityCode": listing.get("city_code"),
        "districtId": listing.get("district_id"),
        "addressLine": listing.get("address_line"),
        "latitude": to_decimal(listing.get("latitude")),
        "longitude": to_decimal(listing.get("longitude")),
        "rating": to_decimal(rating),
        "totalReviews": listing.get("total_reviews", 0),
        "source": listing.get("source"),
        "sourceId": listing.get("source_id"),
        "parentId": f"L#{listing['parent_id']}" if listing.get("parent_id") else None,
        "createdAt": listing.get("created_at"),
        "updatedAt": listing.get("updated_at"),
    }

    # --- Embedded related data ---
    if contacts:
        contact_data = {
            k: v for k, v in contacts.items()
            if k not in ("listing_id", "id", "updated_at", "updated_by", "created_at") and v
        }
        if contact_data:
            item["contacts"] = contact_data

    if hours:
        item["hours"] = [
            {
                "day": h["day_of_week"],
                "open": h.get("open_time"),
                "close": h.get("close_time"),
                "closed": h.get("is_closed", False),
            }
            for h in hours
        ]

    if photo_list:
        item["photos"] = photo_list

    if cat_list:
        item["categories"] = cat_list

    # --- GSI keys ---

    # GSI1: Category browse sorted by rating
    if primary_cat:
        item["GSI1PK"] = f"CAT#{primary_cat}"
        item["GSI1SK"] = f"R#{inv_rating}#{lid[:8]}"

    # GSI2: City+category browse (sparse -- only if cityCode exists)
    if listing.get("city_code") and primary_cat:
        item["GSI2PK"] = f"CITY#{listing['city_code']}"
        item["GSI2SK"] = f"CAT#{primary_cat}#R#{inv_rating}"

    # GSI3: Recent by type
    item["GSI3PK"] = f"TYPE#{listing['entity_type']}"
    item["GSI3SK"] = listing.get("created_at", "2026-01-01T00:00:00Z")

    # GSI4: Parent lookup (sparse -- only if parentId exists)
    if listing.get("parent_id"):
        item["GSI4PK"] = f"PARENT#L#{listing['parent_id']}"
        item["GSI4SK"] = f"{listing['entity_type']}#{listing['name']}"

    return strip_none(item)


# ============================================================================
# MIGRATION
# ============================================================================

def migrate(dry_run: bool = True, resume_offset: int = 0):
    """Main migration loop."""
    client = get_supabase()

    # Count total listings
    count_resp = client.table("listings").select("id", count="exact").execute()
    total = count_resp.count
    logger.info(f"Total listings in Supabase: {total}")

    if dry_run:
        sample = client.table("listings").select("*").limit(5).execute()
        for row in sample.data:
            logger.info(f"  [{row['entity_type']}] {row['name']} ({row.get('source')})")
        logger.info(f"[DRY RUN] Would migrate {total} listings to DynamoDB table '{DYNAMODB_TABLE}'")
        logger.info(f"  Region: {AWS_REGION}")
        logger.info(f"  Batch size: {BATCH_SIZE}")
        logger.info("Run with --write to execute migration")
        return

    table = get_dynamodb_table()

    # Load all related data into memory caches
    contacts_cache = load_contacts_cache(client)
    hours_cache = load_hours_cache(client)
    photos_cache = load_photos_cache(client)
    categories_cache = load_categories_cache(client)

    # Migrate in batches
    migrated = 0
    errors = 0
    offset = resume_offset
    start_time = time.time()

    logger.info(f"Starting migration from offset {offset}...")

    while offset < total:
        resp = (client.table("listings")
                .select("*")
                .order("created_at")
                .range(offset, offset + BATCH_SIZE - 1)
                .execute())

        if not resp.data:
            break

        with table.batch_writer() as batch:
            for listing in resp.data:
                try:
                    lid = listing["id"]
                    item = build_dynamo_item(
                        listing,
                        contacts_cache.get(lid),
                        hours_cache.get(lid, []),
                        photos_cache.get(lid, []),
                        categories_cache.get(lid, []),
                    )
                    batch.put_item(Item=item)
                    migrated += 1
                except Exception as e:
                    errors += 1
                    if errors <= 20:
                        logger.error(f"Error migrating {listing.get('name', '?')}: {e}")

        offset += BATCH_SIZE

        if migrated % 1000 == 0 and migrated > 0:
            elapsed = time.time() - start_time
            rate = migrated / elapsed if elapsed > 0 else 0
            logger.info(
                f"Migrated {migrated}/{total} "
                f"(errors: {errors}, offset: {offset}, "
                f"{rate:.0f} items/sec)"
            )

    elapsed = time.time() - start_time
    logger.info(
        f"Migration complete: {migrated} migrated, {errors} errors "
        f"in {elapsed:.0f}s"
    )


# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Migrate Supabase listings to DynamoDB"
    )
    parser.add_argument(
        "--write", action="store_true",
        help="Actually write to DynamoDB (default is dry run)"
    )
    parser.add_argument(
        "--resume", type=int, default=0,
        help="Resume migration from this offset"
    )
    args = parser.parse_args()
    migrate(dry_run=not args.write, resume_offset=args.resume)
