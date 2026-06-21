"""Tarım ve Orman Bakanlığı — guvenilirgida GKD lists (3 sub-lists)."""
import re
import time
import logging
from datetime import datetime, timezone
from collections.abc import Iterator

import requests
from ministry_facts.sources.base import Source
from ministry_facts.core.models import MinistryEntry

logger = logging.getLogger("ministry.tarim")
BASE = "https://guvenilirgida.tarimorman.gov.tr"
DATATABLES = f"{BASE}/GuvenilirGida/GKD/DataTablesList"

LISTS = {
    "tarim:liste1": {"page": "/GuvenilirGida/gkd/TaklitVeyaTagsisListe1?siteYayinDurumu=True",
                     "params": {"KamuoyuDuyuruAra[ListeTurId]": "304", "KamuoyuDuyuruAra[HaricTut]": ""}},
    "tarim:liste2": {"page": "/GuvenilirGida/gkd/TaklitVeyaTagsisListe2?siteYayinDurumu=True",
                     "params": {"KamuoyuDuyuruAra[HaricTut]": "304", "KamuoyuDuyuruAra[ListeTurId]": ""}},
    "tarim:saglik": {"page": "/GuvenilirGida/gkd/SagligiTehlikeyeDusurecek?siteYayinDurumu=True",
                     "params": {"KamuoyuDuyuruAra[HaricTut]": "", "KamuoyuDuyuruAra[ListeTurId]": ""}},
}
COLUMNS = ["DuyuruTarihi", "FirmaAdi", "Marka", "UrunAdi", "Uygunsuzluk",
           "PartiSeriNo", "FirmaIlce", "FirmaIl", "UrunGrupAdi"]


def _parse_date(s: str) -> str | None:
    m = re.search(r"/Date\((\d+)\)/", s or "")
    if m:
        return datetime.fromtimestamp(int(m.group(1)) / 1000, tz=timezone.utc).isoformat()
    return None


def _clean(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"</?br\s*/?>", ", ", text)
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r",\s*$", "", text.strip()).strip()


def record_to_entry(rec: dict, source: str) -> MinistryEntry:
    return MinistryEntry(
        source=source,
        firma=(rec.get("FirmaAdi") or "").strip(),
        marka=(rec.get("Marka") or "").strip() or None,
        urun=(rec.get("UrunAdi") or "").strip() or None,
        violation=_clean(rec.get("Uygunsuzluk", "")),
        category_hint=(rec.get("UrunGrupAdi") or "").strip(),
        province=(rec.get("FirmaIl") or "").strip() or None,
        district=(rec.get("FirmaIlce") or "").strip() or None,
        batch=(rec.get("PartiSeriNo") or "").strip() or None,
        announced_at=_parse_date(rec.get("DuyuruTarihi", "")),
        source_url=f"{BASE}{LISTS[source]['page']}",
        raw=rec,
    )


class TarimSource(Source):
    name = "tarim"

    def fetch(self, since: str | None = None) -> Iterator[MinistryEntry]:
        for source in LISTS:
            yield from self._fetch_list(source, since)

    def _fetch_list(self, source: str, since: str | None) -> Iterator[MinistryEntry]:
        cfg = LISTS[source]
        sess = requests.Session()
        sess.headers.update({"User-Agent": "Mozilla/5.0"})
        sess.get(f"{BASE}{cfg['page']}", timeout=30)
        start, draw, page_size = 0, 1, 100
        while True:
            params = {"draw": str(draw), "start": str(start), "length": str(page_size),
                      "search[value]": "", "search[regex]": "false",
                      "SiteYayinDurumu": "True", "order[0][column]": "0", "order[0][dir]": "desc"}
            params.update(cfg["params"])
            for i, col in enumerate(COLUMNS):
                params[f"columns[{i}][data]"] = col
                params[f"columns[{i}][name]"] = col
            resp = sess.post(DATATABLES, data=params,
                             headers={"X-Requested-With": "XMLHttpRequest"}, timeout=30)
            resp.raise_for_status()
            data = resp.json()
            records = data.get("data", [])
            total = data.get("recordsTotal", 0)
            if not records:
                break
            for rec in records:
                e = record_to_entry(rec, source)
                if not (e.firma or e.marka):
                    continue
                if since and e.announced_at and e.announced_at[:10] < since:
                    return
                yield e
            start += page_size
            if start >= total:
                break
            time.sleep(3)  # gentle on gov servers
