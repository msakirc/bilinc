#!/usr/bin/env python3
"""
Bilinç — Turkish Brand Product Catalog Scraper

Scrapes product catalog pages from major Turkish food brands and inserts
products as entity_type='product' listings into Supabase.

Brands: Ülker, Eti, Torku, Sütaş, Pınar, Dardanel, Tamek, İçim,
        Doğadan, Uludağ İçecek, Vestel

Usage:
    python brand-products.py                 # Dry run, print stats
    python brand-products.py --supabase      # Scrape + insert into Supabase
    python brand-products.py --brand ulker   # Only scrape one brand
"""

import os
import re
import sys
import json
import time
import logging
import argparse
from html import unescape
from pathlib import Path
from urllib.parse import urljoin, urlparse, unquote

import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

# Use a realistic browser UA — brand sites block simple bot UAs
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/121.0.0.0 Safari/537.36"
)
REQUEST_DELAY = 2
BATCH_SIZE = 200

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("brand-products")

# Fix Windows console encoding for Turkish chars
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


# ============================================================================
# HELPERS
# ============================================================================

def slugify(name: str) -> str:
    """Turkish-aware slug generation."""
    tr_map = {
        'ş': 's', 'Ş': 's', 'ı': 'i', 'İ': 'i', 'ğ': 'g', 'Ğ': 'g',
        'ü': 'u', 'Ü': 'u', 'ö': 'o', 'Ö': 'o', 'ç': 'c', 'Ç': 'c',
    }
    slug = name.lower()
    for tr, en in tr_map.items():
        slug = slug.replace(tr, en)
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s_]+', '-', slug)
    slug = re.sub(r'-+', '-', slug).strip('-')[:80]
    return slug


def normalize_turkish(s: str) -> str:
    """Lowercase + strip Turkish diacritics for dedup keys."""
    tr_map = {
        'ş': 's', 'Ş': 's', 'ı': 'i', 'İ': 'i', 'ğ': 'g', 'Ğ': 'g',
        'ü': 'u', 'Ü': 'u', 'ö': 'o', 'Ö': 'o', 'ç': 'c', 'Ç': 'c',
    }
    s = s.lower()
    for tr, en in tr_map.items():
        s = s.replace(tr, en)
    return s


# Size/quantity patterns to strip for deduplication
SIZE_PATTERNS = [
    r'\b\d+[\.,]?\d*\s*(?:ml|cl|dl|l|lt|litre|liter)\b',
    r'\b\d+[\.,]?\d*\s*(?:mg|g|gr|gram|kg|kilogram)\b',
    r'\b\d+\s*[x×]\s*\d+[\.,]?\d*\s*(?:ml|cl|dl|l|lt|g|gr|kg)\b',
    r"\b\d+['\u2019](?:l[üu]|li)\b",
    r'\b\d+\s*(?:adet|paket|tablet|kapsül|poşet|bardak|şişe|kutu)\b',
    r'\(\s*\d+[\.,]?\d*\s*(?:ml|cl|dl|l|lt|g|gr|kg)\s*\)',
    r'-\s*\d+[\.,]?\d*\s*(?:ml|cl|dl|l|lt|g|gr|kg)\b',
    r'\b\d+\s*(?:cc)\b',
]
SIZE_RE = re.compile('|'.join(SIZE_PATTERNS), re.IGNORECASE)


def clean_product_name(name: str) -> str:
    """Remove size/quantity info for dedup key; preserve variant names."""
    if not name:
        return ""
    cleaned = SIZE_RE.sub('', name)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    cleaned = cleaned.rstrip(' -–,')
    return cleaned


def make_session() -> requests.Session:
    """Return a requests session with browser-like headers.

    Note: We deliberately omit Accept-Encoding to avoid Brotli-compressed
    responses that require the optional 'brotli' package. requests handles
    gzip/deflate natively without this header.
    """
    s = requests.Session()
    s.headers.update({
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
    })
    return s


def fetch(session: requests.Session, url: str, timeout: int = 20) -> requests.Response | None:
    """Fetch URL, return response or None on error."""
    try:
        resp = session.get(url, timeout=timeout, allow_redirects=True)
        resp.raise_for_status()
        return resp
    except requests.RequestException as e:
        logger.warning(f"  Fetch failed for {url}: {e}")
        return None


def get_text(resp: requests.Response) -> str:
    """Get response text with correct encoding (handles mis-declared ISO-8859-1)."""
    # Many Turkish sites send UTF-8 but declare ISO-8859-1 or don't declare at all
    if resp.apparent_encoding and resp.apparent_encoding.upper() in ("UTF-8", "UTF-8-SIG"):
        resp.encoding = resp.apparent_encoding
    elif resp.encoding and resp.encoding.upper() in ("ISO-8859-1", "LATIN-1", "WINDOWS-1252"):
        # Try decoding as UTF-8 first
        try:
            return resp.content.decode("utf-8")
        except UnicodeDecodeError:
            pass
    return resp.text


def extract_next_data(html: str) -> dict | None:
    """Extract __NEXT_DATA__ JSON embedded in Next.js pages."""
    match = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group(1))
    except json.JSONDecodeError:
        return None


def walk_for_named_items(obj, min_depth: int = 0, max_depth: int = 12,
                         require_image: bool = False) -> list[dict]:
    """
    Recursively walk a JSON object looking for {name, category, image?} items.
    Returns list of {name, category, subcategory} dicts.
    """
    found = []
    _walk(obj, 0, max_depth, require_image, found)
    return found


def _walk(obj, depth, max_depth, require_image, found):
    if depth > max_depth:
        return
    if isinstance(obj, list):
        for item in obj:
            _walk(item, depth + 1, max_depth, require_image, found)
    elif isinstance(obj, dict):
        # Candidate product fields
        name = (obj.get("name") or obj.get("title") or obj.get("productName")
                or obj.get("urunAdi") or obj.get("baslik") or obj.get("label"))
        image = (obj.get("image") or obj.get("imageUrl") or obj.get("img")
                 or obj.get("resim") or obj.get("thumbnail"))
        category = (obj.get("category") or obj.get("categoryName")
                    or obj.get("kategori") or obj.get("categoryTitle") or "")
        subcategory = (obj.get("subcategory") or obj.get("subCategoryName")
                       or obj.get("altKategori") or "")

        if name and isinstance(name, str) and 3 < len(name) < 150:
            if not require_image or image:
                found.append({
                    "name": name.strip(),
                    "category": str(category).strip() if category else "",
                    "subcategory": str(subcategory).strip() if subcategory else "",
                })

        for v in obj.values():
            _walk(v, depth + 1, max_depth, require_image, found)


def clean_html_text(raw: str) -> str:
    """Strip HTML tags and decode entities."""
    text = re.sub(r'<[^>]+>', '', raw)
    text = unescape(text)
    return re.sub(r'\s+', ' ', text).strip()


def is_noise_name(name: str) -> bool:
    """Filter out nav/UI strings that aren't product names."""
    noise = [
        'http', 'www.', '.com', '.tr', 'cookie', 'javascript', 'facebook',
        'instagram', 'twitter', 'linkedin', 'youtube', 'sosyal medya',
        'hakkimizda', 'iletisim', 'anasayfa', 'markalarimiz', 'urunlerimiz',
        'surdurulebilirlik', 'sosyal sorumluluk', 'kariyer', 'basin',
    ]
    n_lower = name.lower()
    n_norm = normalize_turkish(n_lower)
    return any(kw in n_norm for kw in noise) or len(name) > 150


# ============================================================================
# BRAND SCRAPERS
# ============================================================================

def scrape_ulker(session: requests.Session) -> list[dict]:
    """
    Ülker — https://www.ulker.com.tr/en/all-products
    The page has product images with descriptive alt texts.
    Pattern: alt="ÜLKER CHOCOLATE MILK CHOCOLATE" → product name.
    """
    brand = "Ülker"
    url = "https://www.ulker.com.tr/en/all-products"
    logger.info(f"[{brand}] Fetching {url}")

    resp = fetch(session, url)
    if not resp:
        logger.warning(f"[{brand}] Could not fetch — skipping")
        return []

    html = get_text(resp)
    products = []
    seen = set()

    # Strategy 1: __NEXT_DATA__ (if present)
    nd = extract_next_data(html)
    if nd:
        items = walk_for_named_items(nd, require_image=True)
        for item in items:
            if not is_noise_name(item["name"]):
                key = normalize_turkish(item["name"])
                if key not in seen:
                    seen.add(key)
                    products.append(item)
        if products:
            logger.info(f"[{brand}] {len(products)} products from __NEXT_DATA__")
            return products

    # Strategy 2: img alt texts — Ülker encodes product names in alt attributes
    # Pattern: alt="ÜLKER CHOCOLATE MILK CHOCOLATE" (no "- Ülker" suffix)
    # Decode HTML entities (&#220; = Ü, &#199; = Ç, etc.)
    for match in re.finditer(r'<img[^>]+alt="([^"]{5,120})"', html, re.IGNORECASE):
        name = unescape(match.group(1)).strip()
        # Skip navigation images
        if any(skip in name.lower() for skip in [
            'logo', 'banner', 'icon', 'bg', 'background', 'empty', 'boş',
            'facebook', 'instagram', 'twitter', '{{'
        ]):
            continue
        # Ülker product images use all-caps or Title Case names
        # Skip very short or very long
        if len(name) < 5 or len(name) > 120:
            continue
        # Skip if it ends with "- Ülker" / "- Torku" (category image patterns)
        if re.search(r'-\s*[A-ZÜÇŞĞÖIa-züçşğöı]{3,}\s*$', name):
            continue

        key = normalize_turkish(name)
        if key not in seen:
            seen.add(key)
            products.append({"name": name, "category": "", "subcategory": ""})

    # Strategy 3: JSON blocks for product names
    if not products:
        for match in re.finditer(r'"(?:productName|name|title)"\s*:\s*"([^"]{5,120})"', html):
            name = unescape(match.group(1)).strip()
            if not is_noise_name(name):
                key = normalize_turkish(name)
                if key not in seen:
                    seen.add(key)
                    products.append({"name": name, "category": "", "subcategory": ""})

    logger.info(f"[{brand}] Found {len(products)} raw products")
    return products


def scrape_eti(session: requests.Session) -> list[dict]:
    """
    Eti — https://www.etietieti.com/tr-tr/markalarimiz/[brand-slug]
    Next.js site. Each sub-brand page has products in __NEXT_DATA__ with
    name + image pairs. We scrape all known sub-brand pages.
    """
    brand = "Eti"
    base_url = "https://www.etietieti.com"

    # Sub-brand slugs visible in site navigation
    sub_brand_slugs = [
        "popkek", "cikolatali-gofret", "kremali-biskuvi", "cicibebe",
        "burçak", "beti", "form", "yupo", "eti-cin", "metro",
        "browni", "crax", "nice", "gotcha", "hoşbil", "nötr",
        "piko", "süt-kremali", "süper-fındıklı", "tutku",
        # category-level (from markalarimiz?category= links we saw)
        "biskuvi", "cikolata", "kek", "gofret", "tuzlu-atistirmalik",
    ]

    products = []
    seen = set()

    # First, collect sub-brand slugs from the markalarimiz page itself
    logger.info(f"[{brand}] Fetching brand list page...")
    time.sleep(REQUEST_DELAY)
    main_resp = fetch(session, f"{base_url}/tr-tr/markalarimiz")
    if main_resp:
        main_html = get_text(main_resp)
        # Links like /tr-tr/markalarimiz/popkek
        found_slugs = re.findall(r'/tr-tr/markalarimiz/([a-z0-9\-]+)', main_html)
        for slug in found_slugs:
            if slug not in sub_brand_slugs and len(slug) > 2:
                sub_brand_slugs.append(slug)
        logger.info(f"[{brand}] Found {len(sub_brand_slugs)} sub-brand slugs")

    for slug in sub_brand_slugs:
        page_url = f"{base_url}/tr-tr/markalarimiz/{slug}"
        time.sleep(REQUEST_DELAY)
        resp = fetch(session, page_url)
        if not resp:
            continue

        html = get_text(resp)
        nd = extract_next_data(html)
        if not nd:
            continue

        pp = nd.get("props", {}).get("pageProps", {})
        page_products = walk_for_named_items(pp, require_image=True)

        added = 0
        for p in page_products:
            if is_noise_name(p["name"]):
                continue
            key = normalize_turkish(p["name"])
            if key not in seen:
                seen.add(key)
                if not p.get("category"):
                    p["category"] = slug.replace("-", " ").title()
                products.append(p)
                added += 1

        if added:
            logger.info(f"[{brand}] {slug}: +{added} products")

    logger.info(f"[{brand}] Total: {len(products)} products")
    return products


def scrape_torku(session: requests.Session) -> list[dict]:
    """
    Torku — https://torku.com.tr/sitemap.xml lists product category pages.
    Each category page (e.g. /torku-biskuviler-ve-gofretler) has h2/h3 headings
    and alt texts with product names encoded as HTML entities.
    """
    brand = "Torku"
    base_url = "https://torku.com.tr"

    # Get category pages from sitemap
    logger.info(f"[{brand}] Fetching sitemap...")
    sitemap_resp = fetch(session, f"{base_url}/sitemap.xml")
    if not sitemap_resp:
        logger.warning(f"[{brand}] Could not fetch sitemap — skipping")
        return []

    all_sitemap_urls = re.findall(r'<loc>(https?://[^<]+)</loc>', sitemap_resp.text)

    # Filter to product category pages — exclude news/haberler, tarifler, katalog, etc.
    EXCLUDE_KEYWORDS = [
        'haberler', 'tarif', 'katalog', 'sitemap', 'media', 'upload', 'pdf',
        'xml', 'seracilik', 'kolonya', 'harmoni', 'modern', 'ihracat',
        'beslenme', 'bulgur', 'tur-', 'mevlana',
    ]

    def is_product_category(url: str) -> bool:
        path = urlparse(url).path.lower()
        if any(kw in path for kw in EXCLUDE_KEYWORDS):
            return False
        # Must look like a product category (starts with /torku- or keyword)
        segments = [s for s in path.split('/') if s]
        if not segments:
            return False
        seg = segments[0]
        product_markers = ['torku', 'yeni-urun', 'bayram', 'porsiyonluk']
        return any(seg.startswith(m) for m in product_markers)

    category_urls = [u for u in all_sitemap_urls if is_product_category(u)]
    # Deduplicate
    category_urls = list(dict.fromkeys(category_urls))
    logger.info(f"[{brand}] Found {len(category_urls)} product category URLs")

    products = []
    seen = set()

    for cat_url in category_urls:
        time.sleep(REQUEST_DELAY)
        resp = fetch(session, cat_url)
        if not resp:
            continue

        html = get_text(resp)

        # Extract category name from URL
        path_parts = [p for p in urlparse(cat_url).path.split('/') if p]
        raw_cat = path_parts[-1] if path_parts else ""
        category = unquote(raw_cat).replace('-', ' ').title()
        # Clean "Torku" prefix from category name
        category = re.sub(r'^Torku\s+', '', category, flags=re.IGNORECASE).strip()

        page_products = _parse_torku_page(html, category)

        added = 0
        for p in page_products:
            key = normalize_turkish(p["name"])
            if key not in seen:
                seen.add(key)
                products.append(p)
                added += 1

        if added:
            logger.info(f"[{brand}] {raw_cat}: +{added} products")

    logger.info(f"[{brand}] Total: {len(products)} products")
    return products


def _parse_torku_page(html: str, category: str) -> list[dict]:
    """
    Parse a Torku product category page.
    Product names appear in:
    1. h2/h3/h4 headings (with HTML entities)
    2. img alt texts (usually "ProductName - Torku" format)
    """
    products = []
    seen = set()

    # Strategy 1: Headings
    for match in re.finditer(r'<h[2-4][^>]*>(.*?)</h[2-4]>', html, re.DOTALL | re.IGNORECASE):
        name = clean_html_text(match.group(1))
        if 5 <= len(name) <= 100 and not is_noise_name(name):
            key = normalize_turkish(name)
            if key not in seen:
                seen.add(key)
                products.append({"name": name, "category": category, "subcategory": ""})

    # Strategy 2: Alt texts — Torku format: "Product Name - Torku" or just "Product Name"
    for match in re.finditer(r'<img[^>]+alt="([^"]{5,120})"', html, re.IGNORECASE):
        alt = unescape(match.group(1)).strip()
        # Remove " - Torku" suffix
        name = re.sub(r'\s*-\s*torku\s*$', '', alt, flags=re.IGNORECASE).strip()
        if 5 <= len(name) <= 100 and not is_noise_name(name):
            key = normalize_turkish(name)
            if key not in seen:
                seen.add(key)
                products.append({"name": name, "category": category, "subcategory": ""})

    return products


def scrape_sutas(session: requests.Session) -> list[dict]:
    """
    Sütaş — https://www.sutas.com.tr/urunlerimiz
    The homepage lists product links as /sutas-[product-name] slugs.
    Product names can be derived from the URL slugs (quite clean).
    Also parses the category sub-pages.
    """
    brand = "Sütaş"
    base_url = "https://www.sutas.com.tr"

    logger.info(f"[{brand}] Fetching main product page...")
    resp = fetch(session, f"{base_url}/urunlerimiz")
    if not resp:
        logger.warning(f"[{brand}] Could not fetch — skipping")
        return []

    html = get_text(resp)
    products = []
    seen = set()

    # Collect all product page links from the main page
    # Pattern: /sutas-[product-name] or /[product-name]
    raw_links = re.findall(r'href="(/[a-z0-9\-]{5,100})"', html)
    product_links = []
    for link in raw_links:
        path = link.strip('/')
        # Skip navigation pages
        skip = [
            'urunlerimiz', 'hakkimizda', 'surdurulebilirlik', '50-yildir',
            'merak-ettikleriniz', 'ulke-secimi', 'bize-ulasin',
            'assets', 'css', 'js', '#',
        ]
        if any(path.startswith(s) for s in skip):
            continue
        if len(path) < 5:
            continue
        product_links.append(link)

    product_links = list(dict.fromkeys(product_links))
    logger.info(f"[{brand}] Found {len(product_links)} product links on main page")

    def slug_to_name(slug: str) -> str:
        """Convert /sutas-uht-sut or /suzme-yogurt to 'Süzme Yoğurt'."""
        # Remove /sutas- prefix
        name = slug.strip('/')
        name = re.sub(r'^sutas-', '', name, flags=re.IGNORECASE)
        # Replace hyphens with spaces, title-case
        name = name.replace('-', ' ').strip()
        # Fix common Turkish letter representations in slugs
        replacements = [
            ('yogurt', 'yoğurt'), ('sut', 'süt'), ('peynir', 'peynir'),
            ('tereyagi', 'tereyağı'), ('ayran', 'ayran'), ('kefir', 'kefir'),
            ('kaymak', 'kaymak'), ('krema', 'krema'), ('labne', 'labne'),
        ]
        n_lower = name.lower()
        for slug_form, proper in replacements:
            if slug_form in n_lower:
                # Keep original casing pattern but fix Turkish chars
                pass  # We'll title case after
        return name.title()

    # Extract products from links — most are /sutas-[product] slugs
    for link in product_links:
        name = slug_to_name(link)
        if 3 <= len(name) <= 100 and not is_noise_name(name):
            key = normalize_turkish(name)
            if key not in seen:
                seen.add(key)
                products.append({"name": name, "category": "", "subcategory": ""})

    # Also fetch individual category sub-pages for better product names
    # Sütaş uses /sutas-[category] category pages with better names
    category_pages = [
        (f"{base_url}/urunlerimiz", ""),
    ]
    # Find category links
    cat_links = re.findall(r'href="(/[a-z0-9\-]+-(?:sut|yogurt|peynir|ayran|tereyag|krema)[^"]{0,40})"', html)
    for cat_link in cat_links[:10]:
        category_pages.append((urljoin(base_url, cat_link), cat_link.strip('/').replace('-', ' ').title()))

    for page_url, cat_name in category_pages[1:5]:
        time.sleep(REQUEST_DELAY)
        page_resp = fetch(session, page_url)
        if not page_resp:
            continue

        page_html = get_text(page_resp)

        # Look for product links on the category page
        sub_links = re.findall(r'href="(/[a-z0-9\-]{5,100})"', page_html)
        for link in sub_links:
            path = link.strip('/')
            if any(path.startswith(s) for s in ['assets', 'css', 'js', 'urunlerimiz', 'hakkimizda']):
                continue
            name = slug_to_name(link)
            if 3 <= len(name) <= 100 and not is_noise_name(name):
                key = normalize_turkish(name)
                if key not in seen:
                    seen.add(key)
                    products.append({"name": name, "category": cat_name, "subcategory": ""})

        # Parse better product names from span elements (we saw these work)
        for match in re.finditer(
            r'<span[^>]*>(Sütaş\s+[^<]{5,80})</span>', page_html, re.DOTALL | re.IGNORECASE
        ):
            name = clean_html_text(match.group(1))
            if 5 <= len(name) <= 100 and not is_noise_name(name):
                key = normalize_turkish(name)
                if key not in seen:
                    seen.add(key)
                    products.append({"name": name, "category": cat_name, "subcategory": ""})

    # Parse span product names from main page too
    for match in re.finditer(r'<span[^>]*>([^<]{5,80})</span>', html, re.DOTALL):
        name = clean_html_text(match.group(1))
        if 5 <= len(name) <= 100 and not is_noise_name(name):
            # Only keep names that look like product names (contain brand/product keywords)
            keywords = ['süt', 'yoğurt', 'peynir', 'tereyağ', 'ayran', 'kefir',
                        'krema', 'kaymak', 'labne', 'örgü', 'kaşar', 'sütaş']
            n_norm = normalize_turkish(name)
            if any(kw in n_norm for kw in [normalize_turkish(k) for k in keywords]):
                key = normalize_turkish(name)
                if key not in seen:
                    seen.add(key)
                    products.append({"name": name, "category": "", "subcategory": ""})

    logger.info(f"[{brand}] Total: {len(products)} products")
    return products


def scrape_pinar(session: requests.Session) -> list[dict]:
    """
    Pınar — https://www.pinar.com.tr/urunler/detay-sut/Pinar-Sut-Urunleri/591/432/0
    ASP.NET MVC site. Product category pages list products as:
    - Links with product names in the URL (e.g. /urunler/detay-sut/Pinar-Tam-Yagli-Sut/...)
    - Spans with product names

    The /urunler/ page blocks with 403 but category detail pages work.
    """
    brand = "Pınar"
    base_url = "https://www.pinar.com.tr"

    # Known product category entry points
    CATEGORY_PAGES = [
        (f"{base_url}/urunler/detay-sut/Pinar-Sut-Urunleri/591/432/0", "Süt Ürünleri"),
        (f"{base_url}/urunler/detay-et/Pinar-Et-Urunleri/3638/4901/0", "Et Ürünleri"),
        (f"{base_url}/urunler/detay-su/Pinar-Su-ve-Icecek-Urunleri/516/3009/0", "Su ve İçecek"),
    ]

    products = []
    seen = set()

    for cat_url, cat_name in CATEGORY_PAGES:
        logger.info(f"[{brand}] Fetching: {cat_name}")
        time.sleep(REQUEST_DELAY)
        resp = fetch(session, cat_url)
        if not resp:
            logger.warning(f"[{brand}] Skipping {cat_name}")
            continue

        html = get_text(resp)
        page_products = _parse_pinar_page(html, cat_name, base_url)

        # Also follow sub-category links found on this page
        sub_links = re.findall(
            r'href="(/urunler/detay[^"]{10,150})"', html
        )
        sub_links = list(dict.fromkeys(sub_links))

        for sub_link in sub_links[:30]:
            full_url = urljoin(base_url, sub_link)
            if full_url == cat_url:
                continue
            time.sleep(REQUEST_DELAY)
            sub_resp = fetch(session, full_url)
            if not sub_resp:
                continue
            sub_html = get_text(sub_resp)
            # Extract category from URL
            parts = [p for p in urlparse(sub_link).path.split('/') if p]
            sub_cat_raw = parts[2] if len(parts) > 2 else ""
            sub_cat = unquote(sub_cat_raw).replace('-', ' ').title()
            page_products.extend(_parse_pinar_page(sub_html, sub_cat or cat_name, base_url))

        added = 0
        for p in page_products:
            key = normalize_turkish(p["name"])
            if key not in seen:
                seen.add(key)
                products.append(p)
                added += 1

        logger.info(f"[{brand}] {cat_name}: +{added} products")

    logger.info(f"[{brand}] Total: {len(products)} products")
    return products


def _parse_pinar_page(html: str, category: str, base_url: str) -> list[dict]:
    """
    Parse a Pınar product page.
    Strategy 1: Product links in URLs (/urunler/detay-X/Product-Name/id/id/0)
    Strategy 2: Span elements with product names
    """
    products = []
    seen = set()

    # Strategy 1: Extract names from link URLs
    # /urunler/detay-sut/Pinar-Tam-Yagli-Sut/3991/6705/0 → "Pinar Tam Yagli Sut"
    for match in re.finditer(
        r'/urunler/detay[^/]*/([A-Za-z0-9\-]{5,120})/\d+/\d+',
        html
    ):
        slug = match.group(1)
        # Convert URL slug to readable name
        name = unquote(slug).replace('-', ' ').strip()
        # Remove "Pinar " prefix for cleaner product names
        # (we'll keep it since it's part of the brand name on packs)
        if 5 <= len(name) <= 100 and not is_noise_name(name):
            # Title case
            name = name.title()
            key = normalize_turkish(name)
            if key not in seen:
                seen.add(key)
                products.append({"name": name, "category": category, "subcategory": ""})

    # Strategy 2: Span elements with product names
    for match in re.finditer(r'<span[^>]*>(Pınar[^<]{3,80})</span>', html, re.DOTALL):
        name = clean_html_text(match.group(1))
        if 5 <= len(name) <= 100 and not is_noise_name(name):
            key = normalize_turkish(name)
            if key not in seen:
                seen.add(key)
                products.append({"name": name, "category": category, "subcategory": ""})

    return products


def scrape_dardanel(session: requests.Session) -> list[dict]:
    """
    Dardanel — https://www.dardanel.com.tr/export/sitemap/
    Sitemap lists ~136 product URLs in the format:
      /2-lezzetlerimiz/[ID]-[product-name]/
    Product names are derived from the URL slug (after stripping the numeric ID).
    robots.txt: fully permissive.
    """
    brand = "Dardanel"
    sitemap_url = "https://www.dardanel.com.tr/export/sitemap/"
    base_url = "https://www.dardanel.com.tr"

    logger.info(f"[{brand}] Fetching sitemap: {sitemap_url}")
    resp = fetch(session, sitemap_url)
    if not resp:
        logger.warning(f"[{brand}] Could not fetch sitemap — skipping")
        return []

    html = get_text(resp)
    products = []
    seen = set()

    # The sitemap may be XML or HTML — try XML <loc> tags first
    loc_urls = re.findall(r'<loc>(https?://[^<]+)</loc>', html)

    # Also match href links in case the "sitemap" is an HTML page
    if not loc_urls:
        loc_urls = re.findall(r'href=["\'](' + re.escape(base_url) + r'/[^"\']+)["\']', html)
        # Relative hrefs
        rel_urls = re.findall(r'href=["\'](/[^"\']+)["\']', html)
        loc_urls += [urljoin(base_url, u) for u in rel_urls]

    # Filter to product URLs: /2-lezzetlerimiz/[ID]-[slug]/
    product_url_re = re.compile(r'/2-lezzetlerimiz/(\d+)-([a-z0-9\-]+)/?$', re.IGNORECASE)

    for url in loc_urls:
        path = urlparse(url).path
        m = product_url_re.search(path)
        if not m:
            continue
        slug = m.group(2)

        # Convert slug to product name (title-case, hyphens → spaces)
        name = slug.replace('-', ' ').strip().title()

        # Skip very short or noise names
        if len(name) < 3 or is_noise_name(name):
            continue

        key = normalize_turkish(name)
        if key not in seen:
            seen.add(key)
            products.append({"name": name, "category": "Denizkürünleri", "subcategory": ""})

    logger.info(f"[{brand}] Found {len(products)} products from sitemap")

    # Fallback: if sitemap gave nothing, fetch the products listing page
    if not products:
        logger.info(f"[{brand}] Sitemap yielded nothing — trying main products page")
        time.sleep(REQUEST_DELAY)
        page_resp = fetch(session, f"{base_url}/lezzetlerimiz")
        if page_resp:
            page_html = get_text(page_resp)
            for m in product_url_re.finditer(page_html):
                slug = m.group(2)
                name = slug.replace('-', ' ').strip().title()
                if len(name) < 3 or is_noise_name(name):
                    continue
                key = normalize_turkish(name)
                if key not in seen:
                    seen.add(key)
                    products.append({"name": name, "category": "Deniz Ürünleri", "subcategory": ""})
            logger.info(f"[{brand}] Fallback found {len(products)} products")

    logger.info(f"[{brand}] Total: {len(products)} products")
    return products


def scrape_tamek(session: requests.Session) -> list[dict]:
    """
    Tamek — https://www.tamek.com.tr/sitemap.xml
    Sitemap lists ~280 product URLs in the formats:
      /gida/[category]/[product-name]
      /icecek/[category]/[product-name]
    Also includes English URLs — we use Turkish ones only (no /en/ prefix).
    robots.txt: Allow: /
    """
    brand = "Tamek"
    sitemap_url = "https://www.tamek.com.tr/sitemap.xml"
    base_url = "https://www.tamek.com.tr"

    logger.info(f"[{brand}] Fetching sitemap: {sitemap_url}")
    resp = fetch(session, sitemap_url)
    if not resp:
        logger.warning(f"[{brand}] Could not fetch sitemap — skipping")
        return []

    sitemap_text = get_text(resp)
    all_urls = re.findall(r'<loc>(https?://[^<]+)</loc>', sitemap_text)

    # Some sitemaps are index files pointing to sub-sitemaps
    sub_sitemaps = [u for u in all_urls if 'sitemap' in urlparse(u).path.lower()]
    if sub_sitemaps and len(sub_sitemaps) == len(all_urls):
        # All entries are sub-sitemaps — fetch them
        expanded = []
        for sub_url in sub_sitemaps:
            time.sleep(REQUEST_DELAY)
            sub_resp = fetch(session, sub_url)
            if sub_resp:
                expanded += re.findall(r'<loc>(https?://[^<]+)</loc>', get_text(sub_resp))
        all_urls = expanded

    products = []
    seen = set()

    # Product URL patterns:
    # Turkish: /gida/[category]/[slug]  or  /icecek/[category]/[slug]
    # English: /en/food/... or /en/beverage/... — skip these
    product_path_re = re.compile(
        r'^/(gida|icecek)/([^/]+)/([a-z0-9\-]{3,80})/?$', re.IGNORECASE
    )

    for url in all_urls:
        path = urlparse(url).path

        # Skip English URLs
        if path.startswith('/en/'):
            continue

        m = product_path_re.match(path)
        if not m:
            continue

        top_category = m.group(1).title()   # Gida | Icecek
        sub_category_slug = m.group(2)
        product_slug = m.group(3)

        sub_category = unquote(sub_category_slug).replace('-', ' ').title()
        name = unquote(product_slug).replace('-', ' ').strip().title()

        if len(name) < 3 or is_noise_name(name):
            continue

        key = normalize_turkish(name)
        if key not in seen:
            seen.add(key)
            products.append({
                "name": name,
                "category": top_category,
                "subcategory": sub_category,
            })

    logger.info(f"[{brand}] Found {len(products)} products from sitemap URLs")

    # Fallback: if very few found, try scraping the products page
    if len(products) < 5:
        logger.info(f"[{brand}] Few products from sitemap — trying products page")
        time.sleep(REQUEST_DELAY)
        page_resp = fetch(session, f"{base_url}/urunler")
        if page_resp:
            page_html = get_text(page_resp)
            for m in re.finditer(r'href=["\']/(gida|icecek)/([^/"\']+)/([a-z0-9\-]{3,80})/?["\']',
                                 page_html, re.IGNORECASE):
                product_slug = m.group(3)
                name = unquote(product_slug).replace('-', ' ').strip().title()
                if len(name) < 3 or is_noise_name(name):
                    continue
                key = normalize_turkish(name)
                if key not in seen:
                    seen.add(key)
                    products.append({
                        "name": name,
                        "category": m.group(1).title(),
                        "subcategory": m.group(2).replace('-', ' ').title(),
                    })

    logger.info(f"[{brand}] Total: {len(products)} products")
    return products


def scrape_icim(session: requests.Session) -> list[dict]:
    """
    İçim — https://www.icim.com.tr/urunler-sitemap.xml
    Sitemap lists ~450 product URLs in the format:
      /urunler/[product-slug]/
    Also includes English /en/products/ URLs — use Turkish only.
    Slugs carry a brand prefix "icim-" which we strip from the display name.
    robots.txt: empty Disallow (fully permissive).
    """
    brand = "İçim"
    sitemap_url = "https://www.icim.com.tr/urunler-sitemap.xml"
    base_url = "https://www.icim.com.tr"

    logger.info(f"[{brand}] Fetching sitemap: {sitemap_url}")
    resp = fetch(session, sitemap_url)
    if not resp:
        logger.warning(f"[{brand}] Could not fetch sitemap — trying generic sitemap")
        time.sleep(REQUEST_DELAY)
        resp = fetch(session, f"{base_url}/sitemap.xml")
    if not resp:
        logger.warning(f"[{brand}] Could not fetch any sitemap — skipping")
        return []

    sitemap_text = get_text(resp)
    all_urls = re.findall(r'<loc>(https?://[^<]+)</loc>', sitemap_text)

    # If sitemap index, expand sub-sitemaps
    sub_sitemaps = [u for u in all_urls if 'sitemap' in urlparse(u).path.lower()]
    if sub_sitemaps and len(sub_sitemaps) == len(all_urls):
        expanded = []
        for sub_url in sub_sitemaps:
            time.sleep(REQUEST_DELAY)
            sub_resp = fetch(session, sub_url)
            if sub_resp:
                expanded += re.findall(r'<loc>(https?://[^<]+)</loc>', get_text(sub_resp))
        all_urls = expanded

    products = []
    seen = set()

    # Turkish product URL pattern: /urunler/[slug]/
    # English pattern: /en/products/[slug]/ — skip
    product_path_re = re.compile(r'^/urunler/([a-z0-9\-]{3,100})/?$', re.IGNORECASE)

    for url in all_urls:
        path = urlparse(url).path

        # Skip English URLs
        if '/en/' in path:
            continue

        m = product_path_re.match(path)
        if not m:
            continue

        product_slug = m.group(1)

        # Strip brand prefix "icim-" (case-insensitive)
        clean_slug = re.sub(r'^i[cç]im[-_]', '', product_slug, flags=re.IGNORECASE)
        name = unquote(clean_slug).replace('-', ' ').strip().title()

        if len(name) < 3 or is_noise_name(name):
            continue

        key = normalize_turkish(name)
        if key not in seen:
            seen.add(key)
            products.append({"name": name, "category": "Süt Ürünleri", "subcategory": ""})

    logger.info(f"[{brand}] Found {len(products)} products from sitemap URLs")

    # Fallback: scrape the products listing page
    if len(products) < 5:
        logger.info(f"[{brand}] Few products from sitemap — trying products listing page")
        time.sleep(REQUEST_DELAY)
        page_resp = fetch(session, f"{base_url}/urunler")
        if page_resp:
            page_html = get_text(page_resp)
            for m in product_path_re.finditer(page_html):
                product_slug = m.group(1)
                clean_slug = re.sub(r'^i[cç]im[-_]', '', product_slug, flags=re.IGNORECASE)
                name = unquote(clean_slug).replace('-', ' ').strip().title()
                if len(name) < 3 or is_noise_name(name):
                    continue
                key = normalize_turkish(name)
                if key not in seen:
                    seen.add(key)
                    products.append({"name": name, "category": "Süt Ürünleri", "subcategory": ""})
            logger.info(f"[{brand}] Fallback found {len(products)} products")

    logger.info(f"[{brand}] Total: {len(products)} products")
    return products


def scrape_dogadan(session: requests.Session) -> list[dict]:
    """
    Doğadan — https://www.dogadan.com.tr
    Product categories at: /tr/urun-listesi/[category-slug]/[category-id]
    Category pages may show sub-categories (also /tr/urun-listesi/) or
    actual product cards. Product names are embedded in onclick attributes
    as ProductClick('PRODUCT NAME', id, pos) and in <p class="alt-exp">.
    robots.txt: Allow: /
    """
    brand = "Doğadan"
    base_url = "https://www.dogadan.com.tr"

    TOP_CATEGORIES = [
        ("/tr/urun-listesi/matcha/25",               "Matcha"),
        ("/tr/urun-listesi/destek-serisi/23",         "Destek Serisi"),
        ("/tr/urun-listesi/kadinlara-ozel/22",        "Kadınlara Özel"),
        ("/tr/urun-listesi/keyif/2",                  "Keyif"),
        ("/tr/urun-listesi/form/3",                   "Form"),
        ("/tr/urun-listesi/sifali-bitkiler/1",        "Şifalı Bitkiler"),
        ("/tr/urun-listesi/relax/4",                  "Relax"),
        ("/tr/urun-listesi/yesil-cay/5",              "Yeşil Çay"),
        ("/tr/urun-listesi/dogadan-ozel-seriler/7",   "Doğadan Özel Seriler"),
        ("/tr/urun-listesi/beyaz-cay/6",              "Beyaz Çay"),
        ("/tr/urun-listesi/siyah-caylar/8",           "Siyah Çaylar"),
        ("/tr/urun-listesi/dokme-yesil-cay/24",       "Döküme Yeşil Çay"),
    ]

    products = []
    seen = set()
    visited_paths: set[str] = set()

    def _extract_products_from_page(html: str, cat_name: str) -> int:
        """
        Extract product names from a Doğadan product list page.
        Returns count of new products added.
        Strategy 1: ProductClick('Name', id, pos) onclick attributes
        Strategy 2: <p class="alt-exp"> text content
        """
        added = 0
        # Strategy 1: ProductClick onclick — most reliable, contains clean product names
        for match in re.finditer(
            r"ProductClick\('([^']{5,120})',\s*\d+,\s*\d+\)",
            html
        ):
            name = unescape(match.group(1)).strip()
            if is_noise_name(name):
                continue
            key = normalize_turkish(name)
            if key not in seen:
                seen.add(key)
                products.append({"name": name, "category": cat_name, "subcategory": ""})
                added += 1

        # Strategy 2: <p class="alt-exp"> text — backup if onclick pattern changes
        if not added:
            for match in re.finditer(
                r'<p[^>]*class="[^"]*alt-exp[^"]*"[^>]*>(.*?)</p>',
                html, re.DOTALL | re.IGNORECASE
            ):
                name = clean_html_text(match.group(1)).strip()
                if 5 <= len(name) <= 120 and not is_noise_name(name):
                    key = normalize_turkish(name)
                    if key not in seen:
                        seen.add(key)
                        products.append({"name": name, "category": cat_name, "subcategory": ""})
                        added += 1

        return added

    for path, cat_name in TOP_CATEGORIES:
        if path in visited_paths:
            continue
        visited_paths.add(path)

        url = urljoin(base_url, path)
        logger.info(f"[{brand}] Fetching category: {cat_name}")
        time.sleep(REQUEST_DELAY)
        resp = fetch(session, url)
        if not resp:
            logger.warning(f"[{brand}] Could not fetch {cat_name} — skipping")
            continue

        html = get_text(resp)

        # First try to extract products directly from this page
        added = _extract_products_from_page(html, cat_name)

        # Check for sub-category links on this page (e.g. siyah-caylar → demlik-poset, bardak-poset)
        sub_paths = re.findall(r'href="(/tr/urun-listesi/[^"]+)"', html)
        sub_paths = list(dict.fromkeys(sub_paths))  # deduplicate

        for sub_path in sub_paths:
            if sub_path in visited_paths or sub_path == path:
                continue
            visited_paths.add(sub_path)

            sub_url = urljoin(base_url, sub_path)
            sub_cat_slug = sub_path.rstrip('/').split('/')[-2]  # slug before numeric id
            sub_cat_name = sub_cat_slug.replace('-', ' ').title()

            logger.info(f"[{brand}]   -> Sub-category: {sub_cat_name}")
            time.sleep(REQUEST_DELAY)
            sub_resp = fetch(session, sub_url)
            if not sub_resp:
                continue

            sub_html = get_text(sub_resp)
            sub_added = _extract_products_from_page(sub_html, cat_name)
            added += sub_added

            if sub_added:
                logger.info(f"[{brand}]   {sub_cat_name}: +{sub_added} products")

        if added:
            logger.info(f"[{brand}] {cat_name}: +{added} products total")
        else:
            logger.warning(f"[{brand}] {cat_name}: no products extracted")

    logger.info(f"[{brand}] Total: {len(products)} products")
    return products


def scrape_uludag(session: requests.Session) -> list[dict]:
    """
    Uludağ İçecek — http://www.uludagicecek.com.tr/_sitemaps/sitemap.xml
    Sitemap contains ~21 Turkish product URLs in format:
      /urunlerimiz/[category]/[product-name]
    Skip English /en/ URLs.
    robots.txt: Allow: /
    """
    brand = "Uludağ İçecek"
    sitemap_url = "http://www.uludagicecek.com.tr/_sitemaps/sitemap.xml"
    base_url = "http://www.uludagicecek.com.tr"

    logger.info(f"[{brand}] Fetching sitemap: {sitemap_url}")
    resp = fetch(session, sitemap_url)
    if not resp:
        logger.warning(f"[{brand}] Could not fetch sitemap — trying generic sitemap")
        time.sleep(REQUEST_DELAY)
        resp = fetch(session, f"{base_url}/sitemap.xml")
    if not resp:
        logger.warning(f"[{brand}] Could not fetch any sitemap — skipping")
        return []

    sitemap_text = get_text(resp)
    all_urls = re.findall(r'<loc>(https?://[^<]+)</loc>', sitemap_text)

    # If sitemap index, expand sub-sitemaps
    sub_sitemaps = [u for u in all_urls if 'sitemap' in urlparse(u).path.lower()]
    if sub_sitemaps and len(sub_sitemaps) == len(all_urls):
        expanded = []
        for sub_url in sub_sitemaps:
            time.sleep(REQUEST_DELAY)
            sub_resp = fetch(session, sub_url)
            if sub_resp:
                expanded += re.findall(r'<loc>(https?://[^<]+)</loc>', get_text(sub_resp))
        all_urls = expanded

    products = []
    seen = set()

    # Turkish product URL pattern: /urunlerimiz/[category]/[product-slug]
    # English pattern: /en/... — skip
    product_path_re = re.compile(
        r'^/urunlerimiz/([^/]+)/([a-z0-9\-]{3,100})/?$', re.IGNORECASE
    )

    for url in all_urls:
        path = urlparse(url).path

        # Skip English URLs
        if path.startswith('/en/'):
            continue

        m = product_path_re.match(path)
        if not m:
            continue

        category_slug = m.group(1)
        product_slug = m.group(2)

        category = unquote(category_slug).replace('-', ' ').title()
        name = unquote(product_slug).replace('-', ' ').strip().title()

        if len(name) < 3 or is_noise_name(name):
            continue

        key = normalize_turkish(name)
        if key not in seen:
            seen.add(key)
            products.append({"name": name, "category": category, "subcategory": ""})

    logger.info(f"[{brand}] Found {len(products)} products from sitemap URLs")

    # Fallback: scrape the products listing page
    if len(products) < 3:
        logger.info(f"[{brand}] Few products from sitemap — trying products listing page")
        time.sleep(REQUEST_DELAY)
        page_resp = fetch(session, f"{base_url}/urunlerimiz")
        if page_resp:
            page_html = get_text(page_resp)
            for m in product_path_re.finditer(page_html):
                category = unquote(m.group(1)).replace('-', ' ').title()
                name = unquote(m.group(2)).replace('-', ' ').strip().title()
                if len(name) < 3 or is_noise_name(name):
                    continue
                key = normalize_turkish(name)
                if key not in seen:
                    seen.add(key)
                    products.append({"name": name, "category": category, "subcategory": ""})
            logger.info(f"[{brand}] Fallback found {len(products)} products")

    logger.info(f"[{brand}] Total: {len(products)} products")
    return products


def scrape_vestel(session: requests.Session) -> list[dict]:
    """
    Vestel — https://statics.vestel.com.tr/vstlsitemap/product.xml
    Sitemap lists ~1,058 product URLs in format:
      https://www.vestel.com.tr/[product-slug]-p-[id]
    Product names are extracted from URL slugs by:
      1. Stripping the -p-[id] suffix
      2. Replacing hyphens with spaces
      3. Title-casing
    Individual product pages are NOT fetched (too many requests).
    robots.txt: allows product pages, blocks only cart/checkout/api.
    """
    brand = "Vestel"
    sitemap_url = "https://statics.vestel.com.tr/vstlsitemap/product.xml"

    logger.info(f"[{brand}] Fetching product sitemap: {sitemap_url}")
    resp = fetch(session, sitemap_url)
    if not resp:
        logger.warning(f"[{brand}] Could not fetch sitemap — skipping")
        return []

    sitemap_text = get_text(resp)
    all_urls = re.findall(r'<loc>(https?://[^<]+)</loc>', sitemap_text)
    logger.info(f"[{brand}] Found {len(all_urls)} URLs in sitemap")

    # Product URL pattern: https://www.vestel.com.tr/[slug]-p-[numeric-id]
    product_url_re = re.compile(r'/([a-z0-9][a-z0-9\-]{2,150})-p-(\d+)$', re.IGNORECASE)

    products = []
    seen = set()

    for url in all_urls:
        path = urlparse(url).path
        m = product_url_re.search(path)
        if not m:
            continue

        slug = m.group(1)

        # Convert slug to readable product name
        name = slug.replace('-', ' ').strip().title()

        # Skip very short names or obvious noise
        if len(name) < 3 or is_noise_name(name):
            continue

        # Apply size dedup (strip model/size suffixes for dedup key, keep full name)
        key = normalize_turkish(clean_product_name(name))
        if not key:
            key = normalize_turkish(name)

        if key not in seen:
            seen.add(key)
            # Infer category from the slug prefix (first word is usually the product type)
            slug_parts = slug.split('-')
            # Vestel slugs typically: [product-type]-[brand?]-[model]-[specs]
            # e.g. "buzdolabi-no-frost-600-lt" → category "Buzdolabı"
            # We keep category blank and rely on the product name itself
            products.append({"name": name, "category": "Elektronik", "subcategory": ""})

    logger.info(f"[{brand}] Total: {len(products)} unique products from sitemap slugs")
    return products


# ============================================================================
# DEDUPLICATION
# ============================================================================

def dedup_products(products: list[dict]) -> list[dict]:
    """
    Deduplicate by cleaned name (size stripped).
    Same product in different sizes → one listing (keep best data).
    """
    dedup: dict[str, dict] = {}

    for p in products:
        name = p.get("name", "").strip()
        if not name or len(name) < 2:
            continue

        clean = clean_product_name(name)
        if not clean or len(clean) < 2:
            clean = name

        key = normalize_turkish(clean)

        if key not in dedup:
            dedup[key] = {**p, "clean_name": clean}
        else:
            existing = dedup[key]
            # Keep the variant with more data (category info, longer clean name)
            score_new = len(clean) + (5 if p.get("category") else 0) + (3 if p.get("subcategory") else 0)
            score_old = (len(existing.get("clean_name", "")) +
                         (5 if existing.get("category") else 0) +
                         (3 if existing.get("subcategory") else 0))
            if score_new > score_old:
                dedup[key] = {**p, "clean_name": clean}

    return list(dedup.values())


# ============================================================================
# SUPABASE INSERT
# ============================================================================

def get_supabase():
    from supabase import create_client
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def insert_products(all_brand_products: dict[str, list[dict]], dry_run: bool = True):
    """Insert all brand products into the listings table."""
    total_products = sum(len(v) for v in all_brand_products.values())

    if dry_run:
        logger.info(f"\n[DRY RUN] Would insert {total_products} products across {len(all_brand_products)} brands")
        for brand_slug, products in all_brand_products.items():
            logger.info(f"  {brand_slug}: {len(products)} products")
            for p in products[:5]:
                cat = f" [{p.get('category', '')}]" if p.get("category") else ""
                logger.info(f"    - {p['clean_name']}{cat}")
            if len(products) > 5:
                logger.info(f"    ... and {len(products) - 5} more")
        return

    client = get_supabase()

    # Load existing brand listings to find parent_id
    logger.info("Loading existing brand listings from DB...")
    brand_cache: dict[str, str] = {}  # normalized_name → id
    try:
        resp = client.table("listings").select("id,name").eq("entity_type", "brand").execute()
        for row in resp.data:
            brand_cache[normalize_turkish(row["name"])] = row["id"]
        logger.info(f"Loaded {len(brand_cache)} brands from DB")
    except Exception as e:
        logger.warning(f"Could not load brands from DB: {e}")

    # Brand slug → candidate DB names to match against
    BRAND_DB_NAMES = {
        "ulker":    ["ülker", "ulker", "ülker bisküvi sanayi a.ş."],
        "eti":      ["eti", "eti gıda sanayi", "eti gida"],
        "torku":    ["torku", "konya şeker", "konya seker", "torku gıda"],
        "sutas":    ["sütaş", "sutas", "sütaş a.ş.", "sutas sut", "sütaş süt"],
        "pinar":    ["pınar", "pinar", "pınar süt", "pınar et", "yaşar holding"],
        "dardanel": ["dardanel", "dardanel gıda", "dardanel konserve"],
        "tamek":    ["tamek", "tamek gıda", "tamek konserve"],
        "icim":     ["içim", "icim", "içim süt", "yörsan", "yorsan"],
        "dogadan":  ["doğadan", "dogadan", "doğadan çay", "doğadan gıda"],
        "uludag":   ["uludağ içecek", "uludag icecek", "uludağ", "uludag"],
        "vestel":   ["vestel", "vestel elektronik", "vestel a.ş."],
    }

    grand_total = 0

    for brand_slug, products in all_brand_products.items():
        if not products:
            continue

        # Find parent brand ID
        parent_id = None
        for candidate in BRAND_DB_NAMES.get(brand_slug, [brand_slug]):
            nk = normalize_turkish(candidate)
            if nk in brand_cache:
                parent_id = brand_cache[nk]
                logger.info(f"  [{brand_slug}] Linked to brand ID: {parent_id}")
                break
        if not parent_id:
            logger.warning(f"  [{brand_slug}] No matching brand in DB — products will have no parent_id")

        # Insert in batches
        for i in range(0, len(products), BATCH_SIZE):
            batch = products[i:i + BATCH_SIZE]
            rows = []
            for p in batch:
                name = p["clean_name"]
                slug = slugify(name)
                source_id = f"catalog:{brand_slug}:{slug}"

                description_parts = []
                if p.get("category"):
                    description_parts.append(p["category"])
                if p.get("subcategory") and p["subcategory"] != p.get("category"):
                    description_parts.append(p["subcategory"])

                row = {
                    "name": name[:255],
                    "slug": f"bc-{slug}"[:80],
                    "entity_type": "business",
                    "status": "active",
                    "source": "brand_catalog",
                    "source_id": source_id,
                    "parent_id": parent_id,
                    "description": " > ".join(description_parts)[:500] if description_parts else None,
                }
                rows.append(row)

            try:
                resp = client.table("listings").upsert(
                    rows, on_conflict="source_id"
                ).execute()
                grand_total += len(resp.data)
                logger.info(f"  [{brand_slug}] Batch {i // BATCH_SIZE + 1}: inserted {len(resp.data)} products")
            except Exception as e:
                logger.error(f"  [{brand_slug}] Batch insert error at offset {i}: {e}")

    logger.info(f"\nTotal products inserted: {grand_total}")


# ============================================================================
# BRAND REGISTRY
# ============================================================================

BRANDS = [
    {"slug": "ulker",    "name": "Ülker",          "scraper": scrape_ulker},
    {"slug": "eti",      "name": "Eti",             "scraper": scrape_eti},
    {"slug": "torku",    "name": "Torku",           "scraper": scrape_torku},
    {"slug": "sutas",    "name": "Sütaş",           "scraper": scrape_sutas},
    {"slug": "pinar",    "name": "Pınar",           "scraper": scrape_pinar},
    {"slug": "dardanel", "name": "Dardanel",        "scraper": scrape_dardanel},
    {"slug": "tamek",    "name": "Tamek",           "scraper": scrape_tamek},
    {"slug": "icim",     "name": "İçim",            "scraper": scrape_icim},
    {"slug": "dogadan",  "name": "Doğadan",         "scraper": scrape_dogadan},
    {"slug": "uludag",   "name": "Uludağ İçecek",  "scraper": scrape_uludag},
    {"slug": "vestel",   "name": "Vestel",          "scraper": scrape_vestel},
]


# ============================================================================
# MAIN
# ============================================================================

def main():
    parser = argparse.ArgumentParser(description="Turkish Brand Product Catalog Scraper")
    parser.add_argument(
        "--supabase", action="store_true",
        help="Insert into Supabase (default: dry run)"
    )
    parser.add_argument(
        "--brand", type=str, default=None,
        help="Only scrape one brand by slug (ulker|eti|torku|sutas|pinar|dardanel|tamek|icim|dogadan|uludag|vestel)"
    )
    args = parser.parse_args()

    dry_run = not args.supabase

    session = make_session()
    all_brand_products: dict[str, list[dict]] = {}
    output_records = []

    brands_to_run = BRANDS
    if args.brand:
        brands_to_run = [b for b in BRANDS if b["slug"] == args.brand.lower()]
        if not brands_to_run:
            valid = [b["slug"] for b in BRANDS]
            logger.error(f"Unknown brand slug: {args.brand}. Choose from: {valid}")
            sys.exit(1)

    for brand_info in brands_to_run:
        slug = brand_info["slug"]
        name = brand_info["name"]
        scraper = brand_info["scraper"]

        logger.info(f"\n{'='*60}")
        logger.info(f"Brand: {name}")
        logger.info(f"{'='*60}")

        try:
            raw_products = scraper(session)
        except Exception as e:
            logger.error(f"[{name}] Scraper crashed: {e}", exc_info=True)
            raw_products = []

        logger.info(f"[{name}] Raw products found: {len(raw_products)}")

        deduped = dedup_products(raw_products)
        removed = len(raw_products) - len(deduped)
        logger.info(f"[{name}] After dedup: {len(deduped)} unique products"
                    + (f" (removed {removed} size variants)" if removed else ""))

        all_brand_products[slug] = deduped

        # Collect for JSON output
        for p in deduped:
            output_records.append({
                "brand": name,
                "brand_slug": slug,
                "name": p["clean_name"],
                "raw_name": p.get("name", p["clean_name"]),
                "category": p.get("category", ""),
                "subcategory": p.get("subcategory", ""),
                "source_id": f"catalog:{slug}:{slugify(p['clean_name'])}",
            })

        time.sleep(REQUEST_DELAY)

    # Summary stats
    logger.info(f"\n{'='*60}")
    logger.info("SUMMARY")
    logger.info(f"{'='*60}")
    total = 0
    for brand_info in brands_to_run:
        bslug = brand_info["slug"]
        count = len(all_brand_products.get(bslug, []))
        total += count
        logger.info(f"  {brand_info['name']:15s}: {count:4d} products")
    logger.info(f"  {'TOTAL':15s}: {total:4d} products")

    # Save JSON for inspection
    data_dir = Path(__file__).parent / "data"
    data_dir.mkdir(exist_ok=True)
    out_path = data_dir / "brand-products.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output_records, f, ensure_ascii=False, indent=2)
    logger.info(f"\nSaved {len(output_records)} records to {out_path}")

    # Insert into Supabase
    insert_products(all_brand_products, dry_run=dry_run)

    if dry_run:
        logger.info("\nRun with --supabase to insert into database")


if __name__ == "__main__":
    main()
