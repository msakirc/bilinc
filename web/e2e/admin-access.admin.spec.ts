import { test, expect } from "@playwright/test";
import { ADMIN } from "./selectors";

// Admin can reach /yonetim (the positive case — role-gates.*.spec.ts cover the
// negative guest/regular-user redirects) and every sidebar section loads.
// Runs under the `admin` project with the admin storageState; skips with no creds.

test.describe("admin access + navigation", () => {
  test.skip(!process.env.E2E_ADMIN_USER, "needs admin session (E2E_ADMIN_USER)");

  test("admin lands on the panel, not redirected", async ({ page }) => {
    await page.goto("/yonetim");
    await expect(page).toHaveURL(/\/yonetim$/);
    await expect(
      page.getByRole("heading", { name: ADMIN.dashboardTitle }),
    ).toBeVisible();
  });

  test("sidebar links navigate to every section", async ({ page }) => {
    await page.goto("/yonetim");
    for (const section of ADMIN.sections) {
      // Sidebar markup renders twice (mobile + desktop) → same testid twice;
      // only the desktop copy is visible at the default lg viewport.
      await page.locator(`[data-testid="${section.testid}"]:visible`).click();
      await expect(page).toHaveURL(new RegExp(section.url.replace(/\//g, "\\/") + "$"));
      await expect(
        page.getByRole("heading", { name: section.title }),
      ).toBeVisible();
    }
  });
});
