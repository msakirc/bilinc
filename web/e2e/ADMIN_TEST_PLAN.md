# Admin Panel (`/yonetim`) — Test Coverage Plan

Web admin panel has **zero functional coverage** today. Only 2 role-gate tests exist
(`role-gates.spec.ts` guest → `/giris`, `role-gates.authed.spec.ts` regular user → `/`).
This plan adds full Playwright E2E coverage matching existing `web/e2e` conventions
(staging Supabase, session reuse, Turkish locale, `E2E_ALLOW_WRITE` write guard).

## Surface under test (7 sections)

| Route | Page | What it does |
|---|---|---|
| `/yonetim` | Dashboard | 9 stat cards (RPC `get_admin_stats`), each links to a section |
| `/yonetim/kullanicilar` | Users | table, change user_type dropdown, active toggle |
| `/yonetim/isletmeler` | Listings | status filter (active/pending/removed), status dropdown |
| `/yonetim/yorumlar` | Reviews | filter tabs (all/flagged/active/hidden/removed), status dropdown |
| `/yonetim/bilgiler` | Facts | filter tabs (all/flagged/pending/verified/disputed), status dropdown |
| `/yonetim/talepler` | Claims | pending ownership claims, approve / reject-with-reason modal, signed-URL doc view |
| `/yonetim/duzenlemeler` | Edits | pending field edits, approve / reject-with-reason modal |

Access: middleware gates `/yonetim` to logged-in; `(admin)/layout.tsx` requires
`user.user_type === "admin"` else redirect `/`.

## Test infrastructure (the central new piece)

Current `authed` project reuses a **regular** lowrep session. Admin pages need an
**admin** session. Add:

1. **Env** (`e2e/.env.e2e`, `.env.e2e.example`): `E2E_ADMIN_USER`, `E2E_ADMIN_PASS`
   — a staging account whose `users.user_type = 'admin'`.
2. **Setup** (`auth.admin.setup.ts`): logs in admin once → `e2e/.auth/admin.json`.
   Skips writing real session when no creds (mirror `auth.setup.ts`).
3. **Project** (`playwright.config.ts`): new `admin` project,
   `testMatch: /\.admin\.spec\.ts/`, `dependencies: ["admin-setup"]`,
   `storageState: "e2e/.auth/admin.json"`. Add `admin-setup` setup project.
   Update `guest` `testIgnore` to also ignore `*.admin.spec.ts` + admin setup.
4. Every admin spec: `test.skip(!process.env.E2E_ADMIN_USER, "needs admin session")`
   so suite stays green without creds (same pattern as authed specs).

## testIDs to add (admin pages)

Existing tests select by Turkish i18n text. Admin tables/dropdowns/modals are
dynamic — add stable `data-testid`s (mirrors the mobile testID pass) to:
- Sidebar nav items: `admin-nav-{dashboard,users,listings,reviews,facts,claims,edits}`
- Dashboard stat cards: `admin-stat-{users,listings,pending-claims,...}`
- List rows: `admin-row-{userId|listingId|...}`; status `<select>`: `admin-status-select`
- Filter tabs: `admin-filter-{status}`
- Claim/edit actions: `admin-approve`, `admin-reject`, reject modal + `admin-reject-reason`,
  `admin-reject-confirm`; doc link `admin-doc-link`
- Pagination: `admin-page-next` / `admin-page-prev`

## Specs

### Read-only (run by default, no DB mutation)

`admin-access.admin.spec.ts`
- admin can load `/yonetim` (not redirected)
- each sidebar link navigates to its section, page header renders

`admin-dashboard.admin.spec.ts`
- 9 stat cards visible, numbers render (≥0)
- a stat card click deep-links to its section

`admin-lists.admin.spec.ts` (users / listings / reviews / facts)
- table renders ≥1 row (or empty-state)
- filter tabs switch and re-query (URL/state changes, rows update)
- pagination next/prev when >50 items

`admin-queues.admin.spec.ts` (claims / edits)
- pending list renders or shows empty-state
- claim row exposes doc link, role, method; edit row shows old→new diff
- reject modal opens and cancels without mutation

### Write (guarded by `E2E_ALLOW_WRITE=1`)

`admin-moderation.write.admin.spec.ts`
- review: change status active→hidden→active (restore); assert `is_flagged` cleared
- fact: change verification_status pending→verified→pending (restore)
- listing: status active→pending→active (restore)
- user: toggle a disposable test user's active off→on; change type then revert
- claim approve happy-path **only against a seeded throwaway claim** (promotes user to
  business_owner + 1yr expiry + deletes doc — destructive, so seed+teardown, never a real claim)
- edit approve/reject against seeded throwaway edit

All write tests self-restore (mutate then revert) to keep staging stable, matching the
existing `E2E_ALLOW_WRITE` side-effect-free default.

## Negative / gate (extend existing)

Already covered: guest→`/giris`, regular→`/`. Add:
- business_owner (non-admin) → `/` (if a biz account exists in env)
- direct deep-link to `/yonetim/talepler` as non-admin → redirect

## Out of scope / risks

- Claim-approve is the only irreversible flow → requires seeded test data + teardown
  (a `db/seed_e2e_admin.sql` or service-key fixture). Flag if staging has no safe seed.
- `get_admin_stats` RPC must exist on staging; assert presence, skip gracefully if absent.

## Rollout order

1. Infra: env + admin setup + config project + testIDs (no behavior change)
2. Read-only specs (default-run, green immediately with admin creds)
3. Write specs behind `E2E_ALLOW_WRITE`
4. Wire into CI run + update `web/e2e` docs / coverage map
