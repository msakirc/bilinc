"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { DatabaseService } from "@/lib/database";

interface VoteButtonsProps {
  itemId: string;
  itemType: "fact" | "review";
  helpfulCount?: number;
}

// Helpful / not-helpful voting, ported to web to match mobile's business detail
// (mobile/app/business/[id]/index.tsx). Optimistic tri-state toggle: pressing the
// active direction again removes the vote. Reverts on error.
export function VoteButtons({ itemId, itemType, helpfulCount = 0 }: VoteButtonsProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [vote, setVote] = useState<"up" | "down" | null>(null);

  const handleVote = async (dir: "up" | "down") => {
    if (!user) {
      router.push("/giris");
      return;
    }
    const prev = vote;
    const next = vote === dir ? null : dir;
    setVote(next);
    try {
      if (next === null) {
        if (itemType === "fact") await DatabaseService.deleteFactVote(itemId);
        else await DatabaseService.deleteReviewVote(itemId);
      } else {
        const voteType = next === "up" ? "helpful" : "not_helpful";
        if (itemType === "fact") await DatabaseService.voteOnFact(itemId, voteType);
        else await DatabaseService.voteOnReview(itemId, voteType);
      }
    } catch {
      setVote(prev);
    }
  };

  const upCount = helpfulCount + (vote === "up" ? 1 : 0);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        data-testid={`${itemType}-vote-up-${itemId}`}
        onClick={() => handleVote("up")}
        className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
          vote === "up"
            ? "bg-bilinc-verified/15 text-bilinc-verified"
            : "bg-bilinc-surface-secondary text-bilinc-text-secondary hover:bg-bilinc-border"
        }`}
        aria-pressed={vote === "up"}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M2 21h2V9H2v12zm20-11a2 2 0 0 0-2-2h-6.31l.95-4.57.03-.32a1.5 1.5 0 0 0-.44-1.06L13.17 1 6.59 7.59A2 2 0 0 0 6 9v10a2 2 0 0 0 2 2h9a2 2 0 0 0 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" />
        </svg>
        {upCount}
      </button>
      <button
        type="button"
        data-testid={`${itemType}-vote-down-${itemId}`}
        onClick={() => handleVote("down")}
        className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
          vote === "down"
            ? "bg-bilinc-disputed/15 text-bilinc-disputed"
            : "bg-bilinc-surface-secondary text-bilinc-text-secondary hover:bg-bilinc-border"
        }`}
        aria-pressed={vote === "down"}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M22 3h-2v12h2V3zM2 14a2 2 0 0 0 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L10.83 23l6.59-6.59A2 2 0 0 0 18 15V5a2 2 0 0 0-2-2H7a2 2 0 0 0-1.84 1.22L2.14 11.27c-.09.23-.14.47-.14.73v2z" />
        </svg>
      </button>
    </div>
  );
}
