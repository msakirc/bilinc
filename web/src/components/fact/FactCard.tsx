"use client";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/Badge";
import { VoteBar } from "@/components/ui/VoteBar";
import { votePercents } from "@/lib/facts/factStats";
import type { Fact } from "@/lib/types";

interface FactCardProps {
  fact: Fact;
  variant: "verified" | "disputed";
  tally?: { verify: number; dispute: number }; // required for disputed VoteBar
}

function ArrowUp({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

function ArrowDown({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M19 12l-7 7-7-7" />
    </svg>
  );
}

export function FactCard({ fact, variant, tally }: FactCardProps) {
  const { t } = useTranslation();
  const listingName = fact.listing?.name;
  const truePct = tally ? votePercents(tally.verify, tally.dispute).truePct : 0;
  return (
    <div className="bg-bilinc-surface border border-bilinc-border rounded-xl p-[18px] flex flex-col">
      <div className="flex gap-2 mb-3">
        {variant === "verified"
          ? <Badge variant="verified">✓ {t("common:verification.verified", { defaultValue: "Doğrulandı" })}</Badge>
          : <Badge variant="amber">⚖ {t("home:fact.inVoting", { defaultValue: "Oylamada" })}</Badge>}
        <Badge variant="default">{t(`common:factCategory.${fact.category}`, { defaultValue: fact.category })}</Badge>
      </div>
      <p className="text-[15px] font-medium text-bilinc-text mb-3">{fact.statement}</p>
      {variant === "disputed" && tally && <VoteBar verify={tally.verify} dispute={tally.dispute} />}
      <div className="mt-auto flex items-center justify-between pt-[13px] border-t border-bilinc-border">
        {listingName && (
          <Link href={`/isletme/${fact.listing_id}`} className="text-[13px] font-medium text-bilinc-text-secondary hover:underline">
            {variant === "disputed" && tally
              ? `${listingName} · ${truePct}% ${t("home:fact.truePctSuffix", { defaultValue: "doğru" })}`
              : listingName}
          </Link>
        )}
        {variant === "verified" ? (
          <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-bilinc-text-tertiary">
            <ArrowUp className="w-3.5 h-3.5 text-bilinc-verified" />
            {fact.helpful_count ?? 0}
          </span>
        ) : (
          <span className="inline-flex items-center gap-3 text-[13px] font-semibold text-bilinc-text-tertiary">
            <span className="inline-flex items-center gap-1">
              <ArrowUp className="w-3.5 h-3.5 text-bilinc-verified" />
              {tally?.verify ?? 0}
            </span>
            <span className="inline-flex items-center gap-1">
              <ArrowDown className="w-3.5 h-3.5" />
              {tally?.dispute ?? 0}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
