# Web E2E (Playwright)

Web counterpart of the mobile `mobile/.maestro` suite. Declarative browser flows,
headless, fully automated in CI.

## Install (one-time)

```bash
cd web
npm i -D @playwright/test
npx playwright install --with-deps chromium
```

## Run

```bash
npm run test:e2e          # headless, boots `next dev` itself
npm run test:e2e:ui       # interactive UI mode (debug)
npm run test:e2e:codegen  # record a new flow -> generates spec code
```

Playwright starts the app via `webServer` in `playwright.config.ts` (dev locally,
`build && start` in CI). To test an already-running server or staging, set
`E2E_BASE_URL` and it skips booting.

## Flows

| Spec | Mirrors (Maestro) | Needs live DB? |
|---|---|---|
| `smoke.spec.ts` | 00-smoke-guest | No |
| `search.spec.ts` | 06-search-sort, 13-search-no-results | No (URL/empty-state); result list gated by `E2E_LIVE_DATA=1` |
| `auth-register.spec.ts` | 14-register-consent-gate, 01-auth-register | No (validation gates); happy-path gated by `E2E_ALLOW_SIGNUP=1` |
| `guest-gates.spec.ts` | 03-guest-vote-gate, 08-review-guest-gate | Staging reachable (auth init) |
| `language-toggle.spec.ts` | 19-language-toggle | No |
| `login-validation.spec.ts` | 15-login-validation, 16-login-wrong-password | Wrong-pw gated by `E2E_USER` |
| `auth-login.spec.ts` | 02-auth-login-logout | Yes — `E2E_USER` / `E2E_PASS` (trusted seed) |
| `fact-rep-gate.spec.ts` | 05-fact-rep-gate | Yes — `E2E_LOWREP_USER` (sub-100 seed) |
| `activity.authed.spec.ts` | 11-activity-filter | Yes — reuses the authed session |
| `review-submit.authed.spec.ts` | 04-review-submit | Write — gated by `E2E_ALLOW_WRITE=1` |

`*.authed.spec.ts` run in the **authed** Playwright project, which reuses a
session saved once by `auth.setup.ts` (no per-test login). Guest flows run in
the **guest** project with no session.

Specs auto-`skip` when their env var is absent, so the suite stays green even
while prod Supabase is paused.

**Not ported:** 07-fact-submit (the fact write needs a rep≥100 seed user; both
staging seeds are currently sub-100 — see FINDINGS.md), 09-password-reset /
10-profile-account / 12-vote-success / 17-18 settings (no web equivalent screen).

### Web-only flows (no Maestro counterpart)

| Spec | Covers |
|---|---|
| `smoke` | home renders, navbar nav |
| `theme-toggle` | dark-mode class on `<html>` |
| `not-found` | unknown route → HTTP 404 |
| `legal` | `/yasal/{kosullar,gizlilik,kvkk}` + unknown |
| `search-filters` | entity-type + min-rating pills toggle |
| `auth-nav` | login ↔ register form cross-links |
| `profile` | public `/profil/[username]` + not-found |
| `business-detail` | `/isletme/[id]` not-found (+ gated real render) |
| `category` | `/kategori/[slug]` not-found (+ adaptive happy) |
| `role-gates` (+`.authed`) | `/panel` `/yonetim` guest + wrong-role gates |
| `claim.authed` | `/sahiplen/[id]` authed render |

### Findings & coverage

Real product/data observations surfaced by the suite are in **`FINDINGS.md`**
(headline: web catalog/search not migrated to the Turso/DynamoDB proxy mobile
uses). A flow-by-flow map against the mobile Maestro suite (handoff 10) is in
**`COVERAGE.md`** — 18/30 mobile flows have a web equivalent; the rest have no
web surface (settings/account/onboarding/reset/vote) or are blocked by the
migration gap.

## Auth model

`auth.setup.ts` logs in **once** and saves the session to `e2e/.auth/user.json`
(gitignored); the authed project loads it via `storageState`.

It deliberately uses the **low-rep** seed (`E2E_LOWREP_USER`), not the trusted
one. The login/logout spec calls Supabase `signOut()`, which defaults to
**global** scope and revokes *every* session for that account — if the
persistent session shared the trusted user, that signOut would kill it mid-run.
Different account = isolation. Authed read/write flows here need no reputation.

## Env

| Var | Effect |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `..._ANON_KEY` | required for the app to build/run |
| `E2E_USER` / `E2E_PASS` | trusted seed — login/logout + wrong-password flows |
| `E2E_LOWREP_USER` / `E2E_LOWREP_PASS` | sub-100 seed — rep-gate + persistent authed session |
| `E2E_ALLOW_SIGNUP=1` | enable real signup (writes a row — use a disposable project) |
| `E2E_ALLOW_WRITE=1` | enable real review submit (writes a row) |
| `E2E_LIVE_DATA=1` | enable search result-list assertions |
| `E2E_BASE_URL` | test an existing URL instead of booting one |

> Point E2E at a **disposable/staging** Supabase, never the paused prod project.

## Selectors

`e2e/selectors.ts` holds TR strings mirroring `i18n/locales/tr/*.json` (tr is the
canonical fallback locale, so text is stable). Forms lack `htmlFor`/`id`, so flows
target **placeholders + button roles** rather than `getByLabel`. If you change an
i18n string used in a flow, update `selectors.ts`.
