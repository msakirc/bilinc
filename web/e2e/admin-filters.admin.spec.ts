import { test, expect } from "@playwright/test";
import { fixtureToken, fixtureUserId, seedListing, seedReview, type SeedCtx } from "./fixtures";

// FILTER CORRECTNESS: admin-lists asserts filter tabs "re-query without error".
// This asserts they actually NARROW results — a seeded row appears under its own
// status tab and is absent under a different one. Write-gated (needs seeded rows).

const WRITE = process.env.E2E_ALLOW_WRITE === "1";
const ACTOR = process.env.E2E_FIXTURE_USER, APASS = process.env.E2E_FIXTURE_PASS;
const CREATOR = process.env.E2E_BIZOWNER_USER, CPASS = process.env.E2E_BIZOWNER_PASS;

let actor: SeedCtx, creator: SeedCtx;

test.describe("admin filter correctness", () => {
  test.skip(!process.env.E2E_ADMIN_USER, "needs admin session (E2E_ADMIN_USER)");
  test.skip(!WRITE, "write flows gated behind E2E_ALLOW_WRITE=1");
  test.skip(!ACTOR || !APASS || !CREATOR || !CPASS, "needs fixture + creator users");

  test.beforeAll(async () => {
    const at = await fixtureToken(ACTOR!, APASS!);
    actor = { token: at, userId: await fixtureUserId(at) };
    const ct = await fixtureToken(CREATOR!, CPASS!);
    creator = { token: ct, userId: await fixtureUserId(ct) };
  });

  test("listings: a removed listing shows under 'removed', not under 'active'", async ({ page }) => {
    const removed = await seedListing(creator, "E2E FilterRemoved", "removed");
    await page.goto("/yonetim/isletmeler");
    const row = page.getByTestId(`admin-listing-row-${removed.id}`);

    await page.getByTestId("admin-filter-removed").click();
    await expect(row, "removed listing should appear under the 'removed' tab").toBeVisible();

    await page.getByTestId("admin-filter-active").click();
    await expect(row, "removed listing must NOT appear under the 'active' tab").toBeHidden();
  });

  test("listings: an active listing shows under 'active', not under 'removed'", async ({ page }) => {
    const active = await seedListing(creator, "E2E FilterActive", "active");
    await page.goto("/yonetim/isletmeler");
    const row = page.getByTestId(`admin-listing-row-${active.id}`);

    await page.getByTestId("admin-filter-active").click();
    await expect(row).toBeVisible();

    await page.getByTestId("admin-filter-removed").click();
    await expect(row).toBeHidden();
  });

  test("reviews: an active review shows under 'active', not under 'hidden'", async ({ page }) => {
    const listing = await seedListing(creator, "E2E FilterReview", "active");
    const review = await seedReview(actor, listing.id);
    await page.goto("/yonetim/yorumlar");
    const row = page.getByTestId(`admin-review-row-${review.id}`);

    await page.getByTestId("admin-filter-active").click();
    await expect(row).toBeVisible();

    await page.getByTestId("admin-filter-hidden").click();
    await expect(row).toBeHidden();
  });
});
