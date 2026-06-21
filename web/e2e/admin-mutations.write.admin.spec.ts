import { test, expect, type Locator } from "@playwright/test";
import {
  fixtureToken, fixtureUserId, seedListing, seedReview, seedFact,
  seedClaim, seedEdit, uploadVerificationDoc, type SeedCtx,
} from "./fixtures";

// WRITE coverage that exercises the real admin mutations end-to-end by seeding
// its own throwaway rows through the Supabase REST API and driving the admin UI
// against them. Double gated: admin session + E2E_ALLOW_WRITE=1.
//
// Listings are seeded by a CREATOR identity (e2e_bizowner) while reviews /
// claims / edits are seeded by a separate ACTOR identity (e2e_fixture), because
// staging blocks acting on a listing you created ("Cannot review a listing you
// created"; claims RLS rejects self-owned). Tests that need staging infra not
// present (facts reputation gate is computed → needs service_role; the
// bilinc-verification bucket isn't on staging) skip with a clear reason rather
// than fail.

const WRITE = process.env.E2E_ALLOW_WRITE === "1";
const ACTOR = process.env.E2E_FIXTURE_USER;
const APASS = process.env.E2E_FIXTURE_PASS;
const CREATOR = process.env.E2E_BIZOWNER_USER;
const CPASS = process.env.E2E_BIZOWNER_PASS;

let actor: SeedCtx;
let creator: SeedCtx;

async function flipAndRevert(select: Locator, values: readonly string[]) {
  const original = await select.inputValue();
  const next = values.find((v) => v !== original)!;
  await select.selectOption(next);
  await expect(select).toHaveValue(next);
  await select.selectOption(original);
  await expect(select).toHaveValue(original);
}

/** Seed a pending claim, or skip the test if staging lacks the self-insert
 *  policy (claim_submit_flow.sql is a post-launch migration not on staging). */
async function seedClaimOrSkip(ctx: SeedCtx, listingId: string, docPath?: string) {
  try {
    return await seedClaim(ctx, listingId, docPath);
  } catch (e) {
    test.skip(/row-level security/.test(String(e)), "claim self-insert needs claim_submit_flow.sql (not applied on staging) or service_role");
    throw e;
  }
}

test.describe("admin mutations (write, self-seeded)", () => {
  test.skip(!process.env.E2E_ADMIN_USER, "needs admin session (E2E_ADMIN_USER)");
  test.skip(!WRITE, "write flows gated behind E2E_ALLOW_WRITE=1");
  test.skip(!ACTOR || !APASS, "needs the fixture/actor user (E2E_FIXTURE_USER)");
  test.skip(!CREATOR || !CPASS, "needs the creator user (E2E_BIZOWNER_USER)");

  test.beforeAll(async () => {
    const at = await fixtureToken(ACTOR!, APASS!);
    actor = { token: at, userId: await fixtureUserId(at) };
    const ct = await fixtureToken(CREATOR!, CPASS!);
    creator = { token: ct, userId: await fixtureUserId(ct) };
  });

  test("claim approve removes the row", async ({ page }) => {
    const listing = await seedListing(creator, "E2E Claim Approve");
    const claim = await seedClaimOrSkip(actor, listing.id);
    await page.goto("/yonetim/talepler");
    const row = page.getByTestId(`admin-claim-row-${claim.id}`);
    await expect(row).toBeVisible();
    await page.getByTestId(`admin-claim-approve-${claim.id}`).click();
    await expect(row).toBeHidden();
  });

  test("claim reject (confirm with reason) removes the row", async ({ page }) => {
    const listing = await seedListing(creator, "E2E Claim Reject");
    const claim = await seedClaimOrSkip(actor, listing.id);
    await page.goto("/yonetim/talepler");
    const row = page.getByTestId(`admin-claim-row-${claim.id}`);
    await expect(row).toBeVisible();
    await page.getByTestId(`admin-claim-reject-${claim.id}`).click();
    await expect(page.getByTestId("admin-reject-modal")).toBeVisible();
    await page.getByTestId("admin-reject-reason").fill("e2e: insufficient proof");
    await page.getByTestId("admin-reject-confirm").click();
    await expect(row).toBeHidden();
  });

  test("claim document mints a signed URL", async ({ page }) => {
    const listing = await seedListing(creator, "E2E Claim Doc");
    let docPath: string;
    try {
      docPath = await uploadVerificationDoc(actor, listing.id);
    } catch (e) {
      test.skip(/Bucket not found/.test(String(e)), "bilinc-verification bucket not provisioned on staging");
      throw e;
    }
    const claim = await seedClaim(actor, listing.id, docPath);
    await page.goto("/yonetim/talepler");
    // The doc button calls getSignedVerificationUrl() then window.open(); assert
    // the sign request succeeds (robust — avoids popup/timing flakiness).
    const [signResp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/storage/v1/object/sign"), { timeout: 30_000 }),
      page.getByTestId(`admin-claim-doc-${claim.id}`).click(),
    ]);
    expect(signResp.ok()).toBeTruthy();
  });

  test("edit approve removes the row", async ({ page }) => {
    const listing = await seedListing(creator, "E2E Edit Approve");
    const edit = await seedEdit(actor, listing.id);
    await page.goto("/yonetim/duzenlemeler");
    const row = page.getByTestId(`admin-edit-row-${edit.id}`);
    await expect(row).toBeVisible();
    await page.getByTestId(`admin-edit-approve-${edit.id}`).click();
    await expect(row).toBeHidden();
  });

  test("edit reject (confirm with reason) removes the row", async ({ page }) => {
    const listing = await seedListing(creator, "E2E Edit Reject");
    const edit = await seedEdit(actor, listing.id);
    await page.goto("/yonetim/duzenlemeler");
    const row = page.getByTestId(`admin-edit-row-${edit.id}`);
    await expect(row).toBeVisible();
    await page.getByTestId(`admin-edit-reject-${edit.id}`).click();
    await expect(page.getByTestId("admin-reject-modal")).toBeVisible();
    await page.getByTestId("admin-reject-reason").fill("e2e: rejected");
    await page.getByTestId("admin-reject-confirm").click();
    await expect(row).toBeHidden();
  });

  test("listing status flip+revert on a seeded row", async ({ page }) => {
    const listing = await seedListing(creator, "E2E Status Flip");
    await page.goto("/yonetim/isletmeler");
    const select = page.getByTestId(`admin-listing-status-${listing.id}`);
    await expect(select).toBeVisible();
    await flipAndRevert(select, ["active", "pending", "removed"]);
  });

  test("review status flip+revert on a seeded row", async ({ page }) => {
    const listing = await seedListing(creator, "E2E Review Flip");
    const review = await seedReview(actor, listing.id);
    await page.goto("/yonetim/yorumlar");
    const select = page.getByTestId(`admin-review-status-${review.id}`);
    await expect(select).toBeVisible();
    await flipAndRevert(select, ["active", "hidden", "removed"]);
  });

  test("user type flip+revert on a dedicated user", async ({ page }) => {
    // A dedicated disposable user (E2E_TYPEFLIP_USER_ID = e2e_typeflip), never
    // the admin's own row — self-demotion would lock the admin out via the
    // privilege-escalation trigger. Used by no other spec, so no cross-test race.
    const id = process.env.E2E_TYPEFLIP_USER_ID;
    test.skip(!id, "set E2E_TYPEFLIP_USER_ID to a disposable non-admin user");
    await page.goto("/yonetim/kullanicilar");
    const select = page.getByTestId(`admin-user-type-${id}`);
    await expect(select).toBeVisible();
    // flipAndRevert picks consumer -> business_owner -> consumer (never admin).
    await flipAndRevert(select, ["consumer", "business_owner", "admin"]);
  });

  test("listing status change PERSISTS across reload (real DB write)", async ({ page }) => {
    const listing = await seedListing(creator, "E2E Persist");
    await page.goto("/yonetim/isletmeler");
    const select = page.getByTestId(`admin-listing-status-${listing.id}`);
    await expect(select).toHaveValue("active");
    await select.selectOption("pending");
    // Reload from the server — an optimistic-only UI would revert to 'active'.
    await page.reload();
    const reloaded = page.getByTestId(`admin-listing-status-${listing.id}`);
    await expect(reloaded, "status must persist after reload, not just optimistic UI").toHaveValue("pending");
    await reloaded.selectOption("active"); // restore
  });

  test("verified claim: revoke removes the row from verified tab", async ({ page }) => {
    // Seed a pending claim, then approve it via the admin UI, then switch to the
    // Verified tab and revoke it — asserting the row disappears.
    const listing = await seedListing(creator, "E2E Claim Revoke");
    const claim = await seedClaimOrSkip(actor, listing.id);
    // Step 1: approve via the Pending tab so it becomes verified
    await page.goto("/yonetim/talepler");
    const pendingRow = page.getByTestId(`admin-claim-row-${claim.id}`);
    await expect(pendingRow).toBeVisible();
    await page.getByTestId(`admin-claim-approve-${claim.id}`).click();
    await expect(pendingRow).toBeHidden();
    // Step 2: switch to Verified tab and find the newly verified claim
    await page.getByTestId("admin-claims-tab-verified").click();
    const verifiedRow = page.getByTestId(`admin-verified-claim-row-${claim.id}`);
    // fixme: getVerifiedClaims relies on listing join; if the row isn't visible
    //   immediately after switching tabs, wait for the table to settle.
    await expect(verifiedRow).toBeVisible({ timeout: 10_000 });
    // Step 3: open revoke modal, optionally fill reason, confirm
    await page.getByTestId(`admin-claim-revoke-${claim.id}`).click();
    await expect(page.getByTestId("admin-revoke-modal")).toBeVisible();
    await page.getByTestId("admin-revoke-reason").fill("e2e: revoke test");
    await page.getByTestId("admin-revoke-confirm").click();
    await expect(verifiedRow).toBeHidden();
  });

  test("fact verification flip+revert on a seeded row", async ({ page }) => {
    const listing = await seedListing(creator, "E2E Fact Flip");
    let fact: { id: string };
    try {
      fact = await seedFact(actor, listing.id);
    } catch (e) {
      test.skip(/row-level security/.test(String(e)), "facts insert is reputation-gated (computed) — seed needs service_role");
      throw e;
    }
    await page.goto("/yonetim/bilgiler");
    const select = page.getByTestId(`admin-fact-status-${fact.id}`);
    await expect(select).toBeVisible();
    await flipAndRevert(select, ["pending", "verified", "disputed", "retracted"]);
  });
});
