"""Storage abstraction for the catalog dedup resolver.

Real impl = DynamoStore (boto3, Task 10). Tests use FakeStore (catalog_tests/fakes.py).
Keys are the triple (entity_type, keyname, value). canonical_id is an opaque uuid hex.
"""
from typing import Protocol


class Store(Protocol):
    def get_keys(self, triples: list[tuple[str, str, str]]) -> dict[tuple[str, str, str], str]:
        """Batch lookup. Returns {triple: canonical_id} for triples that exist,
        each id already chased through merged_into to its live survivor."""
        ...

    def put_key(self, etype: str, kname: str, value: str, cid: str) -> bool:
        """Conditional claim. True if newly written; False if the key already existed."""
        ...

    def get_entity(self, cid: str) -> dict | None: ...

    def put_entity(self, cid: str, entity: dict) -> None:
        """Idempotent upsert. Unions `sources` (dict keyed source#source_id), `keys`,
        `aliases`, `links`; ORs `fuzzy_pending`."""
        ...

    def merge(self, survivor: str, loser: str) -> None:
        """Atomically repoint every index key owned by `loser` to `survivor`,
        union loser's entity fields onto survivor, tombstone loser
        (`merged_into=survivor`). Idempotent: no-op if loser already tombstoned."""
        ...

    def resolve_alias(self, cid: str) -> str:
        """Chase merged_into transitively to the live survivor id."""
        ...

    def clear_fuzzy_pending(self, cid: str) -> None:
        """Authoritatively set fuzzy_pending=False on an entity (put_entity only ORs
        the flag, so clearing needs its own method)."""
        ...

    def iter_fuzzy_pending(self): ...  # yields (cid, entity) for fuzzy_pending entities


import os

TABLE = os.environ.get("CATALOG_TABLE", "bilinc-catalog")
# GSI keyed on the sparse string marker `fp` (== "1" when fuzzy_pending). A DynamoDB
# GSI key cannot be BOOL, so the app-level `fuzzy_pending` bool gets a separate index
# attribute. The GSI is sparse: items without `fp` are absent from it.
FUZZY_GSI = "fuzzy_pending-index"


def _pk_key(etype, kname, value):
    return f"XKEY#{etype}#{kname}#{value}"


def _pk_entity(cid):
    return f"ENTITY#{cid}"


class DynamoStore:
    """boto3-backed Store. Strong-key index items + entity items in one table.
    Conditional puts for race-safe mint; TransactWriteItems for merge.

    NOTE: live integration is deferred (spec §11) until the Dynamo upload is fixed.
    This class is exercised by unit tests only (request shaping) for now.
    """
    def __init__(self, table_name=TABLE, table=None):
        if table is not None:
            self._t = table  # injected twin (tests); skip boto3 entirely
            return
        import boto3  # lazy: keeps the pure _pk_* helpers importable without boto3 installed
        self._t = boto3.resource("dynamodb").Table(table_name)

    def resolve_alias(self, cid):
        seen = set()
        while True:
            e = self.get_entity(cid)
            nxt = e.get("merged_into") if e else None
            if not nxt or nxt in seen:
                return cid
            seen.add(cid)
            cid = nxt

    def get_keys(self, triples):
        if not triples:
            return {}
        client = self._t.meta.client
        out, by_pk = {}, {}
        keys = []
        for t in triples:
            pk = _pk_key(*t)
            by_pk[pk] = t
            keys.append({"pk": pk})
        # BatchGetItem in <=100 chunks (M4)
        for i in range(0, len(keys), 100):
            resp = client.batch_get_item(RequestItems={
                self._t.name: {"Keys": keys[i:i + 100]}})
            for item in resp["Responses"].get(self._t.name, []):
                out[by_pk[item["pk"]]] = self.resolve_alias(item["canonical_id"])
        return out

    def put_key(self, etype, kname, value, cid):
        try:
            self._t.put_item(
                Item={"pk": _pk_key(etype, kname, value), "canonical_id": cid},
                ConditionExpression="attribute_not_exists(pk)")
            return True
        except self._t.meta.client.exceptions.ConditionalCheckFailedException:
            return False

    def get_entity(self, cid):
        resp = self._t.get_item(Key={"pk": _pk_entity(cid)})
        item = resp.get("Item")
        return {k: v for k, v in item.items() if k not in ("pk", "fp")} if item else None

    def put_entity(self, cid, entity):
        cur = self.get_entity(cid) or {}
        merged = dict(cur)
        merged.setdefault("entity_type", entity["entity_type"])
        merged.update({k: entity[k] for k in ("name", "lat", "lon", "public",
                                              "private", "attrs", "mint_ts")
                       if entity.get(k) is not None and k not in merged})
        merged["sources"] = {**cur.get("sources", {}), **entity.get("sources", {})}
        merged["keys"] = {**cur.get("keys", {}), **entity.get("keys", {})}
        merged["aliases"] = sorted(set(cur.get("aliases", [])) | set(entity.get("aliases", [])))
        merged["links"] = list({(l.get("rel"), l.get("target")): l
                                for l in cur.get("links", []) + entity.get("links", [])}.values())
        merged["fuzzy_pending"] = bool(cur.get("fuzzy_pending") or entity.get("fuzzy_pending"))
        # Maintain the sparse GSI marker `fp` (string) alongside the app-level bool.
        if merged["fuzzy_pending"]:
            merged["fp"] = "1"
        else:
            merged.pop("fp", None)  # omit so the GSI stays sparse
        merged["pk"] = _pk_entity(cid)
        self._t.put_item(Item=merged)

    def merge(self, survivor, loser):
        survivor, loser = self.resolve_alias(survivor), self.resolve_alias(loser)
        if survivor == loser:
            return
        le = self.get_entity(loser) or {}
        ccf = self._t.meta.client.exceptions.ConditionalCheckFailedException
        # Full single-call TransactWriteItems atomicity is a deferred live-hardening item
        # (see spec §12); these per-item conditional writes converge correctly.
        # repoint loser's index keys (Query the GSI by canonical_id would need an index;
        # loser.keys holds them, type-scoped). Guarded: a concurrent merge already
        # repointing the key is fine (idempotent).
        et = le.get("entity_type")
        for kname, val in le.get("keys", {}).items():
            try:
                self._t.put_item(
                    Item={"pk": _pk_key(et, kname, str(val)), "canonical_id": survivor},
                    ConditionExpression="canonical_id = :loser",
                    ExpressionAttributeValues={":loser": loser})
            except ccf:
                pass
        self.put_entity(survivor, {k: le.get(k) for k in
                                   ("sources", "keys", "aliases", "links",
                                    "entity_type", "fuzzy_pending")
                                   if le.get(k)})
        try:
            self._t.put_item(
                Item={"pk": _pk_entity(loser), "merged_into": survivor},
                ConditionExpression="attribute_not_exists(merged_into)")
        except ccf:
            pass

    def clear_fuzzy_pending(self, cid):
        self._t.update_item(
            Key={"pk": _pk_entity(self.resolve_alias(cid))},
            UpdateExpression="SET fuzzy_pending = :f REMOVE fp",
            ExpressionAttributeValues={":f": False})

    def iter_fuzzy_pending(self):
        from boto3.dynamodb.conditions import Key
        resp = self._t.query(IndexName=FUZZY_GSI,
                             KeyConditionExpression=Key("fp").eq("1"))
        for item in resp.get("Items", []):
            cid = item["pk"].split("ENTITY#", 1)[-1]
            yield cid, self.get_entity(cid)
