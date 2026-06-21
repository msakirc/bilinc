#!/usr/bin/env python3
"""
Bilinc -- shared catalog primitives for the multi-source ingest pipeline.

Strategy (2026-06-20): Supabase + Turso are PAUSED. There is no primary catalog.
Every scraper fetches whatever is commercially-free, writes a NORMALISED record
to a local file (DB-independent), and a single merge step (`merge-catalog.py`)
dedupes across ALL sources into a canonical per-entity-type catalog. A loader
(later, when the DB is back) pushes the merged output.

    scraper_A ─┐
    scraper_B ─┼─►  data/raw/<source>.jsonl  ──►  merge-catalog.py  ──►  data/catalog/<type>.jsonl
    scraper_C ─┘        (one record per row)          (union-find dedup)      (one record per real entity)

This module = the shared contract: the normalised record shape, the local sink,
and the text/geo helpers the dedup engine reuses. Pure stdlib — no scraper needs
a new dependency to adopt it.
"""

import re
import json
import math
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"
RAW_DIR = DATA_DIR / "raw"
CATALOG_DIR = DATA_DIR / "catalog"

# Entity types. dedup key strategy differs per type (see merge-catalog.py).
ENTITY_BUSINESS = "business"   # POIs: shops, restaurants, venues (FSQ/Overture/OSM/NSI)
ENTITY_PRODUCT = "product"     # packaged goods w/ barcode (Open*Facts)
ENTITY_BRAND = "brand"         # companies/brands (Wikidata/NSI)
ENTITY_WORK = "work"           # creative works: games, music, film (RAWG/MusicBrainz)
ENTITY_TYPES = {ENTITY_BUSINESS, ENTITY_PRODUCT, ENTITY_BRAND, ENTITY_WORK}

# Strong identity keys. Two records sharing ANY of these = the same entity,
# regardless of type-specific fuzzy logic. Add new key names here as sources grow.
STRONG_KEYS = ("gtin", "mbid", "wikidata", "gers", "fsq", "osm")

TR_MAP = {
    'ş': 's', 'Ş': 'S', 'ı': 'i', 'İ': 'I', 'ğ': 'g', 'Ğ': 'G',
    'ü': 'u', 'Ü': 'U', 'ö': 'o', 'Ö': 'O', 'ç': 'c', 'Ç': 'C',
}


def tr_fold(s: str) -> str:
    for tr, en in TR_MAP.items():
        s = s.replace(tr, en)
    return s


def slugify(name: str) -> str:
    slug = tr_fold(name.lower())
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s_]+', '-', slug)
    slug = re.sub(r'-+', '-', slug).strip('-')[:60]
    return slug


def name_tokens(name: str) -> set:
    folded = tr_fold((name or "").lower())
    folded = re.sub(r'[^a-z0-9\s]', ' ', folded)
    return {t for t in folded.split() if len(t) > 1}


def name_jaccard(a: str, b: str) -> float:
    ta, tb = name_tokens(a), name_tokens(b)
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def haversine_m(lat1, lon1, lat2, lon2):
    R = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def make_record(
    *, entity_type: str, source: str, source_id: str, name: str,
    keys: dict | None = None, lat=None, lon=None,
    public: dict | None = None, private: dict | None = None,
    aliases: list | None = None, attrs: dict | None = None,
) -> dict:
    """Build a normalised catalog record.

    keys    : strong identity keys, e.g. {"gtin": "...", "wikidata": "Q..."}.
              Only include keys that are genuinely present.
    public  : client-visible fields {website, socials, category_slug, address,
              city_code, ...}.
    private : NEVER client-visible {phone, email}. Loader routes these to the
              private contacts store. Keeps personal data out of the catalog.
    attrs   : type-specific extras (e.g. product brand, game year, ingredients).
    """
    assert entity_type in ENTITY_TYPES, f"bad entity_type {entity_type}"
    assert name and len(name) >= 2, "record needs a name"
    rec = {
        "entity_type": entity_type,
        "name": name[:255],
        "source": source,
        "source_id": source_id,
        "keys": {k: str(v) for k, v in (keys or {}).items() if v},
        "lat": float(lat) if lat is not None else None,
        "lon": float(lon) if lon is not None else None,
        "public": public or {},
        "private": private or {},
        "aliases": aliases or [],
        "attrs": attrs or {},
    }
    return rec


def write_records(source: str, records: list[dict]) -> Path:
    """Overwrite data/raw/<source>.jsonl with this source's records.

    Overwrite (not append) → a re-run of a scraper is idempotent. Stable
    source_id means the merge step dedupes correctly even across overlapping
    re-runs of different sources.
    """
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    path = RAW_DIR / f"{source}.jsonl"
    with open(path, "w", encoding="utf-8") as f:
        for r in records:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    return path


def iter_raw():
    """Yield every record across data/raw/*.jsonl."""
    if not RAW_DIR.exists():
        return
    for path in sorted(RAW_DIR.glob("*.jsonl")):
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    yield json.loads(line)


# --- fuzzy matchers (relocated from merge-catalog.py; importable home) ---
BIZ_RADIUS_M = 120.0
BIZ_TIGHT_M = 60.0
BIZ_JACCARD = 0.5
PRODUCT_JACCARD = 0.6
BRAND_JACCARD = 0.7
WORK_JACCARD = 0.7


def match_business(a, b, *, require_geo=True):
    if a.get("lat") is None or b.get("lat") is None:
        # Online: never name-only merge a geo-less business (cross-city false merge).
        return False if require_geo else name_jaccard(a["name"], b["name"]) >= 0.8
    d = haversine_m(a["lat"], a["lon"], b["lat"], b["lon"])
    if d > BIZ_RADIUS_M:
        return False
    ta, tb = name_tokens(a.get("name", "")), name_tokens(b.get("name", ""))
    if not ta or not tb:
        return False
    jac = len(ta & tb) / len(ta | tb)
    if jac >= BIZ_JACCARD:
        return True
    return (ta <= tb or tb <= ta) and d <= BIZ_TIGHT_M


def match_product(a, b):
    ba = tr_fold((a.get("attrs", {}).get("brand") or "").lower())
    bb = tr_fold((b.get("attrs", {}).get("brand") or "").lower())
    if ba and bb and ba != bb:
        return False
    return name_jaccard(a.get("name", ""), b.get("name", "")) >= PRODUCT_JACCARD


def match_brand(a, b):
    return name_jaccard(a.get("name", ""), b.get("name", "")) >= BRAND_JACCARD


def match_work(a, b):
    ya = a.get("attrs", {}).get("year")
    yb = b.get("attrs", {}).get("year")
    if ya and yb and ya != yb:
        return False
    return name_jaccard(a.get("name", ""), b.get("name", "")) >= WORK_JACCARD


MATCHERS = {
    ENTITY_BUSINESS: match_business,
    ENTITY_PRODUCT: match_product,
    ENTITY_BRAND: match_brand,
    ENTITY_WORK: match_work,
}


def matcher_for(etype):
    return MATCHERS.get(etype)
