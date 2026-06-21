from ministry_facts.sources.tarim import record_to_entry


def test_record_maps_to_entry():
    rec = {"DuyuruTarihi": "/Date(1741737600000)/", "FirmaAdi": "Acme Gıda",
           "Marka": "Acme", "UrunAdi": "Beyaz Peynir",
           "Uygunsuzluk": "Bitkisel yağ<br>tespit", "PartiSeriNo": "L1",
           "FirmaIlce": "Kadıköy", "FirmaIl": "İstanbul", "UrunGrupAdi": "Süt"}
    e = record_to_entry(rec, "tarim:liste1")
    assert e.firma == "Acme Gıda"
    assert e.marka == "Acme"
    assert e.urun == "Beyaz Peynir"
    assert e.violation == "Bitkisel yağ, tespit"   # <br> -> ", "
    assert e.province == "İstanbul"
    assert e.source == "tarim:liste1"
    assert e.announced_at and e.announced_at.startswith("2025")
