import { test, expect, type Page } from "@playwright/test";
import { IONICON_NAMES } from "./content";

// Content assertions for the home page — the rails a user actually sees. The
// pre-existing smoke/role tests only checked the page loaded; these check it
// renders real catalog content (the gap that hid the broken cards/tiles).

async function settle(page: Page) {
  await page.goto("/");
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(800);
}

test.describe("home content", () => {
  test("hero shows a real (non-key) title and the search box", async ({ page }) => {
    await settle(page);
    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible();
    const title = (await h1.innerText()).trim();
    expect(title.length).toBeGreaterThan(3);
    expect(title).not.toMatch(/:[a-z]/i); // not an i18n key like "home:hero.title"
    // Scope to <main>: the navbar (header/banner) now also has an inline search
    // whose placeholder matches /ara/i, so an un-scoped query hits 2 elements.
    await expect(page.getByRole("main").getByPlaceholder(/ara/i)).toBeVisible();
  });

  test("category tiles link to /kategori and each renders an inline icon", async ({ page }) => {
    await settle(page);
    const tiles = page.locator('a[href^="/kategori/"]');
    const n = await tiles.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      // Inline line-icon present (replaces the old emoji-glyph assertion).
      await expect(tiles.nth(i).locator("svg[data-icon]").first()).toBeAttached();
      // Tile shows a non-empty label and NOT a raw @expo/vector-icons name.
      const txt = (await tiles.nth(i).innerText()).trim();
      expect(txt.length).toBeGreaterThan(0);
      for (const name of IONICON_NAMES) {
        expect(new RegExp(`(^|\\n)${name.replace(/-/g, "\\-")}(\\n|$)`).test(txt),
          `tile ${i} shows raw Ionicon name "${name}"`).toBe(false);
      }
    }
  });

  test("renders the verified/disputed fact band headings", async ({ page }) => {
    await settle(page);
    await expect(page.getByRole("heading", { name: /Doğrulanmış Gerçekler/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Tartışmalı İddialar/ })).toBeVisible();
  });

  test("business rails render cards that link to detail pages", async ({ page }) => {
    await settle(page);
    const cards = page.locator('a[href^="/isletme/"]');
    const n = await cards.count();
    expect(n).toBeGreaterThan(0);
    // At least one /isletme/ link is a ListingCard carrying a numeric rating
    // ("0.0"). (Tağşiş-warning links also point at /isletme/ but show no rating.)
    const texts = await cards.allInnerTexts();
    expect(texts.some((tx) => /\d\.\d/.test(tx)), "no card showed a numeric rating").toBe(true);
  });

  test("no card badge shows a raw entityType key", async ({ page }) => {
    await settle(page);
    const body = await page.evaluate(() => document.body.innerText);
    expect(body).not.toContain("entityType.");
    expect(body).not.toContain(".undefined");
  });
});
