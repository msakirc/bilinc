# Bilinç i18n — architecture & contract

Single source of truth for all UI strings across **mobile** (Expo/React Native)
and **web** (Next.js). One library both sides: `i18next` + `react-i18next`.

## Layout

```
i18n/
  locales/<locale>/<namespace>.json   ← CANONICAL. Edit here only.
  sync.mjs                            ← copies + generates per-app barrels
  README.md
```

Locales: `tr` (canonical + fallback), `en`. Namespaces:
`common, validation, errors, auth, home, business, fact, review, profile,
activity, settings, search, category, admin, panel, legal`.

`sync.mjs` copies the canonical tree into `mobile/src/i18n/locales` and
`web/src/i18n/locales`, and generates `resources.generated.ts` (static-import
barrel) in each app. Bundlers can't reliably import JSON from outside their own
root, hence the copy. **Run `node i18n/sync.mjs` after editing any JSON.**
Wired to `prestart` (mobile) and `predev`/`prebuild` (web); `i18n:check` fails
CI on drift.

## Usage

**Mobile** (global instance, no provider needed):
```tsx
import { useTranslation } from 'react-i18next';
const { t } = useTranslation();           // defaultNS = common
t('auth:login.title');                    // other ns via prefix
t('common:actions.save');
import { formatDate, formatRelativeDate, formatNumber } from '@/src/i18n/format';
import { useLanguage } from '@/src/i18n/useLanguage';
```

**Web** (client provider already mounted in root layout):
```tsx
'use client';
import { useTranslation } from 'react-i18next';
const { t } = useTranslation();
t('panel:dashboard.welcome', { name });
import { useFormat } from '@/i18n/format';        // { formatDate, formatNumber, formatRelativeDate }
import { useLanguage } from '@/i18n/useLanguage';  // { language, setLanguage, toggle }
```

Server components: pass `locale` down or use the bare `formatDate(locale, …)`.

## Key conventions

- Namespace = surface (screen group). `common` = shared (nav, actions, labels,
  entity/credibility/factCategory/verification/userType enums, dates).
- Keys: `camelCase`, dot-nested by section: `login.title`, `dashboard.welcome`.
- Interpolation: `"Hoş geldiniz, {{name}}"` → `t(key, { name })`.
- Plurals: i18next suffix `_one` / `_other` with `{{count}}` (see `common.date`).
- Enum lookups (status/category/type): use existing `common` keys, e.g.
  `t('common:verification.' + status)`, `t('common:factCategory.' + cat)`.
- Turkish is canonical and must be state-of-the-art (proper diacritics: İ ş ğ ü ö ç).
  English is a full best-effort translation.

## Rules for migration agents

1. Edit canonical JSON under `i18n/locales/<loc>/<your-namespace>.json` only.
   **Merge** keys into the existing file — never delete keys you didn't add,
   never touch other namespaces.
2. Add the SAME keys to both `tr` and `en`.
3. Reuse `common` for anything shared; don't duplicate nav/actions/enums.
4. Replace hardcoded strings in your assigned files with `t()` calls. Keep
   brand names (Bilinç, Starbucks, etc.) and mock seed data as-is unless told.
5. Run `node i18n/sync.mjs` when done so barrels regenerate.
6. Do NOT edit: `mobile/app/_layout.tsx`, `web/src/app/layout.tsx`, anything
   under `*/src/i18n/`, or `web/src/lib/utils.ts` label/format functions
   (owned by the coordinator).
