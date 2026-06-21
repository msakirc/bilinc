import os, json, urllib.request, urllib.error, psycopg2

PROJ = "hdfmolibxlescbzecygz"
# Secrets from env:
#   TEST_DB_URL  postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:5432/postgres
#   TEST_SUPABASE_ANON_KEY  the project publishable/anon key
ANON = os.environ["TEST_SUPABASE_ANON_KEY"]
DSN  = os.environ["TEST_DB_URL"]

USERS = [
    ("e2e_trusted", "e2e_trusted@app.com", "Test1234!", 150, "trusted"),
    ("e2e_newbie",  "e2e_newbie@app.com",  "Test1234!", 0,   "novice"),
]
LISTING_ID = "22222222-2222-2222-2222-222222222222"

def signup(email, password):
    body = json.dumps({"email": email, "password": password}).encode()
    req = urllib.request.Request(
        f"https://{PROJ}.supabase.co/auth/v1/signup",
        data=body, method="POST",
        headers={"apikey": ANON, "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            print(f"  signup {email}: {r.status}")
    except urllib.error.HTTPError as e:
        msg = e.read().decode()[:200]
        print(f"  signup {email}: HTTP {e.code} {msg}")

print("== signups ==")
for uname, email, pw, rep, cred in USERS:
    signup(email, pw)

conn = psycopg2.connect(DSN, connect_timeout=15)
conn.autocommit = False
cur = conn.cursor()

print("== confirm + public.users ==")
ids = {}
for uname, email, pw, rep, cred in USERS:
    cur.execute("update auth.users set email_confirmed_at=coalesce(email_confirmed_at, now()) where email=%s returning id", (email,))
    row = cur.fetchone()
    if not row:
        print(f"  !! no auth user for {email}")
        continue
    uid = row[0]; ids[uname] = uid
    cur.execute("""
        insert into public.users (id, username, reputation_score, credibility_level)
        values (%s, %s, %s, %s)
        on conflict (id) do update set reputation_score=excluded.reputation_score,
                                        credibility_level=excluded.credibility_level
    """, (uid, uname, rep, cred))
    print(f"  {uname} -> {uid} rep={rep} {cred}")
conn.commit()

trusted = ids.get("e2e_trusted")
newbie  = ids.get("e2e_newbie")
print("== listing/fact/review ==")
# created_by NULL so e2e_trusted can submit a review in flow 04 (prevent_self_review)
cur.execute("""
    insert into public.listings (id, slug, name, entity_type, status, city_code, created_by)
    values (%s,'test-kafe','Test Kafe','business','active','06',NULL)
    on conflict (id) do nothing
""", (LISTING_ID,))
cur.execute("select 1 from public.facts where listing_id=%s", (LISTING_ID,))
if not cur.fetchone():
    cur.execute("""insert into public.facts (listing_id,user_id,statement,category,verification_status)
                   values (%s,%s,'E2E test gerçeği.','safety','verified')""", (LISTING_ID, trusted))
# review authored by newbie: gives flow 03 a review-vote target and avoids colliding
# with flow 04's trusted review
cur.execute("select 1 from public.reviews where listing_id=%s", (LISTING_ID,))
if not cur.fetchone():
    cur.execute("""insert into public.reviews (listing_id,user_id,rating,content)
                   values (%s,%s,5,'E2E test değerlendirmesi.')""", (LISTING_ID, newbie))
conn.commit()

print("== verify ==")
cur.execute("select count(*) from search_listings('Test')")
print("  search_listings('Test') rows:", cur.fetchone()[0])
cur.execute("select name,city_code,status from listings where id=%s", (LISTING_ID,))
print("  listing:", cur.fetchone())
cur.execute("select count(*) from facts where listing_id=%s", (LISTING_ID,)); print("  facts:", cur.fetchone()[0])
cur.execute("select count(*) from reviews where listing_id=%s", (LISTING_ID,)); print("  reviews:", cur.fetchone()[0])
cur.close(); conn.close()
print("done")
