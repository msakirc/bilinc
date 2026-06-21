"""Store clients + low-level writers for Supabase, DynamoDB, Turso.

Reuses proven helpers from the migration scripts by importing them. Those live
as top-level scripts in mobile/py, so we load them by file path.
"""
import os
import importlib.util
from pathlib import Path

import requests

PY_DIR = Path(__file__).resolve().parents[2]  # mobile/py


def _load_module(name: str, filename: str):
    spec = importlib.util.spec_from_file_location(name, PY_DIR / filename)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# Lazily import build_dynamo_item from the migration script (pure function).
# Note: migrate-to-dynamodb.py runs load_dotenv() + reads SUPABASE_URL /
# SUPABASE_SERVICE_KEY from env *at module top level*, so loading it eagerly
# would make merely importing stores.py raise KeyError when those vars are
# absent (e.g. mocked unit tests / CI). Defer the load until first use.
_dynamo_mod = None


def _get_build_dynamo_item():
    global _dynamo_mod
    if _dynamo_mod is None:
        _dynamo_mod = _load_module("_mtd", "migrate-to-dynamodb.py")
    return _dynamo_mod.build_dynamo_item


def build_dynamo_item(*args, **kwargs):
    """Lazy proxy to migrate-to-dynamodb.build_dynamo_item (avoids import-time env access)."""
    return _get_build_dynamo_item()(*args, **kwargs)


def get_supabase():
    from supabase import create_client
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])


def get_dynamo_table():
    import boto3
    region = os.environ.get("AWS_REGION", "eu-central-1")
    table = os.environ.get("DYNAMODB_TABLE", "bilinc-catalog")
    return boto3.resource("dynamodb", region_name=region).Table(table)


def turso_execute(statements: list[dict]):
    """Execute Turso/libSQL HTTP statements. statements: [{sql, args}].

    Exact request shape copied from migrate-to-turso.py: TURSO_URL is used
    as-is (already https://), args are passed raw (no libsql type tagging),
    and no {"type": "close"} request is appended.
    """
    url = os.environ["TURSO_URL"]
    token = os.environ["TURSO_AUTH_TOKEN"]
    resp = requests.post(
        f"{url}/v2/pipeline",
        headers={
            "Authorization": f"Bearer {token}",
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
    return resp.json()


def write_dynamo_listing(table, listing: dict, category_slug: str | None):
    """Build + put a catalog item for a created listing."""
    # build_dynamo_item reads each category via lc.get("categories") and a
    # nested dict slug, so the slug must live under "categories": {"slug": ...}
    # for primary_cat / GSI1 keys to be set.
    cats = (
        [{"categories": {"slug": category_slug}, "is_primary": True}]
        if category_slug
        else []
    )
    item = build_dynamo_item(listing, None, [], [], cats)
    table.put_item(Item=item)


import re as _re


def _clean_fts_query(raw: str) -> str:
    """Strip FTS5 syntax chars (mirror lambda/search-proxy cleanQuery)."""
    s = _re.sub(r'["\'()*:^\-]', ' ', raw or '')
    s = _re.sub(r'\s+', ' ', s).strip()
    return s[:100]


def _parse_pipeline_rows(result: dict) -> list[dict]:
    """Parse the first execute result of a Turso v2/pipeline response into dicts.
    Row cells are typed objects {"type":..,"value":..}; cols give names."""
    out = []
    results = result.get("results", [])
    if not results:
        return out
    r0 = results[0]
    resp = r0.get("response") or {}
    res = resp.get("result") or {}
    cols = [c.get("name") for c in res.get("cols", [])]
    for row in res.get("rows", []):
        rec = {}
        for col, cell in zip(cols, row):
            if isinstance(cell, dict):
                rec[col] = None if cell.get("type") == "null" else cell.get("value")
            else:
                rec[col] = cell
        out.append(rec)
    return out


def turso_search_candidates(name: str, limit: int = 20) -> list[dict]:
    """FTS-search the catalog by name; return [{id, name, entity_type}] candidates.
    Matched ids are the real DynamoDB L#<id> listing ids."""
    q = _clean_fts_query(name)
    if not q:
        return []
    result = turso_execute([{
        "sql": ("SELECT s.id, s.name, s.entity_type "
                "FROM search_idx(?) idx JOIN listings_search s ON s.rowid = idx.rowid "
                "LIMIT ?"),
        "args": [q, limit],
    }])
    return _parse_pipeline_rows(result)


def write_turso_listing(listing: dict, category_slug: str | None):
    turso_execute([{
        "sql": ("INSERT OR REPLACE INTO listings_search "
                "(id, name, entity_type, city_code, category_slug, "
                "rating, total_reviews, latitude, longitude) "
                "VALUES (?, ?, ?, ?, ?, 0, 0, NULL, NULL)"),
        "args": [listing["id"], listing["name"], listing["entity_type"],
                 listing.get("city_code"), category_slug],
    }])
