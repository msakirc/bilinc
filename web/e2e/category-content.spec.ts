import { test, expect, type Page } from "@playwright/test";
import { expectNoLeaks } from "./content";

// Visit every top-level category from the home grid and assert each page
// resolves a real title and renders either listings or a proper empty state —
// never a raw i18n key or a crash.

async function topCategoryHrefs(page: Page): Promise<string[]> {
  await page.goto("/");
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(800);
  const hrefs = await page
    .locator('a[href^="/kategori/"]')
    .evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).getAttribute("href")!));
  return [...new Set(hrefs)];
}

test.describe("category browse content", () => {
  test("home exposes multiple top-level categories", async ({ page }) => {
    const hrefs = await topCategoryHrefs(page);
    expect(hrefs.length).toBeGreaterThanOrEqual(5);
  });

  test("each top-level category page resolves a real title + no leaks", async ({ page }) => {
    const hrefs = await topCategoryHrefs(page);
    test.skip(hrefs.length === 0, "no categories on home");
    for (const href of hrefs.slice(0, 11)) {
      await page.goto(href);
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(500);
      const h1 = (await page.locator("h1").first().innerText()).trim();
      expect(h1.length, `${href} title empty`).toBeGreaterThan(0);
      expect(h1, `${href} title is a raw key`).not.toMatch(/:[a-z]/i);
      await expectNoLeaks(page, `category ${href}`);
    }
  });

  test("an unknown category slug shows the not-found empty state, not a crash", async ({ page }) => {
    await page.goto("/kategori/this-slug-does-not-exist-zzz");
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(500);
    await expectNoLeaks(page, "category not-found");
    // No listing cards for a bogus category.
    expect(await page.locator('a[href^="/isletme/"]').count()).toBe(0);
  });
});
