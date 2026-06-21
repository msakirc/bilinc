import { test, expect } from "@playwright/test";
import {
  fixtureToken, fixtureUserId, seedListing, seedClaim, seedEdit, getRow, readUser, type SeedCtx,
} from "./fixtures";

// BACKEND SIDE-EFFECTS: the mutation specs assert the row disappears from the UI.
// This asserts the admin action actually had the right DB effect — claim approve
// promotes the user + sets verified_by/expires_at; claim reject stores the
// reason; edit approve writes the new value onto the listing. Write-gated.

const WRITE = process.env.E2E_ALLOW_WRITE === "1";
const ACTOR = process.env.E2E_FIXTURE_USER, APASS = process.env.E2E_FIXTURE_PASS;
const CREATOR = process.env.E2E_BIZOWNER_USER, CPASS = process.env.E2E_BIZOWNER_PASS;

let actor: SeedCtx, creator: SeedCtx;

test.describe("admin action side-effects", () => {
  test.skip(!process.env.E2E_ADMIN_USER, "needs admin session (E2E_ADMIN_USER)");
  test.skip(!WRITE, "write flows gated behind E2E_ALLOW_WRITE=1");
  test.skip(!ACTOR || !APASS || !CREATOR || !CPASS, "needs fixture + creator users");

  test.beforeAll(async () => {
    const at = await fixtureToken(ACTOR!, APASS!);
    actor = { token: at, userId: await fixtureUserId(at) };
    const ct = await fixtureToken(CREATOR!, CPASS!);
    creator = { token: ct, userId: await fixtureUserId(ct) };
  });

  test("claim approve verifies the claim and promotes the user", async ({ page }) => {
    const listing = await seedListing(creator, "E2E SE ClaimApprove");
    let claim: { id: string };
    try {
      claim = await seedClaim(actor, listing.id);
    } catch (e) {
      test.skip(/row-level security/.test(String(e)), "claim self-insert needs claim_submit_flow.sql");
      throw e;
    }
    await page.goto("/yonetim/talepler");
    await page.getByTestId(`admin-claim-approve-${claim.id}`).click();
    await expect(page.getByTestId(`admin-claim-row-${claim.id}`)).toBeHidden();

    // Side-effects: claim verified with audit fields, claimant promoted.
    const row = await getRow<{ status: string; verified_by: string | null; verified_at: string | null; expires_at: string | null }>(
      "listing_claims", claim.id, "status,verified_by,verified_at,expires_at", actor.token,
    );
    expect(row?.status).toBe("verified");
    expect(row?.verified_by, "verified_by (admin id) should be recorded").toBeTruthy();
    expect(row?.expires_at, "expires_at (≈1yr) should be set").toBeTruthy();
    const promoted = await readUser(actor.userId);
    expect(promoted?.user_type, "approving an ownership claim promotes the user").toBe("business_owner");
  });

  test("claim reject stores the rejection reason", async ({ page }) => {
    const listing = await seedListing(creator, "E2E SE ClaimReject");
    let claim: { id: string };
    try {
      claim = await seedClaim(actor, listing.id);
    } catch (e) {
      test.skip(/row-level security/.test(String(e)), "claim self-insert needs claim_submit_flow.sql");
      throw e;
    }
    const reason = `e2e reason ${Date.now().toString(36)}`;
    await page.goto("/yonetim/talepler");
    await page.getByTestId(`admin-claim-reject-${claim.id}`).click();
    await page.getByTestId("admin-reject-reason").fill(reason);
    await page.getByTestId("admin-reject-confirm").click();
    await expect(page.getByTestId(`admin-claim-row-${claim.id}`)).toBeHidden();

    const row = await getRow<{ status: string; rejection_reason: string | null }>(
      "listing_claims", claim.id, "status,rejection_reason", actor.token,
    );
    expect(row?.status).toBe("rejected");
    expect(row?.rejection_reason).toBe(reason);
  });

  test("edit approve writes the new value onto the listing", async ({ page }) => {
    const listing = await seedListing(creator, "E2E SE EditApprove");
    const edit = await seedEdit(actor, listing.id); // field_name=description, new_value set
    await page.goto("/yonetim/duzenlemeler");
    await page.getByTestId(`admin-edit-approve-${edit.id}`).click();
    await expect(page.getByTestId(`admin-edit-row-${edit.id}`)).toBeHidden();

    const updated = await getRow<{ description: string }>("listings", listing.id, "description");
    expect(updated?.description, "approved edit's new_value must land on the listing").toBe("e2e approved description");
  });
});
