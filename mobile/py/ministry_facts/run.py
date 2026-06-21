"""Ministry facts pipeline CLI.

Usage:
  python -m ministry_facts.run --source all                 # dry-run all
  python -m ministry_facts.run --source tarim --write
  python -m ministry_facts.run --source gubis --write --since 2026-01-01
"""
import os
import sys
import argparse
import logging
from datetime import datetime, timezone
from pathlib import Path
from collections import Counter

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s",
                    datefmt="%H:%M:%S")
logger = logging.getLogger("ministry.run")

from ministry_facts.core import stores, snapshot
from ministry_facts.core.resolver import Resolver
from ministry_facts.core.matcher import CatalogMatcher
from ministry_facts.core.injector import Injector
from ministry_facts.sources.tarim import TarimSource
from ministry_facts.sources.titck import TitckSource
from ministry_facts.sources.gubis import GubisSource
from ministry_facts.sources.eu_safety_gate import EuSafetyGateSource

SOURCES = {"tarim": TarimSource, "titck": TitckSource,
           "gubis": GubisSource, "eu": EuSafetyGateSource}
SYSTEM_USER = os.environ.get("SYSTEM_USER_ID", "00000000-0000-0000-0000-000000000001")


def run_source(key: str, write: bool, since: str | None):
    src = SOURCES[key]()
    logger.info(f"=== {key} (write={write}) ===")
    sb = stores.get_supabase()  # needed for dedup reads even in dry-run
    dynamo = stores.get_dynamo_table() if write else None
    matcher = CatalogMatcher(stores.turso_search_candidates)
    resolver = Resolver(supabase=sb, dynamo_table=dynamo, write=write, matcher=matcher)
    stats = Counter()
    raw_dump = []
    for entry in src.fetch(since=since):
        stats["fetched"] += 1
        raw_dump.append(entry.raw)
        listing_id = resolver.resolve(entry)
        stats[f"resolve_{resolver.last_outcome}"] += 1
        if listing_id is None:
            continue
        name = (entry.marka or entry.firma)[:255]
        inj = Injector(supabase=sb, system_user_id=SYSTEM_USER, write=write,
                       listing_name=name, listing_slug_val=None)
        result = inj.inject(entry, listing_id)
        stats[result] += 1
    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if raw_dump:
        snapshot.save(key, date_str, raw_dump)
    logger.info(f"{key} done: {dict(stats)}")
    return stats


def main():
    ap = argparse.ArgumentParser(description="Bilinç ministry facts pipeline")
    ap.add_argument("--source", default="all", choices=["all", *SOURCES.keys()])
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--since", default=None, help="YYYY-MM-DD")
    args = ap.parse_args()

    keys = list(SOURCES.keys()) if args.source == "all" else [args.source]
    total = Counter()
    for k in keys:
        try:
            total.update(run_source(k, args.write, args.since))
        except Exception as e:
            logger.error(f"{k} aborted: {e}")
    logger.info(f"TOTAL: {dict(total)}")
    if not args.write:
        logger.info("Dry run. Re-run with --write to create listings + inject facts.")


if __name__ == "__main__":
    main()
