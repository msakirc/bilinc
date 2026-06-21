import { test, expect, type Page } from "@playwright/test";
import { expectNoLeaks, expectNoRawIonicons } from "./content";

// THE test that tonight's bugs slipped past: the rest of the suite asserts URLs,
// roles and testids — never the rendered *text*. So a card badge reading
// "entityType.undefined" and category tiles reading "restaurant"/"heart" shipped
// green. This sweep reads what a user reads and fails on any binding/i18n leak.

async function settle(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(800);
}

async function firstHref(page: Page, prefix: string): Promise<string | null> {
  const loc = page.locator(`a[href^="${prefix}"]`).first();
  if (!(await loc.count())) return null;
  return loc.getAttribute("href");
}

test.describe("content integrity (no binding / i18n leaks)", () => {
  test("home renders no leaks and no raw Ionicon names", async ({ page }) => {
    await page.goto("/");
    await settle(page);
    await expectNoLeaks(page, "home");
    await expectNoRawIonicons(page, "home");
  });

  test("search results render no leaks", async ({ page }) => {
    await page.goto("/ara?q=ihlas");
    await settle(page);
    await expectNoLeaks(page, "search");
  });

  test("category browse renders no leaks", async ({ page }) => {
    await page.goto("/");
    await settle(page);
    const href = await firstHref(page, "/kategori/");
    test.skip(!href, "no category tile on home");
    await page.goto(href!);
    await settle(page);
    await expectNoLeaks(page, `category ${href}`);
  });

  test("business detail renders no leaks", async ({ page }) => {
    await page.goto("/ara?q=ihlas");
    await settle(page);
    const href = await firstHref(page, "/isletme/");
    test.skip(!href, "no listing found on staging");
    await page.goto(href!);
    await settle(page);
    await expectNoLeaks(page, `business ${href}`);
  });

  test("login page renders no leaks", async ({ page }) => {
    await page.goto("/giris");
    await settle(page);
    await expectNoLeaks(page, "login");
  });

  test("register page renders no leaks", async ({ page }) => {
    await page.goto("/kayit");
    await settle(page);
    await expectNoLeaks(page, "register");
  });

  const LEGAL_ROUTES = ["/yasal/kosullar", "/yasal/gizlilik", "/yasal/kvkk"];
  for (const href of LEGAL_ROUTES) {
    test(`legal doc ${href} renders prose and no leaks`, async ({ page }) => {
      await page.goto(href);
      await settle(page);
      await expectNoLeaks(page, `legal ${href}`);
      // A legal doc must actually have prose, not just a shell.
      const len = (await page.locator("body").first().innerText()).length;
      expect(len, `legal ${href} looks empty`).toBeGreaterThan(200);
    });
  }

  test("404 page renders no leaks", async ({ page }) => {
    await page.goto("/this-route-does-not-exist-xyz");
    await settle(page);
    await expectNoLeaks(page, "404");
  });
});
