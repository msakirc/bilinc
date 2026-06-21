#!/usr/bin/env python3
"""
Bilinc -- Foursquare OS Places Turkish Fetcher  (+ OSM conflation)

Downloads Turkish POIs from Foursquare's Open Source Places (Apache 2.0),
filters country='TR', drops non-commercial + closed venues, and inserts as
entity_type='business' listings into Supabase or DynamoDB+Turso.

Why FSQ OS *and* Overture? Overture already bundles FSQ, but a head-to-head on
TR coverage is still open (see docs/handoff-data-sourcing.md). This script lets
us pull FSQ raw and CONFLATE it against the already-scraped OSM rows so we end
up with one canonical listing per real-world business, enriched from both,
provenance preserved. Conflation is opt-in (--conflate); without it FSQ rows
just coexist with OSM rows (distinct source_id) and a later batch pass can merge.

Data source + license
    FSQ OS Places — Apache 2.0 (metadata only; NO tips/reviews).
    Legacy public S3 (no auth, still serving parquet as of 2026-06):
        s3://fsq-os-places-us-east-1/release/dt=<DATE>/places/parquet/*
    Foursquare is migrating to the Places Portal (Iceberg catalog, token-gated):
        https://places.foursquare.com/  -> generate token -> DuckDB iceberg scan.
    If the public bucket 404s, set --release to a published dt or switch to the
    Portal path (see PORTAL_NOTE below). NOT the HF mirror (gated/marketing clause).

Schema (flat parquet, one row per POI):
    fsq_place_id, name, latitude, longitude, address, locality, region, postcode,
    admin_region, post_town, country, date_created, date_refreshed, date_closed,
    tel, website, email, facebook_id, instagram, twitter,
    fsq_category_ids (array<string>), fsq_category_labels (array<string>)

Usage:
    python foursquare-places.py --count                  # Count TR places
    python foursquare-places.py --fetch                  # S3 -> local parquet
    python foursquare-places.py --fetch --supabase       # download + push Supabase
    python foursquare-places.py --supabase               # push cached local data
    python foursquare-places.py --fetch --dynamodb       # download + push DynamoDB+Turso
    python foursquare-places.py --dynamodb               # push cached -> DynamoDB+Turso
    python foursquare-places.py --dynamodb --conflate    # merge against OSM (see below)
    python foursquare-places.py --release 2025-04-08 --fetch
"""

import os
import re
import sys
import json
import time
import math
import logging
import argparse
from decimal import Decimal
from pathlib import Path

import requests as http_requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

AWS_REGION = os.environ.get("AWS_REGION", "eu-central-1")
DYNAMODB_TABLE = os.environ.get("DYNAMODB_TABLE", "bilinc-catalog")
# Private table for phone/email — NOT readable by the Cognito guest role.
CONTACTS_TABLE = os.environ.get("CONTACTS_TABLE", "bilinc-contacts")
TURSO_URL = os.environ.get("TURSO_URL", "")
TURSO_AUTH_TOKEN = os.environ.get("TURSO_AUTH_TOKEN", "")

DATA_DIR = Path(__file__).parent / "data"
LOCAL_PARQUET = DATA_DIR / "foursquare-turkey-places.parquet"

# Default FSQ OS Places release on the legacy public bucket. Override with
# --release. Find published dates via the release-notes page or `aws s3 ls
# s3://fsq-os-places-us-east-1/release/ --no-sign-request`.
DEFAULT_RELEASE = os.environ.get("FSQ_RELEASE", "2025-04-08")
FSQ_BUCKET = "fsq-os-places-us-east-1"

# PORTAL_NOTE: if/when the public bucket is retired, swap S3_PLACES for the
# Iceberg scan the Portal hands you, e.g.
#   con.execute("INSTALL iceberg; LOAD iceberg;")
#   SELECT ... FROM iceberg_scan('<portal table>', allow_moved_paths=true)
# and pass the generated token via the S3/HTTP secret. Schema is identical.

# Turkey bounding box (generous): west, south, east, north
TURKEY_BBOX = (25.5, 35.8, 44.8, 42.2)

BATCH_SIZE = 100

# FSQ non-commercial category IDs — admin areas, transit nodes, natural features.
# We never want these in a business-review app. Source: FSQ "Non-Commercial
# Categories" appendix (docs.foursquare.com/.../access-fsq-os-places).
NON_COMMERCIAL_CATEGORY_IDS = {
    "4bf58dd8d48988d1f0931735",  # Airport Gate
    "62d587aeda6648532de2b88c",  # Beer Festival
    "4bf58dd8d48988d12b951735",  # Bus Line
    "52f2ab2ebcbc57f1066b8b3b",  # Christmas Market
    "50aa9e094b90af0d42d5de0d",  # City
    "5267e4d9e4b0ec79466e48c6",  # Conference
    "5267e4d9e4b0ec79466e48c9",  # Convention
    "5345731ebcbc57f1066c39b2",  # Street Food Gathering
    "4bf58dd8d48988d130951735",  # Taxi
    "530e33ccbcbc57f1066bbff3",  # Town
    "5bae9231bedf3950379f89c3",  # Trade Fair
    "4bf58dd8d48988d12a951735",  # Train
    "52e81612bcbc57f1066b7a24",  # Tree
    "530e33ccbcbc57f1066bbff9",  # Village
    "4bf58dd8d48988d1fd941735",  # Intersection
    "4f2a25ac4b909258e854f55f",  # Neighborhood
    "5bae9231bedf3950379f89cd",  # Trail
}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("foursquare-places")

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


# ============================================================================
# SLUG & HELPERS
# ============================================================================

TR_MAP = {
    'ş': 's', 'Ş': 'S', 'ı': 'i', 'İ': 'I', 'ğ': 'g', 'Ğ': 'G',
    'ü': 'u', 'Ü': 'U', 'ö': 'o', 'Ö': 'O', 'ç': 'c', 'Ç': 'C',
}


def _tr_fold(s: str) -> str:
    for tr, en in TR_MAP.items():
        s = s.replace(tr, en)
    return s


def slugify(name: str) -> str:
    slug = _tr_fold(name.lower())
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s_]+', '-', slug)
    slug = re.sub(r'-+', '-', slug).strip('-')[:60]
    return slug


# FSQ category-label -> Bilinç category slug. FSQ labels are hierarchical text
# (e.g. "Dining and Drinking > Restaurant > Turkish Restaurant"); we match on
# the most specific substring first, then fall through to broad buckets. Slugs
# match the taxonomy used by overture-places.py CATEGORY_MAP.
FSQ_LABEL_MAP = [
    ("bakery", "firin-pastane"),
    ("dessert", "firin-pastane"),
    ("pastry", "firin-pastane"),
    ("café", "kafe-bar"),
    ("cafe", "kafe-bar"),
    ("coffee", "kafe-bar"),
    ("bar", "kafe-bar"),
    ("pub", "kafe-bar"),
    ("fast food", "restoran-lokanta"),
    ("restaurant", "restoran-lokanta"),
    ("dining", "restoran-lokanta"),
    ("supermarket", "market-bakkal"),
    ("grocery", "market-bakkal"),
    ("convenience store", "market-bakkal"),
    ("pharmacy", "eczane"),
    ("hospital", "hastane-klinik"),
    ("clinic", "hastane-klinik"),
    ("doctor", "doktor-uzman"),
    ("dentist", "doktor-uzman"),
    ("bank", "banka-finans"),
    ("hotel", "otel-konaklama"),
    ("hostel", "otel-konaklama"),
    ("gas station", "akaryakit"),
    ("automotive repair", "oto-servis"),
    ("car wash", "oto-servis"),
    ("salon / barbershop", "kuafor-berber"),
    ("barber", "kuafor-berber"),
    ("hair salon", "kuafor-berber"),
    ("spa", "guzellik-salonu"),
    ("beauty", "guzellik-salonu"),
    ("gym", "spor-salonu"),
    ("fitness", "spor-salonu"),
    ("school", "egitim"),
    ("university", "egitim"),
    ("college", "egitim"),
]


def map_category(labels) -> str | None:
    """Return a Bilinç category slug from FSQ category labels, or None."""
    if labels is None:
        return None
    try:
        joined = " ".join(str(l) for l in labels).lower()
    except TypeError:
        joined = str(labels).lower()
    for needle, slug in FSQ_LABEL_MAP:
        if needle in joined:
            return slug
    return None


def is_non_commercial(category_ids) -> bool:
    if category_ids is None:
        return False
    try:
        ids = {str(c) for c in category_ids}
    except TypeError:
        return False
    # Drop only if EVERY category is non-commercial (a place tagged both a
    # restaurant and a "City" stays — the commercial tag wins).
    return bool(ids) and ids.issubset(NON_COMMERCIAL_CATEGORY_IDS)


# ============================================================================
# FETCH FROM S3
# ============================================================================

def _places_glob(release: str) -> str:
    return f"s3://{FSQ_BUCKET}/release/dt={release}/places/parquet/*"


def _duck(release: str):
    import duckdb
    con = duckdb.connect()
    con.execute("INSTALL httpfs; LOAD httpfs;")
    con.execute("SET s3_region='us-east-1'")
    # Public bucket is anonymous-readable.
    con.execute("SET s3_access_key_id=''; SET s3_secret_access_key='';")
    return con


def count_turkish_places(release: str):
    con = _duck(release)
    glob = _places_glob(release)
    logger.info(f"Counting TR places in FSQ OS Places (dt={release})...")
    result = con.execute(f"""
        SELECT count(*)
        FROM read_parquet('{glob}')
        WHERE country = 'TR' AND date_closed IS NULL
    """).fetchone()
    logger.info(f"Turkish open places: {result[0]}")
    return result[0]


def fetch_turkish_places(release: str):
    con = _duck(release)
    glob = _places_glob(release)
    DATA_DIR.mkdir(exist_ok=True)

    logger.info("Downloading Turkish places from FSQ OS Places...")
    logger.info(f"  S3: {glob}")
    logger.info(f"  Output: {LOCAL_PARQUET}")

    con.execute(f"""
        COPY (
            SELECT
                fsq_place_id,
                name,
                latitude,
                longitude,
                address,
                locality,
                region,
                postcode,
                tel,
                website,
                email,
                facebook_id,
                instagram,
                twitter,
                fsq_category_ids,
                fsq_category_labels
            FROM read_parquet('{glob}')
            WHERE country = 'TR'
              AND date_closed IS NULL
              AND name IS NOT NULL
              AND latitude  BETWEEN {TURKEY_BBOX[1]} AND {TURKEY_BBOX[3]}
              AND longitude BETWEEN {TURKEY_BBOX[0]} AND {TURKEY_BBOX[2]}
        ) TO '{LOCAL_PARQUET}' (FORMAT PARQUET)
    """)
    result = con.execute(f"SELECT count(*) FROM read_parquet('{LOCAL_PARQUET}')").fetchone()
    logger.info(f"Downloaded {result[0]} Turkish places")
    return result[0]


# ============================================================================
# ROW NORMALISATION (shared by every sink)
# ============================================================================

def normalize_row(row) -> dict | None:
    """Turn one FSQ parquet row into a Bilinç listing dict, or None to skip.

    Privacy split mirrors overture-places.py:
      - tel, email          -> private (bilinc-contacts / never client-visible)
      - website, socials     -> public (catalog item)
    """
    name = (str(row["name"]).strip() if row.get("name") is not None else "")
    if len(name) < 2:
        return None

    if is_non_commercial(row.get("fsq_category_ids")):
        return None

    fsq_id = str(row["fsq_place_id"])
    source_id = f"foursquare:{fsq_id}"

    category_slug = map_category(row.get("fsq_category_labels"))

    name_slug = slugify(name)
    cat_slug = category_slug or ""
    slug = f"fsq-{cat_slug}-{name_slug}" if cat_slug else f"fsq-{name_slug}"
    slug = f"{slug[:65]}-{fsq_id[-6:]}"[:80]

    def _val(k):
        v = row.get(k)
        if v is None:
            return None
        s = str(v).strip()
        return s or None

    lat = float(row["latitude"]) if row.get("latitude") is not None else None
    lon = float(row["longitude"]) if row.get("longitude") is not None else None

    # Address line: prefer freeform address, fall back to locality/region.
    addr_bits = [b for b in (_val("address"), _val("locality"), _val("region")) if b]
    address_line = ", ".join(dict.fromkeys(addr_bits)) if addr_bits else None

    website = _val("website")

    # Public social handles (business, not personal data).
    socials = {}
    if _val("instagram"):
        socials["instagram"] = _val("instagram")
    if _val("twitter"):
        socials["twitter"] = _val("twitter")
    if _val("facebook_id"):
        socials["facebook"] = _val("facebook_id")

    # description is client-visible: category + website + socials, NEVER phone/email.
    desc_bits = []
    if row.get("fsq_category_labels") is not None:
        try:
            lab = next((str(l) for l in row["fsq_category_labels"] if l), None)
            if lab:
                desc_bits.append(lab)
        except TypeError:
            pass
    if website:
        desc_bits.append(website)
    description = " | ".join(desc_bits)[:500] if desc_bits else None

    return {
        "fsq_id": fsq_id,
        "name": name[:255],
        "slug": slug,
        "source_id": source_id,
        "description": description,
        "latitude": lat,
        "longitude": lon,
        "city_code": None,        # resolved at insert (Supabase locality lookup)
        "locality": _val("locality"),
        "address_line": address_line[:500] if address_line else None,
        "category_slug": category_slug,
        "website": website,
        "socials": socials or None,
        "phone": _val("tel"),     # PRIVATE
        "email": _val("email"),   # PRIVATE
    }


def load_parquet_rows():
    import pandas as pd
    if not LOCAL_PARQUET.exists():
        logger.error(f"Local parquet not found: {LOCAL_PARQUET}. Run --fetch first.")
        return None
    logger.info(f"Loading {LOCAL_PARQUET}...")
    df = pd.read_parquet(LOCAL_PARQUET)
    logger.info(f"Loaded {len(df)} rows")
    out = []
    for _, r in df.iterrows():
        norm = normalize_row(r)
        if norm:
            out.append(norm)
    logger.info(f"Normalised {len(out)} commercial, named places")
    return out


# ============================================================================
# OSM CONFLATION
# ============================================================================
#
# Goal: one canonical listing per real-world business across OSM + FSQ, enriched
# from both, provenance kept. OSM is already in the catalog (source=openstreetmap)
# so OSM rows are the canonical anchors here; an FSQ row that matches an OSM row
# ENRICHES it (fills null contacts/website/socials, appends FSQ to `sources`) and
# is NOT inserted as a separate listing. Unmatched FSQ rows insert as new.
#
# Matching = spatial blocking + Turkish-folded name similarity:
#   1. Block by a ~100m grid cell (round lat/lon to 3 dp); compare against the
#      3x3 neighbourhood so businesses near a cell edge still match.
#   2. Gate on Haversine distance (<= MATCH_RADIUS_M).
#   3. Accept if normalised-name token Jaccard >= NAME_JACCARD, OR one name's
#      tokens are a subset of the other AND distance <= TIGHT_RADIUS_M
#      (handles "Starbucks" vs "Starbucks Kadıköy").
#
# This is deliberately conservative: a missed match just means a duplicate row
# (cheaper to clean later than a wrong merge that hides a real business).

MATCH_RADIUS_M = 120.0
TIGHT_RADIUS_M = 60.0
NAME_JACCARD = 0.5
GRID_DP = 3  # round to 3 decimals ~= 85-110m cell in Turkey


def _haversine_m(lat1, lon1, lat2, lon2):
    R = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def _name_tokens(name: str) -> set:
    folded = _tr_fold(name.lower())
    folded = re.sub(r'[^a-z0-9\s]', ' ', folded)
    return {t for t in folded.split() if len(t) > 1}


def _names_match(a: str, b: str, dist_m: float) -> bool:
    ta, tb = _name_tokens(a), _name_tokens(b)
    if not ta or not tb:
        return False
    inter = ta & tb
    union = ta | tb
    jac = len(inter) / len(union)
    if jac >= NAME_JACCARD:
        return True
    if (ta <= tb or tb <= ta) and dist_m <= TIGHT_RADIUS_M:
        return True
    return False


def _grid_key(lat, lon):
    return (round(lat, GRID_DP), round(lon, GRID_DP))


def build_osm_index_from_turso():
    """Pull existing business rows from Turso into a grid-blocked index.

    Returns dict: grid_key -> list of {id, name, lat, lon}. Turso's
    listings_search holds id/name/lat/lon for every catalog row, which is all
    blocking needs. We index ALL businesses (not just OSM) so re-runs also dedupe
    FSQ-vs-FSQ, but only OSM rows are treated as enrichable anchors downstream.
    """
    if not TURSO_URL:
        logger.warning("TURSO_URL unset — conflation disabled, FSQ rows insert as-is.")
        return None

    res = turso_execute([{
        "sql": (
            "SELECT id, name, latitude, longitude FROM listings_search "
            "WHERE entity_type='business' AND latitude IS NOT NULL"
        )
    }])
    index = {}
    n = 0
    try:
        rows = res["results"][0]["response"]["result"]["rows"]
    except (KeyError, IndexError):
        logger.warning("Unexpected Turso response shape; conflation disabled.")
        return None
    for r in rows:
        # Hrana rows are arrays of typed-value objects.
        rid = r[0]["value"]
        name = r[1]["value"]
        lat = float(r[2]["value"])
        lon = float(r[3]["value"])
        index.setdefault(_grid_key(lat, lon), []).append(
            {"id": rid, "name": name, "lat": lat, "lon": lon}
        )
        n += 1
    logger.info(f"Indexed {n} existing catalog rows into {len(index)} grid cells")
    return index


def find_match(row, index):
    """Return the matching existing row dict, or None."""
    if index is None or row.get("latitude") is None:
        return None
    lat, lon = row["latitude"], row["longitude"]
    gk = _grid_key(lat, lon)
    best, best_d = None, MATCH_RADIUS_M
    step = 10 ** (-GRID_DP)
    for dlat in (-step, 0, step):
        for dlon in (-step, 0, step):
            cell = (round(gk[0] + dlat, GRID_DP), round(gk[1] + dlon, GRID_DP))
            for cand in index.get(cell, ()):
                d = _haversine_m(lat, lon, cand["lat"], cand["lon"])
                if d <= MATCH_RADIUS_M and _names_match(row["name"], cand["name"], d):
                    if d < best_d:
                        best, best_d = cand, d
    return best


# ============================================================================
# DYNAMODB + TURSO
# ============================================================================

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
    score = int(round((rating or 0) * 100))
    return f"{10000 - score:05d}"


def enrich_existing(matches: list[dict]):
    """Fill nulls on already-present catalog rows from their FSQ match.

    matches: list of {existing: {id,...}, fsq: <normalized row>}. We only set
    fields that are MISSING on the existing item (never clobber OSM data), append
    the FSQ source_id to a `sources` string-set, and route phone/email to the
    private contacts table.
    """
    import boto3
    dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
    table = dynamodb.Table(DYNAMODB_TABLE)
    contacts_table = dynamodb.Table(CONTACTS_TABLE)

    enriched = 0
    for m in matches:
        ex, fsq = m["existing"], m["fsq"]
        lid = ex["id"]

        # Build one UpdateExpression: ADD the FSQ source to the `sources`
        # string-set, SET only fields that are currently missing.
        expr_parts = []
        vals = {":fsqsrc": set([fsq["source_id"]])}
        add_parts = ["sources :fsqsrc"]

        if fsq.get("website"):
            # Set the whole map only if absent — nested-path update would throw
            # when the existing (OSM) item has no `contacts` map at all.
            expr_parts.append("contacts = if_not_exists(contacts, :web)")
            vals[":web"] = {"website": fsq["website"]}
        if fsq.get("socials"):
            expr_parts.append("socials = if_not_exists(socials, :soc)")
            vals[":soc"] = fsq["socials"]
        if fsq.get("category_slug"):
            expr_parts.append("categorySlug = if_not_exists(categorySlug, :cat)")
            vals[":cat"] = fsq["category_slug"]

        update_expr = "ADD " + ", ".join(add_parts)
        if expr_parts:
            update_expr += " SET " + ", ".join(expr_parts)

        try:
            table.update_item(
                Key={"PK": f"L#{lid}", "SK": "META"},
                UpdateExpression=update_expr,
                ExpressionAttributeValues=vals,
            )
            enriched += 1
        except Exception as e:
            logger.error(f"Enrich failed for {lid}: {e}")

        # Private contacts (phone/email) — only add if we have them.
        if fsq.get("phone") or fsq.get("email"):
            item = {"id": lid, "source": "foursquare"}
            if fsq.get("phone"):
                item["phone"] = fsq["phone"]
            if fsq.get("email"):
                item["email"] = fsq["email"]
            try:
                contacts_table.put_item(Item=item)
            except Exception as e:
                logger.error(f"Contacts write failed for {lid}: {e}")

    logger.info(f"Enriched {enriched} existing rows from FSQ matches")


def insert_new_dynamodb_turso(rows: list[dict]):
    """Insert unmatched FSQ rows as brand-new catalog listings."""
    import boto3
    import uuid

    dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
    table = dynamodb.Table(DYNAMODB_TABLE)
    contacts_table = dynamodb.Table(CONTACTS_TABLE)
    inv_zero = invert_rating(0)
    created_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    with contacts_table.batch_writer() as cb:
        for r in rows:
            if r.get("phone") or r.get("email"):
                item = {"id": r["_id"], "source": "foursquare"}
                if r.get("phone"):
                    item["phone"] = r["phone"]
                if r.get("email"):
                    item["email"] = r["email"]
                cb.put_item(Item=item)

    with table.batch_writer() as batch:
        for r in rows:
            lid = r["_id"]
            cat = r.get("category_slug")
            item = {
                "PK": f"L#{lid}",
                "SK": "META",
                "name": r["name"],
                "slug": r["slug"],
                "entityType": "business",
                "status": "active",
                "description": r.get("description"),
                "cityCode": r.get("city_code"),
                "addressLine": r.get("address_line"),
                "latitude": Decimal(str(r["latitude"])) if r.get("latitude") else None,
                "longitude": Decimal(str(r["longitude"])) if r.get("longitude") else None,
                "rating": Decimal("0"),
                "totalReviews": 0,
                "source": "foursquare",
                "sourceId": r["source_id"],
                "sources": set([r["source_id"]]),
                "createdAt": created_at,
                "GSI3PK": "TYPE#business",
                "GSI3SK": created_at,
            }
            if cat:
                item["GSI1PK"] = f"CAT#{cat}"
                item["GSI1SK"] = f"R#{inv_zero}#{lid[:8]}"
                item["categorySlug"] = cat
                item["categories"] = [{"slug": cat, "primary": True}]
            if r.get("city_code") and cat:
                item["GSI2PK"] = f"CITY#{r['city_code']}"
                item["GSI2SK"] = f"CAT#{cat}#R#{inv_zero}"

            contacts = {}
            if r.get("website"):
                contacts["website"] = r["website"]
            if contacts:
                item["contacts"] = contacts
            if r.get("socials"):
                item["socials"] = r["socials"]

            item = {k: v for k, v in item.items() if v is not None}
            batch.put_item(Item=item)

    turso_statements = [{
        "sql": (
            "INSERT OR REPLACE INTO listings_search "
            "(id, name, entity_type, city_code, category_slug, "
            "rating, total_reviews, latitude, longitude) "
            "VALUES (?, ?, 'business', ?, ?, 0, 0, ?, ?)"
        ),
        "args": [r["_id"], r["name"], r.get("city_code"),
                 r.get("category_slug"), r.get("latitude"), r.get("longitude")],
    } for r in rows]
    if turso_statements:
        turso_execute(turso_statements)


def push_dynamodb(conflate: bool, dry_run: bool):
    import uuid
    rows = load_parquet_rows()
    if rows is None:
        return

    index = build_osm_index_from_turso() if conflate else None

    new_rows, matches = [], []
    for r in rows:
        m = find_match(r, index) if conflate else None
        if m:
            matches.append({"existing": m, "fsq": r})
        else:
            r["_id"] = str(uuid.uuid4())
            new_rows.append(r)
            # add to in-memory index so later FSQ rows dedupe against this one
            if index is not None and r.get("latitude") is not None:
                index.setdefault(_grid_key(r["latitude"], r["longitude"]), []).append(
                    {"id": r["_id"], "name": r["name"],
                     "lat": r["latitude"], "lon": r["longitude"]}
                )

    logger.info(f"Conflation: {len(matches)} matched existing, {len(new_rows)} new")

    if dry_run:
        logger.info(f"[DRY RUN] would enrich {len(matches)} + insert {len(new_rows)}")
        for r in new_rows[:10]:
            logger.info(f"  NEW  {r['name']} ({r.get('category_slug')}) {r.get('locality')}")
        for m in matches[:10]:
            logger.info(f"  MERGE {m['fsq']['name']} -> {m['existing']['name']}")
        return

    if matches:
        enrich_existing(matches)

    total, errors = 0, 0
    for i in range(0, len(new_rows), BATCH_SIZE):
        batch = new_rows[i:i + BATCH_SIZE]
        try:
            insert_new_dynamodb_turso(batch)
            total += len(batch)
        except Exception as e:
            errors += 1
            if errors <= 10:
                logger.error(f"Insert batch at {i} failed: {e}")
    logger.info(f"Inserted {total} new FSQ listings (errors: {errors})")


# ============================================================================
# SUPABASE  (no conflation — Supabase is legacy user-content store)
# ============================================================================

def get_supabase():
    from supabase import create_client
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def load_city_cache(client):
    cities = {}
    try:
        resp = client.table("cities").select("code,name,slug").execute()
        for c in resp.data:
            cities[_tr_fold(c["name"].lower())] = c["code"]
            cities[c["slug"].lower()] = c["code"]
    except Exception as e:
        logger.warning(f"Could not load cities: {e}")
    return cities


def push_supabase(dry_run: bool):
    rows = load_parquet_rows()
    if rows is None:
        return
    if dry_run:
        logger.info(f"[DRY RUN] would upsert {len(rows)} places to Supabase")
        for r in rows[:10]:
            logger.info(f"  {r['name']} ({r.get('category_slug')}) — {r.get('address_line')}")
        return

    client = get_supabase()
    cities = load_city_cache(client)
    total, errors = 0, 0
    for i in range(0, len(rows), BATCH_SIZE):
        listings = []
        for r in rows[i:i + BATCH_SIZE]:
            cc = cities.get(_tr_fold((r.get("locality") or "").lower()))
            listings.append({
                "name": r["name"],
                "slug": r["slug"],
                "entity_type": "business",
                "status": "active",
                "source": "foursquare",
                "source_id": r["source_id"],
                "description": r["description"],
                "latitude": r["latitude"],
                "longitude": r["longitude"],
                "city_code": cc,
                "address_line": r["address_line"],
            })
        try:
            resp = client.table("listings").upsert(listings, on_conflict="source_id").execute()
            total += len(resp.data)
        except Exception as e:
            errors += 1
            if errors <= 10:
                logger.error(f"Supabase batch at {i} failed: {e}")
    logger.info(f"Upserted {total} places to Supabase (errors: {errors})")
    logger.info("Note: phone/email omitted from Supabase (personal data).")


# ============================================================================
# MAIN
# ============================================================================

def push_local():
    """Write normalised records to data/raw/foursquare.jsonl for merge-catalog.py.

    DB-independent sink — the path to use while Supabase + Turso are paused.
    Conflation against OSM happens centrally in merge-catalog.py (strong key
    `fsq` + spatial/name), so this just emits clean per-source rows.
    """
    import catalog_common as cc
    rows = load_parquet_rows()
    if rows is None:
        return
    records = []
    for r in rows:
        public = {k: v for k, v in {
            "website": r.get("website"),
            "socials": r.get("socials"),
            "category_slug": r.get("category_slug"),
            "address": r.get("address_line"),
            "locality": r.get("locality"),
        }.items() if v}
        private = {k: v for k, v in {
            "phone": r.get("phone"), "email": r.get("email"),
        }.items() if v}
        records.append(cc.make_record(
            entity_type=cc.ENTITY_BUSINESS,
            source="foursquare",
            source_id=r["source_id"],
            name=r["name"],
            keys={"fsq": r["fsq_id"]},
            lat=r["latitude"], lon=r["longitude"],
            public=public, private=private,
        ))
    path = cc.write_records("foursquare", records)
    logger.info(f"Wrote {len(records)} records -> {path}")


def main():
    p = argparse.ArgumentParser(description="Foursquare OS Places Turkish Fetcher")
    p.add_argument("--release", default=DEFAULT_RELEASE, help="FSQ release dt (YYYY-MM-DD)")
    p.add_argument("--fetch", action="store_true", help="Download S3 -> local parquet")
    p.add_argument("--local", action="store_true", help="Write normalised data/raw/foursquare.jsonl (DB-independent)")
    p.add_argument("--supabase", action="store_true", help="Push to Supabase")
    p.add_argument("--dynamodb", action="store_true", help="Push to DynamoDB + Turso")
    p.add_argument("--conflate", action="store_true", help="Merge against existing OSM rows (DynamoDB path)")
    p.add_argument("--count", action="store_true", help="Just count TR places")
    p.add_argument("--dry-run", action="store_true", help="Report, don't write")
    args = p.parse_args()

    if args.count:
        count_turkish_places(args.release)
        return
    if args.fetch:
        fetch_turkish_places(args.release)

    if args.dynamodb:
        push_dynamodb(conflate=args.conflate, dry_run=args.dry_run)
    elif args.supabase:
        push_supabase(dry_run=args.dry_run)
    elif not args.fetch:
        if LOCAL_PARQUET.exists():
            push_dynamodb(conflate=args.conflate, dry_run=True)
        else:
            count_turkish_places(args.release)
            logger.info("Run --fetch to download, then --supabase or --dynamodb to insert.")


if __name__ == "__main__":
    main()
