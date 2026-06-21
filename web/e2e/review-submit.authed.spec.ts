import { test, expect } from "@playwright/test";
import { TR } from "./selectors";
import { discoverListingId } from "./helpers";

// Mirrors mobile .maestro/04-review-submit.yaml. Authed project (storageState).
// Writes a real review row, so gated behind E2E_ALLOW_WRITE to keep default/CI
// runs side-effect free.

test.describe("review submit", () => {
  test.skip(
    process.env.E2E_ALLOW_WRITE !== "1" ||
      (!process.env.E2E_LOWREP_USER && !process.env.E2E_USER),
    "real DB write — set E2E_ALLOW_WRITE=1 (+ authed session) against staging",
  );

  test("submits a review and returns to the business page", async ({ page }) => {
    const id = await discoverListingId(page);
    await page.goto(`/isletme/${id}/yorum-yaz`);
    await expect(page.getByRole("heading", { name: "Değerlendirme Yaz" })).toBeVisible();

    // rating stars are the first 5 type=button controls in the form; click 5th
    await page.locator('form button[type="button"]').nth(4).click();
    await page
      .getByPlaceholder(TR.reviewContentPlaceholder)
      .fill("Otomatik E2E testi tarafindan yazilan degerlendirme.");
    await page.getByRole("button", { name: TR.reviewSubmit }).click();

    await expect(page).toHaveURL(new RegExp(`/isletme/${id}$`));
  });
});
