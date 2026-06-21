from ministry_facts.core.category import map_category
from ministry_facts.core.models import MinistryEntry

def _e(source, hint="", violation=""):
    return MinistryEntry(source=source, firma="F", marka=None, urun="U",
        violation=violation, category_hint=hint, province=None, district=None,
        batch=None, announced_at=None, source_url="", raw={})

def test_tarim_tagsis_is_quality():
    assert map_category(_e("tarim:liste1")) == "quality"
    assert map_category(_e("tarim:liste2")) == "quality"

def test_tarim_health_endangering_is_safety():
    assert map_category(_e("tarim:saglik")) == "safety"

def test_titck_and_gubis_are_safety():
    assert map_category(_e("titck:113")) == "safety"
    assert map_category(_e("gubis")) == "safety"

def test_eu_uses_risk_keywords():
    assert map_category(_e("eu_safety_gate", violation="chemical hazard")) == "health"
    assert map_category(_e("eu_safety_gate", violation="environment damage")) == "environmental"
    assert map_category(_e("eu_safety_gate", violation="fire risk")) == "safety"
