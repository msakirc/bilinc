# Bilinç E2E — Maestro flows

Black-box UI flows. Maestro asserts against the view hierarchy (testIDs + Turkish
text), runs on the emulator, and prints **pass/fail text** — no screenshots, no
vision loop, no token drain.

## Flows

| File | Path covered | Locks bug |
|---|---|---|
| `00-smoke-guest.yaml` | launch → guest → open business | — |
| `01-auth-register.yaml` | register → security setup | — |
| `02-auth-login-logout.yaml` | login seeded user → sign out | #2 refreshUser |
| `03-guest-vote-gate.yaml` | guest taps vote → routed to login | #6 vote gate |
| `04-review-submit.yaml` | trusted user submits review | review path |
| `05-fact-rep-gate.yaml` | sub-100 user blocked from fact | #5 rep gate |
| `06-search-sort.yaml` | guest searches + toggles sort | search sort |
| `07-fact-submit.yaml` | trusted user submits fact (happy path) | fact path |
| `08-review-guest-gate.yaml` | guest taps write-review → login gate | guest review gate |
| `09-password-reset.yaml` | security-question reset → step 3 (non-destructive) | reset path |

`_launch / _guest / _login / _open-business` are reusable subflows (tag `subflow`,
excluded from folder runs).

## ⚠️ Prod-safety guard (READ FIRST)

`01`, `04` and `07` **write real rows** (new user, new review, new fact). The installed build must
target a **throwaway test Supabase project** — NOT prod (`kofxezcajiilsxdekfpt`).
Safety is enforced at BUILD time: the dev/standalone app you install must carry a
test `EXPO_PUBLIC_SUPABASE_URL`. Verify before running:

```powershell
Select-String -Path .env -Pattern EXPO_PUBLIC_SUPABASE_URL   # must NOT be the prod ref
```

## Prereqstrap (one-time, Windows)

Emulator + `adb` already work here. Missing: **Java JDK 11+** and **Maestro CLI**.
Maestro's CLI is Linux/Mac-first; on Windows use **WSL** and bridge to the Windows
adb server.

1. Install a JDK (Temurin 17) on Windows OR inside WSL.
2. Install Maestro:
   - **WSL (recommended):** `curl -fsSL https://get.maestro.mobile.dev | bash`
   - then point WSL at the Windows emulator:
     `export ADB_SERVER_SOCKET=tcp:$(cat /etc/resolv.conf | grep nameserver | awk '{print $2}'):5037`
   - (or run `adb -a nodaemon server` on Windows so WSL can reach it)
3. Confirm device is visible: `maestro test --help` and `adb devices` (must list the emulator).

## Build under test

Maestro drives an **installed APK**, not Metro. Use a dev or preview build:

```powershell
# whichever your EAS setup uses; must embed the TEST Supabase url
eas build --profile preview --platform android --local
adb install <path-to.apk>
```

`appId` = `net.bilinc.app` (see `app.json`). If running Expo Go instead, set
`APP_ID=host.exp.Exponent` in `.env`.

## Run

```bash
cp .maestro/.env.example .maestro/.env   # then fill seeded creds
# single flow
maestro test --env-file .maestro/.env .maestro/00-smoke-guest.yaml
# whole suite (subflows auto-excluded)
maestro test --env-file .maestro/.env .maestro/
# unique register run
maestro test --env-file .maestro/.env --env REG_SUFFIX=$(date +%s) .maestro/01-auth-register.yaml
```

## Seed data required in the test project

- `SEED_USER` with `reputation_score >= 100`
- `LOWREP_USER` with `reputation_score < 100`
- ≥1 listing whose name matches `SEARCH_TERM`, carrying ≥1 fact and ≥1 review
  (so vote buttons `*-vote-*-*` render for flow 03)
- `RESET_USER` with all 3 security-question answers set to `RESET_ANSWER`
  (flow 09 verifies identity but never submits, so the password is unchanged)
