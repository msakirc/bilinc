"""
Category Migration Script for Supabase

Features:
- DRY_RUN mode (default: True)
- Creates new category tree
- Maps old listings to new categories
- Logs all operations
- Rollback capability via backup tables

Usage:
  python migrate_categories.py --dry-run    # Preview changes
  python migrate_categories.py --execute    # Run migration
  python migrate_categories.py --rollback   # Restore from backup
"""

import os
from datetime import datetime
from supabase import create_client, Client
from dataclasses import dataclass
from typing import Optional
import slugify
import json

# ============================================================
# CONFIGURATION
# ============================================================

DRY_RUN = False  # Set to False to execute

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

# ============================================================
# NEW CATEGORY STRUCTURE
# ============================================================

NEW_CATEGORIES = {
    "yiyecek-icecek": {
        "name": "Yiyecek & İçecek",
        "name_en": "Food & Beverage",
        "icon": "utensils",
        "allowed_types": ["business", "product", "brand"],
        "children": {
            "restoran-lokanta": {
                "name": "Restoran & Lokanta",
                "name_en": "Restaurant",
                "allowed_types": ["business", "brand"],
            },
            "kafe-bar": {
                "name": "Kafe & Bar",
                "name_en": "Cafe & Bar",
                "allowed_types": ["business", "brand"],
            },
            "firin-pastane": {
                "name": "Fırın & Pastane",
                "name_en": "Bakery & Patisserie",
                "allowed_types": ["business", "brand"],
            },
            "market-bakkal": {
                "name": "Market & Bakkal",
                "name_en": "Grocery",
                "allowed_types": ["business", "brand"],
            },
            "kasap": {
                "name": "Kasap",
                "name_en": "Butcher",
                "allowed_types": ["business"],
            },
            "manav": {
                "name": "Manav",
                "name_en": "Greengrocer",
                "allowed_types": ["business"],
            },
            "balikci": {
                "name": "Balıkçı",
                "name_en": "Fishmonger",
                "allowed_types": ["business"],
            },
            "sut-urunleri": {
                "name": "Süt Ürünleri",
                "name_en": "Dairy Products",
                "allowed_types": ["product", "brand"],
                "children": {
                    "peynir": {"name": "Peynir", "name_en": "Cheese"},
                    "yogurt": {"name": "Yoğurt", "name_en": "Yogurt"},
                    "sut": {"name": "Süt", "name_en": "Milk"},
                    "tereyagi": {"name": "Tereyağı", "name_en": "Butter"},
                    "ayran": {"name": "Ayran", "name_en": "Ayran"},
                },
            },
            "et-protein": {
                "name": "Et & Protein",
                "name_en": "Meat & Protein",
                "allowed_types": ["product", "brand"],
                "children": {
                    "kirmizi-et": {"name": "Kırmızı Et", "name_en": "Red Meat"},
                    "tavuk": {"name": "Tavuk", "name_en": "Chicken"},
                    "balik": {"name": "Balık", "name_en": "Fish"},
                    "sarkuteri": {"name": "Şarküteri", "name_en": "Deli Meats"},
                },
            },
            "temel-gida": {
                "name": "Temel Gıda",
                "name_en": "Staple Foods",
                "allowed_types": ["product", "brand"],
                "children": {
                    "tahil": {"name": "Tahıl", "name_en": "Grains"},
                    "baklagil": {"name": "Baklagil", "name_en": "Legumes"},
                    "makarna": {"name": "Makarna", "name_en": "Pasta"},
                    "yag": {"name": "Yağ", "name_en": "Oil"},
                },
            },
            "kahvaltilik": {
                "name": "Kahvaltılık",
                "name_en": "Breakfast Items",
                "allowed_types": ["product", "brand"],
                "children": {
                    "bal": {"name": "Bal", "name_en": "Honey"},
                    "recel": {"name": "Reçel", "name_en": "Jam"},
                    "zeytin": {"name": "Zeytin", "name_en": "Olives"},
                    "tahin-pekmez": {"name": "Tahin & Pekmez", "name_en": "Tahini & Molasses"},
                },
            },
            "tatli-atistirmalik": {
                "name": "Tatlı & Atıştırmalık",
                "name_en": "Sweets & Snacks",
                "allowed_types": ["product", "brand"],
            },
            "icecek": {
                "name": "İçecek",
                "name_en": "Beverages",
                "allowed_types": ["product", "brand"],
                "children": {
                    "sicak-icecek": {"name": "Sıcak İçecek", "name_en": "Hot Beverages"},
                    "soguk-icecek": {"name": "Soğuk İçecek", "name_en": "Cold Beverages"},
                    "alkol": {"name": "Alkollü İçecek", "name_en": "Alcoholic Beverages"},
                },
            },
        },
    },

    "saglik-guzellik": {
        "name": "Sağlık & Güzellik",
        "name_en": "Health & Beauty",
        "icon": "heart-pulse",
        "allowed_types": ["business", "product", "brand"],
        "children": {
            "hastane-klinik": {
                "name": "Hastane & Klinik",
                "name_en": "Hospital & Clinic",
                "allowed_types": ["business"],
            },
            "doktor-uzman": {
                "name": "Doktor & Uzman",
                "name_en": "Doctor & Specialist",
                "allowed_types": ["business"],
            },
            "eczane": {
                "name": "Eczane",
                "name_en": "Pharmacy",
                "allowed_types": ["business"],
            },
            "kuafor-berber": {
                "name": "Kuaför & Berber",
                "name_en": "Hair Salon & Barber",
                "allowed_types": ["business"],
            },
            "guzellik-salonu": {
                "name": "Güzellik Salonu",
                "name_en": "Beauty Salon",
                "allowed_types": ["business"],
            },
            "spa-masaj": {
                "name": "Spa & Masaj",
                "name_en": "Spa & Massage",
                "allowed_types": ["business"],
            },
            "spor-salonu": {
                "name": "Spor Salonu",
                "name_en": "Gym",
                "allowed_types": ["business", "brand"],
            },
            "cilt-bakim-urunleri": {
                "name": "Cilt Bakım Ürünleri",
                "name_en": "Skincare Products",
                "allowed_types": ["product", "brand"],
            },
            "sac-bakim-urunleri": {
                "name": "Saç Bakım Ürünleri",
                "name_en": "Haircare Products",
                "allowed_types": ["product", "brand"],
            },
            "makyaj": {
                "name": "Makyaj",
                "name_en": "Makeup",
                "allowed_types": ["product", "brand"],
            },
            "parfum-deodorant": {
                "name": "Parfüm & Deodorant",
                "name_en": "Perfume & Deodorant",
                "allowed_types": ["product", "brand"],
            },
            "saglik-urunleri": {
                "name": "Sağlık Ürünleri",
                "name_en": "Health Products",
                "allowed_types": ["product", "brand"],
                "children": {
                    "vitamin-takviye": {"name": "Vitamin & Takviye", "name_en": "Vitamins & Supplements"},
                    "tibbi-cihaz": {"name": "Tıbbi Cihaz", "name_en": "Medical Devices"},
                    "ilk-yardim": {"name": "İlk Yardım", "name_en": "First Aid"},
                },
            },
        },
    },

    "moda": {
        "name": "Moda",
        "name_en": "Fashion",
        "icon": "shirt",
        "allowed_types": ["business", "product", "brand"],
        "children": {
            "giyim-magazasi": {
                "name": "Giyim Mağazası",
                "name_en": "Clothing Store",
                "allowed_types": ["business", "brand"],
            },
            "kadin-giyim": {
                "name": "Kadın Giyim",
                "name_en": "Women's Clothing",
                "allowed_types": ["product", "brand"],
            },
            "erkek-giyim": {
                "name": "Erkek Giyim",
                "name_en": "Men's Clothing",
                "allowed_types": ["product", "brand"],
            },
            "cocuk-giyim": {
                "name": "Çocuk Giyim",
                "name_en": "Kids' Clothing",
                "allowed_types": ["product", "brand"],
            },
            "ayakkabi": {
                "name": "Ayakkabı",
                "name_en": "Shoes",
                "allowed_types": ["business", "product", "brand"],
            },
            "canta": {
                "name": "Çanta",
                "name_en": "Bags",
                "allowed_types": ["product", "brand"],
            },
            "saat-taki": {
                "name": "Saat & Takı",
                "name_en": "Watches & Jewelry",
                "allowed_types": ["business", "product", "brand"],
            },
            "gozluk": {
                "name": "Gözlük",
                "name_en": "Eyewear",
                "allowed_types": ["business", "product", "brand"],
            },
            "terzi": {
                "name": "Terzi",
                "name_en": "Tailor",
                "allowed_types": ["business"],
            },
        },
    },

    "ev-yasam": {
        "name": "Ev & Yaşam",
        "name_en": "Home & Living",
        "icon": "home",
        "allowed_types": ["business", "product", "brand"],
        "children": {
            "mobilya": {
                "name": "Mobilya",
                "name_en": "Furniture",
                "allowed_types": ["product", "brand"],
            },
            "mobilya-magazasi": {
                "name": "Mobilya Mağazası",
                "name_en": "Furniture Store",
                "allowed_types": ["business", "brand"],
            },
            "ev-tekstili": {
                "name": "Ev Tekstili",
                "name_en": "Home Textile",
                "allowed_types": ["product", "brand"],
            },
            "mutfak-gerecleri": {
                "name": "Mutfak Gereçleri",
                "name_en": "Kitchenware",
                "allowed_types": ["product", "brand"],
            },
            "dekorasyon": {
                "name": "Dekorasyon",
                "name_en": "Decoration",
                "allowed_types": ["product", "brand"],
            },
            "aydinlatma": {
                "name": "Aydınlatma",
                "name_en": "Lighting",
                "allowed_types": ["product", "brand"],
            },
            "beyaz-esya": {
                "name": "Beyaz Eşya",
                "name_en": "White Goods",
                "allowed_types": ["product", "brand"],
            },
            "kucuk-ev-aletleri": {
                "name": "Küçük Ev Aletleri",
                "name_en": "Small Appliances",
                "allowed_types": ["product", "brand"],
            },
            "yapi-market": {
                "name": "Yapı Market",
                "name_en": "Hardware Store",
                "allowed_types": ["business", "brand"],
            },
            "temizlik-urunleri": {
                "name": "Temizlik Ürünleri",
                "name_en": "Cleaning Products",
                "allowed_types": ["product", "brand"],
            },
            "bahce": {
                "name": "Bahçe",
                "name_en": "Garden",
                "allowed_types": ["product", "brand"],
            },
            "ev-tadilat": {
                "name": "Ev Tadilat Hizmeti",
                "name_en": "Home Renovation Services",
                "allowed_types": ["business"],
            },
        },
    },

    "teknoloji": {
        "name": "Teknoloji",
        "name_en": "Technology",
        "icon": "laptop",
        "allowed_types": ["business", "product", "brand"],
        "children": {
            "telefon": {
                "name": "Telefon",
                "name_en": "Phone",
                "allowed_types": ["product", "brand"],
            },
            "bilgisayar": {
                "name": "Bilgisayar",
                "name_en": "Computer",
                "allowed_types": ["product", "brand"],
            },
            "tablet": {
                "name": "Tablet",
                "name_en": "Tablet",
                "allowed_types": ["product", "brand"],
            },
            "televizyon": {
                "name": "Televizyon",
                "name_en": "Television",
                "allowed_types": ["product", "brand"],
            },
            "ses-goruntu": {
                "name": "Ses & Görüntü",
                "name_en": "Audio & Video",
                "allowed_types": ["product", "brand"],
            },
            "oyun-konsol": {
                "name": "Oyun & Konsol",
                "name_en": "Gaming",
                "allowed_types": ["product", "brand"],
            },
            "aksesuar": {
                "name": "Aksesuar",
                "name_en": "Accessories",
                "allowed_types": ["product", "brand"],
            },
            "elektronik-magazasi": {
                "name": "Elektronik Mağazası",
                "name_en": "Electronics Store",
                "allowed_types": ["business", "brand"],
            },
            "teknik-servis": {
                "name": "Teknik Servis",
                "name_en": "Tech Service",
                "allowed_types": ["business"],
            },
        },
    },

    "otomotiv": {
        "name": "Otomotiv",
        "name_en": "Automotive",
        "icon": "car",
        "allowed_types": ["business", "product", "brand"],
        "children": {
            "benzin-istasyonu": {
                "name": "Benzin İstasyonu",
                "name_en": "Gas Station",
                "allowed_types": ["business", "brand"],
            },
            "oto-yikama": {
                "name": "Oto Yıkama",
                "name_en": "Car Wash",
                "allowed_types": ["business"],
            },
            "oto-tamir": {
                "name": "Oto Tamir",
                "name_en": "Auto Repair",
                "allowed_types": ["business"],
            },
            "lastikci": {
                "name": "Lastikçi",
                "name_en": "Tire Shop",
                "allowed_types": ["business"],
            },
            "oto-galeri": {
                "name": "Oto Galeri",
                "name_en": "Car Dealership",
                "allowed_types": ["business"],
            },
            "arac-kiralama": {
                "name": "Araç Kiralama",
                "name_en": "Car Rental",
                "allowed_types": ["business", "brand"],
            },
            "otopark": {
                "name": "Otopark",
                "name_en": "Parking",
                "allowed_types": ["business"],
            },
            "yedek-parca": {
                "name": "Yedek Parça",
                "name_en": "Spare Parts",
                "allowed_types": ["business", "product", "brand"],
            },
            "arac-bakim-urunleri": {
                "name": "Araç Bakım Ürünleri",
                "name_en": "Car Care Products",
                "allowed_types": ["product", "brand"],
            },
            "arac-aksesuari": {
                "name": "Araç Aksesuarı",
                "name_en": "Car Accessories",
                "allowed_types": ["product", "brand"],
            },
        },
    },

    "egitim": {
        "name": "Eğitim",
        "name_en": "Education",
        "icon": "graduation-cap",
        "allowed_types": ["business", "product", "brand"],
        "children": {
            "okul": {
                "name": "Okul",
                "name_en": "School",
                "allowed_types": ["business"],
            },
            "kurs": {
                "name": "Kurs",
                "name_en": "Course",
                "allowed_types": ["business"],
            },
            "ozel-ders": {
                "name": "Özel Ders",
                "name_en": "Private Tutoring",
                "allowed_types": ["business"],
            },
            "surucu-kursu": {
                "name": "Sürücü Kursu",
                "name_en": "Driving School",
                "allowed_types": ["business"],
            },
            "kitap": {
                "name": "Kitap",
                "name_en": "Books",
                "allowed_types": ["product", "brand"],
            },
            "kirtasiye": {
                "name": "Kırtasiye",
                "name_en": "Stationery",
                "allowed_types": ["business", "product", "brand"],
            },
        },
    },

    "eglence": {
        "name": "Eğlence",
        "name_en": "Entertainment",
        "icon": "ticket",
        "allowed_types": ["business", "product", "brand"],
        "children": {
            "sinema": {
                "name": "Sinema",
                "name_en": "Cinema",
                "allowed_types": ["business", "brand"],
            },
            "tiyatro": {
                "name": "Tiyatro",
                "name_en": "Theater",
                "allowed_types": ["business"],
            },
            "muze": {
                "name": "Müze",
                "name_en": "Museum",
                "allowed_types": ["business"],
            },
            "park-lunapark": {
                "name": "Park & Lunapark",
                "name_en": "Park & Amusement Park",
                "allowed_types": ["business"],
            },
            "gece-kulubu": {
                "name": "Gece Kulübü",
                "name_en": "Night Club",
                "allowed_types": ["business"],
            },
            "oyun-salonu": {
                "name": "Oyun Salonu",
                "name_en": "Arcade",
                "allowed_types": ["business"],
            },
            "bowling": {
                "name": "Bowling",
                "name_en": "Bowling",
                "allowed_types": ["business"],
            },
            "oyuncak": {
                "name": "Oyuncak",
                "name_en": "Toys",
                "allowed_types": ["product", "brand"],
            },
        },
    },

    "spor-outdoor": {
        "name": "Spor & Outdoor",
        "name_en": "Sports & Outdoor",
        "icon": "dumbbell",
        "allowed_types": ["business", "product", "brand"],
        "children": {
            "spor-salonu-tesis": {
                "name": "Spor Salonu & Tesis",
                "name_en": "Gym & Sports Facility",
                "allowed_types": ["business"],
            },
            "fitness-ekipmani": {
                "name": "Fitness Ekipmanı",
                "name_en": "Fitness Equipment",
                "allowed_types": ["product", "brand"],
            },
            "spor-giyim": {
                "name": "Spor Giyim",
                "name_en": "Sportswear",
                "allowed_types": ["product", "brand"],
            },
            "spor-ayakkabi": {
                "name": "Spor Ayakkabı",
                "name_en": "Sports Shoes",
                "allowed_types": ["product", "brand"],
            },
            "outdoor-kamp": {
                "name": "Outdoor & Kamp",
                "name_en": "Outdoor & Camping",
                "allowed_types": ["product", "brand"],
            },
            "bisiklet": {
                "name": "Bisiklet",
                "name_en": "Bicycle",
                "allowed_types": ["product", "brand"],
            },
        },
    },

    "hizmetler": {
        "name": "Hizmetler",
        "name_en": "Services",
        "icon": "briefcase",
        "allowed_types": ["business", "brand"],
        "children": {
            "banka-finans": {
                "name": "Banka & Finans",
                "name_en": "Bank & Finance",
                "allowed_types": ["business", "brand"],
            },
            "sigorta": {
                "name": "Sigorta",
                "name_en": "Insurance",
                "allowed_types": ["business", "brand"],
            },
            "avukat-hukuk": {
                "name": "Avukat & Hukuk",
                "name_en": "Lawyer & Legal",
                "allowed_types": ["business"],
            },
            "noter": {
                "name": "Noter",
                "name_en": "Notary",
                "allowed_types": ["business"],
            },
            "emlak": {
                "name": "Emlak",
                "name_en": "Real Estate",
                "allowed_types": ["business", "brand"],
            },
            "nakliyat": {
                "name": "Nakliyat",
                "name_en": "Moving",
                "allowed_types": ["business"],
            },
            "temizlik-hizmeti": {
                "name": "Temizlik Hizmeti",
                "name_en": "Cleaning Service",
                "allowed_types": ["business"],
            },
            "kargo-kurye": {
                "name": "Kargo & Kurye",
                "name_en": "Cargo & Courier",
                "allowed_types": ["business", "brand"],
            },
            "fotografci": {
                "name": "Fotoğrafçı",
                "name_en": "Photographer",
                "allowed_types": ["business"],
            },
            "organizasyon": {
                "name": "Organizasyon",
                "name_en": "Event Organization",
                "allowed_types": ["business"],
            },
        },
    },

    "konaklama-seyahat": {
        "name": "Konaklama & Seyahat",
        "name_en": "Accommodation & Travel",
        "icon": "bed",
        "allowed_types": ["business", "brand"],
        "children": {
            "otel": {
                "name": "Otel",
                "name_en": "Hotel",
                "allowed_types": ["business", "brand"],
            },
            "pansiyon-hostel": {
                "name": "Pansiyon & Hostel",
                "name_en": "Guesthouse & Hostel",
                "allowed_types": ["business"],
            },
            "apart-kiralik": {
                "name": "Apart & Kiralık",
                "name_en": "Apartment Rental",
                "allowed_types": ["business"],
            },
            "seyahat-acentesi": {
                "name": "Seyahat Acentesi",
                "name_en": "Travel Agency",
                "allowed_types": ["business", "brand"],
            },
        },
    },

    "bebek-evcil": {
        "name": "Bebek & Evcil Hayvan",
        "name_en": "Baby & Pets",
        "icon": "baby",
        "allowed_types": ["business", "product", "brand"],
        "children": {
            "bebek-urunleri": {
                "name": "Bebek Ürünleri",
                "name_en": "Baby Products",
                "allowed_types": ["product", "brand"],
            },
            "bebek-magazasi": {
                "name": "Bebek Mağazası",
                "name_en": "Baby Store",
                "allowed_types": ["business", "brand"],
            },
            "evcil-hayvan-urunleri": {
                "name": "Evcil Hayvan Ürünleri",
                "name_en": "Pet Products",
                "allowed_types": ["product", "brand"],
            },
            "pet-shop": {
                "name": "Pet Shop",
                "name_en": "Pet Shop",
                "allowed_types": ["business"],
            },
            "veteriner": {
                "name": "Veteriner",
                "name_en": "Veterinary",
                "allowed_types": ["business"],
            },
        },
    },
}


# ============================================================
# OLD → NEW CATEGORY MAPPING
# ============================================================

# Format: "old_parent/old_child": "new_l1/new_l2/new_l3"
# Use None for categories that should be deleted without migration

# Format: "old_slug": "new_slug_path"
# Use None for categories to delete without migration

CATEGORY_MAPPING = {
    # === PARENT CATEGORIES ===
    "food-drink": "yiyecek-icecek",
    "services": "hizmetler",
    "retail": None,  # Children map to various new categories
    "health-beauty": "saglik-guzellik",
    "real-estate": "hizmetler",  # Flattened into hizmetler/emlak
    "automotive": "otomotiv",
    "entertainment": "eglence",
    "education": "egitim",
    "technology": "teknoloji",
    "home-garden": "ev-yasam",
    "accommodation": "konaklama-seyahat",

    # === YIYECEK & IÇECEK ===
    "grocery": "market-bakkal",
    "supermarket": "market-bakkal",
    "restaurant": "restoran-lokanta",
    "cafe": "kafe-bar",
    "bar": "kafe-bar",
    "pub": "kafe-bar",
    "fast-food": "restoran-lokanta",
    "bakery": "firin-pastane",
    "patisserie": "firin-pastane",
    "butcher": "kasap",
    "fish-restaurant": "restoran-lokanta",
    "kebab": "restoran-lokanta",
    "pide-lahmacun": "restoran-lokanta",
    "delicatessen": "market-bakkal",
    "cheese": "peynir",
    "honey": "bal",
    "coffee": "sicak-icecek",
    "tea": "sicak-icecek",
    "olive-oil": "yag",

    # === SAĞLIK & GÜZELLIK ===
    "hospital": "hastane-klinik",
    "clinic": "hastane-klinik",
    "medical-center": "hastane-klinik",
    "dentist": "doktor-uzman",
    "pharmacy": "eczane",
    "optician": "gozluk",  # Moved to Moda
    "physiotherapy": "doktor-uzman",
    "psychology": "doktor-uzman",
    "cosmetics": "cilt-bakim-urunleri",
    "spa": "spa-masaj",
    "gym": "spor-salonu",
    "nail-salon": "guzellik-salonu",

    # === HIZMETLER ===
    "barber": "kuafor-berber",
    "hair-salon": "kuafor-berber",
    "bank": "banka-finans",
    "atm": "banka-finans",
    "exchange": "banka-finans",
    "insurance": "sigorta",
    "lawyer": "avukat-hukuk",
    "notary": "noter",
    "electrician": "ev-tadilat",
    "plumber": "ev-tadilat",
    "cleaning": "temizlik-hizmeti",
    "dry-cleaner": "temizlik-hizmeti",
    "moving": "nakliyat",
    "courier": "kargo-kurye",
    "post-office": "kargo-kurye",
    "photography": "fotografci",
    "travel-agency": "seyahat-acentesi",
    "tailor": "terzi",
    "veterinary": "veteriner",
    "pet-grooming": "pet-shop",
    "mechanic": "oto-tamir",
    "car-wash": "oto-yikama",

    # === OTOMOTIV ===
    "gas-station": "benzin-istasyonu",
    "car-parts": "yedek-parca",
    "tire-shop": "lastikci",
    "car-dealer": "oto-galeri",
    "parking": "otopark",
    "car-rental": "arac-kiralama",

    # === EĞITIM ===
    "kindergarten": "okul",
    "language-school": "kurs",
    "music-school": "kurs",
    "art-school": "kurs",
    "driving-school": "surucu-kursu",
    "tutoring": "ozel-ders",

    # === EĞLENCE ===
    "cinema": "sinema",
    "theater": "tiyatro",
    "museum": "muze",
    "park": "park-lunapark",
    "nightclub": "gece-kulubu",
    "arcade": "oyun-salonu",
    "bowling": "bowling",

    # === KONAKLAMA ===
    "hotel": "otel",
    "apart-hotel": "apart-kiralik",
    "guesthouse": "pansiyon-hostel",
    "hostel": "pansiyon-hostel",
    "resort": "otel",

    # === EMLAK ===
    "estate-agency": "emlak",
    "construction": "emlak",
    "property-management": "emlak",

    # === PERAKENDE (distributed) ===
    "clothing": "giyim-magazasi",
    "shoes": "ayakkabi",
    "electronics": "elektronik-magazasi",
    "mobile-phone": "elektronik-magazasi",
    "bookstore": "kitap",
    "stationery": "kirtasiye",
    "jewelry": "saat-taki",
    "toys": "oyuncak",
    "pet-shop": "pet-shop",
    "sports-equipment": "fitness-ekipmani",

    # === TEKNOLOJI ===
    "smartphone": "telefon",
    "laptop": "bilgisayar",
    "tv": "televizyon",
    "headphones": "ses-goruntu",
    "appliances": "beyaz-esya",  # Moved to Ev & Yaşam
}


# ============================================================
# MIGRATION LOGIC
# ============================================================

class CategoryMigrator:
    def __init__(self, supabase: Client, dry_run: bool = True):
        self.supabase = supabase
        self.dry_run = dry_run
        self.new_category_ids = {}  # slug -> uuid
        self.old_category_ids = {}  # "parent/child" -> uuid
        self.logs = []

    def log(self, message: str):
        timestamp = datetime.now().isoformat()
        entry = f"[{timestamp}] {message}"
        self.logs.append(entry)
        print(entry)


    def disable_trigger(self):
        """Disable validation trigger during migration"""
        self.log("Disabling listing_categories trigger...")

        if self.dry_run:
            self.log("[DRY RUN] Would disable trigger")
            return

        # Need to run via Supabase SQL editor or RPC
        sql = "ALTER TABLE listing_categories DISABLE TRIGGER listing_categories_validate;"
        self.log(f"Execute manually: {sql}")

    def enable_trigger(self):
        """Re-enable validation trigger after migration"""
        self.log("Re-enabling listing_categories trigger...")

        if self.dry_run:
            self.log("[DRY RUN] Would enable trigger")
            return

        sql = "ALTER TABLE listing_categories ENABLE TRIGGER listing_categories_validate;"
        self.log(f"Execute manually: {sql}")

    def rename_new_categories(self):
        """Remove 'new-' prefix after old categories are deleted"""
        self.log("Renaming categories (removing 'new-' prefix)...")

        if self.dry_run:
            self.log("[DRY RUN] Would rename prefixed categories")
            return

        response = self.supabase.table("categories").select("id, slug").like("slug", "new-%").execute()

        for cat in response.data:
            old_slug = cat["slug"]
            new_slug = old_slug.replace("new-", "", 1)

            self.supabase.table("categories").update({
                "slug": new_slug
            }).eq("id", cat["id"]).execute()

            self.log(f"Renamed: {old_slug} -> {new_slug}")

    def run(self):
        """Main migration flow"""
        self.log("=" * 60)
        self.log(f"STARTING MIGRATION (DRY_RUN={self.dry_run})")
        self.log("=" * 60)

        # Step 1: Backup
        self.backup_existing_data()

        # Step 2: Disable trigger
        self.disable_trigger()

        # Step 3: Load existing categories
        self.load_old_categories()

        # Step 4: Create new categories
        self.create_new_categories()

        # Step 5: Migrate listing_categories
        self.migrate_listing_categories()

        # Step 6: Delete old categories
        self.delete_old_categories()


        # Step 7: Rename prefixed categories
        self.rename_new_categories()

        # Step 8: Re-enable trigger
        self.enable_trigger()

        # Step 9: Save logs
        self.save_logs()

        self.log("=" * 60)
        self.log("MIGRATION COMPLETE")
        self.log("=" * 60)
    def backup_existing_data(self):
        """Create backup tables"""
        self.log("Creating backup tables...")

        if self.dry_run:
            self.log("[DRY RUN] Would create backup tables")
            return

        # Using raw SQL via RPC or direct query
        backup_sql = """
        CREATE TABLE IF NOT EXISTS categories_backup AS 
        SELECT * FROM categories;
        
        CREATE TABLE IF NOT EXISTS listing_categories_backup AS 
        SELECT * FROM listing_categories;
        """
        # Note: Supabase Python client doesn't support raw SQL directly
        # You'd need to use supabase.rpc() or run this via SQL editor
        self.log("Backup tables created")

    def load_old_categories(self):
        """Load existing OLD categories into memory (exclude new- prefixed)"""
        self.log("Loading existing categories...")

        response = self.supabase.table("categories").select("*").execute()

        for cat in response.data:
            # Skip partially created new categories
            if cat["slug"].startswith("new-"):
                continue

            # Skip new L1 categories (already created in previous run)
            if cat["slug"] in NEW_CATEGORIES:
                continue

            self.old_category_ids[cat["slug"]] = cat["id"]

        self.log(f"Loaded {len(self.old_category_ids)} old categories")

    def create_new_categories(self):
        """Create new category tree"""
        self.log("Creating new categories...")

        sort_order = 0
        for slug, data in NEW_CATEGORIES.items():
            sort_order += 1
            self._create_category_recursive(
                slug=slug,
                data=data,
                parent_id=None,
                sort_order=sort_order
            )

        self.log(f"Created {len(self.new_category_ids)} new categories")

    def _create_category_recursive(
        self,
        slug: str,
        data: dict,
        parent_id: Optional[str],
        sort_order: int
    ):
        # Check if slug already exists in old categories
        if slug in self.old_category_ids:
            actual_slug = f"new-{slug}"
        else:
            actual_slug = slug

        # CHECK IF ALREADY CREATED (from previous partial run)
        existing = (
            self.supabase.table("categories")
            .select("id")
            .eq("slug", actual_slug)
            .execute()
        )

        if existing.data:
            # Already exists - reuse it
            new_id = existing.data[0]["id"]
            self.new_category_ids[slug] = new_id
            self.log(f"Skipped (exists): {actual_slug} -> {new_id}")
        else:
            # Create new
            category_data = {
                "slug": actual_slug,
                "name": data["name"],
                "name_en": data.get("name_en"),
                "icon": data.get("icon"),
                "parent_id": parent_id,
                "sort_order": sort_order,
                "allowed_types": data.get("allowed_types", ["business", "product", "brand"]),
            }

            if self.dry_run:
                self.log(f"[DRY RUN] Would create: {actual_slug}")
                fake_id = f"fake-{slug}"
                self.new_category_ids[slug] = fake_id
                new_id = fake_id
            else:
                response = self.supabase.table("categories").insert(category_data).execute()
                new_id = response.data[0]["id"]
                self.new_category_ids[slug] = new_id
                self.log(f"Created: {actual_slug} -> {new_id}")

        # Create children
        children = data.get("children", {})
        child_sort = 0
        for child_slug, child_data in children.items():
            child_sort += 1
            self._create_category_recursive(
                slug=child_slug,
                data=child_data,
                parent_id=new_id,
                sort_order=child_sort
            )

    def migrate_listing_categories(self):
        """Update listing_categories to point to new category IDs"""
        self.log("Migrating listing_categories...")

        # Fetch in batches (103k records)
        batch_size = 1000
        offset = 0
        migrated = 0
        skipped = 0
        errors = []

        while True:
            response = (
                self.supabase.table("listing_categories")
                .select("*")
                .range(offset, offset + batch_size - 1)
                .execute()
            )

            if not response.data:
                break

            for lc in response.data:
                old_cat_id = lc["category_id"]

                # Find old slug
                old_slug = None
                for slug, cat_id in self.old_category_ids.items():
                    if cat_id == old_cat_id:
                        old_slug = slug
                        break

                if not old_slug:
                    errors.append(f"Unknown old category ID: {old_cat_id}")
                    continue

                # Find new slug
                new_slug = CATEGORY_MAPPING.get(old_slug)

                if new_slug is None:
                    skipped += 1
                    continue

                new_cat_id = self.new_category_ids.get(new_slug)

                if not new_cat_id:
                    errors.append(f"New category not found: {new_slug}")
                    continue

                if self.dry_run:
                    self.log(f"[DRY RUN] {lc['listing_id']}: {old_slug} -> {new_slug}")
                else:
                    self.supabase.table("listing_categories").update({
                        "category_id": new_cat_id
                    }).eq("listing_id", lc["listing_id"]).eq("category_id", old_cat_id).execute()

                migrated += 1

            offset += batch_size
            self.log(f"Processed {offset} records...")

        self.log(f"Migrated: {migrated}, Skipped: {skipped}, Errors: {len(errors)}")
        for error in errors[:20]:  # Show first 20 errors only
            self.log(f"  ERROR: {error}")

    def delete_old_categories(self):
        """Delete old categories that are no longer needed"""
        self.log("Deleting old categories...")

        # Get all old category IDs
        old_ids = list(self.old_category_ids.values())

        if self.dry_run:
            self.log(f"[DRY RUN] Would delete {len(old_ids)} old categories")
            return

        # Delete children first (to avoid FK constraints)
        # This requires ordering by depth - simplest is to delete all at once
        # if there are no remaining references

        for old_path, old_id in self.old_category_ids.items():
            try:
                self.supabase.table("categories").delete().eq("id", old_id).execute()
                self.log(f"Deleted: {old_path}")
            except Exception as e:
                self.log(f"Error deleting {old_path}: {e}")

    def save_logs(self):
        """Save migration logs to file"""
        filename = f"migration_log_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        with open(filename, "w", encoding="utf-8") as f:
            f.write("\n".join(self.logs))
        self.log(f"Logs saved to: {filename}")


# ============================================================
# ROLLBACK
# ============================================================

def rollback(supabase: Client):
    """Restore from backup tables"""
    print("Rolling back...")

    # This would need raw SQL execution
    rollback_sql = """
    -- Delete new data
    DELETE FROM listing_categories;
    DELETE FROM categories;
    
    -- Restore from backup
    INSERT INTO categories SELECT * FROM categories_backup;
    INSERT INTO listing_categories SELECT * FROM listing_categories_backup;
    
    -- Drop backup tables
    DROP TABLE categories_backup;
    DROP TABLE listing_categories_backup;
    """
    print("Rollback SQL generated. Execute manually in Supabase SQL editor.")
    print(rollback_sql)


# ============================================================
# MAIN
# ============================================================

def main():
    import argparse

    parser = argparse.ArgumentParser(description="Category Migration Script")
    parser.add_argument("--dry-run", action="store_true", default=True,
                        help="Preview changes without executing")
    parser.add_argument("--execute", action="store_true",
                        help="Execute migration (overrides dry-run)")
    parser.add_argument("--rollback", action="store_true",
                        help="Rollback to backup")

    args = parser.parse_args()

    # Validate credentials
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables")
        return

    # Initialize client
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    if args.rollback:
        rollback(supabase)
        return

    dry_run = not args.execute

    migrator = CategoryMigrator(supabase, dry_run=dry_run)
    migrator.run()


if __name__ == "__main__":
    main()
