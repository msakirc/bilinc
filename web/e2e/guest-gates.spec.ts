import { test, expect } from "@playwright/test";

// Mirrors mobile .maestro/03-guest-vote-gate.yaml + 08-review-guest-gate.yaml.
// Auth-only pages redirect a guest to /giris via `router.replace("/giris")`
// once the auth store initialises (no session -> redirect). No DB rows needed;
// any listing id works because the redirect fires before the listing loads.

const GUARDED = [
  { name: "activity", path: "/aktivite" },
  { name: "write review", path: "/isletme/00000000-0000-0000-0000-000000000000/yorum-yaz" },
  { name: "report fact", path: "/isletme/00000000-0000-0000-0000-000000000000/bilgi-ekle" },
];

for (const { name, path } of GUARDED) {
  test(`guest visiting ${name} is redirected to login`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/giris$/);
  });
}
