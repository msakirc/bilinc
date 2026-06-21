import { test, expect } from "@playwright/test";
import { TR } from "./selectors";

// Mirrors mobile .maestro/00-smoke-guest.yaml — app loads for a guest and the
// primary navigation works.

test.describe("smoke (guest)", () => {
  test("home renders with navbar and auth links", async ({ page }) => {
    await page.goto("/");
    const header = page.getByRole("banner");
    await expect(header.getByRole("link", { name: "Bilinç" })).toBeVisible();
    // logged-out navbar offers login + register
    await expect(header.getByRole("link", { name: TR.navLogin })).toBeVisible();
    await expect(header.getByRole("link", { name: TR.navRegister })).toBeVisible();
  });

  test("navigates home -> search via navbar", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("banner").getByRole("link", { name: "Gerçekler", exact: true }).click();
    await expect(page).toHaveURL(/\/ara$/);
    await expect(page.getByPlaceholder(TR.searchPlaceholder)).toBeVisible();
  });
});
