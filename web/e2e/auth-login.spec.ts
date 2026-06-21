import { test, expect } from "@playwright/test";
import { TR } from "./selectors";

// Mirrors mobile .maestro/02-auth-login-logout.yaml.
// Needs a seeded Supabase user + a live (not paused) Supabase project.
// Gate: export E2E_USER / E2E_PASS before running, else the test is skipped.

const USER = process.env.E2E_USER;
const PASS = process.env.E2E_PASS;

test.describe("login / logout", () => {
  test.skip(!USER || !PASS, "set E2E_USER and E2E_PASS (seeded Supabase user)");

  test("logs in, lands on home, signs out", async ({ page }) => {
    await page.goto("/giris");

    await page.getByPlaceholder(TR.usernamePlaceholder).fill(USER!);
    await page.getByPlaceholder(TR.loginPasswordPlaceholder).fill(PASS!);
    await page.getByRole("button", { name: TR.loginSubmit }).click();

    // signIn() -> router.push("/")
    await expect(page).toHaveURL("/");
    // navbar renders username once auth store hydrates = logged in
    await expect(page.getByText(USER!, { exact: false })).toBeVisible();

    // open the user dropdown (button labelled with the username), then sign out
    await page.getByRole("button", { name: new RegExp(USER!, "i") }).click();
    await page.getByRole("button", { name: TR.navLogout }).click();

    // logged-out navbar shows the login link again
    await expect(page.getByRole("banner").getByRole("link", { name: TR.navLogin })).toBeVisible();
  });
});
