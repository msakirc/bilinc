#!/usr/bin/env python3
"""
Bilinç — Wikidata Turkish Brands & Companies Fetcher

Fetches Turkish brands and companies from Wikidata SPARQL endpoint.
Inserts as entity_type='brand' listings into Supabase.

Data source: https://www.wikidata.org (CC0 license)

Usage:
    python wikidata-brands.py                # Dry run, print stats
    python wikidata-brands.py --supabase     # Fetch + insert into Supabase
"""

import os
import re
import sys
import json
import time
import logging
import argparse
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"
USER_AGENT = "BilinçApp/1.0 (https://bilinc.app; data import)"
BATCH_SIZE = 200

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("wikidata-brands")

# Fix Windows console encoding
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


# ============================================================================
# SPARQL QUERIES
# ============================================================================

# Brands (Q431289) + Trademarks (Q167270) from Turkey
BRANDS_QUERY = """
SELECT DISTINCT ?item ?itemLabel ?itemDescription ?logo ?website ?inception ?industryLabel WHERE {
  {
    ?item wdt:P31/wdt:P279* wd:Q431289 .
    ?item wdt:P17 wd:Q43 .
  } UNION {
    ?item wdt:P31/wdt:P279* wd:Q167270 .
    ?item wdt:P17 wd:Q43 .
  }
  OPTIONAL { ?item wdt:P154 ?logo }
  OPTIONAL { ?item wdt:P856 ?website }
  OPTIONAL { ?item wdt:P571 ?inception }
  OPTIONAL { ?item wdt:P452 ?industry }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "tr,en" }
}
"""

# Companies from Turkey — multiple specific types to avoid timeout on P279* traversal
COMPANY_TYPES = [
    "Q4830453",   # business enterprise
    "Q6881511",   # enterprise
    "Q783794",    # company
    "Q891723",    # public company
    "Q163740",    # nonprofit organization
    "Q3918",      # university
    "Q22687",     # bank
    "Q507619",    # food manufacturer
    "Q18388277",  # technology company
]

COMPANY_QUERY_TEMPLATE = """
SELECT DISTINCT ?item ?itemLabel ?itemDescription ?logo ?website ?inception ?industryLabel WHERE {{
  ?item wdt:P31 wd:{qtype} .
  ?item wdt:P17 wd:Q43 .
  OPTIONAL {{ ?item wdt:P154 ?logo }}
  OPTIONAL {{ ?item wdt:P856 ?website }}
  OPTIONAL {{ ?item wdt:P571 ?inception }}
  OPTIONAL {{ ?item wdt:P452 ?industry }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "tr,en" }}
}}
"""


# ============================================================================
# HELPERS
# ============================================================================

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


def wikidata_id(uri: str) -> str:
    """Extract Q-id from Wikidata URI."""
    return uri.rsplit("/", 1)[-1]


def run_sparql(query: str) -> list:
    """Execute SPARQL query against Wikidata."""
    logger.info("Running SPARQL query...")
    resp = requests.get(
        WIKIDATA_SPARQL,
        params={"query": query, "format": "json"},
        headers={"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json"},
        timeout=120,
    )
    resp.raise_for_status()
    data = resp.json()
    results = data.get("results", {}).get("bindings", [])
    logger.info(f"Got {len(results)} results")
    return results


def parse_results(results: list) -> list[dict]:
    """Parse SPARQL results into listing records."""
    seen = set()
    brands = []

    for row in results:
        qid = wikidata_id(row["item"]["value"])
        if qid in seen:
            continue
        seen.add(qid)

        name = row.get("itemLabel", {}).get("value", "")
        # Skip items where label = Q-id (no human-readable name)
        if not name or name.startswith("Q"):
            continue

        description = row.get("itemDescription", {}).get("value", "")
        logo = row.get("logo", {}).get("value", "")
        website = row.get("website", {}).get("value", "")
        inception = row.get("inception", {}).get("value", "")
        industry = row.get("industryLabel", {}).get("value", "")

        brands.append({
            "qid": qid,
            "name": name,
            "description": description,
            "logo": logo,
            "website": website,
            "inception": inception[:10] if inception else "",
            "industry": industry,
        })

    return brands


# ============================================================================
# SUPABASE INSERT
# ============================================================================

def get_supabase():
    from supabase import create_client
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def insert_brands(brands: list[dict], dry_run: bool = True):
    """Insert brands into listings table."""
    if dry_run:
        logger.info(f"[DRY RUN] Would insert {len(brands)} brands")
        for b in brands[:10]:
            logger.info(f"  {b['name']} ({b['qid']}) — {b['industry'] or 'no industry'}")
        if len(brands) > 10:
            logger.info(f"  ... and {len(brands) - 10} more")
        return

    client = get_supabase()
    total = 0

    for i in range(0, len(brands), BATCH_SIZE):
        batch = brands[i:i + BATCH_SIZE]
        rows = []
        for b in batch:
            slug = slugify(b["name"])
            source_id = f"wikidata:{b['qid']}"

            row = {
                "name": b["name"],
                "slug": slug,
                "entity_type": "business",
                "status": "active",
                "source": "wikidata",
                "source_id": source_id,
                "description": b["description"][:500] if b["description"] else None,
            }
            rows.append(row)

        try:
            resp = client.table("listings").upsert(
                rows, on_conflict="source_id"
            ).execute()
            total += len(resp.data)
            logger.info(f"Batch {i // BATCH_SIZE + 1}: inserted {len(resp.data)} brands")
        except Exception as e:
            logger.error(f"Batch insert error at offset {i}: {e}")

    logger.info(f"Total brands inserted: {total}")

    # Insert contacts (website) for brands that have them
    contacts = []
    for b in brands:
        if b["website"]:
            source_id = f"wikidata:{b['qid']}"
            # We need the listing_id — fetch it
            try:
                resp = client.table("listings").select("id").eq("source_id", source_id).execute()
                if resp.data:
                    contacts.append({
                        "listing_id": resp.data[0]["id"],
                        "website": b["website"],
                    })
            except Exception:
                pass

    if contacts:
        for i in range(0, len(contacts), BATCH_SIZE):
            batch = contacts[i:i + BATCH_SIZE]
            try:
                client.table("listing_contacts").upsert(
                    batch, on_conflict="listing_id"
                ).execute()
            except Exception as e:
                logger.error(f"Contact insert error: {e}")
        logger.info(f"Inserted {len(contacts)} brand contacts (websites)")


# ============================================================================
# MAIN
# ============================================================================

def main():
    parser = argparse.ArgumentParser(description="Wikidata Turkish Brands Fetcher")
    parser.add_argument("--supabase", action="store_true", help="Insert into Supabase")
    args = parser.parse_args()

    dry_run = not args.supabase

    # Fetch brands
    logger.info("=== Fetching Turkish Brands & Trademarks ===")
    brand_results = run_sparql(BRANDS_QUERY)
    brands = parse_results(brand_results)
    logger.info(f"Parsed {len(brands)} unique brands")

    # Fetch companies by type (avoiding timeout on recursive P279* queries)
    logger.info("=== Fetching Turkish Companies ===")
    seen_qids = {b["qid"] for b in brands}
    for qtype in COMPANY_TYPES:
        query = COMPANY_QUERY_TEMPLATE.format(qtype=qtype)
        try:
            results = run_sparql(query)
            companies = parse_results(results)
            added = 0
            for c in companies:
                if c["qid"] not in seen_qids:
                    brands.append(c)
                    seen_qids.add(c["qid"])
                    added += 1
            logger.info(f"  {qtype}: {len(companies)} found, {added} new")
            time.sleep(1)  # Be nice to Wikidata
        except Exception as e:
            logger.warning(f"  {qtype}: query failed — {e}")

    logger.info(f"=== Total: {len(brands)} unique brands/companies ===")

    # Stats
    with_website = sum(1 for b in brands if b["website"])
    with_logo = sum(1 for b in brands if b["logo"])
    with_industry = sum(1 for b in brands if b["industry"])
    logger.info(f"  With website: {with_website}")
    logger.info(f"  With logo: {with_logo}")
    logger.info(f"  With industry: {with_industry}")

    # Save to JSON for inspection
    out_path = Path(__file__).parent / "data" / "wikidata-brands.json"
    out_path.parent.mkdir(exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(brands, f, ensure_ascii=False, indent=2)
    logger.info(f"Saved to {out_path}")

    # Insert
    insert_brands(brands, dry_run=dry_run)

    if dry_run:
        logger.info("Run with --supabase to insert into database")


if __name__ == "__main__":
    main()
