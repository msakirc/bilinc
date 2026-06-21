# Bilinç pgTAP Database Tests

## Status: AUTHORED BUT UNVERIFIED

These tests have been authored by reading the schema SQL files carefully but
have NOT been executed against a live database. They will be verified once a
throwaway test Supabase project is created and the runner prerequisites are
installed. Do NOT claim they pass until you have run them and seen green output.

---

## What is tested

| File | Tests | Covers |
|------|-------|--------|
| `01_rls_facts.sql` | 8 | Policy `facts_insert_qualified` (100-pt gate), category CHECK (9 values incl. abuse/labor), user_id spoofing |
| `02_vote_dedup.sql` | 9 | PK unique on `review_votes`, `fact_votes`, UNIQUE on `fact_checks`, vote type CHECK, spoofing |
| `03_reset_token.sql` | 10 | `verify_security_answers` issues token, wrong-answer counter, lockout at 3/5, `reset_password_with_token` success/replay/expiry/short-password |
| `04_reviews_rls.sql` | 10 | Policy `reviews_insert_auth`, unique-per-user-listing, rating CHECK 0/6, `reviews_update_own` / `reviews_delete_own` cross-user, `reviews_select_active` hides non-active |
| `05_claims_rls.sql` | 9 | Policy `listing_claims_insert_business` (consumer blocked, business_owner allowed), partial unique pending/verified, `listing_claims_delete_own_pending`, role/verification_method CHECK |
| `06_responses_rls.sql` | 10 | Policies `review_responses_insert_owner` / `fact_responses_insert_owner` (non-owner blocked), UNIQUE per review/fact, `*_update_own` / `*_delete_own` cross-user |
| `07_reputation.sql` | 12 | Trigger `private.update_user_reputation` — formula, tiers (novice < 50, contributor >= 50, trusted >= 200, expert >= 500), disputed penalty, delete reduces score |

---

## Prerequisites

1. **psql** — PostgreSQL CLI client
   - macOS: `brew install postgresql`
   - Ubuntu/Debian: `apt-get install postgresql-client`
   - Windows: Download from postgresql.org or use WSL

2. **pg_prove** — pgTAP test runner (Perl tool)
   - macOS: `brew install pgtap` (includes pg_prove)
   - Ubuntu: `apt-get install pgtap`
   - Via CPAN: `cpanm TAP::Parser::SourceHandler::pgTAP`

3. **A throwaway Supabase project** — Create a brand-new project at
   [supabase.com](https://supabase.com) dedicated to testing.
   **NEVER use the production project** (`kofxezcajiilsxdekfpt`).

---

## Setup

### Step 1: Create a test Supabase project

Create a new project in the Supabase dashboard. Note the project ref (a random
alphanumeric string that is NOT `kofxezcajiilsxdekfpt`).

### Step 2: Apply the schema in documented order

Connect with the project's connection string (found in Project Settings >
Database > Connection string, choose "URI" mode with "Transaction mode" OFF
for direct connection on port 5432):

```bash
export TEST_DB_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"

# Apply schema in documented order
psql "$TEST_DB_URL" -v ON_ERROR_STOP=1 -f db/tables.sql
psql "$TEST_DB_URL" -v ON_ERROR_STOP=1 -f db/districts.sql
psql "$TEST_DB_URL" -v ON_ERROR_STOP=1 -f db/policies.sql
psql "$TEST_DB_URL" -v ON_ERROR_STOP=1 -f db/more_fixes.sql
psql "$TEST_DB_URL" -v ON_ERROR_STOP=1 -f db/fixes.sql
psql "$TEST_DB_URL" -v ON_ERROR_STOP=1 -f db/schema_permissions_fix.sql

# Post-launch migrations (idempotent)
psql "$TEST_DB_URL" -v ON_ERROR_STOP=1 -f db/fix_fact_categories.sql
psql "$TEST_DB_URL" -v ON_ERROR_STOP=1 -f db/reset_password_function.sql
```

Note: `db/schedule_refresh.sql` sets up pg_cron and is not required for
running the pgTAP tests. Skip it unless you want to test materialized view
refresh scheduling.

### Step 3: Run the tests

```bash
export TEST_DB_URL="postgresql://..."  # same as above
npm run test:db
```

Or directly:
```bash
bash db/tests/run.sh
```

### Step 4: Interpret results

pg_prove outputs TAP (Test Anything Protocol). A passing run looks like:

```
db/tests/01_rls_facts.sql .. ok
db/tests/02_vote_dedup.sql .. ok
db/tests/03_reset_token.sql .. ok
db/tests/04_reviews_rls.sql .. ok
db/tests/05_claims_rls.sql .. ok
db/tests/06_responses_rls.sql .. ok
db/tests/07_reputation.sql .. ok
All tests successful.
Files=7, Tests=68, ...
```

A failing test shows which assertion failed and why.

---

## Safety guarantees

- **Prod guard**: `run.sh` greps `TEST_DB_URL` for the production ref
  (`kofxezcajiilsxdekfpt`) and exits 1 if found. It is impossible to
  accidentally run these against production.
- **ROLLBACK**: every `.sql` file is wrapped in `BEGIN` / `ROLLBACK`. No
  test data is committed to the test project. Each run starts clean.
- **Deterministic UUIDs**: test rows use namespace-prefixed UUIDs (e.g.
  `00000000-0001-...`) to avoid collisions between files.

---

## Troubleshooting

**`pg_prove: command not found`**
Install pgtap: `brew install pgtap` (macOS) or `apt-get install pgtap`.

**`ERROR: extension "pgtap" does not exist`**
`run.sh` installs it automatically via `CREATE EXTENSION IF NOT EXISTS pgtap`.
If it still fails, the test Supabase project may need the extension enabled
from the Supabase dashboard (Database > Extensions > search "pgtap").

**`ERROR: relation "auth.users" does not exist`**
The `auth` schema is a Supabase-managed schema. Use a Supabase project, not a
plain self-hosted Postgres instance without the Supabase auth schema.

**RLS policy tests fail unexpectedly**
Ensure `more_fixes.sql` has been applied — it re-creates the final policy
definitions. Without it, some policies may still reference `private.*`
functions that `authenticated` cannot call.

**`facts_category_check` violation for 'abuse' or 'labor'**
Apply `db/fix_fact_categories.sql` which adds those two values to the CHECK.
