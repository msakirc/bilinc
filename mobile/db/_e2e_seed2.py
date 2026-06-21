import os, json, urllib.request, urllib.error, psycopg2

PROJ = "hdfmolibxlescbzecygz"
# Secrets from env:
#   TEST_DB_URL  postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:5432/postgres
#   TEST_SUPABASE_ANON_KEY  the project publishable/anon key
ANON = os.environ["TEST_SUPABASE_ANON_KEY"]
DSN  = os.environ["TEST_DB_URL"]

def login(email, pw):
    body = json.dumps({"email": email, "password": pw}).encode()
    req = urllib.request.Request(f"https://{PROJ}.supabase.co/auth/v1/token?grant_type=password",
        data=body, method="POST", headers={"apikey": ANON, "Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=20))["access_token"]

def rpc(token, fn, args):
    body = json.dumps(args).encode()
    req = urllib.request.Request(f"https://{PROJ}.supabase.co/rest/v1/rpc/{fn}",
        data=body, method="POST",
        headers={"apikey": ANON, "Authorization": "Bearer " + token, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, r.read().decode()[:200]
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]

# 1. set security questions for e2e_trusted (RESET_USER), both answers = "test"
tok = login("e2e_trusted@app.com", "Test1234!")
st, resp = rpc(tok, "set_security_questions", {
    "p_question_1": "İlk evcil hayvanınızın adı?",
    "p_answer_1": "test",
    "p_question_2": "Doğduğunuz şehir?",
    "p_answer_2": "test",
})
print("set_security_questions:", st, resp)

# 2. bump e2e_trusted reputation to 150 for flow 07 (rep-recalc trigger had lowered it)
conn = psycopg2.connect(DSN, connect_timeout=15)
cur = conn.cursor()
cur.execute("update public.users set reputation_score=150, credibility_level='trusted' where username='e2e_trusted' returning reputation_score, credibility_level")
print("e2e_trusted ->", cur.fetchone())
conn.commit()
# verify questions are fetchable
cur.execute("select count(*) from user_security us join users u on u.id=us.user_id where u.username='e2e_trusted'")
print("user_security rows for e2e_trusted:", cur.fetchone()[0])
cur.close(); conn.close()
print("done")
