#!/usr/bin/env bash
# Seed the disposable probe users the admin E2E suite needs, against the STAGING
# Supabase project. Idempotent (re-running is harmless). Reads the staging URL +
# anon key from e2e/.env.e2e.
#
#   bash e2e/seed-probe-users.sh
#
# Creates: e2e_admin (admin), e2e_fixture (rep>=100 actor), e2e_bizowner
# (business_owner), e2e_escalation_probe (plain consumer). All password Test1234!
#
# IMPORTANT: the user_type / reputation_score writes below go through the anon
# REST API and only succeed while the privilege-self-escalation hole is OPEN.
# After you apply db/fix_users_rls_selfescalation.sql, set those columns with
# the service_role key or the Supabase SQL editor instead (the trigger then
# blocks anon writes — which is the point).
set -euo pipefail
cd "$(dirname "$0")/.."

URL=$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' e2e/.env.e2e | cut -d= -f2- | tr -d '\r"')
KEY=$(grep -E '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' e2e/.env.e2e | cut -d= -f2- | tr -d '\r"')
PASS="Test1234!"

ensure_user() {  # $1=username  -> echoes "id token"
  local u="$1" resp tok id
  resp=$(curl -s "$URL/auth/v1/signup" -H "apikey: $KEY" -H "Content-Type: application/json" \
    -d "{\"email\":\"$u@app.com\",\"password\":\"$PASS\"}")
  tok=$(echo "$resp" | grep -oE '"access_token":"[^"]+"' | head -1 | cut -d'"' -f4)
  if [ -z "$tok" ]; then
    tok=$(curl -s "$URL/auth/v1/token?grant_type=password" -H "apikey: $KEY" -H "Content-Type: application/json" \
      -d "{\"email\":\"$u@app.com\",\"password\":\"$PASS\"}" | grep -oE '"access_token":"[^"]+"' | head -1 | cut -d'"' -f4)
  fi
  id=$(curl -s "$URL/auth/v1/user" -H "apikey: $KEY" -H "Authorization: Bearer $tok" | grep -oE '"id":"[^"]+"' | head -1 | cut -d'"' -f4)
  curl -s -o /dev/null -X POST "$URL/rest/v1/users" -H "apikey: $KEY" -H "Authorization: Bearer $tok" \
    -H "Content-Type: application/json" -H "Prefer: resolution=ignore-duplicates" \
    -d "{\"id\":\"$id\",\"username\":\"$u\"}"
  echo "$id $tok"
}

patch_self() {  # $1=id $2=token $3=json
  curl -s -o /dev/null -w "  patch:%{http_code}\n" -X PATCH "$URL/rest/v1/users?id=eq.$1" \
    -H "apikey: $KEY" -H "Authorization: Bearer $2" -H "Content-Type: application/json" -d "$3"
}

read AID ATOK < <(ensure_user e2e_admin);              echo "e2e_admin=$AID";              patch_self "$AID" "$ATOK" '{"user_type":"admin"}'
read FID FTOK < <(ensure_user e2e_fixture);            echo "e2e_fixture=$FID";            patch_self "$FID" "$FTOK" '{"reputation_score":100}'
read BID BTOK < <(ensure_user e2e_bizowner);           echo "e2e_bizowner=$BID";           patch_self "$BID" "$BTOK" '{"user_type":"business_owner"}'
read EID ETOK < <(ensure_user e2e_escalation_probe);   echo "e2e_escalation_probe=$EID"
read TID TTOK < <(ensure_user e2e_typeflip);           echo "e2e_typeflip=$TID  # -> E2E_TYPEFLIP_USER_ID"

echo "Done. Verify:"
curl -s "$URL/rest/v1/users?username=in.(e2e_admin,e2e_fixture,e2e_bizowner,e2e_escalation_probe)&select=username,user_type,reputation_score" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"; echo
