import { test, expect } from "@playwright/test";
import { fixtureToken, fixtureUserId, seedListing, type SeedCtx } from "./fixtures";

// Claim ownership page /sahiplen/[id] for a logged-in user. With an unknown id
// the listing lookup fails and the page shows its title + a not-found note —
// enough to prove the authed render (no redirect). Real submit needs a real
// listing + writes a claim row, so it's not exercised here.

// Valid 10-digit VKN that passes the checksum algorithm (see lib/vkn.ts).
// Verified offline: isValidVKN("1234567890") === true.
const VALID_VKN = "1234567890";

test.describe("claim ownership (authed)", () => {
  test.skip(
    !process.env.E2E_LOWREP_USER && !process.env.E2E_USER,
    "needs the authed session",
  );

  test("authed user reaches the claim page", async ({ page }) => {
    await page.goto("/sahiplen/00000000-0000-0000-0000-000000000000");
    await expect(page.getByRole("heading", { name: "Sahiplik Talebi" })).toBeVisible();
    await expect(page).not.toHaveURL(/\/giris$/);
  });

  // (a) No file input on the rebuilt claim form
  // FIXME: ClaimForm only mounts when the listing resolves (page.tsx renders it
  // conditionally on `listing`). A nil UUID returns listing=null and the form is
  // never rendered. Seed a real listing first (requires E2E_USER/E2E_PASS +
  // seedListing from fixtures) — same seed dependency as the submit test below.
  test.fixme("claim form has no file input", async ({ page }) => {
    await page.goto("/sahiplen/00000000-0000-0000-0000-000000000000");
    // Wait for form to render (may show not-found state but form still mounts
    // while the listing fetch is in flight or falls back).
    // The form element itself should exist and must NOT contain a file input.
    const form = page.locator('[data-testid="claim-form"]');
    await expect(form).toBeVisible();
    await expect(form.locator('input[type="file"]')).toHaveCount(0);
  });

  // (b) Submit is disabled until valid VKN entered AND rıza checkbox checked
  // FIXME: ClaimForm only mounts when the listing resolves (page.tsx renders it
  // conditionally on `listing`). A nil UUID returns listing=null and the form is
  // never rendered. Seed a real listing first (requires E2E_USER/E2E_PASS +
  // seedListing from fixtures) — same seed dependency as the submit test below.
  test.fixme("submit disabled until VKN valid and consent checked", async ({ page }) => {
    await page.goto("/sahiplen/00000000-0000-0000-0000-000000000000");
    const form = page.locator('[data-testid="claim-form"]');
    await expect(form).toBeVisible();

    const submitBtn = form.locator('[data-testid="claim-submit-btn"]');
    const vknInput = form.locator('[data-testid="claim-vkn-input"]');
    const consentBox = form.locator('[data-testid="claim-consent-checkbox"]');

    // Initially disabled (no VKN, no consent)
    await expect(submitBtn).toBeDisabled();

    // Enter valid VKN only — still disabled (no consent)
    await vknInput.fill(VALID_VKN);
    await expect(submitBtn).toBeDisabled();

    // Check consent only (VKN already filled) — now enabled
    await consentBox.check();
    await expect(submitBtn).toBeEnabled();

    // Uncheck consent — disabled again
    await consentBox.uncheck();
    await expect(submitBtn).toBeDisabled();

    // Clear VKN and re-check consent — still disabled (VKN invalid)
    await vknInput.fill("");
    await consentBox.check();
    await expect(submitBtn).toBeDisabled();
  });

  // (c) Submitting with valid VKN+consent shows MobileHandoff
  // FIXME: this test needs a real listing_id that exists in the staging DB and
  // valid credentials so createClaim can succeed and return a claimId.
  // The /sahiplen/00000000-… path will hit a listing-not-found state before the
  // form even renders in production (listing lookup fails), and the mock UUID
  // will cause a foreign-key error on insert. Seed a real listing first.
  test.fixme(
    "submitting valid VKN+consent shows MobileHandoff with QR and deep link",
    async ({ page }) => {
      // Prerequisite: log in as the fixture user and seed a listing
      const user = process.env.E2E_USER ?? "";
      const pass = process.env.E2E_PASS ?? "";
      if (!user || !pass) {
        test.skip(true, "E2E_USER / E2E_PASS not set");
        return;
      }

      const token = await fixtureToken(user, pass);
      const userId = await fixtureUserId(token);
      const ctx: SeedCtx = { token, userId };
      const { id: listingId } = await seedListing(ctx);

      await page.goto(`/sahiplen/${listingId}`);
      const form = page.locator('[data-testid="claim-form"]');
      await expect(form).toBeVisible();

      await form.locator('[data-testid="claim-vkn-input"]').fill(VALID_VKN);
      await form.locator('[data-testid="claim-consent-checkbox"]').check();
      await form.locator('[data-testid="claim-submit-btn"]').click();

      // After successful submit the form is replaced by MobileHandoff
      const handoff = page.locator('[data-testid="mobile-handoff"]');
      await expect(handoff).toBeVisible({ timeout: 10000 });

      // QR image or placeholder should exist
      const qr = handoff.locator('[data-testid="handoff-qr-image"], [data-testid="handoff-qr-placeholder"]');
      await expect(qr).toBeVisible();

      // Deep link href should contain bilinc://claim/
      const deepLink = handoff.locator('[data-testid="handoff-deep-link"]');
      await expect(deepLink).toBeVisible();
      const href = await deepLink.getAttribute("href");
      expect(href).toMatch(/^bilinc:\/\/claim\//);

      // "telefonda tamamlayın" text appears in the handoff title
      await expect(handoff).toContainText("telefonda tamamlayın");
    },
  );
});
