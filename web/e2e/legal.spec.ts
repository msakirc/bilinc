import { test, expect } from "@playwright/test";

// /yasal/[doc] renders static legal text (no DB). Valid slug -> title heading;
// unknown slug -> "Belge bulunamadı" empty state.
const DOCS = [
  { slug: "kosullar", title: "Kullanım Koşulları" },
  { slug: "gizlilik", title: "Gizlilik Politikası" },
  { slug: "kvkk", title: "KVKK Aydınlatma Metni" },
];

for (const { slug, title } of DOCS) {
  test(`legal doc /yasal/${slug} renders its title`, async ({ page }) => {
    await page.goto(`/yasal/${slug}`);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  });
}

test("unknown legal doc shows not-found state", async ({ page }) => {
  await page.goto("/yasal/yok-boyle-belge");
  await expect(page.getByText("Belge bulunamadı")).toBeVisible();
});
