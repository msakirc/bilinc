from unittest.mock import MagicMock
from ministry_facts.core.injector import Injector
from ministry_facts.core.models import MinistryEntry

SYS = "00000000-0000-0000-0000-000000000001"

def _e(**kw):
    base = dict(source="tarim:liste1", firma="Acme", marka="Acme", urun="Peynir",
        violation="Bitkisel yağ", category_hint="", province="İstanbul",
        district=None, batch="L1", announced_at="2026-03-12",
        source_url="http://x", raw={}); base.update(kw)
    return MinistryEntry(**base)

def test_skips_when_external_key_already_present():
    sb = MagicMock()
    sb.table().select().eq().eq().execute.return_value.data = [{"id": "fs1"}]
    inj = Injector(supabase=sb, system_user_id=SYS, write=True)
    assert inj.inject(_e(), "listing-1") == "skipped"
    sb.table().insert.assert_not_called()

def test_inserts_fact_and_fact_source_with_explicit_listing_name():
    sb = MagicMock()
    sb.table().select().eq().eq().execute.return_value.data = []
    sb.table().insert().execute.return_value.data = [{"id": "fact-1"}]
    inj = Injector(supabase=sb, system_user_id=SYS, write=True, listing_name="Acme")
    res = inj.inject(_e(), "listing-1")
    assert res == "inserted"
    payloads = [c.args[0] for c in sb.table().insert.call_args_list if c.args]
    fact_payload = payloads[0]
    assert fact_payload["listing_name"] == "Acme"
    assert fact_payload["verification_status"] == "verified"
    assert fact_payload["user_id"] == SYS

def test_deletes_fact_when_fact_sources_insert_fails():
    sb = MagicMock()
    sb.table().select().eq().eq().execute.return_value.data = []
    # MagicMock returns the same child regardless of table() args, so insert()
    # is shared between the facts and fact_sources calls. First ins().execute()
    # (facts) succeeds, second (fact_sources) raises.
    res = MagicMock()
    res.data = [{"id": "fact-1"}]
    sb.table().insert().execute.side_effect = [res, RuntimeError("boom")]
    inj = Injector(supabase=sb, system_user_id=SYS, write=True)
    import pytest
    with pytest.raises(RuntimeError):
        inj.inject(_e(), "listing-1")
    # compensating delete must have been issued (on facts)
    sb.table().delete.assert_called()
    sb.table().delete().eq.assert_called_with("id", "fact-1")

def test_dry_run_no_writes():
    sb = MagicMock()
    sb.table().select().eq().eq().execute.return_value.data = []
    inj = Injector(supabase=sb, system_user_id=SYS, write=False)
    assert inj.inject(_e(), "listing-1") == "dry"
    sb.table().insert.assert_not_called()
