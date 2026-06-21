import { test, expect, type Page } from "@playwright/test";

// The language menu lives in the header: a "Dil"/"Language" button (its aria-label
// flips with the active language) opens a menu with the Türkçe/İngilizce
// (Turkish/English) options. Assertions still prove a REAL tr<->en content swap:
// the header login link reads "Giriş" ONLY in Turkish, so its disappearance is
// evidence the whole UI re-rendered in English (not just a label). Default (no
// cookie) is Turkish (FALLBACK_LOCALE) and Playwright runs locale tr-TR.

async function openLang(page: Page) {
  await page.getByRole("banner").getByRole("button", { name: /^(Dil|Language)$/ }).click();
}
function langOption(page: Page, re: RegExp) {
  // A pick-list item inside the open menu; labels are localized.
  return page.getByRole("menu").getByRole("menuitem", { name: re });
}
function turkishLogin(page: Page) {
  // Login link exists in both header and footer — scope to the banner. Its
  // Turkish text "Giriş" is present only while the UI is in Turkish.
  return page.getByRole("banner").getByRole("link", { name: "Giriş", exact: true });
}

test.describe("language menu", () => {
  test("swaps the navbar strings from Turkish to English and back", async ({ page }) => {
    await page.goto("/");
    await expect(turkishLogin(page)).toBeVisible();

    // Switch to English — in the Turkish UI the English option reads "İngilizce".
    await openLang(page);
    await langOption(page, /^(İngilizce|English)$/).click();
    await expect(turkishLogin(page)).toHaveCount(0);

    // Switch back to Turkish — in the English UI the Turkish option reads "Turkish".
    await openLang(page);
    await langOption(page, /^(Türkçe|Turkish)$/).click();
    await expect(turkishLogin(page)).toBeVisible();
  });

  test("persists the chosen language across a reload", async ({ page }) => {
    await page.goto("/");
    await expect(turkishLogin(page)).toBeVisible();

    await openLang(page);
    await langOption(page, /^(İngilizce|English)$/).click();
    await expect(turkishLogin(page)).toHaveCount(0);

    await page.reload();
    // Choice persisted across reload: still English (Turkish login still gone).
    await expect(turkishLogin(page)).toHaveCount(0);
  });
});
