import { test, expect } from "@playwright/test";
import { TR } from "./selectors";

// Mirrors mobile .maestro/15-login-validation.yaml + 16-login-wrong-password.yaml.

test.describe("login validation", () => {
  test("empty submit is blocked by required fields (no navigation)", async ({ page }) => {
    await page.goto("/giris");
    await page.getByRole("button", { name: TR.loginSubmit }).click();
    // native `required` stops the submit -> still on /giris, field is invalid
    await expect(page).toHaveURL(/\/giris$/);
    const valid = await page
      .getByPlaceholder(TR.usernamePlaceholder)
      .evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(valid).toBe(false);
  });

  test("wrong password shows an error and stays on login", async ({ page }) => {
    test.skip(!process.env.E2E_USER, "needs staging Supabase reachable (set E2E_USER)");
    await page.goto("/giris");
    await page.getByPlaceholder(TR.usernamePlaceholder).fill(process.env.E2E_USER!);
    await page.getByPlaceholder(TR.loginPasswordPlaceholder).fill("definitely-wrong-pw");
    await page.getByRole("button", { name: TR.loginSubmit }).click();

    // error <p> (text-bilinc-disputed) renders; no redirect to "/"
    await expect(page.locator("p.text-bilinc-disputed")).toBeVisible();
    await expect(page).toHaveURL(/\/giris$/);
  });
});
