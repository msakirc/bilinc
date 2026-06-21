"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/store/auth";
import { DatabaseService } from "@/lib/database";
import type { ListingClaim, ListingStats } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCounter } from "@/components/ui/StatCounter";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { buttonClasses } from "@/components/ui/buttonVariants";

interface ClaimWithStats extends ListingClaim {
  stats: ListingStats | null;
}

export default function DashboardOverviewPage() {
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
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div>
        <PageHeader
          title={t("panel:dashboard.welcome", { name: user?.display_name ?? user?.username })}
          subtitle={t("panel:dashboard.subtitle")}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t("panel:dashboard.welcome", { name: user?.display_name ?? user?.username })}
        subtitle={t("panel:dashboard.subtitle")}
      />

      {claims.length === 0 ? (
        <div className="flex flex-col items-center">
          <EmptyState
            icon="list"
            title={t("panel:dashboard.emptyTitle")}
            subtitle={t("panel:dashboard.emptyDescription")}
          />
          <Link href="/sahiplen" className={buttonClasses("primary", "md")}>
            {t("panel:dashboard.claimBusiness")}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {claims.map((claim) => (
            <div
              key={claim.id}
              className="bg-bilinc-surface border border-bilinc-border rounded-2xl p-5 hover:border-bilinc-primary/30 transition"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="min-w-0">
                  <h3 className="font-semibold text-bilinc-text truncate">
                    {claim.listing?.name || t("common:entityType.business")}
                  </h3>
                  <span className="text-xs text-bilinc-text-secondary">
                    {t("common:entityType." + (claim.listing?.entity_type || "business"), { defaultValue: claim.listing?.entity_type || "business" })}
                  </span>
                </div>
                <Badge variant="verified">{t("common:verification.verified")}</Badge>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-5">
                <StatCounter
                  value={claim.stats?.average_rating?.toFixed(1) ?? "-"}
                  label={t("panel:dashboard.stats.rating")}
                />
                <StatCounter
                  value={String(claim.stats?.total_reviews ?? 0)}
                  label={t("panel:dashboard.stats.reviews")}
                />
                <StatCounter
                  value={String(claim.stats?.total_facts ?? 0)}
                  label={t("panel:dashboard.stats.facts")}
                />
              </div>

              <div className="flex gap-2">
                <Link
                  href={`/panel/yorumlar?listing=${claim.listing?.id}`}
                  className={`flex-1 text-center ${buttonClasses("outline", "sm")}`}
                >
                  {t("panel:dashboard.viewReviews")}
                </Link>
                <Link
                  href={`/panel/bilgiler?listing=${claim.listing?.id}`}
                  className={`flex-1 text-center ${buttonClasses("outline", "sm")}`}
                >
                  {t("panel:dashboard.viewFacts")}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
