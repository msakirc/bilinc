#!/usr/bin/env python3
"""
Bilinc -- Open Food Facts Turkish Products Fetcher

Downloads Open Food Facts data, filters Turkish products, deduplicates
size variants (500ml vs 1L of same product = one listing), and inserts
as entity_type='product' listings with brand linkage.

Data source: https://world.openfoodfacts.org (ODbL license)

Usage:
    python off-products.py                    # Download + process, dry run
    python off-products.py --supabase         # Also push to Supabase
    python off-products.py --dynamodb         # Push to DynamoDB + Turso
    python off-products.py --skip-download    # Use cached parquet, reprocess
"""

import os
import re
import sys
import json
import time
import hashlib
import logging
import argparse
from decimal import Decimal
from pathlib import Path
from collections import defaultdict

import requests
import pandas as pd
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

# DynamoDB + Turso settings (used with --dynamodb flag)
AWS_REGION = os.environ.get("AWS_REGION", "eu-central-1")
DYNAMODB_TABLE = os.environ.get("DYNAMODB_TABLE", "bilinc-catalog")
TURSO_URL = os.environ.get("TURSO_URL", "")
TURSO_AUTH_TOKEN = os.environ.get("TURSO_AUTH_TOKEN", "")

# Hugging Face parquet URL for Open Food Facts
OFF_PARQUET_URL = "https://huggingface.co/datasets/openfoodfacts/product-database/resolve/main/food.parquet?download=true"
OFF_BEAUTY_PARQUET_URL = "https://huggingface.co/datasets/openfoodfacts/product-database/resolve/main/beauty.parquet?download=true"

DATA_DIR = Path(__file__).parent / "data"
FOOD_PARQUET = DATA_DIR / "off-food.parquet"
BEAUTY_PARQUET = DATA_DIR / "off-beauty.parquet"

BATCH_SIZE = 200

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("off-products")

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


# ============================================================================
# DOWNLOAD
# ============================================================================

def download_parquet(url: str, dest: Path):
    """Download a parquet file with progress."""
    if dest.exists():
        size_mb = dest.stat().st_size / (1024 * 1024)
        logger.info(f"Using cached {dest.name} ({size_mb:.0f} MB)")
        return

    logger.info(f"Downloading {dest.name}...")
    resp = requests.get(url, stream=True, timeout=30)
    resp.raise_for_status()

    total = int(resp.headers.get("content-length", 0))
    downloaded = 0

    dest.parent.mkdir(exist_ok=True)
    with open(dest, "wb") as f:
        for chunk in resp.iter_content(chunk_size=8192 * 16):
            f.write(chunk)
            downloaded += len(chunk)
            if total > 0 and downloaded % (50 * 1024 * 1024) < 8192 * 16:
                pct = downloaded / total * 100
                logger.info(f"  {downloaded / (1024*1024):.0f}/{total / (1024*1024):.0f} MB ({pct:.0f}%)")

    size_mb = dest.stat().st_size / (1024 * 1024)
    logger.info(f"Downloaded {dest.name} ({size_mb:.0f} MB)")


# ============================================================================
# PRODUCT NAME CLEANING & DEDUPLICATION
# ============================================================================

# Patterns to strip size/quantity from product names
SIZE_PATTERNS = [
    # "500ml", "1L", "1.5L", "250 ml", "1 lt"
    r'\b\d+[\.,]?\d*\s*(?:ml|cl|dl|l|lt|litre|liter)\b',
    # "500g", "1kg", "250 gr", "1.5 kg"
    r'\b\d+[\.,]?\d*\s*(?:mg|g|gr|gram|kg|kilogram)\b',
    # "6x500ml", "12x330ml", "4'lü"
    r'\b\d+\s*[x×]\s*\d+[\.,]?\d*\s*(?:ml|cl|dl|l|lt|g|gr|kg)\b',
    r"\b\d+['\u2019](?:l[üu]|li)\b",
    # "100 adet", "6 paket"
    r'\b\d+\s*(?:adet|paket|tablet|kapsül|poşet|bardak|şişe|kutu|paket)\b',
    # trailing sizes in parens "(500 ml)" or "- 500ml"
    r'\(\s*\d+[\.,]?\d*\s*(?:ml|cl|dl|l|lt|g|gr|kg)\s*\)',
    r'-\s*\d+[\.,]?\d*\s*(?:ml|cl|dl|l|lt|g|gr|kg)\b',
]

SIZE_RE = re.compile('|'.join(SIZE_PATTERNS), re.IGNORECASE)


def clean_product_name(name: str) -> str:
    """Remove size/quantity info for dedup, keep variant info (light, tam yağlı, etc.)."""
    if not name:
        return ""
    cleaned = SIZE_RE.sub('', name)
    # Collapse whitespace
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    # Remove trailing punctuation artifacts
    cleaned = cleaned.rstrip(' -–,')
    return cleaned


def extract_product_name(product_name_field) -> str:
    """Extract best product name from OFF's multilingual field."""
    if product_name_field is None:
        return ""
    if isinstance(product_name_field, str):
        return product_name_field.strip()
    # Handle list, ndarray, or any iterable of {lang, text} dicts
    try:
        entries = list(product_name_field)
    except (TypeError, ValueError):
        return str(product_name_field).strip()
    # Prefer Turkish, then main, then first available
    for pref in ["tr", "main", "en"]:
        for entry in entries:
            if isinstance(entry, dict) and entry.get("lang") == pref and entry.get("text"):
                return entry["text"].strip()
    # Fallback: first non-empty
    for entry in entries:
        if isinstance(entry, dict) and entry.get("text"):
            return entry["text"].strip()
    return ""


def slugify(name: str) -> str:
    """Turkish-aware slug generation."""
    tr_map = {
        'ş': 's', 'Ş': 'S', 'ı': 'i', 'İ': 'I', 'ğ': 'g', 'Ğ': 'G',
        'ü': 'u', 'Ü': 'U', 'ö': 'o', 'Ö': 'O', 'ç': 'c', 'Ç': 'C',
    }
    slug = name.lower()
    for tr, en in tr_map.items():
        slug = slug.replace(tr, en)
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s_]+', '-', slug)
    slug = re.sub(r'-+', '-', slug).strip('-')[:80]
    return slug


# ============================================================================
# PROCESS PARQUET
# ============================================================================

COLUMNS_TO_READ = [
    "code", "product_name", "brands", "brands_tags",
    "categories", "categories_tags",
    "quantity", "images",
    "nutriscore_grade", "nova_group",
    "countries_tags",
    "ingredients_text", "allergens_tags",
    "labels_tags",
]


def build_image_url(code: str, images) -> str:
    """Build OFF image URL from barcode and images data."""
    if images is None or code is None:
        return ""
    try:
        entries = list(images)
    except (TypeError, ValueError):
        return ""
    # Find front image, or first available
    front_key = None
    first_key = None
    for img in entries:
        if isinstance(img, dict):
            key = img.get("key", "")
            if not first_key:
                first_key = key
            if key.startswith("front"):
                front_key = key
                break
    key = front_key or first_key
    if not key:
        return ""
    # Build barcode path: 8690526019949 → 869/052/601/9949
    code = str(code).zfill(13)
    if len(code) <= 8:
        barcode_path = code
    else:
        barcode_path = f"{code[:3]}/{code[3:6]}/{code[6:9]}/{code[9:]}"
    return f"https://images.openfoodfacts.org/images/products/{barcode_path}/{key}.400.jpg"


def load_turkish_products(parquet_path: Path) -> pd.DataFrame:
    """Load parquet and filter to Turkish products using row-group streaming."""
    import pyarrow.parquet as pq

    logger.info(f"Loading {parquet_path.name} (streaming row groups)...")

    pf = pq.ParquetFile(parquet_path)
    total_rows = pf.metadata.num_rows
    num_groups = pf.metadata.num_row_groups
    logger.info(f"  {total_rows} total rows in {num_groups} row groups")

    # Determine which columns exist (use arrow schema for top-level names)
    schema = pf.schema_arrow
    all_cols = set(schema.field(i).name for i in range(len(schema)))
    cols = [c for c in COLUMNS_TO_READ if c in all_cols]
    logger.info(f"  Reading columns: {cols}")

    turkish_chunks = []
    scanned = 0

    for i in range(num_groups):
        table = pf.read_row_group(i, columns=cols)
        chunk = table.to_pandas()
        scanned += len(chunk)

        # Filter to Turkish products
        def has_turkey(tags):
            if tags is None:
                return False
            try:
                return "en:turkey" in tags
            except (TypeError, ValueError):
                return False

        mask = chunk["countries_tags"].apply(has_turkey)
        turkish = chunk[mask]
        if len(turkish) > 0:
            turkish_chunks.append(turkish)

        if (i + 1) % 10 == 0 or i == num_groups - 1:
            found = sum(len(c) for c in turkish_chunks)
            logger.info(f"  Row group {i+1}/{num_groups}: scanned {scanned}, found {found} Turkish products")

    if turkish_chunks:
        result = pd.concat(turkish_chunks, ignore_index=True)
    else:
        result = pd.DataFrame(columns=cols)

    logger.info(f"Found {len(result)} Turkish products total")
    return result


def process_products(df: pd.DataFrame) -> list[dict]:
    """Process and deduplicate products."""
    products = []

    # Filter out non-Latin script entries (Greek, Arabic, Cyrillic, etc.)
    latin_re = re.compile(r'[a-zA-ZçÇğĞıİöÖşŞüÜ]')

    for _, row in df.iterrows():
        name = extract_product_name(row.get("product_name"))
        if not name or len(name) < 2:
            continue
        # Skip garbage: entries with no Latin/Turkish characters
        if not latin_re.search(name):
            continue

        brand = row.get("brands", "")
        if isinstance(brand, list):
            brand = ", ".join(str(b) for b in brand if b)
        brand = str(brand).strip() if brand else ""

        barcode = str(row.get("code", "")).strip()
        categories = row.get("categories", "")
        if isinstance(categories, list):
            categories = ", ".join(str(c) for c in categories if c)
        categories = str(categories).strip() if categories else ""

        quantity = str(row.get("quantity", "")).strip() if row.get("quantity") else ""
        image_url = build_image_url(barcode, row.get("images"))
        nutriscore = str(row.get("nutriscore_grade", "")).strip() if row.get("nutriscore_grade") else ""
        nova = row.get("nova_group")

        ingredients = row.get("ingredients_text")
        if ingredients is not None and not isinstance(ingredients, str):
            try:
                entries = list(ingredients)
                found = ""
                for pref in ["tr", "main", "en"]:
                    for entry in entries:
                        if isinstance(entry, dict) and entry.get("lang") == pref and entry.get("text"):
                            found = entry["text"]
                            break
                    if found:
                        break
                if not found:
                    for entry in entries:
                        if isinstance(entry, dict) and entry.get("text"):
                            found = entry["text"]
                            break
                ingredients = found
            except (TypeError, ValueError):
                ingredients = ""
        ingredients = str(ingredients).strip()[:2000] if ingredients else ""

        products.append({
            "name": name,
            "brand": brand,
            "barcode": barcode,
            "categories": categories,
            "quantity": quantity,
            "image_url": image_url,
            "nutriscore": nutriscore,
            "nova_group": int(nova) if nova and str(nova).isdigit() else None,
            "ingredients": ingredients,
        })

    logger.info(f"Processed {len(products)} products with names")

    # Deduplicate: same brand + cleaned name = same product
    def normalize_turkish(s: str) -> str:
        """Normalize Turkish characters for dedup key."""
        for tr, en in [('ş','s'),('ı','i'),('ğ','g'),('ü','u'),('ö','o'),('ç','c'),
                        ('Ş','s'),('İ','i'),('Ğ','g'),('Ü','u'),('Ö','o'),('Ç','c')]:
            s = s.replace(tr, en)
        return s.lower()

    dedup = {}
    for p in products:
        clean_name = clean_product_name(p["name"])
        key = f"{normalize_turkish(p['brand'])}::{normalize_turkish(clean_name)}"

        if key not in dedup:
            p["all_barcodes"] = [p["barcode"]] if p["barcode"] else []
            dedup[key] = p
        else:
            existing = dedup[key]
            # Collect all barcodes under the canonical product
            if p["barcode"] and p["barcode"] not in existing.get("all_barcodes", []):
                existing.setdefault("all_barcodes", []).append(p["barcode"])
            # Keep the one with more data (longer name, has image, etc.)
            score_new = (len(p["name"]) + (10 if p["image_url"] else 0) +
                        (5 if p["ingredients"] else 0) + (3 if p["nutriscore"] else 0))
            score_old = (len(existing["name"]) + (10 if existing["image_url"] else 0) +
                        (5 if existing["ingredients"] else 0) + (3 if existing["nutriscore"] else 0))
            if score_new > score_old:
                all_bc = existing.get("all_barcodes", [])
                dedup[key] = p
                dedup[key]["all_barcodes"] = all_bc

    deduped = list(dedup.values())
    multi = sum(1 for p in deduped if len(p.get("all_barcodes", [])) > 1)
    logger.info(f"After dedup: {len(deduped)} unique products (removed {len(products) - len(deduped)} size variants)")
    logger.info(f"  {multi} products have multiple barcodes (size variants merged)")

    return deduped


# ============================================================================
# SUPABASE INSERT
# ============================================================================

def get_supabase():
    from supabase import create_client
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def insert_products(products: list[dict], dry_run: bool = True):
    """Insert products into listings table and link to brands."""
    if dry_run:
        logger.info(f"[DRY RUN] Would insert {len(products)} products")
        # Show stats
        brands = defaultdict(int)
        for p in products:
            brands[p["brand"] or "(no brand)"] += 1
        top_brands = sorted(brands.items(), key=lambda x: -x[1])[:20]
        logger.info("Top 20 brands:")
        for brand, count in top_brands:
            logger.info(f"  {brand}: {count} products")
        with_image = sum(1 for p in products if p["image_url"])
        with_ingredients = sum(1 for p in products if p["ingredients"])
        with_nutriscore = sum(1 for p in products if p["nutriscore"])
        logger.info(f"  With image: {with_image}")
        logger.info(f"  With ingredients: {with_ingredients}")
        logger.info(f"  With nutriscore: {with_nutriscore}")
        return

    client = get_supabase()

    # First, build brand → listing_id cache from existing brand listings
    logger.info("Loading existing brands from DB...")
    brand_cache = {}
    try:
        resp = client.table("listings").select("id,name").eq("entity_type", "brand").execute()
        for row in resp.data:
            brand_cache[row["name"].lower()] = row["id"]
        logger.info(f"Loaded {len(brand_cache)} existing brands")
    except Exception as e:
        logger.warning(f"Could not load brands: {e}")

    # Insert products in batches
    total = 0
    for i in range(0, len(products), BATCH_SIZE):
        batch = products[i:i + BATCH_SIZE]
        rows = []
        for p in batch:
            if p["barcode"]:
                source_id = f"off:{p['barcode']}"
            else:
                hash_input = f"{p['brand']}:{p['name']}"
                source_id = f"off:{hashlib.md5(hash_input.encode()).hexdigest()[:12]}"
            # Build slug with brand prefix for uniqueness
            brand_slug = slugify(p["brand"]) if p["brand"] else ""
            name_slug = slugify(p["name"])
            if brand_slug:
                slug = f"off-{brand_slug}-{name_slug}"[:80]
            else:
                slug = f"off-{name_slug}"[:80]

            # Try to find parent brand
            parent_id = None
            if p["brand"]:
                parent_id = brand_cache.get(p["brand"].lower())

            description_parts = []
            if p["brand"]:
                description_parts.append(p["brand"])
            if p["categories"]:
                description_parts.append(p["categories"][:200])

            row = {
                "name": p["name"][:255],
                "slug": slug,
                "entity_type": "business",
                "status": "active",
                "source": "openfoodfacts",
                "source_id": source_id,
                "parent_id": parent_id,
                "description": " — ".join(description_parts)[:500] if description_parts else None,
            }
            rows.append(row)

        try:
            resp = client.table("listings").upsert(
                rows, on_conflict="source_id"
            ).execute()
            total += len(resp.data)
            logger.info(f"Batch {i // BATCH_SIZE + 1}: inserted {len(resp.data)} products")
        except Exception as e:
            logger.error(f"Batch insert error at offset {i}: {e}")

    logger.info(f"Total products inserted: {total}")

    # Insert all barcodes into listing_sources for barcode lookup
    logger.info("Inserting barcode mappings into listing_sources...")
    barcode_count = 0
    for i in range(0, len(products), BATCH_SIZE):
        batch = products[i:i + BATCH_SIZE]
        sources_rows = []
        for p in batch:
            barcodes = p.get("all_barcodes", [])
            if not barcodes:
                continue
            # Get listing_id from source_id
            if p["barcode"]:
                sid = f"off:{p['barcode']}"
            else:
                hash_input = f"{p['brand']}:{p['name']}"
                sid = f"off:{hashlib.md5(hash_input.encode()).hexdigest()[:12]}"
            try:
                resp = client.table("listings").select("id").eq("source_id", sid).execute()
                if not resp.data:
                    continue
                listing_id = resp.data[0]["id"]
                for bc in barcodes:
                    sources_rows.append({
                        "listing_id": listing_id,
                        "source": "barcode",
                        "external_id": bc,
                        "confidence_score": 1.0,
                    })
            except Exception:
                pass

        if sources_rows:
            try:
                client.table("listing_sources").upsert(
                    sources_rows, on_conflict="source,external_id"
                ).execute()
                barcode_count += len(sources_rows)
            except Exception as e:
                logger.error(f"Barcode insert error: {e}")

    logger.info(f"Inserted {barcode_count} barcode mappings")


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


def invert_rating(rating: float) -> str:
    """Invert rating for descending sort in DynamoDB.
    Rating 4.2 -> score 420 -> inverted 10000-420=9580 -> '09580'
    """
    score = int(round((rating or 0) * 100))
    inverted = 10000 - score
    return f"{inverted:05d}"


def insert_products_dynamodb(products: list[dict], dry_run: bool = True):
    """Insert products into DynamoDB + Turso search index."""
    if dry_run:
        logger.info(f"[DRY RUN] Would insert {len(products)} products to DynamoDB + Turso")
        brands = defaultdict(int)
        for p in products:
            brands[p["brand"] or "(no brand)"] += 1
        top_brands = sorted(brands.items(), key=lambda x: -x[1])[:20]
        logger.info("Top 20 brands:")
        for brand, count in top_brands:
            logger.info(f"  {brand}: {count} products")
        with_image = sum(1 for p in products if p["image_url"])
        with_ingredients = sum(1 for p in products if p["ingredients"])
        with_nutriscore = sum(1 for p in products if p["nutriscore"])
        logger.info(f"  With image: {with_image}")
        logger.info(f"  With ingredients: {with_ingredients}")
        logger.info(f"  With nutriscore: {with_nutriscore}")
        return

    import boto3
    import uuid

    dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
    table = dynamodb.Table(DYNAMODB_TABLE)

    # Build brand name -> brand listing_id cache
    # Scan DynamoDB for existing brand items
    logger.info("Scanning DynamoDB for existing brands...")
    brand_cache = {}
    last_key = None
    while True:
        kwargs = {
            "FilterExpression": "SK = :meta AND entityType = :brand",
            "ExpressionAttributeValues": {":meta": "META", ":brand": "brand"},
        }
        if last_key:
            kwargs["ExclusiveStartKey"] = last_key
        resp = table.scan(**kwargs)
        for item in resp["Items"]:
            name = item.get("name", "")
            brand_cache[name.lower()] = item["PK"].replace("L#", "")
        last_key = resp.get("LastEvaluatedKey")
        if not last_key:
            break
    logger.info(f"Found {len(brand_cache)} existing brands in DynamoDB")

    inv_zero = invert_rating(0)  # New products have rating=0
    total = 0
    errors = 0

    for i in range(0, len(products), BATCH_SIZE):
        batch = products[i:i + BATCH_SIZE]

        # DynamoDB batch write
        with table.batch_writer() as dynamo_batch:
            for p in batch:
                try:
                    # Build source_id and listing_id
                    if p["barcode"]:
                        source_id = f"off:{p['barcode']}"
                    else:
                        hash_input = f"{p['brand']}:{p['name']}"
                        source_id = f"off:{hashlib.md5(hash_input.encode()).hexdigest()[:12]}"

                    listing_id = str(uuid.uuid4())

                    # Build slug
                    brand_slug = slugify(p["brand"]) if p["brand"] else ""
                    name_slug = slugify(p["name"])
                    if brand_slug:
                        slug = f"off-{brand_slug}-{name_slug}"[:80]
                    else:
                        slug = f"off-{name_slug}"[:80]

                    # Find parent brand
                    parent_id = None
                    if p["brand"]:
                        parent_id = brand_cache.get(p["brand"].lower())

                    # Description
                    description_parts = []
                    if p["brand"]:
                        description_parts.append(p["brand"])
                    if p["categories"]:
                        description_parts.append(p["categories"][:200])
                    description = " -- ".join(description_parts)[:500] if description_parts else None

                    created_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

                    item = {
                        "PK": f"L#{listing_id}",
                        "SK": "META",
                        "name": p["name"][:255],
                        "slug": slug,
                        "entityType": "product",
                        "status": "active",
                        "description": description,
                        "rating": Decimal("0"),
                        "totalReviews": 0,
                        "source": "openfoodfacts",
                        "sourceId": source_id,
                        "createdAt": created_at,
                        # Product-specific data
                        "productData": {
                            "barcode": p["barcode"] or None,
                            "allBarcodes": p.get("all_barcodes", []),
                            "brand": p["brand"] or None,
                            "nutriscore": p["nutriscore"] or None,
                            "novaGroup": p["nova_group"],
                            "ingredients": p["ingredients"] or None,
                            "imageUrl": p["image_url"] or None,
                        },
                        # GSI3: Recent by type
                        "GSI3PK": "TYPE#product",
                        "GSI3SK": created_at,
                    }

                    # GSI1: Category browse (use first mapped category if available)
                    # Products don't have a category mapping from OFF categories
                    # but we set a generic one
                    item["GSI1PK"] = "CAT#atistirmalik"
                    item["GSI1SK"] = f"R#{inv_zero}#{listing_id[:8]}"
                    item["categories"] = [{"slug": "atistirmalik", "primary": True}]

                    # GSI4: Parent brand lookup (sparse -- only if parentId)
                    if parent_id:
                        item["parentId"] = f"L#{parent_id}"
                        item["GSI4PK"] = f"PARENT#L#{parent_id}"
                        item["GSI4SK"] = f"product#{p['name']}"

                    # Strip None values from productData
                    item["productData"] = {
                        k: v for k, v in item["productData"].items() if v is not None
                    }

                    # Strip None values from item
                    item = {k: v for k, v in item.items() if v is not None}
                    dynamo_batch.put_item(Item=item)

                    # Store listing_id for Turso batch
                    p["_listing_id"] = listing_id

                    total += 1
                except Exception as e:
                    errors += 1
                    if errors <= 10:
                        logger.error(f"DynamoDB error for {p.get('name', '?')}: {e}")

        # Turso search index batch
        turso_statements = []
        for p in batch:
            lid = p.get("_listing_id")
            if not lid:
                continue
            turso_statements.append({
                "sql": (
                    "INSERT OR REPLACE INTO listings_search "
                    "(id, name, entity_type, category_slug, "
                    "parent_name, rating, total_reviews, photo_url) "
                    "VALUES (?, ?, 'product', 'atistirmalik', ?, 0, 0, ?)"
                ),
                "args": [
                    lid,
                    p["name"],
                    p["brand"] or None,
                    p["image_url"] or None,
                ],
            })

        if turso_statements:
            try:
                turso_execute(turso_statements)
            except Exception as e:
                errors += 1
                if errors <= 10:
                    logger.error(f"Turso batch error at offset {i}: {e}")

        if (i // BATCH_SIZE + 1) % 10 == 0:
            logger.info(f"Batch {i // BATCH_SIZE + 1}: inserted {total} products")

    logger.info(f"Total products inserted to DynamoDB + Turso: {total} (errors: {errors})")


# ============================================================================
# MAIN
# ============================================================================

def main():
    parser = argparse.ArgumentParser(description="Open Food Facts Turkish Products Fetcher")
    parser.add_argument("--supabase", action="store_true", help="Insert into Supabase")
    parser.add_argument("--dynamodb", action="store_true", help="Insert into DynamoDB + Turso")
    parser.add_argument("--skip-download", action="store_true", help="Use cached parquet files")
    parser.add_argument("--include-beauty", action="store_true", help="Also fetch beauty products")
    args = parser.parse_args()

    dry_run = not args.supabase and not args.dynamodb
    DATA_DIR.mkdir(exist_ok=True)

    # Download food parquet
    if not args.skip_download:
        download_parquet(OFF_PARQUET_URL, FOOD_PARQUET)
        if args.include_beauty:
            download_parquet(OFF_BEAUTY_PARQUET_URL, BEAUTY_PARQUET)

    # Process food products
    logger.info("=== Processing Food Products ===")
    food_df = load_turkish_products(FOOD_PARQUET)
    products = process_products(food_df)

    # Process beauty products if requested
    if args.include_beauty and BEAUTY_PARQUET.exists():
        logger.info("=== Processing Beauty Products ===")
        beauty_df = load_turkish_products(BEAUTY_PARQUET)
        beauty_products = process_products(beauty_df)
        products.extend(beauty_products)
        logger.info(f"Total with beauty: {len(products)}")

    # Save to JSON for inspection
    out_path = DATA_DIR / "off-turkish-products.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(products, f, ensure_ascii=False, indent=2)
    logger.info(f"Saved to {out_path}")

    # Insert to target
    if args.dynamodb:
        insert_products_dynamodb(products, dry_run=False)
    else:
        insert_products(products, dry_run=dry_run)

    if dry_run:
        logger.info("Run with --supabase or --dynamodb to insert into database")


if __name__ == "__main__":
    main()
