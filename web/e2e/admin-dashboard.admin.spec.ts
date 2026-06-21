import { test, expect } from "@playwright/test";
import { ADMIN } from "./selectors";

// Dashboard renders the 9 stat cards (RPC get_admin_stats) and each card
// deep-links to its section.

const STAT_KEYS = [
  "total_users",
  "active_users_30d",
  "total_listings",
  "pending_listings",
  "total_reviews",
  "reviews_today",
  "total_facts",
  "pending_claims",
  "pending_edits",
] as const;

test.describe("admin dashboard", () => {
  test.skip(!process.env.E2E_ADMIN_USER, "needs admin session (E2E_ADMIN_USER)");

  test("renders 9 stat cards with numeric values", async ({ page }) => {
    await page.goto("/yonetim");
    await expect(page.getByTestId("admin-stats-grid")).toBeVisible();
    for (const key of STAT_KEYS) {
      const value = page.getByTestId(`admin-stat-value-${key}`);
      await expect(value).toBeVisible();
      // RPC returns a count; rendered as a plain integer (0 when empty).
      await expect(value).toHaveText(/^\d+$/);
    }
  });

  test("a stat card deep-links to its section", async ({ page }) => {
    await page.goto("/yonetim");
    await page.getByTestId("admin-stat-total_users").click();
    await expect(page).toHaveURL(/\/yonetim\/kullanicilar$/);
    await expect(
      page.getByRole("heading", { name: ADMIN.usersTitle }),
    ).toBeVisible();
  });
});
