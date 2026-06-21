"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { DatabaseService } from "@/lib/database";
import { StarRating } from "@/components/ui/StarRating";
import { Badge } from "@/components/ui/Badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuthStore } from "@/store/auth";
import { useFormat } from "@/i18n/format";
import type { Review, Fact } from "@/lib/types";

type Tab = "reviews" | "facts";

export default function ActivityPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { formatRelativeDate } = useFormat();
  const { user, initialized, initialize } = useAuthStore();

  const [tab, setTab] = useState<Tab>("reviews");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [facts, setFacts] = useState<Fact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (initialized && !user) {
      router.replace("/giris");
    }
  }, [initialized, user, router]);

  useEffect(() => {
    if (!user) return;
    async function load() {
      try {
        const [r, f] = await Promise.all([
          DatabaseService.getUserReviews(user!.id).catch(() => []),
          DatabaseService.getUserFacts(user!.id).catch(() => []),
        ]);
        setReviews(r);
        setFacts(f);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  async function handleDeleteReview(reviewId: string) {
    if (!confirm(t("activity:delete.confirmReviewWeb"))) return;
    try {
      await DatabaseService.deleteReview(reviewId);
      setReviews((prev) => prev.filter((r) => r.id !== reviewId));
    } catch {
      alert(t("activity:delete.errorReviewWeb"));
    }
  }

  async function handleDeleteFact(factId: string) {
    if (!confirm(t("activity:delete.confirmFactWeb"))) return;
    try {
      await DatabaseService.deleteFact(factId);
      setFacts((prev) => prev.filter((f) => f.id !== factId));
    } catch {
      alert(t("activity:delete.errorFactWeb"));
    }
  }

  if (!initialized || loading) return <LoadingSpinner message={t("common:status.loading")} />;
  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-bilinc-text mb-6">{t("activity:title")}</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab("reviews")}
          className={`px-4 py-2 text-sm font-medium rounded-xl transition ${
            tab === "reviews"
              ? "bg-bilinc-primary text-white"
              : "bg-bilinc-surface border border-bilinc-border text-bilinc-text-secondary hover:bg-bilinc-surface-secondary"
          }`}
        >
          {t("activity:tabsWeb.reviews", { count: reviews.length })}
        </button>
        <button
          onClick={() => setTab("facts")}
          className={`px-4 py-2 text-sm font-medium rounded-xl transition ${
            tab === "facts"
              ? "bg-bilinc-primary text-white"
              : "bg-bilinc-surface border border-bilinc-border text-bilinc-text-secondary hover:bg-bilinc-surface-secondary"
          }`}
        >
          {t("activity:tabsWeb.facts", { count: facts.length })}
        </button>
      </div>

      {/* Reviews Tab */}
      {tab === "reviews" && (
        reviews.length > 0 ? (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="bg-bilinc-surface border border-bilinc-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    {review.listing && (
                      <Link href={`/isletme/${review.listing_id}`} className="text-sm font-semibold text-bilinc-primary hover:underline">
                        {(review.listing as { name: string }).name}
                      </Link>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <StarRating rating={review.rating} size="sm" />
                      {review.title && <span className="text-sm font-medium text-bilinc-text">{review.title}</span>}
                    </div>
                    <p className="text-sm text-bilinc-text-secondary mt-2 line-clamp-2">{review.content}</p>
                    <span className="text-xs text-bilinc-text-tertiary mt-2 block">{formatRelativeDate(review.created_at)}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteReview(review.id)}
                    className="text-bilinc-text-tertiary hover:text-bilinc-disputed transition flex-shrink-0"
                    title={t("activity:actions.delete")}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title={t("activity:empty.reviewsTitle")} subtitle={t("activity:empty.reviewsSubtitle")} icon="star" />
        )
      )}

      {/* Facts Tab */}
      {tab === "facts" && (
        facts.length > 0 ? (
          <div className="space-y-4">
            {facts.map((fact) => (
              <div key={fact.id} className="bg-bilinc-surface border border-bilinc-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    {fact.listing && (
                      <Link href={`/isletme/${fact.listing_id}`} className="text-sm font-semibold text-bilinc-primary hover:underline">
                        {(fact.listing as { name: string }).name}
                      </Link>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="info">{t("common:factCategory." + fact.category, { defaultValue: fact.category })}</Badge>
                      <Badge variant={fact.verification_status === "verified" ? "verified" : fact.verification_status === "disputed" ? "disputed" : "pending"}>
                        {t("common:verification." + fact.verification_status, { defaultValue: fact.verification_status })}
                      </Badge>
                    </div>
                    <p className="text-sm text-bilinc-text-secondary mt-2 line-clamp-2">{fact.statement}</p>
                    <span className="text-xs text-bilinc-text-tertiary mt-2 block">{formatRelativeDate(fact.created_at)}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteFact(fact.id)}
                    className="text-bilinc-text-tertiary hover:text-bilinc-disputed transition flex-shrink-0"
                    title={t("activity:actions.delete")}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title={t("activity:empty.factsTitle")} subtitle={t("activity:empty.factsSubtitle")} icon="info" />
        )
      )}
    </div>
  );
}
