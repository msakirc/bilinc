import { vi, test, expect, beforeEach } from "vitest";

let lastSelect = "";
let lastEqCalls: Array<[string, string]> = [];

const chain = {
  select: vi.fn((s: string) => { lastSelect = s; return chain; }),
  eq: vi.fn((col: string, val: string) => { lastEqCalls.push([col, val]); return chain; }),
  order: vi.fn(() => chain),
  range: vi.fn(() => Promise.resolve({ data: [], error: null })),
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ from: () => chain }),
}));

const { DatabaseService } = await import("@/lib/database");

beforeEach(() => {
  lastSelect = "";
  lastEqCalls = [];
  vi.clearAllMocks();
  // Re-wire the chain after clearAllMocks
  chain.select.mockImplementation((s: string) => { lastSelect = s; return chain; });
  chain.eq.mockImplementation((col: string, val: string) => { lastEqCalls.push([col, val]); return chain; });
  chain.order.mockImplementation(() => chain);
  chain.range.mockImplementation(() => Promise.resolve({ data: [], error: null }));
});

test("getPendingClaims selects listing address_line for reconciliation", async () => {
  await DatabaseService.getPendingClaims();
  expect(lastSelect).toMatch(/address_line/);
});

test("getPendingClaims selects listing city_code for reconciliation", async () => {
  await DatabaseService.getPendingClaims();
  expect(lastSelect).toMatch(/city_code/);
});

test("getVerifiedClaims exists and returns an array", async () => {
  const result = await DatabaseService.getVerifiedClaims();
  expect(Array.isArray(result)).toBe(true);
});

test("getVerifiedClaims filters by status=verified", async () => {
  await DatabaseService.getVerifiedClaims();
  const statusCall = lastEqCalls.find(([col]) => col === "status");
  expect(statusCall).toBeDefined();
  expect(statusCall![1]).toBe("verified");
});
