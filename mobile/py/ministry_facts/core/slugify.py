"""TR-aware slug generation (lifted from safetygate-recalls.py)."""
import re

_TR = {'ş': 's', 'Ş': 's', 'ı': 'i', 'İ': 'i', 'ğ': 'g', 'Ğ': 'g',
       'ü': 'u', 'Ü': 'u', 'ö': 'o', 'Ö': 'o', 'ç': 'c', 'Ç': 'c'}


def slugify(name: str) -> str:
    s = name or ""
    # Replace Turkish chars BEFORE lower() — Python's str.lower() maps
    # 'İ' (U+0130) to 'i' + combining dot (two codepoints), which would
    # not match the ASCII map keys.
    for tr, en in _TR.items():
        s = s.replace(tr, en)
    s = s.lower()
    s = re.sub(r'[^a-z0-9\s-]', '', s)
    s = re.sub(r'[\s_]+', '-', s)
    s = re.sub(r'-+', '-', s).strip('-')
    return s


def listing_slug(name: str, lid: str) -> str:
    """Slug guaranteed unique via id suffix; <= 80 chars (DB constraint)."""
    base = slugify(name)[:71]
    return f"{base}-{lid[:8]}".strip('-')
