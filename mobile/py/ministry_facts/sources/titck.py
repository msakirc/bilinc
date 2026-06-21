"""TİTCK güvensiz ürün dinamikmodul HTML tables (113 kozmetik, 122 biyosidal, 124 cihaz)."""
import logging
from collections.abc import Iterator

import requests
from bs4 import BeautifulSoup

from ministry_facts.sources.base import Source
from ministry_facts.core.models import MinistryEntry

logger = logging.getLogger("ministry.titck")
BASE = "https://www.titck.gov.tr"

MODULES = {
    "titck:113": "/dinamikmodul/113",   # kozmetik
    "titck:122": "/dinamikmodul/122",   # biyosidal
    "titck:124": "/dinamikmodul/124",   # tıbbi cihaz
}

# Order matters: more specific firm-keys ("ürün sahibi") must precede the
# generic "ürün" so a header like "Firma/Ürün Sahibi Adı" maps to firma.
_HEADER_MAP = {
    "firma": "firma", "ürün sahibi": "firma", "ürün sahibi adı": "firma",
    "unvan": "firma", "ithalatçı": "firma",
    "ürün": "urun", "ürün tanımı": "urun", "ürün adı": "urun",
    "lot": "batch", "seri": "batch", "barkod": "batch",
    "gerekçe": "violation", "güvensizlik": "violation",
    "neden": "violation", "yaptırım": "violation",
    "tarih": "date",
}


def _classify_headers(header_cells: list[str]) -> dict[int, str]:
    mapping = {}
    for idx, h in enumerate(header_cells):
        hl = h.strip().lower()
        for kw, field in _HEADER_MAP.items():
            if kw in hl:
                mapping[idx] = field
                break
    return mapping


def parse_table(html: str, source: str) -> Iterator[MinistryEntry]:
    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table")
    if not table:
        return

    # Headers: prefer <thead>, fall back to the first row.
    thead = table.find("thead")
    if thead and thead.find("tr"):
        header_row = thead.find("tr")
        header_cells = header_row.find_all(["th", "td"])
    else:
        rows = table.find_all("tr")
        if not rows:
            return
        header_row = rows[0]
        header_cells = header_row.find_all(["th", "td"])

    headers = [c.get_text(" ", strip=True) for c in header_cells]
    colmap = _classify_headers(headers)

    # Data rows: prefer <tbody>, else every <tr> after the header row.
    tbody = table.find("tbody")
    if tbody:
        data_rows = tbody.find_all("tr")
    else:
        data_rows = [tr for tr in table.find_all("tr") if tr is not header_row]

    src_url = f"{BASE}{MODULES.get(source, '')}"

    for tr in data_rows:
        cells = [c.get_text(" ", strip=True) for c in tr.find_all("td")]
        if not cells:
            continue
        fields = {colmap[i]: cells[i] for i in range(len(cells)) if i in colmap}
        firma = fields.get("firma", "")
        if not firma:
            continue
        yield MinistryEntry(
            source=source, firma=firma, marka=None,
            urun=fields.get("urun") or None,
            violation=fields.get("violation") or "Güvensiz ürün",
            category_hint=source, province=None, district=None,
            batch=fields.get("batch") or None,
            announced_at=_to_iso(fields.get("date")),
            source_url=src_url,
            raw=dict(zip(headers, cells)),
        )


def _to_iso(d: str | None) -> str | None:
    if not d:
        return None
    parts = d.strip().replace("/", ".").split(".")
    if len(parts) == 3 and len(parts[2]) == 4:  # DD.MM.YYYY
        return f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
    return None


class TitckSource(Source):
    name = "titck"

    def fetch(self, since: str | None = None) -> Iterator[MinistryEntry]:
        for source, path in MODULES.items():
            try:
                resp = requests.get(
                    f"{BASE}{path}",
                    headers={"User-Agent": "Mozilla/5.0"},
                    timeout=60,
                )
                resp.raise_for_status()
            except Exception as e:
                logger.error(f"{source} fetch failed: {e}")
                continue
            for entry in parse_table(resp.text, source):
                if since and entry.announced_at and entry.announced_at[:10] < since:
                    continue
                yield entry
