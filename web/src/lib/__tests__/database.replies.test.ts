import { vi, test, expect } from "vitest";
const insert = vi.fn(() => ({ select: () => ({ single: () => ({ data: { id: "r1" }, error: null }) }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from: () => ({ insert }) }) }));
const { DatabaseService } = await import("@/lib/database");

test("respondToReview sends user_id (RLS needs auth.uid()=user_id)", async () => {
  await DatabaseService.respondToReview({ reviewId: "rev1", listingId: "l1", content: "x", userId: "u-123" });
  expect(insert).toHaveBeenCalledWith(expect.objectContaining({ review_id: "rev1", listing_id: "l1", content: "x", user_id: "u-123" }));
});
test("respondToFact sends user_id", async () => {
  await DatabaseService.respondToFact({ factId: "f1", listingId: "l1", content: "x", userId: "u-123" });
  expect(insert).toHaveBeenCalledWith(expect.objectContaining({ fact_id: "f1", listing_id: "l1", content: "x", user_id: "u-123" }));
});
