#!/usr/bin/env python3
"""
Bilinç — Kaggle Turkish Supermarket Food Barcode Database Importer

Reads the Kaggle dataset (19,593 rows), parses brand from product name,
deduplicates size variants, and inserts as entity_type='product' listings.

Dataset: https://www.kaggle.com/datasets/mertneo/turkish-supermarket-food-barcode-database
License: Apache 2.0

Usage:
    python kaggle-products.py                    # Dry run — show stats only
    python kaggle-products.py --supabase         # Insert into Supabase
    python kaggle-products.py --csv PATH         # Use alternate CSV path
"""

import os
import re
import sys
import json
import logging
import argparse
from pathlib import Path
from collections import defaultdict

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

DEFAULT_CSV = Path(
    r"C:\Users\sakir\.cache\kagglehub\datasets\mertneo"
    r"\turkish-supermarket-food-barcode-database\versions\1\barcode_database.csv"
)

BATCH_SIZE = 200

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("kaggle-products")

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


# ============================================================================
# BRAND REGISTRY
# ============================================================================

# Canonical brand name (display) → list of ALL-CAPS aliases found in dataset
# Aliases must be whole words that appear as the first token(s) of a product name.
# If a brand has a multi-word alias (e.g. "DR OETKER") list it first — longest
# match wins.
BRAND_ALIASES: dict[str, list[str]] = {
    "Ülker":        ["ULKER", "ÜLKER"],
    "ETI":          ["ETI", "ETİ"],
    "Pınar":        ["PINAR"],
    "Sütaş":        ["SUTAS"],
    "Torku":        ["TORKU"],
    "Yayla":        ["YAYLA"],
    "Dardanel":     ["DARDANEL"],
    "Tamek":        ["TAMEK"],
    "Tukas":        ["TUKAS"],
    "Knorr":        ["KNORR"],
    "Nestlé":       ["NESTLE"],
    "Danone":       ["DANONE"],
    "Sek":          ["SEK"],
    "İçim":         ["ICIM"],
    "Mis":          ["MIS"],
    "Maret":        ["MARET"],
    "Kızılay":      ["KIZILAY"],
    "Hayat":        ["HAYAT"],
    "Filiz":        ["FILIZ"],
    "Oba":          ["OBA"],
    "Barilla":      ["BARILLA"],
    "Haribo":       ["HARIBO"],
    "Kent":         ["KENT", "KENTON"],
    "Irmak":        ["IRMAK"],
    "Dost":         ["DOST"],
    "Nescafé":      ["NESCAFE"],
    "Lipton":       ["LIPTON"],
    "Calgon":       ["CALGON"],
    "Fairy":        ["FAIRY"],
    "Domestos":     ["DOMESTOS"],
    "Omo":          ["OMO"],
    "Persil":       ["PERSIL"],
    "Ariel":        ["ARIEL"],
    "Colgate":      ["COLGATE"],
    "Signal":       ["SIGNAL"],
    "Oral-B":       ["ORAL-B"],
    "Nivea":        ["NIVEA"],
    "Dove":         ["DOVE"],
    "Rexona":       ["REXONA"],
    "Axe":          ["AXE"],
    "Head&Shoulders": ["HEAD"],
    "Pantene":      ["PANTENE"],
    "Elidor":       ["ELIDOR"],
    "Kotex":        ["KOTEX"],
    "Orkid":        ["ORKID"],
    "Solo":         ["SOLO"],
    "Selpak":       ["SELPAK"],
    "Tursil":       ["TURSIL"],
    # Additional top brands from the dataset
    "Algida":       ["ALGIDA"],
    "Halk":         ["HALK"],
    "Koska":        ["KOSKA"],
    "Tat":          ["TAT"],
    "Başak":        ["BASAK", "BAŞAK"],
    "Alpella":      ["ALPELLA"],
    "Bizim":        ["BIZIM"],
    "Damak":        ["DAMAK"],
    "Carte D'Or":   ["CARTE DOR", "CARTE D'OR"],
    "Superfresh":   ["SUPERFRESH"],
    "Dr. Oetker":   ["DR.OETKER", "DR OETKER", "DR."],
    "Golf":         ["GOLF"],
    "Peyman":       ["PEYMAN"],
    "Star":         ["STAR"],
    "Çaykur":       ["CAYKUR"],
    "Doğadan":      ["DOGADAN"],
    "Şimşek":       ["SIMSEK", "ŞİMŞEK"],
    "Tadım":        ["TADIM"],
    "Cappy":        ["CAPPY"],
    "Kühne":        ["KUHNE"],
    "Uludağ":       ["ULUDAG"],
    "Saray":        ["SARAY"],
    "Vivident":     ["VIVIDENT"],
    "Pakmaya":      ["PAKMAYA"],
    "Uno":          ["UNO"],
    "Yorsan":       ["YORSAN"],
    "Öncü":         ["ONCU"],
    "Sırma":        ["SIRMA"],
    "Tarim":        ["TARIS"],
    "Berrak":       ["BERRAK"],
    "Kemal":        ["KEMAL"],
    "Seyidoğlu":    ["SEYIDOGLU"],
    "Bağdat":       ["BAGDAT", "BAĞDAT"],
    "Milka":        ["MILKA"],
    "Şölen":        ["SOLEN"],
    "Cotanak":      ["COTANAK"],
    "Fresa":        ["FRESA"],
    "Isıl":         ["ISIL"],
    "Mutlu":        ["MUTLU"],
    "Ofçay":        ["OFCAY"],
    "Oricot":       ["ORICOT"],
    "Patos":        ["PATOS"],
    "Penguen":      ["PENGUEN"],
    "Bizden":       ["BIZDEN", "BİZDEN"],
    "Yemen":        ["YEMEN"],
    "Ani":          ["ANI"],
    "Karsa":        ["KARSA"],
}

# Build a lookup: UPPERCASED_ALIAS → canonical display name
# Sort by length descending so multi-word aliases match before single-word ones
_ALIAS_MAP: dict[str, str] = {}
for display, aliases in BRAND_ALIASES.items():
    for alias in aliases:
        _ALIAS_MAP[alias.upper()] = display

# For multi-word brand names: max alias word count (to know how many tokens to try)
_MAX_BRAND_WORDS = max(len(a.split()) for a in _ALIAS_MAP)


# ============================================================================
# SIZE PATTERNS (for deduplication — strip before comparing)
# ============================================================================

SIZE_PATTERNS = [
    # "500ML", "1LT", "1.5L", "250 ML"
    r'\b\d+[\.,]?\d*\s*(?:ML|CL|DL|L|LT|LITRE|LITER)\b',
    # "500G", "1KG", "250 GR", "1.5 KG"
    r'\b\d+[\.,]?\d*\s*(?:MG|G|GR|GRAM|KG|KILOGRAM)\b',
    # "6x500ML", "12x330ML"
    r'\b\d+\s*[xX×]\s*\d+[\.,]?\d*\s*(?:ML|CL|DL|L|LT|G|GR|KG)\b',
    # "100 ADET", "6 PAKET", "20LI" (like "20LI.ELMA")
    r'\b\d+\s*(?:ADET|PAKET|TABLET|KAPSUL|POSET|BARDAK|SISE|KUTU)\b',
    r'\b\d+L[İI]?\b',
    # "(500 ML)"
    r'\(\s*\d+[\.,]?\d*\s*(?:ML|CL|DL|L|LT|G|GR|KG)\s*\)',
    # "- 500ML"
    r'-\s*\d+[\.,]?\d*\s*(?:ML|CL|DL|L|LT|G|GR|KG)\b',
    # Standalone numbers at start (e.g. "5KG" already handled above, but "5" alone)
    r'^\d+\s+',
]

SIZE_RE = re.compile('|'.join(SIZE_PATTERNS), re.IGNORECASE)

# Dot separator used in this dataset: "500GR.NAR" → size ends before dot, variant after
# We handle this by splitting on the last dot when a size precedes it.
DOT_SIZE_RE = re.compile(
    r'(\d+[\.,]?\d*\s*(?:ML|CL|DL|L|LT|LITRE|LITER|MG|G|GR|GRAM|KG|KILOGRAM))\.',
    re.IGNORECASE,
)


# ============================================================================
# TURKISH CHARACTER MAPS
# ============================================================================

# For title-casing: map uppercase Turkish chars → lowercase
_TR_LOWER = str.maketrans(
    "ABCDEFGHIJKLMNOPQRSTUVWXYZÜÖÇŞĞİ",
    "abcdefghijklmnopqrstuvwxyzüöçşği",
)

# For slug generation: Turkish → ASCII
_TR_SLUG = {
    'ş': 's', 'Ş': 'S', 'ı': 'i', 'İ': 'I', 'ğ': 'g', 'Ğ': 'G',
    'ü': 'u', 'Ü': 'U', 'ö': 'o', 'Ö': 'O', 'ç': 'c', 'Ç': 'C',
}

# For dedup key normalisation
_TR_NORM = {'ş':'s','ı':'i','ğ':'g','ü':'u','ö':'o','ç':'c',
            'Ş':'s','İ':'i','Ğ':'g','Ü':'u','Ö':'o','Ç':'c'}


def tr_lower(s: str) -> str:
    return s.translate(_TR_LOWER)


def tr_title(s: str) -> str:
    """Title-case a string respecting Turkish İ/ı distinction."""
    words = s.split()
    result = []
    for w in words:
        if not w:
            continue
        first = w[0]
        rest = tr_lower(w[1:]) if len(w) > 1 else ""
        # Uppercase the first char using standard upper (already uppercase in input)
        result.append(first + rest)
    return " ".join(result)


def normalize_tr(s: str) -> str:
    """Normalize Turkish chars for dedup key comparison."""
    for k, v in _TR_NORM.items():
        s = s.replace(k, v)
    return s.lower()


def slugify(name: str) -> str:
    """Turkish-aware slug generation."""
    slug = name.lower()
    for tr, en in _TR_SLUG.items():
        slug = slug.replace(tr, en.lower())
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s_]+', '-', slug)
    slug = re.sub(r'-+', '-', slug).strip('-')[:80]
    return slug


# ============================================================================
# BRAND PARSING
# ============================================================================

def parse_brand(product_name_upper: str) -> tuple[str, str]:
    """
    Given an ALL-CAPS product name, attempt to match a known brand prefix.

    Returns (brand_display, remaining_name_upper).
    brand_display is empty string if no brand matched.
    remaining_name_upper is everything after the brand tokens.
    """
    tokens = product_name_upper.split()
    if not tokens:
        return ("", product_name_upper)

    # Try longest possible brand match first
    for n in range(min(_MAX_BRAND_WORDS, len(tokens)), 0, -1):
        candidate = " ".join(tokens[:n])
        if candidate in _ALIAS_MAP:
            brand = _ALIAS_MAP[candidate]
            remaining = " ".join(tokens[n:])
            return (brand, remaining)

    return ("", product_name_upper)


# ============================================================================
# PRODUCT NAME CLEANING
# ============================================================================

def preprocess_name(raw: str) -> str:
    """
    The dataset uses dot as a separator between size and variant:
      "KIZILAY SODA 200ML.NAR" → the .NAR is a flavor suffix.
    Replace "SIZEunit.SUFFIX" → "SIZE unit SUFFIX" so our size regex
    strips the size and we keep the suffix.
    """
    # Replace e.g. "200ML.NAR" → "200ML NAR"
    result = DOT_SIZE_RE.sub(r'\1 ', raw)
    # Also handle plain trailing dot: "COTANAK AYCICEK YAGI 1LT." → strip trailing dot
    result = result.rstrip('. ')
    return result


def clean_for_dedup(name_upper: str) -> str:
    """Strip sizes and punctuation noise from an ALL-CAPS name for dedup key generation."""
    cleaned = SIZE_RE.sub(' ', name_upper)
    # Strip hyphens, plus signs, asterisks, dots, and other punctuation noise
    cleaned = re.sub(r'[-+–*.]', ' ', cleaned)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    cleaned = cleaned.rstrip(' .,')
    return cleaned


def display_name(brand: str, remaining_upper: str) -> str:
    """
    Build the final display name for the product.
    Strip sizes from the remaining part, then title-case.
    Prepend brand if present.
    """
    # Preprocess dot separator in remaining part
    remaining = preprocess_name(remaining_upper)
    # Strip sizes
    product_part = SIZE_RE.sub(' ', remaining)
    product_part = re.sub(r'\s+', ' ', product_part).strip().rstrip(' -–,.')
    if not product_part:
        return brand if brand else ""

    # Title-case the product part
    product_display = tr_title(product_part)

    if brand:
        return f"{brand} {product_display}"
    return product_display


# ============================================================================
# CSV PROCESSING
# ============================================================================

def load_csv(csv_path: Path) -> list[dict]:
    """Load the Kaggle barcode CSV."""
    import csv as csv_mod
    logger.info(f"Loading {csv_path} ...")
    rows = []
    with open(csv_path, encoding="utf-8") as f:
        reader = csv_mod.DictReader(f)
        for row in reader:
            if row.get("Product_Name"):
                rows.append(row)
    logger.info(f"Loaded {len(rows)} rows with product names")
    return rows


def process_rows(rows: list[dict]) -> list[dict]:
    """Parse brand, clean name, deduplicate size variants."""
    products = []
    brand_counts: dict[str, int] = defaultdict(int)

    for row in rows:
        raw_name = (row.get("Product_Name") or "").strip()
        barcode = (row.get("Barcode_ID") or "").strip()
        if not raw_name:
            continue

        # Preprocess dot-separated size.variant pattern
        preprocessed = preprocess_name(raw_name)

        # Parse brand from the preprocessed name
        brand, remaining = parse_brand(preprocessed.upper())

        # Build display name (title-cased, sizes stripped)
        name = display_name(brand, remaining)
        if not name or len(name) < 2:
            continue

        brand_counts[brand or "(no brand)"] += 1

        products.append({
            "name": name,
            "brand": brand,
            "barcode": barcode,
            "raw_name": raw_name,
            "remaining_upper": remaining,
        })

    logger.info(f"Parsed {len(products)} products")

    # Stats: how many had a brand matched
    with_brand = sum(1 for p in products if p["brand"])
    logger.info(f"  With known brand: {with_brand} ({100*with_brand//len(products)}%)")
    top_brands = sorted(brand_counts.items(), key=lambda x: -x[1])[:20]
    logger.info("  Top 20 brands:")
    for b, c in top_brands:
        logger.info(f"    {b}: {c}")

    # Dedup: same brand + cleaned remaining = same product (strip sizes first)
    # Collect all barcodes under canonical product
    dedup: dict[str, dict] = {}
    for p in products:
        clean_remaining = clean_for_dedup(p["remaining_upper"])
        key = f"{normalize_tr(p['brand'])}::{normalize_tr(clean_remaining)}"

        if key not in dedup:
            p["all_barcodes"] = [p["barcode"]] if p.get("barcode") else []
            dedup[key] = p
        else:
            existing = dedup[key]
            # Collect barcode
            if p.get("barcode") and p["barcode"] not in existing.get("all_barcodes", []):
                existing.setdefault("all_barcodes", []).append(p["barcode"])
            # Keep whichever has a longer display name (more descriptive)
            if len(p["name"]) > len(existing["name"]):
                all_bc = existing.get("all_barcodes", [])
                dedup[key] = p
                dedup[key]["all_barcodes"] = all_bc

    deduped = list(dedup.values())
    multi = sum(1 for p in deduped if len(p.get("all_barcodes", [])) > 1)
    logger.info(
        f"After dedup: {len(deduped)} unique products "
        f"(removed {len(products) - len(deduped)} size variants)"
    )
    logger.info(f"  {multi} products have multiple barcodes merged")
    return deduped


# ============================================================================
# SUPABASE INSERT
# ============================================================================

def get_supabase():
    from supabase import create_client
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def insert_products(products: list[dict], dry_run: bool = True):
    """Upsert products into listings table."""
    if dry_run:
        logger.info(f"[DRY RUN] Would upsert {len(products)} products")
        logger.info("  Sample products:")
        for p in products[:15]:
            logger.info(f"    [{p['brand'] or 'no brand'}] {p['name']}  (barcode: {p['barcode']})")
        return

    client = get_supabase()

    # Build brand name → listing_id cache (brand listings already in DB)
    brand_cache: dict[str, str] = {}
    try:
        logger.info("Loading existing brand listings from DB...")
        resp = client.table("listings").select("id,name").eq("entity_type", "brand").execute()
        for row in resp.data:
            brand_cache[normalize_tr(row["name"])] = row["id"]
        logger.info(f"  Loaded {len(brand_cache)} brands")
    except Exception as e:
        logger.warning(f"Could not load brands: {e}")

    total_upserted = 0
    errors = 0

    for batch_start in range(0, len(products), BATCH_SIZE):
        batch = products[batch_start : batch_start + BATCH_SIZE]
        rows = []
        for p in batch:
            source_id = f"kaggle:{p['barcode']}" if p["barcode"] else None
            if not source_id:
                # Shouldn't happen, but skip if no barcode
                continue

            brand_slug = slugify(p["brand"]) if p["brand"] else ""
            name_slug = slugify(p["name"])
            if brand_slug:
                slug = f"kg-{brand_slug}-{name_slug}"[:80]
            else:
                slug = f"kg-{name_slug}"[:80]

            parent_id = None
            if p["brand"]:
                parent_id = brand_cache.get(normalize_tr(p["brand"]))

            description = p["brand"] if p["brand"] else None

            rows.append({
                "name": p["name"][:255],
                "slug": slug,
                "entity_type": "business",
                "status": "active",
                "source": "kaggle_barcode",
                "source_id": source_id,
                "parent_id": parent_id,
                "description": description,
            })

        if not rows:
            continue

        try:
            resp = client.table("listings").upsert(
                rows, on_conflict="source_id"
            ).execute()
            count = len(resp.data)
            total_upserted += count
            batch_num = batch_start // BATCH_SIZE + 1
            logger.info(f"Batch {batch_num}: upserted {count} products")
        except Exception as e:
            errors += 1
            logger.error(f"Batch error at offset {batch_start}: {e}")

    logger.info(f"Done. Total upserted: {total_upserted}, batches with errors: {errors}")

    # Insert all barcodes into listing_sources for barcode lookup
    logger.info("Inserting barcode mappings into listing_sources...")
    barcode_total = 0
    for batch_start in range(0, len(products), BATCH_SIZE):
        batch = products[batch_start:batch_start + BATCH_SIZE]
        sources_rows = []
        for p in batch:
            barcodes = p.get("all_barcodes", [])
            if len(barcodes) <= 1:
                continue  # Only store when there are multiple barcodes
            source_id = f"kaggle:{p['barcode']}"
            try:
                resp = client.table("listings").select("id").eq("source_id", source_id).execute()
                if not resp.data:
                    continue
                listing_id = resp.data[0]["id"]
                for bc in barcodes:
                    sources_rows.append({
                        "listing_id": listing_id,
                        "source": "barcode",
                        "external_id": str(bc),
                        "confidence_score": 1.0,
                    })
            except Exception:
                pass

        if sources_rows:
            try:
                client.table("listing_sources").upsert(
                    sources_rows, on_conflict="source,external_id"
                ).execute()
                barcode_total += len(sources_rows)
            except Exception as e:
                logger.error(f"Barcode insert error: {e}")

    logger.info(f"Inserted {barcode_total} barcode mappings")


# ============================================================================
# MAIN
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Kaggle Turkish Supermarket Barcode Database Importer"
    )
    parser.add_argument("--supabase", action="store_true",
                        help="Upsert into Supabase (default: dry run)")
    parser.add_argument("--csv", type=str, default=None,
                        help="Path to barcode_database.csv (default: cached Kaggle path)")
    parser.add_argument("--save-json", action="store_true",
                        help="Save processed products to data/kaggle-products.json")
    args = parser.parse_args()

    dry_run = not args.supabase
    csv_path = Path(args.csv) if args.csv else DEFAULT_CSV

    if not csv_path.exists():
        logger.error(f"CSV not found: {csv_path}")
        logger.error("Download from: https://www.kaggle.com/datasets/mertneo/turkish-supermarket-food-barcode-database")
        sys.exit(1)

    rows = load_csv(csv_path)
    products = process_rows(rows)

    if args.save_json or dry_run:
        out_path = Path(__file__).parent / "data" / "kaggle-products.json"
        out_path.parent.mkdir(exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(
                [{"name": p["name"], "brand": p["brand"], "barcode": p["barcode"]} for p in products],
                f, ensure_ascii=False, indent=2
            )
        logger.info(f"Saved preview to {out_path}")

    insert_products(products, dry_run=dry_run)

    if dry_run:
        logger.info("Run with --supabase to insert into database")


if __name__ == "__main__":
    main()
