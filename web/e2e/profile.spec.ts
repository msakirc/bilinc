import { test, expect } from "@playwright/test";
import { TR } from "./selectors";

// Public profile page /profil/[username]. No web-equivalent Maestro flow
// (mobile profile is the authed tab); this covers the public web route.

test.describe("public profile", () => {
  test("renders an existing user's profile", async ({ page }) => {
    const username = process.env.E2E_USER;
    test.skip(!username, "needs a seed username on staging (E2E_USER)");
    await page.goto(`/profil/${username}`);
    // username shows either as the h1 (no display_name) or as @username
    await expect(page.getByText(username!, { exact: false }).first()).toBeVisible();
  });

  test("unknown username shows not-found state", async ({ page }) => {
    test.skip(!process.env.E2E_USER, "needs staging reachable");
    await page.goto("/profil/yok_boyle_kullanici_99999");
    await expect(page.getByText(TR.profileNotFound)).toBeVisible();
  });
});
