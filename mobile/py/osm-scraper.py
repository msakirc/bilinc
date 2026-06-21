
#!/usr/bin/env python3
"""
Turkey Business Scraper - Using OpenStreetMap (100% Free, Legal)
Collects business data from OSM and inserts into Supabase
"""
'''
import os
import re
import time
import json
import hashlib
import logging
from datetime import datetime
from typing import Optional
from dataclasses import dataclass
import requests
from supabase import create_client, Client

# ============================================================================
# CONFIGURATION
# ============================================================================

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")


OVERPASS_URL = "https://overpass-api.de/api/interpreter"
# Alternative mirrors (if main is slow):
# "https://lz4.overpass-api.de/api/interpreter"
# "https://z.overpass-api.de/api/interpreter"

# Rate limiting (be nice to free servers)
REQUEST_DELAY = 10  # seconds between requests
BATCH_SIZE = 100    # records per insert batch

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================================================
# TURKEY CITIES (81 provinces with codes)
# ============================================================================

TURKEY_CITIES = {
    "01": {"name": "Adana", "lat": 37.0, "lon": 35.3},
    "02": {"name": "Adıyaman", "lat": 37.8, "lon": 38.3},
    "03": {"name": "Afyonkarahisar", "lat": 38.7, "lon": 30.5},
    "04": {"name": "Ağrı", "lat": 39.7, "lon": 43.1},
    "05": {"name": "Amasya", "lat": 40.7, "lon": 35.8},
    "06": {"name": "Ankara", "lat": 39.9, "lon": 32.9},
    "07": {"name": "Antalya", "lat": 36.9, "lon": 30.7},
    "08": {"name": "Artvin", "lat": 41.2, "lon": 41.8},
    "09": {"name": "Aydın", "lat": 37.8, "lon": 27.8},
    "10": {"name": "Balıkesir", "lat": 39.6, "lon": 27.9},
    "11": {"name": "Bilecik", "lat": 40.1, "lon": 30.0},
    "12": {"name": "Bingöl", "lat": 39.1, "lon": 40.5},
    "13": {"name": "Bitlis", "lat": 38.4, "lon": 42.1},
    "14": {"name": "Bolu", "lat": 40.7, "lon": 31.6},
    "15": {"name": "Burdur", "lat": 37.7, "lon": 30.3},
    "16": {"name": "Bursa", "lat": 40.2, "lon": 29.0},
    "17": {"name": "Çanakkale", "lat": 40.2, "lon": 26.4},
    "18": {"name": "Çankırı", "lat": 40.6, "lon": 33.6},
    "19": {"name": "Çorum", "lat": 40.5, "lon": 34.9},
    "20": {"name": "Denizli", "lat": 37.8, "lon": 29.1},
    "21": {"name": "Diyarbakır", "lat": 37.9, "lon": 40.2},
    "22": {"name": "Edirne", "lat": 41.7, "lon": 26.6},
    "23": {"name": "Elazığ", "lat": 38.7, "lon": 39.2},
    "24": {"name": "Erzincan", "lat": 39.8, "lon": 39.5},
    "25": {"name": "Erzurum", "lat": 39.9, "lon": 41.3},
    "26": {"name": "Eskişehir", "lat": 39.8, "lon": 30.5},
    "27": {"name": "Gaziantep", "lat": 37.1, "lon": 37.4},
    "28": {"name": "Giresun", "lat": 40.9, "lon": 38.4},
    "29": {"name": "Gümüşhane", "lat": 40.5, "lon": 39.5},
    "30": {"name": "Hakkari", "lat": 37.6, "lon": 43.7},
    "31": {"name": "Hatay", "lat": 36.2, "lon": 36.2},
    "32": {"name": "Isparta", "lat": 37.8, "lon": 30.6},
    "33": {"name": "Mersin", "lat": 36.8, "lon": 34.6},
    "34": {"name": "İstanbul", "lat": 41.0, "lon": 29.0},
    "35": {"name": "İzmir", "lat": 38.4, "lon": 27.1},
    "36": {"name": "Kars", "lat": 40.6, "lon": 43.1},
    "37": {"name": "Kastamonu", "lat": 41.4, "lon": 33.8},
    "38": {"name": "Kayseri", "lat": 38.7, "lon": 35.5},
    "39": {"name": "Kırklareli", "lat": 41.7, "lon": 27.2},
    "40": {"name": "Kırşehir", "lat": 39.1, "lon": 34.2},
    "41": {"name": "Kocaeli", "lat": 40.8, "lon": 29.9},
    "42": {"name": "Konya", "lat": 37.9, "lon": 32.5},
    "43": {"name": "Kütahya", "lat": 39.4, "lon": 29.9},
    "44": {"name": "Malatya", "lat": 38.4, "lon": 38.3},
    "45": {"name": "Manisa", "lat": 38.6, "lon": 27.4},
    "46": {"name": "Kahramanmaraş", "lat": 37.6, "lon": 36.9},
    "47": {"name": "Mardin", "lat": 37.3, "lon": 40.7},
    "48": {"name": "Muğla", "lat": 37.2, "lon": 28.4},
    "49": {"name": "Muş", "lat": 38.7, "lon": 41.5},
    "50": {"name": "Nevşehir", "lat": 38.6, "lon": 34.7},
    "51": {"name": "Niğde", "lat": 38.0, "lon": 34.7},
    "52": {"name": "Ordu", "lat": 41.0, "lon": 37.9},
    "53": {"name": "Rize", "lat": 41.0, "lon": 40.5},
    "54": {"name": "Sakarya", "lat": 40.7, "lon": 30.4},
    "55": {"name": "Samsun", "lat": 41.3, "lon": 36.3},
    "56": {"name": "Siirt", "lat": 37.9, "lon": 42.0},
    "57": {"name": "Sinop", "lat": 42.0, "lon": 35.2},
    "58": {"name": "Sivas", "lat": 39.8, "lon": 37.0},
    "59": {"name": "Tekirdağ", "lat": 41.0, "lon": 27.5},
    "60": {"name": "Tokat", "lat": 40.3, "lon": 36.6},
    "61": {"name": "Trabzon", "lat": 41.0, "lon": 39.7},
    "62": {"name": "Tunceli", "lat": 39.1, "lon": 39.5},
    "63": {"name": "Şanlıurfa", "lat": 37.2, "lon": 38.8},
    "64": {"name": "Uşak", "lat": 38.7, "lon": 29.4},
    "65": {"name": "Van", "lat": 38.5, "lon": 43.4},
    "66": {"name": "Yozgat", "lat": 39.8, "lon": 34.8},
    "67": {"name": "Zonguldak", "lat": 41.5, "lon": 31.8},
    "68": {"name": "Aksaray", "lat": 38.4, "lon": 34.0},
    "69": {"name": "Bayburt", "lat": 40.3, "lon": 40.2},
    "70": {"name": "Karaman", "lat": 37.2, "lon": 33.2},
    "71": {"name": "Kırıkkale", "lat": 39.8, "lon": 33.5},
    "72": {"name": "Batman", "lat": 37.9, "lon": 41.1},
    "73": {"name": "Şırnak", "lat": 37.5, "lon": 42.5},
    "74": {"name": "Bartın", "lat": 41.6, "lon": 32.3},
    "75": {"name": "Ardahan", "lat": 41.1, "lon": 42.7},
    "76": {"name": "Iğdır", "lat": 39.9, "lon": 44.0},
    "77": {"name": "Yalova", "lat": 40.7, "lon": 29.3},
    "78": {"name": "Karabük", "lat": 41.2, "lon": 32.6},
    "79": {"name": "Kilis", "lat": 36.7, "lon": 37.1},
    "80": {"name": "Osmaniye", "lat": 37.1, "lon": 36.2},
    "81": {"name": "Düzce", "lat": 40.8, "lon": 31.2},
}

# ============================================================================
# OSM TAG TO CATEGORY MAPPING
# ============================================================================

OSM_CATEGORY_MAPPING = {
    # Food & Drink (parent: a0000000-0000-0000-0000-000000000001)
    "amenity=restaurant": {"slug": "restaurant", "parent": "food-drink"},
    "amenity=cafe": {"slug": "cafe", "parent": "food-drink"},
    "amenity=bar": {"slug": "bar", "parent": "food-drink"},
    "amenity=pub": {"slug": "bar", "parent": "food-drink"},
    "amenity=fast_food": {"slug": "fast-food", "parent": "food-drink"},
    "shop=bakery": {"slug": "bakery", "parent": "food-drink"},
    "shop=pastry": {"slug": "patisserie", "parent": "food-drink"},
    "shop=confectionery": {"slug": "patisserie", "parent": "food-drink"},
    "shop=butcher": {"slug": "butcher", "parent": "food-drink"},
    "shop=deli": {"slug": "delicatessen", "parent": "food-drink"},

    # Services (parent: a0000000-0000-0000-0000-000000000002)
    "shop=hairdresser": {"slug": "hair-salon", "parent": "services"},
    "amenity=hairdresser": {"slug": "hair-salon", "parent": "services"},
    "shop=barber": {"slug": "barber", "parent": "services"},
    "shop=dry_cleaning": {"slug": "dry-cleaner", "parent": "services"},
    "shop=laundry": {"slug": "dry-cleaner", "parent": "services"},
    "shop=tailor": {"slug": "tailor", "parent": "services"},
    "amenity=car_wash": {"slug": "car-wash", "parent": "services"},
    "shop=car_repair": {"slug": "mechanic", "parent": "services"},
    "amenity=car_repair": {"slug": "mechanic", "parent": "services"},
    "amenity=veterinary": {"slug": "veterinary", "parent": "services"},
    "shop=pet_grooming": {"slug": "pet-grooming", "parent": "services"},

    # Health & Beauty (parent: a0000000-0000-0000-0000-000000000004)
    "amenity=pharmacy": {"slug": "pharmacy", "parent": "health-beauty"},
    "amenity=dentist": {"slug": "dentist", "parent": "health-beauty"},
    "shop=optician": {"slug": "optician", "parent": "health-beauty"},
    "leisure=fitness_centre": {"slug": "gym", "parent": "health-beauty"},
    "amenity=gym": {"slug": "gym", "parent": "health-beauty"},
    "leisure=spa": {"slug": "spa", "parent": "health-beauty"},
    "shop=beauty": {"slug": "spa", "parent": "health-beauty"},
    "shop=cosmetics": {"slug": "cosmetics", "parent": "health-beauty"},

    # Real Estate (parent: a0000000-0000-0000-0000-000000000005)
    "office=estate_agent": {"slug": "estate-agency", "parent": "real-estate"},
    "shop=estate_agent": {"slug": "estate-agency", "parent": "real-estate"},

    # Retail (parent: a0000000-0000-0000-0000-000000000003)
    "shop=supermarket": {"slug": "retail", "parent": "retail"},
    "shop=convenience": {"slug": "retail", "parent": "retail"},
    "shop=clothes": {"slug": "retail", "parent": "retail"},
    "shop=shoes": {"slug": "retail", "parent": "retail"},
    "shop=jewelry": {"slug": "retail", "parent": "retail"},
    "shop=electronics": {"slug": "retail", "parent": "retail"},
    "shop=mobile_phone": {"slug": "retail", "parent": "retail"},
    "shop=furniture": {"slug": "retail", "parent": "retail"},
    "shop=hardware": {"slug": "retail", "parent": "retail"},

    # Entertainment (parent: a0000000-0000-0000-0000-000000000007)
    "amenity=cinema": {"slug": "entertainment", "parent": "entertainment"},
    "amenity=theatre": {"slug": "entertainment", "parent": "entertainment"},
    "amenity=nightclub": {"slug": "entertainment", "parent": "entertainment"},

    # Education (parent: a0000000-0000-0000-0000-000000000008)
    "amenity=school": {"slug": "education", "parent": "education"},
    "amenity=college": {"slug": "education", "parent": "education"},
    "amenity=university": {"slug": "education", "parent": "education"},
    "amenity=driving_school": {"slug": "education", "parent": "education"},
    "amenity=language_school": {"slug": "education", "parent": "education"},
}

# ============================================================================
# DATA MODELS
# ============================================================================

@dataclass
class Business:
    osm_id: int
    name: str
    latitude: float
    longitude: float
    address: Optional[str]
    city_code: Optional[str]
    category_slug: str
    parent_category: str
    phone: Optional[str] = None
    website: Optional[str] = None
    opening_hours: Optional[str] = None

    def to_listing_dict(self) -> dict:
        """Convert to listing table format"""
        slug = self.generate_slug()
        return {
            "slug": slug,
            "name": self.name,
            "description": None,
            "entity_type": "business",
            "status": "pending",  # Review before making active
            "city_code": self.city_code,
            "district_id": None,  # Would need reverse geocoding
            "address_line": self.address,
            "latitude": round(self.latitude, 6),
            "longitude": round(self.longitude, 6),
            "source": "openstreetmap",
            "source_id": f"osm_{self.osm_id}",
        }

    def generate_slug(self) -> str:
        """Generate URL-friendly slug"""
        # Transliterate Turkish characters
        tr_map = {
            'ş': 's', 'Ş': 'S', 'ı': 'i', 'İ': 'I',
            'ğ': 'g', 'Ğ': 'G', 'ü': 'u', 'Ü': 'U',
            'ö': 'o', 'Ö': 'O', 'ç': 'c', 'Ç': 'C'
        }
        slug = self.name.lower()
        for tr_char, en_char in tr_map.items():
            slug = slug.replace(tr_char, en_char)

        # Remove special characters, replace spaces with dashes
        slug = re.sub(r'[^a-z0-9\s-]', '', slug)
        slug = re.sub(r'[\s_]+', '-', slug)
        slug = re.sub(r'-+', '-', slug).strip('-')

        # Add uniqueness hash
        unique_hash = hashlib.md5(
            f"{self.osm_id}{self.latitude}{self.longitude}".encode()
        ).hexdigest()[:8]

        return f"{slug}-{unique_hash}"

# ============================================================================
# OVERPASS API CLIENT
# ============================================================================

class OverpassClient:
    "Client for OpenStreetMap Overpass API (100% Free)"

    def __init__(self, endpoint: str = OVERPASS_URL):
        self.endpoint = endpoint
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'TurkeyBusinessCollector/1.0 (Educational Project)'
        })

    def query(self, overpass_query: str) -> dict:
        "Execute Overpass QL query"
        try:
            response = self.session.post(
                self.endpoint,
                data={'data': overpass_query},
                timeout=180  # 3 minutes for large queries
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Overpass API error: {e}")
            raise

    def get_businesses_in_area(
        self,
        city_code: str,
        osm_tags: list[str],
        bbox: Optional[tuple] = None
    ) -> list[dict]:
        """
        Fetch businesses from a specific area

        Args:
            city_code: Turkish city code (01-81)
            osm_tags: List of OSM tags like ["amenity=restaurant", "shop=bakery"]
            bbox: Optional (south, west, north, east) bounding box
        """
        city = TURKEY_CITIES.get(city_code)
        if not city:
            raise ValueError(f"Unknown city code: {city_code}")

        # Create bounding box around city center (roughly 50km radius)
        if bbox is None:
            lat, lon = city["lat"], city["lon"]
            # Approximate degrees for 50km
            lat_delta = 0.45  # ~50km
            lon_delta = 0.55  # ~50km (varies with latitude)
            bbox = (lat - lat_delta, lon - lon_delta, lat + lat_delta, lon + lon_delta)

        # Build Overpass query
        tag_queries = []
        for tag in osm_tags:
            key, value = tag.split("=")
            tag_queries.append(f'node["{key}"="{value}"]({bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]});')
            tag_queries.append(f'way["{key}"="{value}"]({bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]});')

        query = f"""
        [out:json][timeout:180];
        (
            {"".join(tag_queries)}
        );
        out center tags;
        """

        logger.info(f"Querying {city['name']} for {len(osm_tags)} tag types...")
        result = self.query(query)
        return result.get("elements", [])

# ============================================================================
# DATA PROCESSOR
# ============================================================================

class BusinessProcessor:
    """Process and transform OSM data to listing format"""

    def __init__(self):
        self.seen_ids = set()  # Deduplication

    def process_element(
        self,
        element: dict,
        city_code: str,
        osm_tag: str
    ) -> Optional[Business]:
        """Convert OSM element to Business object"""

        osm_id = element.get("id")
        if osm_id in self.seen_ids:
            return None

        # Get name (required)
        tags = element.get("tags", {})
        name = tags.get("name") or tags.get("name:tr") or tags.get("name:en")
        if not name:
            return None  # Skip unnamed businesses

        # Get coordinates
        if element["type"] == "node":
            lat = element.get("lat")
            lon = element.get("lon")
        else:  # way or relation
            lat = element.get("center", {}).get("lat")
            lon = element.get("center", {}).get("lon")

        if not lat or not lon:
            return None

        # Get category mapping
        mapping = OSM_CATEGORY_MAPPING.get(osm_tag)
        if not mapping:
            return None

        # Build address
        address_parts = []
        if tags.get("addr:street"):
            if tags.get("addr:housenumber"):
                address_parts.append(f"{tags['addr:street']} {tags['addr:housenumber']}")
            else:
                address_parts.append(tags["addr:street"])
        if tags.get("addr:district"):
            address_parts.append(tags["addr:district"])

        self.seen_ids.add(osm_id)

        return Business(
            osm_id=osm_id,
            name=name.strip(),
            latitude=lat,
            longitude=lon,
            address=", ".join(address_parts) if address_parts else None,
            city_code=city_code,
            category_slug=mapping["slug"],
            parent_category=mapping["parent"],
            phone=tags.get("phone") or tags.get("contact:phone"),
            website=tags.get("website") or tags.get("contact:website"),
            opening_hours=tags.get("opening_hours"),
        )

# ============================================================================
# SUPABASE HANDLER
# ============================================================================

class SupabaseHandler:
    """Handle Supabase operations"""

    def __init__(self, url: str, key: str):
        self.client: Client = create_client(url, key)
        self.category_cache = {}

    def load_categories(self):
        """Load category slugs to IDs mapping"""
        response = self.client.table("categories").select("id, slug").execute()
        self.category_cache = {row["slug"]: row["id"] for row in response.data}
        logger.info(f"Loaded {len(self.category_cache)} categories")

    def get_category_id(self, slug: str) -> Optional[str]:
        """Get category UUID by slug"""
        return self.category_cache.get(slug)

    def check_duplicate(self, source_id: str) -> bool:
        """Check if business already exists"""
        response = self.client.table("listings")\
            .select("id")\
            .eq("source_id", source_id)\
            .limit(1)\
            .execute()
        return len(response.data) > 0

    def insert_listings(self, listings: list[dict]) -> int:
        """Insert listings in batch"""
        if not listings:
            return 0

        try:
            response = self.client.table("listings")\
                .upsert(listings, on_conflict="source_id")\
                .execute()
            return len(response.data)
        except Exception as e:
            logger.error(f"Insert error: {e}")
            return 0

    def insert_listing_categories(self, listing_id: str, category_id: str):
        """Link listing to category"""
        try:
            self.client.table("listing_categories").upsert({
                "listing_id": listing_id,
                "category_id": category_id,
            }, on_conflict="listing_id,category_id").execute()
        except Exception as e:
            logger.error(f"Category link error: {e}")

# ============================================================================
# SQL GENERATOR (Alternative to direct insert)
# ============================================================================

class SQLGenerator:
    """Generate SQL INSERT statements for manual import"""

    def __init__(self, output_file: str = "listings_import.sql"):
        self.output_file = output_file
        self.statements = []

    def add_listing(self, business: Business):
        """Generate INSERT statement for a business"""
        data = business.to_listing_dict()

        # Escape single quotes
        name = data["name"].replace("'", "''")
        slug = data["slug"].replace("'", "''")
        address = (data["address_line"] or "").replace("'", "''")

        sql = f"""
INSERT INTO listings (slug, name, entity_type, status, city_code, address_line, latitude, longitude)
VALUES (
    '{slug}',
    '{name}',
    'business',
    'pending',
    {f"'{data['city_code']}'" if data["city_code"] else "NULL"},
    {f"'{address}'" if address else "NULL"},
    {data["latitude"]},
    {data["longitude"]}
) ON CONFLICT (slug) DO NOTHING;
"""
        self.statements.append(sql.strip())

    def save(self):
        """Write all statements to file"""
        with open(self.output_file, "w", encoding="utf-8") as f:
            f.write("-- Auto-generated listings import\n")
            f.write(f"-- Generated: {datetime.now().isoformat()}\n")
            f.write(f"-- Total records: {len(self.statements)}\n\n")
            f.write("BEGIN;\n\n")
            f.write("\n".join(self.statements))
            f.write("\n\nCOMMIT;\n")

        logger.info(f"Saved {len(self.statements)} statements to {self.output_file}")

# ============================================================================
# MAIN COLLECTOR
# ============================================================================

class TurkeyBusinessCollector:
    """Main orchestrator for collecting Turkey business data"""

    def __init__(
        self,
        use_supabase: bool = True,
        generate_sql: bool = True
    ):
        self.overpass = OverpassClient()
        self.processor = BusinessProcessor()

        self.use_supabase = use_supabase
        self.generate_sql = generate_sql

        if use_supabase:
            self.supabase = SupabaseHandler(SUPABASE_URL, SUPABASE_KEY)
            self.supabase.load_categories()

        if generate_sql:
            self.sql_gen = SQLGenerator()

        self.stats = {
            "total_fetched": 0,
            "total_processed": 0,
            "total_inserted": 0,
            "by_city": {},
            "by_category": {},
        }

    def collect_city(self, city_code: str, tags: list[str] = None):
        """Collect all businesses from a single city"""

        if tags is None:
            tags = list(OSM_CATEGORY_MAPPING.keys())

        city = TURKEY_CITIES.get(city_code)
        logger.info(f"Starting collection for {city['name']} ({city_code})")

        batch = []

        # Query in chunks of tags to avoid timeout
        tag_chunks = [tags[i:i+5] for i in range(0, len(tags), 5)]

        for chunk in tag_chunks:
            try:
                elements = self.overpass.get_businesses_in_area(city_code, chunk)
                self.stats["total_fetched"] += len(elements)

                for element in elements:
                    # Determine which tag matched
                    for tag in chunk:
                        key, value = tag.split("=")
                        if element.get("tags", {}).get(key) == value:
                            business = self.processor.process_element(
                                element, city_code, tag
                            )
                            if business:
                                batch.append(business)
                                self.stats["total_processed"] += 1

                                # Update category stats
                                cat = business.category_slug
                                self.stats["by_category"][cat] = \
                                    self.stats["by_category"].get(cat, 0) + 1
                            break

                # Rate limiting
                time.sleep(REQUEST_DELAY)

            except Exception as e:
                logger.error(f"Error processing {city_code}: {e}")
                continue

        # Insert batch
        self._process_batch(batch, city_code)
        self.stats["by_city"][city_code] = len(batch)

        logger.info(f"Completed {city['name']}: {len(batch)} businesses")

    def _process_batch(self, businesses: list[Business], city_code: str):
        """Process a batch of businesses"""

        if self.generate_sql:
            for business in businesses:
                self.sql_gen.add_listing(business)

        if self.use_supabase:
            listings = []
            for business in businesses:
                listing_data = business.to_listing_dict()
                listings.append(listing_data)

                if len(listings) >= BATCH_SIZE:
                    inserted = self.supabase.insert_listings(listings)
                    self.stats["total_inserted"] += inserted
                    listings = []

            # Insert remaining
            if listings:
                inserted = self.supabase.insert_listings(listings)
                self.stats["total_inserted"] += inserted

    def collect_all(self, start_from: str = "01"):
        """Collect from all Turkish cities"""

        city_codes = sorted(TURKEY_CITIES.keys())
        start_idx = city_codes.index(start_from)

        for city_code in city_codes[start_idx:]:
            self.collect_city(city_code)

            # Save progress periodically
            if self.generate_sql:
                self.sql_gen.save()

        self.print_stats()

    def collect_major_cities(self):
        """Collect from major cities only (faster for testing)"""
        major_cities = ["34", "06", "35", "16", "07", "01", "27", "42"]  # Istanbul, Ankara, etc.

        for city_code in major_cities:
            self.collect_city(city_code)

        if self.generate_sql:
            self.sql_gen.save()

        self.print_stats()

    def print_stats(self):
        """Print collection statistics"""
        print("\n" + "="*50)
        print("COLLECTION STATISTICS")
        print("="*50)
        print(f"Total OSM elements fetched: {self.stats['total_fetched']}")
        print(f"Total businesses processed: {self.stats['total_processed']}")
        print(f"Total inserted to database: {self.stats['total_inserted']}")
        print(f"\nBy City (top 10):")
        sorted_cities = sorted(
            self.stats["by_city"].items(),
            key=lambda x: x[1],
            reverse=True
        )[:10]
        for code, count in sorted_cities:
            print(f"  {TURKEY_CITIES[code]['name']}: {count}")
        print(f"\nBy Category:")
        for cat, count in sorted(self.stats["by_category"].items(), key=lambda x: x[1], reverse=True):
            print(f"  {cat}: {count}")

# ============================================================================
# CLI INTERFACE
# ============================================================================

def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Collect Turkey business data from OpenStreetMap (Free)"
    )
    parser.add_argument(
        "--mode",
        choices=["all", "major", "single"],
        default="major",
        help="Collection mode: all cities, major cities only, or single city"
    )
    parser.add_argument(
        "--city",
        default="34",
        help="City code for single mode (default: 34 for Istanbul)"
    )
    parser.add_argument(
        "--no-supabase",
        action="store_true",
        help="Skip Supabase insertion (SQL only)"
    )
    parser.add_argument(
        "--no-sql",
        action="store_true",
        help="Skip SQL file generation"
    )
    parser.add_argument(
        "--output",
        default="listings_import.sql",
        help="Output SQL file path"
    )

    args = parser.parse_args()

    # Validate environment
    if not args.no_supabase:
        if SUPABASE_URL == "your-project-url":
            print("⚠️  Set SUPABASE_URL and SUPABASE_KEY environment variables")
            print("   Or use --no-supabase to generate SQL only")
            args.no_supabase = True

    collector = TurkeyBusinessCollector(
        use_supabase=not args.no_supabase,
        generate_sql=not args.no_sql
    )

    if not args.no_sql:
        collector.sql_gen.output_file = args.output

    print("🇹🇷 Turkey Business Collector")
    print("📍 Data source: OpenStreetMap (100% Free)")
    print("-" * 40)

    if args.mode == "all":
        print("Mode: All 81 cities (this will take several hours)")
        collector.collect_all()
    elif args.mode == "major":
        print("Mode: Major cities only")
        collector.collect_major_cities()
    else:
        print(f"Mode: Single city ({TURKEY_CITIES[args.city]['name']})")
        collector.collect_city(args.city)
        if not args.no_sql:
            collector.sql_gen.save()
        collector.print_stats()

if __name__ == "__main__":
    main()
'''

#!/usr/bin/env python3
"""
Turkey Business Scraper - Fixed with Grid-Based Querying
Handles large cities by splitting into smaller areas
"""
'''
import os
import re
import time
import hashlib
import logging
from datetime import datetime
from typing import Optional, Generator
from dataclasses import dataclass
import requests
from supabase import create_client, Client

# ============================================================================
# CONFIGURATION
# ============================================================================

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

# Multiple endpoints for fallback
OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

# Tuned for reliability
REQUEST_TIMEOUT = 120  # seconds
REQUEST_DELAY = 5      # seconds between requests
RETRY_DELAY = 30       # seconds after error
MAX_RETRIES = 3
BATCH_SIZE = 50

# Grid size in degrees (~10km cells for Istanbul-sized cities)
GRID_SIZE = 0.1

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================================================
# TURKEY CITIES WITH BOUNDING BOXES
# ============================================================================

TURKEY_CITIES = {
    "34": {
        "name": "İstanbul",
        "bbox": (40.80, 28.50, 41.35, 29.45),  # (south, west, north, east)
    },
    "06": {
        "name": "Ankara",
        "bbox": (39.70, 32.50, 40.10, 33.10),
    },
    "35": {
        "name": "İzmir",
        "bbox": (38.20, 26.80, 38.60, 27.40),
    },
    "16": {
        "name": "Bursa",
        "bbox": (40.10, 28.80, 40.35, 29.20),
    },
    "07": {
        "name": "Antalya",
        "bbox": (36.80, 30.50, 37.10, 30.90),
    },
    "01": {
        "name": "Adana",
        "bbox": (36.90, 35.20, 37.10, 35.50),
    },
    "27": {
        "name": "Gaziantep",
        "bbox": (36.95, 37.30, 37.15, 37.50),
    },
    "42": {
        "name": "Konya",
        "bbox": (37.80, 32.40, 38.00, 32.60),
    },
    "21": {
        "name": "Diyarbakır",
        "bbox": (37.85, 40.10, 38.00, 40.30),
    },
    "33": {
        "name": "Mersin",
        "bbox": (36.75, 34.55, 36.90, 34.75),
    },
}

# ============================================================================
# OSM TAG MAPPING (Query one at a time for reliability)
# ============================================================================

OSM_QUERIES = [
    # High-priority business types
    {"tag": "amenity=restaurant", "slug": "restaurant", "parent": "food-drink"},
    {"tag": "amenity=cafe", "slug": "cafe", "parent": "food-drink"},
    {"tag": "amenity=fast_food", "slug": "fast-food", "parent": "food-drink"},
    {"tag": "shop=bakery", "slug": "bakery", "parent": "food-drink"},
    {"tag": "amenity=pharmacy", "slug": "pharmacy", "parent": "health-beauty"},
    {"tag": "shop=supermarket", "slug": "retail", "parent": "retail"},
    {"tag": "shop=hairdresser", "slug": "hair-salon", "parent": "services"},
    {"tag": "amenity=bank", "slug": "services", "parent": "services"},
    {"tag": "amenity=fuel", "slug": "automotive", "parent": "automotive"},
    {"tag": "shop=clothes", "slug": "retail", "parent": "retail"},
    {"tag": "shop=convenience", "slug": "retail", "parent": "retail"},
    {"tag": "amenity=bar", "slug": "bar", "parent": "food-drink"},
    {"tag": "shop=butcher", "slug": "butcher", "parent": "food-drink"},
    {"tag": "shop=pastry", "slug": "patisserie", "parent": "food-drink"},
    {"tag": "amenity=dentist", "slug": "dentist", "parent": "health-beauty"},
    {"tag": "shop=optician", "slug": "optician", "parent": "health-beauty"},
    {"tag": "leisure=fitness_centre", "slug": "gym", "parent": "health-beauty"},
    {"tag": "shop=car_repair", "slug": "mechanic", "parent": "services"},
    {"tag": "amenity=veterinary", "slug": "veterinary", "parent": "services"},
    {"tag": "office=estate_agent", "slug": "estate-agency", "parent": "real-estate"},
    {"tag": "shop=electronics", "slug": "retail", "parent": "retail"},
    {"tag": "shop=mobile_phone", "slug": "retail", "parent": "retail"},
    {"tag": "amenity=school", "slug": "education", "parent": "education"},
]

# ============================================================================
# DATA MODELS
# ============================================================================

@dataclass
class Business:
    osm_id: int
    osm_type: str
    name: str
    latitude: float
    longitude: float
    category_slug: str
    parent_category: str
    address: Optional[str] = None
    city_code: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None

    def to_listing_dict(self) -> dict:
        slug = self._generate_slug()
        return {
            "slug": slug,
            "name": self.name[:255],  # Truncate if needed
            "description": None,
            "entity_type": "business",
            "status": "pending",
            "city_code": self.city_code,
            "district_id": None,
            "address_line": self.address[:500] if self.address else None,
            "latitude": round(self.latitude, 6),
            "longitude": round(self.longitude, 6),
        }

    def _generate_slug(self) -> str:
        tr_map = {
            'ş': 's', 'Ş': 'S', 'ı': 'i', 'İ': 'I', 'ğ': 'g', 'Ğ': 'G',
            'ü': 'u', 'Ü': 'U', 'ö': 'o', 'Ö': 'O', 'ç': 'c', 'Ç': 'C'
        }
        slug = self.name.lower()
        for tr_char, en_char in tr_map.items():
            slug = slug.replace(tr_char, en_char)
        slug = re.sub(r'[^a-z0-9\s-]', '', slug)
        slug = re.sub(r'[\s_]+', '-', slug)
        slug = re.sub(r'-+', '-', slug).strip('-')[:50]

        unique_hash = hashlib.md5(
            f"{self.osm_type}{self.osm_id}".encode()
        ).hexdigest()[:8]

        return f"{slug}-{unique_hash}" if slug else f"business-{unique_hash}"

# ============================================================================
# OVERPASS CLIENT WITH RETRY & GRID SUPPORT
# ============================================================================

class OverpassClient:
    def __init__(self):
        self.endpoints = OVERPASS_ENDPOINTS.copy()
        self.current_endpoint_idx = 0
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'TurkeyBusinessDB/1.0 (github.com/example; educational)'
        })

    @property
    def endpoint(self):
        return self.endpoints[self.current_endpoint_idx]

    def rotate_endpoint(self):
        """Switch to next endpoint"""
        self.current_endpoint_idx = (self.current_endpoint_idx + 1) % len(self.endpoints)
        logger.info(f"Switched to endpoint: {self.endpoint}")

    def query_with_retry(self, query: str, retries: int = MAX_RETRIES) -> Optional[dict]:
        """Execute query with retry logic"""
        for attempt in range(retries):
            try:
                logger.debug(f"Query attempt {attempt + 1}/{retries}")
                response = self.session.post(
                    self.endpoint,
                    data={'data': query},
                    timeout=REQUEST_TIMEOUT
                )

                if response.status_code == 200:
                    return response.json()
                elif response.status_code == 429:  # Rate limited
                    logger.warning("Rate limited, waiting 60s...")
                    time.sleep(60)
                elif response.status_code in (504, 503, 502):  # Server overloaded
                    logger.warning(f"Server error {response.status_code}, rotating endpoint...")
                    self.rotate_endpoint()
                    time.sleep(RETRY_DELAY)
                else:
                    logger.error(f"HTTP {response.status_code}: {response.text[:200]}")

            except requests.exceptions.Timeout:
                logger.warning(f"Timeout on attempt {attempt + 1}, rotating endpoint...")
                self.rotate_endpoint()
                time.sleep(RETRY_DELAY)
            except requests.exceptions.RequestException as e:
                logger.error(f"Request error: {e}")
                time.sleep(RETRY_DELAY)

        return None

    def generate_grid_cells(self, bbox: tuple, grid_size: float = GRID_SIZE) -> Generator[tuple, None, None]:
        """Split bounding box into grid cells"""
        south, west, north, east = bbox

        lat = south
        while lat < north:
            lon = west
            while lon < east:
                cell = (
                    round(lat, 4),
                    round(lon, 4),
                    round(min(lat + grid_size, north), 4),
                    round(min(lon + grid_size, east), 4)
                )
                yield cell
                lon += grid_size
            lat += grid_size

    def fetch_pois_in_cell(self, bbox: tuple, tag: str) -> list[dict]:
        """Fetch POIs for a single tag in a small cell"""
        key, value = tag.split("=")
        south, west, north, east = bbox

        # Compact query for single tag, small area
        query = f"""
[out:json][timeout:60];
(
  nwr["{key}"="{value}"]["name"]({south},{west},{north},{east});
);
out center tags qt;
"""
        result = self.query_with_retry(query)
        if result:
            return result.get("elements", [])
        return []

# ============================================================================
# PROCESSOR
# ============================================================================

class BusinessProcessor:
    def __init__(self):
        self.seen_ids = set()

    def process_element(self, element: dict, city_code: str, query_info: dict) -> Optional[Business]:
        osm_type = element.get("type", "node")
        osm_id = element.get("id")
        unique_key = f"{osm_type}_{osm_id}"

        if unique_key in self.seen_ids:
            return None

        tags = element.get("tags", {})
        name = tags.get("name") or tags.get("name:tr") or tags.get("name:en")

        if not name or len(name) < 2:
            return None

        # Get coordinates
        if osm_type == "node":
            lat, lon = element.get("lat"), element.get("lon")
        else:
            center = element.get("center", {})
            lat, lon = center.get("lat"), center.get("lon")

        if not lat or not lon:
            return None

        # Build address
        addr_parts = []
        if tags.get("addr:street"):
            street = tags["addr:street"]
            if tags.get("addr:housenumber"):
                street = f"{street} {tags['addr:housenumber']}"
            addr_parts.append(street)
        if tags.get("addr:district"):
            addr_parts.append(tags["addr:district"])
        if tags.get("addr:city"):
            addr_parts.append(tags["addr:city"])

        self.seen_ids.add(unique_key)

        return Business(
            osm_id=osm_id,
            osm_type=osm_type,
            name=name.strip(),
            latitude=lat,
            longitude=lon,
            category_slug=query_info["slug"],
            parent_category=query_info["parent"],
            address=", ".join(addr_parts) if addr_parts else None,
            city_code=city_code,
            phone=tags.get("phone") or tags.get("contact:phone"),
            website=tags.get("website") or tags.get("contact:website"),
        )

# ============================================================================
# SUPABASE HANDLER
# ============================================================================

class SupabaseHandler:
    def __init__(self, url: str, key: str):
        self.client: Client = create_client(url, key)

    def insert_batch(self, listings: list[dict]) -> int:
        if not listings:
            return 0
        try:
            # Use upsert with slug as conflict key
            response = self.client.table("listings").upsert(
                listings,
                on_conflict="slug"
            ).execute()
            return len(response.data)
        except Exception as e:
            logger.error(f"Supabase insert error: {e}")
            # Try one by one on batch failure
            inserted = 0
            for item in listings:
                try:
                    self.client.table("listings").upsert(
                        item, on_conflict="slug"
                    ).execute()
                    inserted += 1
                except:
                    pass
            return inserted

# ============================================================================
# SQL GENERATOR
# ============================================================================

class SQLGenerator:
    def __init__(self, output_dir: str = "sql_output"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
        self.current_file = None
        self.statement_count = 0
        self.file_count = 0
        self.statements_per_file = 5000

    def _get_writer(self):
        if self.current_file is None or self.statement_count >= self.statements_per_file:
            if self.current_file:
                self.current_file.write("\nCOMMIT;\n")
                self.current_file.close()

            self.file_count += 1
            filename = f"{self.output_dir}/listings_{self.file_count:04d}.sql"
            self.current_file = open(filename, "w", encoding="utf-8")
            self.current_file.write(f"-- Generated: {datetime.now().isoformat()}\n")
            self.current_file.write("BEGIN;\n\n")
            self.statement_count = 0
            logger.info(f"Writing to {filename}")

        return self.current_file

    def add_listing(self, business: Business):
        data = business.to_listing_dict()

        def escape(val):
            if val is None:
                return "NULL"
            return "'" + str(val).replace("'", "''") + "'"

        sql = f"""INSERT INTO listings (slug, name, entity_type, status, city_code, address_line, latitude, longitude)
VALUES ({escape(data['slug'])}, {escape(data['name'])}, 'business', 'pending', {escape(data['city_code'])}, {escape(data['address_line'])}, {data['latitude']}, {data['longitude']})
ON CONFLICT (slug) DO NOTHING;
"""
        writer = self._get_writer()
        writer.write(sql)
        self.statement_count += 1

    def close(self):
        if self.current_file:
            self.current_file.write("\nCOMMIT;\n")
            self.current_file.close()
            self.current_file = None

# ============================================================================
# MAIN COLLECTOR
# ============================================================================

class TurkeyBusinessCollector:
    def __init__(self, use_supabase: bool = False, generate_sql: bool = True):
        self.overpass = OverpassClient()
        self.processor = BusinessProcessor()

        self.use_supabase = use_supabase
        if use_supabase and SUPABASE_URL and SUPABASE_KEY:
            self.supabase = SupabaseHandler(SUPABASE_URL, SUPABASE_KEY)
        else:
            self.use_supabase = False

        self.generate_sql = generate_sql
        if generate_sql:
            self.sql_gen = SQLGenerator()

        self.stats = {
            "total_elements": 0,
            "total_businesses": 0,
            "total_inserted": 0,
            "by_city": {},
            "by_category": {},
            "errors": 0,
        }

    def collect_city(self, city_code: str):
        """Collect all businesses from a city using grid approach"""
        city = TURKEY_CITIES.get(city_code)
        if not city:
            logger.error(f"Unknown city code: {city_code}")
            return

        logger.info(f"="*50)
        logger.info(f"Starting: {city['name']} ({city_code})")
        logger.info(f"="*50)

        bbox = city["bbox"]
        cells = list(self.overpass.generate_grid_cells(bbox))
        total_cells = len(cells)

        logger.info(f"Grid cells: {total_cells} | Queries per cell: {len(OSM_QUERIES)}")
        logger.info(f"Estimated queries: {total_cells * len(OSM_QUERIES)}")

        city_count = 0
        batch = []

        for cell_idx, cell in enumerate(cells):
            cell_str = f"({cell[0]:.2f},{cell[1]:.2f})"

            for query_info in OSM_QUERIES:
                tag = query_info["tag"]

                try:
                    elements = self.overpass.fetch_pois_in_cell(cell, tag)
                    self.stats["total_elements"] += len(elements)

                    for element in elements:
                        business = self.processor.process_element(
                            element, city_code, query_info
                        )
                        if business:
                            batch.append(business)
                            city_count += 1

                            # Track category stats
                            cat = query_info["slug"]
                            self.stats["by_category"][cat] = \
                                self.stats["by_category"].get(cat, 0) + 1

                    # Process batch when it gets large
                    if len(batch) >= BATCH_SIZE:
                        self._flush_batch(batch)
                        batch = []

                except Exception as e:
                    logger.error(f"Error in cell {cell_str}, tag {tag}: {e}")
                    self.stats["errors"] += 1

                # Rate limiting between queries
                time.sleep(REQUEST_DELAY)

            # Progress update
            if (cell_idx + 1) % 5 == 0:
                progress = ((cell_idx + 1) / total_cells) * 100
                logger.info(f"Progress: {progress:.1f}% | Cell {cell_idx+1}/{total_cells} | Found: {city_count}")

        # Flush remaining
        if batch:
            self._flush_batch(batch)

        self.stats["by_city"][city_code] = city_count
        self.stats["total_businesses"] += city_count

        logger.info(f"Completed {city['name']}: {city_count} businesses")

    def _flush_batch(self, batch: list[Business]):
        """Write batch to outputs"""
        if self.generate_sql:
            for business in batch:
                self.sql_gen.add_listing(business)

        if self.use_supabase:
            listings = [b.to_listing_dict() for b in batch]
            inserted = self.supabase.insert_batch(listings)
            self.stats["total_inserted"] += inserted

    def collect_major_cities(self):
        """Collect from major cities"""
        for city_code in TURKEY_CITIES.keys():
            self.collect_city(city_code)

        self._finalize()

    def collect_single_city(self, city_code: str):
        """Collect from a single city"""
        self.collect_city(city_code)
        self._finalize()

    def _finalize(self):
        """Finalize collection"""
        if self.generate_sql:
            self.sql_gen.close()

        self._print_stats()

    def _print_stats(self):
        print("\n" + "="*60)
        print("📊 COLLECTION COMPLETE")
        print("="*60)
        print(f"Total OSM elements fetched: {self.stats['total_elements']:,}")
        print(f"Total unique businesses:    {self.stats['total_businesses']:,}")
        print(f"Total inserted to Supabase: {self.stats['total_inserted']:,}")
        print(f"Errors encountered:         {self.stats['errors']}")

        print(f"\n📍 By City:")
        for code, count in sorted(self.stats["by_city"].items(), key=lambda x: x[1], reverse=True):
            city_name = TURKEY_CITIES.get(code, {}).get("name", code)
            print(f"   {city_name}: {count:,}")

        print(f"\n📁 By Category:")
        for cat, count in sorted(self.stats["by_category"].items(), key=lambda x: x[1], reverse=True)[:15]:
            print(f"   {cat}: {count:,}")

        if self.generate_sql:
            print(f"\n📄 SQL files generated in: sql_output/")

# ============================================================================
# MAIN
# ============================================================================

def main():
    import argparse

    parser = argparse.ArgumentParser(description="Collect Turkey businesses from OSM")
    parser.add_argument("--city", help="Single city code (e.g., 34 for Istanbul)")
    parser.add_argument("--supabase", action="store_true", help="Enable Supabase insert")
    parser.add_argument("--no-sql", action="store_true", help="Disable SQL generation")

    args = parser.parse_args()

    print("🇹🇷 Turkey Business Collector v2.0")
    print("📍 Source: OpenStreetMap (100% Free)")
    print("-" * 40)

    collector = TurkeyBusinessCollector(
        use_supabase=args.supabase,
        generate_sql=not args.no_sql
    )

    if args.city:
        print(f"Mode: Single city ({args.city})")
        collector.collect_single_city(args.city)
    else:
        print("Mode: Major cities")
        collector.collect_major_cities()

if __name__ == "__main__":
    main()
'''








#!/usr/bin/env python3
"""
Turkey Business Collector - Full Edition
Collects ALL businesses from ALL 81 Turkish cities
Designed to run unattended for 24+ hours
"""
'''
import os
import re
import time
import hashlib
import logging
from datetime import datetime, timedelta
from typing import Optional
from dataclasses import dataclass, field
import json
import requests
from supabase import create_client, Client

# ============================================================================
# CONFIGURATION
# ============================================================================

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

REQUEST_TIMEOUT = 90
REQUEST_DELAY = 3
RETRY_DELAY = 15
MAX_RETRIES = 5
BATCH_SIZE = 50
GRID_SIZE = 0.15  # ~15km cells
HEARTBEAT_INTERVAL = 120  # Log heartbeat every 2 minutes

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)

# ============================================================================
# ALL 81 TURKISH CITIES WITH BOUNDING BOXES
# ============================================================================

TURKEY_CITIES = {
    "01": {"name": "Adana", "bbox": (36.85, 35.10, 37.15, 35.55)},
    "02": {"name": "Adıyaman", "bbox": (37.65, 38.15, 37.95, 38.45)},
    "03": {"name": "Afyonkarahisar", "bbox": (38.55, 30.35, 38.85, 30.65)},
    "04": {"name": "Ağrı", "bbox": (39.55, 42.95, 39.85, 43.25)},
    "05": {"name": "Amasya", "bbox": (40.55, 35.65, 40.85, 35.95)},
    "06": {"name": "Ankara", "bbox": (39.75, 32.60, 40.10, 33.05)},
    "07": {"name": "Antalya", "bbox": (36.75, 30.55, 37.05, 30.85)},
    "08": {"name": "Artvin", "bbox": (41.05, 41.65, 41.35, 41.95)},
    "09": {"name": "Aydın", "bbox": (37.70, 27.70, 38.00, 28.00)},
    "10": {"name": "Balıkesir", "bbox": (39.50, 27.75, 39.80, 28.05)},
    "11": {"name": "Bilecik", "bbox": (39.95, 29.85, 40.25, 30.15)},
    "12": {"name": "Bingöl", "bbox": (38.95, 40.35, 39.25, 40.65)},
    "13": {"name": "Bitlis", "bbox": (38.25, 41.95, 38.55, 42.25)},
    "14": {"name": "Bolu", "bbox": (40.55, 31.45, 40.85, 31.75)},
    "15": {"name": "Burdur", "bbox": (37.55, 30.15, 37.85, 30.45)},
    "16": {"name": "Bursa", "bbox": (40.10, 28.85, 40.40, 29.25)},
    "17": {"name": "Çanakkale", "bbox": (40.05, 26.25, 40.35, 26.55)},
    "18": {"name": "Çankırı", "bbox": (40.45, 33.45, 40.75, 33.75)},
    "19": {"name": "Çorum", "bbox": (40.35, 34.75, 40.65, 35.05)},
    "20": {"name": "Denizli", "bbox": (37.65, 28.95, 37.95, 29.25)},
    "21": {"name": "Diyarbakır", "bbox": (37.85, 40.05, 38.05, 40.35)},
    "22": {"name": "Edirne", "bbox": (41.55, 26.45, 41.85, 26.75)},
    "23": {"name": "Elazığ", "bbox": (38.55, 39.05, 38.85, 39.35)},
    "24": {"name": "Erzincan", "bbox": (39.65, 39.35, 39.95, 39.65)},
    "25": {"name": "Erzurum", "bbox": (39.80, 41.15, 40.10, 41.45)},
    "26": {"name": "Eskişehir", "bbox": (39.70, 30.40, 40.00, 30.70)},
    "27": {"name": "Gaziantep", "bbox": (36.95, 37.30, 37.20, 37.55)},
    "28": {"name": "Giresun", "bbox": (40.80, 38.25, 41.00, 38.55)},
    "29": {"name": "Gümüşhane", "bbox": (40.35, 39.35, 40.55, 39.65)},
    "30": {"name": "Hakkari", "bbox": (37.45, 43.55, 37.75, 43.85)},
    "31": {"name": "Hatay", "bbox": (36.05, 36.05, 36.35, 36.35)},
    "32": {"name": "Isparta", "bbox": (37.70, 30.45, 38.00, 30.75)},
    "33": {"name": "Mersin", "bbox": (36.70, 34.45, 36.95, 34.80)},
    "34": {"name": "İstanbul", "bbox": (40.80, 28.60, 41.30, 29.35)},
    "35": {"name": "İzmir", "bbox": (38.30, 26.95, 38.55, 27.30)},
    "36": {"name": "Kars", "bbox": (40.45, 42.95, 40.75, 43.25)},
    "37": {"name": "Kastamonu", "bbox": (41.25, 33.65, 41.55, 33.95)},
    "38": {"name": "Kayseri", "bbox": (38.60, 35.35, 38.85, 35.65)},
    "39": {"name": "Kırklareli", "bbox": (41.55, 27.05, 41.85, 27.35)},
    "40": {"name": "Kırşehir", "bbox": (38.95, 34.05, 39.25, 34.35)},
    "41": {"name": "Kocaeli", "bbox": (40.70, 29.80, 41.00, 30.10)},
    "42": {"name": "Konya", "bbox": (37.80, 32.35, 38.05, 32.65)},
    "43": {"name": "Kütahya", "bbox": (39.30, 29.75, 39.55, 30.05)},
    "44": {"name": "Malatya", "bbox": (38.30, 38.20, 38.50, 38.45)},
    "45": {"name": "Manisa", "bbox": (38.50, 27.35, 38.70, 27.60)},
    "46": {"name": "Kahramanmaraş", "bbox": (37.50, 36.85, 37.70, 37.10)},
    "47": {"name": "Mardin", "bbox": (37.25, 40.65, 37.40, 40.85)},
    "48": {"name": "Muğla", "bbox": (37.10, 28.30, 37.30, 28.55)},
    "49": {"name": "Muş", "bbox": (38.60, 41.35, 38.85, 41.65)},
    "50": {"name": "Nevşehir", "bbox": (38.55, 34.60, 38.75, 34.85)},
    "51": {"name": "Niğde", "bbox": (37.90, 34.60, 38.10, 34.85)},
    "52": {"name": "Ordu", "bbox": (40.90, 37.75, 41.10, 38.00)},
    "53": {"name": "Rize", "bbox": (40.95, 40.45, 41.10, 40.65)},
    "54": {"name": "Sakarya", "bbox": (40.70, 30.30, 40.85, 30.50)},
    "55": {"name": "Samsun", "bbox": (41.20, 36.20, 41.40, 36.45)},
    "56": {"name": "Siirt", "bbox": (37.85, 41.90, 38.00, 42.10)},
    "57": {"name": "Sinop", "bbox": (41.95, 35.10, 42.10, 35.30)},
    "58": {"name": "Sivas", "bbox": (39.70, 36.95, 39.90, 37.15)},
    "59": {"name": "Tekirdağ", "bbox": (40.95, 27.40, 41.10, 27.60)},
    "60": {"name": "Tokat", "bbox": (40.25, 36.50, 40.40, 36.70)},
    "61": {"name": "Trabzon", "bbox": (40.95, 39.65, 41.10, 39.85)},
    "62": {"name": "Tunceli", "bbox": (39.05, 39.40, 39.20, 39.60)},
    "63": {"name": "Şanlıurfa", "bbox": (37.10, 38.75, 37.25, 38.95)},
    "64": {"name": "Uşak", "bbox": (38.60, 29.35, 38.75, 29.55)},
    "65": {"name": "Van", "bbox": (38.45, 43.30, 38.60, 43.50)},
    "66": {"name": "Yozgat", "bbox": (39.75, 34.70, 39.90, 34.90)},
    "67": {"name": "Zonguldak", "bbox": (41.40, 31.70, 41.55, 31.90)},
    "68": {"name": "Aksaray", "bbox": (38.30, 33.95, 38.45, 34.15)},
    "69": {"name": "Bayburt", "bbox": (40.20, 40.15, 40.35, 40.35)},
    "70": {"name": "Karaman", "bbox": (37.15, 33.15, 37.30, 33.35)},
    "71": {"name": "Kırıkkale", "bbox": (39.80, 33.45, 39.95, 33.60)},
    "72": {"name": "Batman", "bbox": (37.85, 41.00, 38.00, 41.20)},
    "73": {"name": "Şırnak", "bbox": (37.45, 42.40, 37.55, 42.55)},
    "74": {"name": "Bartın", "bbox": (41.55, 32.30, 41.70, 32.45)},
    "75": {"name": "Ardahan", "bbox": (41.05, 42.65, 41.15, 42.80)},
    "76": {"name": "Iğdır", "bbox": (39.85, 43.95, 40.00, 44.10)},
    "77": {"name": "Yalova", "bbox": (40.60, 29.25, 40.70, 29.35)},
    "78": {"name": "Karabük", "bbox": (41.15, 32.55, 41.25, 32.70)},
    "79": {"name": "Kilis", "bbox": (36.65, 37.05, 36.75, 37.20)},
    "80": {"name": "Osmaniye", "bbox": (37.00, 36.15, 37.15, 36.30)},
    "81": {"name": "Düzce", "bbox": (40.80, 31.10, 40.90, 31.25)},
}

# ============================================================================
# OSM QUERIES
# ============================================================================

OSM_QUERIES = [
    {"tag": "amenity=restaurant", "slug": "restaurant"},
    {"tag": "amenity=cafe", "slug": "cafe"},
    {"tag": "amenity=fast_food", "slug": "fast-food"},
    {"tag": "amenity=bar", "slug": "bar"},
    {"tag": "amenity=pharmacy", "slug": "pharmacy"},
    {"tag": "amenity=bank", "slug": "services"},
    {"tag": "amenity=fuel", "slug": "automotive"},
    {"tag": "amenity=hospital", "slug": "health-beauty"},
    {"tag": "amenity=clinic", "slug": "health-beauty"},
    {"tag": "amenity=dentist", "slug": "dentist"},
    {"tag": "amenity=veterinary", "slug": "veterinary"},
    {"tag": "amenity=school", "slug": "education"},
    {"tag": "amenity=kindergarten", "slug": "education"},
    {"tag": "shop=supermarket", "slug": "retail"},
    {"tag": "shop=convenience", "slug": "retail"},
    {"tag": "shop=bakery", "slug": "bakery"},
    {"tag": "shop=butcher", "slug": "butcher"},
    {"tag": "shop=pastry", "slug": "patisserie"},
    {"tag": "shop=greengrocer", "slug": "retail"},
    {"tag": "shop=clothes", "slug": "retail"},
    {"tag": "shop=shoes", "slug": "retail"},
    {"tag": "shop=jewelry", "slug": "retail"},
    {"tag": "shop=electronics", "slug": "retail"},
    {"tag": "shop=mobile_phone", "slug": "retail"},
    {"tag": "shop=furniture", "slug": "home-garden"},
    {"tag": "shop=hairdresser", "slug": "hair-salon"},
    {"tag": "shop=beauty", "slug": "spa"},
    {"tag": "shop=optician", "slug": "optician"},
    {"tag": "shop=car_repair", "slug": "mechanic"},
    {"tag": "shop=car", "slug": "automotive"},
    {"tag": "shop=hardware", "slug": "retail"},
    {"tag": "office=estate_agent", "slug": "estate-agency"},
    {"tag": "leisure=fitness_centre", "slug": "gym"},
    {"tag": "tourism=hotel", "slug": "services"},
    {"tag": "tourism=guest_house", "slug": "services"},
]

# ============================================================================
# DATA MODEL
# ============================================================================

@dataclass
class Business:
    osm_id: int
    osm_type: str
    name: str
    latitude: float
    longitude: float
    category_slug: str
    city_code: str
    address: Optional[str] = None
    district_name: Optional[str] = None
    district_id: Optional[int] = None
    phone: Optional[str] = None
    website: Optional[str] = None

    def to_listing_dict(self) -> dict:
        slug = self._generate_slug()
        return {
            "slug": slug,
            "name": self.name[:255],
            "description": None,
            "entity_type": "business",
            "status": "pending",
            "city_code": self.city_code,
            "district_id": self.district_id,
            "address_line": self.address[:500] if self.address else None,
            "latitude": round(self.latitude, 6),
            "longitude": round(self.longitude, 6),
        }

    def _generate_slug(self) -> str:
        tr_map = {
            'ş': 's', 'Ş': 'S', 'ı': 'i', 'İ': 'I', 'ğ': 'g', 'Ğ': 'G',
            'ü': 'u', 'Ü': 'U', 'ö': 'o', 'Ö': 'O', 'ç': 'c', 'Ç': 'C'
        }
        slug = self.name.lower()
        for tr_char, en_char in tr_map.items():
            slug = slug.replace(tr_char, en_char)
        slug = re.sub(r'[^a-z0-9\s-]', '', slug)
        slug = re.sub(r'[\s_]+', '-', slug)
        slug = re.sub(r'-+', '-', slug).strip('-')[:50]
        unique_hash = hashlib.md5(f"{self.osm_type}{self.osm_id}".encode()).hexdigest()[:8]
        return f"{slug}-{unique_hash}" if slug else f"business-{unique_hash}"

# ============================================================================
# DISTRICT MATCHER
# ============================================================================

class DistrictMatcher:
    """Matches OSM address data to district IDs"""

    def __init__(self):
        self.districts = {}  # city_code -> {slug: id, name_lower: id}
        self.loaded = False

    def load_from_supabase(self, client: Client):
        """Load all districts from Supabase"""
        try:
            response = client.table("districts").select("id, city_code, name, slug").execute()
            for row in response.data:
                city_code = row["city_code"]
                if city_code not in self.districts:
                    self.districts[city_code] = {}

                # Index by multiple keys for flexible matching
                district_id = row["id"]
                self.districts[city_code][row["slug"].lower()] = district_id
                self.districts[city_code][row["name"].lower()] = district_id

                # Also index without Turkish chars
                name_ascii = self._to_ascii(row["name"].lower())
                self.districts[city_code][name_ascii] = district_id

            self.loaded = True
            logger.info(f"Loaded districts for {len(self.districts)} cities")
        except Exception as e:
            logger.error(f"Failed to load districts: {e}")

    def _to_ascii(self, text: str) -> str:
        """Convert Turkish characters to ASCII"""
        tr_map = {
            'ş': 's', 'ı': 'i', 'ğ': 'g', 'ü': 'u', 'ö': 'o', 'ç': 'c',
            'Ş': 'S', 'İ': 'I', 'Ğ': 'G', 'Ü': 'U', 'Ö': 'O', 'Ç': 'C'
        }
        for tr, en in tr_map.items():
            text = text.replace(tr, en)
        return text

    def find_district_id(self, city_code: str, district_name: Optional[str]) -> Optional[int]:
        """Find district ID from name"""
        if not district_name or not self.loaded:
            return None

        city_districts = self.districts.get(city_code, {})
        if not city_districts:
            return None

        # Try exact match
        name_lower = district_name.lower().strip()
        if name_lower in city_districts:
            return city_districts[name_lower]

        # Try ASCII version
        name_ascii = self._to_ascii(name_lower)
        if name_ascii in city_districts:
            return city_districts[name_ascii]

        # Try partial match (district name might be part of address)
        for key, dist_id in city_districts.items():
            if key in name_lower or name_lower in key:
                return dist_id

        return None

# ============================================================================
# OVERPASS CLIENT
# ============================================================================

class OverpassClient:
    def __init__(self):
        self.endpoints = OVERPASS_ENDPOINTS.copy()
        self.current_idx = 0
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'TurkeyBusinessDB/2.0 (Educational Project)'
        })
        self.request_count = 0
        self.error_count = 0

    @property
    def endpoint(self):
        return self.endpoints[self.current_idx]

    def rotate_endpoint(self):
        self.current_idx = (self.current_idx + 1) % len(self.endpoints)

    def query(self, query: str) -> Optional[dict]:
        """Execute query with retries"""
        for attempt in range(MAX_RETRIES):
            try:
                self.request_count += 1
                response = self.session.post(
                    self.endpoint,
                    data={'data': query},
                    timeout=REQUEST_TIMEOUT
                )

                if response.status_code == 200:
                    return response.json()
                elif response.status_code == 429:
                    time.sleep(60)
                elif response.status_code in (502, 503, 504):
                    self.rotate_endpoint()
                    time.sleep(RETRY_DELAY)
                else:
                    time.sleep(RETRY_DELAY)

            except requests.exceptions.Timeout:
                self.rotate_endpoint()
                time.sleep(RETRY_DELAY)
            except requests.exceptions.RequestException:
                self.error_count += 1
                time.sleep(RETRY_DELAY)

        return None

    def generate_grid(self, bbox: tuple) -> list:
        """Generate grid cells for a bounding box"""
        south, west, north, east = bbox
        cells = []
        lat = south
        while lat < north:
            lon = west
            while lon < east:
                cells.append((
                    round(lat, 4),
                    round(lon, 4),
                    round(min(lat + GRID_SIZE, north), 4),
                    round(min(lon + GRID_SIZE, east), 4)
                ))
                lon += GRID_SIZE
            lat += GRID_SIZE
        return cells

    def fetch_pois(self, bbox: tuple, tag: str) -> list:
        """Fetch POIs for a single tag in a cell"""
        key, value = tag.split("=")
        south, west, north, east = bbox

        query = f"""[out:json][timeout:60];
(nwr["{key}"="{value}"]["name"]({south},{west},{north},{east}););
out center tags qt;"""

        result = self.query(query)
        return result.get("elements", []) if result else []

# ============================================================================
# SQL GENERATOR
# ============================================================================

class SQLGenerator:
    def __init__(self, output_dir: str = "sql_output"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
        self.file = None
        self.count = 0
        self.file_num = 0
        self.per_file = 10000

    def _ensure_file(self):
        if self.file is None or self.count >= self.per_file:
            if self.file:
                self.file.write("\nCOMMIT;\n")
                self.file.close()
            self.file_num += 1
            path = f"{self.output_dir}/listings_{self.file_num:04d}.sql"
            self.file = open(path, "w", encoding="utf-8")
            self.file.write(f"-- Generated: {datetime.now().isoformat()}\n")
            self.file.write("BEGIN;\n\n")
            self.count = 0

    def add(self, business: Business):
        self._ensure_file()
        data = business.to_listing_dict()

        def esc(v):
            if v is None:
                return "NULL"
            return "'" + str(v).replace("'", "''").replace("\\", "\\\\") + "'"

        district_val = data['district_id'] if data['district_id'] else "NULL"

        sql = f"""INSERT INTO listings (slug, name, entity_type, status, city_code, district_id, address_line, latitude, longitude)
VALUES ({esc(data['slug'])}, {esc(data['name'])}, 'business', 'pending', {esc(data['city_code'])}, {district_val}, {esc(data['address_line'])}, {data['latitude']}, {data['longitude']})
ON CONFLICT (slug) DO NOTHING;\n"""

        self.file.write(sql)
        self.count += 1

    def close(self):
        if self.file:
            self.file.write("\nCOMMIT;\n")
            self.file.close()
            self.file = None

# ============================================================================
# SUPABASE HANDLER
# ============================================================================

class SupabaseHandler:
    def __init__(self, url: str, key: str):
        self.client = create_client(url, key)

    def insert_batch(self, listings: list) -> int:
        if not listings:
            return 0
        try:
            response = self.client.table("listings").upsert(
                listings, on_conflict="slug"
            ).execute()
            return len(response.data)
        except Exception as e:
            # Try one by one
            inserted = 0
            for item in listings:
                try:
                    self.client.table("listings").upsert(item, on_conflict="slug").execute()
                    inserted += 1
                except:
                    pass
            return inserted

# ============================================================================
# PROGRESS TRACKER
# ============================================================================

class ProgressTracker:
    def __init__(self, state_file: str = "collector_state.json"):
        self.state_file = state_file
        self.start_time = datetime.now()
        self.last_heartbeat = datetime.now()
        self.stats = {
            "total_businesses": 0,
            "total_queries": 0,
            "cities_completed": [],
            "current_city": None,
            "errors": 0,
        }

    def load(self) -> Optional[str]:
        """Load state and return last completed city"""
        if os.path.exists(self.state_file):
            try:
                with open(self.state_file) as f:
                    data = json.load(f)
                    self.stats = data.get("stats", self.stats)
                    return data.get("last_city")
            except:
                pass
        return None

    def save(self, current_city: str = None):
        """Save current state"""
        with open(self.state_file, "w") as f:
            json.dump({
                "last_city": current_city,
                "stats": self.stats,
                "timestamp": datetime.now().isoformat()
            }, f)

    def heartbeat(self, force: bool = False):
        """Log periodic status update"""
        now = datetime.now()
        if force or (now - self.last_heartbeat).seconds >= HEARTBEAT_INTERVAL:
            elapsed = now - self.start_time
            hours = elapsed.seconds // 3600
            minutes = (elapsed.seconds % 3600) // 60

            logger.info(
                f"💓 HEARTBEAT | Runtime: {hours}h {minutes}m | "
                f"Businesses: {self.stats['total_businesses']:,} | "
                f"Cities: {len(self.stats['cities_completed'])}/81 | "
                f"Current: {self.stats['current_city']}"
            )
            self.last_heartbeat = now

    def city_done(self, city_code: str, count: int):
        """Mark city as completed"""
        self.stats["cities_completed"].append(city_code)
        self.stats["total_businesses"] += count
        self.save(city_code)

# ============================================================================
# MAIN COLLECTOR
# ============================================================================

class TurkeyBusinessCollector:
    def __init__(self, use_supabase: bool = False, generate_sql: bool = True):
        self.overpass = OverpassClient()
        self.seen_ids = set()
        self.district_matcher = DistrictMatcher()
        self.progress = ProgressTracker()

        self.use_supabase = use_supabase
        self.generate_sql = generate_sql

        if use_supabase and SUPABASE_URL and SUPABASE_KEY:
            self.supabase = SupabaseHandler(SUPABASE_URL, SUPABASE_KEY)
            self.district_matcher.load_from_supabase(self.supabase.client)
        else:
            self.use_supabase = False

        if generate_sql:
            self.sql_gen = SQLGenerator()

    def process_element(self, element: dict, city_code: str, tag: str) -> Optional[Business]:
        """Convert OSM element to Business"""
        osm_type = element.get("type", "node")
        osm_id = element.get("id")
        key = f"{osm_type}_{osm_id}"

        if key in self.seen_ids:
            return None

        tags = element.get("tags", {})
        name = tags.get("name") or tags.get("name:tr") or tags.get("name:en")
        if not name or len(name) < 2:
            return None

        # Coordinates
        if osm_type == "node":
            lat, lon = element.get("lat"), element.get("lon")
        else:
            center = element.get("center", {})
            lat, lon = center.get("lat"), center.get("lon")

        if not lat or not lon:
            return None

        # Address and district
        addr_parts = []
        district_name = None

        if tags.get("addr:street"):
            street = tags["addr:street"]
            if tags.get("addr:housenumber"):
                street = f"{street} {tags['addr:housenumber']}"
            addr_parts.append(street)

        # Try to get district from various OSM tags
        district_name = (
            tags.get("addr:district") or
            tags.get("addr:suburb") or
            tags.get("addr:subdistrict") or
            tags.get("addr:neighbourhood")
        )

        if district_name:
            addr_parts.append(district_name)
        if tags.get("addr:city"):
            addr_parts.append(tags["addr:city"])

        # Find district ID
        district_id = self.district_matcher.find_district_id(city_code, district_name)

        self.seen_ids.add(key)

        # Get category slug from tag
        query_info = next((q for q in OSM_QUERIES if q["tag"] == tag), None)
        slug = query_info["slug"] if query_info else "services"

        return Business(
            osm_id=osm_id,
            osm_type=osm_type,
            name=name.strip(),
            latitude=lat,
            longitude=lon,
            category_slug=slug,
            city_code=city_code,
            address=", ".join(addr_parts) if addr_parts else None,
            district_name=district_name,
            district_id=district_id,
            phone=tags.get("phone") or tags.get("contact:phone"),
            website=tags.get("website") or tags.get("contact:website"),
        )

    def collect_city(self, city_code: str) -> int:
        """Collect all businesses from a city"""
        city = TURKEY_CITIES.get(city_code)
        if not city:
            return 0

        self.progress.stats["current_city"] = city["name"]
        logger.info(f"🏙️  Starting {city['name']} ({city_code})")

        cells = self.overpass.generate_grid(city["bbox"])
        city_count = 0
        batch = []

        for cell_idx, cell in enumerate(cells):
            for query in OSM_QUERIES:
                try:
                    elements = self.overpass.fetch_pois(cell, query["tag"])
                    self.progress.stats["total_queries"] += 1

                    for el in elements:
                        biz = self.process_element(el, city_code, query["tag"])
                        if biz:
                            batch.append(biz)
                            city_count += 1

                    if len(batch) >= BATCH_SIZE:
                        self._flush_batch(batch)
                        batch = []

                except Exception as e:
                    self.progress.stats["errors"] += 1

                time.sleep(REQUEST_DELAY)
                self.progress.heartbeat()

        # Flush remaining
        if batch:
            self._flush_batch(batch)

        self.progress.city_done(city_code, city_count)
        logger.info(f"✅ Completed {city['name']}: {city_count:,} businesses")

        return city_count

    def _flush_batch(self, batch: list):
        if self.generate_sql:
            for biz in batch:
                self.sql_gen.add(biz)

        if self.use_supabase:
            listings = [b.to_listing_dict() for b in batch]
            self.supabase.insert_batch(listings)

    def collect_all(self, resume: bool = True):
        """Collect from all 81 cities"""
        logger.info("=" * 60)
        logger.info("🇹🇷 TURKEY BUSINESS COLLECTOR - FULL RUN")
        logger.info(f"📍 Cities: 81 | Query types: {len(OSM_QUERIES)}")
        logger.info("=" * 60)

        # Check for resume point
        start_from = None
        if resume:
            last_city = self.progress.load()
            if last_city:
                logger.info(f"📂 Resuming from after city {last_city}")
                start_from = last_city

        city_codes = sorted(TURKEY_CITIES.keys())

        # Find start index
        start_idx = 0
        if start_from:
            try:
                start_idx = city_codes.index(start_from) + 1
            except ValueError:
                start_idx = 0

        # Process cities
        for city_code in city_codes[start_idx:]:
            try:
                self.collect_city(city_code)
            except KeyboardInterrupt:
                logger.info("⏸️  Interrupted by user. Progress saved.")
                self.progress.save(city_code)
                break
            except Exception as e:
                logger.error(f"❌ City {city_code} failed: {e}")
                self.progress.stats["errors"] += 1
                continue

        self._finalize()

    def _finalize(self):
        if self.generate_sql:
            self.sql_gen.close()

        self.progress.heartbeat(force=True)

        elapsed = datetime.now() - self.progress.start_time
        hours = elapsed.seconds // 3600
        minutes = (elapsed.seconds % 3600) // 60

        print("\n" + "=" * 60)
        print("📊 COLLECTION COMPLETE")
        print("=" * 60)
        print(f"⏱️  Total runtime: {hours}h {minutes}m")
        print(f"🏢 Total businesses: {self.progress.stats['total_businesses']:,}")
        print(f"🌐 Total API queries: {self.progress.stats['total_queries']:,}")
        print(f"🏙️  Cities completed: {len(self.progress.stats['cities_completed'])}/81")
        print(f"⚠️  Errors: {self.progress.stats['errors']}")
        if self.generate_sql:
            print(f"📁 SQL files: sql_output/")
        print("=" * 60)

# ============================================================================
# MAIN
# ============================================================================

def main():
    import argparse

    parser = argparse.ArgumentParser(description="Collect Turkey businesses from OSM")
    parser.add_argument("--city", help="Single city code (e.g., 34)")
    parser.add_argument("--supabase", action="store_true", help="Insert to Supabase")
    parser.add_argument("--no-sql", action="store_true", help="Skip SQL generation")
    parser.add_argument("--no-resume", action="store_true", help="Start fresh, ignore saved progress")

    args = parser.parse_args()

    print("🇹🇷 Turkey Business Collector v3.0")
    print("📍 Source: OpenStreetMap (Free)")
    print("-" * 40)

    collector = TurkeyBusinessCollector(
        use_supabase=args.supabase,
        generate_sql=not args.no_sql
    )

    if args.city:
        collector.collect_city(args.city)
        collector._finalize()
    else:
        collector.collect_all(resume=not args.no_resume)

if __name__ == "__main__":
    main()
'''
#!/usr/bin/env python3
"""
Turkey Business Collector v3.1 - Fixed Supabase insertion
"""
'''
import os
import re
import time
import hashlib
import logging
from datetime import datetime
from typing import Optional
from dataclasses import dataclass
import json
import requests
from supabase import create_client, Client

# ============================================================================
# CONFIGURATION
# ============================================================================

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

REQUEST_TIMEOUT = 90
REQUEST_DELAY = 3
RETRY_DELAY = 15
MAX_RETRIES = 5
BATCH_SIZE = 50
GRID_SIZE = 0.15
HEARTBEAT_INTERVAL = 120

# Reduce Supabase log noise
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)

# ============================================================================
# ALL 81 TURKISH CITIES
# ============================================================================

TURKEY_CITIES = {
    "01": {"name": "Adana", "bbox": (36.85, 35.10, 37.15, 35.55)},
    "02": {"name": "Adıyaman", "bbox": (37.65, 38.15, 37.95, 38.45)},
    "03": {"name": "Afyonkarahisar", "bbox": (38.55, 30.35, 38.85, 30.65)},
    "04": {"name": "Ağrı", "bbox": (39.55, 42.95, 39.85, 43.25)},
    "05": {"name": "Amasya", "bbox": (40.55, 35.65, 40.85, 35.95)},
    "06": {"name": "Ankara", "bbox": (39.75, 32.60, 40.10, 33.05)},
    "07": {"name": "Antalya", "bbox": (36.75, 30.55, 37.05, 30.85)},
    "08": {"name": "Artvin", "bbox": (41.05, 41.65, 41.35, 41.95)},
    "09": {"name": "Aydın", "bbox": (37.70, 27.70, 38.00, 28.00)},
    "10": {"name": "Balıkesir", "bbox": (39.50, 27.75, 39.80, 28.05)},
    "11": {"name": "Bilecik", "bbox": (39.95, 29.85, 40.25, 30.15)},
    "12": {"name": "Bingöl", "bbox": (38.95, 40.35, 39.25, 40.65)},
    "13": {"name": "Bitlis", "bbox": (38.25, 41.95, 38.55, 42.25)},
    "14": {"name": "Bolu", "bbox": (40.55, 31.45, 40.85, 31.75)},
    "15": {"name": "Burdur", "bbox": (37.55, 30.15, 37.85, 30.45)},
    "16": {"name": "Bursa", "bbox": (40.10, 28.85, 40.40, 29.25)},
    "17": {"name": "Çanakkale", "bbox": (40.05, 26.25, 40.35, 26.55)},
    "18": {"name": "Çankırı", "bbox": (40.45, 33.45, 40.75, 33.75)},
    "19": {"name": "Çorum", "bbox": (40.35, 34.75, 40.65, 35.05)},
    "20": {"name": "Denizli", "bbox": (37.65, 28.95, 37.95, 29.25)},
    "21": {"name": "Diyarbakır", "bbox": (37.85, 40.05, 38.05, 40.35)},
    "22": {"name": "Edirne", "bbox": (41.55, 26.45, 41.85, 26.75)},
    "23": {"name": "Elazığ", "bbox": (38.55, 39.05, 38.85, 39.35)},
    "24": {"name": "Erzincan", "bbox": (39.65, 39.35, 39.95, 39.65)},
    "25": {"name": "Erzurum", "bbox": (39.80, 41.15, 40.10, 41.45)},
    "26": {"name": "Eskişehir", "bbox": (39.70, 30.40, 40.00, 30.70)},
    "27": {"name": "Gaziantep", "bbox": (36.95, 37.30, 37.20, 37.55)},
    "28": {"name": "Giresun", "bbox": (40.80, 38.25, 41.00, 38.55)},
    "29": {"name": "Gümüşhane", "bbox": (40.35, 39.35, 40.55, 39.65)},
    "30": {"name": "Hakkari", "bbox": (37.45, 43.55, 37.75, 43.85)},
    "31": {"name": "Hatay", "bbox": (36.05, 36.05, 36.35, 36.35)},
    "32": {"name": "Isparta", "bbox": (37.70, 30.45, 38.00, 30.75)},
    "33": {"name": "Mersin", "bbox": (36.70, 34.45, 36.95, 34.80)},
    "34": {"name": "İstanbul", "bbox": (40.80, 28.60, 41.30, 29.35)},
    "35": {"name": "İzmir", "bbox": (38.30, 26.95, 38.55, 27.30)},
    "36": {"name": "Kars", "bbox": (40.45, 42.95, 40.75, 43.25)},
    "37": {"name": "Kastamonu", "bbox": (41.25, 33.65, 41.55, 33.95)},
    "38": {"name": "Kayseri", "bbox": (38.60, 35.35, 38.85, 35.65)},
    "39": {"name": "Kırklareli", "bbox": (41.55, 27.05, 41.85, 27.35)},
    "40": {"name": "Kırşehir", "bbox": (38.95, 34.05, 39.25, 34.35)},
    "41": {"name": "Kocaeli", "bbox": (40.70, 29.80, 41.00, 30.10)},
    "42": {"name": "Konya", "bbox": (37.80, 32.35, 38.05, 32.65)},
    "43": {"name": "Kütahya", "bbox": (39.30, 29.75, 39.55, 30.05)},
    "44": {"name": "Malatya", "bbox": (38.30, 38.20, 38.50, 38.45)},
    "45": {"name": "Manisa", "bbox": (38.50, 27.35, 38.70, 27.60)},
    "46": {"name": "Kahramanmaraş", "bbox": (37.50, 36.85, 37.70, 37.10)},
    "47": {"name": "Mardin", "bbox": (37.25, 40.65, 37.40, 40.85)},
    "48": {"name": "Muğla", "bbox": (37.10, 28.30, 37.30, 28.55)},
    "49": {"name": "Muş", "bbox": (38.60, 41.35, 38.85, 41.65)},
    "50": {"name": "Nevşehir", "bbox": (38.55, 34.60, 38.75, 34.85)},
    "51": {"name": "Niğde", "bbox": (37.90, 34.60, 38.10, 34.85)},
    "52": {"name": "Ordu", "bbox": (40.90, 37.75, 41.10, 38.00)},
    "53": {"name": "Rize", "bbox": (40.95, 40.45, 41.10, 40.65)},
    "54": {"name": "Sakarya", "bbox": (40.70, 30.30, 40.85, 30.50)},
    "55": {"name": "Samsun", "bbox": (41.20, 36.20, 41.40, 36.45)},
    "56": {"name": "Siirt", "bbox": (37.85, 41.90, 38.00, 42.10)},
    "57": {"name": "Sinop", "bbox": (41.95, 35.10, 42.10, 35.30)},
    "58": {"name": "Sivas", "bbox": (39.70, 36.95, 39.90, 37.15)},
    "59": {"name": "Tekirdağ", "bbox": (40.95, 27.40, 41.10, 27.60)},
    "60": {"name": "Tokat", "bbox": (40.25, 36.50, 40.40, 36.70)},
    "61": {"name": "Trabzon", "bbox": (40.95, 39.65, 41.10, 39.85)},
    "62": {"name": "Tunceli", "bbox": (39.05, 39.40, 39.20, 39.60)},
    "63": {"name": "Şanlıurfa", "bbox": (37.10, 38.75, 37.25, 38.95)},
    "64": {"name": "Uşak", "bbox": (38.60, 29.35, 38.75, 29.55)},
    "65": {"name": "Van", "bbox": (38.45, 43.30, 38.60, 43.50)},
    "66": {"name": "Yozgat", "bbox": (39.75, 34.70, 39.90, 34.90)},
    "67": {"name": "Zonguldak", "bbox": (41.40, 31.70, 41.55, 31.90)},
    "68": {"name": "Aksaray", "bbox": (38.30, 33.95, 38.45, 34.15)},
    "69": {"name": "Bayburt", "bbox": (40.20, 40.15, 40.35, 40.35)},
    "70": {"name": "Karaman", "bbox": (37.15, 33.15, 37.30, 33.35)},
    "71": {"name": "Kırıkkale", "bbox": (39.80, 33.45, 39.95, 33.60)},
    "72": {"name": "Batman", "bbox": (37.85, 41.00, 38.00, 41.20)},
    "73": {"name": "Şırnak", "bbox": (37.45, 42.40, 37.55, 42.55)},
    "74": {"name": "Bartın", "bbox": (41.55, 32.30, 41.70, 32.45)},
    "75": {"name": "Ardahan", "bbox": (41.05, 42.65, 41.15, 42.80)},
    "76": {"name": "Iğdır", "bbox": (39.85, 43.95, 40.00, 44.10)},
    "77": {"name": "Yalova", "bbox": (40.60, 29.25, 40.70, 29.35)},
    "78": {"name": "Karabük", "bbox": (41.15, 32.55, 41.25, 32.70)},
    "79": {"name": "Kilis", "bbox": (36.65, 37.05, 36.75, 37.20)},
    "80": {"name": "Osmaniye", "bbox": (37.00, 36.15, 37.15, 36.30)},
    "81": {"name": "Düzce", "bbox": (40.80, 31.10, 40.90, 31.25)},
}

# ============================================================================
# OSM QUERIES
# ============================================================================

OSM_QUERIES = [
    {"tag": "amenity=restaurant", "slug": "restaurant"},
    {"tag": "amenity=cafe", "slug": "cafe"},
    {"tag": "amenity=fast_food", "slug": "fast-food"},
    {"tag": "amenity=bar", "slug": "bar"},
    {"tag": "amenity=pharmacy", "slug": "pharmacy"},
    {"tag": "amenity=bank", "slug": "services"},
    {"tag": "amenity=fuel", "slug": "automotive"},
    {"tag": "amenity=hospital", "slug": "health-beauty"},
    {"tag": "amenity=clinic", "slug": "health-beauty"},
    {"tag": "amenity=dentist", "slug": "dentist"},
    {"tag": "amenity=veterinary", "slug": "veterinary"},
    {"tag": "amenity=school", "slug": "education"},
    {"tag": "amenity=kindergarten", "slug": "education"},
    {"tag": "shop=supermarket", "slug": "retail"},
    {"tag": "shop=convenience", "slug": "retail"},
    {"tag": "shop=bakery", "slug": "bakery"},
    {"tag": "shop=butcher", "slug": "butcher"},
    {"tag": "shop=pastry", "slug": "patisserie"},
    {"tag": "shop=greengrocer", "slug": "retail"},
    {"tag": "shop=clothes", "slug": "retail"},
    {"tag": "shop=shoes", "slug": "retail"},
    {"tag": "shop=jewelry", "slug": "retail"},
    {"tag": "shop=electronics", "slug": "retail"},
    {"tag": "shop=mobile_phone", "slug": "retail"},
    {"tag": "shop=furniture", "slug": "home-garden"},
    {"tag": "shop=hairdresser", "slug": "hair-salon"},
    {"tag": "shop=beauty", "slug": "spa"},
    {"tag": "shop=optician", "slug": "optician"},
    {"tag": "shop=car_repair", "slug": "mechanic"},
    {"tag": "shop=car", "slug": "automotive"},
    {"tag": "shop=hardware", "slug": "retail"},
    {"tag": "office=estate_agent", "slug": "estate-agency"},
    {"tag": "leisure=fitness_centre", "slug": "gym"},
    {"tag": "tourism=hotel", "slug": "services"},
    {"tag": "tourism=guest_house", "slug": "services"},
]

# ============================================================================
# DATA MODEL
# ============================================================================

@dataclass
class Business:
    osm_id: int
    osm_type: str
    name: str
    latitude: float
    longitude: float
    category_slug: str
    city_code: str
    address: Optional[str] = None
    district_name: Optional[str] = None
    district_id: Optional[int] = None
    phone: Optional[str] = None
    website: Optional[str] = None

    def to_listing_dict(self) -> dict:
        slug = self._generate_slug()
        return {
            "slug": slug,
            "name": self.name[:255],
            "description": None,
            "entity_type": "business",
            "status": "pending",
            "city_code": self.city_code,
            "district_id": self.district_id,
            "address_line": self.address[:500] if self.address else None,
            "latitude": float(round(self.latitude, 6)),
            "longitude": float(round(self.longitude, 6)),
        }

    def _generate_slug(self) -> str:
        tr_map = {
            'ş': 's', 'Ş': 'S', 'ı': 'i', 'İ': 'I', 'ğ': 'g', 'Ğ': 'G',
            'ü': 'u', 'Ü': 'U', 'ö': 'o', 'Ö': 'O', 'ç': 'c', 'Ç': 'C'
        }
        slug = self.name.lower()
        for tr_char, en_char in tr_map.items():
            slug = slug.replace(tr_char, en_char)
        slug = re.sub(r'[^a-z0-9\s-]', '', slug)
        slug = re.sub(r'[\s_]+', '-', slug)
        slug = re.sub(r'-+', '-', slug).strip('-')[:50]
        # Use OSM ID for guaranteed uniqueness
        # return f"{slug}-osm{self.osm_type[0]}{self.osm_id}" if slug else f"business-osm{self.osm_type[0]}{self.osm_id}"

        unique_hash = hashlib.md5(f"{self.osm_type}{self.osm_id}".encode()).hexdigest()[:8]
        return f"{slug}-{unique_hash}" if slug else f"business-{unique_hash}"



# ============================================================================
# DISTRICT MATCHER
# ============================================================================

class DistrictMatcher:
    def __init__(self):
        self.districts = {}
        self.valid_ids = set()
        self.loaded = False

    def load_from_supabase(self, client: Client):
        try:
            response = client.table("districts").select("id, city_code, name, slug").execute()
            for row in response.data:
                city_code = row["city_code"]
                if city_code not in self.districts:
                    self.districts[city_code] = {}

                district_id = row["id"]
                self.valid_ids.add(district_id)
                self.districts[city_code][row["slug"].lower()] = district_id
                self.districts[city_code][row["name"].lower()] = district_id
                self.districts[city_code][self._to_ascii(row["name"].lower())] = district_id

            self.loaded = True
            logger.info(f"Loaded {len(self.valid_ids)} districts")
        except Exception as e:
            logger.error(f"Failed to load districts: {e}")

    def _to_ascii(self, text: str) -> str:
        tr_map = {'ş': 's', 'ı': 'i', 'ğ': 'g', 'ü': 'u', 'ö': 'o', 'ç': 'c',
                  'Ş': 'S', 'İ': 'I', 'Ğ': 'G', 'Ü': 'U', 'Ö': 'O', 'Ç': 'C'}
        for tr, en in tr_map.items():
            text = text.replace(tr, en)
        return text

    def find_district_id(self, city_code: str, district_name: Optional[str]) -> Optional[int]:
        if not district_name or not self.loaded:
            return None

        city_districts = self.districts.get(city_code, {})
        if not city_districts:
            return None

        name_lower = district_name.lower().strip()
        if name_lower in city_districts:
            return city_districts[name_lower]

        name_ascii = self._to_ascii(name_lower)
        if name_ascii in city_districts:
            return city_districts[name_ascii]

        for key, dist_id in city_districts.items():
            if key in name_lower or name_lower in key:
                return dist_id

        return None

    def is_valid_id(self, district_id: Optional[int]) -> bool:
        if district_id is None:
            return True  # NULL is valid
        return district_id in self.valid_ids

# ============================================================================
# OVERPASS CLIENT
# ============================================================================

class OverpassClient:
    def __init__(self):
        self.endpoints = OVERPASS_ENDPOINTS.copy()
        self.current_idx = 0
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'TurkeyBusinessDB/3.1'
        })
        self.request_count = 0
        self.error_count = 0

    @property
    def endpoint(self):
        return self.endpoints[self.current_idx]

    def rotate_endpoint(self):
        self.current_idx = (self.current_idx + 1) % len(self.endpoints)

    def query(self, query: str) -> Optional[dict]:
        for attempt in range(MAX_RETRIES):
            try:
                self.request_count += 1
                response = self.session.post(
                    self.endpoint,
                    data={'data': query},
                    timeout=REQUEST_TIMEOUT
                )

                if response.status_code == 200:
                    return response.json()
                elif response.status_code == 429:
                    time.sleep(60)
                elif response.status_code in (502, 503, 504):
                    self.rotate_endpoint()
                    time.sleep(RETRY_DELAY)
                else:
                    time.sleep(RETRY_DELAY)

            except requests.exceptions.Timeout:
                self.rotate_endpoint()
                time.sleep(RETRY_DELAY)
            except requests.exceptions.RequestException:
                self.error_count += 1
                time.sleep(RETRY_DELAY)

        return None

    def generate_grid(self, bbox: tuple) -> list:
        south, west, north, east = bbox
        cells = []
        lat = south
        while lat < north:
            lon = west
            while lon < east:
                cells.append((
                    round(lat, 4),
                    round(lon, 4),
                    round(min(lat + GRID_SIZE, north), 4),
                    round(min(lon + GRID_SIZE, east), 4)
                ))
                lon += GRID_SIZE
            lat += GRID_SIZE
        return cells

    def fetch_pois(self, bbox: tuple, tag: str) -> list:
        key, value = tag.split("=")
        south, west, north, east = bbox

        query = f"""[out:json][timeout:60];
(nwr["{key}"="{value}"]["name"]({south},{west},{north},{east}););
out center tags qt;"""

        result = self.query(query)
        return result.get("elements", []) if result else []

# ============================================================================
# SQL GENERATOR
# ============================================================================

class SQLGenerator:
    def __init__(self, output_dir: str = "sql_output"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
        self.file = None
        self.count = 0
        self.file_num = 0
        self.per_file = 10000
        self.total_count = 0

    def _ensure_file(self):
        if self.file is None or self.count >= self.per_file:
            if self.file:
                self.file.write("\nCOMMIT;\n")
                self.file.close()
            self.file_num += 1
            path = f"{self.output_dir}/listings_{self.file_num:04d}.sql"
            self.file = open(path, "w", encoding="utf-8")
            self.file.write(f"-- Generated: {datetime.now().isoformat()}\n")
            self.file.write("BEGIN;\n\n")
            self.count = 0

    def add(self, business: Business):
        self._ensure_file()
        data = business.to_listing_dict()

        def esc(v):
            if v is None:
                return "NULL"
            s = str(v).replace("'", "''").replace("\\", "\\\\")
            return f"'{s}'"

        district_val = str(data['district_id']) if data['district_id'] else "NULL"

        sql = f"""INSERT INTO listings (slug, name, entity_type, status, city_code, district_id, address_line, latitude, longitude)
VALUES ({esc(data['slug'])}, {esc(data['name'])}, 'business', 'pending', {esc(data['city_code'])}, {district_val}, {esc(data['address_line'])}, {data['latitude']}, {data['longitude']})
ON CONFLICT (slug) DO NOTHING;\n"""

        self.file.write(sql)
        self.count += 1
        self.total_count += 1

    def close(self):
        if self.file:
            self.file.write("\nCOMMIT;\n")
            self.file.close()
            self.file = None

# ============================================================================
# SUPABASE HANDLER - FIXED
# ============================================================================

# ============================================================================
# SUPABASE HANDLER - Using Service Role Key
# ============================================================================

class SupabaseHandler:
    def __init__(self, url: str, service_key: str, district_matcher: DistrictMatcher):
        # Service role key bypasses RLS - use only for admin/seeding operations
        self.client = create_client(url, service_key)
        self.district_matcher = district_matcher
        self.inserted_count = 0
        self.error_count = 0
        self.duplicate_count = 0

        logger.info("🔑 Connected with service role (RLS bypassed)")

    def insert_batch(self, listings: list) -> int:
        if not listings:
            return 0

        inserted = 0
        for item in listings:
            # Validate district_id
            if not self.district_matcher.is_valid_id(item.get("district_id")):
                item["district_id"] = None

            try:
                self.client.table("listings").insert(item).execute()
                inserted += 1
                self.inserted_count += 1
            except Exception as e:
                error_msg = str(e).lower()
                if "duplicate" in error_msg or "unique" in error_msg or "already exists" in error_msg:
                    self.duplicate_count += 1
                else:
                    self.error_count += 1
                    if self.error_count <= 5:
                        logger.warning(f"DB Error: {str(e)[:150]}")

        return inserted

# ============================================================================
# PROGRESS TRACKER
# ============================================================================

class ProgressTracker:
    def __init__(self, state_file: str = "collector_state.json"):
        self.state_file = state_file
        self.start_time = datetime.now()
        self.last_heartbeat = datetime.now()
        self.stats = {
            "total_businesses": 0,
            "total_queries": 0,
            "cities_completed": [],
            "current_city": None,
            "errors": 0,
        }

    def load(self) -> Optional[str]:
        if os.path.exists(self.state_file):
            try:
                with open(self.state_file) as f:
                    data = json.load(f)
                    self.stats = data.get("stats", self.stats)
                    return data.get("last_city")
            except:
                pass
        return None

    def save(self, current_city: str = None):
        with open(self.state_file, "w") as f:
            json.dump({
                "last_city": current_city,
                "stats": self.stats,
                "timestamp": datetime.now().isoformat()
            }, f)

    def heartbeat(self, force: bool = False, extra: str = ""):
        now = datetime.now()
        if force or (now - self.last_heartbeat).seconds >= HEARTBEAT_INTERVAL:
            elapsed = now - self.start_time
            hours = elapsed.seconds // 3600
            minutes = (elapsed.seconds % 3600) // 60

            msg = (f"💓 Runtime: {hours}h{minutes}m | "
                   f"Biz: {self.stats['total_businesses']:,} | "
                   f"Cities: {len(self.stats['cities_completed'])}/81")
            if extra:
                msg += f" | {extra}"

            logger.info(msg)
            self.last_heartbeat = now

    def city_done(self, city_code: str, count: int):
        self.stats["cities_completed"].append(city_code)
        self.stats["total_businesses"] += count
        self.save(city_code)

# ============================================================================
# MAIN COLLECTOR
# ============================================================================

# ============================================================================
# MAIN COLLECTOR - Updated init
# ============================================================================

class TurkeyBusinessCollector:
    def __init__(self, use_supabase: bool = False, generate_sql: bool = True):
        self.overpass = OverpassClient()
        self.seen_ids = set()
        self.district_matcher = DistrictMatcher()
        self.progress = ProgressTracker()

        self.use_supabase = use_supabase
        self.generate_sql = generate_sql
        self.supabase = None

        if use_supabase:
            if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
                logger.error("❌ SUPABASE_URL and SUPABASE_SERVICE_KEY required")
                logger.error("   Get service key from: Supabase Dashboard > Settings > API")
                self.use_supabase = False
            else:
                # Load districts first
                temp_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
                self.district_matcher.load_from_supabase(temp_client)
                self.supabase = SupabaseHandler(
                    SUPABASE_URL,
                    SUPABASE_SERVICE_KEY,
                    self.district_matcher
                )

        if generate_sql:
            self.sql_gen = SQLGenerator()

    def process_element(self, element: dict, city_code: str, tag: str) -> Optional[Business]:
        osm_type = element.get("type", "node")
        osm_id = element.get("id")
        key = f"{osm_type}_{osm_id}"

        if key in self.seen_ids:
            return None

        tags = element.get("tags", {})
        name = tags.get("name") or tags.get("name:tr") or tags.get("name:en")
        if not name or len(name) < 2:
            return None

        if osm_type == "node":
            lat, lon = element.get("lat"), element.get("lon")
        else:
            center = element.get("center", {})
            lat, lon = center.get("lat"), center.get("lon")

        if not lat or not lon:
            return None

        # Address and district
        addr_parts = []
        district_name = None

        if tags.get("addr:street"):
            street = tags["addr:street"]
            if tags.get("addr:housenumber"):
                street = f"{street} {tags['addr:housenumber']}"
            addr_parts.append(street)

        district_name = (
            tags.get("addr:district") or
            tags.get("addr:suburb") or
            tags.get("addr:subdistrict") or
            tags.get("addr:neighbourhood")
        )

        if district_name:
            addr_parts.append(district_name)
        if tags.get("addr:city"):
            addr_parts.append(tags["addr:city"])

        district_id = self.district_matcher.find_district_id(city_code, district_name)

        self.seen_ids.add(key)

        query_info = next((q for q in OSM_QUERIES if q["tag"] == tag), None)
        slug = query_info["slug"] if query_info else "services"

        return Business(
            osm_id=osm_id,
            osm_type=osm_type,
            name=name.strip(),
            latitude=lat,
            longitude=lon,
            category_slug=slug,
            city_code=city_code,
            address=", ".join(addr_parts) if addr_parts else None,
            district_name=district_name,
            district_id=district_id,
            phone=tags.get("phone") or tags.get("contact:phone"),
            website=tags.get("website") or tags.get("contact:website"),
        )

    def collect_city(self, city_code: str) -> int:
        city = TURKEY_CITIES.get(city_code)
        if not city:
            return 0

        self.progress.stats["current_city"] = city["name"]
        logger.info(f"🏙️  {city['name']} ({city_code})")

        cells = self.overpass.generate_grid(city["bbox"])
        city_count = 0
        batch = []

        for cell_idx, cell in enumerate(cells):
            for query in OSM_QUERIES:
                try:
                    elements = self.overpass.fetch_pois(cell, query["tag"])
                    self.progress.stats["total_queries"] += 1

                    for el in elements:
                        biz = self.process_element(el, city_code, query["tag"])
                        if biz:
                            batch.append(biz)
                            city_count += 1

                    if len(batch) >= BATCH_SIZE:
                        self._flush_batch(batch)
                        batch = []

                except Exception as e:
                    self.progress.stats["errors"] += 1

                time.sleep(REQUEST_DELAY)

            # Heartbeat with cell progress
            self.progress.heartbeat(extra=f"{city['name']} cell {cell_idx+1}/{len(cells)}")

        if batch:
            self._flush_batch(batch)

        self.progress.city_done(city_code, city_count)

        # Log city completion with DB stats
        db_info = ""
        if self.supabase:
            db_info = f" | DB: {self.supabase.inserted_count} ok, {self.supabase.duplicate_count} dup, {self.supabase.error_count} err"
        logger.info(f"✅ {city['name']}: {city_count:,} found{db_info}")

        return city_count

    def _flush_batch(self, batch: list):
        if self.generate_sql:
            for biz in batch:
                self.sql_gen.add(biz)

        if self.supabase:
            listings = [b.to_listing_dict() for b in batch]
            self.supabase.insert_batch(listings)

    def collect_all(self, resume: bool = True):
        logger.info("=" * 50)
        logger.info("🇹🇷 TURKEY BUSINESS COLLECTOR")
        logger.info(f"Cities: 81 | Queries: {len(OSM_QUERIES)}")
        logger.info("=" * 50)

        start_from = None
        if resume:
            last_city = self.progress.load()
            if last_city:
                logger.info(f"📂 Resuming after {last_city}")
                start_from = last_city

        city_codes = sorted(TURKEY_CITIES.keys())

        start_idx = 0
        if start_from:
            try:
                start_idx = city_codes.index(start_from) + 1
            except ValueError:
                start_idx = 0

        for city_code in city_codes[start_idx:]:
            try:
                self.collect_city(city_code)
            except KeyboardInterrupt:
                logger.info("⏸️  Interrupted. Progress saved.")
                self.progress.save(city_code)
                break
            except Exception as e:
                logger.error(f"❌ {city_code} failed: {e}")
                self.progress.stats["errors"] += 1
                continue

        self._finalize()

    def _finalize(self):
        if self.generate_sql:
            self.sql_gen.close()

        self.progress.heartbeat(force=True)

        elapsed = datetime.now() - self.progress.start_time
        hours = int(elapsed.total_seconds()) // 3600
        minutes = (int(elapsed.total_seconds()) % 3600) // 60

        print("\n" + "=" * 50)
        print("📊 COMPLETE")
        print("=" * 50)
        print(f"⏱️  Runtime: {hours}h {minutes}m")
        print(f"🏢 Businesses found: {self.progress.stats['total_businesses']:,}")
        print(f"🏙️  Cities: {len(self.progress.stats['cities_completed'])}/81")

        if self.supabase:
            print(f"💾 DB inserted: {self.supabase.inserted_count:,}")
            print(f"📋 DB duplicates: {self.supabase.duplicate_count:,}")
            print(f"⚠️  DB errors: {self.supabase.error_count}")

        if self.generate_sql:
            print(f"📁 SQL files: sql_output/ ({self.sql_gen.total_count:,} records)")

# ============================================================================
# MAIN
# ============================================================================

def main():
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--city", help="Single city code")
    parser.add_argument("--supabase", action="store_true")
    parser.add_argument("--no-sql", action="store_true")
    parser.add_argument("--no-resume", action="store_true")

    args = parser.parse_args()

    print("🇹🇷 Turkey Business Collector v3.1")
    print("-" * 40)

    collector = TurkeyBusinessCollector(
        use_supabase=args.supabase,
        generate_sql=not args.no_sql
    )

    if args.city:
        collector.collect_city(args.city)
        collector._finalize()
    else:
        collector.collect_all(resume=not args.no_resume)

if __name__ == "__main__":
    main()
'''

#!/usr/bin/env python3
"""
Turkey Business Collector v4.0
Comprehensive OSM data collection with full schema support
- Captures all OSM metadata (brand, hours, contacts, etc.)
- Creates parent brand/company listings automatically
- Populates: listings, listing_categories, listing_contacts, listing_hours, listing_sources
"""

import os
import re
import time
import hashlib
import logging
import json
import uuid
from datetime import datetime
from typing import Optional, Dict, List, Any, Tuple
from dataclasses import dataclass, field
import requests
from supabase import create_client, Client
from typing import Optional, Dict, List, Any, Tuple, TYPE_CHECKING
from supabase import create_client, Client
from postgrest import APIResponse

if TYPE_CHECKING:
    from postgrest import SyncSelectRequestBuilder, SyncFilterRequestBuilder
# ============================================================================
# CONFIGURATION
# ============================================================================

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

REQUEST_TIMEOUT = 90
REQUEST_DELAY = 3
RETRY_DELAY = 15
MAX_RETRIES = 5
BATCH_SIZE = 30
GRID_SIZE = 0.15
HEARTBEAT_INTERVAL = 120

logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)

# ============================================================================
# ALL 81 TURKISH CITIES
# ============================================================================

TURKEY_CITIES = {
    "01": {"name": "Adana", "bbox": (36.85, 35.10, 37.15, 35.55)},
    "02": {"name": "Adıyaman", "bbox": (37.65, 38.15, 37.95, 38.45)},
    "03": {"name": "Afyonkarahisar", "bbox": (38.55, 30.35, 38.85, 30.65)},
    "04": {"name": "Ağrı", "bbox": (39.55, 42.95, 39.85, 43.25)},
    "05": {"name": "Amasya", "bbox": (40.55, 35.65, 40.85, 35.95)},
    "06": {"name": "Ankara", "bbox": (39.75, 32.60, 40.10, 33.05)},
    "07": {"name": "Antalya", "bbox": (36.75, 30.55, 37.05, 30.85)},
    "08": {"name": "Artvin", "bbox": (41.05, 41.65, 41.35, 41.95)},
    "09": {"name": "Aydın", "bbox": (37.70, 27.70, 38.00, 28.00)},
    "10": {"name": "Balıkesir", "bbox": (39.50, 27.75, 39.80, 28.05)},
    "11": {"name": "Bilecik", "bbox": (39.95, 29.85, 40.25, 30.15)},
    "12": {"name": "Bingöl", "bbox": (38.95, 40.35, 39.25, 40.65)},
    "13": {"name": "Bitlis", "bbox": (38.25, 41.95, 38.55, 42.25)},
    "14": {"name": "Bolu", "bbox": (40.55, 31.45, 40.85, 31.75)},
    "15": {"name": "Burdur", "bbox": (37.55, 30.15, 37.85, 30.45)},
    "16": {"name": "Bursa", "bbox": (40.10, 28.85, 40.40, 29.25)},
    "17": {"name": "Çanakkale", "bbox": (40.05, 26.25, 40.35, 26.55)},
    "18": {"name": "Çankırı", "bbox": (40.45, 33.45, 40.75, 33.75)},
    "19": {"name": "Çorum", "bbox": (40.35, 34.75, 40.65, 35.05)},
    "20": {"name": "Denizli", "bbox": (37.65, 28.95, 37.95, 29.25)},
    "21": {"name": "Diyarbakır", "bbox": (37.85, 40.05, 38.05, 40.35)},
    "22": {"name": "Edirne", "bbox": (41.55, 26.45, 41.85, 26.75)},
    "23": {"name": "Elazığ", "bbox": (38.55, 39.05, 38.85, 39.35)},
    "24": {"name": "Erzincan", "bbox": (39.65, 39.35, 39.95, 39.65)},
    "25": {"name": "Erzurum", "bbox": (39.80, 41.15, 40.10, 41.45)},
    "26": {"name": "Eskişehir", "bbox": (39.70, 30.40, 40.00, 30.70)},
    "27": {"name": "Gaziantep", "bbox": (36.95, 37.30, 37.20, 37.55)},
    "28": {"name": "Giresun", "bbox": (40.80, 38.25, 41.00, 38.55)},
    "29": {"name": "Gümüşhane", "bbox": (40.35, 39.35, 40.55, 39.65)},
    "30": {"name": "Hakkari", "bbox": (37.45, 43.55, 37.75, 43.85)},
    "31": {"name": "Hatay", "bbox": (36.05, 36.05, 36.35, 36.35)},
    "32": {"name": "Isparta", "bbox": (37.70, 30.45, 38.00, 30.75)},
    "33": {"name": "Mersin", "bbox": (36.70, 34.45, 36.95, 34.80)},
    "34": {"name": "İstanbul", "bbox": (40.80, 28.60, 41.30, 29.35)},
    "35": {"name": "İzmir", "bbox": (38.30, 26.95, 38.55, 27.30)},
    "36": {"name": "Kars", "bbox": (40.45, 42.95, 40.75, 43.25)},
    "37": {"name": "Kastamonu", "bbox": (41.25, 33.65, 41.55, 33.95)},
    "38": {"name": "Kayseri", "bbox": (38.60, 35.35, 38.85, 35.65)},
    "39": {"name": "Kırklareli", "bbox": (41.55, 27.05, 41.85, 27.35)},
    "40": {"name": "Kırşehir", "bbox": (38.95, 34.05, 39.25, 34.35)},
    "41": {"name": "Kocaeli", "bbox": (40.70, 29.80, 41.00, 30.10)},
    "42": {"name": "Konya", "bbox": (37.80, 32.35, 38.05, 32.65)},
    "43": {"name": "Kütahya", "bbox": (39.30, 29.75, 39.55, 30.05)},
    "44": {"name": "Malatya", "bbox": (38.30, 38.20, 38.50, 38.45)},
    "45": {"name": "Manisa", "bbox": (38.50, 27.35, 38.70, 27.60)},
    "46": {"name": "Kahramanmaraş", "bbox": (37.50, 36.85, 37.70, 37.10)},
    "47": {"name": "Mardin", "bbox": (37.25, 40.65, 37.40, 40.85)},
    "48": {"name": "Muğla", "bbox": (37.10, 28.30, 37.30, 28.55)},
    "49": {"name": "Muş", "bbox": (38.60, 41.35, 38.85, 41.65)},
    "50": {"name": "Nevşehir", "bbox": (38.55, 34.60, 38.75, 34.85)},
    "51": {"name": "Niğde", "bbox": (37.90, 34.60, 38.10, 34.85)},
    "52": {"name": "Ordu", "bbox": (40.90, 37.75, 41.10, 38.00)},
    "53": {"name": "Rize", "bbox": (40.95, 40.45, 41.10, 40.65)},
    "54": {"name": "Sakarya", "bbox": (40.70, 30.30, 40.85, 30.50)},
    "55": {"name": "Samsun", "bbox": (41.20, 36.20, 41.40, 36.45)},
    "56": {"name": "Siirt", "bbox": (37.85, 41.90, 38.00, 42.10)},
    "57": {"name": "Sinop", "bbox": (41.95, 35.10, 42.10, 35.30)},
    "58": {"name": "Sivas", "bbox": (39.70, 36.95, 39.90, 37.15)},
    "59": {"name": "Tekirdağ", "bbox": (40.95, 27.40, 41.10, 27.60)},
    "60": {"name": "Tokat", "bbox": (40.25, 36.50, 40.40, 36.70)},
    "61": {"name": "Trabzon", "bbox": (40.95, 39.65, 41.10, 39.85)},
    "62": {"name": "Tunceli", "bbox": (39.05, 39.40, 39.20, 39.60)},
    "63": {"name": "Şanlıurfa", "bbox": (37.10, 38.75, 37.25, 38.95)},
    "64": {"name": "Uşak", "bbox": (38.60, 29.35, 38.75, 29.55)},
    "65": {"name": "Van", "bbox": (38.45, 43.30, 38.60, 43.50)},
    "66": {"name": "Yozgat", "bbox": (39.75, 34.70, 39.90, 34.90)},
    "67": {"name": "Zonguldak", "bbox": (41.40, 31.70, 41.55, 31.90)},
    "68": {"name": "Aksaray", "bbox": (38.30, 33.95, 38.45, 34.15)},
    "69": {"name": "Bayburt", "bbox": (40.20, 40.15, 40.35, 40.35)},
    "70": {"name": "Karaman", "bbox": (37.15, 33.15, 37.30, 33.35)},
    "71": {"name": "Kırıkkale", "bbox": (39.80, 33.45, 39.95, 33.60)},
    "72": {"name": "Batman", "bbox": (37.85, 41.00, 38.00, 41.20)},
    "73": {"name": "Şırnak", "bbox": (37.45, 42.40, 37.55, 42.55)},
    "74": {"name": "Bartın", "bbox": (41.55, 32.30, 41.70, 32.45)},
    "75": {"name": "Ardahan", "bbox": (41.05, 42.65, 41.15, 42.80)},
    "76": {"name": "Iğdır", "bbox": (39.85, 43.95, 40.00, 44.10)},
    "77": {"name": "Yalova", "bbox": (40.60, 29.25, 40.70, 29.35)},
    "78": {"name": "Karabük", "bbox": (41.15, 32.55, 41.25, 32.70)},
    "79": {"name": "Kilis", "bbox": (36.65, 37.05, 36.75, 37.20)},
    "80": {"name": "Osmaniye", "bbox": (37.00, 36.15, 37.15, 36.30)},
    "81": {"name": "Düzce", "bbox": (40.80, 31.10, 40.90, 31.25)},
}

# ============================================================================
# OSM TAG TO CATEGORY MAPPING (comprehensive)
# ============================================================================

OSM_CATEGORY_MAP = {
    # Food & Drink
    "amenity=restaurant": {"slug": "restaurant", "type": "business"},
    "amenity=cafe": {"slug": "cafe", "type": "business"},
    "amenity=fast_food": {"slug": "fast-food", "type": "business"},
    "amenity=bar": {"slug": "bar", "type": "business"},
    "amenity=pub": {"slug": "pub", "type": "business"},
    "amenity=ice_cream": {"slug": "patisserie", "type": "business"},
    "shop=bakery": {"slug": "bakery", "type": "business"},
    "shop=pastry": {"slug": "patisserie", "type": "business"},
    "shop=confectionery": {"slug": "patisserie", "type": "business"},
    "shop=butcher": {"slug": "butcher", "type": "business"},
    "shop=deli": {"slug": "delicatessen", "type": "business"},
    "shop=supermarket": {"slug": "supermarket", "type": "business"},
    "shop=convenience": {"slug": "grocery", "type": "business"},
    "shop=greengrocer": {"slug": "grocery", "type": "business"},

    # Retail
    "shop=clothes": {"slug": "clothing", "type": "business"},
    "shop=shoes": {"slug": "shoes", "type": "business"},
    "shop=jewelry": {"slug": "jewelry", "type": "business"},
    "shop=electronics": {"slug": "electronics", "type": "business"},
    "shop=mobile_phone": {"slug": "mobile-phone", "type": "business"},
    "shop=computer": {"slug": "electronics", "type": "business"},
    "shop=books": {"slug": "bookstore", "type": "business"},
    "shop=toys": {"slug": "toys", "type": "business"},
    "shop=sports": {"slug": "sports-equipment", "type": "business"},
    "shop=pet": {"slug": "pet-shop", "type": "business"},
    "shop=stationery": {"slug": "stationery", "type": "business"},

    # Health & Beauty
    "amenity=pharmacy": {"slug": "pharmacy", "type": "business"},
    "amenity=hospital": {"slug": "hospital", "type": "business"},
    "amenity=clinic": {"slug": "clinic", "type": "business"},
    "amenity=doctors": {"slug": "clinic", "type": "business"},
    "amenity=dentist": {"slug": "dentist", "type": "business"},
    "amenity=veterinary": {"slug": "veterinary", "type": "business"},
    "shop=optician": {"slug": "optician", "type": "business"},
    "shop=beauty": {"slug": "spa", "type": "business"},
    "shop=cosmetics": {"slug": "cosmetics", "type": "business"},
    "leisure=fitness_centre": {"slug": "gym", "type": "business"},

    # Services
    "shop=hairdresser": {"slug": "hair-salon", "type": "business"},
    "shop=barber": {"slug": "barber", "type": "business"},
    "shop=dry_cleaning": {"slug": "dry-cleaner", "type": "business"},
    "shop=laundry": {"slug": "dry-cleaner", "type": "business"},
    "shop=tailor": {"slug": "tailor", "type": "business"},
    "amenity=bank": {"slug": "bank", "type": "business"},
    "amenity=atm": {"slug": "atm", "type": "business"},
    "amenity=bureau_de_change": {"slug": "exchange", "type": "business"},
    "amenity=post_office": {"slug": "post-office", "type": "business"},
    "shop=travel_agency": {"slug": "travel-agency", "type": "business"},
    "office=lawyer": {"slug": "lawyer", "type": "business"},
    "office=notary": {"slug": "notary", "type": "business"},
    "office=insurance": {"slug": "insurance", "type": "business"},

    # Automotive
    "amenity=fuel": {"slug": "gas-station", "type": "business"},
    "amenity=car_wash": {"slug": "car-wash", "type": "business"},
    "shop=car": {"slug": "car-dealer", "type": "business"},
    "shop=car_repair": {"slug": "mechanic", "type": "business"},
    "shop=car_parts": {"slug": "car-parts", "type": "business"},
    "shop=tyres": {"slug": "tire-shop", "type": "business"},
    "amenity=car_rental": {"slug": "car-rental", "type": "business"},
    "amenity=parking": {"slug": "parking", "type": "business"},

    # Real Estate
    "office=estate_agent": {"slug": "estate-agency", "type": "business"},

    # Entertainment
    "amenity=cinema": {"slug": "cinema", "type": "business"},
    "amenity=theatre": {"slug": "theater", "type": "business"},
    "amenity=nightclub": {"slug": "nightclub", "type": "business"},
    "leisure=bowling_alley": {"slug": "bowling", "type": "business"},
    "leisure=amusement_arcade": {"slug": "arcade", "type": "business"},
    "tourism=museum": {"slug": "museum", "type": "business"},

    # Education
    "amenity=school": {"slug": "education", "type": "business"},
    "amenity=college": {"slug": "education", "type": "business"},
    "amenity=university": {"slug": "education", "type": "business"},
    "amenity=kindergarten": {"slug": "kindergarten", "type": "business"},
    "amenity=driving_school": {"slug": "driving-school", "type": "business"},
    "amenity=language_school": {"slug": "language-school", "type": "business"},
    "amenity=music_school": {"slug": "music-school", "type": "business"},

    # Accommodation
    "tourism=hotel": {"slug": "hotel", "type": "business"},
    "tourism=motel": {"slug": "hotel", "type": "business"},
    "tourism=hostel": {"slug": "hostel", "type": "business"},
    "tourism=guest_house": {"slug": "guesthouse", "type": "business"},
    "tourism=apartment": {"slug": "apart-hotel", "type": "business"},

    # Home & Garden
    "shop=furniture": {"slug": "home-garden", "type": "business"},
    "shop=hardware": {"slug": "home-garden", "type": "business"},
    "shop=doityourself": {"slug": "home-garden", "type": "business"},
    "shop=garden_centre": {"slug": "home-garden", "type": "business"},
    "shop=florist": {"slug": "home-garden", "type": "business"},
}


# ============================================================================
# DATA MODELS
# ============================================================================

@dataclass
class Contact:
    phone: Optional[str] = None
    phone_secondary: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    instagram: Optional[str] = None
    facebook: Optional[str] = None
    twitter: Optional[str] = None
    whatsapp: Optional[str] = None

@dataclass
class ParentInfo:
    """Information about potential parent listing"""
    name: str
    entity_type: str  # 'brand' or 'business'
    wikidata_id: Optional[str] = None
    wikipedia: Optional[str] = None
    confidence: float = 0.0  # 0.0 to 1.0
    source_field: str = ""  # which OSM field this came from

@dataclass
class BusinessData:
    """Complete business data extracted from OSM"""
    osm_id: int
    osm_type: str
    name: str
    latitude: float
    longitude: float
    city_code: str

    # Category info
    category_slug: str
    entity_type: str = "business"

    # Location
    address: Optional[str] = None
    district_id: Optional[int] = None

    # Parent info (resolved)
    parent_info: Optional[ParentInfo] = None

    # Contact
    contact: Contact = field(default_factory=Contact)

    # Hours
    opening_hours_raw: Optional[str] = None
    opening_hours: List[Dict] = field(default_factory=list)

    # Description
    description: Optional[str] = None

    # Raw OSM data
    raw_tags: Dict = field(default_factory=dict)

    def generate_slug(self) -> str:
        tr_map = {
            'ş': 's', 'Ş': 'S', 'ı': 'i', 'İ': 'I', 'ğ': 'g', 'Ğ': 'G',
            'ü': 'u', 'Ü': 'U', 'ö': 'o', 'Ö': 'O', 'ç': 'c', 'Ç': 'C'
        }
        slug = self.name.lower()
        for tr_char, en_char in tr_map.items():
            slug = slug.replace(tr_char, en_char)
        slug = re.sub(r'[^a-z0-9\s-]', '', slug)
        slug = re.sub(r'[\s_]+', '-', slug)
        slug = re.sub(r'-+', '-', slug).strip('-')[:50]

        # Use OSM ID for guaranteed uniqueness
        # return f"{slug}-osm{self.osm_type[0]}{self.osm_id}" if slug else f"business-osm{self.osm_type[0]}{self.osm_id}"

        unique_hash = hashlib.md5(f"{self.osm_type}{self.osm_id}".encode()).hexdigest()[:8]
        return f"{slug}-{unique_hash}" if slug else f"business-{unique_hash}"

    def generate_id(self) -> str:
        """Generate deterministic UUID from OSM ID"""
        unique = f"osm-{self.osm_type}-{self.osm_id}"
        return str(uuid.uuid5(uuid.NAMESPACE_DNS, unique))

# ============================================================================
# PARENT RESOLVER - Multi-step fallback mechanism
# ============================================================================

class ParentResolver:
    """
    Resolves parent listing from OSM tags using confidence-based fallback.

    Confidence hierarchy:
    1. Wikidata ID match (0.95) - Most reliable, global unique identifier
    2. Wikipedia match (0.85) - Very reliable
    3. Known brands database match (0.80) - Our curated list
    4. Exact name match in existing listings (0.70)
    5. Raw brand/operator name (0.50) - Least confident, creates new
    """

    def __init__(self, client: Optional[Client] = None):
        self.client = client
        self.wikidata_cache: Dict[str, str] = {}
        self.name_cache: Dict[str, Dict] = {}
        self.known_brands = self._build_known_brands()

        self.stats = {
            "resolved_by_wikidata": 0,
            "resolved_by_known_brand": 0,
            "resolved_by_name_match": 0,
            "created_new": 0,
            "failed": 0,
            "resolve_calls": 0,
            "resolve_found": 0,
        }

        if client:
            self._load_existing_parents()

    def _normalize_turkish(self, text: str) -> str:
        if not text:
            return ""
        text = text.replace('İ', 'i').replace('I', 'ı')
        text = text.lower()
        tr_map = {'i̇': 'i', 'ı': 'i', 'ğ': 'g', 'ü': 'u', 'ş': 's', 'ö': 'o', 'ç': 'c'}
        for tr, en in tr_map.items():
            text = text.replace(tr, en)
        return text.strip()

    def _build_known_brands(self) -> Dict[str, Dict]:
        """
        Build normalized lookup table.

        NOTE: For physical locations (stores, gas stations, restaurants),
        the parent should be "business" (company), NOT "brand".

        "brand" type is for product brands that don't operate physical locations.
        """
        raw_brands = {
            # =====================================================
            # SUPERMARKETS / RETAIL CHAINS - These are BUSINESSES
            # =====================================================
            "BİM": {"name": "BİM", "type": "business", "wikidata": "Q1022075", "category": "retail"},
            "A101": {"name": "A101", "type": "business", "wikidata": "Q6254313", "category": "retail"},
            "ŞOK": {"name": "ŞOK", "type": "business", "wikidata": "Q19613092", "category": "retail"},
            "Migros": {"name": "Migros", "type": "business", "wikidata": "Q1754510", "category": "retail"},
            "CarrefourSA": {"name": "CarrefourSA", "type": "business", "wikidata": "Q3256662", "category": "retail"},
            "Carrefour": {"name": "CarrefourSA", "type": "business", "wikidata": "Q3256662", "category": "retail"},
            "Metro": {"name": "Metro", "type": "business", "wikidata": "Q13610282", "category": "retail"},
            "Hakmar": {"name": "Hakmar", "type": "business", "category": "retail"},
            "File": {"name": "File", "type": "business", "category": "retail"},
            "Macro Center": {"name": "Macro Center", "type": "business", "category": "retail"},
            "Bizim Toptan": {"name": "Bizim Toptan", "type": "business", "category": "retail"},

            # =====================================================
            # FAST FOOD CHAINS - These are BUSINESSES (franchisors)
            # =====================================================
            "McDonald's": {"name": "McDonald's", "type": "business", "wikidata": "Q38076", "category": "fast-food"},
            "Burger King": {"name": "Burger King", "type": "business", "wikidata": "Q177054", "category": "fast-food"},
            "KFC": {"name": "KFC", "type": "business", "wikidata": "Q524757", "category": "fast-food"},
            "Popeyes": {"name": "Popeyes", "type": "business", "wikidata": "Q2349353", "category": "fast-food"},
            "Domino's": {"name": "Domino's", "type": "business", "wikidata": "Q839466", "category": "fast-food"},
            "Domino's Pizza": {"name": "Domino's", "type": "business", "wikidata": "Q839466", "category": "fast-food"},
            "Little Caesars": {"name": "Little Caesars", "type": "business", "wikidata": "Q1393809", "category": "fast-food"},
            "Sbarro": {"name": "Sbarro", "type": "business", "wikidata": "Q2589409", "category": "fast-food"},
            "Subway": {"name": "Subway", "type": "business", "wikidata": "Q244457", "category": "fast-food"},
            "Papa John's": {"name": "Papa John's", "type": "business", "wikidata": "Q2759586", "category": "fast-food"},
            "Pizza Hut": {"name": "Pizza Hut", "type": "business", "wikidata": "Q191615", "category": "fast-food"},
            "Arby's": {"name": "Arby's", "type": "business", "wikidata": "Q630866", "category": "fast-food"},

            # Turkish Fast Food
            "Simit Sarayı": {"name": "Simit Sarayı", "type": "business", "wikidata": "Q3485994", "category": "bakery"},
            "Köfteci Yusuf": {"name": "Köfteci Yusuf", "type": "business", "category": "restaurant"},
            "Tavuk Dünyası": {"name": "Tavuk Dünyası", "type": "business", "category": "fast-food"},
            "Usta Dönerci": {"name": "Usta Dönerci", "type": "business", "category": "fast-food"},
            "Baydöner": {"name": "Baydöner", "type": "business", "category": "fast-food"},
            "Dönerci Şahin Usta": {"name": "Dönerci Şahin Usta", "type": "business", "category": "fast-food"},

            # =====================================================
            # CAFES - These are BUSINESSES
            # =====================================================
            "Starbucks": {"name": "Starbucks", "type": "business", "wikidata": "Q37158", "category": "cafe"},
            "Kahve Dünyası": {"name": "Kahve Dünyası", "type": "business", "wikidata": "Q27979858", "category": "cafe"},
            "Caribou Coffee": {"name": "Caribou Coffee", "type": "business", "wikidata": "Q5039494", "category": "cafe"},
            "Gloria Jean's Coffees": {"name": "Gloria Jean's", "type": "business", "wikidata": "Q2666313", "category": "cafe"},
            "Gloria Jean's": {"name": "Gloria Jean's", "type": "business", "wikidata": "Q2666313", "category": "cafe"},
            "Espresso Lab": {"name": "Espresso Lab", "type": "business", "category": "cafe"},
            "Tchibo": {"name": "Tchibo", "type": "business", "wikidata": "Q564213", "category": "cafe"},
            "Costa Coffee": {"name": "Costa Coffee", "type": "business", "wikidata": "Q608845", "category": "cafe"},
            "Caffè Nero": {"name": "Caffè Nero", "type": "business", "wikidata": "Q5765670", "category": "cafe"},

            # =====================================================
            # GAS STATIONS - These are BUSINESSES (oil companies)
            # =====================================================
            "Shell": {"name": "Shell", "type": "business", "wikidata": "Q154950", "category": "automotive"},
            "BP": {"name": "BP", "type": "business", "wikidata": "Q152057", "category": "automotive"},
            "Opet": {"name": "Opet", "type": "business", "wikidata": "Q7096951", "category": "automotive"},
            "OPET": {"name": "Opet", "type": "business", "wikidata": "Q7096951", "category": "automotive"},
            "Petrol Ofisi": {"name": "Petrol Ofisi", "type": "business", "wikidata": "Q1278087", "category": "automotive"},
            "PO": {"name": "Petrol Ofisi", "type": "business", "wikidata": "Q1278087", "category": "automotive"},
            "Total": {"name": "Total", "type": "business", "wikidata": "Q154037", "category": "automotive"},
            "TotalEnergies": {"name": "Total", "type": "business", "wikidata": "Q154037", "category": "automotive"},
            "Aytemiz": {"name": "Aytemiz", "type": "business", "category": "automotive"},
            "Lukoil": {"name": "Lukoil", "type": "business", "wikidata": "Q329347", "category": "automotive"},
            "LUKOIL": {"name": "Lukoil", "type": "business", "wikidata": "Q329347", "category": "automotive"},
            "Türkiye Petrolleri": {"name": "Türkiye Petrolleri", "type": "business", "category": "automotive"},
            "TP": {"name": "Türkiye Petrolleri", "type": "business", "category": "automotive"},
            "GO": {"name": "GO", "type": "business", "category": "automotive"},
            "Esso": {"name": "Esso", "type": "business", "wikidata": "Q867662", "category": "automotive"},
            "Alpet": {"name": "Alpet", "type": "business", "category": "automotive"},
            "Moil": {"name": "Moil", "type": "business", "category": "automotive"},

            # =====================================================
            # BANKS - These are BUSINESSES
            # =====================================================
            "Ziraat Bankası": {"name": "Ziraat Bankası", "type": "business", "wikidata": "Q696003", "category": "services"},
            "T.C. Ziraat Bankası": {"name": "Ziraat Bankası", "type": "business", "wikidata": "Q696003", "category": "services"},
            "İş Bankası": {"name": "Türkiye İş Bankası", "type": "business", "wikidata": "Q909613", "category": "services"},
            "Türkiye İş Bankası": {"name": "Türkiye İş Bankası", "type": "business", "wikidata": "Q909613", "category": "services"},
            "Garanti BBVA": {"name": "Garanti BBVA", "type": "business", "wikidata": "Q1494005", "category": "services"},
            "Garanti Bankası": {"name": "Garanti BBVA", "type": "business", "wikidata": "Q1494005", "category": "services"},
            "Akbank": {"name": "Akbank", "type": "business", "wikidata": "Q2634170", "category": "services"},
            "Yapı Kredi": {"name": "Yapı Kredi", "type": "business", "wikidata": "Q8049438", "category": "services"},
            "Yapı ve Kredi Bankası": {"name": "Yapı Kredi", "type": "business", "wikidata": "Q8049438", "category": "services"},
            "Halkbank": {"name": "Halkbank", "type": "business", "wikidata": "Q3593818", "category": "services"},
            "Türkiye Halk Bankası": {"name": "Halkbank", "type": "business", "wikidata": "Q3593818", "category": "services"},
            "VakıfBank": {"name": "VakıfBank", "type": "business", "wikidata": "Q1148521", "category": "services"},
            "Vakıfbank": {"name": "VakıfBank", "type": "business", "wikidata": "Q1148521", "category": "services"},
            "QNB Finansbank": {"name": "QNB Finansbank", "type": "business", "wikidata": "Q3374950", "category": "services"},
            "Finansbank": {"name": "QNB Finansbank", "type": "business", "wikidata": "Q3374950", "category": "services"},
            "Denizbank": {"name": "Denizbank", "type": "business", "wikidata": "Q1187686", "category": "services"},
            "DenizBank": {"name": "Denizbank", "type": "business", "wikidata": "Q1187686", "category": "services"},
            "TEB": {"name": "TEB", "type": "business", "wikidata": "Q7862447", "category": "services"},
            "ING": {"name": "ING", "type": "business", "wikidata": "Q645708", "category": "services"},
            "HSBC": {"name": "HSBC", "type": "business", "wikidata": "Q190464", "category": "services"},
            "PTT": {"name": "PTT", "type": "business", "wikidata": "Q1809344", "category": "services"},
            "Enpara": {"name": "Enpara", "type": "business", "category": "services"},
            "Kuveyt Türk": {"name": "Kuveyt Türk", "type": "business", "wikidata": "Q6450925", "category": "services"},
            "Albaraka Türk": {"name": "Albaraka Türk", "type": "business", "category": "services"},
            "Şekerbank": {"name": "Şekerbank", "type": "business", "wikidata": "Q7828399", "category": "services"},
            "Türk Ekonomi Bankası": {"name": "TEB", "type": "business", "wikidata": "Q7862447", "category": "services"},

            # =====================================================
            # TELECOM - These are BUSINESSES
            # =====================================================
            "Turkcell": {"name": "Turkcell", "type": "business", "wikidata": "Q283852", "category": "retail"},
            "Vodafone": {"name": "Vodafone", "type": "business", "wikidata": "Q122141", "category": "retail"},
            "Türk Telekom": {"name": "Türk Telekom", "type": "business", "wikidata": "Q1115672", "category": "retail"},

            # =====================================================
            # ELECTRONICS RETAILERS - These are BUSINESSES
            # =====================================================
            "MediaMarkt": {"name": "MediaMarkt", "type": "business", "wikidata": "Q2381223", "category": "retail"},
            "Media Markt": {"name": "MediaMarkt", "type": "business", "wikidata": "Q2381223", "category": "retail"},
            "Teknosa": {"name": "Teknosa", "type": "business", "wikidata": "Q3516859", "category": "retail"},
            "Vatan Bilgisayar": {"name": "Vatan Bilgisayar", "type": "business", "category": "retail"},

            # =====================================================
            # CLOTHING RETAILERS - These are BUSINESSES
            # =====================================================
            "LC Waikiki": {"name": "LC Waikiki", "type": "business", "wikidata": "Q3261055", "category": "retail"},
            "DeFacto": {"name": "DeFacto", "type": "business", "wikidata": "Q5765862", "category": "retail"},
            "Koton": {"name": "Koton", "type": "business", "wikidata": "Q6433629", "category": "retail"},
            "Mavi": {"name": "Mavi", "type": "business", "wikidata": "Q6793571", "category": "retail"},
            "Mavi Jeans": {"name": "Mavi", "type": "business", "wikidata": "Q6793571", "category": "retail"},
            "Colin's": {"name": "Colin's", "type": "business", "category": "retail"},
            "Zara": {"name": "Zara", "type": "business", "wikidata": "Q147662", "category": "retail"},
            "H&M": {"name": "H&M", "type": "business", "wikidata": "Q188326", "category": "retail"},
            "Bershka": {"name": "Bershka", "type": "business", "wikidata": "Q827258", "category": "retail"},
            "Pull&Bear": {"name": "Pull&Bear", "type": "business", "wikidata": "Q3408218", "category": "retail"},
            "Boyner": {"name": "Boyner", "type": "business", "wikidata": "Q4951718", "category": "retail"},
            "YKM": {"name": "YKM", "type": "business", "category": "retail"},
            "Mango": {"name": "Mango", "type": "business", "wikidata": "Q136503", "category": "retail"},
            "FLO": {"name": "FLO", "type": "business", "category": "retail"},
            "Kiğılı": {"name": "Kiğılı", "type": "business", "category": "retail"},
            "Vakko": {"name": "Vakko", "type": "business", "wikidata": "Q7910840", "category": "retail"},
            "Adidas": {"name": "Adidas", "type": "business", "wikidata": "Q3895", "category": "retail"},
            "Nike": {"name": "Nike", "type": "business", "wikidata": "Q483915", "category": "retail"},
            "Puma": {"name": "Puma", "type": "business", "wikidata": "Q157064", "category": "retail"},
            "Decathlon": {"name": "Decathlon", "type": "business", "wikidata": "Q509349", "category": "retail"},
            "Intersport": {"name": "Intersport", "type": "business", "wikidata": "Q666888", "category": "retail"},

            # =====================================================
            # HEALTH & BEAUTY - These are BUSINESSES
            # =====================================================
            "Gratis": {"name": "Gratis", "type": "business", "category": "health-beauty"},
            "Watsons": {"name": "Watsons", "type": "business", "wikidata": "Q7974737", "category": "health-beauty"},
            "Rossmann": {"name": "Rossmann", "type": "business", "wikidata": "Q316004", "category": "health-beauty"},
            "Eve": {"name": "Eve", "type": "business", "category": "health-beauty"},
            "Sephora": {"name": "Sephora", "type": "business", "wikidata": "Q2408041", "category": "health-beauty"},

            # =====================================================
            # HOME / FURNITURE - These are BUSINESSES
            # =====================================================
            "IKEA": {"name": "IKEA", "type": "business", "wikidata": "Q54078", "category": "home-garden"},
            "Koçtaş": {"name": "Koçtaş", "type": "business", "wikidata": "Q6430953", "category": "home-garden"},
            "Bauhaus": {"name": "Bauhaus", "type": "business", "wikidata": "Q672043", "category": "home-garden"},
            "Bellona": {"name": "Bellona", "type": "business", "category": "home-garden"},
            "İstikbal": {"name": "İstikbal", "type": "business", "category": "home-garden"},
            "Evidea": {"name": "Evidea", "type": "business", "category": "home-garden"},
            "Tekzen": {"name": "Tekzen", "type": "business", "category": "home-garden"},

            # =====================================================
            # HOTELS - These are BUSINESSES
            # =====================================================
            "Hilton": {"name": "Hilton", "type": "business", "wikidata": "Q598884", "category": "accommodation"},
            "Marriott": {"name": "Marriott", "type": "business", "wikidata": "Q1141173", "category": "accommodation"},
            "Radisson": {"name": "Radisson", "type": "business", "wikidata": "Q1751077", "category": "accommodation"},
            "Holiday Inn": {"name": "Holiday Inn", "type": "business", "wikidata": "Q1624410", "category": "accommodation"},
            "Ibis": {"name": "Ibis", "type": "business", "wikidata": "Q920166", "category": "accommodation"},
            "Wyndham": {"name": "Wyndham", "type": "business", "wikidata": "Q969799", "category": "accommodation"},
            "Dedeman": {"name": "Dedeman", "type": "business", "category": "accommodation"},
            "Rixos": {"name": "Rixos", "type": "business", "category": "accommodation"},

            # =====================================================
            # PHARMACIES - These are BUSINESSES (chains)
            # =====================================================
            "Dr. Ecza Deposu": {"name": "Dr. Ecza Deposu", "type": "business", "category": "pharmacy"},

            # =====================================================
            # COURIER / LOGISTICS - These are BUSINESSES
            # =====================================================
            "Yurtiçi Kargo": {"name": "Yurtiçi Kargo", "type": "business", "wikidata": "Q8061430", "category": "services"},
            "Aras Kargo": {"name": "Aras Kargo", "type": "business", "category": "services"},
            "MNG Kargo": {"name": "MNG Kargo", "type": "business", "category": "services"},
            "Sürat Kargo": {"name": "Sürat Kargo", "type": "business", "category": "services"},
            "UPS": {"name": "UPS", "type": "business", "wikidata": "Q155026", "category": "services"},
            "DHL": {"name": "DHL", "type": "business", "wikidata": "Q489815", "category": "services"},
            "FedEx": {"name": "FedEx", "type": "business", "wikidata": "Q459477", "category": "services"},
            "Trendyol Express": {"name": "Trendyol Express", "type": "business", "category": "services"},
            "Getir": {"name": "Getir", "type": "business", "wikidata": "Q65067653", "category": "services"},

            # =====================================================
            # CAR RENTAL - These are BUSINESSES
            # =====================================================
            "Avis": {"name": "Avis", "type": "business", "wikidata": "Q791136", "category": "automotive"},
            "Hertz": {"name": "Hertz", "type": "business", "wikidata": "Q1543874", "category": "automotive"},
            "Europcar": {"name": "Europcar", "type": "business", "wikidata": "Q1376256", "category": "automotive"},
            "Budget": {"name": "Budget", "type": "business", "wikidata": "Q1001437", "category": "automotive"},
            "Enterprise": {"name": "Enterprise", "type": "business", "wikidata": "Q1337374", "category": "automotive"},

            # =====================================================
            # GYMS / FITNESS - These are BUSINESSES
            # =====================================================
            "MAC": {"name": "MAC", "type": "business", "category": "health-beauty"},
            "Mars Athletic Club": {"name": "Mars Athletic Club", "type": "business", "category": "health-beauty"},
        }

        # Build normalized lookup
        brands = {}
        for original_name, info in raw_brands.items():
            normalized = self._normalize_turkish(original_name)
            brands[normalized] = info

            compact = re.sub(r'[^a-z0-9]', '', normalized)
            if compact and compact != normalized:
                brands[compact] = info

            if info.get("wikidata"):
                brands[f"wd:{info['wikidata']}"] = info

        logger.info(f"📚 Built known brands: {len(raw_brands)} entries, {len(brands)} lookup keys")
        return brands
    def _load_existing_parents(self):
        """Load existing parent listings from database"""
        if not self.client:
            return

        try:
            # Load brands and businesses
            response = self.client.table("listings")\
                .select("id, name, entity_type")\
                .in_("entity_type", ["brand", "business"])\
                .execute()

            for row in response.data:
                name_normalized = self._normalize_turkish(row["name"])
                self.name_cache[name_normalized] = {
                    "id": row["id"],
                    "type": row["entity_type"]
                }

            # Load wikidata mappings
            try:
                sources_response = self.client.table("listing_sources")\
                    .select("listing_id, raw_data")\
                    .eq("source", "openstreetmap")\
                    .not_.is_("raw_data", "null")\
                    .execute()

                for row in sources_response.data:
                    try:
                        raw = row["raw_data"]
                        if isinstance(raw, str):
                            raw = json.loads(raw)
                        for field in ["brand:wikidata", "operator:wikidata", "network:wikidata"]:
                            wikidata = raw.get(field)
                            if wikidata:
                                self.wikidata_cache[wikidata] = row["listing_id"]
                    except:
                        pass
            except Exception as e:
                logger.error(f"Failed to load listing sources: {e}")

            logger.info(f"🏷️  Loaded {len(self.name_cache)} parents, {len(self.wikidata_cache)} wikidata")

        except Exception as e:
            logger.error(f"Failed to load parents: {e}")
    def resolve(self, tags: Dict[str, str], fallback_category: str = "services") -> Optional[ParentInfo]:
        """Resolve parent from OSM tags"""
        self.stats["resolve_calls"] += 1

        if not tags:
            return None

        candidates = []

        # === STEP 1: Wikidata (highest confidence) ===
        for wiki_field, name_field in [
            ("brand:wikidata", "brand"),
            ("operator:wikidata", "operator"),
            ("network:wikidata", "network"),
        ]:
            wikidata = tags.get(wiki_field)
            if not wikidata:
                continue

            # Check wikidata cache
            if wikidata in self.wikidata_cache:
                name = tags.get(name_field) or tags.get("brand") or tags.get("name") or ""
                self.stats["resolve_found"] += 1
                return ParentInfo(
                    name=name,
                    entity_type="business",  # Always business for physical locations
                    wikidata_id=wikidata,
                    confidence=0.98,
                    source_field=wiki_field
                )

            # Check known brands by wikidata
            wd_key = f"wd:{wikidata}"
            if wd_key in self.known_brands:
                info = self.known_brands[wd_key]
                candidates.append(ParentInfo(
                    name=info["name"],
                    entity_type=info["type"],  # Use type from known brands
                    wikidata_id=wikidata,
                    confidence=0.95,
                    source_field=wiki_field
                ))
            else:
                # Unknown wikidata - default to business
                name = tags.get(name_field) or tags.get("brand") or tags.get("operator")
                if name:
                    candidates.append(ParentInfo(
                        name=name,
                        entity_type="business",  # Default to business
                        wikidata_id=wikidata,
                        confidence=0.90,
                        source_field=wiki_field
                    ))

        # === STEP 2: Wikipedia ===
        for wiki_field, name_field in [
            ("brand:wikipedia", "brand"),
            ("operator:wikipedia", "operator"),
        ]:
            wiki = tags.get(wiki_field)
            if wiki:
                name = tags.get(name_field) or tags.get("brand") or tags.get("operator")
                if name:
                    candidates.append(ParentInfo(
                        name=name,
                        entity_type="business",  # Default to business
                        wikipedia=wiki,
                        confidence=0.85,
                        source_field=wiki_field
                    ))

        # === STEP 3: Known brands by name ===
        for field in ["brand", "operator", "network"]:
            name = tags.get(field)
            if not name:
                continue

            normalized = self._normalize_turkish(name)

            if normalized in self.known_brands:
                info = self.known_brands[normalized]
                candidates.append(ParentInfo(
                    name=info["name"],
                    entity_type=info["type"],
                    wikidata_id=info.get("wikidata"),
                    confidence=0.80,
                    source_field=field
                ))
                continue

            compact = re.sub(r'[^a-z0-9]', '', normalized)
            if compact in self.known_brands:
                info = self.known_brands[compact]
                candidates.append(ParentInfo(
                    name=info["name"],
                    entity_type=info["type"],
                    wikidata_id=info.get("wikidata"),
                    confidence=0.78,
                    source_field=field
                ))
                continue

        # === STEP 4: Existing listings by name ===
        for field in ["brand", "operator", "network"]:
            name = tags.get(field)
            if not name:
                continue

            normalized = self._normalize_turkish(name)
            if normalized in self.name_cache:
                cached = self.name_cache[normalized]
                candidates.append(ParentInfo(
                    name=name,
                    entity_type=cached["type"],
                    confidence=0.70,
                    source_field=field
                ))

        # === STEP 5: Raw brand/operator (create new as BUSINESS) ===
        for field in ["brand", "operator"]:
            name = tags.get(field)
            if name and len(name) >= 2:
                business_name = tags.get("name", "")
                if name.lower() != business_name.lower():
                    candidates.append(ParentInfo(
                        name=name,
                        entity_type="business",  # Always create as business
                        confidence=0.50,
                        source_field=field
                    ))

        # Return best candidate
        if candidates:
            candidates.sort(key=lambda x: x.confidence, reverse=True)
            self.stats["resolve_found"] += 1
            return candidates[0]

        return None

    # Complete get_or_create_parent_id with full error handling:

    def get_or_create_parent_id(self, parent_info: ParentInfo,
                                 category_slug: str,
                                 category_matcher: 'CategoryMatcher') -> Optional[str]:
        """Get existing parent ID or create new parent listing"""
        if not parent_info or not parent_info.name:
            return None

        try:
            name_normalized = self._normalize_turkish(parent_info.name)

            # 1. Check name cache
            if name_normalized in self.name_cache:
                self.stats["resolved_by_name_match"] += 1
                return self.name_cache[name_normalized]["id"]

            # 2. Check wikidata cache
            if parent_info.wikidata_id and parent_info.wikidata_id in self.wikidata_cache:
                self.stats["resolved_by_wikidata"] += 1
                return self.wikidata_cache[parent_info.wikidata_id]

            # 3. Generate deterministic ID
            parent_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"parent-{name_normalized}"))

            # 4. Check DB
            if self.client:
                try:
                    response = self.client.table("listings")\
                        .select("id")\
                        .eq("id", parent_id)\
                        .limit(1)\
                        .execute()

                    if response.data:
                        self.name_cache[name_normalized] = {"id": parent_id, "type": parent_info.entity_type}
                        if parent_info.wikidata_id:
                            self.wikidata_cache[parent_info.wikidata_id] = parent_id
                        self.stats["resolved_by_name_match"] += 1
                        return parent_id
                except Exception as e:
                    logger.debug(f"DB check error: {e}")

            # 5. Create new
            if not self.client:
                self.name_cache[name_normalized] = {"id": parent_id, "type": parent_info.entity_type}
                return parent_id

            try:
                slug = re.sub(r'[^a-z0-9\s-]', '', name_normalized)
                slug = re.sub(r'[\s_]+', '-', slug).strip('-')[:50]
                suffix = "-company" if parent_info.entity_type == "business" else "-brand"
                slug = f"{slug}{suffix}" if slug else f"parent-{parent_id[:8]}"

                desc_parts = []
                if parent_info.wikidata_id:
                    desc_parts.append(f"Wikidata: {parent_info.wikidata_id}")
                if parent_info.wikipedia:
                    desc_parts.append(f"Wikipedia: {parent_info.wikipedia}")

                parent_data = {
                    "id": parent_id,
                    "slug": slug,
                    "name": parent_info.name,
                    "entity_type": parent_info.entity_type,
                    "status": "active",
                    "description": " | ".join(desc_parts) if desc_parts else None,
                }

                self.client.table("listings").insert(parent_data).execute()
                logger.info(f"✨ Created: {parent_info.name} ({parent_info.entity_type})")

                # Link category (optional, don't fail on error)
                try:
                    category_id = category_matcher.get_category_id(category_slug)
                    if category_id:
                        self.client.table("listing_categories").insert({
                            "listing_id": parent_id,
                            "category_id": category_id,
                            "is_primary": True
                        }).execute()
                except Exception:
                    pass

                # Cache
                self.name_cache[name_normalized] = {"id": parent_id, "type": parent_info.entity_type}
                if parent_info.wikidata_id:
                    self.wikidata_cache[parent_info.wikidata_id] = parent_id

                self.stats["created_new"] += 1
                return parent_id

            except Exception as e:
                error_msg = str(e).lower()
                if "duplicate" in error_msg or "unique" in error_msg or "already exists" in error_msg:
                    self.name_cache[name_normalized] = {"id": parent_id, "type": parent_info.entity_type}
                    if parent_info.wikidata_id:
                        self.wikidata_cache[parent_info.wikidata_id] = parent_id
                    return parent_id
                else:
                    self.stats["failed"] += 1
                    logger.warning(f"Parent creation failed: {parent_info.name}: {e}")
                    return None

        except Exception as e:
            logger.error(f"get_or_create_parent_id error: {e}")
            return None

# ============================================================================
# OPENING HOURS PARSER
# ============================================================================

class OpeningHoursParser:
    """Parse OSM opening_hours format into structured data"""

    DAY_MAP = {
        'mo': 0, 'tu': 1, 'we': 2, 'th': 3, 'fr': 4, 'sa': 5, 'su': 6,
        'mon': 0, 'tue': 1, 'wed': 2, 'thu': 3, 'fri': 4, 'sat': 5, 'sun': 6,
    }

    @classmethod
    def parse(cls, hours_str: str) -> List[Dict]:
        """
        Parse opening hours string into list of dicts
        Returns: [{"day": 0-6, "open": "HH:MM", "close": "HH:MM", "closed": bool}]
        """
        if not hours_str:
            return []

        hours_str = hours_str.lower().strip()
        results = []

        # Handle 24/7
        if hours_str == "24/7":
            for day in range(7):
                results.append({
                    "day_of_week": day,
                    "open_time": "00:00",
                    "close_time": "23:59",
                    "is_closed": False
                })
            return results

        # Handle "off" or "closed"
        if hours_str in ("off", "closed"):
            for day in range(7):
                results.append({
                    "day_of_week": day,
                    "open_time": None,
                    "close_time": None,
                    "is_closed": True
                })
            return results

        try:
            # Split by semicolons for multiple rules
            rules = hours_str.replace(',', ';').split(';')

            day_hours = {}  # day -> (open, close)

            for rule in rules:
                rule = rule.strip()
                if not rule:
                    continue

                # Parse "Mo-Fr 09:00-18:00" or "Sa 09:00-14:00" format
                parts = rule.split()
                if len(parts) < 2:
                    continue

                day_part = parts[0]
                time_part = parts[1] if len(parts) > 1 else ""

                # Parse days
                days = cls._parse_days(day_part)

                # Parse time
                if "off" in time_part or "closed" in time_part:
                    for day in days:
                        day_hours[day] = (None, None, True)
                elif "-" in time_part:
                    times = time_part.split("-")
                    if len(times) == 2:
                        open_time = cls._normalize_time(times[0])
                        close_time = cls._normalize_time(times[1])
                        for day in days:
                            day_hours[day] = (open_time, close_time, False)

            # Convert to result list
            for day, (open_t, close_t, closed) in day_hours.items():
                results.append({
                    "day_of_week": day,
                    "open_time": open_t,
                    "close_time": close_t,
                    "is_closed": closed
                })

        except Exception:
            pass  # Return empty on parse error

        return results

    @classmethod
    def _parse_days(cls, day_str: str) -> List[int]:
        """Parse day string like 'Mo-Fr' or 'Sa,Su' into list of day numbers"""
        days = []
        day_str = day_str.lower()

        # Handle range like "mo-fr"
        if "-" in day_str:
            parts = day_str.split("-")
            if len(parts) == 2:
                start = cls.DAY_MAP.get(parts[0][:2])
                end = cls.DAY_MAP.get(parts[1][:2])
                if start is not None and end is not None:
                    if start <= end:
                        days = list(range(start, end + 1))
                    else:  # wrap around (e.g., Fr-Mo)
                        days = list(range(start, 7)) + list(range(0, end + 1))
        else:
            # Single day or comma-separated
            for d in day_str.replace(",", " ").split():
                day_num = cls.DAY_MAP.get(d[:2])
                if day_num is not None:
                    days.append(day_num)

        return days

    @classmethod
    def _normalize_time(cls, time_str: str) -> str:
        """Normalize time to HH:MM format"""
        time_str = time_str.strip().replace(".", ":")

        # Handle formats like "9:00" -> "09:00"
        if ":" in time_str:
            parts = time_str.split(":")
            hour = int(parts[0]) % 24
            minute = int(parts[1][:2]) if len(parts) > 1 else 0
            return f"{hour:02d}:{minute:02d}"

        # Handle formats like "0900"
        if len(time_str) == 4 and time_str.isdigit():
            return f"{time_str[:2]}:{time_str[2:]}"

        return time_str

# ============================================================================
# DISTRICT & CATEGORY MATCHERS
# ============================================================================

class DistrictMatcher:
    def __init__(self):
        self.districts = {}
        self.valid_ids = set()
        self.loaded = False

    def load_from_supabase(self, client: Client):
        try:
            response = client.table("districts").select("id, city_code, name, slug").execute()
            for row in response.data:
                city_code = row["city_code"]
                if city_code not in self.districts:
                    self.districts[city_code] = {}

                district_id = row["id"]
                self.valid_ids.add(district_id)
                name_lower = row["name"].lower()
                slug_lower = row["slug"].lower()
                ascii_name = self._to_ascii(name_lower)

                self.districts[city_code][slug_lower] = district_id
                self.districts[city_code][name_lower] = district_id
                self.districts[city_code][ascii_name] = district_id

            self.loaded = True
            logger.info(f"📍 Loaded {len(self.valid_ids)} districts")
        except Exception as e:
            logger.error(f"Failed to load districts: {e}")

    def _to_ascii(self, text: str) -> str:
        tr_map = {'ş': 's', 'ı': 'i', 'ğ': 'g', 'ü': 'u', 'ö': 'o', 'ç': 'c'}
        for tr, en in tr_map.items():
            text = text.replace(tr, en)
        return text

    def find_district_id(self, city_code: str, district_name: Optional[str]) -> Optional[int]:
        if not district_name or not self.loaded:
            return None

        city_districts = self.districts.get(city_code, {})
        if not city_districts:
            return None

        name_lower = district_name.lower().strip()
        if name_lower in city_districts:
            return city_districts[name_lower]

        name_ascii = self._to_ascii(name_lower)
        if name_ascii in city_districts:
            return city_districts[name_ascii]

        # Partial match
        for key, dist_id in city_districts.items():
            if key in name_lower or name_lower in key:
                return dist_id

        return None

    def is_valid_id(self, district_id: Optional[int]) -> bool:
        return district_id is None or district_id in self.valid_ids


class CategoryMatcher:
    def __init__(self):
        self.categories = {}  # slug -> {id, parent_id, allowed_types}
        self.loaded = False

    def load_from_supabase(self, client: Client):
        try:
            response = client.table("categories").select("id, slug, parent_id, allowed_types").execute()
            for row in response.data:
                self.categories[row["slug"]] = {
                    "id": row["id"],
                    "parent_id": row["parent_id"],
                    "allowed_types": row.get("allowed_types", [])
                }
            self.loaded = True
            logger.info(f"📁 Loaded {len(self.categories)} categories")
        except Exception as e:
            logger.error(f"Failed to load categories: {e}")

    def get_category_id(self, slug: str) -> Optional[str]:
        cat = self.categories.get(slug)
        return cat["id"] if cat else None

    def get_parent_category_id(self, slug: str) -> Optional[str]:
        cat = self.categories.get(slug)
        return cat["parent_id"] if cat else None


# ============================================================================
# OVERPASS CLIENT
# ============================================================================

class OverpassClient:
    def __init__(self):
        self.endpoints = OVERPASS_ENDPOINTS.copy()
        self.current_idx = 0
        self._create_session()
        self.consecutive_errors = 0

    def _create_session(self):
        """Create a fresh session"""
        self.session = requests.Session()
        self.session.headers.update({'User-Agent': 'TurkeyBusinessDB/4.0'})
        # Limit connections to avoid overwhelming
        adapter = requests.adapters.HTTPAdapter(
            pool_connections=5,
            pool_maxsize=5,
            max_retries=0  # We handle retries ourselves
        )
        self.session.mount('https://', adapter)
        self.session.mount('http://', adapter)

    def rotate_endpoint(self):
        self.current_idx = (self.current_idx + 1) % len(self.endpoints)

    def query(self, query: str) -> Optional[dict]:
        for attempt in range(MAX_RETRIES):
            try:
                response = self.session.post(
                    self.endpoints[self.current_idx],
                    data={'data': query},
                    timeout=REQUEST_TIMEOUT
                )
                if response.status_code == 200:
                    self.consecutive_errors = 0
                    return response.json()
                elif response.status_code in (429, 502, 503, 504):
                    self.rotate_endpoint()
                    time.sleep(RETRY_DELAY if response.status_code != 429 else 60)

            except requests.exceptions.Timeout:
                self.rotate_endpoint()
                time.sleep(RETRY_DELAY)

            except (requests.exceptions.ConnectionError,
                    requests.exceptions.ChunkedEncodingError) as e:
                # Connection issues - recreate session
                self.consecutive_errors += 1
                logger.debug(f"Connection error ({self.consecutive_errors}): {type(e).__name__}")

                if self.consecutive_errors >= 3:
                    logger.warning("Multiple connection errors, recreating session...")
                    self._create_session()
                    self.consecutive_errors = 0
                    time.sleep(RETRY_DELAY * 2)
                else:
                    self.rotate_endpoint()
                    time.sleep(RETRY_DELAY)

            except Exception as e:
                # Catch LocalProtocolError and other httpcore/urllib3 errors
                error_name = type(e).__name__
                if 'Protocol' in error_name or 'Connection' in error_name:
                    logger.debug(f"Protocol error: {error_name}, recreating session")
                    self._create_session()
                    time.sleep(RETRY_DELAY * 2)
                else:
                    logger.debug(f"Unexpected error: {e}")
                    time.sleep(RETRY_DELAY)

        return None

    def generate_grid(self, bbox: tuple) -> list:
        south, west, north, east = bbox
        cells = []
        lat = south
        while lat < north:
            lon = west
            while lon < east:
                cells.append((round(lat, 4), round(lon, 4),
                              round(min(lat + GRID_SIZE, north), 4),
                              round(min(lon + GRID_SIZE, east), 4)))
                lon += GRID_SIZE
            lat += GRID_SIZE
        return cells

    def fetch_pois(self, bbox: tuple, tag: str) -> list:
        """Fetch POIs with ALL tags (not just name)"""
        key, value = tag.split("=")
        s, w, n, e = bbox

        # Get all tags, not just named ones
        query = f"""[out:json][timeout:60];
(
  nwr["{key}"="{value}"]({s},{w},{n},{e});
);
out center tags qt;"""

        result = self.query(query)
        return result.get("elements", []) if result else []

# ============================================================================
# OSM ELEMENT PROCESSOR
# ============================================================================

class OSMProcessor:
    """Process OSM elements into structured BusinessData"""

    def __init__(self, district_matcher: DistrictMatcher, parent_resolver: ParentResolver):
        self.district_matcher = district_matcher
        self.parent_resolver = parent_resolver
        self.seen = set()

    def process(self, element: dict, city_code: str, osm_tag: str) -> Optional[BusinessData]:
        """Process single OSM element"""
        osm_type = element.get("type", "node")
        osm_id = element.get("id")
        key = f"{osm_type}_{osm_id}"

        if key in self.seen:
            return None

        tags = element.get("tags", {})

        # Get name
        name = (tags.get("name") or tags.get("name:tr") or
                tags.get("name:en") or tags.get("brand"))

        if not name or len(name) < 2:
            return None

        # Get coordinates
        if osm_type == "node":
            lat, lon = element.get("lat"), element.get("lon")
        else:
            center = element.get("center", {})
            lat, lon = center.get("lat"), center.get("lon")

        if not lat or not lon:
            return None

        self.seen.add(key)

        # Get category info
        cat_info = OSM_CATEGORY_MAP.get(osm_tag, {"slug": "services", "type": "business"})

        # Resolve parent using fallback mechanism
        parent_info = self.parent_resolver.resolve(tags, cat_info["slug"])

        # Build address
        addr_parts = []
        district_name = None

        if tags.get("addr:housenumber") and tags.get("addr:street"):
            addr_parts.append(f"{tags['addr:street']} {tags['addr:housenumber']}")
        elif tags.get("addr:street"):
            addr_parts.append(tags["addr:street"])

        district_name = (tags.get("addr:district") or tags.get("addr:suburb") or
                        tags.get("addr:subdistrict") or tags.get("addr:neighbourhood") or
                        tags.get("addr:quarter"))

        if district_name:
            addr_parts.append(district_name)
        if tags.get("addr:postcode"):
            addr_parts.append(tags["addr:postcode"])
        if tags.get("addr:city"):
            addr_parts.append(tags["addr:city"])

        # Extract contact info
        contact = Contact(
            phone=self._clean_phone(tags.get("phone") or tags.get("contact:phone")),
            phone_secondary=self._clean_phone(tags.get("phone:mobile") or tags.get("contact:mobile")),
            email=tags.get("email") or tags.get("contact:email"),
            website=self._clean_url(tags.get("website") or tags.get("contact:website") or tags.get("url")),
            instagram=self._clean_social(tags.get("contact:instagram") or tags.get("instagram")),
            facebook=self._clean_social(tags.get("contact:facebook") or tags.get("facebook")),
            twitter=self._clean_social(tags.get("contact:twitter") or tags.get("twitter")),
            whatsapp=self._clean_phone(tags.get("contact:whatsapp") or tags.get("whatsapp")),
        )

        # Parse opening hours
        hours_raw = tags.get("opening_hours")
        hours_parsed = OpeningHoursParser.parse(hours_raw) if hours_raw else []

        # Get description
        description = tags.get("description") or tags.get("description:en") or tags.get("description:tr")

        return BusinessData(
            osm_id=osm_id,
            osm_type=osm_type,
            name=name.strip(),
            latitude=lat,
            longitude=lon,
            city_code=city_code,
            category_slug=cat_info["slug"],
            entity_type=cat_info.get("type", "business"),
            address=", ".join(addr_parts) if addr_parts else None,
            district_id=self.district_matcher.find_district_id(city_code, district_name),
            parent_info=parent_info,
            contact=contact,
            opening_hours_raw=hours_raw,
            opening_hours=hours_parsed,
            description=description,
            raw_tags=tags,
        )

    def _clean_phone(self, phone: Optional[str]) -> Optional[str]:
        if not phone:
            return None
        # Basic cleaning - keep digits and + sign
        cleaned = re.sub(r'[^\d+\s-]', '', phone).strip()
        return cleaned if len(cleaned) >= 7 else None

    def _clean_url(self, url: Optional[str]) -> Optional[str]:
        if not url:
            return None
        url = url.strip()
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url
        return url if len(url) > 10 else None

    def _clean_social(self, handle: Optional[str]) -> Optional[str]:
        if not handle:
            return None
        # Extract username from URL if needed
        handle = handle.strip()
        if '/' in handle:
            handle = handle.rstrip('/').split('/')[-1]
        # Remove @ prefix
        handle = handle.lstrip('@')
        return handle if len(handle) > 1 else None

# ============================================================================
# DATABASE WRITER
# ============================================================================

class DatabaseWriter:
    """Writes all data to Supabase tables"""

    def __init__(self, client: Client, parent_resolver: ParentResolver,
                 category_matcher: CategoryMatcher, district_matcher: DistrictMatcher):
        self.client = client
        self.parent_resolver = parent_resolver
        self.category_matcher = category_matcher
        self.district_matcher = district_matcher

        self.stats = {
            "listings_inserted": 0,
            "listings_duplicates": 0,
            "listings_with_parent": 0,
            "contacts_inserted": 0,
            "hours_inserted": 0,
            "sources_inserted": 0,
            "categories_linked": 0,
            "errors": 0,
        }

    def write_business(self, biz: BusinessData) -> bool:
        """Write complete business data to all tables"""
        try:
            listing_id = biz.generate_id()
            slug = biz.generate_slug()

            # Validate district_id
            if not self.district_matcher.is_valid_id(biz.district_id):
                biz.district_id = None

            # === RESOLVE PARENT ===
            parent_id = None
            if biz.parent_info:
                parent_id = self.parent_resolver.get_or_create_parent_id(
                    biz.parent_info,
                    biz.category_slug,
                    self.category_matcher
                )
                if parent_id:
                    self.stats["listings_with_parent"] += 1

            # === 1. INSERT LISTING ===
            listing_data = {
                "id": listing_id,
                "slug": slug,
                "name": biz.name[:255],
                "description": biz.description[:1000] if biz.description else None,
                "entity_type": biz.entity_type,
                "status": "pending",
                "parent_id": parent_id,  # <-- This links to parent
                "city_code": biz.city_code,
                "district_id": biz.district_id,
                "address_line": biz.address[:500] if biz.address else None,
                "latitude": float(round(biz.latitude, 6)),
                "longitude": float(round(biz.longitude, 6)),
            }

            try:
                self.client.table("listings").insert(listing_data).execute()
                self.stats["listings_inserted"] += 1
            except Exception as e:
                if "duplicate" in str(e).lower() or "unique" in str(e).lower():
                    self.stats["listings_duplicates"] += 1
                    return False
                raise

            # === 2. INSERT CONTACTS ===
            if self._has_contact(biz.contact):
                self._insert_contacts(listing_id, biz.contact)

            # === 3. INSERT HOURS ===
            if biz.opening_hours:
                self._insert_hours(listing_id, biz.opening_hours)

            # === 4. INSERT SOURCE ===
            self._insert_source(listing_id, biz)

            # === 5. LINK CATEGORY ===
            self._link_category(listing_id, biz.category_slug)

            return True

        except Exception as e:
            self.stats["errors"] += 1
            if self.stats["errors"] <= 5:
                logger.warning(f"Write error: {str(e)[:150]}")
            return False

    def _has_contact(self, contact: Contact) -> bool:
        return any([contact.phone, contact.phone_secondary, contact.email,
                    contact.website, contact.instagram, contact.facebook,
                    contact.twitter, contact.whatsapp])

    def _insert_contacts(self, listing_id: str, contact: Contact):
        try:
            self.client.table("listing_contacts").insert({
                "listing_id": listing_id,
                "phone": contact.phone,
                "phone_secondary": contact.phone_secondary,
                "email": contact.email,
                "website": contact.website,
                "instagram": contact.instagram,
                "facebook": contact.facebook,
                "twitter": contact.twitter,
                "whatsapp": contact.whatsapp,
            }).execute()
            self.stats["contacts_inserted"] += 1
        except Exception as e:
            logger.error(f"Failed to insert listing contacts: {e}")

    def _insert_hours(self, listing_id: str, hours: List[Dict]):
        for h in hours:
            try:
                self.client.table("listing_hours").insert({
                    "listing_id": listing_id,
                    "day_of_week": h["day_of_week"],
                    "open_time": h.get("open_time"),
                    "close_time": h.get("close_time"),
                    "is_closed": h.get("is_closed", False),
                }).execute()
                self.stats["hours_inserted"] += 1
            except Exception as e:
                logger.error(f"Failed to insert listing hours: {e}")

    def _insert_source(self, listing_id: str, biz: BusinessData):
        try:
            self.client.table("listing_sources").insert({
                "id": str(uuid.uuid4()),
                "listing_id": listing_id,
                "source": "openstreetmap",
                "external_id": f"{biz.osm_type}/{biz.osm_id}",
                "external_url": f"https://www.openstreetmap.org/{biz.osm_type}/{biz.osm_id}",
                "raw_data": biz.raw_tags,
                "confidence_score": 0.8,
                "fetched_at": datetime.utcnow().isoformat(),
            }).execute()
            self.stats["sources_inserted"] += 1
        except Exception as e:
            logger.error(f"Failed to insert listing source: {e}")

    def _link_category(self, listing_id: str, category_slug: str):
        try:
            category_id = self.category_matcher.get_category_id(category_slug)
            if category_id:
                self.client.table("listing_categories").insert({
                    "listing_id": listing_id,
                    "category_id": category_id,
                    "is_primary": True,
                }).execute()
                self.stats["categories_linked"] += 1
        except Exception as e:
            logger.error(f"Failed to insert listing category: {e}")

# ============================================================================
# SQL GENERATOR (backup)
# ============================================================================

class SQLGenerator:
    def __init__(self, output_dir: str = "sql_output"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
        self.files = {}
        self.counts = {}
        self.total = 0

    def _get_file(self, table: str):
        if table not in self.files:
            path = f"{self.output_dir}/{table}.sql"
            self.files[table] = open(path, "w", encoding="utf-8")
            self.files[table].write(f"-- {table} data from OSM\n")
            self.files[table].write(f"-- Generated: {datetime.now().isoformat()}\n\n")
            self.counts[table] = 0
        return self.files[table]

    def _esc(self, v) -> str:
        """Escape value for SQL"""
        if v is None:
            return "NULL"
        if isinstance(v, bool):
            return "TRUE" if v else "FALSE"
        if isinstance(v, (int, float)):
            return str(v)
        s = str(v).replace("'", "''").replace("\\", "\\\\")
        return f"'{s}'"

    def write_business(self, biz: BusinessData, parent_id: Optional[str] = None):
        """Write business to SQL files"""
        listing_id = biz.generate_id()
        slug = biz.generate_slug()

        # 1. listings table
        f = self._get_file("listings")
        f.write(f"""INSERT INTO listings (id, slug, name, description, entity_type, status, parent_id, city_code, district_id, address_line, latitude, longitude)
VALUES ({self._esc(listing_id)}, {self._esc(slug)}, {self._esc(biz.name[:255])}, {self._esc(biz.description[:1000] if biz.description else None)}, {self._esc(biz.entity_type)}, 'pending', {self._esc(parent_id)}, {self._esc(biz.city_code)}, {biz.district_id if biz.district_id else 'NULL'}, {self._esc(biz.address[:500] if biz.address else None)}, {biz.latitude:.6f}, {biz.longitude:.6f})
ON CONFLICT (id) DO NOTHING;\n""")
        self.counts["listings"] = self.counts.get("listings", 0) + 1

        # 2. listing_contacts table
        if self._has_contact(biz.contact):
            f = self._get_file("listing_contacts")
            f.write(f"""INSERT INTO listing_contacts (listing_id, phone, phone_secondary, email, website, instagram, facebook, twitter, whatsapp)
VALUES ({self._esc(listing_id)}, {self._esc(biz.contact.phone)}, {self._esc(biz.contact.phone_secondary)}, {self._esc(biz.contact.email)}, {self._esc(biz.contact.website)}, {self._esc(biz.contact.instagram)}, {self._esc(biz.contact.facebook)}, {self._esc(biz.contact.twitter)}, {self._esc(biz.contact.whatsapp)})
ON CONFLICT (listing_id) DO UPDATE SET phone=EXCLUDED.phone, website=EXCLUDED.website;\n""")
            self.counts["listing_contacts"] = self.counts.get("listing_contacts", 0) + 1

        # 3. listing_hours table
        for h in biz.opening_hours:
            f = self._get_file("listing_hours")
            f.write(f"""INSERT INTO listing_hours (listing_id, day_of_week, open_time, close_time, is_closed)
VALUES ({self._esc(listing_id)}, {h['day_of_week']}, {self._esc(h.get('open_time'))}, {self._esc(h.get('close_time'))}, {self._esc(h.get('is_closed', False))})
ON CONFLICT (listing_id, day_of_week) DO UPDATE SET open_time=EXCLUDED.open_time, close_time=EXCLUDED.close_time;\n""")
            self.counts["listing_hours"] = self.counts.get("listing_hours", 0) + 1

        # 4. listing_sources table
        source_id = str(uuid.uuid4())
        f = self._get_file("listing_sources")
        raw_json = json.dumps(biz.raw_tags, ensure_ascii=False).replace("'", "''")
        f.write(f"""INSERT INTO listing_sources (id, listing_id, source, external_id, external_url, raw_data, confidence_score, fetched_at)
VALUES ({self._esc(source_id)}, {self._esc(listing_id)}, 'openstreetmap', {self._esc(f"{biz.osm_type}/{biz.osm_id}")}, {self._esc(f"https://www.openstreetmap.org/{biz.osm_type}/{biz.osm_id}")}, '{raw_json}'::jsonb, 0.8, NOW())
ON CONFLICT (listing_id, source, external_id) DO NOTHING;\n""")
        self.counts["listing_sources"] = self.counts.get("listing_sources", 0) + 1

        self.total += 1

    def write_parent(self, parent_info: ParentInfo, category_slug: str) -> str:
        """Write parent (brand/business) to SQL and return generated ID"""
        name_lower = parent_info.name.lower().strip()
        parent_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"parent-{name_lower}"))

        slug = self._generate_slug(parent_info.name)
        suffix = "-brand" if parent_info.entity_type == "brand" else "-company"
        slug = f"{slug}{suffix}" if slug else f"parent-{parent_id[:8]}"

        # Build description
        desc_parts = []
        if parent_info.wikidata_id:
            desc_parts.append(f"Wikidata: {parent_info.wikidata_id}")
        if parent_info.wikipedia:
            desc_parts.append(f"Wikipedia: {parent_info.wikipedia}")
        description = " | ".join(desc_parts) if desc_parts else None

        f = self._get_file("listings")
        f.write(f"""INSERT INTO listings (id, slug, name, entity_type, status, description)
VALUES ({self._esc(parent_id)}, {self._esc(slug)}, {self._esc(parent_info.name)}, {self._esc(parent_info.entity_type)}, 'active', {self._esc(description)})
ON CONFLICT (id) DO NOTHING;\n""")

        return parent_id

    def _generate_slug(self, name: str) -> str:
        tr_map = {'ş': 's', 'ı': 'i', 'ğ': 'g', 'ü': 'u', 'ö': 'o', 'ç': 'c',
                  'Ş': 'S', 'İ': 'I', 'Ğ': 'G', 'Ü': 'U', 'Ö': 'O', 'Ç': 'C'}
        slug = name.lower()
        for tr, en in tr_map.items():
            slug = slug.replace(tr, en)
        slug = re.sub(r'[^a-z0-9\s-]', '', slug)
        slug = re.sub(r'[\s_]+', '-', slug).strip('-')[:50]
        return slug


    def write_category_link(self, listing_id: str, category_id: str):
        """Write category link"""
        f = self._get_file("listing_categories")
        f.write(f"""INSERT INTO listing_categories (listing_id, category_id, is_primary)
VALUES ({self._esc(listing_id)}, {self._esc(category_id)}, TRUE)
ON CONFLICT (listing_id, category_id) DO NOTHING;\n""")
        self.counts["listing_categories"] = self.counts.get("listing_categories", 0) + 1

    def _has_contact(self, contact: Contact) -> bool:
        return any([contact.phone, contact.phone_secondary, contact.email,
                    contact.website, contact.instagram, contact.facebook,
                    contact.twitter, contact.whatsapp])

    def close(self):
        for f in self.files.values():
            f.close()
        logger.info(f"📁 SQL files written to {self.output_dir}/")
        for table, count in self.counts.items():
            logger.info(f"   {table}: {count:,} records")

# ============================================================================
# PROGRESS TRACKER
# ============================================================================

class ProgressTracker:
    def __init__(self):
        self.state_file = "collector_state.json"
        self.start_time = datetime.now()
        self.last_hb = datetime.now()
        self.stats = {
            "businesses": 0,
            "cities_done": [],
            "current": None,
            "brands_created": 0,
        }

    def load(self) -> Optional[str]:
        if os.path.exists(self.state_file):
            try:
                with open(self.state_file) as f:
                    d = json.load(f)
                    self.stats = d.get("stats", self.stats)
                    return d.get("last_city")
            except:
                pass
        return None

    def save(self, city: str = None):
        with open(self.state_file, "w") as f:
            json.dump({"last_city": city, "stats": self.stats,
                      "timestamp": datetime.now().isoformat()}, f)

    def heartbeat(self, extra: str = ""):
        now = datetime.now()
        if (now - self.last_hb).seconds >= HEARTBEAT_INTERVAL:
            elapsed = now - self.start_time
            h, m = int(elapsed.total_seconds()) // 3600, (int(elapsed.total_seconds()) % 3600) // 60
            logger.info(f"💓 {h}h{m}m | Biz: {self.stats['businesses']:,} | "
                       f"Cities: {len(self.stats['cities_done'])}/81 | {extra}")
            self.last_hb = now

    def city_done(self, code: str, count: int):
        self.stats["cities_done"].append(code)
        self.stats["businesses"] += count
        self.save(code)

# ============================================================================
# MAIN COLLECTOR
# ============================================================================

class TurkeyBusinessCollector:
    def __init__(self, use_supabase: bool = True, generate_sql: bool = True):
        self.overpass = OverpassClient()
        self.progress = ProgressTracker()

        # Initialize matchers
        self.district_matcher = DistrictMatcher()
        self.category_matcher = CategoryMatcher()
        self.parent_resolver: Optional[ParentResolver] = None

        self.use_supabase = use_supabase
        self.generate_sql = generate_sql

        self.db_writer: Optional[DatabaseWriter] = None
        self.sql_gen: Optional[SQLGenerator] = None
        self.processor: Optional[OSMProcessor] = None

        # SQL-only mode brand cache
        self.sql_parent_cache: Dict[str, str] = {}

        if use_supabase:
            if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
                logger.error("❌ Set SUPABASE_URL and SUPABASE_SERVICE_KEY")
                self.use_supabase = False
            else:
                client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
                logger.info("🔑 Connected with service role key")

                # Load reference data
                self.district_matcher.load_from_supabase(client)
                self.category_matcher.load_from_supabase(client)

                # Initialize parent resolver with DB connection
                self.parent_resolver = ParentResolver(client)

                # Initialize DB writer
                self.db_writer = DatabaseWriter(
                    client,
                    self.parent_resolver,
                    self.category_matcher,
                    self.district_matcher
                )
        else:
            # SQL-only mode - parent resolver without DB
            self.parent_resolver = ParentResolver(None)

        if generate_sql:
            self.sql_gen = SQLGenerator()

        # Initialize processor with parent resolver
        if self.parent_resolver:
            self.processor = OSMProcessor(self.district_matcher, self.parent_resolver)

    # In TurkeyBusinessCollector.collect_city method, wrap the inner loop:

    def collect_city(self, code: str) -> int:
        city = TURKEY_CITIES.get(code)
        if not city:
            return 0

        if not self.processor:
            logger.error("Processor not initialized")
            return 0

        self.progress.stats["current"] = city["name"]
        logger.info(f"🏙️  {city['name']} ({code})")

        cells = self.overpass.generate_grid(city["bbox"])
        count = 0
        batch: List[Tuple[BusinessData, str]] = []

        osm_tags = list(OSM_CATEGORY_MAP.keys())

        for ci, cell in enumerate(cells):
            for tag in osm_tags:
                try:
                    elements = self.overpass.fetch_pois(cell, tag)

                    for el in elements:
                        try:
                            biz = self.processor.process(el, code, tag)
                            if biz:
                                batch.append((biz, tag))
                                count += 1
                        except Exception as e:
                            logger.debug(f"Process error: {e}")

                    if len(batch) >= BATCH_SIZE:
                        try:
                            self._flush_batch(batch)
                        except Exception as e:
                            logger.error(f"Flush error: {e}")
                        batch = []

                except Exception as e:
                    logger.debug(f"Fetch error: {e}")

                time.sleep(REQUEST_DELAY)

            self.progress.heartbeat(f"{city['name']} cell {ci+1}/{len(cells)}")

        if batch:
            try:
                self._flush_batch(batch)
            except Exception as e:
                logger.error(f"Final flush error: {e}")

        self.progress.city_done(code, count)

        stats_parts = [f"found {count:,}"]
        if self.db_writer:
            stats_parts.append(f"DB: {self.db_writer.stats['listings_inserted']} ins")
        if self.parent_resolver:
            stats_parts.append(f"{self.parent_resolver.stats['created_new']} parents")
        logger.info(f"✅ {city['name']}: {' | '.join(stats_parts)}")

        return count

    # In _flush_batch, add error handling per item:

    def _flush_batch(self, batch: List[Tuple[BusinessData, str]]):
        """Flush batch to database and/or SQL files"""
        for biz, tag in batch:
            try:
                if self.db_writer:
                    self.db_writer.write_business(biz)

                if self.sql_gen:
                    parent_id = None
                    if biz.parent_info:
                        name_lower = biz.parent_info.name.lower()
                        if name_lower not in self.sql_parent_cache:
                            parent_id = self.sql_gen.write_parent(biz.parent_info, biz.category_slug)
                            self.sql_parent_cache[name_lower] = parent_id
                        else:
                            parent_id = self.sql_parent_cache[name_lower]
                    self.sql_gen.write_business(biz, parent_id)
            except Exception as e:
                logger.error(f"Batch item error: {e}")

    def collect_all(self, resume: bool = True):
        logger.info("=" * 60)
        logger.info("🇹🇷 TURKEY BUSINESS COLLECTOR v4.0")
        logger.info(f"📊 Collecting: {len(OSM_CATEGORY_MAP)} business types")
        logger.info("=" * 60)

        start_idx = 0
        if resume:
            last = self.progress.load()
            if last:
                logger.info(f"📂 Resuming after {last}")
                codes = sorted(TURKEY_CITIES.keys())
                try:
                    start_idx = codes.index(last) + 1
                except ValueError:
                    pass

        for code in sorted(TURKEY_CITIES.keys())[start_idx:]:
            try:
                self.collect_city(code)
            except KeyboardInterrupt:
                logger.info("⏸️  Stopped. Progress saved.")
                self.progress.save()
                break
            except Exception as e:
                logger.error(f"❌ {code}: {e}")

        self.finalize()

    def finalize(self):
        """Finalize collection and print stats"""
        if self.sql_gen:
            self.sql_gen.close()

        elapsed = datetime.now() - self.progress.start_time
        h = int(elapsed.total_seconds()) // 3600
        m = (int(elapsed.total_seconds()) % 3600) // 60

        print("\n" + "=" * 60)
        print("📊 COLLECTION COMPLETE")
        print("=" * 60)
        print(f"⏱️  Runtime: {h}h {m}m")
        print(f"🏢 Businesses found: {self.progress.stats['businesses']:,}")
        print(f"🏙️  Cities completed: {len(self.progress.stats['cities_done'])}/81")

        if self.db_writer:
            print(f"\n💾 Database Stats:")
            print(f"   Listings inserted: {self.db_writer.stats['listings_inserted']:,}")
            print(f"   With parent_id:    {self.db_writer.stats['listings_with_parent']:,}")  # NEW
            print(f"   Duplicates:        {self.db_writer.stats['listings_duplicates']:,}")
            print(f"   Contacts:          {self.db_writer.stats['contacts_inserted']:,}")
            print(f"   Hours records:     {self.db_writer.stats['hours_inserted']:,}")
            print(f"   Sources:           {self.db_writer.stats['sources_inserted']:,}")
            print(f"   Categories:        {self.db_writer.stats['categories_linked']:,}")

        if self.parent_resolver:
            print(f"\n🏷️  Parent Resolution:")
            print(f"   Resolve calls:     {self.parent_resolver.stats['resolve_calls']:,}")
            print(f"   Parents found:     {self.parent_resolver.stats['resolve_found']:,}")
            print(f"   By Wikidata:       {self.parent_resolver.stats['resolved_by_wikidata']}")
            print(f"   By Name Match:     {self.parent_resolver.stats['resolved_by_name_match']}")
            print(f"   Created New:       {self.parent_resolver.stats['created_new']}")
            print(f"   Failed:            {self.parent_resolver.stats['failed']}")

        if self.sql_gen:
            print(f"\n📁 SQL Output: {self.sql_gen.output_dir}/")
            print(f"   Total records: {self.sql_gen.total:,}")


# ============================================================================
# MAIN - Fixed
# ============================================================================

def main():
    import argparse

    parser = argparse.ArgumentParser(description="Turkey Business Collector v4.0")
    parser.add_argument("--city", help="Single city code (e.g., 34 for Istanbul)")
    parser.add_argument("--supabase", action="store_true", help="Write to Supabase")
    parser.add_argument("--no-sql", action="store_true", help="Skip SQL file generation")
    parser.add_argument("--no-resume", action="store_true", help="Start fresh")

    args = parser.parse_args()

    print("🇹🇷 Turkey Business Collector v4.0")
    print("📍 Source: OpenStreetMap")
    print("📊 Captures: names, brands, contacts, hours, addresses")
    print("-" * 60)

    collector = TurkeyBusinessCollector(
        use_supabase=args.supabase,
        generate_sql=not args.no_sql
    )

    if args.city:
        collector.collect_city(args.city)
        collector.finalize()  # No underscore - public method
    else:
        collector.collect_all(resume=not args.no_resume)


if __name__ == "__main__":
    main()
