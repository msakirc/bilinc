#!/usr/bin/env python3
"""One-time migration: move business phone numbers out of the client-readable
catalog into a private, guest-inaccessible table.

WHY
---
The mobile app reads `bilinc-catalog` DIRECTLY from the device using the Cognito
guest role `bilinc-catalog-readonly` (GetItem/Query, all attributes). That means
`contacts.phone` — and the `Tel: ...` segment embedded in `description` — ship to
every guest. Those phones are Overture-sourced public map data, but many are
sole-proprietor personal mobiles (KVKK/GDPR risk to republish without consent).

This script does NOT re-scrape. It operates on data already in DynamoDB:
  1. Scan `bilinc-catalog` (SK=META rows).
  2. For each item with a phone (in contacts.phone OR description "Tel: ..."),
     copy {id, phone} into the private `bilinc-contacts` table.
  3. UpdateItem on the catalog row to remove contacts.phone (drop the whole
     `contacts` map if phone was its only key) and strip the "Tel: ..." segment
     from `description`.

`bilinc-contacts` is NOT in the guest role policy, so the phone becomes
unreadable from devices. A future owner-consent reveal can serve it via the
privileged search-proxy Lambda.

USAGE
-----
  AWS_PROFILE=bilinc-prod python migrate-phones.py            # dry-run (default)
  AWS_PROFILE=bilinc-prod python migrate-phones.py --apply    # perform writes

Dry-run reports counts + samples and writes nothing.
"""
import argparse
import os
import re
import sys
import time

import boto3
from botocore.config import Config

# bilinc-catalog is provisioned at only 5 RCU / 5 WCU. A raw full scan throttles
# instantly, so: adaptive retries (client-side rate limiting) + paged scan with a
# per-page sleep keep us under capacity without bumping (and paying for) throughput.
BOTO_CFG = Config(retries={"max_attempts": 20, "mode": "adaptive"})

AWS_REGION = os.environ.get("AWS_REGION", "eu-central-1")
CATALOG_TABLE = os.environ.get("CATALOG_TABLE", "bilinc-catalog")
CONTACTS_TABLE = os.environ.get("CONTACTS_TABLE", "bilinc-contacts")

# Pulls the phone out of a description when contacts.phone is absent.
TEL_CAPTURE_RE = re.compile(r"Tel:\s*(\+?[\d\s().-]+)", re.IGNORECASE)


def extract_phone(item):
    """Return phone string from contacts.phone, falling back to description."""
    contacts = item.get("contacts") or {}
    phone = contacts.get("phone")
    if phone:
        return str(phone).strip()
    desc = item.get("description") or ""
    m = TEL_CAPTURE_RE.search(desc)
    return m.group(1).strip() if m else None


def clean_description(desc):
    """Drop the 'Tel: ...' segment; return cleaned string or None if empty.

    Descriptions are ' | '-joined parts (e.g. 'restaurant | Tel: +90... | http://').
    Splitting on '|' and dropping the Tel part rejoins cleanly without stray
    separators or lost spaces."""
    if not desc:
        return None
    parts = [p.strip() for p in desc.split("|")]
    kept = [p for p in parts if p and not p.lower().startswith("tel:")]
    return " | ".join(kept) or None


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--apply", action="store_true", help="perform writes (default: dry-run)")
    ap.add_argument("--page-size", type=int, default=100, help="scan page Limit (keep small for 5 RCU)")
    ap.add_argument("--sleep", type=float, default=0.3, help="seconds to sleep between scan pages")
    args = ap.parse_args()

    dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION, config=BOTO_CFG)
    catalog = dynamodb.Table(CATALOG_TABLE)
    contacts_tbl = dynamodb.Table(CONTACTS_TABLE)

    mode = "APPLY" if args.apply else "DRY-RUN"
    print(f"[{mode}] region={AWS_REGION} catalog={CATALOG_TABLE} contacts={CONTACTS_TABLE}\n")

    scanned = with_phone = migrated = 0
    samples = []

    scan_kwargs = {
        "ProjectionExpression": "PK, SK, contacts, description",
        "Limit": args.page_size,
    }
    contact_buffer = contacts_tbl.batch_writer() if args.apply else None

    try:
        start_key = None
        while True:
            if start_key:
                scan_kwargs["ExclusiveStartKey"] = start_key
            resp = catalog.scan(**scan_kwargs)
            for item in resp.get("Items", []):
                if item.get("SK") != "META":
                    continue
                scanned += 1
                phone = extract_phone(item)
                if not phone:
                    continue
                with_phone += 1

                lid = str(item["PK"]).replace("L#", "")
                contacts = dict(item.get("contacts") or {})
                contacts.pop("phone", None)
                new_desc = clean_description(item.get("description"))

                if len(samples) < 5:
                    samples.append((lid, phone, item.get("description"), new_desc))

                if not args.apply:
                    continue

                # 1. Park phone in the private table.
                contact_buffer.put_item(Item={"id": lid, "phone": phone, "source": "overture-migrated"})

                # 2. Scrub the catalog META row.
                update_parts, remove_parts = [], []
                expr_vals = {}
                if contacts:  # website (or other) survives
                    update_parts.append("contacts = :c")
                    expr_vals[":c"] = contacts
                else:
                    remove_parts.append("contacts")
                if new_desc is not None:
                    update_parts.append("description = :d")
                    expr_vals[":d"] = new_desc
                else:
                    remove_parts.append("description")

                update_expr = ""
                if update_parts:
                    update_expr += "SET " + ", ".join(update_parts)
                if remove_parts:
                    update_expr += (" " if update_expr else "") + "REMOVE " + ", ".join(remove_parts)

                kwargs = {
                    "Key": {"PK": item["PK"], "SK": "META"},
                    "UpdateExpression": update_expr,
                }
                if expr_vals:
                    kwargs["ExpressionAttributeValues"] = expr_vals
                catalog.update_item(**kwargs)
                migrated += 1

                if migrated % 1000 == 0:
                    print(f"  migrated {migrated} ...", flush=True)

            start_key = resp.get("LastEvaluatedKey")
            if not start_key:
                break
            if args.sleep:
                time.sleep(args.sleep)
    finally:
        if contact_buffer is not None:
            contact_buffer.__exit__(None, None, None)

    print(f"\nscanned META rows: {scanned}")
    print(f"rows with phone:   {with_phone}")
    if args.apply:
        print(f"migrated:          {migrated}")
    print("\nsamples (id | phone | old desc -> new desc):")
    for lid, phone, old, new in samples:
        print(f"  {lid} | {phone}\n     {old!r}\n  -> {new!r}")
    if not args.apply:
        print("\nDRY-RUN only — nothing written. Re-run with --apply to migrate.")


if __name__ == "__main__":
    sys.exit(main())
