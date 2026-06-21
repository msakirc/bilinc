import { test, expect } from "@playwright/test";
import { TR } from "./selectors";

// Mirrors mobile .maestro/11-activity-filter.yaml. Authed project (storageState).

test.describe("activity tab filter", () => {
  test.skip(
    !process.env.E2E_LOWREP_USER && !process.env.E2E_USER,
    "needs the authed session (set E2E_LOWREP_USER or E2E_USER)",
  );

  test("switches between reviews and facts tabs", async ({ page }) => {
    await page.goto("/aktivite");
    // page gates content behind two staging queries (reviews + facts); allow for
    // cold compile + round-trips under parallel load before the heading shows.
    await expect(page.getByRole("heading", { name: "Aktivitelerim" })).toBeVisible({
      timeout: 30_000,
    });

    // reviews tab active by default
    const reviewsTab = page.getByRole("button", { name: TR.activityReviewsTab });
    const factsTab = page.getByRole("button", { name: TR.activityFactsTab });
    await expect(reviewsTab).toHaveClass(/bg-bilinc-primary/);

    // switch to facts — active styling moves, data-independent assertion
    await factsTab.click();
    await expect(factsTab).toHaveClass(/bg-bilinc-primary/);
    await expect(reviewsTab).not.toHaveClass(/bg-bilinc-primary/);
  });
});
