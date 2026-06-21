import { test, expect } from "@playwright/test";
import { TR } from "./selectors";

// Extends mobile .maestro/06-search-sort.yaml — the web search page has entity
// filter pills. Toggling one sets its active styling (client-side); independent
// of whether staging returns results.

test("entity-type filter pill toggles active state", async ({ page }) => {
  await page.goto("/ara?q=test");
  const brand = page.getByRole("button", { name: TR.entityBrand });
  await expect(brand).not.toHaveClass(/bg-bilinc-primary/);
  await brand.click();
  await expect(brand).toHaveClass(/bg-bilinc-primary/);
});

// min-rating filter removed (dead filter) — see ara/page.tsx
