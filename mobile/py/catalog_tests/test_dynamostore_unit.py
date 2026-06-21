from catalog_store import _pk_key, _pk_entity

def test_index_pk_is_type_scoped():
    assert _pk_key("product", "wikidata", "Q42") == "XKEY#product#wikidata#Q42"
    assert _pk_key("brand", "wikidata", "Q42") == "XKEY#brand#wikidata#Q42"  # distinct (M1)

def test_entity_pk():
    assert _pk_entity("abc123") == "ENTITY#abc123"
