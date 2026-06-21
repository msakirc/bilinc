import { test, expect } from "@playwright/test";

// Same role gates, but for a LOGGED-IN user with the wrong role. The authed
// session is a regular user (not business_owner / admin), so the panels must
// still reject it — proving the gate checks the role, not merely "logged in".

test.describe("role gates (authed, wrong role)", () => {
  test.skip(
    !process.env.E2E_LOWREP_USER && !process.env.E2E_USER,
    "needs the authed session",
  );

  test("regular user cannot reach business panel", async ({ page }) => {
    await page.goto("/panel");
    await expect(page).toHaveURL(/\/giris$/);
  });

  test("regular user cannot reach admin panel", async ({ page }) => {
    await page.goto("/yonetim");
    await expect(page).toHaveURL(/localhost:3000\/$/);
  });
});
