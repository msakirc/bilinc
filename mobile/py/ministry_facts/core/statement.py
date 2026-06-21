"""MinistryEntry -> Turkish attributed fact statement (<=1000 chars)."""
from ministry_facts.core.models import MinistryEntry

_SOURCE_LABEL = {
    "tarim:liste1": "T.C. Tarım ve Orman Bakanlığı",
    "tarim:liste2": "T.C. Tarım ve Orman Bakanlığı",
    "tarim:saglik": "T.C. Tarım ve Orman Bakanlığı",
    "gubis": "T.C. Ticaret Bakanlığı",
    "titck:113": "TİTCK (Sağlık Bakanlığı)",
    "titck:122": "TİTCK (Sağlık Bakanlığı)",
    "titck:124": "TİTCK (Sağlık Bakanlığı)",
    "eu_safety_gate": "EU Safety Gate",
}


def _fmt_date(iso: str | None) -> str:
    if not iso:
        return "tarih belirtilmemiş"
    parts = iso[:10].split("-")
    if len(parts) == 3:
        return f"{parts[2]}.{parts[1]}.{parts[0]}"
    return iso


def build_statement(entry: MinistryEntry) -> str:
    subject = entry.marka or entry.firma or "Bilinmeyen firma"
    product = entry.urun or "ürün"
    label = _SOURCE_LABEL.get(entry.source, "Resmi kaynak")
    date = _fmt_date(entry.announced_at)
    s = f"{subject} — {product}: {entry.violation}. (Kaynak: {label}, {date})"
    return s[:1000]
