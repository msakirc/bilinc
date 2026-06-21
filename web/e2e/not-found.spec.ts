import { test, expect } from "@playwright/test";

// Unknown route returns a 404 (Next not-found). Pure routing assertion.
test("unknown route returns 404", async ({ page }) => {
  const resp = await page.goto("/bu-sayfa-yok-12345");
  expect(resp?.status()).toBe(404);
});
