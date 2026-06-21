#!/usr/bin/env python3
"""
OSM Scraper v2 — Turkey Business Scraper

Scrapes all Turkish businesses from OpenStreetMap via Overpass API.
Uses country-wide queries (not per-city) for speed.
Smart brand resolution with known brands + frequency analysis.

Usage:
  python osm-scraper-v2.py --dry-run       # Fetch + stats, no DB writes
  python osm-scraper-v2.py --execute       # Full run with DB inserts
  python osm-scraper-v2.py --tag-group 3   # Retry single chunk
"""

import os
import re
import time
import json
import hashlib
import logging
import argparse
from datetime import datetime
from typing import Optional, Dict, List, Tuple
from dataclasses import dataclass, field
from collections import defaultdict
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OVERPASS_TIMEOUT = 300
REQUEST_DELAY = 4
RETRY_MAX = 3
RETRY_BACKOFF = [5, 15, 45]
BATCH_SIZE = 500

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("osm-scraper-v2")


def parse_args():
    parser = argparse.ArgumentParser(description="OSM Scraper v2 — Turkey")
    parser.add_argument("--dry-run", action="store_true", default=True,
                        help="Fetch + process, print stats, no DB writes (default)")
    parser.add_argument("--execute", action="store_true",
                        help="Execute with DB inserts (overrides dry-run)")
    parser.add_argument("--tag-group", type=int, default=None,
                        help="Run only a specific tag group (0-7)")
    return parser.parse_args()


# ============================================================================
# OSM TAG → CATEGORY MAPPING
# ============================================================================

OSM_TAG_TO_CATEGORY: Dict[str, str] = {
    # Yiyecek & Icecek
    "amenity=restaurant": "restoran-lokanta",
    "amenity=cafe": "kafe-bar",
    "amenity=bar": "kafe-bar",
    "amenity=pub": "kafe-bar",
    "amenity=fast_food": "restoran-lokanta",
    "shop=bakery": "firin-pastane",
    "shop=pastry": "firin-pastane",
    "shop=confectionery": "firin-pastane",
    "shop=butcher": "kasap",
    "shop=deli": "market-bakkal",
    "shop=greengrocer": "manav",
    "shop=seafood": "balikci",
    "shop=supermarket": "market-bakkal",
    "shop=convenience": "market-bakkal",
    # Saglik & Guzellik
    "amenity=pharmacy": "eczane",
    "amenity=hospital": "hastane-klinik",
    "amenity=clinic": "hastane-klinik",
    "amenity=doctors": "doktor-uzman",
    "amenity=dentist": "doktor-uzman",
    "shop=optician": "gozluk",
    "shop=beauty": "guzellik-salonu",
    "shop=cosmetics": "guzellik-salonu",
    "amenity=beauty": "guzellik-salonu",
    "leisure=fitness_centre": "spor-salonu",
    "leisure=spa": "spa-masaj",
    # Hizmetler
    "shop=hairdresser": "kuafor-berber",
    "amenity=hairdresser": "kuafor-berber",
    "shop=barber": "kuafor-berber",
    "amenity=bank": "banka-finans",
    "amenity=atm": "banka-finans",
    "amenity=bureau_de_change": "banka-finans",
    "amenity=post_office": "kargo-kurye",
    "shop=dry_cleaning": "temizlik-hizmeti",
    "shop=laundry": "temizlik-hizmeti",
    "shop=tailor": "terzi",
    "office=estate_agent": "emlak",
    "shop=estate_agent": "emlak",
    "amenity=veterinary": "veteriner",
    "shop=pet": "pet-shop",
    # Moda & Perakende
    "shop=clothes": "giyim-magazasi",
    "shop=shoes": "ayakkabi",
    "shop=jewelry": "saat-taki",
    "shop=watches": "saat-taki",
    "shop=bag": "canta",
    # Teknoloji
    "shop=electronics": "elektronik-magazasi",
    "shop=mobile_phone": "elektronik-magazasi",
    "shop=computer": "elektronik-magazasi",
    # Ev & Yasam
    "shop=furniture": "mobilya-magazasi",
    "shop=hardware": "yapi-market",
    "shop=doityourself": "yapi-market",
    "shop=garden_centre": "bahce",
    # Otomotiv
    "amenity=fuel": "benzin-istasyonu",
    "amenity=car_wash": "oto-yikama",
    "shop=car_repair": "oto-tamir",
    "amenity=car_repair": "oto-tamir",
    "shop=tyres": "lastikci",
    "shop=car": "oto-galeri",
    "amenity=car_rental": "arac-kiralama",
    "amenity=parking": "otopark",
    "shop=car_parts": "yedek-parca",
    # Egitim
    "amenity=school": "okul",
    "amenity=college": "kurs",
    "amenity=university": "okul",
    "amenity=driving_school": "surucu-kursu",
    "amenity=language_school": "kurs",
    "shop=books": "kitap",
    "shop=stationery": "kirtasiye",
    # Eglence
    "amenity=cinema": "sinema",
    "amenity=theatre": "tiyatro",
    "amenity=nightclub": "gece-kulubu",
    "tourism=museum": "muze",
    "leisure=park": "park-lunapark",
    "shop=toys": "oyuncak",
    # Konaklama
    "tourism=hotel": "otel",
    "tourism=hostel": "pansiyon-hostel",
    "tourism=guest_house": "pansiyon-hostel",
    "tourism=motel": "otel",
    "tourism=apartment": "apart-kiralik",
    "shop=travel_agency": "seyahat-acentesi",
    "office=travel_agent": "seyahat-acentesi",
    # Spor
    "leisure=sports_centre": "spor-salonu-tesis",
    "shop=sports": "fitness-ekipmani",
}


# ============================================================================
# TAG GROUPS (8 groups chunked by density)
# ============================================================================

TAG_GROUPS: List[List[str]] = [
    # Group 0: Food venues (densest)
    ["amenity=restaurant", "amenity=cafe", "amenity=fast_food", "amenity=bar", "amenity=pub"],
    # Group 1: Food shops
    ["shop=bakery", "shop=pastry", "shop=confectionery", "shop=butcher", "shop=deli",
     "shop=greengrocer", "shop=seafood", "shop=supermarket", "shop=convenience"],
    # Group 2: Services
    ["shop=hairdresser", "amenity=hairdresser", "shop=barber", "amenity=bank", "amenity=atm",
     "amenity=bureau_de_change", "amenity=post_office", "shop=dry_cleaning", "shop=laundry",
     "shop=tailor", "office=estate_agent", "shop=estate_agent"],
    # Group 3: Health
    ["amenity=pharmacy", "amenity=hospital", "amenity=clinic", "amenity=doctors",
     "amenity=dentist", "shop=optician", "shop=beauty", "shop=cosmetics", "amenity=beauty",
     "leisure=fitness_centre", "leisure=spa"],
    # Group 4a: Retail (fashion + accessories) — split for Overpass limits
    ["shop=clothes", "shop=shoes", "shop=jewelry", "shop=watches", "shop=bag"],
    # Group 5: Retail (electronics)
    ["shop=electronics", "shop=mobile_phone", "shop=computer"],
    # Group 5b: Retail (home + garden)
    ["shop=furniture", "shop=hardware", "shop=doityourself", "shop=garden_centre"],
    # Group 7: Automotive
    ["amenity=fuel", "amenity=car_wash", "shop=car_repair", "amenity=car_repair",
     "shop=tyres", "shop=car", "amenity=car_rental", "amenity=parking", "shop=car_parts"],
    # Group 8: Education + Entertainment
    ["amenity=school", "amenity=college", "amenity=university", "amenity=driving_school",
     "amenity=language_school", "shop=books", "shop=stationery",
     "amenity=cinema", "amenity=theatre", "amenity=nightclub", "tourism=museum", "shop=toys"],
    # Group 9: Accommodation + Leisure
    ["tourism=hotel", "tourism=hostel", "tourism=guest_house", "tourism=motel",
     "tourism=apartment", "shop=travel_agency", "office=travel_agent",
     "leisure=sports_centre", "leisure=park", "shop=sports",
     "amenity=veterinary", "shop=pet"],
]


# ============================================================================
# TURKEY CITIES (81 provinces)
# ============================================================================

TURKEY_CITIES = {
    "01": {"name": "Adana", "lat": 37.0, "lon": 35.3},
    "02": {"name": "Adiyaman", "lat": 37.8, "lon": 38.3},
    "03": {"name": "Afyonkarahisar", "lat": 38.7, "lon": 30.5},
    "04": {"name": "Agri", "lat": 39.7, "lon": 43.1},
    "05": {"name": "Amasya", "lat": 40.7, "lon": 35.8},
    "06": {"name": "Ankara", "lat": 39.9, "lon": 32.9},
    "07": {"name": "Antalya", "lat": 36.9, "lon": 30.7},
    "08": {"name": "Artvin", "lat": 41.2, "lon": 41.8},
    "09": {"name": "Aydin", "lat": 37.8, "lon": 27.8},
    "10": {"name": "Balikesir", "lat": 39.6, "lon": 27.9},
    "11": {"name": "Bilecik", "lat": 40.1, "lon": 30.0},
    "12": {"name": "Bingol", "lat": 39.1, "lon": 40.5},
    "13": {"name": "Bitlis", "lat": 38.4, "lon": 42.1},
    "14": {"name": "Bolu", "lat": 40.7, "lon": 31.6},
    "15": {"name": "Burdur", "lat": 37.7, "lon": 30.3},
    "16": {"name": "Bursa", "lat": 40.2, "lon": 29.0},
    "17": {"name": "Canakkale", "lat": 40.2, "lon": 26.4},
    "18": {"name": "Cankiri", "lat": 40.6, "lon": 33.6},
    "19": {"name": "Corum", "lat": 40.5, "lon": 34.9},
    "20": {"name": "Denizli", "lat": 37.8, "lon": 29.1},
    "21": {"name": "Diyarbakir", "lat": 37.9, "lon": 40.2},
    "22": {"name": "Edirne", "lat": 41.7, "lon": 26.6},
    "23": {"name": "Elazig", "lat": 38.7, "lon": 39.2},
    "24": {"name": "Erzincan", "lat": 39.8, "lon": 39.5},
    "25": {"name": "Erzurum", "lat": 39.9, "lon": 41.3},
    "26": {"name": "Eskisehir", "lat": 39.8, "lon": 30.5},
    "27": {"name": "Gaziantep", "lat": 37.1, "lon": 37.4},
    "28": {"name": "Giresun", "lat": 40.9, "lon": 38.4},
    "29": {"name": "Gumushane", "lat": 40.5, "lon": 39.5},
    "30": {"name": "Hakkari", "lat": 37.6, "lon": 43.7},
    "31": {"name": "Hatay", "lat": 36.2, "lon": 36.2},
    "32": {"name": "Isparta", "lat": 37.8, "lon": 30.6},
    "33": {"name": "Mersin", "lat": 36.8, "lon": 34.6},
    "34": {"name": "Istanbul", "lat": 41.0, "lon": 29.0},
    "35": {"name": "Izmir", "lat": 38.4, "lon": 27.1},
    "36": {"name": "Kars", "lat": 40.6, "lon": 43.1},
    "37": {"name": "Kastamonu", "lat": 41.4, "lon": 33.8},
    "38": {"name": "Kayseri", "lat": 38.7, "lon": 35.5},
    "39": {"name": "Kirklareli", "lat": 41.7, "lon": 27.2},
    "40": {"name": "Kirsehir", "lat": 39.1, "lon": 34.2},
    "41": {"name": "Kocaeli", "lat": 40.8, "lon": 29.9},
    "42": {"name": "Konya", "lat": 37.9, "lon": 32.5},
    "43": {"name": "Kutahya", "lat": 39.4, "lon": 29.9},
    "44": {"name": "Malatya", "lat": 38.4, "lon": 38.3},
    "45": {"name": "Manisa", "lat": 38.6, "lon": 27.4},
    "46": {"name": "Kahramanmaras", "lat": 37.6, "lon": 36.9},
    "47": {"name": "Mardin", "lat": 37.3, "lon": 40.7},
    "48": {"name": "Mugla", "lat": 37.2, "lon": 28.4},
    "49": {"name": "Mus", "lat": 38.7, "lon": 41.5},
    "50": {"name": "Nevsehir", "lat": 38.6, "lon": 34.7},
    "51": {"name": "Nigde", "lat": 38.0, "lon": 34.7},
    "52": {"name": "Ordu", "lat": 41.0, "lon": 37.9},
    "53": {"name": "Rize", "lat": 41.0, "lon": 40.5},
    "54": {"name": "Sakarya", "lat": 40.7, "lon": 30.4},
    "55": {"name": "Samsun", "lat": 41.3, "lon": 36.3},
    "56": {"name": "Siirt", "lat": 37.9, "lon": 42.0},
    "57": {"name": "Sinop", "lat": 42.0, "lon": 35.2},
    "58": {"name": "Sivas", "lat": 39.8, "lon": 37.0},
    "59": {"name": "Tekirdag", "lat": 41.0, "lon": 27.5},
    "60": {"name": "Tokat", "lat": 40.3, "lon": 36.6},
    "61": {"name": "Trabzon", "lat": 41.0, "lon": 39.7},
    "62": {"name": "Tunceli", "lat": 39.1, "lon": 39.5},
    "63": {"name": "Sanliurfa", "lat": 37.2, "lon": 38.8},
    "64": {"name": "Usak", "lat": 38.7, "lon": 29.4},
    "65": {"name": "Van", "lat": 38.5, "lon": 43.4},
    "66": {"name": "Yozgat", "lat": 39.8, "lon": 34.8},
    "67": {"name": "Zonguldak", "lat": 41.5, "lon": 31.8},
    "68": {"name": "Aksaray", "lat": 38.4, "lon": 34.0},
    "69": {"name": "Bayburt", "lat": 40.3, "lon": 40.2},
    "70": {"name": "Karaman", "lat": 37.2, "lon": 33.2},
    "71": {"name": "Kirikkale", "lat": 39.8, "lon": 33.5},
    "72": {"name": "Batman", "lat": 37.9, "lon": 41.1},
    "73": {"name": "Sirnak", "lat": 37.5, "lon": 42.5},
    "74": {"name": "Bartin", "lat": 41.6, "lon": 32.3},
    "75": {"name": "Ardahan", "lat": 41.1, "lon": 42.7},
    "76": {"name": "Igdir", "lat": 39.9, "lon": 44.0},
    "77": {"name": "Yalova", "lat": 40.7, "lon": 29.3},
    "78": {"name": "Karabuk", "lat": 41.2, "lon": 32.6},
    "79": {"name": "Kilis", "lat": 36.7, "lon": 37.1},
    "80": {"name": "Osmaniye", "lat": 37.1, "lon": 36.2},
    "81": {"name": "Duzce", "lat": 40.8, "lon": 31.2},
}


def find_nearest_city(lat: float, lon: float) -> str:
    best_code = "34"
    best_dist = float("inf")
    for code, city in TURKEY_CITIES.items():
        dist = (lat - city["lat"]) ** 2 + (lon - city["lon"]) ** 2
        if dist < best_dist:
            best_dist = dist
            best_code = code
    return best_code


# ============================================================================
# BUSINESS DATA MODEL
# ============================================================================

@dataclass
class Business:
    osm_id: int
    osm_type: str
    name: str
    lat: float
    lon: float
    category_slug: str
    city_code: str
    address: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    opening_hours: Optional[str] = None
    brand_tag: Optional[str] = None
    operator_tag: Optional[str] = None
    wikidata_id: Optional[str] = None
    raw_tags: Dict = field(default_factory=dict)

    @property
    def source_id(self) -> str:
        return f"osm_{self.osm_type}_{self.osm_id}"

    def generate_slug(self) -> str:
        tr_map = {
            'ş': 's', 'Ş': 'S', 'ı': 'i', 'İ': 'I', 'ğ': 'g', 'Ğ': 'G',
            'ü': 'u', 'Ü': 'U', 'ö': 'o', 'Ö': 'O', 'ç': 'c', 'Ç': 'C',
        }
        slug = self.name.lower()
        for tr, en in tr_map.items():
            slug = slug.replace(tr, en)
        slug = re.sub(r'[^a-z0-9\s-]', '', slug)
        slug = re.sub(r'[\s_]+', '-', slug)
        slug = re.sub(r'-+', '-', slug).strip('-')[:50]
        unique = hashlib.md5(f"{self.osm_id}{self.lat}{self.lon}".encode()).hexdigest()[:8]
        return f"{slug}-{unique}"


# ============================================================================
# OVERPASS CLIENT
# ============================================================================

class OverpassClient:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "BilinçTR/2.0 (business-directory; contact@bilinc.app)"
        })

    def query_turkey(self, osm_tags: List[str]) -> List[dict]:
        tag_lines = []
        for tag in osm_tags:
            key, value = tag.split("=", 1)
            tag_lines.append(f'  node["{key}"="{value}"](area.turkey);')
            tag_lines.append(f'  way["{key}"="{value}"](area.turkey);')

        query = f"""[out:json][timeout:{OVERPASS_TIMEOUT}];
area["name"="Türkiye"]->.turkey;
(
{chr(10).join(tag_lines)}
);
out center tags;"""

        for attempt in range(RETRY_MAX):
            try:
                logger.info(f"Overpass query ({len(osm_tags)} tags), attempt {attempt + 1}...")
                resp = self.session.post(
                    OVERPASS_URL,
                    data={"data": query},
                    timeout=OVERPASS_TIMEOUT + 30,
                )
                resp.raise_for_status()
                data = resp.json()
                elements = data.get("elements", [])
                logger.info(f"  Got {len(elements)} elements")
                return elements
            except (requests.RequestException, ValueError) as e:
                if attempt < RETRY_MAX - 1:
                    wait = RETRY_BACKOFF[attempt]
                    logger.warning(f"  Attempt {attempt + 1} failed: {e}. Retrying in {wait}s...")
                    time.sleep(wait)
                else:
                    logger.error(f"  All {RETRY_MAX} attempts failed for tags: {osm_tags}")
                    return []


# ============================================================================
# KNOWN BRANDS — curated Turkish chain/brand database
# ============================================================================
# Each entry: canonical_name -> {name, category_slug, wikidata (optional)}
# Only brands with physical locations in Turkey.
# Categories updated to new Turkish taxonomy slugs.

KNOWN_BRANDS: Dict[str, Dict] = {}


def _build_known_brands() -> Dict[str, Dict]:
    """Build normalized lookup table from raw brand data."""
    raw = {
        # === SUPERMARKETS ===
        "BİM": {"name": "BİM", "slug": "market-bakkal", "wikidata": "Q1022075"},
        "A101": {"name": "A101", "slug": "market-bakkal", "wikidata": "Q6254313"},
        "ŞOK": {"name": "ŞOK", "slug": "market-bakkal", "wikidata": "Q19613092"},
        "Migros": {"name": "Migros", "slug": "market-bakkal", "wikidata": "Q1754510"},
        "CarrefourSA": {"name": "CarrefourSA", "slug": "market-bakkal", "wikidata": "Q3256662"},
        "Carrefour": {"name": "CarrefourSA", "slug": "market-bakkal", "wikidata": "Q3256662"},
        "Metro": {"name": "Metro", "slug": "market-bakkal", "wikidata": "Q13610282"},
        "Hakmar": {"name": "Hakmar", "slug": "market-bakkal"},
        "File": {"name": "File", "slug": "market-bakkal"},
        "Macro Center": {"name": "Macro Center", "slug": "market-bakkal"},
        "Bizim Toptan": {"name": "Bizim Toptan", "slug": "market-bakkal"},

        # === FAST FOOD ===
        "McDonald's": {"name": "McDonald's", "slug": "restoran-lokanta", "wikidata": "Q38076"},
        "Burger King": {"name": "Burger King", "slug": "restoran-lokanta", "wikidata": "Q177054"},
        "KFC": {"name": "KFC", "slug": "restoran-lokanta", "wikidata": "Q524757"},
        "Popeyes": {"name": "Popeyes", "slug": "restoran-lokanta", "wikidata": "Q2349353"},
        "Domino's": {"name": "Domino's", "slug": "restoran-lokanta", "wikidata": "Q839466"},
        "Domino's Pizza": {"name": "Domino's", "slug": "restoran-lokanta", "wikidata": "Q839466"},
        "Little Caesars": {"name": "Little Caesars", "slug": "restoran-lokanta", "wikidata": "Q1393809"},
        "Sbarro": {"name": "Sbarro", "slug": "restoran-lokanta", "wikidata": "Q2589409"},
        "Subway": {"name": "Subway", "slug": "restoran-lokanta", "wikidata": "Q244457"},
        "Papa John's": {"name": "Papa John's", "slug": "restoran-lokanta", "wikidata": "Q2759586"},
        "Pizza Hut": {"name": "Pizza Hut", "slug": "restoran-lokanta", "wikidata": "Q191615"},
        "Arby's": {"name": "Arby's", "slug": "restoran-lokanta", "wikidata": "Q630866"},

        # Turkish Fast Food
        "Simit Sarayı": {"name": "Simit Sarayı", "slug": "firin-pastane", "wikidata": "Q3485994"},
        "Köfteci Yusuf": {"name": "Köfteci Yusuf", "slug": "restoran-lokanta"},
        "Tavuk Dünyası": {"name": "Tavuk Dünyası", "slug": "restoran-lokanta"},
        "Usta Dönerci": {"name": "Usta Dönerci", "slug": "restoran-lokanta"},
        "Baydöner": {"name": "Baydöner", "slug": "restoran-lokanta"},
        "Dönerci Şahin Usta": {"name": "Dönerci Şahin Usta", "slug": "restoran-lokanta"},

        # === CAFES ===
        "Starbucks": {"name": "Starbucks", "slug": "kafe-bar", "wikidata": "Q37158"},
        "Kahve Dünyası": {"name": "Kahve Dünyası", "slug": "kafe-bar", "wikidata": "Q27979858"},
        "Caribou Coffee": {"name": "Caribou Coffee", "slug": "kafe-bar", "wikidata": "Q5039494"},
        "Gloria Jean's Coffees": {"name": "Gloria Jean's", "slug": "kafe-bar", "wikidata": "Q2666313"},
        "Gloria Jean's": {"name": "Gloria Jean's", "slug": "kafe-bar", "wikidata": "Q2666313"},
        "Espresso Lab": {"name": "Espresso Lab", "slug": "kafe-bar"},
        "Tchibo": {"name": "Tchibo", "slug": "kafe-bar", "wikidata": "Q564213"},
        "Costa Coffee": {"name": "Costa Coffee", "slug": "kafe-bar", "wikidata": "Q608845"},
        "Caffè Nero": {"name": "Caffè Nero", "slug": "kafe-bar", "wikidata": "Q5765670"},

        # === GAS STATIONS ===
        "Shell": {"name": "Shell", "slug": "benzin-istasyonu", "wikidata": "Q154950"},
        "BP": {"name": "BP", "slug": "benzin-istasyonu", "wikidata": "Q152057"},
        "Opet": {"name": "Opet", "slug": "benzin-istasyonu", "wikidata": "Q7096951"},
        "OPET": {"name": "Opet", "slug": "benzin-istasyonu", "wikidata": "Q7096951"},
        "Petrol Ofisi": {"name": "Petrol Ofisi", "slug": "benzin-istasyonu", "wikidata": "Q1278087"},
        "PO": {"name": "Petrol Ofisi", "slug": "benzin-istasyonu", "wikidata": "Q1278087"},
        "Total": {"name": "Total", "slug": "benzin-istasyonu", "wikidata": "Q154037"},
        "TotalEnergies": {"name": "Total", "slug": "benzin-istasyonu", "wikidata": "Q154037"},
        "Aytemiz": {"name": "Aytemiz", "slug": "benzin-istasyonu"},
        "Lukoil": {"name": "Lukoil", "slug": "benzin-istasyonu", "wikidata": "Q329347"},
        "LUKOIL": {"name": "Lukoil", "slug": "benzin-istasyonu", "wikidata": "Q329347"},
        "Türkiye Petrolleri": {"name": "Türkiye Petrolleri", "slug": "benzin-istasyonu"},
        "TP": {"name": "Türkiye Petrolleri", "slug": "benzin-istasyonu"},
        "GO": {"name": "GO", "slug": "benzin-istasyonu"},
        "Alpet": {"name": "Alpet", "slug": "benzin-istasyonu"},
        "Moil": {"name": "Moil", "slug": "benzin-istasyonu"},

        # === BANKS ===
        "Ziraat Bankası": {"name": "Ziraat Bankası", "slug": "banka-finans", "wikidata": "Q696003"},
        "T.C. Ziraat Bankası": {"name": "Ziraat Bankası", "slug": "banka-finans", "wikidata": "Q696003"},
        "İş Bankası": {"name": "Türkiye İş Bankası", "slug": "banka-finans", "wikidata": "Q909613"},
        "Türkiye İş Bankası": {"name": "Türkiye İş Bankası", "slug": "banka-finans", "wikidata": "Q909613"},
        "Garanti BBVA": {"name": "Garanti BBVA", "slug": "banka-finans", "wikidata": "Q1494005"},
        "Garanti Bankası": {"name": "Garanti BBVA", "slug": "banka-finans", "wikidata": "Q1494005"},
        "Akbank": {"name": "Akbank", "slug": "banka-finans", "wikidata": "Q2634170"},
        "Yapı Kredi": {"name": "Yapı Kredi", "slug": "banka-finans", "wikidata": "Q8049438"},
        "Yapı ve Kredi Bankası": {"name": "Yapı Kredi", "slug": "banka-finans", "wikidata": "Q8049438"},
        "Halkbank": {"name": "Halkbank", "slug": "banka-finans", "wikidata": "Q3593818"},
        "Türkiye Halk Bankası": {"name": "Halkbank", "slug": "banka-finans", "wikidata": "Q3593818"},
        "VakıfBank": {"name": "VakıfBank", "slug": "banka-finans", "wikidata": "Q1148521"},
        "Vakıfbank": {"name": "VakıfBank", "slug": "banka-finans", "wikidata": "Q1148521"},
        "QNB Finansbank": {"name": "QNB Finansbank", "slug": "banka-finans", "wikidata": "Q3374950"},
        "Finansbank": {"name": "QNB Finansbank", "slug": "banka-finans", "wikidata": "Q3374950"},
        "Denizbank": {"name": "Denizbank", "slug": "banka-finans", "wikidata": "Q1187686"},
        "DenizBank": {"name": "Denizbank", "slug": "banka-finans", "wikidata": "Q1187686"},
        "TEB": {"name": "TEB", "slug": "banka-finans", "wikidata": "Q7862447"},
        "Türk Ekonomi Bankası": {"name": "TEB", "slug": "banka-finans", "wikidata": "Q7862447"},
        "ING": {"name": "ING", "slug": "banka-finans", "wikidata": "Q645708"},
        "HSBC": {"name": "HSBC", "slug": "banka-finans", "wikidata": "Q190464"},
        "PTT": {"name": "PTT", "slug": "kargo-kurye", "wikidata": "Q1809344"},
        "Kuveyt Türk": {"name": "Kuveyt Türk", "slug": "banka-finans", "wikidata": "Q6450925"},
        "Albaraka Türk": {"name": "Albaraka Türk", "slug": "banka-finans"},
        "Şekerbank": {"name": "Şekerbank", "slug": "banka-finans", "wikidata": "Q7828399"},

        # === TELECOM ===
        "Turkcell": {"name": "Turkcell", "slug": "elektronik-magazasi", "wikidata": "Q283852"},
        "Vodafone": {"name": "Vodafone", "slug": "elektronik-magazasi", "wikidata": "Q122141"},
        "Türk Telekom": {"name": "Türk Telekom", "slug": "elektronik-magazasi", "wikidata": "Q1115672"},

        # === ELECTRONICS ===
        "MediaMarkt": {"name": "MediaMarkt", "slug": "elektronik-magazasi", "wikidata": "Q2381223"},
        "Media Markt": {"name": "MediaMarkt", "slug": "elektronik-magazasi", "wikidata": "Q2381223"},
        "Teknosa": {"name": "Teknosa", "slug": "elektronik-magazasi", "wikidata": "Q3516859"},
        "Vatan Bilgisayar": {"name": "Vatan Bilgisayar", "slug": "elektronik-magazasi"},

        # === CLOTHING ===
        "LC Waikiki": {"name": "LC Waikiki", "slug": "giyim-magazasi", "wikidata": "Q3261055"},
        "DeFacto": {"name": "DeFacto", "slug": "giyim-magazasi", "wikidata": "Q5765862"},
        "Koton": {"name": "Koton", "slug": "giyim-magazasi", "wikidata": "Q6433629"},
        "Mavi": {"name": "Mavi", "slug": "giyim-magazasi", "wikidata": "Q6793571"},
        "Mavi Jeans": {"name": "Mavi", "slug": "giyim-magazasi", "wikidata": "Q6793571"},
        "Colin's": {"name": "Colin's", "slug": "giyim-magazasi"},
        "Zara": {"name": "Zara", "slug": "giyim-magazasi", "wikidata": "Q147662"},
        "H&M": {"name": "H&M", "slug": "giyim-magazasi", "wikidata": "Q188326"},
        "Bershka": {"name": "Bershka", "slug": "giyim-magazasi", "wikidata": "Q827258"},
        "Pull&Bear": {"name": "Pull&Bear", "slug": "giyim-magazasi", "wikidata": "Q3408218"},
        "Boyner": {"name": "Boyner", "slug": "giyim-magazasi", "wikidata": "Q4951718"},
        "YKM": {"name": "YKM", "slug": "giyim-magazasi"},
        "Mango": {"name": "Mango", "slug": "giyim-magazasi", "wikidata": "Q136503"},
        "FLO": {"name": "FLO", "slug": "ayakkabi"},
        "Kiğılı": {"name": "Kiğılı", "slug": "giyim-magazasi"},
        "Vakko": {"name": "Vakko", "slug": "giyim-magazasi", "wikidata": "Q7910840"},
        "Adidas": {"name": "Adidas", "slug": "spor-giyim", "wikidata": "Q3895"},
        "Nike": {"name": "Nike", "slug": "spor-giyim", "wikidata": "Q483915"},
        "Puma": {"name": "Puma", "slug": "spor-giyim", "wikidata": "Q157064"},
        "Decathlon": {"name": "Decathlon", "slug": "spor-giyim", "wikidata": "Q509349"},
        "Intersport": {"name": "Intersport", "slug": "spor-giyim", "wikidata": "Q666888"},

        # === HEALTH & BEAUTY ===
        "Gratis": {"name": "Gratis", "slug": "guzellik-salonu"},
        "Watsons": {"name": "Watsons", "slug": "guzellik-salonu", "wikidata": "Q7974737"},
        "Rossmann": {"name": "Rossmann", "slug": "guzellik-salonu", "wikidata": "Q316004"},
        "Sephora": {"name": "Sephora", "slug": "guzellik-salonu", "wikidata": "Q2408041"},

        # === HOME / FURNITURE ===
        "IKEA": {"name": "IKEA", "slug": "mobilya-magazasi", "wikidata": "Q54078"},
        "Koçtaş": {"name": "Koçtaş", "slug": "yapi-market", "wikidata": "Q6430953"},
        "Bauhaus": {"name": "Bauhaus", "slug": "yapi-market", "wikidata": "Q672043"},
        "Bellona": {"name": "Bellona", "slug": "mobilya-magazasi"},
        "İstikbal": {"name": "İstikbal", "slug": "mobilya-magazasi"},
        "Tekzen": {"name": "Tekzen", "slug": "yapi-market"},

        # === HOTELS ===
        "Hilton": {"name": "Hilton", "slug": "otel", "wikidata": "Q598884"},
        "Marriott": {"name": "Marriott", "slug": "otel", "wikidata": "Q1141173"},
        "Radisson": {"name": "Radisson", "slug": "otel", "wikidata": "Q1751077"},
        "Holiday Inn": {"name": "Holiday Inn", "slug": "otel", "wikidata": "Q1624410"},
        "Ibis": {"name": "Ibis", "slug": "otel", "wikidata": "Q920166"},
        "Wyndham": {"name": "Wyndham", "slug": "otel", "wikidata": "Q969799"},
        "Dedeman": {"name": "Dedeman", "slug": "otel"},
        "Rixos": {"name": "Rixos", "slug": "otel"},

        # === COURIER ===
        "Yurtiçi Kargo": {"name": "Yurtiçi Kargo", "slug": "kargo-kurye", "wikidata": "Q8061430"},
        "Aras Kargo": {"name": "Aras Kargo", "slug": "kargo-kurye"},
        "MNG Kargo": {"name": "MNG Kargo", "slug": "kargo-kurye"},
        "Sürat Kargo": {"name": "Sürat Kargo", "slug": "kargo-kurye"},
        "UPS": {"name": "UPS", "slug": "kargo-kurye", "wikidata": "Q155026"},
        "DHL": {"name": "DHL", "slug": "kargo-kurye", "wikidata": "Q489815"},
        "FedEx": {"name": "FedEx", "slug": "kargo-kurye", "wikidata": "Q459477"},
        "Trendyol Express": {"name": "Trendyol Express", "slug": "kargo-kurye"},
        "Getir": {"name": "Getir", "slug": "kargo-kurye", "wikidata": "Q65067653"},

        # === CAR RENTAL ===
        "Avis": {"name": "Avis", "slug": "arac-kiralama", "wikidata": "Q791136"},
        "Hertz": {"name": "Hertz", "slug": "arac-kiralama", "wikidata": "Q1543874"},
        "Europcar": {"name": "Europcar", "slug": "arac-kiralama", "wikidata": "Q1376256"},
        "Budget": {"name": "Budget", "slug": "arac-kiralama", "wikidata": "Q1001437"},
        "Enterprise": {"name": "Enterprise", "slug": "arac-kiralama", "wikidata": "Q1337374"},

        # === PHARMACY ===
        "Dr. Ecza Deposu": {"name": "Dr. Ecza Deposu", "slug": "eczane"},
    }

    # Build normalized lookup (lowercase + stripped)
    brands = {}
    for original, info in raw.items():
        normalized = original.lower().strip()
        brands[normalized] = info
        # Also add without diacritics for fuzzy matching
        ascii_key = normalized
        for tr, en in [('ş','s'),('ı','i'),('ğ','g'),('ü','u'),('ö','o'),('ç','c')]:
            ascii_key = ascii_key.replace(tr, en)
        if ascii_key != normalized:
            brands[ascii_key] = info
        # Wikidata key
        if "wikidata" in info:
            brands[f"wd:{info['wikidata']}"] = info

    return brands


KNOWN_BRANDS = _build_known_brands()


# ============================================================================
# BRAND RESOLUTION
# ============================================================================

@dataclass
class BrandMatch:
    """Result of brand resolution for a single business."""
    canonical_name: str
    category_slug: str  # brand's category (may differ from OSM tag category)
    wikidata_id: Optional[str] = None
    tier: int = 0  # 1=known, 2=wikidata, 3=frequency
    raw_value: str = ""  # original OSM tag value


class BrandResolver:
    """3-tier brand resolution: known brands -> wikidata -> frequency analysis."""

    def __init__(self):
        # Frequency tracking for unknown brands
        # brand_name -> {cities: set(), count: int}
        self.unknown_brands: Dict[str, Dict] = defaultdict(
            lambda: {"cities": set(), "count": 0, "wikidata": None, "raw": ""}
        )
        self.stats = {
            "tier1_known": 0,
            "tier2_wikidata": 0,
            "tier3_frequency": 0,
            "unresolved": 0,
        }

    def resolve(self, business: Business) -> Optional[BrandMatch]:
        """Try to resolve the brand for a business.
        Returns BrandMatch if resolved via Tier 1 or 2.
        For Tier 3, just records frequency -- call analyze_unknown() after all data is processed.
        """
        brand_value = business.brand_tag or business.operator_tag
        if not brand_value:
            return None

        normalized = brand_value.lower().strip()

        # --- Tier 1: Known brands by name ---
        if normalized in KNOWN_BRANDS:
            info = KNOWN_BRANDS[normalized]
            self.stats["tier1_known"] += 1
            return BrandMatch(
                canonical_name=info["name"],
                category_slug=info["slug"],
                wikidata_id=info.get("wikidata"),
                tier=1,
                raw_value=brand_value,
            )

        # ASCII fallback
        ascii_key = normalized
        for tr, en in [('ş','s'),('ı','i'),('ğ','g'),('ü','u'),('ö','o'),('ç','c')]:
            ascii_key = ascii_key.replace(tr, en)
        if ascii_key in KNOWN_BRANDS:
            info = KNOWN_BRANDS[ascii_key]
            self.stats["tier1_known"] += 1
            return BrandMatch(
                canonical_name=info["name"],
                category_slug=info["slug"],
                wikidata_id=info.get("wikidata"),
                tier=1,
                raw_value=brand_value,
            )

        # --- Tier 2: Wikidata ID from OSM tags ---
        if business.wikidata_id:
            wd_key = f"wd:{business.wikidata_id}"
            if wd_key in KNOWN_BRANDS:
                info = KNOWN_BRANDS[wd_key]
                self.stats["tier1_known"] += 1  # known via wikidata
                return BrandMatch(
                    canonical_name=info["name"],
                    category_slug=info["slug"],
                    wikidata_id=business.wikidata_id,
                    tier=1,
                    raw_value=brand_value,
                )
            # Unknown brand but has wikidata -- trust it
            self.stats["tier2_wikidata"] += 1
            return BrandMatch(
                canonical_name=brand_value.strip(),
                category_slug=business.category_slug,  # keep OSM category
                wikidata_id=business.wikidata_id,
                tier=2,
                raw_value=brand_value,
            )

        # --- Tier 3: Record for frequency analysis ---
        entry = self.unknown_brands[normalized]
        entry["cities"].add(business.city_code)
        entry["count"] += 1
        entry["raw"] = brand_value.strip()
        return None

    def get_discovered_brands(self) -> List[BrandMatch]:
        """After all data is processed, analyze frequency table.
        Returns brands with 3+ occurrences across 2+ cities."""
        discovered = []
        for normalized, entry in self.unknown_brands.items():
            if entry["count"] >= 3 and len(entry["cities"]) >= 2:
                discovered.append(BrandMatch(
                    canonical_name=entry["raw"],
                    category_slug="",  # will be set from most common category
                    tier=3,
                    raw_value=entry["raw"],
                ))
                self.stats["tier3_frequency"] += 1
            else:
                self.stats["unresolved"] += 1
        return discovered

    def print_stats(self):
        logger.info("Brand resolution stats:")
        logger.info(f"  Tier 1 (known):     {self.stats['tier1_known']}")
        logger.info(f"  Tier 2 (wikidata):  {self.stats['tier2_wikidata']}")
        logger.info(f"  Tier 3 (frequency): {self.stats['tier3_frequency']}")
        logger.info(f"  Unresolved:         {self.stats['unresolved']}")
        logger.info(f"  Unknown brands tracked: {len(self.unknown_brands)}")

        # Log top unknown brands for manual review
        top_unknown = sorted(
            self.unknown_brands.items(),
            key=lambda x: x[1]["count"],
            reverse=True,
        )[:20]
        if top_unknown:
            logger.info("Top 20 unknown brands (for manual review):")
            for name, entry in top_unknown:
                cities = len(entry["cities"])
                logger.info(f"    {entry['raw']:30s}  count={entry['count']:4d}  cities={cities}")


# ============================================================================
# ELEMENT PROCESSOR
# ============================================================================

def process_elements(
    elements: List[dict],
    osm_tags: List[str],
    seen_ids: set,
) -> List[Business]:
    """Convert raw Overpass elements into Business objects.
    Deduplicates by OSM ID. Skips unnamed elements."""
    businesses = []

    for el in elements:
        osm_id = el.get("id")
        if not osm_id or osm_id in seen_ids:
            continue

        tags = el.get("tags", {})
        name = tags.get("name") or tags.get("name:tr") or tags.get("name:en")
        if not name or len(name.strip()) < 2:
            continue

        # Coordinates
        if el["type"] == "node":
            lat = el.get("lat")
            lon = el.get("lon")
        else:
            lat = el.get("center", {}).get("lat")
            lon = el.get("center", {}).get("lon")
        if not lat or not lon:
            continue

        # Determine which OSM tag matched
        category_slug = None
        for tag_str in osm_tags:
            key, value = tag_str.split("=", 1)
            if tags.get(key) == value:
                category_slug = OSM_TAG_TO_CATEGORY.get(tag_str)
                break
        if not category_slug:
            continue

        # Build address
        addr_parts = []
        if tags.get("addr:street"):
            street = tags["addr:street"]
            if tags.get("addr:housenumber"):
                street = f"{street} {tags['addr:housenumber']}"
            addr_parts.append(street)
        if tags.get("addr:district"):
            addr_parts.append(tags["addr:district"])

        city_code = find_nearest_city(lat, lon)

        seen_ids.add(osm_id)
        businesses.append(Business(
            osm_id=osm_id,
            osm_type=el["type"],
            name=name.strip(),
            lat=round(lat, 6),
            lon=round(lon, 6),
            category_slug=category_slug,
            city_code=city_code,
            address=", ".join(addr_parts) if addr_parts else None,
            phone=tags.get("phone") or tags.get("contact:phone"),
            website=tags.get("website") or tags.get("contact:website"),
            opening_hours=tags.get("opening_hours"),
            brand_tag=tags.get("brand"),
            operator_tag=tags.get("operator"),
            wikidata_id=tags.get("brand:wikidata") or tags.get("operator:wikidata"),
            raw_tags=tags,
        ))

    return businesses


# ============================================================================
# SUPABASE INSERTER
# ============================================================================

class SupabaseInserter:
    """Bulk insert businesses into Supabase."""

    def __init__(self):
        from supabase import create_client
        self.client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        self.category_cache: Dict[str, str] = {}  # slug -> uuid
        self._load_categories()

    def _load_categories(self):
        resp = self.client.table("categories").select("id, slug").execute()
        self.category_cache = {row["slug"]: row["id"] for row in resp.data}
        logger.info(f"Loaded {len(self.category_cache)} categories from DB")

    def insert_businesses(self, businesses: List[Business]) -> int:
        """Batch upsert businesses and link categories. Returns count inserted."""
        total = 0

        for i in range(0, len(businesses), BATCH_SIZE):
            batch = businesses[i:i + BATCH_SIZE]
            listings = []
            for biz in batch:
                listings.append({
                    "slug": biz.generate_slug(),
                    "name": biz.name,
                    "description": None,
                    "entity_type": "business",
                    "status": "active",
                    "city_code": biz.city_code,
                    "address_line": biz.address,
                    "latitude": biz.lat,
                    "longitude": biz.lon,
                    "source": "openstreetmap",
                    "source_id": biz.source_id,
                })

            try:
                resp = self.client.table("listings").upsert(
                    listings, on_conflict="source_id"
                ).execute()
                inserted = resp.data
                total += len(inserted)

                # Link categories
                cat_links = []
                for row in inserted:
                    # Find original business by source_id
                    src_id = row["source_id"]
                    biz = next((b for b in batch if b.source_id == src_id), None)
                    if not biz:
                        continue
                    cat_id = self.category_cache.get(biz.category_slug)
                    if cat_id:
                        cat_links.append({
                            "listing_id": row["id"],
                            "category_id": cat_id,
                            "is_primary": True,
                        })

                if cat_links:
                    self.client.table("listing_categories").upsert(
                        cat_links, on_conflict="listing_id,category_id"
                    ).execute()

            except Exception as e:
                logger.error(f"Batch insert error at offset {i}: {e}")

            if (i + BATCH_SIZE) % 2000 == 0:
                logger.info(f"  Inserted {total} listings so far...")

        return total

    def create_brand_parents(
        self, brands: List[BrandMatch], brand_businesses: Dict[str, List[Business]]
    ) -> Dict[str, str]:
        """Create parent listings for resolved brands.
        Returns mapping: canonical_name -> listing_id."""
        import uuid as uuid_mod

        parent_ids: Dict[str, str] = {}

        for brand in brands:
            name_key = brand.canonical_name.lower().strip()
            det_id = str(uuid_mod.uuid5(uuid_mod.NAMESPACE_DNS, f"brand-{name_key}"))

            # Determine category from brand match or most common among branches
            cat_slug = brand.category_slug
            if not cat_slug and name_key in brand_businesses:
                # Find most common category among branches
                from collections import Counter
                slugs = [b.category_slug for b in brand_businesses[name_key]]
                cat_slug = Counter(slugs).most_common(1)[0][0] if slugs else None

            slug = re.sub(r'[^a-z0-9\s-]', '', name_key)
            slug = re.sub(r'[\s_]+', '-', slug).strip('-')[:50]
            slug = f"{slug}-company" if slug else f"brand-{det_id[:8]}"

            parent_data = {
                "id": det_id,
                "slug": slug,
                "name": brand.canonical_name,
                "entity_type": "business",
                "status": "active" if brand.tier <= 2 else "pending",
            }

            try:
                self.client.table("listings").upsert(
                    [parent_data], on_conflict="id"
                ).execute()
                parent_ids[name_key] = det_id

                # Link category
                cat_id = self.category_cache.get(cat_slug) if cat_slug else None
                if cat_id:
                    self.client.table("listing_categories").upsert([{
                        "listing_id": det_id,
                        "category_id": cat_id,
                        "is_primary": True,
                    }], on_conflict="listing_id,category_id").execute()

            except Exception as e:
                logger.error(f"Error creating brand parent '{brand.canonical_name}': {e}")

        logger.info(f"Created {len(parent_ids)} brand parent listings")
        return parent_ids

    def link_branches_to_parents(
        self, businesses: List[Business], parent_ids: Dict[str, str]
    ):
        """Update parent_id on branch listings to link to their brand parent."""
        updates = []
        for biz in businesses:
            brand_name = biz.brand_tag or biz.operator_tag
            if not brand_name:
                continue
            key = brand_name.lower().strip()
            parent_id = parent_ids.get(key)
            if not parent_id:
                continue
            updates.append({"source_id": biz.source_id, "parent_id": parent_id})

        # Batch update
        for i in range(0, len(updates), BATCH_SIZE):
            batch = updates[i:i + BATCH_SIZE]
            for upd in batch:
                try:
                    self.client.table("listings").update(
                        {"parent_id": upd["parent_id"]}
                    ).eq("source_id", upd["source_id"]).execute()
                except Exception as e:
                    logger.debug(f"Parent link error: {e}")

        logger.info(f"Linked {len(updates)} branches to parent brands")

    def refresh_views(self):
        """Refresh materialized views."""
        try:
            self.client.rpc("refresh_materialized_views").execute()
            logger.info("Materialized views refreshed")
        except Exception as e:
            logger.warning(f"View refresh error (run manually if needed): {e}")


# ============================================================================
# MAIN ORCHESTRATOR
# ============================================================================

def run(args):
    dry_run = not args.execute
    mode = "DRY RUN" if dry_run else "LIVE"

    logger.info("=" * 60)
    logger.info(f"OSM Scraper v2 — Turkey ({mode})")
    logger.info("=" * 60)

    overpass = OverpassClient()
    resolver = BrandResolver()
    seen_ids: set = set()
    all_businesses: List[Business] = []

    # Determine which tag groups to run
    if args.tag_group is not None:
        if 0 <= args.tag_group < len(TAG_GROUPS):
            groups_to_run = [(args.tag_group, TAG_GROUPS[args.tag_group])]
        else:
            logger.error(f"Invalid tag group: {args.tag_group}. Valid: 0-{len(TAG_GROUPS)-1}")
            return
    else:
        groups_to_run = list(enumerate(TAG_GROUPS))

    # --- Phase 1: Fetch from Overpass ---
    logger.info(f"Phase 1: Fetching {len(groups_to_run)} tag groups from Overpass...")

    for group_idx, tags in groups_to_run:
        logger.info(f"\nGroup {group_idx}: {len(tags)} tags")
        elements = overpass.query_turkey(tags)
        businesses = process_elements(elements, tags, seen_ids)
        all_businesses.extend(businesses)
        logger.info(f"  Processed: {len(businesses)} businesses (total: {len(all_businesses)})")

        if group_idx < len(TAG_GROUPS) - 1:
            logger.info(f"  Waiting {REQUEST_DELAY}s...")
            time.sleep(REQUEST_DELAY)

    logger.info(f"\nPhase 1 complete: {len(all_businesses)} total businesses")

    # --- Phase 2: Brand resolution ---
    logger.info("\nPhase 2: Resolving brands...")

    brand_matches: Dict[str, BrandMatch] = {}  # source_id -> match
    brand_businesses: Dict[str, List[Business]] = defaultdict(list)  # brand_name -> businesses

    for biz in all_businesses:
        match = resolver.resolve(biz)
        if match:
            brand_matches[biz.source_id] = match
            brand_businesses[match.canonical_name.lower().strip()].append(biz)

    # Frequency analysis for tier 3
    discovered = resolver.get_discovered_brands()
    # Collect businesses for discovered brands
    for brand in discovered:
        key = brand.raw_value.lower().strip()
        if key in resolver.unknown_brands:
            for biz in all_businesses:
                tag_val = (biz.brand_tag or biz.operator_tag or "").lower().strip()
                if tag_val == key:
                    brand_businesses[brand.canonical_name.lower().strip()].append(biz)

    resolver.print_stats()

    # --- Stats ---
    by_city: Dict[str, int] = defaultdict(int)
    by_category: Dict[str, int] = defaultdict(int)
    for biz in all_businesses:
        by_city[biz.city_code] += 1
        by_category[biz.category_slug] += 1

    logger.info("\n" + "=" * 50)
    logger.info("STATISTICS")
    logger.info("=" * 50)
    logger.info(f"Total businesses: {len(all_businesses)}")
    logger.info(f"Unique OSM IDs: {len(seen_ids)}")
    logger.info(f"Brands resolved: {len(brand_matches)}")
    logger.info(f"Brands discovered (tier 3): {len(discovered)}")

    logger.info(f"\nTop 15 cities:")
    for code, count in sorted(by_city.items(), key=lambda x: x[1], reverse=True)[:15]:
        city_name = TURKEY_CITIES.get(code, {}).get("name", code)
        logger.info(f"  {city_name:20s} {count:6d}")

    logger.info(f"\nBy category:")
    for slug, count in sorted(by_category.items(), key=lambda x: x[1], reverse=True):
        logger.info(f"  {slug:30s} {count:6d}")

    # --- Phase 3: Insert to Supabase ---
    if dry_run:
        logger.info("\nDRY RUN — no database changes made.")
        logger.info("Run with --execute to insert data.")
        return

    logger.info("\nPhase 3: Inserting to Supabase...")

    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        logger.error("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in py/.env")
        return

    inserter = SupabaseInserter()

    # Insert businesses
    count = inserter.insert_businesses(all_businesses)
    logger.info(f"Inserted {count} listings")

    # Collect all brand matches (tier 1 + 2 + 3)
    all_brand_matches: List[BrandMatch] = []
    seen_brand_names: set = set()

    for match in brand_matches.values():
        key = match.canonical_name.lower().strip()
        if key not in seen_brand_names:
            all_brand_matches.append(match)
            seen_brand_names.add(key)

    for brand in discovered:
        key = brand.canonical_name.lower().strip()
        if key not in seen_brand_names:
            all_brand_matches.append(brand)
            seen_brand_names.add(key)

    # Create brand parents & link branches
    if all_brand_matches:
        parent_ids = inserter.create_brand_parents(all_brand_matches, brand_businesses)
        inserter.link_branches_to_parents(all_businesses, parent_ids)

    # Refresh views
    inserter.refresh_views()

    logger.info("\n" + "=" * 60)
    logger.info("SCRAPE COMPLETE")
    logger.info("=" * 60)


# ============================================================================
# ENTRY POINT
# ============================================================================

if __name__ == "__main__":
    args = parse_args()
    run(args)
