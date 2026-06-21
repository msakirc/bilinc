"""Normalized cross-source entry + idempotency keys."""
import re
import hashlib
from dataclasses import dataclass, field
from ministry_facts.core.slugify import slugify

# Company-form noise stripped when deriving a stable firm key for source_id/matching.
_SUFFIXES = re.compile(
    r'\b(san|tic|ltd|sti|şti|a\.?ş|aş|ve|inc|paz|ith|ihr|koll|kom)\b\.?',
    re.IGNORECASE)


def normalize_name(name: str | None) -> str:
    """Normalized comparison key: company-form words stripped, TR-folded slug."""
    return slugify(_SUFFIXES.sub(' ', name or ''))


@dataclass
class MinistryEntry:
    source: str
    firma: str
    marka: str | None
    urun: str | None
    violation: str
    category_hint: str
    province: str | None
    district: str | None
    batch: str | None
    announced_at: str | None
    source_url: str
    raw: dict = field(default_factory=dict)

    def firm_key(self) -> str:
        """Stable slug of brand-or-firm with company-form words removed."""
        return normalize_name(self.marka or self.firma or "")

    def external_key(self) -> str:
        """Per-entry idempotency key for fact_sources."""
        if self.source == "gubis":
            return str(self.raw.get("BildirimNo", "")) or self._hash()
        if self.source == "eu_safety_gate":
            return str(self.raw.get("alert_id", "")) or self._hash()
        return self._hash()

    def _hash(self) -> str:
        parts = "|".join([
            self.firma or "", self.marka or "", self.urun or "",
            self.batch or "", self.announced_at or "",
        ])
        return hashlib.sha1(parts.encode("utf-8")).hexdigest()
