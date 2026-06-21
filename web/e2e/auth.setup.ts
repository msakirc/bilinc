import { test as setup } from "@playwright/test";
import { login } from "./helpers";

// Logs in a seed user once and saves the session, so *.authed specs reuse it
// instead of logging in per test. Always writes the file (empty when no creds)
// so the authed project can load storageState; authed specs skip on no creds.
//
// IMPORTANT: this uses the LOW-REP user, NOT the trusted one. The login/logout
// spec (02) calls Supabase signOut(), which defaults to GLOBAL scope and
// revokes every session for that user. If the persistent session shared the
// trusted account, that signOut would kill it mid-run. Different account =
// isolation. Authed read flows don't need reputation anyway.
export const AUTH_FILE = "e2e/.auth/user.json";

setup("authenticate", async ({ page }) => {
  const user = process.env.E2E_LOWREP_USER ?? process.env.E2E_USER;
  const pass = process.env.E2E_LOWREP_PASS ?? process.env.E2E_PASS;
  if (user && pass) {
    await login(page, user, pass);
  }
  await page.context().storageState({ path: AUTH_FILE });
});
