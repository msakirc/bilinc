# Web E2E coverage vs mobile Maestro (handoff 10)

Maps each mobile flow (`mobile/.maestro/00–29`, see
`docs/handoffs/10-e2e-coverage-expansion.md`) to its web Playwright status.
Legend: ✅ ported · 🔶 partial / different surface · ⛔ no web equivalent ·
🔒 gated (needs env/data).

| # | Mobile flow | Web status | Web spec / reason |
|---|---|---|---|
| 00 | smoke-guest | ✅ | `smoke` |
| 01 | auth-register | ✅ 🔒 | `auth-register` (happy gated by `E2E_ALLOW_SIGNUP`) |
| 02 | auth-login-logout | ✅ | `auth-login` |
| 03 | guest-vote-gate | 🔶 | web facts/reviews are read-only (no vote UI); guest gate covered via `guest-gates` |
| 04 | review-submit | ✅ 🔒 | `review-submit.authed` (gated by `E2E_ALLOW_WRITE`) |
| 05 | fact-rep-gate | ✅ | `fact-rep-gate` (low-rep gate) |
| 06 | search-sort | 🔶 | `search` + `search-filters` (web has filter pills, not the two sort modes) |
| 07 | fact-submit | ⛔🔒 | needs a rep≥100 user; no durable one exists (see FINDINGS #1) |
| 08 | review-guest-gate | ✅ | `guest-gates` |
| 09 | password-reset | ⛔ | no web reset route |
| 10 | profile-account-nav | 🔶 | web profile is public (`profile`); no web account-settings screen |
| 11 | activity-filter | ✅ 🔒 | `activity.authed` |
| 12 | vote-success | ⛔ | web facts/reviews read-only, no vote UI |
| 13 | search-no-results | 🔶 | `search` empty-prompt; no-match-for-query needs data (`E2E_LIVE_DATA`) |
| 14 | register-consent-gate | ✅ | `auth-register` |
| 15 | login-validation | ✅ | `login-validation` |
| 16 | login-wrong-password | ✅ | `login-validation` |
| 17 | settings-notifications | ⛔ | no web settings screen |
| 18 | settings-privacy | ⛔ | no web settings screen |
| 19 | language-toggle | ✅ | `language-toggle` |
| 20 | onboarding | ⛔ | no web onboarding/welcome |
| 21 | search-browse | 🔶 | `smoke` + `search` initial state |
| 22 | account-save | ⛔ | no web account screen |
| 23 | register-username-taken | ✅ 🔒 | `auth-register` (gated by `E2E_USER`) |
| 24 | category-detail | ✅ | `category` not-found + real top-level category renders |
| 25 | category-results | 🔶 | web has no separate results route — `/ara` IS the results page (`search`) |
| 26 | theme-toggle | ✅ | `theme-toggle` |
| 27 | account-edit-name | ⛔ | no web account screen |
| 28 | activity-reviews-filter | ✅ 🔒 | `activity.authed` (tab filter) |
| 29 | profile-help | ⛔ | no web help screen |

## Web-only coverage (no mobile counterpart)

| Web spec | Covers | Note |
|---|---|---|
| `not-found` | unknown route → 404 | mobile `+not-found` unreachable from UI |
| `legal` | `/yasal/{kosullar,gizlilik,kvkk}` | mobile legal links are dead (no onPress) |
| `role-gates` (+`.authed`) | `/panel`, `/yonetim` guest + wrong-role | business/admin panels are web-only |
| `claim.authed` | `/sahiplen/[id]` authed render | claim entry is web |
| `auth-nav` | login ↔ register cross-links | — |
| `business-detail` | `/isletme/[id]` not-found (+ gated real) | — |
| `profile` (not-found) | unknown username → not-found | — |

## Summary

- **Ported / partial:** 18 of 30 mobile flows have a web equivalent (✅/🔶).
- **No web surface:** 9 (settings ×2, account ×3, onboarding, reset, vote, help).
- **Blocked, not missing:** only 07 (needs a durable rep≥100 user — FINDINGS #1).
  The catalog/search migration (FINDINGS #2) closed the old data-dependent gaps,
  so search results, business-detail, and category now run live.
- **Web-only:** 7 specs covering routes mobile doesn't have or can't reach.
