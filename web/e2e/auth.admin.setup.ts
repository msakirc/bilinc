import { test as setup } from "@playwright/test";
import { login } from "./helpers";

// Logs in an ADMIN seed user once and saves the session, so *.admin.spec.ts
// reuse it instead of logging in per test. Separate from auth.setup.ts (which
// uses a regular low-rep user) because the admin panel gates on
// user.user_type === "admin" — the low-rep session would be redirected to "/".
//
// Always writes the file (empty when no creds) so the admin project can load
// storageState; admin specs skip on no creds via E2E_ADMIN_USER guard.
//
// The staging admin account does NOT exist by default — seed it once with
// db/seed_e2e_admin.sql, then set E2E_ADMIN_USER / E2E_ADMIN_PASS in .env.e2e.
export const ADMIN_AUTH_FILE = "e2e/.auth/admin.json";

setup("authenticate admin", async ({ page }) => {
  const user = process.env.E2E_ADMIN_USER;
  const pass = process.env.E2E_ADMIN_PASS;
  if (user && pass) {
    await login(page, user, pass);
  }
  await page.context().storageState({ path: ADMIN_AUTH_FILE });
});
