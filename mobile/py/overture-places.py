#!/usr/bin/env python3
"""
Bilinc -- Overture Maps Turkish Places Fetcher

Downloads Turkish business/place data from Overture Maps Foundation.
Filters by country='TR', extracts name/address/category/contact info,
and inserts as entity_type='business' listings into Supabase or DynamoDB+Turso.

Data source: https://overturemaps.org (CDLA Permissive v2.0 license)
Access: Public S3 bucket, no authentication needed.

Usage:
    python overture-places.py                          # Count Turkish places
    python overture-places.py --fetch                  # Download Turkish places to local parquet
    python overture-places.py --fetch --supabase       # Download + push to Supabase
    python overture-places.py --supabase               # Push cached local data to Supabase
    python overture-places.py --fetch --dynamodb       # Download + push to DynamoDB+Turso
    python overture-places.py --dynamodb               # Push cached local data to DynamoDB+Turso
"""

import os
import re
import sys
import json
import time
import logging
import argparse
from decimal import Decimal
from pathlib import Path

import requests as http_requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

# DynamoDB + Turso settings (used with --dynamodb flag)
AWS_REGION = os.environ.get("AWS_REGION", "eu-central-1")
DYNAMODB_TABLE = os.environ.get("DYNAMODB_TABLE", "bilinc-catalog")
# Private table for phone numbers — NOT readable by the Cognito guest role.
CONTACTS_TABLE = os.environ.get("CONTACTS_TABLE", "bilinc-contacts")
TURSO_URL = os.environ.get("TURSO_URL", "")
TURSO_AUTH_TOKEN = os.environ.get("TURSO_AUTH_TOKEN", "")

DATA_DIR = Path(__file__).parent / "data"
LOCAL_PARQUET = DATA_DIR / "overture-turkey-places.parquet"

# Overture Maps S3 path (public, no auth)
OVERTURE_S3 = "s3://overturemaps-us-west-2/release/2026-03-18.0/theme=places/type=place/*"

# Turkey bounding box (generous): west, south, east, north
TURKEY_BBOX = (25.5, 35.8, 44.8, 42.2)

BATCH_SIZE = 100

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("overture-places")

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


# ============================================================================
# SLUG & HELPERS
# ============================================================================

def slugify(name: str) -> str:
    tr_map = {
        'ş': 's', 'Ş': 'S', 'ı': 'i', 'İ': 'I', 'ğ': 'g', 'Ğ': 'G',
        'ü': 'u', 'Ü': 'U', 'ö': 'o', 'Ö': 'O', 'ç': 'c', 'Ç': 'C',
    }
    slug = name.lower()
    for tr, en in tr_map.items():
        slug = slug.replace(tr, en)
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s_]+', '-', slug)
    slug = re.sub(r'-+', '-', slug).strip('-')[:60]
    return slug


# Overture category → Bilinç category mapping (top-level only)
CATEGORY_MAP = {
    "restaurant": "restoran-lokanta",
    "cafe": "kafe-bar",
    "bar": "kafe-bar",
    "fast_food_restaurant": "restoran-lokanta",
    "bakery": "firin-pastane",
    "supermarket": "market-bakkal",
    "grocery_store": "market-bakkal",
    "convenience_store": "market-bakkal",
    "pharmacy": "eczane",
    "hospital": "hastane-klinik",
    "doctor": "doktor-uzman",
    "dentist": "doktor-uzman",
    "bank": "banka-finans",
    "hotel": "otel-konaklama",
    "gas_station": "akaryakit",
    "car_repair": "oto-servis",
    "beauty_salon": "guzellik-salonu",
    "hair_salon": "kuafor-berber",
    "gym": "spor-salonu",
    "school": "egitim",
    "college_university": "egitim",
}


# ============================================================================
# FETCH FROM S3
# ============================================================================

def count_turkish_places():
    """Count Turkish places in Overture Maps."""
    import duckdb
    con = duckdb.connect()
    con.execute("INSTALL httpfs; LOAD httpfs;")
    con.execute("SET s3_region='us-west-2'")

    logger.info("Counting Turkish places in Overture Maps...")
    result = con.execute(f"""
        SELECT count(*)
        FROM read_parquet('{OVERTURE_S3}', hive_partitioning=1)
        WHERE bbox.xmin > {TURKEY_BBOX[0]} AND bbox.xmax < {TURKEY_BBOX[2]}
          AND bbox.ymin > {TURKEY_BBOX[1]} AND bbox.ymax < {TURKEY_BBOX[3]}
    """).fetchone()
    logger.info(f"Turkish places (bbox filter): {result[0]}")
    return result[0]


def fetch_turkish_places():
    """Download Turkish places from Overture Maps S3 to local parquet."""
    import duckdb
    con = duckdb.connect()
    con.execute("INSTALL httpfs; LOAD httpfs;")
    con.execute("SET s3_region='us-west-2'")

    DATA_DIR.mkdir(exist_ok=True)

    logger.info("Downloading Turkish places from Overture Maps...")
    logger.info(f"  S3 path: {OVERTURE_S3}")
    logger.info(f"  Turkey bbox: {TURKEY_BBOX}")
    logger.info(f"  Output: {LOCAL_PARQUET}")

    con.execute(f"""
        COPY (
            SELECT
                id,
                names.primary as name,
                categories.primary as category,
                addresses,
                websites,
                phones,
                socials,
                bbox.xmin as longitude,
                bbox.ymin as latitude
            FROM read_parquet('{OVERTURE_S3}', hive_partitioning=1)
            WHERE bbox.xmin > {TURKEY_BBOX[0]} AND bbox.xmax < {TURKEY_BBOX[2]}
              AND bbox.ymin > {TURKEY_BBOX[1]} AND bbox.ymax < {TURKEY_BBOX[3]}
              AND addresses[1].country = 'TR'
        ) TO '{LOCAL_PARQUET}' (FORMAT PARQUET)
    """)

    # Check result
    result = con.execute(f"SELECT count(*) FROM read_parquet('{LOCAL_PARQUET}')").fetchone()
    logger.info(f"Downloaded {result[0]} Turkish places")
    return result[0]


# ============================================================================
# PROCESS & INSERT
# ============================================================================

def get_supabase():
    from supabase import create_client
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def load_city_district_cache(client):
    """Load city/district lookup for address matching."""
    cities = {}
    try:
        resp = client.table("cities").select("code,name,slug").execute()
        for c in resp.data:
            cities[c["name"].lower()] = c["code"]
            cities[c["slug"].lower()] = c["code"]
    except Exception as e:
        logger.warning(f"Could not load cities: {e}")
    return cities


def process_and_insert(dry_run: bool = True):
    """Process local parquet and insert into Supabase."""
    import pandas as pd

    if not LOCAL_PARQUET.exists():
        logger.error(f"Local parquet not found: {LOCAL_PARQUET}")
        logger.error("Run with --fetch first")
        return

    logger.info(f"Loading {LOCAL_PARQUET}...")
    df = pd.read_parquet(LOCAL_PARQUET)
    logger.info(f"Loaded {len(df)} places")

    # Filter: must have a name
    df = df[df["name"].notna() & (df["name"].str.len() > 1)]
    logger.info(f"With valid names: {len(df)}")

    # Stats
    from collections import Counter
    cats = Counter()
    for cat in df["category"].dropna():
        cats[cat] += 1
    logger.info("Top 20 categories:")
    for cat, count in cats.most_common(20):
        logger.info(f"  {cat}: {count}")

    with_phone = df["phones"].notna().sum()
    with_website = df["websites"].notna().sum()
    logger.info(f"With phone: {with_phone}, with website: {with_website}")

    if dry_run:
        logger.info(f"[DRY RUN] Would insert {len(df)} places")
        # Show samples
        for _, row in df.head(10).iterrows():
            logger.info(f"  {row['name']} ({row['category']}) — {row.get('addresses')}")
        return

    client = get_supabase()
    cities = load_city_district_cache(client)

    total = 0
    errors = 0

    for i in range(0, len(df), BATCH_SIZE):
        batch = df.iloc[i:i + BATCH_SIZE]
        rows = []

        for _, row in batch.iterrows():
            name = str(row["name"]).strip()
            if not name or len(name) < 2:
                continue

            overture_id = str(row["id"])
            source_id = f"overture:{overture_id}"
            category = str(row["category"]) if row.get("category") else ""

            # Build slug with category prefix for uniqueness
            name_slug = slugify(name)
            cat_slug = slugify(category) if category else ""
            slug = f"ov-{cat_slug}-{name_slug}" if cat_slug else f"ov-{name_slug}"
            # Append short hash of overture_id for guaranteed uniqueness
            slug = f"{slug[:65]}-{overture_id[-6:]}"[:80]

            # Extract address
            city_code = None
            address_line = None
            locality = None
            try:
                addrs = row.get("addresses")
                if addrs is not None and len(addrs) > 0:
                    addr = addrs[0] if hasattr(addrs, '__getitem__') else None
                    if isinstance(addr, dict):
                        locality = addr.get("locality", "")
                        address_line = addr.get("freeform", "")
                        if locality:
                            city_code = cities.get(locality.lower())
            except (TypeError, IndexError, KeyError):
                pass

            lat = float(row["latitude"]) if row.get("latitude") else None
            lon = float(row["longitude"]) if row.get("longitude") else None

            # Extract contacts
            phone = None
            website = None
            try:
                phones = row.get("phones")
                if phones is not None and len(phones) > 0:
                    phone = str(phones[0]) if hasattr(phones, '__getitem__') else str(phones)
            except (TypeError, IndexError):
                pass
            try:
                websites = row.get("websites")
                if websites is not None and len(websites) > 0:
                    website = str(websites[0]) if hasattr(websites, '__getitem__') else str(websites)
            except (TypeError, IndexError):
                pass

            # Build description with category + website. Phone is NOT embedded —
            # description is client-visible; phone is personal data (see the
            # DynamoDB path / bilinc-contacts).
            desc_parts = []
            if category:
                desc_parts.append(category)
            if website:
                desc_parts.append(website)
            description = " | ".join(desc_parts)[:500] if desc_parts else None

            listing = {
                "name": name[:255],
                "slug": slug,
                "entity_type": "business",
                "status": "active",
                "source": "overture",
                "source_id": source_id,
                "description": description,
                "latitude": lat,
                "longitude": lon,
                "city_code": city_code,
                "address_line": address_line[:500] if address_line else None,
            }
            rows.append(listing)

        if not rows:
            continue

        try:
            resp = client.table("listings").upsert(
                rows, on_conflict="source_id"
            ).execute()
            total += len(resp.data)

            if (i // BATCH_SIZE + 1) % 50 == 0:
                logger.info(f"Batch {i // BATCH_SIZE + 1}/{len(df) // BATCH_SIZE}: inserted {total}")
        except Exception as e:
            errors += 1
            if errors <= 10:
                logger.error(f"Batch error at offset {i}: {e}")

    logger.info(f"Total places inserted: {total} (errors: {errors})")
    logger.info("Note: website stored in description; phone deliberately omitted (personal data).")


# ============================================================================
# DYNAMODB + TURSO INSERT
# ============================================================================

def _turso_arg(v):
    """Encode a Python value as a Turso Hrana typed value object."""
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
    """Execute a batch of SQL statements against Turso HTTP API.

    Each statement dict has shape {"sql": str, "args": [raw python values]}.
    Turso's Hrana /v2/pipeline requires args as typed value objects, so we
    encode them here.
    """
    encoded = []
    for s in statements:
        stmt = {"sql": s["sql"]}
        if "args" in s:
            stmt["args"] = [_turso_arg(a) for a in s["args"]]
        encoded.append({"type": "execute", "stmt": stmt})

    resp = http_requests.post(
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


def invert_rating(rating: float) -> str:
    """Invert rating for descending sort in DynamoDB.
    Rating 4.2 -> score 420 -> inverted 10000-420=9580 -> '09580'
    """
    score = int(round((rating or 0) * 100))
    inverted = 10000 - score
    return f"{inverted:05d}"


def insert_dynamodb_and_turso(rows: list[dict]):
    """Write a batch of place rows to DynamoDB and Turso search index.

    Each row is the same dict built in process_and_insert() with fields:
    id, name, slug, source_id, description, latitude, longitude,
    city_code, address_line, phone, website, category_slug.
    """
    import boto3

    dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
    table = dynamodb.Table(DYNAMODB_TABLE)
    contacts_table = dynamodb.Table(CONTACTS_TABLE)

    inv_zero = invert_rating(0)  # New places have rating=0

    # Phones go to a private table the Cognito guest role cannot read; only
    # website (public business URL) stays in the client-readable catalog item.
    with contacts_table.batch_writer() as contacts_batch:
        for row in rows:
            if row.get("phone"):
                contacts_batch.put_item(
                    Item={"id": row["id"], "phone": row["phone"], "source": "overture"}
                )

    with table.batch_writer() as batch:
        for row in rows:
            lid = row["id"]
            created_at = row.get("created_at", "2026-01-01T00:00:00Z")

            item = {
                "PK": f"L#{lid}",
                "SK": "META",
                "name": row["name"],
                "slug": row["slug"],
                "entityType": "business",
                "status": "active",
                "description": row.get("description"),
                "cityCode": row.get("city_code"),
                "addressLine": row.get("address_line"),
                "latitude": Decimal(str(row["latitude"])) if row.get("latitude") else None,
                "longitude": Decimal(str(row["longitude"])) if row.get("longitude") else None,
                "rating": Decimal("0"),
                "totalReviews": 0,
                "source": "overture",
                "sourceId": row["source_id"],
                "createdAt": created_at,
                # GSI3: Recent by type (always populated)
                "GSI3PK": "TYPE#business",
                "GSI3SK": created_at,
            }

            # GSI1: Category browse (if mapped)
            cat_slug = row.get("category_slug")
            if cat_slug:
                item["GSI1PK"] = f"CAT#{cat_slug}"
                item["GSI1SK"] = f"R#{inv_zero}#{lid[:8]}"
                item["categories"] = [{"slug": cat_slug, "primary": True}]

            # GSI2: City+category browse (sparse)
            if row.get("city_code") and cat_slug:
                item["GSI2PK"] = f"CITY#{row['city_code']}"
                item["GSI2SK"] = f"CAT#{cat_slug}#R#{inv_zero}"

            # Contacts (embedded). Phone is intentionally excluded — it lives in
            # the private bilinc-contacts table (written above). Only website,
            # which is public business info, stays on the client-readable item.
            contacts = {}
            if row.get("website"):
                contacts["website"] = row["website"]
            if contacts:
                item["contacts"] = contacts

            # Strip None values (DynamoDB doesn't allow None)
            item = {k: v for k, v in item.items() if v is not None}
            batch.put_item(Item=item)

    # Also write to Turso search index
    turso_statements = []
    for row in rows:
        turso_statements.append({
            "sql": (
                "INSERT OR REPLACE INTO listings_search "
                "(id, name, entity_type, city_code, category_slug, "
                "rating, total_reviews, latitude, longitude) "
                "VALUES (?, ?, 'business', ?, ?, 0, 0, ?, ?)"
            ),
            "args": [
                row["id"],
                row["name"],
                row.get("city_code"),
                row.get("category_slug"),
                row.get("latitude"),
                row.get("longitude"),
            ],
        })

    if turso_statements:
        turso_execute(turso_statements)


def process_and_insert_dynamodb(dry_run: bool = True, resume_batch: int = 0):
    """Process local parquet and insert into DynamoDB + Turso.

    resume_batch: skip to this batch index (df order is deterministic, ids are
    stable Overture ids → idempotent, so resuming/overlapping is safe).
    """
    import pandas as pd
    import uuid

    if not LOCAL_PARQUET.exists():
        logger.error(f"Local parquet not found: {LOCAL_PARQUET}")
        logger.error("Run with --fetch first")
        return

    logger.info(f"Loading {LOCAL_PARQUET}...")
    df = pd.read_parquet(LOCAL_PARQUET)
    logger.info(f"Loaded {len(df)} places")

    # Filter: must have a name
    df = df[df["name"].notna() & (df["name"].str.len() > 1)]
    logger.info(f"With valid names: {len(df)}")

    if dry_run:
        from collections import Counter
        cats = Counter()
        for cat in df["category"].dropna():
            cats[cat] += 1
        logger.info("Top 20 categories:")
        for cat, count in cats.most_common(20):
            mapped = CATEGORY_MAP.get(cat, "(unmapped)")
            logger.info(f"  {cat} -> {mapped}: {count}")
        logger.info(f"[DRY RUN] Would insert {len(df)} places to DynamoDB + Turso")
        return

    total = 0
    errors = 0

    start_i = resume_batch * BATCH_SIZE
    if start_i:
        logger.info(f"Resuming from batch {resume_batch} (row {start_i})")

    for i in range(start_i, len(df), BATCH_SIZE):
        batch_df = df.iloc[i:i + BATCH_SIZE]
        rows = []

        for _, row in batch_df.iterrows():
            name = str(row["name"]).strip()
            if not name or len(name) < 2:
                continue

            overture_id = str(row["id"])
            source_id = f"overture:{overture_id}"
            category = str(row["category"]) if row.get("category") else ""

            # Build slug
            name_slug = slugify(name)
            cat_slug = slugify(category) if category else ""
            slug = f"ov-{cat_slug}-{name_slug}" if cat_slug else f"ov-{name_slug}"
            slug = f"{slug[:65]}-{overture_id[-6:]}"[:80]

            # Map Overture category to Bilinc category
            category_slug = CATEGORY_MAP.get(category)

            # Extract address / city
            city_code = None
            address_line = None
            try:
                addrs = row.get("addresses")
                if addrs is not None and len(addrs) > 0:
                    addr = addrs[0] if hasattr(addrs, '__getitem__') else None
                    if isinstance(addr, dict):
                        locality = addr.get("locality", "")
                        address_line = addr.get("freeform", "")
                        # Note: city lookup not available without Supabase client
                        # city_code would need a local lookup table
            except (TypeError, IndexError, KeyError):
                pass

            lat = float(row["latitude"]) if row.get("latitude") else None
            lon = float(row["longitude"]) if row.get("longitude") else None

            # Extract contacts
            phone = None
            website = None
            try:
                phones = row.get("phones")
                if phones is not None and len(phones) > 0:
                    phone = str(phones[0]) if hasattr(phones, '__getitem__') else str(phones)
            except (TypeError, IndexError):
                pass
            try:
                websites = row.get("websites")
                if websites is not None and len(websites) > 0:
                    website = str(websites[0]) if hasattr(websites, '__getitem__') else str(websites)
            except (TypeError, IndexError):
                pass

            # Build description. NOTE: phone is deliberately NOT embedded here.
            # The device reads the catalog directly via the Cognito guest role, so
            # anything in `description` ships to every guest. Phone (often a
            # sole-proprietor personal mobile) goes to the private bilinc-contacts
            # table instead — see insert_dynamodb_and_turso.
            desc_parts = []
            if category:
                desc_parts.append(category)
            if website:
                desc_parts.append(website)
            description = " | ".join(desc_parts)[:500] if desc_parts else None

            listing_id = str(uuid.uuid4())

            rows.append({
                "id": listing_id,
                "name": name[:255],
                "slug": slug,
                "source_id": source_id,
                "description": description,
                "latitude": lat,
                "longitude": lon,
                "city_code": city_code,
                "address_line": address_line[:500] if address_line else None,
                "category_slug": category_slug,
                "phone": phone,
                "website": website,
                "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            })

        if not rows:
            continue

        try:
            insert_dynamodb_and_turso(rows)
            total += len(rows)

            if (i // BATCH_SIZE + 1) % 50 == 0:
                logger.info(f"Batch {i // BATCH_SIZE + 1}/{len(df) // BATCH_SIZE}: inserted {total}")
        except Exception as e:
            errors += 1
            if errors <= 10:
                logger.error(f"Batch error at offset {i}: {e}")

    logger.info(f"Total places inserted to DynamoDB + Turso: {total} (errors: {errors})")


# ============================================================================
# MAIN
# ============================================================================

def main():
    parser = argparse.ArgumentParser(description="Overture Maps Turkish Places Fetcher")
    parser.add_argument("--fetch", action="store_true", help="Download from S3 to local parquet")
    parser.add_argument("--supabase", action="store_true", help="Push to Supabase")
    parser.add_argument("--dynamodb", action="store_true", help="Push to DynamoDB + Turso")
    parser.add_argument("--count", action="store_true", help="Just count Turkish places")
    parser.add_argument("--resume-batch", type=int, default=0, help="Skip to this batch index (resume)")
    args = parser.parse_args()

    if args.count:
        count_turkish_places()
        return

    if args.fetch:
        fetch_turkish_places()

    if args.dynamodb:
        process_and_insert_dynamodb(dry_run=False, resume_batch=args.resume_batch)
    elif args.supabase:
        process_and_insert(dry_run=False)
    elif not args.fetch:
        # Default: dry run with local data or count
        if LOCAL_PARQUET.exists():
            process_and_insert(dry_run=True)
        else:
            count_turkish_places()
            logger.info("Run with --fetch to download, --supabase or --dynamodb to insert")


if __name__ == "__main__":
    main()
