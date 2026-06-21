"""GÜBİS — Ticaret Bakanlığı güvensiz ürün detail pages (rid enumeration).

Each detail page (https://guvensizurun.ticaret.gov.tr/Bildirim/Detay?rid=N) is
server-rendered static HTML. Fields are laid out as W3.CSS cell-rows::

    <div class="w3-cell-row">
        <div class="w3-container w3-cell ..." style="font-weight: bold;"><p>LABEL</p></div>
        <div class="w3-container w3-cell"><p>VALUE</p></div>
    </div>

parse_detail pairs the two cells of each row (first = label, second = value),
normalizes the label, and maps it onto a MinistryEntry field.
"""
import re
import time
import logging
from collections.abc import Iterator

import requests
from bs4 import BeautifulSoup

from ministry_facts.sources.base import Source
from ministry_facts.core.models import MinistryEntry

logger = logging.getLogger("ministry.gubis")
BASE = "https://guvensizurun.ticaret.gov.tr"

# Keys are label text after _norm_label() (uppercase, ASCII-folded, no
# punctuation, single-spaced). The real page uses "MODEL / SERİ NO / PARTİ NO".
_LABELS = {
    "BILDIRIM NO": "BildirimNo",
    "BILDIRIM TARIHI": "date",
    "FIRMA": "firma",
    "MARKA": "marka",
    "URUN TANIMI": "urun",
    "URUN GRUBU": "urun_grubu",
    "GUVENSIZLIK NEDENI": "violation",
    "ALINAN ONLEM": "onlem",
    "MENSE ULKE": "mense",
    "MODEL SERI NO PARTI NO": "model",
    "MODEL": "model",
    "TASIDIGI RISKLER": "risk",
}


def _norm_label(s: str) -> str:
    s = (s.upper()
         .replace("İ", "I").replace("Ş", "S").replace("Ç", "C")
         .replace("Ö", "O").replace("Ü", "U").replace("Ğ", "G"))
    # Drop punctuation (slashes, colons, etc.), collapse whitespace.
    s = re.sub(r"[^A-Z0-9 ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def parse_detail(html: str, rid: str) -> MinistryEntry | None:
    soup = BeautifulSoup(html, "html.parser")
    fields: dict[str, str] = {}

    for row in soup.select("div.w3-cell-row"):
        cells = row.find_all("div", class_="w3-cell")
        if len(cells) < 2:
            continue
        key = _norm_label(cells[0].get_text(" ", strip=True))
        field = _LABELS.get(key)
        if not field:
            continue
        value = cells[1].get_text(" ", strip=True)
        if value:
            fields[field] = value

    if not fields.get("firma") and not fields.get("BildirimNo"):
        return None

    violation = fields.get("violation", "Güvensiz ürün")
    if fields.get("onlem"):
        violation = f"{violation} (Alınan önlem: {fields['onlem']})"

    bildirim_no = fields.get("BildirimNo") or rid
    return MinistryEntry(
        source="gubis",
        firma=fields.get("firma", ""),
        marka=fields.get("marka") or None,
        urun=fields.get("urun") or None,
        violation=violation,
        category_hint=fields.get("urun_grubu", ""),
        province=None,
        district=None,
        batch=fields.get("model") or None,
        announced_at=_to_iso(fields.get("date")),
        source_url=f"{BASE}/Bildirim/Detay?rid={rid}",
        raw={**fields, "BildirimNo": bildirim_no, "rid": rid},
    )


def _to_iso(d: str | None) -> str | None:
    if not d:
        return None
    parts = d.strip().replace("/", ".").split(".")
    if len(parts) == 3 and len(parts[2]) == 4:  # DD.MM.YYYY
        return f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
    return None


class GubisSource(Source):
    name = "gubis"

    def __init__(self, start_rid: int = 1, max_rid: int = 25000, max_misses: int = 200):
        self.start_rid = start_rid
        self.max_rid = max_rid
        self.max_misses = max_misses

    def fetch(self, since: str | None = None) -> Iterator[MinistryEntry]:
        sess = requests.Session()
        sess.headers.update({"User-Agent": "Mozilla/5.0"})
        misses = 0
        for rid in range(self.start_rid, self.max_rid):
            try:
                resp = sess.get(f"{BASE}/Bildirim/Detay?rid={rid}", timeout=30)
            except Exception as e:
                logger.warning(f"rid {rid} error: {e}")
                continue
            if resp.status_code != 200:
                misses += 1
            else:
                entry = parse_detail(resp.text, str(rid))
                if entry is None:
                    misses += 1
                else:
                    misses = 0
                    if not (since and entry.announced_at and entry.announced_at[:10] < since):
                        yield entry
            if misses >= self.max_misses:
                logger.info(f"Stopping: {misses} consecutive empty rids at {rid}")
                break
            time.sleep(1)  # gentle on gov servers
