"""MinistryEntry -> facts.category (base enum:
safety, ownership, health, quality, legal, environmental, other)."""
from ministry_facts.core.models import MinistryEntry


def _eu_risk(text: str) -> str:
    t = (text or "").lower()
    if any(k in t for k in ("chemical", "microbiolog", "health", "choking", "suffocat")):
        return "health"
    if "environment" in t:
        return "environmental"
    return "safety"


def map_category(entry: MinistryEntry) -> str:
    s = entry.source
    if s in ("tarim:liste1", "tarim:liste2"):
        return "quality"
    if s == "tarim:saglik":
        return "safety"
    if s.startswith("titck:") or s == "gubis":
        return "safety"
    if s == "eu_safety_gate":
        return _eu_risk(entry.violation + " " + entry.category_hint)
    return "other"
