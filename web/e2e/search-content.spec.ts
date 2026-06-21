import { test, expect, type Page } from "@playwright/test";

// Content assertions for /ara — filters, pagination, results, empty state.
// Pre-existing search specs check navigation; these check the rendered results
// and that filter controls exist with their real Turkish labels.

async function search(page: Page, q: string) {
  await page.goto(`/ara?q=${encodeURIComponent(q)}`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(900);
}

test.describe("search content", () => {
  test("a common query returns listing cards", async ({ page }) => {
    await search(page, "ihlas");
    const cards = page.locator('a[href^="/isletme/"]');
    expect(await cards.count()).toBeGreaterThan(0);
  });

  test("type filter pills render with real labels", async ({ page }) => {
    await search(page, "ihlas");
    for (const label of ["Tümü", "İşletme", "Ürün", "Marka"]) {
      await expect(page.getByRole("button", { name: label, exact: true }).first()).toBeVisible();
    }
  });

  // min-rating filter removed (dead filter) — see ara/page.tsx

  test("city filter offers the all-cities option", async ({ page }) => {
    await search(page, "ihlas");
    await expect(page.getByRole("option", { name: "Tüm Şehirler" })).toBeAttached();
  });

  test("applying the İşletme type filter keeps results listing-typed", async ({ page }) => {
    await search(page, "ihlas");
    await page.getByRole("button", { name: "İşletme", exact: true }).first().click();
    await page.waitForTimeout(900);
    // Still shows results, and no card badge regressed to a raw key.
    expect(await page.locator('a[href^="/isletme/"]').count()).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.body.innerText)).not.toContain("entityType.");
  });

  test("a nonsense query shows no result cards", async ({ page }) => {
    await search(page, "zzzqxwvkjhgfdsa12345");
    expect(await page.locator('a[href^="/isletme/"]').count()).toBe(0);
  });

  test("pagination control appears for a large result set", async ({ page }) => {
    await search(page, "ihlas");
    await expect(page.getByText("Sonraki", { exact: false })).toBeVisible();
  });
});
