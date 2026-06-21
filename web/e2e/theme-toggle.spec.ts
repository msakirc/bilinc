import { test, expect } from "@playwright/test";

// Web-only (mobile theme is native). ThemeToggle flips the `dark` class on
// <html> and persists to localStorage. Pin colorScheme so the default is light.
test.use({ colorScheme: "light" });

test("toggles dark mode on <html>", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).not.toHaveClass(/dark/);

  // ThemeToggle is now an inline button in the header (the overflow menu was
  // removed). In light mode its title is the action it performs: "Koyu tema".
  await page.getByRole("banner").getByRole("button", { name: "Koyu tema" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
});
