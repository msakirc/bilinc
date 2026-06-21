from ministry_facts.core.statement import build_statement
from ministry_facts.core.models import MinistryEntry


def _e(**kw):
    base = dict(
        source="tarim:liste1",
        firma="Acme Gıda",
        marka="Acme",
        urun="Beyaz Peynir",
        violation="Bitkisel yağ tespit edildi",
        category_hint="",
        province="İstanbul",
        district=None,
        batch=None,
        announced_at="2026-03-12",
        source_url="",
        raw={},
    )
    base.update(kw)
    return MinistryEntry(**base)


def test_includes_brand_product_violation_source_date():
    s = build_statement(_e())
    assert s.startswith("Acme — Beyaz Peynir: Bitkisel yağ tespit edildi.")
    assert "Tarım ve Orman Bakanlığı" in s
    assert "12.03.2026" in s


def test_falls_back_to_firma_when_no_marka():
    s = build_statement(_e(marka=None))
    assert s.startswith("Acme Gıda — Beyaz Peynir")


def test_caps_at_1000_chars():
    s = build_statement(_e(violation="x" * 2000))
    assert len(s) <= 1000


def test_source_label_per_source():
    assert "Tarım ve Orman Bakanlığı" in build_statement(_e(source="tarim:liste1"))
    assert "Ticaret Bakanlığı" in build_statement(_e(source="gubis"))
    assert "TİTCK" in build_statement(_e(source="titck:113"))
    assert "EU Safety Gate" in build_statement(_e(source="eu_safety_gate"))
