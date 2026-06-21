from unittest.mock import MagicMock
from ministry_facts.core.resolver import Resolver
from ministry_facts.core.models import MinistryEntry

def _e(**kw):
    base = dict(source="tarim:liste1", firma="Yeni Firma", marka="YeniMarka",
        urun="Peynir", violation="x", category_hint="", province="İstanbul",
        district=None, batch=None, announced_at="2026-03-12", source_url="", raw={})
    base.update(kw); return MinistryEntry(**base)

def _resolver():
    sb, dyn = MagicMock(), MagicMock()
    r = Resolver(supabase=sb, dynamo_table=dyn, write=True)
    r._turso = MagicMock()  # patch module turso writer
    r._dynamo_write = MagicMock()  # patch module dynamo writer (hermetic)
    return r, sb, dyn

def test_reuses_existing_listing_by_source_id():
    r, sb, dyn = _resolver()
    sb.table().select().eq().execute.return_value.data = [{"id": "existing-id"}]
    lid = r.resolve(_e())
    assert lid == "existing-id"
    r._dynamo_write.assert_not_called()  # no create

def test_creates_listing_in_all_three_stores_with_shared_id():
    r, sb, dyn = _resolver()
    # source_id lookup empty -> create path
    sb.table().select().eq().execute.return_value.data = []
    sb.table().upsert().execute.return_value.data = [{"id": "new-uuid"}]
    lid = r.resolve(_e())
    assert lid  # returned id
    assert r._dynamo_write.called       # DynamoDB write (injected writer)
    assert r._turso.called              # Turso write
    # entry has marka -> entity_type 'brand'
    payload = sb.table().upsert.call_args.args[0]
    assert payload["entity_type"] == "brand"

def test_creates_product_listing_when_no_marka():
    r, sb, dyn = _resolver()
    sb.table().select().eq().execute.return_value.data = []
    sb.table().upsert().execute.return_value.data = [{"id": "new-uuid"}]
    # marka=None -> must be 'product' (never 'business' — that needs city_code)
    lid = r.resolve(_e(marka=None))
    assert lid
    payload = sb.table().upsert.call_args.args[0]
    assert payload["entity_type"] == "product"

def test_matched_existing_listing_skips_create():
    sb, dyn = MagicMock(), MagicMock()
    sb.table().select().eq().execute.return_value.data = []  # no source_id hit
    from unittest.mock import MagicMock as MM
    matcher = MM(); matcher.match.return_value = "catalog-123"
    r = Resolver(supabase=sb, dynamo_table=dyn, write=True, matcher=matcher)
    r._turso = MM(); r._dynamo_write = MM()
    lid = r.resolve(_e())   # reuse the module's _e() helper
    assert lid == "catalog-123"
    sb.table().upsert.assert_not_called()
    r._dynamo_write.assert_not_called()
    r._turso.assert_not_called()
    assert r.last_outcome == "matched"

def test_dry_run_writes_nothing():
    sb, dyn = MagicMock(), MagicMock()
    r = Resolver(supabase=sb, dynamo_table=dyn, write=False)
    r._turso = MagicMock()
    r._dynamo_write = MagicMock()
    sb.table().select().eq().execute.return_value.data = []
    lid = r.resolve(_e())
    assert lid is None
    r._dynamo_write.assert_not_called()
    sb.table().upsert.assert_not_called()
