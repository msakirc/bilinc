#!/usr/bin/env python3
"""
Bilinç — Turkish Association Member Scraper

Scrapes Turkish food industry association member lists and inserts them
as entity_type='brand' listings into Supabase.

Sources:
  - ASUDER (Dairy)        https://www.asuder.org.tr/hakkimizda/uyelerimiz/
  - SETBİR (Milk/Meat)    https://www.setbir.org.tr/uyelerimiz
  - MEYED (Fruit Juice)   https://meyed.org.tr/our-members-2/
  - BESD-BİR (Poultry)    https://besd-bir.org/en/partners
  - TGDF (Federation)     https://www.tgdf.org.tr/en/about-us/member-associations/

Usage:
    python association-brands.py                # Dry run, print brands
    python association-brands.py --supabase     # Also push to Supabase
"""

import os
import re
import sys
import json
import time
import logging
import argparse
from pathlib import Path

# Fix Windows console encoding for Turkish chars
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import requests
from bs4 import BeautifulSoup

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    pass

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

USER_AGENT = "BilinçApp/1.0 (https://bilinc.app; data import)"
BATCH_SIZE = 200
REQUEST_DELAY = 2  # seconds between requests

DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)
OUTPUT_FILE = DATA_DIR / "association-brands.json"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("association-brands")


# ============================================================================
# ASSOCIATION CONFIGS
# ============================================================================

ASSOCIATIONS = [
    {
        "id": "asuder",
        "name": "ASUDER",
        "full_name": "ASUDER - Süt Ürünleri Sanayicileri Derneği",
        "url": "https://www.asuder.org.tr/hakkimizda/uyelerimiz/",
        "parser": "asuder",
    },
    {
        "id": "setbir",
        "name": "SETBİR",
        "full_name": "SETBİR - Türkiye Süt, Et, Gıda Sanayicileri ve Üreticileri Birliği",
        "url": "https://www.setbir.org.tr/uyelerimiz",
        "parser": "setbir",
    },
    {
        "id": "meyed",
        "name": "MEYED",
        "full_name": "MEYED - Meyve Suyu Endüstrisi Derneği",
        "url": "https://meyed.org.tr/our-members-2/",
        "parser": "meyed",
    },
    {
        "id": "besd-bir",
        "name": "BESD-BİR",
        "full_name": "BESD-BİR - Beyaz Et Sanayicileri ve Damızlıkçıları Birliği Derneği",
        "url": "https://besd-bir.org/en/partners",
        "parser": "besdbir",
    },
    {
        "id": "tgdf",
        "name": "TGDF",
        "full_name": "TGDF - Türkiye Gıda ve İçecek Sanayii Dernekleri Federasyonu",
        "url": "https://www.tgdf.org.tr/en/about-us/member-associations/",
        "parser": "tgdf",
    },
]

# ============================================================================
# SKIP KEYWORDS — supplier/non-brand entries
# ============================================================================

SKIP_KEYWORDS = [
    "MAKİNA", "MAKİNE", "MAK.",  # Machinery manufacturers
    "AMBALAJ",                    # Packaging suppliers
    "LABORATUVAR", "LAB.",        # Labs / testing equipment
    "DANIŞMANLIK", "DANISMANLIK", "MÜŞAVİRLİK",  # Consulting
    "KİMYA", "KİMYEVİ",          # Chemical companies
    "LOJİSTİK",                   # Logistics
    "MÜHENDİSLİK",               # Engineering
    "YAZILIM", "BİLİŞİM",        # Software / IT
    "PLASTİK", "PLASTIK",         # Packaging/plastics
    "GÜBRE", "GUBRE",             # Fertilizers
    "PAKETLEME",                  # Packaging
    "SEPARATOR", "SEPERATOR",     # Industrial separators (GEA Westfalia etc.)
    "KODLAMA",                    # Coding/labeling systems
    "ACENTELİĞİ",                 # Shipping agencies
    "TAAH.",                      # Construction contractors
    "DIAGNOSTIK", "DİAGNOSTİK",  # Medical diagnostics
    "BİYOTEKNOLOJİ",             # Biotechnology suppliers
    "ANALİTİK CİHAZ",            # Analytical instruments (Bentley Farm/MerkIM)
    "TEMİZLEME SİSTEM",          # Cleaning systems (ECOLAB)
    "ISITMA-SOĞUTMA", "ISITMA SOĞUTMA",  # HVAC suppliers
    "END. MAK", "GIDA END. MAK",  # Food industry machinery
    "AROMA ESANS", "ESANS SAN",  # Flavor/essence suppliers (IFF, Firmenich, Döhler)
    "AROMA VE KATKI",             # Aroma & additive suppliers
    "AROMA GIDA KATKI",           # Aroma & food additive suppliers
    "PROSES ÇÖZÜMLERİ",          # Process solutions suppliers
    "SUPERVISE GÖZETME",          # Inspection/certification services (SGS)
    "ETÜD KONTROL",               # Inspection services
    "ENDÜSTRİYEL",               # Industrial equipment/suppliers
    "KONSANTRE",                  # Concentrate suppliers (Erkon Konsantre)
    "ESANS", "KOKU",              # Essence/fragrance suppliers
    "CAM SANAYİ", "CAM A.Ş",     # Glass manufacturers
    "PACKAGING SOLUTIONS",        # Packaging
    "ISTANBUL SUMMIT",            # Conferences/events
    "DIŞ TİC. LTD.",              # Purely import/export trading companies
]

# Well-known B2B ingredient/flavor supplier company names to always skip
# (they appear in association lists but sell to manufacturers, not consumers)
KNOWN_SUPPLIER_NAMES = {
    "FIRMENICH", "GIVAUDAN", "GİVUADAN", "DÖHLER", "DSM FOOD",
    "CHR-HANSEN", "CHR HANSEN", "ADM WILD",
}

# Well-known consumer brand names to NEVER skip even if they match skip keywords
# (e.g., a brand called "X Kimya" might be a consumer product)
KNOWN_CONSUMER_BRANDS = {
    "DİMES", "PINAR", "SÜTAŞ", "EKER", "SEK", "TEKSÜT", "ETİ", "ÜLKER",
    "BANVIT", "BEYPİLİÇ", "KESKİNOĞLU", "ŞENPİLİÇ", "UNILEVER", "DANONE",
    "BAHÇIVAN", "ALTINKÖY", "ALPEDO", "KARDA DONDURMA", "YAŞAR", "ŞÖLEN",
    "MURATBEY", "A101", "MİGROS", "CARGILL", "BARRY CALLEBAUT",
    "COCA COLA", "ULUDAĞ", "TAMEK", "DOĞANAY",
}

# Legal suffixes to strip when cleaning company names
LEGAL_SUFFIXES = [
    r"SANAYİ\s+VE\s+TİCARET\s+ANONİM\s+ŞİRKETİ",
    r"SANAYİ\s+VE\s+TİCARET\s+LİMİTED\s+ŞİRKETİ",
    r"SANAYİ\s+VE\s+TİCARET\s+A\.?\s*Ş\.?",
    r"SANAYİ\s+VE\s+TİCARET\s+LTD\.?\s*ŞTİ\.?",
    r"SAN\.\s*VE\s*TİC\.\s*A\.?\s*Ş\.?",
    r"SAN\.\s*VE\s*TİC\.\s*LTD\.?\s*ŞTİ\.?",
    r"SAN\.?\s*VE\s*TİC\.?",
    r"GIDA\s+SANAYİ\s+VE\s+TİCARET\s+A\.?\s*Ş\.?",
    r"GIDA\s+SANAYİ\s+VE\s+TİCARET\s+LTD\.?\s*ŞTİ\.?",
    r"GIDA\s+SAN\.\s*VE\s*TİC\.\s*A\.?\s*Ş\.?",
    r"GIDA\s+SAN\.\s*VE\s*TİC\.\s*LTD\.?\s*ŞTİ\.?",
    r"GIDA\s+SAN\.?\s*TİC\.?\s*A\.?\s*Ş\.?",
    r"GIDA\s+SANAYİ\s+A\.?\s*Ş\.?",
    r"GIDA\s+SAN\.?\s*A\.?\s*Ş\.?",
    r"GIDA\s+A\.?\s*Ş\.?",
    r"GIDA\s+LTD\.?\s*ŞTİ\.?",
    r"SÜT\s+ÜRÜNLERİ\s+A\.?\s*Ş\.?",
    r"SÜT\s+ÜRÜNLERİ\s+SAN\.?\s*A\.?\s*Ş\.?",
    r"SÜT\s+ÜRÜNLERİ\s+SAN\.?\s*LTD\.?\s*ŞTİ\.?",
    r"SÜT\s+ÜRÜNLERİ\s+LTD\.?\s*ŞTİ\.?",
    r"SÜT\s+MAMÜL\.?\s*SAN\.?\s*A\.?\s*Ş\.?",
    r"SÜT\s+MAMÜLLERİ\s+SANAYİ\s+A\.?\s*Ş\.?",
    r"SÜT\s+SANAYİ\s+A\.?\s*Ş\.?",
    r"SÜT\s+SAN\.?\s*TİC\.?\s*A\.?\s*Ş\.?",
    r"SÜT\s+VE\s+SÜT\s+ÜRÜNLERİ\s+A\.?\s*Ş\.?",
    r"SÜT\s+VE\s+SÜT\s+ÜRÜNLERİ\s+LTD\.?\s*ŞTİ\.?",
    r"VE\s+SÜT\s+SAN\.?\s*VE\s*TİC\.?\s*A\.?\s*Ş\.?",
    r"TARIM\s+HAYVANCILIK\s*\.?\s*A\.?\s*Ş\.?",
    r"TARIM\s+TİC\.\s*VE\s*SAN\.\s*LTD\.?\s*ŞTİ\.?",
    r"HAYVANCILIK\s+A\.?\s*Ş\.?",
    r"MEYVECİLİK\s+A\.?\s*Ş\.?",
    r"MEYVE\s+SULARI?\s+VE\s+GIDA\s+SAN\.?\s*A\.?\s*Ş\.?",
    r"MEŞ\.\s*PAZ\.\s*VE\s*DANIŞ\.\s*HİZM\.\s*A\.?\s*Ş\.?",
    r"DIŞ\s+TİCARET\s+A\.?\s*Ş\.?",
    r"DIŞ\s+TİC\.\s*A\.?\s*Ş\.?",
    r"ANONİM\s+ŞİRKETİ",
    r"A\.?\s*Ş\.?$",
    r"LTD\.?\s*ŞTİ\.?",
    r"LİMİTED\s+ŞİRKETİ",
    r"SANAYİ\b",
    r"SAN\.\b",
    r"TİCARET\b",
    r"TİC\.\b",
    r"VE\b",
]


# ============================================================================
# HELPERS
# ============================================================================

def slugify(name: str) -> str:
    """Turkish-aware slug generation."""
    tr_map = {
        "ş": "s", "Ş": "S", "ı": "i", "İ": "I", "ğ": "g", "Ğ": "G",
        "ü": "u", "Ü": "U", "ö": "o", "Ö": "O", "ç": "c", "Ç": "C",
    }
    slug = name.lower()
    for tr, en in tr_map.items():
        slug = slug.replace(tr, en.lower())
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")[:80]
    return slug


def title_case_turkish(s: str) -> str:
    """Title-case a string, Turkish-aware (ı → I, i → İ)."""
    tr_lower_to_title = {"ı": "I", "i": "İ", "ş": "Ş", "ğ": "Ğ", "ü": "Ü", "ö": "Ö", "ç": "Ç"}
    result = []
    capitalize_next = True
    for ch in s:
        if capitalize_next and ch.isalpha():
            result.append(tr_lower_to_title.get(ch, ch.upper()))
            capitalize_next = False
        else:
            result.append(ch)
        if ch in (" ", "-", "/"):
            capitalize_next = True
    return "".join(result)


def should_skip(name: str) -> bool:
    """Return True if this entry is a supplier/non-consumer-brand."""
    upper = name.upper()
    # Never skip well-known consumer brands even if they match keyword patterns
    for known in KNOWN_CONSUMER_BRANDS:
        if known in upper:
            return False
    # Always skip known B2B ingredient/flavor suppliers
    for supplier in KNOWN_SUPPLIER_NAMES:
        if supplier in upper:
            return True
    for kw in SKIP_KEYWORDS:
        if kw in upper:
            return True
    return False


def clean_brand_name(raw: str) -> str:
    """
    Strip legal suffixes from a full company name to get the brand name.
    Returns the cleaned brand name in title case.
    E.g. "PINAR SÜT MAMÜLLERİ SANAYİ A.Ş." → "Pınar"
    """
    name = raw.strip().upper()
    # Remove parenthetical content (e.g. "İÇİM SÜT (AK GIDA SAN. VE TİC. A.Ş.)")
    name = re.sub(r"\s*\([^)]*\)", "", name).strip()

    # Apply suffix patterns in order (most specific first)
    for pattern in LEGAL_SUFFIXES:
        name = re.sub(r"\s+" + pattern + r"\s*$", "", name, flags=re.IGNORECASE).strip()
        name = re.sub(r"\s+" + pattern + r"\s*,", "", name, flags=re.IGNORECASE).strip()

    # Strip trailing punctuation
    name = re.sub(r"[,.\s]+$", "", name).strip()

    # If result is empty, fall back to the original
    if not name:
        return title_case_turkish(raw.strip())

    return title_case_turkish(name)


def fetch_page(url: str, browser_ua: bool = False) -> BeautifulSoup | None:
    """Fetch a URL and return a BeautifulSoup object."""
    # Some sites (e.g. BESD-BİR) reject the custom UA — use a browser UA for those
    ua = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        if browser_ua
        else USER_AGENT
    )
    headers = {
        "User-Agent": ua,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
    }
    try:
        resp = requests.get(url, headers=headers, timeout=30)
        resp.raise_for_status()
        resp.encoding = resp.apparent_encoding or "utf-8"
        return BeautifulSoup(resp.text, "html.parser")
    except requests.RequestException as e:
        logger.error(f"Failed to fetch {url}: {e}")
        return None


# ============================================================================
# PARSERS — one per association
# ============================================================================

def parse_asuder(soup: BeautifulSoup) -> list[tuple[str, str]]:
    """
    ASUDER: Each member card has an <h6 class="vc_custom_heading">.
    The structure varies across entries:
      1. h6 has direct NavigableString children + nested <p> with legal name
         → brand = first direct string, legal = <p> text
      2. h6 has an <a> child with direct string + <p> with legal name inside a
         → brand = a's direct string, legal = <p> text
      3. h6 has two direct NavigableString children, no <p>
         → brand = first string (short), legal = second string (full legal)
      4. h6 has one direct NavigableString, no <p>
         → both brand and legal = that string; run clean_brand_name for display

    Returns list of (brand_name, legal_name) tuples.
    """
    from bs4 import NavigableString
    results = []

    for h6 in soup.find_all("h6", class_="vc_custom_heading"):
        nested_p = h6.find("p")
        a_tag = h6.find("a")

        # Collect direct text from h6 itself (not inside nested tags)
        h6_direct = [t.strip() for t in h6.children
                     if isinstance(t, NavigableString) and t.strip()]

        # Collect direct text from inner <a> if the h6 has no direct text
        a_direct = []
        if a_tag and not h6_direct:
            a_direct = [t.strip() for t in a_tag.children
                        if isinstance(t, NavigableString) and t.strip()]

        all_direct = h6_direct or a_direct

        if nested_p:
            legal = nested_p.get_text(strip=True)
            brand = all_direct[0] if all_direct else clean_brand_name(legal)
        elif len(all_direct) >= 2:
            # First string is brand, second is legal name
            brand = all_direct[0]
            legal = all_direct[1]
        elif len(all_direct) == 1:
            legal = all_direct[0]
            brand = clean_brand_name(legal)
        else:
            continue

        brand = brand.strip()
        legal = legal.strip()
        if brand and len(brand) > 1:
            results.append((title_case_turkish(brand), legal))

    return results


def parse_setbir(soup: BeautifulSoup) -> list[tuple[str, str]]:
    """
    SETBİR: Company names are in bare <p> tags (no figure/figcaption).
    The legal name IS the text; we run clean_brand_name to get the brand name.
    """
    results = []
    for p in soup.find_all("p"):
        text = p.get_text(strip=True)
        if text and len(text) > 1:
            brand = clean_brand_name(text)
            if brand and len(brand) > 1:
                results.append((brand, text))
    return results


def parse_meyed(soup: BeautifulSoup) -> list[tuple[str, str]]:
    """
    MEYED: Each member in a card with <h4> containing the full legal name.
    """
    results = []
    for h4 in soup.find_all("h4"):
        text = h4.get_text(strip=True)
        if text and len(text) > 2:
            brand = clean_brand_name(text)
            if brand and len(brand) > 1:
                results.append((brand, text))
    return results


def parse_besdbir(soup: BeautifulSoup) -> list[tuple[str, str]]:
    """
    BESD-BİR: Each member in a card with <h5> containing an already-clean brand name.
    """
    results = []
    for h5 in soup.find_all("h5"):
        text = h5.get_text(strip=True)
        if text and len(text) > 1:
            results.append((text, text))
    return results


def parse_tgdf(soup: BeautifulSoup) -> list[tuple[str, str]]:
    """
    TGDF: Member sub-associations in <h6> tags.
    Formats vary: "ACRONYM – Description", "ACRONYM | Description", "ACRONYM - Description"
    We strip everything after the separator to get just the acronym/short name.
    """
    results = []
    for h6 in soup.find_all("h6"):
        text = h6.get_text(strip=True)
        if not text or len(text) < 2:
            continue
        # Strip description after "–" (en-dash), "—" (em-dash), "|", or " - " (hyphen with spaces)
        short = re.split(r"\s*[–—|]\s*|\s+-\s+", text)[0].strip()
        if short and len(short) > 1:
            results.append((short, text))
    return results


PARSERS = {
    "asuder": parse_asuder,
    "setbir": parse_setbir,
    "meyed": parse_meyed,
    "besdbir": parse_besdbir,
    "tgdf": parse_tgdf,
}

# Sites that reject the custom user-agent and need a browser UA
BROWSER_UA_SITES = {"besd-bir"}


# ============================================================================
# SCRAPING LOGIC
# ============================================================================

def scrape_association(assoc: dict) -> list[dict]:
    """Fetch and parse one association's member list."""
    logger.info(f"Scraping {assoc['name']} — {assoc['url']}")
    use_browser_ua = assoc["id"] in BROWSER_UA_SITES
    soup = fetch_page(assoc["url"], browser_ua=use_browser_ua)
    if not soup:
        logger.warning(f"Skipping {assoc['name']} — could not fetch page")
        return []

    parser_fn = PARSERS[assoc["parser"]]
    raw_pairs = parser_fn(soup)  # list of (brand_name, legal_name) tuples
    logger.info(f"  Found {len(raw_pairs)} raw entries")

    results = []
    for brand_name, legal_name in raw_pairs:
        brand_name = brand_name.strip()
        legal_name = legal_name.strip()

        if not brand_name or len(brand_name) < 2:
            continue
        # Skip filter uses the legal name (more words to catch supplier keywords)
        if should_skip(legal_name) or should_skip(brand_name):
            logger.debug(f"  SKIP (supplier): {legal_name}")
            continue

        results.append({
            "brand_name": brand_name,
            "legal_name": legal_name,
            "association_id": assoc["id"],
            "association_name": assoc["name"],
            "association_full": assoc["full_name"],
            "source_url": assoc["url"],
        })

    logger.info(f"  Kept {len(results)} brand entries after filtering")
    return results


def deduplicate(all_entries: list[dict]) -> list[dict]:
    """
    Deduplicate across associations by brand name (case-insensitive slug).
    Merge association membership info into description.
    """
    by_slug: dict[str, dict] = {}

    for entry in all_entries:
        slug_key = slugify(entry["brand_name"])
        if slug_key not in by_slug:
            by_slug[slug_key] = {
                "brand_name": entry["brand_name"],
                "legal_names": [],
                "associations": [],
                "source_urls": [],
            }

        existing = by_slug[slug_key]

        if entry["legal_name"] not in existing["legal_names"]:
            existing["legal_names"].append(entry["legal_name"])

        assoc_ref = entry["association_name"]
        if assoc_ref not in existing["associations"]:
            existing["associations"].append(assoc_ref)

        if entry["source_url"] not in existing["source_urls"]:
            existing["source_urls"].append(entry["source_url"])

    deduped = list(by_slug.values())
    logger.info(f"Deduplication: {len(all_entries)} entries → {len(deduped)} unique brands")
    return deduped


def build_listing_rows(brands: list[dict]) -> list[dict]:
    """Convert deduped brand entries into Supabase listing rows."""
    rows = []
    for b in brands:
        brand_name = b["brand_name"]
        slug = slugify(brand_name)
        source_id = f"assoc:{slug}"

        legal_part = b["legal_names"][0] if b["legal_names"] else brand_name
        assoc_list = ", ".join(b["associations"])
        description = f"{legal_part} — Üye: {assoc_list}"
        if len(b["legal_names"]) > 1:
            extras = "; ".join(b["legal_names"][1:])
            description += f" (ayrıca: {extras})"
        description = description[:1000]

        rows.append({
            "name": brand_name,
            "slug": f"assoc-{slug}"[:80],
            "entity_type": "business",
            "status": "active",
            "source": "association",
            "source_id": source_id,
            "description": description,
        })
    return rows


# ============================================================================
# SUPABASE INSERT
# ============================================================================

def get_supabase():
    from supabase import create_client
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def insert_to_supabase(rows: list[dict]):
    """Batch-upsert rows into listings table."""
    client = get_supabase()
    total = 0

    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i:i + BATCH_SIZE]
        try:
            resp = client.table("listings").upsert(
                batch, on_conflict="source_id"
            ).execute()
            count = len(resp.data)
            total += count
            logger.info(f"Batch {i // BATCH_SIZE + 1}: upserted {count} brands")
        except Exception as e:
            logger.error(f"Batch insert error at offset {i}: {e}")

    logger.info(f"Total brands upserted to Supabase: {total}")


# ============================================================================
# MAIN
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Scrape Turkish association member lists → Supabase brand listings"
    )
    parser.add_argument(
        "--supabase",
        action="store_true",
        help="Push scraped brands to Supabase (default: dry run)",
    )
    parser.add_argument(
        "--assoc",
        choices=[a["id"] for a in ASSOCIATIONS],
        help="Scrape only a specific association (default: all)",
    )
    args = parser.parse_args()

    targets = ASSOCIATIONS
    if args.assoc:
        targets = [a for a in ASSOCIATIONS if a["id"] == args.assoc]

    # Scrape all associations
    all_entries: list[dict] = []
    for i, assoc in enumerate(targets):
        entries = scrape_association(assoc)
        all_entries.extend(entries)
        if i < len(targets) - 1:
            logger.info(f"Waiting {REQUEST_DELAY}s before next request...")
            time.sleep(REQUEST_DELAY)

    if not all_entries:
        logger.warning("No entries scraped. Exiting.")
        return

    # Deduplicate
    deduped = deduplicate(all_entries)

    # Build listing rows
    rows = build_listing_rows(deduped)

    # Save to JSON
    output = {
        "scraped_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "total_brands": len(rows),
        "associations_scraped": [a["id"] for a in targets],
        "brands": deduped,
        "listing_rows": rows,
    }
    OUTPUT_FILE.write_text(
        json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    logger.info(f"Saved {len(rows)} brands to {OUTPUT_FILE}")

    # Print summary
    print(f"\n{'='*60}")
    print(f"SCRAPED BRANDS — {'DRY RUN' if not args.supabase else 'LIVE'}")
    print(f"{'='*60}")
    for r in rows[:20]:
        print(f"  {r['name']:<30} [{r['source_id']}]")
        print(f"    {r['description'][:80]}")
    if len(rows) > 20:
        print(f"  ... and {len(rows) - 20} more (see {OUTPUT_FILE})")
    print(f"{'='*60}")
    print(f"Total: {len(rows)} unique brands from {len(targets)} associations")

    # Push to Supabase
    if args.supabase:
        logger.info("Pushing to Supabase...")
        insert_to_supabase(rows)
    else:
        logger.info("Dry run complete. Use --supabase to push to Supabase.")


if __name__ == "__main__":
    main()
