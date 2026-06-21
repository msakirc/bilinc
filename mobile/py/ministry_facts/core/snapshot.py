"""Raw JSON snapshot per run (audit trail)."""
import json
from pathlib import Path

OUT_DIR = Path(__file__).resolve().parents[1] / "ministry_facts_data"


def save(source: str, date_str: str, entries: list[dict]):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / f"{source.replace(':', '_')}_{date_str}.json"
    path.write_text(json.dumps(entries, ensure_ascii=False, indent=2, default=str),
                    encoding="utf-8")
    return path
