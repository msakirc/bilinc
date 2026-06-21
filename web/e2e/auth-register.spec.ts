import { test, expect } from "@playwright/test";
import { TR } from "./selectors";

// Mirrors mobile .maestro/14-register-consent-gate.yaml + 01-auth-register.yaml.
// The validation-gate tests run client-side only — NO Supabase write, safe to
// run anywhere (even against the paused prod project). The happy-path signup
// IS a real DB write, so it is gated behind E2E_ALLOW_SIGNUP.

const PW = "test1234";

// helper: fill the register form to a valid-but-unsubmitted state
async function fillBase(page: import("@playwright/test").Page, username: string) {
  await page.goto("/kayit");
  await page.getByPlaceholder(TR.usernamePlaceholder).fill(username);
  await page.getByPlaceholder(TR.registerPasswordPlaceholder).fill(PW);
  await page.getByPlaceholder(TR.registerConfirmPlaceholder).fill(PW);
}

test.describe("register validation gates", () => {
  test("rejects mismatched passwords", async ({ page }) => {
    await page.goto("/kayit");
    await page.getByPlaceholder(TR.usernamePlaceholder).fill("e2euser");
    await page.getByPlaceholder(TR.registerPasswordPlaceholder).fill(PW);
    await page.getByPlaceholder(TR.registerConfirmPlaceholder).fill("different9");
    await page.getByRole("button", { name: TR.navRegister }).click();

    await expect(page.getByText("Şifreler eşleşmiyor")).toBeVisible();
    await expect(page).toHaveURL(/\/kayit$/); // no redirect = no signup
  });

  test("requires both terms and KVKK consent", async ({ page }) => {
    await fillBase(page, "e2euser");

    // both unchecked -> terms gate first
    await page.getByRole("button", { name: TR.navRegister }).click();
    await expect(
      page.getByText("Devam etmek için Kullanım Koşullarını", { exact: false }),
    ).toBeVisible();

    // accept terms only -> KVKK gate
    await page.getByRole("checkbox").first().check();
    await page.getByRole("button", { name: TR.navRegister }).click();
    await expect(
      page.getByText("yurt dışına veri aktarımına", { exact: false }),
    ).toBeVisible();

    await expect(page).toHaveURL(/\/kayit$/); // still no signup
  });

  test("rejects username shorter than 3 chars", async ({ page }) => {
    await fillBase(page, "ab");
    await page.getByRole("checkbox").nth(0).check();
    await page.getByRole("checkbox").nth(1).check();
    await page.getByRole("button", { name: TR.navRegister }).click();
    await expect(page.getByText("Kullanıcı adı en az 3 karakter olmalı")).toBeVisible();
    await expect(page).toHaveURL(/\/kayit$/);
  });

  test("rejects password shorter than 6 chars", async ({ page }) => {
    await page.goto("/kayit");
    await page.getByPlaceholder(TR.usernamePlaceholder).fill("e2euser");
    await page.getByPlaceholder(TR.registerPasswordPlaceholder).fill("123");
    await page.getByPlaceholder(TR.registerConfirmPlaceholder).fill("123");
    await page.getByRole("button", { name: TR.navRegister }).click();
    await expect(page.getByText("Şifre en az 6 karakter olmalı")).toBeVisible();
    await expect(page).toHaveURL(/\/kayit$/);
  });
});

test.describe("register duplicate username", () => {
  // Mirrors mobile 23-register-username-taken. Re-registering an existing
  // username must be rejected. signUp fails (or the users insert hits the PK),
  // so no new row is created — safe to run with just a known username.
  test.skip(!process.env.E2E_USER, "needs an existing username on staging (E2E_USER)");

  test("rejects an already-taken username", async ({ page }) => {
    await fillBase(page, process.env.E2E_USER!);
    await page.getByRole("checkbox").nth(0).check();
    await page.getByRole("checkbox").nth(1).check();
    await page.getByRole("button", { name: TR.navRegister }).click();
    // error surfaces and we do NOT land on home
    await expect(page.locator("p.text-bilinc-disputed")).toBeVisible();
    await expect(page).toHaveURL(/\/kayit$/);
  });
});

test.describe("register happy path", () => {
  test.skip(
    process.env.E2E_ALLOW_SIGNUP !== "1",
    "real Supabase write — set E2E_ALLOW_SIGNUP=1 against a disposable project",
  );

  test("creates account and lands on home", async ({ page }) => {
    // unique username per run; index-based suffix avoids Date.now/Math.random
    const username = `e2e_${test.info().workerIndex}_${process.env.E2E_RUN_ID ?? "local"}`;
    await fillBase(page, username);
    await page.getByRole("checkbox").nth(0).check();
    await page.getByRole("checkbox").nth(1).check();
    await page.getByRole("button", { name: TR.navRegister }).click();

    await expect(page).toHaveURL("/");
    await expect(page.getByText(username, { exact: false })).toBeVisible();
  });
});
