"use client";

import { Badge } from "@/components/ui/Badge";
import { VoteButtons } from "@/components/listing/VoteButtons";
import { useTranslation } from "react-i18next";
import { useFormat } from "@/i18n/format";
import type { Fact } from "@/lib/types";

interface ListingFactsProps {
  facts: Fact[];
}

function statusVariant(status: string): "verified" | "pending" | "disputed" | "default" {
  if (status === "verified") return "verified";
  if (status === "pending") return "pending";
  if (status === "disputed") return "disputed";
  return "default";
}

// icon glyph paired with the status badge so color is never the sole signal
function statusGlyph(status: string): string {
  if (status === "verified") return "✓";
  if (status === "disputed") return "⚖";
  return "•";
}

export function ListingFacts({ facts }: ListingFactsProps) {
  const { t } = useTranslation();
  const { formatRelativeDate } = useFormat();
  if (facts.length === 0) return null;

  return (
    <div className="space-y-4">
      {facts.map((fact) => (
        <div
          key={fact.id}
          className="flex flex-col bg-bilinc-surface border border-bilinc-border rounded-xl p-[18px]"
        >
          <div className="flex flex-wrap gap-2 mb-3">
            <Badge variant={statusVariant(fact.verification_status)}>
              {statusGlyph(fact.verification_status)}{" "}
              {t("common:verification." + fact.verification_status, { defaultValue: fact.verification_status })}
            </Badge>
            <Badge variant="default">
              {t("common:factCategory." + fact.category, { defaultValue: fact.category })}
            </Badge>
          </div>
          <p className="text-[15px] font-medium text-bilinc-text">{fact.statement}</p>
          <div className="mt-3 flex items-center justify-between gap-3 pt-[13px] border-t border-bilinc-border">
            <div className="flex items-center gap-2 text-[13px] text-bilinc-text-tertiary">
              {fact.user && (
                <span className="font-medium text-bilinc-text-secondary">
                  {fact.user.username}
                  <span className="ml-1 text-bilinc-text-tertiary">
                    · {t("common:credibility." + fact.user.credibility_level, { defaultValue: fact.user.credibility_level })}
                  </span>
                </span>
              )}
              <span>{formatRelativeDate(fact.created_at)}</span>
            </div>
            <VoteButtons itemId={fact.id} itemType="fact" helpfulCount={fact.helpful_count} />
          </div>
        </div>
      ))}
    </div>
  );
}
