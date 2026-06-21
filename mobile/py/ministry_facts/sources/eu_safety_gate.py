"""EU Safety Gate (RAPEX) alerts, filtered to Türkiye-origin products."""
import os
import json
import time
import logging
from pathlib import Path
from collections.abc import Iterator

import requests
from ministry_facts.sources.base import Source
from ministry_facts.core.models import MinistryEntry

logger = logging.getLogger("ministry.eu")
API = os.environ.get("SAFETYGATE_API",
                     "https://ec.europa.eu/safety-gate-alerts/public/api/notifications/")
RAW_FILE = Path(__file__).resolve().parents[1] / "ministry_facts_data" / "safetygate-raw.json"


def _first(d: dict, *keys, default=""):
    for k in keys:
        if d.get(k):
            return d[k]
    return default


def _is_turkey(text: str) -> bool:
    t = (text or "").strip().lower()
    if t == "tr":  # ISO 3166 alpha-2 code, exact
        return True
    return any(k in t for k in ("türkiye", "turkiye", "turkey"))


def normalize_to_entry(raw: dict, turkey_only: bool = True) -> MinistryEntry | None:
    products = raw.get("products") or raw.get("product") or []
    if isinstance(products, dict):
        products = [products]
    p = products[0] if products else raw
    name = _first(p, "name", "productName", "product_name")
    brand = _first(p, "brand", "brandName", "brand_name")
    if not name and not brand:
        return None
    origin = _first(p, "originCountry", "origin", "countryOfOrigin") or \
        _first(raw, "originCountry", "country")
    if turkey_only and origin and not _is_turkey(origin):
        return None
    risks = raw.get("risks") or raw.get("risk") or []
    if isinstance(risks, dict):
        risks = [risks]
    risk = _first(risks[0], "type", "riskType", "category", "name") if risks else ""
    risk_desc = _first(raw, "riskDescription", "risk_description") or \
        (_first(risks[0], "description") if risks else "") or risk or "Tehlikeli ürün"
    alert_id = str(_first(raw, "id", "alertNumber", "reference", "caseNumber"))
    pub = _first(raw, "publicationDate", "alertDate", "date")
    return MinistryEntry(
        source="eu_safety_gate", firma=(brand or name).strip(),
        marka=(brand or None), urun=(name or None),
        violation=str(risk_desc)[:900], category_hint=str(risk),
        province=None, district=None, batch=None,
        announced_at=(str(pub)[:10] or None),
        source_url="https://ec.europa.eu/safety-gate-alerts",
        raw={"alert_id": alert_id, "origin": origin},
    )


def _load_raw(pages: int) -> list[dict]:
    if RAW_FILE.exists():
        logger.info(f"Using local {RAW_FILE.name}")
        data = json.loads(RAW_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else data.get("content", [])
    out = []
    for page in range(pages):
        try:
            resp = requests.get(API, params={"page": page, "size": 100},
                                headers={"Accept": "application/json"}, timeout=60)
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            logger.warning(f"API page {page} failed: {e}")
            break
        items = data.get("content") or data.get("notifications") or \
            (data if isinstance(data, list) else [])
        if not items:
            break
        out.extend(items)
        time.sleep(0.5)
    return out


class EuSafetyGateSource(Source):
    name = "eu"

    def __init__(self, pages: int = 20):
        self.pages = pages

    def fetch(self, since: str | None = None) -> Iterator[MinistryEntry]:
        seen = set()
        for raw in _load_raw(self.pages):
            e = normalize_to_entry(raw if isinstance(raw, dict) else {})
            if not e:
                continue
            aid = e.raw.get("alert_id")
            if aid in seen:
                continue
            seen.add(aid)
            if since and e.announced_at and e.announced_at[:10] < since:
                continue
            yield e
