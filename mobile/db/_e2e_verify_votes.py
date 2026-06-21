#!/usr/bin/env python3
"""
E2E data-layer verification: confirm that UI vote/fact/review actions actually
persisted rows for e2e_trusted. Run AFTER the relevant Maestro flow.

Usage:
  python db/_e2e_verify_votes.py            # print current counts for e2e_trusted
  python db/_e2e_verify_votes.py --snapshot # write a before-snapshot to /tmp
  python db/_e2e_verify_votes.py --assert-after  # compare to snapshot, exit 1 if no new rows

Why this exists: Maestro asserts the vote BUTTON is visible after tapping, but a
button being present proves nothing about persistence. The mock fact ids '1'/'2'
used to fail the FK silently, so a "green" vote flow wrote zero rows. With the
real catalog the FK is satisfiable; this script proves the row actually lands.
"""
import os, json, sys, urllib.request, urllib.error, psycopg2

PROJ = "hdfmolibxlescbzecygz"
# Secrets from env:
#   TEST_DB_URL  postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:5432/postgres
#   TEST_SUPABASE_ANON_KEY  the project publishable/anon key
ANON = os.environ["TEST_SUPABASE_ANON_KEY"]
DSN  = os.environ["TEST_DB_URL"]
SNAP = "/tmp/e2e_vote_snapshot.json"

TABLES = ["fact_votes", "review_votes", "fact_checks", "facts", "reviews"]


def counts():
    conn = psycopg2.connect(DSN, connect_timeout=15)
    cur = conn.cursor()
    cur.execute("select id from public.users where username='e2e_trusted'")
    row = cur.fetchone()
    uid = row[0] if row else None
    out = {"_uid": str(uid)}
    for t in TABLES:
        try:
            cur.execute(f"select count(*) from public.{t} where user_id=%s", (uid,))
            out[t] = cur.fetchone()[0]
        except Exception as e:
            conn.rollback()
            out[t] = f"ERR {e}"
    cur.close(); conn.close()
    return out


def main():
    arg = sys.argv[1] if len(sys.argv) > 1 else ""
    cur = counts()
    if arg == "--snapshot":
        with open(SNAP, "w") as f:
            json.dump(cur, f)
        print("snapshot written:", json.dumps(cur))
        return
    if arg == "--assert-after":
        try:
            with open(SNAP) as f:
                before = json.load(f)
        except FileNotFoundError:
            print("NO SNAPSHOT — run --snapshot first"); sys.exit(2)
        print("before:", json.dumps(before))
        print("after :", json.dumps(cur))
        deltas = {t: cur[t] - before[t] for t in TABLES
                  if isinstance(cur.get(t), int) and isinstance(before.get(t), int)}
        print("delta :", json.dumps(deltas))
        grew = any(v > 0 for v in deltas.values())
        if grew:
            print("PASS: at least one table grew (UI action persisted).")
            sys.exit(0)
        print("FAIL: no new rows — UI action did NOT persist.")
        sys.exit(1)
    print(json.dumps(cur, indent=2))


if __name__ == "__main__":
    main()
