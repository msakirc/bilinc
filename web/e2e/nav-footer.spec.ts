import { test, expect } from "@playwright/test";

// Header + footer chrome. Notably guards the bug where every footer link pointed
// at "/" instead of the legal pages, so the KVKK/privacy/terms docs were
// unreachable from the UI.

test.describe("navbar", () => {
  test("logged-out header shows discover/facts nav and auth links", async ({ page }) => {
    await page.goto("/");
    const header = page.getByRole("banner");
    await expect(header.getByRole("link", { name: "Keşfet", exact: true })).toBeVisible();
    await expect(header.getByRole("link", { name: "Gerçekler", exact: true })).toBeVisible();
    await expect(header.getByRole("link", { name: "Giriş", exact: true })).toBeVisible();
    await expect(header.getByRole("link", { name: "Kayıt Ol" })).toBeVisible();
  });

  test('"Gerçekler" navigates to the search/facts surface', async ({ page }) => {
    await page.goto("/");
    await page.getByRole("banner").getByRole("link", { name: "Gerçekler", exact: true }).click();
    await expect(page).toHaveURL(/\/ara$/);
  });

  test('"Giriş" navigates to login', async ({ page }) => {
    await page.goto("/");
    await page.getByRole("banner").getByRole("link", { name: "Giriş", exact: true }).click();
    await expect(page).toHaveURL(/\/giris$/);
  });
});

test.describe("footer legal links resolve to the legal docs", () => {
  const cases = [
    { href: "/yasal/gizlilik", title: "Gizlilik" },
    { href: "/yasal/kosullar", title: "Kullanım Koşulları" },
    { href: "/yasal/kvkk", title: "KVKK" },
  ];

  test("footer links point at /yasal, not /", async ({ page }) => {
    await page.goto("/");
    const legal = page.locator('footer a[href^="/yasal/"]');
    expect(await legal.count()).toBeGreaterThanOrEqual(3);
  });

  for (const { href, title } of cases) {
    test(`footer reaches ${href}`, async ({ page }) => {
      await page.goto("/");
      const link = page.locator(`footer a[href="${href}"]`).first();
      await expect(link).toBeVisible();
      await link.click();
      await expect(page).toHaveURL(new RegExp(href.replace(/\//g, "\\/")));
      await expect(page.locator("h1").first()).toContainText(title);
    });
  }
});
