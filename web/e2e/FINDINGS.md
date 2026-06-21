# Web E2E — findings (staging `hdfmolibxlescbzecygz`)

Surfaced while building the Playwright suite. Verified against mobile (the
up-to-date source of truth) and against staging data directly.

## 1. (RESOLVED — not a bug) reputation gate

Earlier draft flagged the web report-fact rep-gate as a possible web/mobile
mismatch. **It is not.** Direct query of staging:

```
e2e_trusted -> reputation_score: 7   (credibility: novice, type: consumer)
e2e_newbie  -> reputation_score: 1
```

Both seed users are far below the 100 threshold, so the gate correctly hides the
fact form for both. Web logic matches mobile (`(reputation_score ?? 0) < 100`).
Aligned web's guard to mobile's exact null-handling form for parity
(`web/src/app/(consumer)/isletme/[id]/bilgi-ekle/page.tsx`).

**Consequence:** the high-rep path (form visible + `07-fact-submit`) is not
testable until a seed user durably has `reputation_score >= 100`. Per mobile
handoff 10 (`docs/handoffs/10-e2e-coverage-expansion.md`), `reputation_score` is
**recomputed by the trigger `private.update_user_reputation()`** from activity
(`SUM(helpful)*2 + verified_facts*5 + LEAST(reviews+facts,50) - disputed*3`), so
a manual `UPDATE` is **overwritten** the next time that user touches a
review/fact/vote. `e2e_trusted` computes to ~6–7. Durable fix = seed enough
verified facts / helpful reviews, or relax the gate for the test user. (Mobile's
own `07-fact-submit` only passed by temporarily self-inflating rep — see below.)

**Related RLS vuln (mobile handoff 10, NOT fixed):** an authenticated user can
`PATCH /users?id=eq.<self> {reputation_score: 250}` and it succeeds — the users
UPDATE policy doesn't block self-writes of `reputation_score` /
`credibility_level` (both trigger-managed). This bypasses the 100-pt fact gate.
Needs a `db/policies.sql` fix. Affects both clients (server-side RLS).

## 2. (RESOLVED) web catalog + search migrated to the DynamoDB/Lambda layer

**Fixed.** Web now reads the catalog from DynamoDB and search from the Turso/Lambda
proxy — the same backend mobile uses — via server-side Next route handlers
(`web/src/app/api/catalog/*`). The browser calls same-origin `/api/catalog/*`;
the route (Node runtime) does the Cognito unauth + SigV4 signing + Lambda/DynamoDB
calls. This was necessary because **browser-direct calls to the Lambda Function
URL fail CORS** (mobile is native and never hits CORS); routing through the server
also keeps the AWS SDK out of the client bundle and Cognito creds off the client.

Result: web search returns real results, business-detail renders real listings,
category pages render. The previously data-gated specs (`E2E_LIVE_DATA`,
`E2E_LISTING_ID`) were un-gated and pass. `getCities`/`getCategories`/
`getListingStats` and all user-content stay on Supabase. The "no categories
seeded" note was wrong — 11 top-level categories exist (`food-drink`, …); the
empty home grid was a test-timing artifact (counted before the page finished
loading), now fixed by hitting a known slug directly.

Remaining catalog caveats (acceptable, documented): catalog cards/listings carry
`city_code`/`category_slug` but not the joined display *names*, and "trending" is
approximated by recency (catalog has no review-count index). Enrich later via the
seeded Supabase cities/categories tables if needed.

### Original analysis (kept for context)

The gap was: web read catalog from Supabase (`listing_full` MV = **1 row** on
staging) while mobile uses DynamoDB(catalog)+Turso(search). That single divergence
caused web search=0, business-detail not-found, no discoverable listing id. Closed
by the migration above. Per the project DB strategy (DynamoDB catalog + Turso
search + Supabase user-content only), web is now aligned with mobile.

---

### Suite status

43 passed, 2 skipped — only the two write gates (`E2E_ALLOW_SIGNUP` real signup,
`E2E_ALLOW_WRITE` real review), kept off by default to avoid staging writes.
Catalog/search/category/business-detail now run live (no longer gated).
