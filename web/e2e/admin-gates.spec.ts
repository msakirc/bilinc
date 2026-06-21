import { test, expect } from "@playwright/test";
import { login } from "./helpers";

// Extra admin-panel access gates beyond role-gates.*.spec.ts (which cover guest
// → /giris and the persistent regular-user session → /). These log in the
// relevant role in-test (guest project, no stored session).

test.describe("admin panel access gates", () => {
  test("guest deep-linking a sub-route is sent to /giris", async ({ page }) => {
    // Middleware gates the whole /yonetim subtree, not just the index.
    await page.goto("/yonetim/talepler");
    await expect(page).toHaveURL(/\/giris$/);
  });

  test("business_owner cannot reach the admin panel", async ({ page }) => {
    test.skip(
      !process.env.E2E_BIZOWNER_USER || !process.env.E2E_BIZOWNER_PASS,
      "needs the business-owner probe (E2E_BIZOWNER_USER)",
    );
    await login(page, process.env.E2E_BIZOWNER_USER!, process.env.E2E_BIZOWNER_PASS!);
    await page.goto("/yonetim");
    // Layout gate: user_type !== "admin" → redirect home.
    await expect(page).toHaveURL(/localhost:3000\/$/);
  });

  test("logged-in regular user deep-linking a sub-route is sent home", async ({ page }) => {
    // Low-rep seed user (a plain consumer); avoids the trusted account that
    // spec 02's global signOut would revoke mid-run.
    const user = process.env.E2E_LOWREP_USER ?? process.env.E2E_USER;
    const pass = process.env.E2E_LOWREP_PASS ?? process.env.E2E_PASS;
    test.skip(!user || !pass, "needs a regular seed user (E2E_LOWREP_USER)");
    await login(page, user!, pass!);
    await page.goto("/yonetim/duzenlemeler");
    await expect(page).toHaveURL(/localhost:3000\/$/);
  });
});
