#!/usr/bin/env bash
# ================================================================
# Bilinç pgTAP test runner — cloud Supabase test project
# ================================================================
# Prerequisites:
#   - psql  (PostgreSQL client)
#   - pg_prove  (from the TAP::Parser::SourceHandler::pgTAP Perl module
#                or the pgTAP package: `brew install pgtap` on macOS,
#                `apt-get install pgtap` on Debian/Ubuntu)
#   - TEST_DB_URL  env var pointing at a THROWAWAY test Supabase project
#
# Usage:
#   export TEST_DB_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"
#   bash db/tests/run.sh
#
# Each .sql file wraps its work in BEGIN/ROLLBACK so no committed
# rows are left in the test project after a run.
# ================================================================
set -euo pipefail

# ----------------------------------------------------------------
# 1. Require TEST_DB_URL
# ----------------------------------------------------------------
if [ -z "${TEST_DB_URL:-}" ]; then
  echo "ERROR: TEST_DB_URL is not set."
  echo "  Export the connection string for a THROWAWAY test Supabase project."
  echo "  Example:"
  echo "    export TEST_DB_URL=\"postgresql://postgres.<ref>:<pw>@aws-0-eu-central-1.pooler.supabase.com:5432/postgres\""
  exit 1
fi

# ----------------------------------------------------------------
# 2. PROD GUARD — abort if URL references the production project
# ----------------------------------------------------------------
PROD_REF="kofxezcajiilsxdekfpt"
if echo "$TEST_DB_URL" | grep -q "$PROD_REF"; then
  echo "CRITICAL: TEST_DB_URL contains the PRODUCTION project ref ($PROD_REF)."
  echo "  Refusing to run destructive tests against production."
  echo "  Create a separate throwaway Supabase project for testing."
  exit 1
fi

echo "[run.sh] Prod-guard passed. TEST_DB_URL does not reference $PROD_REF."

# ----------------------------------------------------------------
# 3. Enable pgTAP on the test project
# ----------------------------------------------------------------
echo "[run.sh] Enabling pgTAP extension on test project..."
psql "$TEST_DB_URL" -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS pgtap;" 2>&1

# ----------------------------------------------------------------
# 4. Run all SQL test files via pg_prove
# ----------------------------------------------------------------
echo "[run.sh] Running pgTAP tests..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
pg_prove --verbose -d "$TEST_DB_URL" "$SCRIPT_DIR"/*.sql

echo "[run.sh] All tests complete."
