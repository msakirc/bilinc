"""Idempotent fact insertion: facts + fact_sources."""
import logging
from ministry_facts.core.statement import build_statement
from ministry_facts.core.category import map_category

logger = logging.getLogger("ministry.injector")


class Injector:
    def __init__(self, supabase, system_user_id: str, write: bool,
                 listing_name: str | None = None, listing_slug_val: str | None = None):
        self.sb = supabase
        self.sys = system_user_id
        self.write = write
        self.listing_name = listing_name
        self.listing_slug = listing_slug_val

    def inject(self, entry, listing_id: str) -> str:
        ext = entry.external_key()
        dup = (self.sb.table("fact_sources").select("id")
               .eq("source", entry.source).eq("external_key", ext).execute())
        if dup.data:
            return "skipped"
        if not self.write:
            return "dry"

        fact = {
            "listing_id": listing_id,
            "user_id": self.sys,
            "statement": build_statement(entry),
            "category": map_category(entry),
            "verification_status": "verified",
            "truth_guarantee": True,
            "is_flagged": False,
            "listing_name": self.listing_name,
            "listing_slug": self.listing_slug,
        }
        res = self.sb.table("facts").insert(fact).execute()
        fact_id = res.data[0]["id"]
        try:
            self.sb.table("fact_sources").insert({
                "fact_id": fact_id, "source": entry.source, "external_key": ext,
                "source_url": entry.source_url, "raw_json": entry.raw,
            }).execute()
        except Exception:
            # Compensate: avoid an orphan fact with no idempotency record
            # (which would be re-inserted on the next run).
            try:
                self.sb.table("facts").delete().eq("id", fact_id).execute()
            except Exception:
                logger.error(f"Orphaned fact {fact_id} (fact_sources insert failed, "
                             f"cleanup also failed) for {entry.source}:{ext}")
            raise
        return "inserted"
