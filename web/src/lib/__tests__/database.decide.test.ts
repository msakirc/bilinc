import { vi, test, expect, beforeEach } from "vitest";

const rpc = vi.fn(() => ({ error: null }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc }) }));

const { DatabaseService } = await import("@/lib/database");

beforeEach(() => rpc.mockClear());

test("updateClaimStatus(verified) calls decide_claim RPC with correct params", async () => {
  await DatabaseService.updateClaimStatus("c1", "verified", "a1");
  expect(rpc).toHaveBeenCalledWith("decide_claim", {
    p_claim: "c1",
    p_status: "verified",
    p_admin: "a1",
    p_reason: null,
  });
});

test("updateClaimStatus(rejected) with reason passes p_reason", async () => {
  await DatabaseService.updateClaimStatus("c1", "rejected", "a1", "bad docs");
  expect(rpc).toHaveBeenCalledWith("decide_claim", {
    p_claim: "c1",
    p_status: "rejected",
    p_admin: "a1",
    p_reason: "bad docs",
  });
});

test("revokeClaim delegates to updateClaimStatus with status=revoked", async () => {
  await DatabaseService.revokeClaim("c1", "a1", "dup");
  expect(rpc).toHaveBeenCalledWith("decide_claim", {
    p_claim: "c1",
    p_status: "revoked",
    p_admin: "a1",
    p_reason: "dup",
  });
});

test("revokeClaim without reason passes p_reason=null", async () => {
  await DatabaseService.revokeClaim("c1", "a1");
  expect(rpc).toHaveBeenCalledWith("decide_claim", {
    p_claim: "c1",
    p_status: "revoked",
    p_admin: "a1",
    p_reason: null,
  });
});
