import catalog_common as cc

def biz(name, lat=None, lon=None):
    return {"entity_type": cc.ENTITY_BUSINESS, "name": name, "lat": lat, "lon": lon, "attrs": {}}

def test_business_same_name_within_radius_matches():
    a = biz("Starbucks Kadıköy", 40.9901, 29.0270)
    b = biz("Starbucks", 40.9902, 29.0271)
    assert cc.match_business(a, b) is True

def test_business_far_apart_no_match():
    a = biz("Starbucks", 40.9901, 29.0270)
    b = biz("Starbucks", 41.0150, 28.9790)  # ~5km
    assert cc.match_business(a, b) is False

def test_business_no_geo_does_not_match_when_require_geo():
    a = biz("Starbucks")
    b = biz("Starbucks", 40.99, 29.02)
    assert cc.match_business(a, b) is False  # online: geo required (m2)

def test_product_same_brand_name_jaccard():
    a = {"name": "Cola Zero 330ml", "attrs": {"brand": "CocaCola"}}
    b = {"name": "Cola Zero", "attrs": {"brand": "cocacola"}}
    assert cc.match_product(a, b) is True

def test_matcher_for_returns_callable():
    assert callable(cc.matcher_for(cc.ENTITY_BRAND))
    assert cc.matcher_for("nope") is None
