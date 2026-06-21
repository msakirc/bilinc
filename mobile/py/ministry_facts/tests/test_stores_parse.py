from ministry_facts.core.stores import _parse_pipeline_rows, _clean_fts_query

def test_clean_fts_strips_operators():
    assert _clean_fts_query('Acme*  "Gıda" (Ltd)') == "Acme Gıda Ltd"

def test_parse_pipeline_rows():
    result = {"results": [{"type": "ok", "response": {"type": "execute", "result": {
        "cols": [{"name": "id"}, {"name": "name"}, {"name": "entity_type"}],
        "rows": [
            [{"type": "text", "value": "L1"}, {"type": "text", "value": "Ülker"}, {"type": "text", "value": "brand"}],
            [{"type": "text", "value": "L2"}, {"type": "text", "value": "Eti"}, {"type": "null"}],
        ]}}}]}
    rows = _parse_pipeline_rows(result)
    assert rows == [
        {"id": "L1", "name": "Ülker", "entity_type": "brand"},
        {"id": "L2", "name": "Eti", "entity_type": None},
    ]

def test_parse_empty():
    assert _parse_pipeline_rows({"results": []}) == []
