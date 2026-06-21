import { test, expect } from "@playwright/test";
import { TR } from "./selectors";
import { PLACEHOLDER_ID, discoverListingId } from "./helpers";

// Business detail /isletme/[id]. The catalog now comes from the DynamoDB/Lambda
// layer (via /api/catalog/*), so a real listing id IS discoverable via search.

test.describe("business detail", () => {
  test("unknown id shows not-found state", async ({ page }) => {
    await page.goto(`/isletme/${PLACEHOLDER_ID}`);
    await expect(page.getByText(TR.businessNotFound)).toBeVisible();
  });

  test("real listing renders hero + action links", async ({ page }) => {
    const id = await discoverListingId(page);
    await page.goto(`/isletme/${id}`);
    await expect(page.getByRole("link", { name: TR.bizWriteReview })).toBeVisible();
    await expect(page.getByRole("link", { name: TR.bizAddFact })).toBeVisible();
  });
});
