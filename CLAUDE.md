# Bilinç Workspace — Claude Code Instructions

## Critical Rules

### Remote Control Session Recovery
If you receive the SAME message from the user 2-3 times, the session is broken. User is AFK. Recover by reading recent session JSONLs and continuing the work.

### Communication Preferences
- Ask clarifying questions ONE AT A TIME, not in bulk
- User is a backend dev, not mobile/frontend — make frontend decisions yourself
- Only ask about product intent, business logic, or UX decisions
- When told to proceed, just build — don't over-plan

## Project: Bilinç

**Universal review platform** separating subjective reviews from objective, verifiable facts. Turkey-only at launch. Turkish UI, English fallback.

**Core concept:** Facts are first-class citizens displayed above reviews. Fact reporting gated behind reputation threshold (100+ points). Community votes to verify/dispute facts.

**Scope:** Not just food safety — covers customer abuse, labor rights violations, environmental damage, shrinkflation, fraud, and any verifiable claim about any business/product/brand.

**Backend:** Supabase (PostgreSQL + Auth + Storage + RLS). Live at `kofxezcajiilsxdekfpt.supabase.co`. Credentials in `.env` files (gitignored).

**Revenue:** Business owner subscriptions (Basic/Pro/Enterprise) + in-app ads.

## Workspace Structure

```
main/
├── mobile/          ← Active mobile app (Expo 54 + React Native)
│   ├── app/            ← 22 Expo Router screen files
│   ├── src/            ← services, store, types, theme, contexts
│   ├── py/             ← Python scrapers (OSM, categories, tağşiş)
│   └── db/             ← SQL schema files (run order below)
├── paraflow/           ← Design reference (24 screens, style guides, PRD)
├── docs/               ← Marketing strategy, specs, plans
└── plan.md             ← Architecture doc
```

## Session Handoffs

ALL session handoffs go in ONE dir: `docs/handoff/` (singular, flat — no subfolders).
Name: `YYYY-MM-DD-<topic>-handoff.md` (date = session date, kebab-case topic).
- NO `NN-` number prefixes, NO `HANDOFF-X` / `handoff-x` variants, NO per-area subdirs
  (`docs/superpowers/handoffs/`, etc.). One scheme only — see kutay workspace for the model.
- Cross-reference other handoffs by filename, never by bare number.
- `docs/` is gitignored (not for public repo) — handoffs live on disk only; never `git add`.
- Index/synthesis files (optional) end in `-INDEX.md`, same dir.

## Database

**Schema run order:**
```
db/tables.sql → db/districts.sql → db/policies.sql → db/more_fixes.sql → db/fixes.sql → db/schema_permissions_fix.sql
```

**Post-launch migrations (run after the base order, idempotent):**
```
db/fix_fact_categories.sql       → adds 'abuse' + 'labor' to facts.category CHECK
db/reset_password_function.sql   → reset_password_with_token() + token storage
db/schedule_refresh.sql          → one-time MV refresh + pg_cron schedule (10 min)
db/storage_verification_bucket.sql → private bilinc-verification bucket + RLS (run before claim_submit_flow)
db/claim_submit_flow.sql         → claim self-insert policy, VKN/consent cols, retention sweeper
db/verification_video_method.sql → adds 'video' to verification_method CHECK + capture-metadata/decided_at columns
db/decide_claim.sql              → atomic admin claim-decision RPC (is_admin-guarded) + claim_audit; run AFTER verification_video_method.sql
db/claim_cooldown.sql            → 14-day re-claim cooldown after rejection; run AFTER the above
db/ministry_facts.sql            → system user + listings.source/source_id + fact_sources (ministry scrapers)
```
See `db/STORAGE_SETUP.md` for the Storage bucket (`bilinc-media`) dashboard steps.

**Current data:** 233 categories, ~1000+ listings (OSM), 6 facts, 7 reviews, 81 cities, 972 districts, 1 user

**Key tables:** users, listings, listing_full (materialized view), reviews, facts, fact_checks, review_votes, fact_votes, categories, cities, districts, listing_claims, subscriptions

## Tech Stack & Decisions

- **Expo SDK 54**, React Native 0.81.5, React 19.1.0
- **react-native-screens@4.16.0** — NOT 4.19 (crashes on Android)
- **newArchEnabled: false** — New Architecture disabled (Android compat)
- **edgeToEdgeEnabled: false**
- **Navigation:** Expo Router (file-based, `app/` directory)
- **State:** Zustand (auth), React Context (theme, app data, guest mode)
- **Icons:** Ionicons from @expo/vector-icons (NO emojis)
- **Theme:** ThemeProvider with light/dark/system, AsyncStorage persistence
- **Auth:** Username-based (converts to `username@app.com` for Supabase Auth)
- **Credentials:** `.env` with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## Internationalization (i18n)

Shared across mobile + web. One library both sides: **i18next + react-i18next**.
Locales: **tr** (canonical + fallback), **en** (full). Turkish must use correct
diacritics (İ ı Ş ş Ğ ğ Ü ü Ö ö Ç ç).

- **Single source of truth:** `i18n/locales/<loc>/<namespace>.json` at repo root.
  Edit there only. `i18n/sync.mjs` copies into each app (`*/src/i18n/locales`) and
  generates `resources.generated.ts`. Run `node i18n/sync.mjs` after editing JSON
  (wired to `prestart` mobile / `predev`+`prebuild` web; `i18n:check` for CI).
- **Namespaces:** common, validation, errors, auth, home, business, fact, review,
  profile, activity, settings, search, category, admin, panel, legal, chrome.
  `common` holds nav/actions/labels + enum maps (verification, factCategory,
  credibility, entityType, userType) and date tokens. Reuse it, don't duplicate.
- **Usage:** `const { t } = useTranslation(); t('auth:login.submit')`. Formatting:
  mobile `@/src/i18n/format` (formatDate/formatRelativeDate/formatNumber); web
  `useFormat()`. Language switch: `useLanguage()` ({ language, setLanguage, toggle }).
- **Mobile:** global instance (init in `src/i18n`, side-effect imported by
  `app/_layout.tsx`, device locale via expo-localization, AsyncStorage persist).
  jest.setup.js inits i18n so screen tests resolve t().
- **Web:** cookie-seeded client instance — root layout reads `bilinc.lang` cookie
  and passes to `<I18nProvider>` (no hydration mismatch); persists to cookie+localStorage.
- Full contract: `i18n/README.md`.

## Route Structure

```
app/
├── _layout.tsx                 ← Root: Stack + SafeArea + Theme + AppData + AuthGate + GuestContext
├── (auth)/
│   ├── _layout.tsx             ← Stack, headerShown: false
│   ├── welcome.tsx, onboarding.tsx, login.tsx, register.tsx
│   ├── setup-security.tsx, reset-password.tsx
├── (tabs)/
│   ├── _layout.tsx             ← Tabs with Ionicons, theme colors
│   ├── index.tsx (Home), search.tsx, activity.tsx, profile.tsx
├── business/[id]/
│   ├── index.tsx               ← Business detail (headerShown: false, edge-to-edge hero)
│   ├── review.tsx              ← Write review (modal)
│   └── fact.tsx                ← Report fact (modal)
├── category/
│   ├── [slug].tsx              ← Category detail
│   └── [slug]/results.tsx      ← Category results
├── settings/
│   ├── account.tsx, notifications.tsx, privacy.tsx
└── +not-found.tsx
```

## Python Scripts (py/)

| Script | Purpose | Run |
|---|---|---|
| `osm-scraper.py` | Scrape Turkish businesses from OpenStreetMap | `python osm-scraper.py --supabase` |
| `category-migrater.py` | Migrate hierarchical category structure | `python category-migrater.py` |
| `ministry_facts/run.py` | Scrape all ministry tağşiş/recall lists → verified facts | `python -m ministry_facts.run --source all --write` |

All scripts read credentials from `py/.env` (SUPABASE_URL, SUPABASE_SERVICE_KEY).

### Catalog dedup (MANDATORY for any scraper)
All catalog scrapers resolve identity via `py/catalog_identity.resolve()` and write
via `upsert()`. NEVER write per-scraper dedup/matching. Contract: `py/CATALOG.md`.
DynamoDB is the identity authority; Turso is a read-only accelerator.

## Implementation Status (as of 2026-03-31)

**Beta-ready.** 75+ commits. All screens implemented with:
- Ionicons vector icons (no emojis)
- Full dark mode support
- Turkish UI throughout
- Real Supabase data with mock fallbacks
- Pull-to-refresh on key screens

### What works:
- Auth (register, login, security questions, password reset, guest browse)
- Home (hero banner, tağşiş warnings, verified facts, trusted businesses)
- Search (real API + mock fallback, sort, pill search bar)
- Business detail (edge-to-edge hero, facts, reviews, voting, tağşiş auto-detect)
- Write review (Ionicons stars, image picker, Supabase submit)
- Report fact (8 categories incl. abuse/labor/environment, Supabase submit)
- Activity (real user data, delete, filter tabs)
- Profile (real stats, settings with icons, theme toggle)
- Settings (account edit, notification/privacy toggles)

### What's missing for production:
- [ ] EAS build for App Store / Google Play
- [ ] `reset_password_with_token` Edge Function
- [ ] Push notifications
- [ ] Business owner web dashboard
- [ ] Admin moderation panel
- [ ] Real image uploads to Supabase Storage (bucket needs creation)
- [ ] Materialized view refresh (search_listings RPC returns 0)
- [ ] i18n system for English fallback
- [ ] App Store assets (screenshots, description)

### Fact categories:
safety, health, quality, legal, environmental, abuse, labor, other
