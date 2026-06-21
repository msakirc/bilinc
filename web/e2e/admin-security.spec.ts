import { test, expect } from "@playwright/test";
import { fixtureToken, fixtureUserId, attemptSelfPatch, readUser } from "./fixtures";

// SECURITY REGRESSION — privilege self-escalation on the users table.
//
// A normal authenticated user must NOT be able to grant themselves admin or
// inflate their reputation by PATCHing their own users row. This guards the
// fix in db/fix_users_rls_selfescalation.sql.
//
// IMPORTANT: this test is RED until that migration is applied — that is the
// point. It is gated behind E2E_ALLOW_WRITE because, while the bug is open, the
// PATCH actually mutates (the test reverts in a finally either way).
//
// Runs in the guest project (no browser session needed — pure REST).

const PROBE = process.env.E2E_PRIVESC_USER;
const PASS = process.env.E2E_PRIVESC_PASS;

test.describe("security: privilege self-escalation is blocked", () => {
  test.skip(!PROBE || !PASS, "needs the privesc probe user (E2E_PRIVESC_USER)");
  test.skip(process.env.E2E_ALLOW_WRITE !== "1", "mutating probe; gated behind E2E_ALLOW_WRITE=1");

  test("a normal user cannot self-promote to admin", async () => {
    const token = await fixtureToken(PROBE!, PASS!);
    const userId = await fixtureUserId(token);
    const before = await readUser(userId);
    expect(before?.user_type).toBe("consumer"); // probe must start as a plain user

    let status = 0;
    try {
      status = await attemptSelfPatch(token, userId, { user_type: "admin" });
      const after = await readUser(userId);
      // The fix should reject the write (4xx) and leave user_type unchanged.
      expect(after?.user_type, "user_type must stay 'consumer' — self-promotion is a privilege-escalation hole").toBe("consumer");
      expect(status, "PATCH user_type=admin should be rejected").toBeGreaterThanOrEqual(400);
    } finally {
      // If the bug is still open the PATCH succeeded; revert so the probe stays
      // a plain consumer for the next run.
      await attemptSelfPatch(token, userId, { user_type: "consumer" });
    }
  });

  test("a normal user cannot self-inflate reputation past the fact-report gate", async () => {
    const token = await fixtureToken(PROBE!, PASS!);
    const userId = await fixtureUserId(token);

    let status = 0;
    try {
      status = await attemptSelfPatch(token, userId, { reputation_score: 9999 });
      const after = await readUser(userId);
      expect(after?.reputation_score ?? 0, "reputation must not be self-writable (would bypass the 100-pt fact gate)").toBeLessThan(100);
      expect(status, "PATCH reputation_score should be rejected").toBeGreaterThanOrEqual(400);
    } finally {
      await attemptSelfPatch(token, userId, { reputation_score: 0 });
    }
  });
});
