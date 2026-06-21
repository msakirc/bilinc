import { test, expect } from "@playwright/test";
import { PLACEHOLDER_ID } from "./helpers";

// Role-protected areas reject a guest. Middleware redirects unauthenticated
// users on /panel and /yonetim straight to /giris (the layout's own role push
// only fires once a user IS logged in — see role-gates.authed). The claim page
// redirects guests to /giris too. Needs staging reachable (no session).

test.describe("role gates (guest)", () => {
  test("guest visiting business panel -> /giris", async ({ page }) => {
    await page.goto("/panel");
    await expect(page).toHaveURL(/\/giris$/);
  });

  test("guest visiting admin panel -> /giris", async ({ page }) => {
    await page.goto("/yonetim");
    await expect(page).toHaveURL(/\/giris$/);
  });

  test("guest visiting claim page -> /giris", async ({ page }) => {
    await page.goto(`/sahiplen/${PLACEHOLDER_ID}`);
    await expect(page).toHaveURL(/\/giris$/);
  });
});

// Regression: business panel must gate on an *unexpired* verified claim,
// not merely on users.user_type='business_owner' (which is never cleared).
// An owner whose only verified claim has expired must be redirected away from /panel.
//
// FIXME (seed blocker): seeding an expired verified claim requires a service-role
// key to bypass RLS — `decide_claim` sets expires_at=now()+1year and a regular
// user cannot self-PATCH it. SUPABASE_SERVICE_KEY is intentionally absent from
// e2e/.env.e2e to avoid CI leaks. To unblock: expose the key in CI secrets, add
// seedExpiredClaim(ctx) to fixtures.ts (INSERT with expires_at in the past +
// status='verified' using service-key headers), log in as that user, then assert
// /panel -> / (authenticated but no active claim).
test.describe("role gates (expired claim)", () => {
  test.fixme(
    "owner with only an expired verified claim is redirected away from /panel",
    async ({ page }) => {
      // When seed infrastructure is in place:
      // 1. Log in as a seeded user with exactly one listing_claim:
      //    status='verified', expires_at < now()
      // 2. Navigate to /panel
      // 3. User is still authenticated -> lands on / (not /giris)
      await page.goto("/panel");
      await expect(page).toHaveURL(/^\//);
      await expect(page).not.toHaveURL(/\/panel/);
    },
  );
});
