import { expect, type Page } from "@playwright/test";
import { TR } from "./selectors";

/** UI login -> lands on home. Used by auth.setup and the rep-gate flow. */
export async function login(page: Page, username: string, password: string) {
  await page.goto("/giris");
  await page.getByPlaceholder(TR.usernamePlaceholder).fill(username);
  await page.getByPlaceholder(TR.loginPasswordPlaceholder).fill(password);
  await page.getByRole("button", { name: TR.loginSubmit }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByText(username, { exact: false })).toBeVisible();
}

// Any UUID — the review/fact pages render based on auth state, not on the
// listing existing, so a placeholder is enough for redirect / rep-gate checks.
export const PLACEHOLDER_ID = "00000000-0000-0000-0000-000000000000";

/** Find a real listing id from the catalog via search. */
export async function discoverListingId(page: Page): Promise<string> {
  await page.goto("/ara?q=Test");
  const card = page.locator('a[href^="/isletme/"]').first();
  await card.waitFor({ timeout: 15_000 });
  const href = await card.getAttribute("href");
  const id = href?.split("/").pop();
  if (!id) throw new Error("no listing found on staging for write flow");
  return id;
}
