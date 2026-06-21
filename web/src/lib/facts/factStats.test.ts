import { describe, it, expect } from "vitest";
import { votePercents, tallyFactCounts } from "./factStats";

describe("votePercents", () => {
  it("splits verify vs dispute into rounded percentages summing to 100", () => {
    const p = votePercents(142, 81);
    expect(p.truePct).toBe(64);
    expect(p.falsePct).toBe(36);
    expect(p.truePct + p.falsePct).toBe(100);
  });
  it("returns 50/50 when there are no votes (neutral bar)", () => {
    expect(votePercents(0, 0)).toEqual({ truePct: 50, falsePct: 50 });
  });
});

describe("tallyFactCounts", () => {
  const rows = [
    { listing_id: "a", category: "safety", verification_status: "verified" },
    { listing_id: "a", category: "health", verification_status: "verified" },
    { listing_id: "a", category: "safety", verification_status: "pending" },
    { listing_id: "b", category: "labor", verification_status: "verified" },
  ];
  it("counts verified facts per listing", () => {
    const m = tallyFactCounts(rows);
    expect(m.a.verifiedCount).toBe(2);
    expect(m.b.verifiedCount).toBe(1);
  });
  it("flags tagsis = a verified safety fact", () => {
    const m = tallyFactCounts(rows);
    expect(m.a.hasTagsis).toBe(true);
    expect(m.b.hasTagsis).toBe(false);
  });
  it("ignores listings with no verified facts", () => {
    const m = tallyFactCounts([{ listing_id: "c", category: "safety", verification_status: "pending" }]);
    expect(m.c).toBeUndefined();
  });
});
