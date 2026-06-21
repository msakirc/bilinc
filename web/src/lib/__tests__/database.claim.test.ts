import { vi, test, expect } from "vitest";
const insert = vi.fn(() => ({ select: () => ({ single: () => ({ data: { id: "c1" }, error: null }) }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from: () => ({ insert }) }) }));
const { DatabaseService } = await import("@/lib/database");

test("createClaim records consent + video method + VKN + GPS sidecar", async () => {
  const id = await DatabaseService.createClaim({
    listingId: "l1", userId: "u1", role: "owner", verificationMethod: "video",
    taxNumber: "1234567890", consentAt: "2026-06-19T00:00:00.000Z",
    capturedLat: 41.0, capturedLng: 29.0, livenessNonce: "BILINC-0619",
  });
  expect(id).toBe("c1");
  expect(insert).toHaveBeenCalledWith(expect.objectContaining({
    listing_id: "l1", user_id: "u1", role: "owner", status: "pending",
    verification_method: "video", tax_number: "1234567890", consent_at: "2026-06-19T00:00:00.000Z",
    captured_lat: 41.0, captured_lng: 29.0, liveness_nonce: "BILINC-0619",
  }));
});
