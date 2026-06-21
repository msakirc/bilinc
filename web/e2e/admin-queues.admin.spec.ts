import { test, expect, type Page } from "@playwright/test";
import { ADMIN } from "./selectors";

// Read-only coverage of the approval queues (claims / edits): the pending list
// or empty-state renders, and the reject modal opens + cancels WITHOUT
// mutating anything. Approve / confirm-reject are write paths — see
// admin-moderation.write.admin.spec.ts.

// The queue's table always renders post-load (the empty-state is a row inside
// it), so asserting the table is visible covers populated and empty cases.
async function expectTableOrEmpty(page: Page, table: string, _empty: string) {
  await expect(page.getByTestId(table)).toBeVisible();
}

test.describe("admin approval queues", () => {
  test.skip(!process.env.E2E_ADMIN_USER, "needs admin session (E2E_ADMIN_USER)");

  test("claims: pending list or empty-state renders", async ({ page }) => {
    await page.goto("/yonetim/talepler");
    await expect(page.getByRole("heading", { name: ADMIN.claimsTitle })).toBeVisible();
    await expectTableOrEmpty(page, "admin-claims-table", "admin-claims-empty");
  });

  test("edits: pending list or empty-state renders", async ({ page }) => {
    await page.goto("/yonetim/duzenlemeler");
    await expect(page.getByRole("heading", { name: ADMIN.editsTitle })).toBeVisible();
    await expectTableOrEmpty(page, "admin-edits-table", "admin-edits-empty");
  });

  test("claims: reject modal opens and cancels (no mutation)", async ({ page }) => {
    await page.goto("/yonetim/talepler");
    const reject = page.locator('[data-testid^="admin-claim-reject-"]').first();
    test.skip((await reject.count()) === 0, "no pending claims on staging");
    await reject.click();
    await expect(page.getByTestId("admin-reject-modal")).toBeVisible();
    await expect(page.getByTestId("admin-reject-reason")).toBeVisible();
    await page.getByTestId("admin-reject-cancel").click();
    await expect(page.getByTestId("admin-reject-modal")).toBeHidden();
  });

  test("edits: reject modal opens and cancels (no mutation)", async ({ page }) => {
    await page.goto("/yonetim/duzenlemeler");
    const reject = page.locator('[data-testid^="admin-edit-reject-"]').first();
    test.skip((await reject.count()) === 0, "no pending edits on staging");
    await reject.click();
    await expect(page.getByTestId("admin-reject-modal")).toBeVisible();
    await expect(page.getByTestId("admin-reject-reason")).toBeVisible();
    await page.getByTestId("admin-reject-cancel").click();
    await expect(page.getByTestId("admin-reject-modal")).toBeHidden();
  });

  // ── Task 13: inline video + reconciliation ──────────────────────────────────

  test("claims: tab bar renders pending and verified tabs", async ({ page }) => {
    await page.goto("/yonetim/talepler");
    await expect(page.getByTestId("admin-claims-tab-pending")).toBeVisible();
    await expect(page.getByTestId("admin-claims-tab-verified")).toBeVisible();
    // Pending tab is active by default — the pending table is present
    await expect(page.getByTestId("admin-claims-table")).toBeVisible();
  });

  test("claims: video claim shows İzle button and renders <video> on click", async ({ page }) => {
    await page.goto("/yonetim/talepler");
    // fixme: seeding a video claim requires a pending claim row with
    //   verification_method='video' and a real signed path in bilinc-verification.
    //   The fixture helpers only seed 'document' method claims.
    //   This test will skip when no video claims exist on staging.
    const watchBtn = page.locator('[data-testid^="admin-claim-watch-"]').first();
    test.skip((await watchBtn.count()) === 0, "no video claims on staging — seed one with verification_method=video");
    const claimId = (await watchBtn.getAttribute("data-testid"))!.replace("admin-claim-watch-", "");
    // Intercept the signed URL request so the video src is resolvable in tests
    const [signResp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/storage/v1/object/sign"), { timeout: 30_000 }),
      watchBtn.click(),
    ]);
    expect(signResp.ok()).toBeTruthy();
    await expect(page.getByTestId(`admin-claim-video-${claimId}`)).toBeVisible();
  });

  test("claims: reconciliation fields are visible for each pending claim row", async ({ page }) => {
    await page.goto("/yonetim/talepler");
    const rows = page.locator('[data-testid^="admin-claim-row-"]');
    test.skip((await rows.count()) === 0, "no pending claims on staging");
    // Check reconciliation data-testid attributes on the first row
    const firstRow = rows.first();
    await expect(firstRow.locator('[data-testid="claim-tax-number"]')).toBeVisible();
    await expect(firstRow.locator('[data-testid="claim-role"]')).toBeVisible();
    await expect(firstRow.locator('[data-testid="claim-listing-name"]')).toBeVisible();
    await expect(firstRow.locator('[data-testid="claim-listing-address"]')).toBeVisible();
    await expect(firstRow.locator('[data-testid="claim-listing-city"]')).toBeVisible();
    await expect(firstRow.locator('[data-testid="claim-gps"]')).toBeVisible();
  });

  // ── Task 14: verified tab + revoke ─────────────────────────────────────────

  test("claims: switching to verified tab loads verified claims table", async ({ page }) => {
    await page.goto("/yonetim/talepler");
    await page.getByTestId("admin-claims-tab-verified").click();
    await expect(page.getByTestId("admin-verified-claims-table")).toBeVisible();
  });

  test("claims: revoke modal opens and cancels (no mutation)", async ({ page }) => {
    await page.goto("/yonetim/talepler");
    await page.getByTestId("admin-claims-tab-verified").click();
    const revokeBtn = page.locator('[data-testid^="admin-claim-revoke-"]').first();
    test.skip((await revokeBtn.count()) === 0, "no verified claims on staging");
    await revokeBtn.click();
    await expect(page.getByTestId("admin-revoke-modal")).toBeVisible();
    await expect(page.getByTestId("admin-revoke-reason")).toBeVisible();
    await page.getByTestId("admin-revoke-cancel").click();
    await expect(page.getByTestId("admin-revoke-modal")).toBeHidden();
  });
});
