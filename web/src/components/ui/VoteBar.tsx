import { votePercents } from "@/lib/facts/factStats";

export function VoteBar({ verify, dispute }: { verify: number; dispute: number }) {
  const { truePct, falsePct } = votePercents(verify, dispute);
  return (
    <div className="h-1.5 rounded bg-bilinc-surface-secondary overflow-hidden flex mt-3" aria-hidden="true">
      <span className="h-full bg-bilinc-verified" style={{ width: `${truePct}%` }} />
      <span className="h-full bg-bilinc-disputed" style={{ width: `${falsePct}%` }} />
    </div>
  );
}
