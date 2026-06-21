"""Request-shaping tests for DynamoStore without AWS.

Uses a hand-rolled in-memory FakeTable (no moto) that records/serves the exact
boto3 Table surface DynamoStore touches: put_item (with conditional expressions),
get_item, update_item (SET/REMOVE), query (GSI on `fp`), and a meta.client with
batch_get_item + ConditionalCheckFailedException. Injected via DynamoStore(table=...).
"""
import pytest

from catalog_store import DynamoStore, _pk_key, _pk_entity, FUZZY_GSI


class _ConditionalCheckFailedException(Exception):
    pass


class _FakeExceptions:
    ConditionalCheckFailedException = _ConditionalCheckFailedException


class _FakeClient:
    def __init__(self, table):
        self._table = table
        self.exceptions = _FakeExceptions()

    def batch_get_item(self, RequestItems):
        out = {}
        for tname, spec in RequestItems.items():
            hits = []
            for key in spec["Keys"]:
                item = self._table._items.get(key["pk"])
                if item is not None:
                    hits.append(dict(item))
            out[tname] = hits
        return {"Responses": out}


class _FakeMeta:
    def __init__(self, table):
        self.client = _FakeClient(table)


class FakeTable:
    """Minimal in-memory twin of a boto3 dynamodb Table."""

    def __init__(self, name="bilinc-catalog-test"):
        self.name = name
        self._items = {}  # pk -> item dict
        self.meta = _FakeMeta(self)

    # --- put_item with the conditional expressions DynamoStore uses ---
    def put_item(self, Item, ConditionExpression=None, ExpressionAttributeValues=None):
        pk = Item["pk"]
        cur = self._items.get(pk)
        if ConditionExpression == "attribute_not_exists(pk)":
            if cur is not None:
                raise _ConditionalCheckFailedException()
        elif ConditionExpression == "canonical_id = :loser":
            loser = ExpressionAttributeValues[":loser"]
            if cur is None or cur.get("canonical_id") != loser:
                raise _ConditionalCheckFailedException()
        elif ConditionExpression == "attribute_not_exists(merged_into)":
            if cur is not None and "merged_into" in cur:
                raise _ConditionalCheckFailedException()
        elif ConditionExpression is not None:
            raise AssertionError(f"unexpected ConditionExpression: {ConditionExpression}")
        self._items[pk] = dict(Item)

    def get_item(self, Key):
        item = self._items.get(Key["pk"])
        return {"Item": dict(item)} if item is not None else {}

    def update_item(self, Key, UpdateExpression, ExpressionAttributeValues):
        pk = Key["pk"]
        item = self._items.setdefault(pk, {"pk": pk})
        expr = UpdateExpression.strip()
        # Supports: "SET fuzzy_pending = :f REMOVE fp"
        set_part, _, remove_part = expr.partition("REMOVE")
        set_part = set_part.replace("SET", "", 1).strip()
        if set_part:
            for assign in set_part.split(","):
                field, _, val_ref = assign.partition("=")
                item[field.strip()] = ExpressionAttributeValues[val_ref.strip()]
        for field in remove_part.split(","):
            field = field.strip()
            if field:
                item.pop(field, None)

    def query(self, IndexName, KeyConditionExpression):
        # KeyConditionExpression is boto3 Key("fp").eq("1"); read its target value.
        # We only support the sparse fp == "1" GSI query.
        items = [dict(v) for v in self._items.values() if v.get("fp") == "1"]
        return {"Items": items}


def _store():
    return DynamoStore(table=FakeTable())


def _record_entity(name, fuzzy_pending=False, keys=None, sources=None):
    return {
        "entity_type": "product",
        "name": name,
        "keys": keys or {},
        "sources": sources or {},
        "fuzzy_pending": fuzzy_pending,
        "mint_ts": 1.0,
    }


def test_put_key_conditional_first_true_then_false():
    s = _store()
    assert s.put_key("product", "gtin", "111", "cid-a") is True
    assert s.put_key("product", "gtin", "111", "cid-b") is False  # duplicate -> conditional fail


def test_get_keys_batches_over_100_and_returns_all():
    s = _store()
    triples = []
    for i in range(150):
        et, kn, val = "product", "gtin", f"v{i}"
        s.put_key(et, kn, val, f"cid-{i}")
        triples.append((et, kn, val))
    got = s.get_keys(triples)
    assert len(got) == 150
    for i in range(150):
        assert got[("product", "gtin", f"v{i}")] == f"cid-{i}"


def test_put_entity_true_writes_fp_marker():
    table = FakeTable()
    s = DynamoStore(table=table)
    s.put_entity("c1", _record_entity("Foo", fuzzy_pending=True))
    item = table._items[_pk_entity("c1")]
    assert item["fp"] == "1"
    assert item["fuzzy_pending"] is True
    # get_entity never surfaces fp plumbing
    assert "fp" not in s.get_entity("c1")


def test_put_entity_false_has_no_fp_marker():
    table = FakeTable()
    s = DynamoStore(table=table)
    s.put_entity("c1", _record_entity("Foo", fuzzy_pending=False))
    item = table._items[_pk_entity("c1")]
    assert "fp" not in item
    assert item["fuzzy_pending"] is False
    assert "fp" not in s.get_entity("c1")


def test_clear_fuzzy_pending_removes_fp_and_sets_false():
    table = FakeTable()
    s = DynamoStore(table=table)
    s.put_entity("c1", _record_entity("Foo", fuzzy_pending=True))
    s.clear_fuzzy_pending("c1")
    item = table._items[_pk_entity("c1")]
    assert "fp" not in item
    assert item["fuzzy_pending"] is False


def test_iter_fuzzy_pending_is_sparse():
    s = _store()
    s.put_entity("pending", _record_entity("P", fuzzy_pending=True))
    s.put_entity("settled", _record_entity("S", fuzzy_pending=False))
    yielded = {cid for cid, _ in s.iter_fuzzy_pending()}
    assert yielded == {"pending"}
    # after clearing, it drops out
    s.clear_fuzzy_pending("pending")
    assert {cid for cid, _ in s.iter_fuzzy_pending()} == set()


def test_merge_repoints_tombstones_and_carries_pending():
    s = _store()
    # survivor with a key, loser with a key + fuzzy_pending
    s.put_key("product", "gtin", "S1", "surv")
    s.put_entity("surv", _record_entity("Survivor", keys={"gtin": "S1"},
                                        sources={"a#1": {"source": "a", "source_id": "1"}}))
    s.put_key("product", "gtin", "L1", "lose")
    s.put_entity("lose", _record_entity("Loser", fuzzy_pending=True, keys={"gtin": "L1"},
                                        sources={"b#2": {"source": "b", "source_id": "2"}}))

    s.merge("surv", "lose")

    # loser key now repointed to survivor
    assert s.get_keys([("product", "gtin", "L1")]) == {("product", "gtin", "L1"): "surv"}
    # loser tombstoned
    assert s.get_entity("lose").get("merged_into") == "surv"
    assert s.resolve_alias("lose") == "surv"
    # survivor inherited pending flag + loser source
    surv = s.get_entity("surv")
    assert surv["fuzzy_pending"] is True
    assert "b#2" in surv["sources"]

    # second merge of the same pair = idempotent no-op
    s.merge("surv", "lose")
    assert s.resolve_alias("lose") == "surv"
    assert s.get_keys([("product", "gtin", "L1")]) == {("product", "gtin", "L1"): "surv"}
