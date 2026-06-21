"""Match a ministry entry to an existing catalog listing (DynamoDB via Turso FTS)."""
import logging
from ministry_facts.core.models import normalize_name

logger = logging.getLogger("ministry.matcher")

_MIN_LEN = 3  # don't match on ultra-short normalized keys (false-positive risk)


class CatalogMatcher:
    def __init__(self, fetch_candidates):
        """fetch_candidates(name) -> list[{id, name, entity_type}]."""
        self.fetch = fetch_candidates

    def match(self, entry) -> str | None:
        """Return an existing listing id on a confident exact-normalized match, else None."""
        targets = []
        if entry.marka:
            targets.append((entry.marka, ("brand", "product")))
        if entry.firma:
            targets.append((entry.firma, ("business", "brand")))
        for name, prefs in targets:
            want = normalize_name(name)
            if len(want) < _MIN_LEN:
                continue
            try:
                cands = self.fetch(name) or []
            except Exception as e:
                logger.warning(f"match fetch failed for {name!r}: {e}")
                continue
            exact = [c for c in cands if normalize_name(c.get("name")) == want]
            if not exact:
                continue
            for t in prefs:
                for c in exact:
                    if c.get("entity_type") == t:
                        return c.get("id")
            return exact[0].get("id")
        return None
