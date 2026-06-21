import os, sys, psycopg2

# Connection string from env, e.g.
#   export TEST_DB_URL="postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:5432/postgres"
DSN = os.environ["TEST_DB_URL"]

ORDER = [
    "tables.sql",
    "districts.sql",
    "policies.sql",
    "more_fixes.sql",
    "fixes.sql",
    "schema_permissions_fix.sql",
    "fix_fact_categories.sql",
]

import os
here = os.path.dirname(os.path.abspath(__file__))

conn = psycopg2.connect(DSN, connect_timeout=15)
conn.autocommit = False
for fn in ORDER:
    path = os.path.join(here, fn)
    with open(path, "r", encoding="utf-8") as f:
        sql = f.read()
    cur = conn.cursor()
    try:
        cur.execute(sql)
        conn.commit()
        print(f"OK   {fn}")
    except Exception as e:
        conn.rollback()
        print(f"FAIL {fn}: {type(e).__name__}: {str(e)[:400]}")
    finally:
        cur.close()
conn.close()
print("done")
