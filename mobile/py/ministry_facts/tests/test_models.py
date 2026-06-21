from ministry_facts.core.models import MinistryEntry

def _entry(**kw):
    base = dict(source="tarim:liste1", firma="Acme Gıda", marka="Acme",
                urun="Peynir", violation="Bitkisel yağ", category_hint="liste1",
                province="İstanbul", district="Kadıköy", batch="L123",
                announced_at="2026-03-12", source_url="http://x", raw={})
    base.update(kw)
    return MinistryEntry(**base)

def test_external_key_deterministic_and_stable():
    a = _entry().external_key()
    b = _entry().external_key()
    assert a == b
    assert _entry(urun="Süt").external_key() != a

def test_gubis_external_key_uses_bildirim_no():
    e = _entry(source="gubis", raw={"BildirimNo": "2023100001"})
    assert e.external_key() == "2023100001"

def test_eu_external_key_uses_alert_id():
    e = _entry(source="eu_safety_gate", raw={"alert_id": "A12345"})
    assert e.external_key() == "A12345"

def test_firm_key_normalizes_company_suffixes():
    e = _entry(firma="Acme Gıda San. ve Tic. Ltd. Şti.", marka=None)
    assert e.firm_key() == "acme-gida"
