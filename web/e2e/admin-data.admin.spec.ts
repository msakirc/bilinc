import { test, expect } from "@playwright/test";
import {
  fixtureToken, fixtureUserId, seedListing, seedReview, seedClaim, type SeedCtx,
} from "./fixtures";

// DATA-CORRECTNESS: the structural admin specs would stay green even if rows
// showed placeholders or labels rendered as raw keys. These seed rows with KNOWN
// values and assert that exact text + the correct enum LABEL actually render.
// Write-gated (read via the admin UI but needs seeded rows).

const WRITE = process.env.E2E_ALLOW_WRITE === "1";
const ACTOR = process.env.E2E_FIXTURE_USER, APASS = process.env.E2E_FIXTURE_PASS;
const CREATOR = process.env.E2E_BIZOWNER_USER, CPASS = process.env.E2E_BIZOWNER_PASS;

let actor: SeedCtx, creator: SeedCtx;

/** The visible text of the currently-selected <option> in a status select. */
async function selectedLabel(page: import("@playwright/test").Page, testid: string) {
  return (await page.getByTestId(testid).locator("option:checked").innerText()).trim();
}

test.describe("admin data correctness", () => {
  test.skip(!process.env.E2E_ADMIN_USER, "needs admin session (E2E_ADMIN_USER)");
  test.skip(!WRITE, "write flows gated behind E2E_ALLOW_WRITE=1");
  test.skip(!ACTOR || !APASS || !CREATOR || !CPASS, "needs fixture + creator users");

  test.beforeAll(async () => {
    const at = await fixtureToken(ACTOR!, APASS!);
    actor = { token: at, userId: await fixtureUserId(at) };
    const ct = await fixtureToken(CREATOR!, CPASS!);
    creator = { token: ct, userId: await fixtureUserId(ct) };
  });

  test("seeded listing renders by its real name + correct status label", async ({ page }) => {
    const listing = await seedListing(creator, "E2E DataName", "active");
    await page.goto("/yonetim/isletmeler");
    const row = page.getByTestId(`admin-listing-row-${listing.id}`);
    await expect(row).toBeVisible();
    await expect(row, "the actual seeded name must render, not a placeholder").toContainText(listing.name);
    // The status enum renders its Turkish label, not the raw value "active".
    expect(await selectedLabel(page, `admin-listing-status-${listing.id}`)).toBe("Aktif");
  });

  test("seeded review renders author username + content text", async ({ page }) => {
    const listing = await seedListing(creator, "E2E DataReview", "active");
    const review = await seedReview(actor, listing.id);
    await page.goto("/yonetim/yorumlar");
    const row = page.getByTestId(`admin-review-row-${review.id}`);
    await expect(row).toBeVisible();
    await expect(row).toContainText(ACTOR!); // author username
    await expect(row).toContainText("e2e fixture review"); // the content we seeded
    await expect(row).toContainText("5/5"); // rating rendered
  });

  test("seeded claim renders username + role label + verification method", async ({ page }) => {
    const listing = await seedListing(creator, "E2E DataClaim", "active");
    let claim: { id: string };
    try {
      claim = await seedClaim(actor, listing.id);
    } catch (e) {
      test.skip(/row-level security/.test(String(e)), "claim self-insert needs claim_submit_flow.sql");
      throw e;
    }
    await page.goto("/yonetim/talepler");
    const row = page.getByTestId(`admin-claim-row-${claim.id}`);
    await expect(row).toBeVisible();
    await expect(row).toContainText(ACTOR!);
    await expect(row, "role enum renders its TR label 'Sahip', not 'owner'").toContainText("Sahip");
    await expect(row).toContainText("document"); // verification_method
  });

  test("dashboard user count is a real number that reflects seeded users", async ({ page }) => {
    await page.goto("/yonetim");
    const value = page.getByTestId("admin-stat-value-total_users");
    await expect(value).toBeVisible();
    const n = Number((await value.innerText()).trim());
    expect(Number.isInteger(n)).toBe(true);
    // We have created admin + several probe users this project, so it's well > 1.
    expect(n).toBeGreaterThan(1);
  });
});
