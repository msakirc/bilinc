"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/store/auth";
import { DatabaseService } from "@/lib/database";
import { useFormat } from "@/i18n/format";
import type { ListingClaim } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterTabs } from "@/components/ui/FilterTabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { StarRating } from "@/components/ui/StarRating";
import { buttonClasses } from "@/components/ui/buttonVariants";

interface ReviewWithResponse {
  id: string;
  listing_id: string;
  rating: number;
  title?: string;
  content: string;
  created_at: string;
  user?: { username: string; credibility_level: string };
  response?: Array<{ id: string; content: string; created_at: string }>;
}

type FilterTab = "all" | "unanswered" | "answered";

export default function ReviewsManagementPage() {
  const { t } = useTranslation();
  const { formatRelativeDate } = useFormat();
  const { user } = useAuthStore();
  const searchParams = useSearchParams();
  const listingParam = searchParams.get("listing");

  const [claims, setClaims] = useState<ListingClaim[]>([]);
  const [selectedListing, setSelectedListing] = useState<string>(listingParam || "");
  const [reviews, setReviews] = useState<ReviewWithResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadClaims();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadClaims() {
    try {
      const data = await DatabaseService.getClaimedListings(user!.id);
      setClaims(data);
      if (listingParam) {
        setSelectedListing(listingParam);
      } else if (data.length > 0 && data[0].listing) {
        setSelectedListing(data[0].listing.id);
      }
    } catch (err) {
      console.error("Load claims error:", err);
    }
  }

  const loadReviews = useCallback(async () => {
    if (!selectedListing) {
      setReviews([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await DatabaseService.getListingReviewsForOwner(selectedListing);
      setReviews(data as ReviewWithResponse[]);
    } catch (err) {
      console.error("Load reviews error:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedListing]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  async function handleSubmitResponse(reviewId: string) {
    if (!responseText.trim() || !selectedListing) return;
    setSubmitting(true);
    try {
      await DatabaseService.respondToReview({
        reviewId,
        listingId: selectedListing,
        content: responseText.trim(),
        userId: user!.id,
      });
      setRespondingTo(null);
      setResponseText("");
      await loadReviews();
    } catch (err) {
      console.error("Response submit error:", err);
    } finally {
      setSubmitting(false);
    }
  }

  const filteredReviews = reviews.filter((r) => {
    const hasResponse = r.response && r.response.length > 0;
    if (filter === "unanswered") return !hasResponse;
    if (filter === "answered") return hasResponse;
    return true;
  });

  const filterTabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: t("panel:reviews.filters.all") },
    { key: "unanswered", label: t("panel:reviews.filters.unanswered") },
    { key: "answered", label: t("panel:reviews.filters.answered") },
  ];

  return (
    <div>
      <PageHeader title={t("panel:reviews.title")} />

      {/* Listing selector */}
      {claims.length > 1 && (
        <div className="mb-6">
          <select
            value={selectedListing}
            onChange={(e) => setSelectedListing(e.target.value)}
            className="w-full sm:w-auto rounded-xl border border-bilinc-border bg-bilinc-input px-4 py-3 text-bilinc-text placeholder:text-bilinc-text-tertiary focus:outline-none focus:ring-2 focus:ring-bilinc-primary/30"
          >
            {claims.map((claim) => (
              <option key={claim.id} value={claim.listing?.id || ""}>
                {claim.listing?.name || t("common:entityType.business")}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Filter tabs */}
      <FilterTabs
        tabs={filterTabs}
        value={filter}
        onChange={setFilter}
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-bilinc-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredReviews.length === 0 ? (
        <EmptyState
          icon="star"
          title={t("panel:reviews.emptyTitle")}
          subtitle={
            filter === "unanswered"
              ? t("panel:reviews.emptyUnanswered")
              : filter === "answered"
              ? t("panel:reviews.emptyAnswered")
              : t("panel:reviews.emptyAll")
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredReviews.map((review) => {
            const hasResponse = review.response && review.response.length > 0;
            const isResponding = respondingTo === review.id;

            return (
              <div key={review.id} className="bg-bilinc-surface border border-bilinc-border rounded-2xl p-5">
                {/* Review header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-bilinc-primary/10 flex items-center justify-center text-bilinc-primary text-sm font-bold">
                      {review.user?.username?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-bilinc-text">{review.user?.username || t("panel:reviews.anonymous")}</p>
                      <p className="text-xs text-bilinc-text-secondary">{formatRelativeDate(review.created_at)}</p>
                    </div>
                  </div>
                  <StarRating rating={review.rating} size="sm" />
                </div>

                {/* Review content */}
                {review.title && (
                  <h4 className="font-medium text-bilinc-text mb-1">{review.title}</h4>
                )}
                <p className="text-sm text-bilinc-text-secondary mb-4">{review.content}</p>

                {/* Response section */}
                {hasResponse ? (
                  <div className="border-l-2 border-bilinc-primary bg-bilinc-surface-secondary rounded-lg p-4">
                    <p className="text-xs font-semibold text-bilinc-primary mb-1">{t("panel:reviews.yourResponse")}</p>
                    <p className="text-sm text-bilinc-text">{review.response![0].content}</p>
                    <p className="text-xs text-bilinc-text-secondary mt-2">{formatRelativeDate(review.response![0].created_at)}</p>
                  </div>
                ) : isResponding ? (
                  <div className="bg-bilinc-surface-secondary rounded-xl p-4">
                    <textarea
                      value={responseText}
                      onChange={(e) => setResponseText(e.target.value)}
                      placeholder={t("panel:reviews.responsePlaceholder")}
                      rows={3}
                      className="w-full rounded-xl border border-bilinc-border bg-bilinc-input px-4 py-3 text-bilinc-text placeholder:text-bilinc-text-tertiary focus:outline-none focus:ring-2 focus:ring-bilinc-primary/30 resize-none"
                    />
                    <div className="flex justify-end gap-2 mt-3">
                      <button
                        onClick={() => { setRespondingTo(null); setResponseText(""); }}
                        className={buttonClasses("outline", "sm")}
                      >
                        {t("common:actions.cancel")}
                      </button>
                      <button
                        onClick={() => handleSubmitResponse(review.id)}
                        disabled={submitting || !responseText.trim()}
                        className={buttonClasses("primary", "sm")}
                      >
                        {submitting ? t("panel:reviews.submitting") : t("common:actions.submit")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setRespondingTo(review.id); setResponseText(""); }}
                    className={buttonClasses("primary", "sm")}
                  >
                    {t("panel:reviews.writeResponse")}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
