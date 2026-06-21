import { test, expect } from "@playwright/test";
import { TR } from "./selectors";

// Cross-links between the login and register forms (pure client routing).

test("register form links to login", async ({ page }) => {
  await page.goto("/kayit");
  // "Giriş Yap" only appears in the form here (navbar uses "Giriş")
  await page.getByRole("link", { name: TR.loginSubmit }).click();
  await expect(page).toHaveURL(/\/giris$/);
});

test("login form links to register", async ({ page }) => {
  await page.goto("/giris");
  // "Kayıt Ol" appears in navbar + form; either navigates to /kayit
  await page.getByRole("link", { name: TR.navRegister }).first().click();
  await expect(page).toHaveURL(/\/kayit$/);
});
