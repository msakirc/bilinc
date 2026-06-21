import { test, expect } from "@playwright/test";
import { TR } from "./selectors";

// Mirrors mobile .maestro/06-search-sort.yaml + 13-search-no-results.yaml.
// The empty-prompt + URL-sync assertions are client-side (router.replace), so
// they pass with or without live Supabase data. Result-list assertions need a
// live project with seeded listings, gated behind E2E_LIVE_DATA.

test.describe("search", () => {
  test("shows prompt empty-state before any query", async ({ page }) => {
    await page.goto("/ara");
    await expect(page.getByText(TR.searchPromptTitle)).toBeVisible();
  });

  test("typing a query syncs the ?q= URL param (300ms debounce)", async ({ page }) => {
    await page.goto("/ara");
    await page.getByPlaceholder(TR.searchPlaceholder).fill("kahve");
    // SearchBar debounces 300ms then calls onSearch -> router.replace
    await expect(page).toHaveURL(/\/ara\?q=kahve/);
  });

  test("reads ?q= from the URL on load", async ({ page }) => {
    await page.goto("/ara?q=market");
    await expect(page.getByPlaceholder(TR.searchPlaceholder)).toHaveValue("market");
  });

  test("returns listing results for a known query", async ({ page }) => {
    // Catalog now comes from the DynamoDB/Lambda layer (via /api/catalog/*), so
    // search returns real results — same backend mobile uses.
    await page.goto("/ara");
    await page.getByPlaceholder(TR.searchPlaceholder).fill("Test");
    // at least one ListingCard links to /isletme/<id>
    await expect(page.locator('a[href^="/isletme/"]').first()).toBeVisible({ timeout: 15_000 });
  });
});
