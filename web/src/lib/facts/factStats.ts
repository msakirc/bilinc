export interface VotePercents { truePct: number; falsePct: number; }

// Verify/dispute counts -> rounded percentages that always sum to 100.
export function votePercents(verify: number, dispute: number): VotePercents {
  const total = verify + dispute;
  if (total === 0) return { truePct: 50, falsePct: 50 };
  const truePct = Math.round((verify / total) * 100);
  return { truePct, falsePct: 100 - truePct };
}

export interface FactCount { verifiedCount: number; hasTagsis: boolean; }
interface FactRow { listing_id: string; category: string; verification_status: string; }

// Per-listing verified-fact count + tağşiş flag (a verified `safety` fact).
// Only listings with >=1 verified fact appear in the map.
export function tallyFactCounts(rows: FactRow[]): Record<string, FactCount> {
  const out: Record<string, FactCount> = {};
  for (const r of rows) {
    if (r.verification_status !== "verified") continue;
    const cur = out[r.listing_id] ?? { verifiedCount: 0, hasTagsis: false };
    cur.verifiedCount += 1;
    if (r.category === "safety") cur.hasTagsis = true;
    out[r.listing_id] = cur;
  }
  return out;
}
