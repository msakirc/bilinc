"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/store/auth";
import { DatabaseService } from "@/lib/database";
import { useFormat } from "@/i18n/format";
import type { Subscription } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { buttonClasses } from "@/components/ui/buttonVariants";

type TierKey = "free" | "basic" | "pro" | "enterprise";

interface Tier {
  key: TierKey;
  price: number | null; // null = contact for pricing
  featureKeys: string[];
}

const tiers: Tier[] = [
  { key: "free", price: 0, featureKeys: ["view", "basicStats"] },
  { key: "basic", price: 149, featureKeys: ["replyReviews", "replyFacts", "statsPanel"] },
  { key: "pro", price: 399, featureKeys: ["prioritySupport", "detailedAnalytics", "customBadges"] },
  { key: "enterprise", price: null, featureKeys: ["apiAccess", "multiBusiness", "customIntegrations"] },
];

export default function SubscriptionPage() {
  const { t } = useTranslation();
  const { formatDate, formatNumber } = useFormat();
  const { user } = useAuthStore();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadSubscription();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadSubscription() {
    try {
      const data = await DatabaseService.getSubscription(user!.id);
      setSubscription(data);
    } catch (err) {
      console.error("Subscription load error:", err);
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

  const currentTier = subscription?.tier || "free";

  return (
    <div>
      <PageHeader title={t("panel:subscription.title")} />

      {/* Current plan */}
      <div className="bg-bilinc-surface border border-bilinc-border rounded-2xl p-6 mb-8">
        <h2 className="text-lg font-semibold text-bilinc-text mb-4">{t("panel:subscription.currentPlanTitle")}</h2>
        {subscription ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Badge variant="primary" size="md">
                {tiers.find((tier) => tier.key === subscription.tier)
                  ? t("panel:subscription.tiers." + subscription.tier + ".name")
                  : subscription.tier}
              </Badge>
              <Badge variant="verified" size="md">
                {t("panel:subscription.active")}
              </Badge>
            </div>
            {subscription.current_period_start && subscription.current_period_end && (
              <p className="text-sm text-bilinc-text-secondary">
                {t("panel:subscription.period", {
                  start: formatDate(subscription.current_period_start),
                  end: formatDate(subscription.current_period_end),
                })}
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Badge variant="default" size="md">
              {t("panel:subscription.freePlan")}
            </Badge>
            <p className="text-sm text-bilinc-text-secondary">
              {t("panel:subscription.freePlanNote")}
            </p>
          </div>
        )}
      </div>

      {/* Tier comparison */}
      <h2 className="text-lg font-semibold text-bilinc-text mb-4">{t("panel:subscription.plansTitle")}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {tiers.map((tier) => {
          const isCurrent = tier.key === currentTier;
          return (
            <div
              key={tier.key}
              className={`bg-bilinc-surface border rounded-2xl p-6 flex flex-col ${
                isCurrent ? "border-bilinc-primary ring-1 ring-bilinc-primary/20" : "border-bilinc-border"
              }`}
            >
              <h3 className="text-lg font-bold text-bilinc-text mb-1">{t("panel:subscription.tiers." + tier.key + ".name")}</h3>
              <div className="mb-4">
                {tier.price === null ? (
                  <span className="text-sm text-bilinc-text-secondary">{t("panel:subscription.contactPrice")}</span>
                ) : tier.price === 0 ? (
                  <p>
                    <span className="font-serif text-2xl font-semibold text-bilinc-text">{formatNumber(0)}</span>
                  </p>
                ) : (
                  <p className="text-bilinc-text">
                    <span className="font-serif text-2xl font-semibold">{formatNumber(tier.price)}</span>
                    <span className="text-sm text-bilinc-text-secondary"> {t("panel:subscription.perMonthSuffix")}</span>
                  </p>
                )}
              </div>

              <ul className="space-y-2 mb-6 flex-1">
                {tier.featureKeys.map((featureKey) => (
                  <li key={featureKey} className="flex items-start gap-2 text-sm text-bilinc-text-secondary">
                    <svg className="w-4 h-4 text-bilinc-verified shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {t("panel:subscription.tiers." + tier.key + ".features." + featureKey)}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div className="px-4 py-2.5 text-center text-sm font-medium rounded-lg bg-bilinc-primary/10 text-bilinc-primary">
                  {t("panel:subscription.currentPlan")}
                </div>
              ) : (
                <div className="relative group">
                  <button
                    disabled
                    className={buttonClasses("outline", "md") + " w-full cursor-not-allowed"}
                  >
                    {t("panel:subscription.upgrade")}
                  </button>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 text-xs bg-bilinc-text text-bilinc-bg rounded-lg opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap">
                    {t("panel:subscription.comingSoon")}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
