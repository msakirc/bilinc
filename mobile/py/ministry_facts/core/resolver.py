"""Match-or-create a listing across Supabase + DynamoDB + Turso."""
import uuid
import logging

from ministry_facts.core.slugify import listing_slug
from ministry_facts.core.cities import province_to_code
from ministry_facts.core import stores

logger = logging.getLogger("ministry.resolver")

_PREFIX = {"tarim:liste1": "tarim", "tarim:liste2": "tarim", "tarim:saglik": "tarim",
           "gubis": "gubis", "titck:113": "titck", "titck:122": "titck",
           "titck:124": "titck", "eu_safety_gate": "sg"}


class Resolver:
    def __init__(self, supabase, dynamo_table, write: bool, matcher=None):
        self.sb = supabase
        self.dynamo = dynamo_table
        self.write = write
        self.matcher = matcher
        self.last_outcome = None
        self._turso = stores.write_turso_listing  # injectable for tests
        self._dynamo_write = stores.write_dynamo_listing  # injectable for tests

    def _source_id(self, entry) -> str:
        return f"{_PREFIX.get(entry.source, 'min')}:{entry.firm_key()}"

    def resolve(self, entry) -> str | None:
        sid = self._source_id(entry)
        found = self.sb.table("listings").select("id").eq("source_id", sid).execute()
        if found.data:
            self.last_outcome = "existing"
            return found.data[0]["id"]

        # Try to attach to an existing catalog listing before creating a new one.
        if self.matcher is not None:
            mid = self.matcher.match(entry)
            if mid:
                self.last_outcome = "matched"
                return mid

        if not self.write:
            logger.info(f"[dry] would create listing {sid}")
            self.last_outcome = "would_create"
            return None

        lid = str(uuid.uuid4())
        entity_type = "brand" if entry.marka else "product"
        name = (entry.marka or entry.firma)[:255]
        listing = {
            "id": lid,
            "name": name,
            "slug": listing_slug(name, lid),
            "entity_type": entity_type,
            "status": "active",
            "source": f"ministry:{entry.source}",
            "source_id": sid,
            "city_code": province_to_code(entry.province),
            "description": entry.firma,
        }
        ins = self.sb.table("listings").upsert(listing, on_conflict="source_id").execute()
        lid = ins.data[0]["id"]
        listing["id"] = lid

        category_slug = None  # v1: created listings are search-only by name
        try:
            self._dynamo_write(self.dynamo, listing, category_slug)
        except Exception as e:
            logger.error(f"Dynamo write failed for {sid}: {e}")
        try:
            self._turso(listing, category_slug)
        except Exception as e:
            logger.error(f"Turso write failed for {sid}: {e}")
        self.last_outcome = "created"
        return lid
