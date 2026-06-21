"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/store/auth";
import { DatabaseService } from "@/lib/database";
import type { ListingClaim, ListingStats } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/buttonVariants";

interface ClaimWithStats extends ListingClaim {
  stats: ListingStats | null;
}

export default function MyListingsPage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [claims, setClaims] = useState<ClaimWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadData() {
    try {
      const claimsData = await DatabaseService.getClaimedListings(user!.id);
      const withStats = await Promise.all(
        claimsData.map(async (claim) => {
          const stats = claim.listing?.id
            ? await DatabaseService.getListingStats(claim.listing.id)
            : null;
          return { ...claim, stats } as ClaimWithStats;
        })
      );
      setClaims(withStats);
    } catch (err) {
      console.error("Listings load error:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-bilinc-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t("panel:listings.title")} />

      {claims.length === 0 ? (
        <div className="flex flex-col items-center">
          <EmptyState
            icon="list"
            title={t("panel:listings.emptyTitle")}
            subtitle={t("panel:listings.emptyDescription")}
          />
          <Link href="/sahiplen" className={buttonClasses("primary", "md")}>
            {t("panel:listings.claimBusiness")}
          </Link>
        </div>
      ) : (
        <div className="bg-bilinc-surface border border-bilinc-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-bilinc-surface-secondary text-bilinc-text-tertiary text-xs uppercase tracking-wide">
                  <th className="text-left font-medium px-4 py-3">{t("panel:listings.table.name")}</th>
                  <th className="text-left font-medium px-4 py-3">{t("panel:listings.table.type")}</th>
                  <th className="text-left font-medium px-4 py-3">{t("panel:listings.table.rating")}</th>
                  <th className="text-left font-medium px-4 py-3">{t("panel:listings.table.reviews")}</th>
                  <th className="text-left font-medium px-4 py-3">{t("panel:listings.table.facts")}</th>
                  <th className="text-left font-medium px-4 py-3">{t("panel:listings.table.status")}</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((claim) => (
                  <tr key={claim.id} className="border-b border-bilinc-border hover:bg-bilinc-surface-secondary transition">
                    <td className="px-4 py-4">
                      <span className="font-medium text-bilinc-text">{claim.listing?.name || "—"}</span>
                    </td>
                    <td className="px-4 py-4 text-sm text-bilinc-text-secondary">
                      {t("common:entityType." + (claim.listing?.entity_type || "business"), { defaultValue: claim.listing?.entity_type || "business" })}
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm font-semibold text-bilinc-text">
                        {claim.stats?.average_rating?.toFixed(1) || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/panel/yorumlar?listing=${claim.listing?.id}`}
                        className="text-sm text-bilinc-primary hover:underline"
                      >
                        {claim.stats?.total_reviews || 0}
                      </Link>
                    </td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/panel/bilgiler?listing=${claim.listing?.id}`}
                        className="text-sm text-bilinc-primary hover:underline"
                      >
                        {claim.stats?.total_facts || 0}
                      </Link>
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant="verified">
                        {claim.listing?.status === "active" ? t("common:labels.active") : claim.listing?.status || "—"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
