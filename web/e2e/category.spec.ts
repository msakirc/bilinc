import { test, expect } from "@playwright/test";
import { TR } from "./selectors";

// Category page /kategori/[slug]. Not-found branch is data-free. Happy path
// discovers a real slug from the home page's category grid (skips if staging
// has no categories seeded).

test.describe("category", () => {
  test("unknown slug shows not-found state", async ({ page }) => {
    test.skip(!process.env.E2E_USER, "needs staging reachable");
    await page.goto("/kategori/yok-boyle-kategori-99999");
    await expect(page.getByText(TR.categoryNotFound)).toBeVisible();
  });

  test("renders a real top-level category", async ({ page }) => {
    // food-drink is a stable seeded top-level slug (same set mobile deep-links).
    await page.goto("/kategori/food-drink");
    await expect(page.getByRole("heading", { name: "Yiyecek & İçecek" })).toBeVisible();
    await expect(page.getByText(TR.categoryNotFound)).toHaveCount(0);
  });
});
