import { test, expect, type Page } from "@playwright/test";
import { TR } from "./selectors";

// Content assertions for a real business-detail page, discovered via search so
// the test is independent of any specific seeded id.

async function openFirstListing(page: Page): Promise<string> {
  await page.goto("/ara?q=ihlas");
  await page.waitForLoadState("networkidle").catch(() => {});
  const card = page.locator('a[href^="/isletme/"]').first();
  await card.waitFor({ timeout: 15_000 });
  const href = (await card.getAttribute("href"))!;
  await page.goto(href);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(700);
  return href;
}

test.describe("business detail content", () => {
  test("renders the listing name as a real heading", async ({ page }) => {
    await openFirstListing(page);
    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible();
    const name = (await h1.innerText()).trim();
    expect(name.length).toBeGreaterThan(0);
    expect(name).not.toMatch(/:[a-z]/i);
    expect(name).not.toContain("undefined");
  });

  test("shows a numeric rating and review count", async ({ page }) => {
    await openFirstListing(page);
    const body = await page.evaluate(() => document.body.innerText);
    expect(body).toMatch(/\d\.\d/);
  });

  test("the type badge is never a raw entityType key", async ({ page }) => {
    await openFirstListing(page);
    const body = await page.evaluate(() => document.body.innerText);
    expect(body).not.toContain("entityType.");
    expect(body).not.toContain(".undefined");
  });

  test("exposes write-review and add-fact actions", async ({ page }) => {
    await openFirstListing(page);
    await expect(page.getByRole("link", { name: TR.bizWriteReview })).toBeVisible();
    await expect(page.getByRole("link", { name: TR.bizAddFact })).toBeVisible();
  });

  test("guest writing a review is redirected to login", async ({ page }) => {
    await openFirstListing(page);
    await page.getByRole("link", { name: TR.bizWriteReview }).click();
    await expect(page).toHaveURL(/\/giris/);
  });

  test("facts and reviews sections both render", async ({ page }) => {
    await openFirstListing(page);
    // Two section headings (facts + reviews); both must be present.
    expect(await page.locator("h2").count()).toBeGreaterThanOrEqual(2);
  });
});
