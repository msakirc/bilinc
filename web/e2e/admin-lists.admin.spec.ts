import { test, expect, type Page } from "@playwright/test";
import { ADMIN } from "./selectors";

// Read-only coverage of the four list sections (users / listings / reviews /
// facts): the table (or empty-state) renders, filter tabs re-query without
// crashing, and pagination starts with "previous" disabled. No DB writes.

/** A section's table always renders post-load (the empty-state is a row inside
 *  it), so asserting the table is visible covers both the populated and empty
 *  cases. `empty` is kept in the signature for call-site readability. */
async function expectTableOrEmpty(page: Page, table: string, _empty: string) {
  await expect(page.getByTestId(table)).toBeVisible();
}

test.describe("admin list sections", () => {
  test.skip(!process.env.E2E_ADMIN_USER, "needs admin session (E2E_ADMIN_USER)");

  const sections = [
    { url: "/yonetim/kullanicilar", title: ADMIN.usersTitle, table: "admin-users-table", empty: "admin-users-empty" },
    { url: "/yonetim/isletmeler", title: ADMIN.listingsTitle, table: "admin-listings-table", empty: "admin-listings-empty" },
    { url: "/yonetim/yorumlar", title: ADMIN.reviewsTitle, table: "admin-reviews-table", empty: "admin-reviews-empty" },
    { url: "/yonetim/bilgiler", title: ADMIN.factsTitle, table: "admin-facts-table", empty: "admin-facts-empty" },
  ];

  for (const s of sections) {
    test(`${s.title}: table or empty-state renders`, async ({ page }) => {
      await page.goto(s.url);
      await expect(page.getByRole("heading", { name: s.title })).toBeVisible();
      await expectTableOrEmpty(page, s.table, s.empty);
    });

    test(`${s.title}: pagination starts with previous disabled`, async ({ page }) => {
      await page.goto(s.url);
      await expect(page.getByTestId("admin-page-prev")).toBeDisabled();
    });
  }

  // Filter tabs exist on listings / reviews / facts (not users).
  const tabbed = [
    { url: "/yonetim/isletmeler", table: "admin-listings-table", empty: "admin-listings-empty", tabs: ["all", "active", "pending", "removed"] },
    { url: "/yonetim/yorumlar", table: "admin-reviews-table", empty: "admin-reviews-empty", tabs: ["all", "flagged", "active", "hidden", "removed"] },
    { url: "/yonetim/bilgiler", table: "admin-facts-table", empty: "admin-facts-empty", tabs: ["all", "flagged", "pending", "verified", "disputed"] },
  ];

  for (const s of tabbed) {
    test(`${s.url}: filter tabs re-query without error`, async ({ page }) => {
      await page.goto(s.url);
      for (const tab of s.tabs) {
        await page.getByTestId(`admin-filter-${tab}`).click();
        // Each switch resets to page 0 and refetches; section stays renderable.
        await expectTableOrEmpty(page, s.table, s.empty);
        await expect(page.getByTestId("admin-page-prev")).toBeDisabled();
      }
    });
  }
});
